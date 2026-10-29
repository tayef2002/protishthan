-- Protishthan সদস্য (member): a free account for ordinary visitors, signed in with Google.
-- Separate from institution / teacher / guardian / student / army accounts (those use other
-- sessions in the browser). A member's rows are visible only to that member (and admins).
-- Run 2026-10-26_admin_users.sql first (is_admin()). Safe to run more than once.

-- 1) the member profile
create table if not exists public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  email text,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.members enable row level security;
drop policy if exists members_own_read on public.members;
create policy members_own_read on public.members for select to authenticated using (user_id = auth.uid());
drop policy if exists members_own_update on public.members;
create policy members_own_update on public.members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists members_admin_read on public.members;
create policy members_admin_read on public.members for select to authenticated using (public.is_admin());
drop policy if exists members_own_delete on public.members;
create policy members_own_delete on public.members for delete to authenticated using (user_id = auth.uid());
revoke all on public.members from anon;

-- 2) called right after a Google sign-in: creates the member row once, then only refreshes last_seen.
--    Name / photo / email come from the signed-in token, never from the browser's request.
create or replace function public.ensure_member()
returns public.members language plpgsql security definer set search_path = public as $$
declare
  me public.members;
  meta jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  insert into public.members (user_id, display_name, avatar_url, email)
  values (auth.uid(),
          coalesce(meta ->> 'full_name', meta ->> 'name', split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)),
          coalesce(meta ->> 'avatar_url', meta ->> 'picture'),
          auth.jwt() ->> 'email')
  on conflict (user_id) do update set last_seen = now()
  returning * into me;
  return me;
end $$;
revoke all on function public.ensure_member() from public, anon;
grant execute on function public.ensure_member() to authenticated;

-- 3) institutions a member saved
create table if not exists public.saved_institutions (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listing_submissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index if not exists saved_institutions_listing_idx on public.saved_institutions (listing_id);
alter table public.saved_institutions enable row level security;
drop policy if exists saved_own_all on public.saved_institutions;
create policy saved_own_all on public.saved_institutions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.saved_institutions from anon;

-- 4) the member's শিক্ষিত কার্ড, kept so it follows them to any device
create table if not exists public.member_cards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  saved_at bigint not null default 0,             -- client clock (ms), used to pick the newer copy
  updated_at timestamptz not null default now()
);
alter table public.member_cards enable row level security;
drop policy if exists member_cards_own_all on public.member_cards;
create policy member_cards_own_all on public.member_cards for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.member_cards from anon;

-- 5) check
select 'members' as t, count(*) from public.members
union all select 'saved_institutions', count(*) from public.saved_institutions
union all select 'member_cards', count(*) from public.member_cards;
