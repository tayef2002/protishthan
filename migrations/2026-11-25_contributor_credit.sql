-- যাচাইকারীর নাম প্রতিষ্ঠানের পাতায়: "যাচাই করেছেন <নাম>". The member who verified an institution is credited on its page, so people see that someone did the work.
--  * the name is shown only if the member ticked "আমার নাম দেখান" when submitting (default: yes); it is a copy taken when the contribution is approved
--  * the credit goes to the first approved verifier (as before); later approved contributions improve the data but do not replace the credit
--  * if a member deletes their data, the credit (name and link) is removed from every institution
-- Run after 2026-11-24. Safe to run more than once.

alter table public.listing_contributions add column if not exists show_name boolean not null default true;
alter table public.listing_submissions add column if not exists contributor_name text;

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
    new.contributor_name := old.contributor_name;
  end if;
  return new;
end $$;


drop function if exists public.submit_contribution(uuid, jsonb, text, text);
create or replace function public.submit_contribution(p_listing uuid, p_payload jsonb, p_method text, p_note text default null, p_show_name boolean default true)
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
  insert into public.listing_contributions (listing_id, user_id, payload, method, note, show_name)
  values (p_listing, auth.uid(), clean, p_method, left(nullif(btrim(coalesce(p_note, '')), ''), 500), coalesce(p_show_name, true))
  returning id into cid;
  return cid;
exception when unique_violation then raise exception 'ALREADY_PENDING';
end $$;
revoke all on function public.submit_contribution(uuid, jsonb, text, text, boolean) from public, anon;
grant execute on function public.submit_contribution(uuid, jsonb, text, text, boolean) to authenticated;


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
      contributor_id = coalesce(x.contributor_id, c.user_id),          -- the first approved verifier is the one the institution is linked to
      contributor_name = case when x.contributor_id is null then (case when c.show_name then (select nullif(btrim(m.display_name), '') from public.members m where m.user_id = c.user_id) else null end) else x.contributor_name end
    where x.id = c.listing_id;
  end if;
  update public.listing_contributions set status = case when p_approve then 'approved' else 'rejected' end,
    review_note = left(nullif(btrim(coalesce(p_note, '')), ''), 300), reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
end $$;
revoke all on function public.review_contribution(uuid, boolean, text) from public, anon;
grant execute on function public.review_contribution(uuid, boolean, text) to authenticated;


-- a deleted member leaves no name behind
create or replace function public.member_credit_cleanup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.listing_submissions set contributor_name = null, contributor_id = null where contributor_id = old.user_id;
  return old;
end $$;
drop trigger if exists member_credit_cleanup_trg on public.members;
create trigger member_credit_cleanup_trg before delete on public.members for each row execute function public.member_credit_cleanup();

-- how many institutions a member is credited for (shown next to the name; a number only)
create or replace function public.contributor_count(p_listing uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.listing_submissions where contributor_id = (select contributor_id from public.listing_submissions where id = p_listing) and contributor_id is not null
$$;
revoke all on function public.contributor_count(uuid) from public;
grant execute on function public.contributor_count(uuid) to anon, authenticated;

-- check
select count(*) filter (where contributor_name is not null) as credited from public.listing_submissions;
