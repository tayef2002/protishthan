-- আমার এলাকা: a signed-in member picks their upazila, sees its institutions inside their profile, and can verify / complete an institution's details
-- ("contribution"). A contribution is reviewed (admin, or the Partner a listing is assigned to); once approved the details are applied to the listing, it becomes
-- "verified", and it is linked to the member who did it (contributor_id), so it shows under "আমার অবদান" for good.
--   * the member never writes to listing_submissions directly: everything goes through submit_contribution() / review_contribution()
--   * only a fixed list of fields can be contributed; every value is length-checked; a member can have at most one open contribution per institution
-- Commission is NOT changed here: it still follows the Partner (assigned_agent_id). contributor_id is the credit/attribution record.
-- Run after 2026-11-23. Safe to run more than once.

-- 1) the member's area
alter table public.members add column if not exists area_district text, add column if not exists area_upazila text;

create or replace function public.set_my_area(p_district text, p_upazila text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  update public.members set area_district = left(nullif(btrim(p_district), ''), 60), area_upazila = left(nullif(btrim(p_upazila), ''), 60) where user_id = auth.uid();
end $$;
revoke all on function public.set_my_area(text, text) from public, anon;
grant execute on function public.set_my_area(text, text) to authenticated;

-- 2) who verified a listing
alter table public.listing_submissions add column if not exists contributor_id uuid, add column if not exists verified_at timestamptz, add column if not exists verified_method text;
create index if not exists listing_contributor_idx on public.listing_submissions (contributor_id) where contributor_id is not null;
create index if not exists listing_area_idx on public.listing_submissions (district, upazila);

create or replace function public.listing_guard()
returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    new.status := old.status;
    new.desired_slug := old.desired_slug;
    new.institution_id := old.institution_id;
    new.assigned_agent_id := old.assigned_agent_id;
    new.prn_number := old.prn_number;
    new.verification := old.verification;
    new.source := old.source;
    new.source_url := old.source_url;
    new.source_id := old.source_id;
    new.collected_at := old.collected_at;
    new.name_en := old.name_en;
    new.email_hint := old.email_hint;
    new.contributor_id := old.contributor_id;
    new.verified_at := old.verified_at;
    new.verified_method := old.verified_method;
  end if;
  return new;
end $$;

-- 3) contributions
create table if not exists public.listing_contributions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listing_submissions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  method text not null check (method in ('visited', 'phoned', 'head', 'official')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists contribution_one_open on public.listing_contributions (listing_id, user_id) where status = 'pending';
create index if not exists contribution_user_idx on public.listing_contributions (user_id, created_at desc);
create index if not exists contribution_open_idx on public.listing_contributions (status, created_at) where status = 'pending';
alter table public.listing_contributions enable row level security;
revoke all on public.listing_contributions from anon, authenticated;
grant select on public.listing_contributions to authenticated;
drop policy if exists contribution_own_read on public.listing_contributions;
create policy contribution_own_read on public.listing_contributions for select to authenticated using (user_id = auth.uid());
drop policy if exists contribution_admin_read on public.listing_contributions;
create policy contribution_admin_read on public.listing_contributions for select to authenticated using (public.is_admin());

-- the fields a member may contribute
create or replace function public.contribution_clean(p jsonb)
returns jsonb language plpgsql immutable as $$
declare
  txt text[] := array['contact_name', 'contact_phone', 'address_note', 'founding_year', 'student_count', 'teacher_count', 'class_range', 'gender_type', 'ownership', 'admission_status', 'fee_range', 'description', 'facebook_link'];
  arr text[] := array['medium', 'facilities', 'achievements'];
  k text; v jsonb; out jsonb := '{}'::jsonb; t text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return out; end if;
  foreach k in array txt loop
    if p ? k and jsonb_typeof(p -> k) in ('string', 'number') then
      t := btrim(p ->> k);
      if t <> '' then
        if char_length(t) > 600 then raise exception 'BAD_DATA'; end if;
        if k = 'contact_phone' and t !~ '^01[0-9]{9}$' then raise exception 'BAD_PHONE'; end if;
        if k = 'facebook_link' and t !~* '^https?://' then raise exception 'BAD_DATA'; end if;
        out := out || jsonb_build_object(k, t);
      end if;
    end if;
  end loop;
  foreach k in array arr loop
    if p ? k and jsonb_typeof(p -> k) = 'array' then
      if jsonb_array_length(p -> k) > 12 then raise exception 'BAD_DATA'; end if;
      for v in select * from jsonb_array_elements(p -> k) loop
        if jsonb_typeof(v) <> 'string' or char_length(v #>> '{}') > 60 then raise exception 'BAD_DATA'; end if;
      end loop;
      if jsonb_array_length(p -> k) > 0 then out := out || jsonb_build_object(k, p -> k); end if;
    end if;
  end loop;
  return out;
end $$;

create or replace function public.submit_contribution(p_listing uuid, p_payload jsonb, p_method text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare l public.listing_submissions; clean jsonb; cid uuid;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  perform public.ensure_member();
  select * into l from public.listing_submissions where id = p_listing and status = 'approved';
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_method is null or p_method not in ('visited', 'phoned', 'head', 'official') then raise exception 'MISSING_METHOD'; end if;
  if (select count(*) from public.listing_contributions where user_id = auth.uid() and status = 'pending') >= 20 then raise exception 'TOO_MANY'; end if;
  if (select count(*) from public.listing_contributions where user_id = auth.uid() and created_at > now() - interval '1 day') >= 60 then raise exception 'TOO_MANY'; end if;
  clean := public.contribution_clean(p_payload);
  if clean = '{}'::jsonb then raise exception 'NOTHING_TO_SAVE'; end if;
  -- the values must fit the real columns (numbers, lists…)
  begin perform jsonb_populate_record(null::public.listing_submissions, clean); exception when others then raise exception 'BAD_DATA'; end;
  insert into public.listing_contributions (listing_id, user_id, payload, method, note)
  values (p_listing, auth.uid(), clean, p_method, left(nullif(btrim(coalesce(p_note, '')), ''), 500))
  returning id into cid;
  return cid;
exception when unique_violation then raise exception 'ALREADY_PENDING';
end $$;
revoke all on function public.submit_contribution(uuid, jsonb, text, text) from public, anon;
grant execute on function public.submit_contribution(uuid, jsonb, text, text) to authenticated;

-- 4) review: an admin or the Partner the listing is assigned to
create or replace function public.review_contribution(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.listing_contributions; l public.listing_submissions; r public.listing_submissions; pl jsonb;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into c from public.listing_contributions where id = p_id and status = 'pending' for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into l from public.listing_submissions where id = c.listing_id;
  if not (public.is_admin() or l.assigned_agent_id in (select a.id from public.agents a where a.user_id = auth.uid())) then raise exception 'NOT_ALLOWED'; end if;
  if p_approve then
    pl := c.payload; r := jsonb_populate_record(null::public.listing_submissions, pl);
    update public.listing_submissions x set
      contact_name = case when pl ? 'contact_name' then r.contact_name else x.contact_name end,
      contact_phone = case when pl ? 'contact_phone' then r.contact_phone else x.contact_phone end,
      address_note = case when pl ? 'address_note' then r.address_note else x.address_note end,
      founding_year = case when pl ? 'founding_year' then r.founding_year else x.founding_year end,
      student_count = case when pl ? 'student_count' then r.student_count else x.student_count end,
      teacher_count = case when pl ? 'teacher_count' then r.teacher_count else x.teacher_count end,
      class_range = case when pl ? 'class_range' then r.class_range else x.class_range end,
      gender_type = case when pl ? 'gender_type' then r.gender_type else x.gender_type end,
      ownership = case when pl ? 'ownership' then r.ownership else x.ownership end,
      admission_status = case when pl ? 'admission_status' then r.admission_status else x.admission_status end,
      fee_range = case when pl ? 'fee_range' then r.fee_range else x.fee_range end,
      description = case when pl ? 'description' then r.description else x.description end,
      facebook_link = case when pl ? 'facebook_link' then r.facebook_link else x.facebook_link end,
      medium = case when pl ? 'medium' then r.medium else x.medium end,
      facilities = case when pl ? 'facilities' then r.facilities else x.facilities end,
      achievements = case when pl ? 'achievements' then r.achievements else x.achievements end,
      verification = 'verified',
      verified_at = coalesce(x.verified_at, now()),
      verified_method = coalesce(x.verified_method, c.method),
      contributor_id = coalesce(x.contributor_id, c.user_id)          -- the first approved verifier is the one the institution is linked to
    where x.id = c.listing_id;
  end if;
  update public.listing_contributions set status = case when p_approve then 'approved' else 'rejected' end,
    review_note = left(nullif(btrim(coalesce(p_note, '')), ''), 300), reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
end $$;
revoke all on function public.review_contribution(uuid, boolean, text) from public, anon;
grant execute on function public.review_contribution(uuid, boolean, text) to authenticated;

-- 5) the member's area: numbers and the list
create or replace function public.area_summary(p_district text, p_upazila text)
returns table (total bigint, verified bigint, mine bigint, open_mine bigint)
language sql stable security definer set search_path = public as $$
  select count(*), count(*) filter (where l.verification = 'verified'), count(*) filter (where l.contributor_id = auth.uid()),
         (select count(*) from public.listing_contributions c join public.listing_submissions x on x.id = c.listing_id
            where c.user_id = auth.uid() and c.status = 'pending' and x.district = p_district and x.upazila = p_upazila)
  from public.listing_submissions l
  where l.status = 'approved' and coalesce(l.is_hidden, false) = false and l.district = p_district and l.upazila = p_upazila
$$;
revoke all on function public.area_summary(text, text) from public, anon;
grant execute on function public.area_summary(text, text) to authenticated;

create or replace function public.area_institutions(p_district text, p_upazila text, p_filter text default 'all', p_q text default null, p_limit int default 30, p_offset int default 0)
returns table (id uuid, institution_name text, name_en text, institution_type text, desired_slug text, verification text, prn_number integer, source_id text, mine boolean, my_status text, total bigint)
language plpgsql stable security definer set search_path = public as $$
declare q text := nullif(public.bn_key(p_q), '');
begin
  return query
    select l.id, l.institution_name, l.name_en, l.institution_type, l.desired_slug, l.verification, l.prn_number, l.source_id,
           (l.contributor_id is not null and l.contributor_id = auth.uid()),
           (select c.status from public.listing_contributions c where c.listing_id = l.id and c.user_id = auth.uid() order by (c.status = 'pending') desc, c.created_at desc limit 1),
           count(*) over ()
    from public.listing_submissions l
    where l.status = 'approved' and coalesce(l.is_hidden, false) = false and l.district = p_district and l.upazila = p_upazila
      and (coalesce(p_filter, 'all') <> 'todo' or l.verification = 'unverified')
      and (coalesce(p_filter, 'all') <> 'done' or l.verification = 'verified')
      and (coalesce(p_filter, 'all') <> 'mine' or l.contributor_id = auth.uid())
      and (q is null or l.search_key like '%' || q || '%' or l.search_key_en like '%' || q || '%')
    order by (l.verification = 'unverified') desc, l.institution_type, l.institution_name, l.id
    limit least(greatest(coalesce(p_limit, 30), 1), 60) offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke all on function public.area_institutions(text, text, text, text, int, int) from public, anon;
grant execute on function public.area_institutions(text, text, text, text, int, int) to authenticated;

-- check
select count(*) as contributions_table_ok from public.listing_contributions;
select public.contribution_clean('{"student_count":"450","medium":["বাংলা মিডিয়াম"],"junk":"x"}'::jsonb) as cleaned;
