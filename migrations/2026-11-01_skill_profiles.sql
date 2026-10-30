-- আমার স্কিল, আমার আইডেন্টিটি: a member's self-declared skill page, public at protishthan.com/s/<username>.
-- Everything here is self-declared by the owner and is shown as such. Nothing is public until the owner publishes
-- (with consent). Anonymous visitors never read the table: they use get_skill_profile(), which returns a published,
-- not-hidden profile only. Admins can hide a profile. Run after 2026-10-26_admin_users.sql (is_admin()) and
-- 2026-10-29_members.sql. Safe to run more than once.

create table if not exists public.skill_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null default '',
  headline text not null default '',
  about text not null default '',
  skills jsonb not null default '[]'::jsonb,            -- [{ "n": "Video Editing", "l": 1..4 }]
  links jsonb not null default '[]'::jsonb,             -- [{ "t": "Behance", "u": "https://..." }]
  badges text[] not null default '{}',
  theme text not null default 'midnight',
  avatar text,                                          -- 'av:<id>:<skin>' (our avatars) or a Google photo URL
  published boolean not null default false,
  hidden boolean not null default false,                -- set by an admin only
  consent_at timestamptz,
  og_key uuid not null default gen_random_uuid(),       -- name of the share-preview image in Storage
  og_version int not null default 0,
  views bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint sp_username_chk check (username ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  constraint sp_theme_chk check (theme in ('midnight', 'aurora', 'ocean', 'ember', 'paper'))
);
create unique index if not exists skill_profiles_username_key on public.skill_profiles (lower(username));
create index if not exists skill_profiles_pub_idx on public.skill_profiles (published, hidden);

create table if not exists public.skill_views (
  device text not null check (char_length(device) between 8 and 64),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  primary key (device, user_id, day)
);
create table if not exists public.skill_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  device text not null,
  created_at timestamptz not null default now()
);
alter table public.skill_profiles enable row level security;
alter table public.skill_views enable row level security;
alter table public.skill_reports enable row level security;
revoke all on public.skill_views from anon, authenticated;
revoke all on public.skill_reports from anon, authenticated;
revoke all on public.skill_profiles from anon;

-- ---------- text filter (conservative on purpose; admins can always hide a profile) ----------
create or replace function public.skill_text_ok(t text)
returns boolean language sql immutable as $$
  select t is null or not (
    lower(t) ~ '\y(fuck|fucking|shit|bitch|porn|xxx|nude|nigger|cunt|pussy|slut|whore)\y'
    or t ~ '(চোদ|চুদ|মাগি|মাগী|খানকি|হারামজাদা|বেশ্যা)'
  );
$$;

-- ---------- validation + housekeeping on every write ----------
create or replace function public.skill_profiles_guard()
returns trigger language plpgsql as $$
declare
  s jsonb; l jsonb; sk jsonb := '[]'::jsonb; lk jsonb := '[]'::jsonb; nm text; lv int; u text; t text; b text; becoming_public boolean;
  reserved text[] := array['admin','api','s','skill','skills','card','member','login','logout','signup','partner','army','agent','software','results','privacy','terms','about','help','support','protishthan','official','root','www','mail','static','assets','null','undefined','me','new','edit','settings'];
  ok_badges text[] := array['self-taught','freelancer','problem-solver','zero-degree','creator','builder','night-owl','mentor','learner','open-source'];
begin
  new.username := lower(trim(new.username));
  if new.username = any (reserved) then raise exception 'USERNAME_RESERVED'; end if;
  new.display_name := left(regexp_replace(trim(coalesce(new.display_name, '')), '\s+', ' ', 'g'), 60);
  new.headline := left(regexp_replace(trim(coalesce(new.headline, '')), '\s+', ' ', 'g'), 70);
  new.about := left(trim(coalesce(new.about, '')), 160);
  if not (public.skill_text_ok(new.username) and public.skill_text_ok(new.display_name) and public.skill_text_ok(new.headline) and public.skill_text_ok(new.about)) then
    raise exception 'BAD_TEXT';
  end if;

  if jsonb_typeof(coalesce(new.skills, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(new.skills, '[]'::jsonb)) > 8 then raise exception 'BAD_SKILLS'; end if;
  for s in select * from jsonb_array_elements(coalesce(new.skills, '[]'::jsonb)) loop
    nm := left(regexp_replace(trim(coalesce(s ->> 'n', '')), '\s+', ' ', 'g'), 30);
    begin lv := (s ->> 'l')::int; exception when others then lv := 2; end;
    if nm = '' then continue; end if;
    if not public.skill_text_ok(nm) then raise exception 'BAD_TEXT'; end if;
    sk := sk || jsonb_build_array(jsonb_build_object('n', nm, 'l', greatest(1, least(4, coalesce(lv, 2)))));
  end loop;
  new.skills := sk;

  if jsonb_typeof(coalesce(new.links, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(new.links, '[]'::jsonb)) > 3 then raise exception 'BAD_LINKS'; end if;
  for l in select * from jsonb_array_elements(coalesce(new.links, '[]'::jsonb)) loop
    u := trim(coalesce(l ->> 'u', '')); t := left(trim(coalesce(l ->> 't', '')), 30);
    if u = '' then continue; end if;
    if char_length(u) > 200 or u !~* '^https?://[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(/[^\s]*)?$' then raise exception 'BAD_LINK_URL'; end if;
    if not public.skill_text_ok(t) then raise exception 'BAD_TEXT'; end if;
    lk := lk || jsonb_build_array(jsonb_build_object('t', t, 'u', u));
  end loop;
  new.links := lk;

  if coalesce(array_length(new.badges, 1), 0) > 2 then raise exception 'BAD_BADGES'; end if;
  foreach b in array coalesce(new.badges, '{}') loop
    if not (b = any (ok_badges)) then raise exception 'BAD_BADGES'; end if;
  end loop;

  if new.avatar is not null and new.avatar !~ '^av:[a-z0-9_-]{1,30}:[0-4]$' and new.avatar !~ '^https://[a-z0-9.-]+\.googleusercontent\.com/[^\s]{1,300}$' then
    raise exception 'BAD_AVATAR';
  end if;

  -- becoming public (a new row that is already published, or a draft being published)
  becoming_public := false;
  if new.published then
    if tg_op = 'INSERT' then becoming_public := true;
    else becoming_public := not old.published; end if;
  end if;
  if becoming_public then
    if new.consent_at is null then raise exception 'NEED_CONSENT'; end if;
    if new.display_name = '' or jsonb_array_length(new.skills) = 0 then raise exception 'NEED_NAME_AND_SKILL'; end if;
    new.published_at := now();
  end if;

  if tg_op = 'UPDATE' then
    -- the preview image is re-made (and its address changes) only when what people see has changed
    if (new.username, new.display_name, new.headline, new.about, new.skills, new.links, new.badges, new.theme, new.avatar)
       is distinct from (old.username, old.display_name, old.headline, old.about, old.skills, old.links, old.badges, old.theme, old.avatar) then
      new.og_version := old.og_version + 1;
      new.updated_at := now();
    elsif new.published is distinct from old.published then
      new.updated_at := now();
    end if;
  else
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_skill_profiles_guard on public.skill_profiles;
create trigger trg_skill_profiles_guard before insert or update on public.skill_profiles for each row execute function public.skill_profiles_guard();

-- ---------- who can do what ----------
revoke insert, update on public.skill_profiles from authenticated;
grant select, delete on public.skill_profiles to authenticated;
grant insert (user_id, username, display_name, headline, about, skills, links, badges, theme, avatar, published, consent_at) on public.skill_profiles to authenticated;
grant update (username, display_name, headline, about, skills, links, badges, theme, avatar, published, consent_at) on public.skill_profiles to authenticated;
drop policy if exists sp_own_select on public.skill_profiles;
drop policy if exists sp_own_insert on public.skill_profiles;
drop policy if exists sp_own_update on public.skill_profiles;
drop policy if exists sp_own_delete on public.skill_profiles;
drop policy if exists sp_admin_select on public.skill_profiles;
create policy sp_own_select on public.skill_profiles for select to authenticated using (user_id = auth.uid());
create policy sp_own_insert on public.skill_profiles for insert to authenticated with check (user_id = auth.uid());
create policy sp_own_update on public.skill_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sp_own_delete on public.skill_profiles for delete to authenticated using (user_id = auth.uid());
create policy sp_admin_select on public.skill_profiles for select to authenticated using (public.is_admin());
drop policy if exists sr_admin_select on public.skill_reports;
drop policy if exists sr_admin_delete on public.skill_reports;
grant select, delete on public.skill_reports to authenticated;
create policy sr_admin_select on public.skill_reports for select to authenticated using (public.is_admin());
create policy sr_admin_delete on public.skill_reports for delete to authenticated using (public.is_admin());

-- ---------- public read: a published, not-hidden profile, by username ----------
create or replace function public.get_skill_profile(p_username text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'username', username, 'display_name', display_name, 'headline', headline, 'about', about,
    'skills', skills, 'links', links, 'badges', to_jsonb(badges), 'theme', theme, 'avatar', avatar,
    'og_key', og_key, 'og_version', og_version, 'views', views, 'published_at', published_at)
  from public.skill_profiles
  where lower(username) = lower(coalesce(p_username, '')) and published and not hidden
  limit 1;
$$;
revoke all on function public.get_skill_profile(text) from public;
grant execute on function public.get_skill_profile(text) to anon, authenticated;

-- is this username free (and allowed)? the owner's own current name counts as free
create or replace function public.skill_username_free(p text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare u text := lower(trim(coalesce(p, '')));
begin
  if u !~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' then return false; end if;
  if u = any (array['admin','api','s','skill','skills','card','member','login','logout','signup','partner','army','agent','software','results','privacy','terms','about','help','support','protishthan','official','root','www','mail','static','assets','null','undefined','me','new','edit','settings']) then return false; end if;
  if not public.skill_text_ok(u) then return false; end if;
  return not exists (select 1 from public.skill_profiles where lower(username) = u and user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid));
end $$;
revoke all on function public.skill_username_free(text) from public;
grant execute on function public.skill_username_free(text) to anon, authenticated;

-- a visit: counted once per device per day
create or replace function public.skill_track_view(p_username text, p_device text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid; ins int;
begin
  if p_device is null or char_length(p_device) < 8 or char_length(p_device) > 64 then return; end if;
  select user_id into uid from public.skill_profiles where lower(username) = lower(coalesce(p_username, '')) and published and not hidden;
  if uid is null then return; end if;
  insert into public.skill_views (device, user_id) values (p_device, uid) on conflict do nothing;
  get diagnostics ins = row_count;
  if ins > 0 then update public.skill_profiles set views = views + 1 where user_id = uid; end if;
end $$;
revoke all on function public.skill_track_view(text, text) from public;
grant execute on function public.skill_track_view(text, text) to anon, authenticated;

-- numbers for the home of the feature: how many identities, and the most common skills (names only)
create or replace function public.skill_popular()
returns jsonb language sql stable security definer set search_path = public as $$
  with p as (select skills from public.skill_profiles where published and not hidden),
  s as (select lower(e ->> 'n') as k, min(e ->> 'n') as n, count(*) as c from p, jsonb_array_elements(p.skills) e group by lower(e ->> 'n'))
  select jsonb_build_object(
    'total', (select count(*) from p),
    'skills', coalesce((select jsonb_agg(jsonb_build_object('n', n, 'c', c) order by c desc, n) from (select n, c from s order by c desc, n limit 8) t), '[]'::jsonb));
$$;
revoke all on function public.skill_popular() from public;
grant execute on function public.skill_popular() to anon, authenticated;

-- report a profile (5 a day per device)
create or replace function public.report_skill_profile(p_username text, p_reason text, p_device text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid; n int;
begin
  if p_device is null or char_length(p_device) < 8 or char_length(p_device) > 64 then return; end if;
  if coalesce(p_reason, '') not in ('fake', 'abusive', 'copyright', 'private', 'other') then return; end if;
  select user_id into uid from public.skill_profiles where lower(username) = lower(coalesce(p_username, ''));
  if uid is null then return; end if;
  select count(*) into n from public.skill_reports where device = p_device and created_at > now() - interval '1 day';
  if n >= 5 then return; end if;
  insert into public.skill_reports (user_id, reason, device) values (uid, p_reason, p_device);
end $$;
revoke all on function public.report_skill_profile(text, text, text) from public;
grant execute on function public.report_skill_profile(text, text, text) to anon, authenticated;

-- admin: hide / show a profile
create or replace function public.admin_set_skill_hidden(p_user uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  update public.skill_profiles set hidden = coalesce(p_hidden, false) where user_id = p_user;
end $$;
revoke all on function public.admin_set_skill_hidden(uuid, boolean) from public, anon;
grant execute on function public.admin_set_skill_hidden(uuid, boolean) to authenticated;

-- ---------- share-preview image (Storage). Only the owner may write the one file named after their og_key ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('skill-og', 'skill-og', true, 409600, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 409600, allowed_mime_types = array['image/jpeg'];

drop policy if exists skill_og_read on storage.objects;
drop policy if exists skill_og_insert on storage.objects;
drop policy if exists skill_og_update on storage.objects;
drop policy if exists skill_og_delete on storage.objects;
create policy skill_og_read on storage.objects for select using (bucket_id = 'skill-og');
create policy skill_og_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'skill-og' and name = (select og_key::text || '.jpg' from public.skill_profiles where user_id = auth.uid()));
create policy skill_og_update on storage.objects for update to authenticated
  using (bucket_id = 'skill-og' and name = (select og_key::text || '.jpg' from public.skill_profiles where user_id = auth.uid()))
  with check (bucket_id = 'skill-og' and name = (select og_key::text || '.jpg' from public.skill_profiles where user_id = auth.uid()));
create policy skill_og_delete on storage.objects for delete to authenticated
  using (bucket_id = 'skill-og' and name = (select og_key::text || '.jpg' from public.skill_profiles where user_id = auth.uid()));

-- check
select count(*) as skill_profiles from public.skill_profiles;
