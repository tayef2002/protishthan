-- আমার প্রতিষ্ঠান, the owner's own plan:
--   * "আমার প্রতিষ্ঠান" = the institution a person studies at NOW (any type: school, madrasa, college, university...), or studied at. One per member, optional, changeable.
--   * the BATCH = the SSC (Dakhil) batch only, one per member per institution: nothing else is opened. It stays optional too.
-- This file:
--  1) member_institution: one row per member (slug + studying / studied), closed to the browser, written only by the functions below
--  2) functions: member_set_institution(slug, status), member_clear_institution(), member_institution_me()
--  3) the counter (institution_member_counts) counts a PERSON once per institution across BOTH links (the current institution and the SSC batch)
--  4) batch_level_ok is SSC only again (the earlier file widened it by my misreading; rows already made stay, nothing new of another level can be made)
--  5) batch_year_ok allows the SSC years up to now + 6, so a student who is still at school can open or join the batch of the year they will sit it
--  6) a member who already said "studying" in a batch gets that institution as the current one (they said it themselves), nothing else is guessed
-- Needs 2027-01-06_my_institution.sql. Safe to run more than once. Self-declared: nothing here proves anything. Counts only, no names.

-- 1) the table
create table if not exists public.member_institution (
  user_id uuid primary key references auth.users(id) on delete cascade,
  institution_slug text not null,
  status text not null default 'studying' check (status in ('studying', 'studied')),
  updated_at timestamptz not null default now()
);
create index if not exists member_institution_slug_idx on public.member_institution (institution_slug);
alter table public.member_institution enable row level security;
revoke all on public.member_institution from anon, authenticated;

-- 3) the counter: a person counts once per institution, whichever link they have (or both)
create or replace function public.batch_members_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.institution_slug is not null
       and not exists (select 1 from public.batch_members m where m.user_id = new.user_id and m.institution_slug = new.institution_slug and m.batch_id <> new.batch_id)
       and not exists (select 1 from public.member_institution c where c.user_id = new.user_id and c.institution_slug = new.institution_slug) then
      insert into public.institution_member_counts (slug, members) values (new.institution_slug, 1)
        on conflict (slug) do update set members = public.institution_member_counts.members + 1;
    end if;
  elsif tg_op = 'DELETE' then
    if old.institution_slug is not null
       and not exists (select 1 from public.batch_members m where m.user_id = old.user_id and m.institution_slug = old.institution_slug and m.batch_id <> old.batch_id)
       and not exists (select 1 from public.member_institution c where c.user_id = old.user_id and c.institution_slug = old.institution_slug) then
      update public.institution_member_counts set members = greatest(members - 1, 0) where slug = old.institution_slug;
    end if;
  end if;
  return null;
end $$;

create or replace function public.member_institution_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and (tg_op = 'DELETE' or old.institution_slug is distinct from new.institution_slug) then
    if not exists (select 1 from public.batch_members m where m.user_id = old.user_id and m.institution_slug = old.institution_slug) then
      update public.institution_member_counts set members = greatest(members - 1, 0) where slug = old.institution_slug;
    end if;
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.institution_slug is distinct from new.institution_slug) then
    if not exists (select 1 from public.batch_members m where m.user_id = new.user_id and m.institution_slug = new.institution_slug) then
      insert into public.institution_member_counts (slug, members) values (new.institution_slug, 1)
        on conflict (slug) do update set members = public.institution_member_counts.members + 1;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists member_institution_ai on public.member_institution;
create trigger member_institution_ai after insert on public.member_institution for each row execute function public.member_institution_after_change();
drop trigger if exists member_institution_au on public.member_institution;
create trigger member_institution_au after update on public.member_institution for each row execute function public.member_institution_after_change();
drop trigger if exists member_institution_ad on public.member_institution;
create trigger member_institution_ad after delete on public.member_institution for each row execute function public.member_institution_after_change();

-- 2) the functions
-- 2a) choose (or change) the current institution
create or replace function public.member_set_institution(p_slug text, p_status text default 'studying')
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if p_status is null or p_status not in ('studying', 'studied') then return jsonb_build_object('ok', false, 'error', 'BAD_STATUS'); end if;
  if not exists (select 1 from public.listing_submissions l where l.desired_slug = p_slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false) then
    return jsonb_build_object('ok', false, 'error', 'NO_INSTITUTION');
  end if;
  insert into public.member_institution (user_id, institution_slug, status) values (uid, p_slug, p_status)
    on conflict (user_id) do update set institution_slug = excluded.institution_slug, status = excluded.status, updated_at = now();
  return jsonb_build_object('ok', true, 'slug', p_slug, 'status', p_status,
    'institution_members', coalesce((select c.members from public.institution_member_counts c where c.slug = p_slug), 0));
end $$;

-- 2b) take it away again
create or replace function public.member_clear_institution()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  delete from public.member_institution where user_id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

-- 2c) mine: {} when there is none (or signed out)
create or replace function public.member_institution_me()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if auth.uid() is null then return '{}'::jsonb; end if;
  select jsonb_build_object('slug', c.institution_slug, 'status', c.status,
           'name', (select l.institution_name from public.listing_submissions l where l.desired_slug = c.institution_slug and l.status = 'approved' limit 1),
           'type', (select l.institution_type from public.listing_submissions l where l.desired_slug = c.institution_slug and l.status = 'approved' limit 1))
    into r from public.member_institution c where c.user_id = auth.uid();
  return coalesce(r, '{}'::jsonb);
end $$;

-- 4) + 5) the rules of the batch: SSC only, the year up to now + 6
create or replace function public.batch_level_ok(l text) returns boolean language sql immutable as $$
  select l = 'ssc'
$$;
create or replace function public.batch_year_ok(y int) returns boolean language sql stable as $$
  select y is not null and y between 1970 and extract(year from now())::int + 6
$$;

-- 6) the members who already said "studying" in a batch: that is their current institution (the first such batch they joined)
insert into public.member_institution (user_id, institution_slug, status)
  select distinct on (m.user_id) m.user_id, m.institution_slug, 'studying'
    from public.batch_members m
   where m.status = 'studying' and m.institution_slug is not null
     and exists (select 1 from public.listing_submissions l where l.desired_slug = m.institution_slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false)
   order by m.user_id, m.joined_at, m.batch_id
  on conflict (user_id) do nothing;

-- the numbers of today: a person once per institution, across both links (a second run puts them right again)
insert into public.institution_member_counts (slug, members)
  select s, count(distinct u) from (
    select institution_slug as s, user_id as u from public.batch_members where institution_slug is not null
    union all
    select institution_slug, user_id from public.member_institution
  ) x group by s
  on conflict (slug) do update set members = excluded.members;
update public.institution_member_counts c set members = 0
 where not exists (select 1 from public.batch_members m where m.institution_slug = c.slug)
   and not exists (select 1 from public.member_institution i where i.institution_slug = c.slug);

revoke all on function public.member_institution_after_change() from public, anon, authenticated;
revoke all on function public.batch_members_after_change() from public, anon, authenticated;
-- Supabase grants execute to anon on every new function by default, so anon is named here too
revoke all on function public.member_set_institution(text, text) from public, anon;
revoke all on function public.member_clear_institution() from public, anon;
revoke all on function public.member_institution_me() from public, anon;
grant execute on function public.member_set_institution(text, text) to authenticated;
grant execute on function public.member_clear_institution() to authenticated;
grant execute on function public.member_institution_me() to authenticated;
