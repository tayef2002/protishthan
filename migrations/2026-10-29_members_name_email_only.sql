-- Members: keep ONLY name + email. The profile picture Google sends along is never stored.
-- (Google bundles name and picture in one "profile" permission and Supabase cannot split it,
--  so the picture arrives but is discarded right away, before it is written anywhere.)
-- Run 2026-10-29_members.sql first. Safe to run more than once.

-- 1) ensure_member() no longer stores a picture
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
          null,
          auth.jwt() ->> 'email')
  on conflict (user_id) do update set last_seen = now(), avatar_url = null
  returning * into me;
  return me;
end $$;
revoke all on function public.ensure_member() from public, anon;
grant execute on function public.ensure_member() to authenticated;

-- 2) never let the picture be written into the login records
create or replace function public.strip_google_picture()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'users' then
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'avatar_url' - 'picture';
  elsif tg_table_name = 'identities' then
    new.identity_data := coalesce(new.identity_data, '{}'::jsonb) - 'avatar_url' - 'picture';
  end if;
  return new;
end $$;

drop trigger if exists strip_google_picture_users on auth.users;
create trigger strip_google_picture_users before insert or update of raw_user_meta_data on auth.users
  for each row execute function public.strip_google_picture();

drop trigger if exists strip_google_picture_identities on auth.identities;
create trigger strip_google_picture_identities before insert or update of identity_data on auth.identities
  for each row execute function public.strip_google_picture();

-- 3) clean what is already there
update public.members set avatar_url = null where avatar_url is not null;
update auth.users set raw_user_meta_data = raw_user_meta_data - 'avatar_url' - 'picture'
  where raw_user_meta_data ?| array['avatar_url', 'picture'];
update auth.identities set identity_data = identity_data - 'avatar_url' - 'picture'
  where identity_data ?| array['avatar_url', 'picture'];

-- 4) check: all three numbers should be 0
select
  (select count(*) from public.members where avatar_url is not null) as members_with_picture,
  (select count(*) from auth.users where raw_user_meta_data ?| array['avatar_url', 'picture']) as users_with_picture,
  (select count(*) from auth.identities where identity_data ?| array['avatar_url', 'picture']) as identities_with_picture;
