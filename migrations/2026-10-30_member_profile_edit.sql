-- Members can edit their own name and add their OWN picture (never Google's).
-- Run after 2026-10-29_members.sql and 2026-10-29_members_name_email_only.sql. Safe to run again.

-- 1) ensure_member() must not wipe the chosen picture on every login:
--    it only creates the row once (name from Google, no picture) and later just refreshes last_seen.
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
  on conflict (user_id) do update set last_seen = now()
  returning * into me;
  return me;
end $$;
revoke all on function public.ensure_member() from public, anon;
grant execute on function public.ensure_member() to authenticated;

-- 2) a member may change only display_name and avatar_url (not email, dates, ids)
revoke update on public.members from authenticated;
grant update (display_name, avatar_url) on public.members to authenticated;

-- 3) sane limits: a short name, and the picture must be a small image stored inline
alter table public.members drop constraint if exists members_name_len;
alter table public.members add constraint members_name_len
  check (display_name is null or char_length(display_name) between 1 and 80);

alter table public.members drop constraint if exists members_avatar_ok;
alter table public.members add constraint members_avatar_ok
  check (avatar_url is null or (avatar_url ~ '^data:image/(jpeg|png|webp);base64,' and length(avatar_url) < 200000));

-- 4) check
select count(*) as members, count(avatar_url) as with_own_picture from public.members;
