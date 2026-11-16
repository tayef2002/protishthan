-- আমার প্রতিষ্ঠান (my institution), step 1: the data layer. The batch IS the membership: a member who joins a batch is a member of that institution.
--
--  1) every level can have a batch: primary (psc), jsc, ssc, hsc, bachelor, masters (the madrasa names stay allowed in the column; Dakhil / Alim / Fazil / Kamil are one batch with SSC / HSC / degree / masters)
--  2) batch_members gets: status (studied / studying / left_early: PRIVATE, only the member sees their own), is_primary (the one the member calls "mine"), institution_slug (a copy, so counting works even while a batch is being deleted)
--  3) one batch per member per institution + level (a second SSC batch at the same school is refused; leave the first, then join the right one)
--  4) institution_member_counts: one counter per institution = DISTINCT members (not rows), kept by triggers; closed to the browser, read through institution_members()
--  5) functions: institution_members(slugs), institution_batches(slug) (the batches already opened at an institution, for the "your batchmates are already here" list),
--     member_join_batch(slug, level, year, status, ref) (join the batch if it exists, otherwise open it: the caller becomes the convener), member_set_primary(batch_id)
--  6) batch_me() also returns status and primary
--  Self-declared: nothing here proves a person studied there. Counts only: no function returns a name except the convener's FIRST name that the batch page already shows.
-- Needs 2026-12-26_batches.sql, 2026-12-27_batch_name.sql. Safe to run more than once.

-- 1) levels
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.batches'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%level%' loop
    execute format('alter table public.batches drop constraint %I', c.conname);
  end loop;
  alter table public.batches add constraint batches_level_check check (level in ('psc', 'jsc', 'ssc', 'hsc', 'bachelor', 'masters', 'dakhil', 'alim', 'fazil', 'kamil'));
end $$;
create or replace function public.batch_level_ok(l text) returns boolean language sql immutable as $$
  select l in ('psc', 'jsc', 'ssc', 'hsc', 'bachelor', 'masters')
$$;

-- 2) member columns
alter table public.batch_members add column if not exists status text not null default 'studied';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'batch_members_status_check') then
    alter table public.batch_members add constraint batch_members_status_check check (status in ('studied', 'studying', 'left_early'));
  end if;
end $$;
alter table public.batch_members add column if not exists is_primary boolean not null default false;
alter table public.batch_members add column if not exists institution_slug text;
update public.batch_members m set institution_slug = b.institution_slug from public.batches b where b.id = m.batch_id and m.institution_slug is null;
-- the oldest membership of every member is their primary one (until they choose another)
update public.batch_members m set is_primary = true
  from (select distinct on (user_id) user_id, batch_id from public.batch_members order by user_id, joined_at, batch_id) f
 where m.user_id = f.user_id and m.batch_id = f.batch_id
   and not exists (select 1 from public.batch_members x where x.user_id = m.user_id and x.is_primary);
create unique index if not exists batch_members_one_primary on public.batch_members (user_id) where is_primary;
create index if not exists batch_members_inst_user_idx on public.batch_members (institution_slug, user_id);

-- 3) the insert rules: copy the institution, one batch per institution + level, the first membership is the primary one
create or replace function public.batch_members_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare b record;
begin
  select x.institution_slug, x.level into b from public.batches x where x.id = new.batch_id;
  if not found then raise exception 'NO_BATCH'; end if;
  new.institution_slug := b.institution_slug;
  if exists (select 1 from public.batch_members m join public.batches x on x.id = m.batch_id
              where m.user_id = new.user_id and x.institution_slug = b.institution_slug and x.level = b.level and m.batch_id <> new.batch_id) then
    raise exception 'ONE_PER_LEVEL';
  end if;
  if not exists (select 1 from public.batch_members m where m.user_id = new.user_id and m.is_primary) then new.is_primary := true; end if;
  return new;
end $$;
drop trigger if exists batch_members_bi on public.batch_members;
create trigger batch_members_bi before insert on public.batch_members for each row execute function public.batch_members_before_insert();

-- 4) the counter: distinct members per institution
create table if not exists public.institution_member_counts (
  slug text primary key,
  members int not null default 0 check (members >= 0)
);
alter table public.institution_member_counts enable row level security;
revoke all on public.institution_member_counts from anon, authenticated;
create or replace function public.batch_members_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.institution_slug is not null and not exists (
         select 1 from public.batch_members m where m.user_id = new.user_id and m.institution_slug = new.institution_slug and m.batch_id <> new.batch_id) then
      insert into public.institution_member_counts (slug, members) values (new.institution_slug, 1)
        on conflict (slug) do update set members = public.institution_member_counts.members + 1;
    end if;
  elsif tg_op = 'DELETE' then
    if old.institution_slug is not null and not exists (
         select 1 from public.batch_members m where m.user_id = old.user_id and m.institution_slug = old.institution_slug and m.batch_id <> old.batch_id) then
      update public.institution_member_counts set members = greatest(members - 1, 0) where slug = old.institution_slug;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists batch_members_ai on public.batch_members;
create trigger batch_members_ai after insert on public.batch_members for each row execute function public.batch_members_after_change();
drop trigger if exists batch_members_ad on public.batch_members;
create trigger batch_members_ad after delete on public.batch_members for each row execute function public.batch_members_after_change();
-- the numbers of today (a second run puts them right again)
insert into public.institution_member_counts (slug, members)
  select institution_slug, count(distinct user_id) from public.batch_members where institution_slug is not null group by institution_slug
  on conflict (slug) do update set members = excluded.members;

-- 5a) the counts of the institutions on the screen (a list or a page asks for its own, one call)
create or replace function public.institution_members(p_slugs text[])
returns table (slug text, members int)
language sql stable security definer set search_path = public as $$
  select c.slug, c.members from public.institution_member_counts c
   where c.slug = any(coalesce(p_slugs, '{}'::text[])) and c.members > 0
   limit 100
$$;

-- 5b) the batches already opened at one institution: the list a new member sees ("your batchmates are already here")
create or replace function public.institution_batches(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not exists (select 1 from public.listing_submissions l where l.desired_slug = p_slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(r.j order by r.lvl, r.yr desc) from (
      select array_position(array['psc', 'jsc', 'ssc', 'hsc', 'bachelor', 'masters', 'dakhil', 'alim', 'fazil', 'kamil'], b.level) as lvl, b.exam_year as yr,
             jsonb_build_object(
               'batch_id', b.id, 'level', b.level, 'year', b.exam_year, 'name', b.name, 'status', b.status,
               'members', (select count(*) from public.batch_members x where x.batch_id = b.id),
               'convener', (select public.batch_first_name(mm.display_name) from public.members mm where mm.user_id = b.convener_id),
               'mine', uid is not null and exists (select 1 from public.batch_members x where x.batch_id = b.id and x.user_id = uid)) as j
        from public.batches b
       where b.institution_slug = p_slug and exists (select 1 from public.batch_members x where x.batch_id = b.id)
       order by 1, 2 desc
       limit 60
    ) r
  ), '[]'::jsonb);
end $$;

-- 5c) join a batch, or open it when it does not exist yet (then the caller is the convener); the status is private
create or replace function public.member_join_batch(p_slug text, p_level text, p_year int, p_status text default 'studied', p_ref text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.batches; r jsonb; made boolean := false;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if p_status is null or p_status not in ('studied', 'studying', 'left_early') then return jsonb_build_object('ok', false, 'error', 'BAD_STATUS'); end if;
  if not public.batch_level_ok(p_level) or not public.batch_year_ok(p_year) then return jsonb_build_object('ok', false, 'error', 'BAD_BATCH'); end if;
  if (select count(*) from public.batch_members where user_id = uid and joined_at > now() - interval '1 hour') >= 6 then
    return jsonb_build_object('ok', false, 'error', 'RATE');
  end if;
  begin
    select * into b from public.batches where institution_slug = p_slug and level = p_level and exam_year = p_year;
    if found then
      r := public.batch_join(b.id, p_ref);
    else
      r := public.batch_claim(p_slug, p_level, p_year);
      if coalesce(r ->> 'error', '') = 'EXISTS' then           -- somebody opened it a moment ago: join theirs
        select * into b from public.batches where institution_slug = p_slug and level = p_level and exam_year = p_year;
        r := public.batch_join(b.id, p_ref);
      else
        made := coalesce((r ->> 'ok')::boolean, false);
      end if;
    end if;
  exception when others then
    if sqlerrm = 'ONE_PER_LEVEL' then return jsonb_build_object('ok', false, 'error', 'ONE_PER_LEVEL'); end if;
    raise;
  end;
  if coalesce((r ->> 'ok')::boolean, false) is not true then return r; end if;
  update public.batch_members set status = p_status where batch_id = (r ->> 'batch_id')::uuid and user_id = uid;
  return r || jsonb_build_object('created', made, 'institution_members', coalesce((select c.members from public.institution_member_counts c where c.slug = p_slug), 0));
end $$;

-- 5d) the member chooses which membership is "mine"
create or replace function public.member_set_primary(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if not exists (select 1 from public.batch_members where batch_id = p_batch_id and user_id = uid) then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  update public.batch_members set is_primary = false where user_id = uid and is_primary;
  update public.batch_members set is_primary = true where batch_id = p_batch_id and user_id = uid;
  return jsonb_build_object('ok', true);
end $$;

-- 6) my batches, with the private status and the primary mark
create or replace function public.batch_me()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'batch_id', b.id, 'slug', b.institution_slug, 'level', b.level, 'year', b.exam_year, 'theme', b.theme, 'line', b.line, 'bname', b.name,
      'seq', m.seq, 'role', m.role, 'ref', m.ref_code, 'joined_at', m.joined_at, 'status', m.status, 'primary', m.is_primary,
      'members', (select count(*) from public.batch_members x where x.batch_id = b.id),
      'name', (select l.institution_name from public.listing_submissions l where l.desired_slug = b.institution_slug and l.status = 'approved' limit 1)
    ) order by m.is_primary desc, m.joined_at desc)
    from public.batch_members m join public.batches b on b.id = m.batch_id where m.user_id = auth.uid()
  ), '[]'::jsonb);
end $$;

revoke all on function public.batch_members_before_insert() from public;
revoke all on function public.batch_members_after_change() from public;
revoke all on function public.institution_members(text[]) from public;
revoke all on function public.institution_batches(text) from public;
-- Supabase grants execute to anon on every new function by default, so anon is named here too (revoke from public alone does not remove it)
revoke all on function public.member_join_batch(text, text, int, text, text) from public, anon;
revoke all on function public.member_set_primary(uuid) from public, anon;
revoke all on function public.batch_members_before_insert() from anon, authenticated;
revoke all on function public.batch_members_after_change() from anon, authenticated;
-- the same tidy-up for two functions of the earlier steps (they already returned nothing without a sign-in; now anon cannot even call them)
do $$ begin
  if to_regprocedure('public.log_member_action(text,text[])') is not null then execute 'revoke all on function public.log_member_action(text, text[]) from anon'; end if;
  if to_regprocedure('public.batch_activity(uuid)') is not null then execute 'revoke all on function public.batch_activity(uuid) from anon'; end if;
end $$;
grant execute on function public.institution_members(text[]) to anon, authenticated;
grant execute on function public.institution_batches(text) to anon, authenticated;
grant execute on function public.member_join_batch(text, text, int, text, text) to authenticated;
grant execute on function public.member_set_primary(uuid) to authenticated;
