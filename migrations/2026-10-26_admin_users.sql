-- Admin login: only accounts listed in admin_users can open admin.html,
-- and later money/approval tables will check is_admin() in their RLS.
-- Safe to run more than once.

-- 1) who is an admin (nobody can read/write this table through the API;
--    only the is_admin() function below looks at it)
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

-- 2) "is the logged-in user an admin?"
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 3) make YOUR account an admin.
--    First create the account: Authentication -> Users -> Add user -> Create new user
--    (tick "Auto Confirm User"). Then put that email below and run this part.
insert into public.admin_users (user_id, email)
select id, email from auth.users where lower(email) = lower('YOUR_EMAIL_HERE')
on conflict (user_id) do nothing;

-- 4) check: should show exactly your email
select email, created_at from public.admin_users;
