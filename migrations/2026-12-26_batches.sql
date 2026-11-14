-- আমার ব্যাচ (My batch): a batch = one institution + one level + one exam year, e.g. "Dhaka College, HSC 2018".
-- The first signed-in member to open it is its convener (আহ্বায়ক, member number 1); everybody else joins through the link and gets the next fixed number.
-- Reads for the public page go through batch_lookup() (counts and the convener's first name only, never the member list); the tables themselves are closed.
-- Needs: 2026-10-29_members.sql (members, ensure_member), 2026-10-26_admin_users.sql (is_admin), 2026-11-01_skill_profiles.sql (skill_text_ok), listing_submissions.
-- Safe to run more than once.

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  institution_slug text not null check (char_length(institution_slug) between 2 and 120),
  level text not null check (level in ('ssc', 'hsc', 'bachelor', 'masters', 'dakhil', 'alim', 'fazil', 'kamil')),
  exam_year int not null check (exam_year between 1970 and 2100),
  convener_id uuid references auth.users(id) on delete set null,
  line text check (line is null or char_length(line) <= 120),
  theme text not null default 'blue' check (theme in ('blue', 'violet', 'teal', 'amber', 'rose')),
  status text not null default 'active' check (status in ('active', 'locked')),
  seq_next int not null default 2,                  -- the next member number: only ever goes up, so a number is never given twice, even after someone leaves
  created_at timestamptz not null default now(),
  unique (institution_slug, level, exam_year)
);

create table if not exists public.batch_members (
  batch_id uuid not null references public.batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seq int not null,
  role text not null default 'member' check (role in ('convener', 'co', 'member')),
  joined_at timestamptz not null default now(),
  invited_by uuid references auth.users(id) on delete set null,
  ref_code text not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  primary key (batch_id, user_id),
  unique (batch_id, seq),
  unique (ref_code)
);
create index if not exists batch_members_user_idx on public.batch_members (user_id);

alter table public.batches enable row level security;
alter table public.batch_members enable row level security;
revoke all on public.batches, public.batch_members from anon, authenticated;
grant select on public.batches, public.batch_members to authenticated;           -- still gated by the policies below
drop policy if exists batches_admin on public.batches;
create policy batches_admin on public.batches for select to authenticated using (public.is_admin());
drop policy if exists batches_member on public.batches;
create policy batches_member on public.batches for select to authenticated
  using (exists (select 1 from public.batch_members m where m.batch_id = batches.id and m.user_id = auth.uid()));
drop policy if exists bm_admin on public.batch_members;
create policy bm_admin on public.batch_members for select to authenticated using (public.is_admin());
drop policy if exists bm_own on public.batch_members;
create policy bm_own on public.batch_members for select to authenticated using (user_id = auth.uid());

-- ---------- helpers ----------
create or replace function public.batch_year_ok(y int) returns boolean language sql stable as $$
  select y is not null and y between 1970 and extract(year from now())::int + 1
$$;

-- the first word of a name: the only part of the convener shown publicly
create or replace function public.batch_first_name(n text) returns text language sql immutable as $$
  select nullif(split_part(btrim(regexp_replace(coalesce(n, ''), '\s+', ' ', 'g')), ' ', 1), '')
$$;

-- ---------- 1) the public page: does this batch exist, how many are in, who is the convener ----------
create or replace function public.batch_lookup(p_slug text, p_level text, p_year int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  inst record; b public.batches; n int; conv text; me public.batch_members; mine jsonb := null;
begin
  if p_level not in ('ssc', 'hsc', 'bachelor', 'masters', 'dakhil', 'alim', 'fazil', 'kamil') or not public.batch_year_ok(p_year) then
    return jsonb_build_object('ok', false, 'error', 'BAD_BATCH');
  end if;
  select l.institution_name, l.district, l.upazila, l.institution_type into inst
    from public.listing_submissions l
   where l.desired_slug = p_slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false limit 1;
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_INSTITUTION'); end if;
  select * into b from public.batches where institution_slug = p_slug and level = p_level and exam_year = p_year;
  if found then
    select count(*) into n from public.batch_members where batch_id = b.id;
    select public.batch_first_name(m.display_name) into conv from public.members m where m.user_id = b.convener_id;
    if auth.uid() is not null then
      select * into me from public.batch_members where batch_id = b.id and user_id = auth.uid();
      if found then mine := jsonb_build_object('joined', true, 'seq', me.seq, 'role', me.role, 'ref', me.ref_code); end if;
    end if;
  end if;
  return jsonb_build_object('ok', true,
    'inst', jsonb_build_object('name', inst.institution_name, 'district', inst.district, 'upazila', inst.upazila, 'type', inst.institution_type),
    'batch', case when b.id is null then null else jsonb_build_object('id', b.id, 'members', n, 'convener', conv, 'line', b.line, 'theme', b.theme, 'status', b.status) end,
    'me', mine);
end $$;

-- ---------- 2) open a batch: the caller becomes the convener, member number 1 ----------
create or replace function public.batch_claim(p_slug text, p_level text, p_year int, p_line text default null, p_theme text default 'blue')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); b public.batches; mine int; ln text := nullif(btrim(regexp_replace(coalesce(p_line, ''), '\s+', ' ', 'g')), ''); rc text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  perform public.ensure_member();
  if p_level not in ('ssc', 'hsc', 'bachelor', 'masters', 'dakhil', 'alim', 'fazil', 'kamil') or not public.batch_year_ok(p_year) then
    return jsonb_build_object('ok', false, 'error', 'BAD_BATCH');
  end if;
  if p_theme not in ('blue', 'violet', 'teal', 'amber', 'rose') then return jsonb_build_object('ok', false, 'error', 'BAD_THEME'); end if;
  if ln is not null and (char_length(ln) > 120 or ln ~* '(https?:|www\.|\.com|\.net|\.bd|@|[0-9০-৯]{8,})' or not public.skill_text_ok(ln)) then
    return jsonb_build_object('ok', false, 'error', 'BAD_LINE');
  end if;
  if not exists (select 1 from public.listing_submissions l where l.desired_slug = p_slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false) then
    return jsonb_build_object('ok', false, 'error', 'NO_INSTITUTION');
  end if;
  select count(*) into mine from public.batches where convener_id = uid;
  if mine >= 3 then return jsonb_build_object('ok', false, 'error', 'TOO_MANY'); end if;
  begin
    insert into public.batches (institution_slug, level, exam_year, convener_id, line, theme)
    values (p_slug, p_level, p_year, uid, ln, p_theme) returning * into b;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'EXISTS');
  end;
  insert into public.batch_members (batch_id, user_id, seq, role) values (b.id, uid, 1, 'convener') returning ref_code into rc;
  return jsonb_build_object('ok', true, 'batch_id', b.id, 'seq', 1, 'role', 'convener', 'ref', rc);
end $$;

-- ---------- 3) join an open batch: the next fixed number; an invite code (a member's ref) records who brought you ----------
create or replace function public.batch_join(p_batch_id uuid, p_ref text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); b public.batches; me public.batch_members; nxt int; inv uuid := null; total int;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  perform public.ensure_member();
  select * into b from public.batches where id = p_batch_id for update;                    -- the batch row is the ticket machine: joiners queue here
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_BATCH'); end if;
  select * into me from public.batch_members where batch_id = b.id and user_id = uid;
  if found then return jsonb_build_object('ok', true, 'again', true, 'batch_id', b.id, 'seq', me.seq, 'role', me.role, 'ref', me.ref_code); end if;
  if b.status = 'locked' then return jsonb_build_object('ok', false, 'error', 'LOCKED'); end if;
  select count(*) into total from public.batch_members where user_id = uid;
  if total >= 12 then return jsonb_build_object('ok', false, 'error', 'TOO_MANY'); end if;
  if p_ref is not null and char_length(p_ref) between 4 and 16 then
    select m.user_id into inv from public.batch_members m where m.ref_code = lower(p_ref) and m.user_id <> uid limit 1;
  end if;
  update public.batches set seq_next = seq_next + 1 where id = b.id returning seq_next - 1 into nxt;
  insert into public.batch_members (batch_id, user_id, seq, role, invited_by) values (b.id, uid, nxt, 'member', inv) returning * into me;
  return jsonb_build_object('ok', true, 'batch_id', b.id, 'seq', me.seq, 'role', me.role, 'ref', me.ref_code);
end $$;

-- ---------- 4) my batches ----------
create or replace function public.batch_me()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'batch_id', b.id, 'slug', b.institution_slug, 'level', b.level, 'year', b.exam_year, 'theme', b.theme, 'line', b.line,
      'seq', m.seq, 'role', m.role, 'ref', m.ref_code, 'joined_at', m.joined_at,
      'members', (select count(*) from public.batch_members x where x.batch_id = b.id),
      'name', (select l.institution_name from public.listing_submissions l where l.desired_slug = b.institution_slug and l.status = 'approved' limit 1)
    ) order by m.joined_at desc)
    from public.batch_members m join public.batches b on b.id = m.batch_id where m.user_id = auth.uid()
  ), '[]'::jsonb);
end $$;

-- ---------- 5) leave (the number stays used; if the convener leaves, the earliest member takes over, an empty batch is removed) ----------
create or replace function public.batch_leave(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); me public.batch_members; nxt uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  perform 1 from public.batches where id = p_batch_id for update;
  select * into me from public.batch_members where batch_id = p_batch_id and user_id = uid;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  delete from public.batch_members where batch_id = p_batch_id and user_id = uid;
  if me.role = 'convener' then
    select user_id into nxt from public.batch_members where batch_id = p_batch_id order by (role = 'co') desc, seq asc limit 1;
    if nxt is null then delete from public.batches where id = p_batch_id;
    else
      update public.batch_members set role = 'convener' where batch_id = p_batch_id and user_id = nxt;
      update public.batches set convener_id = nxt where id = p_batch_id;
    end if;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 6) the convener changes the look ----------
create or replace function public.batch_set_look(p_batch_id uuid, p_line text, p_theme text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ln text := nullif(btrim(regexp_replace(coalesce(p_line, ''), '\s+', ' ', 'g')), '');
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if not exists (select 1 from public.batch_members where batch_id = p_batch_id and user_id = uid and role in ('convener', 'co')) then
    return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED');
  end if;
  if p_theme not in ('blue', 'violet', 'teal', 'amber', 'rose') then return jsonb_build_object('ok', false, 'error', 'BAD_THEME'); end if;
  if ln is not null and (char_length(ln) > 120 or ln ~* '(https?:|www\.|\.com|\.net|\.bd|@|[0-9০-৯]{8,})' or not public.skill_text_ok(ln)) then
    return jsonb_build_object('ok', false, 'error', 'BAD_LINE');
  end if;
  update public.batches set line = ln, theme = p_theme where id = p_batch_id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.batch_lookup(text, text, int) from public;
revoke all on function public.batch_claim(text, text, int, text, text) from public;
revoke all on function public.batch_join(uuid, text) from public;
revoke all on function public.batch_me() from public;
revoke all on function public.batch_leave(uuid) from public;
revoke all on function public.batch_set_look(uuid, text, text) from public;
grant execute on function public.batch_lookup(text, text, int) to anon, authenticated;
grant execute on function public.batch_claim(text, text, int, text, text) to authenticated;
grant execute on function public.batch_join(uuid, text) to authenticated;
grant execute on function public.batch_me() to authenticated;
grant execute on function public.batch_leave(uuid) to authenticated;
grant execute on function public.batch_set_look(uuid, text, text) to authenticated;

-- check
select count(*) as batches from public.batches;
