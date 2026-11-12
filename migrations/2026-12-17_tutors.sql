-- ভাইয়া-আপু (টিউটর পেজ, /tutor): টিউটরের প্রোফাইল, অভিভাবকের অনুরোধ, আর অ্যাডমিনের হাতে মিলিয়ে দেওয়ার তালিকা।
-- Tutor profiles, guardians' requests and the admin's manual matching, for the page /tutor (phase A).
-- Needs 2026-10-26_admin_users.sql (is_admin) and 2026-11-01_skill_profiles.sql (skill_text_ok, the bad-word list). Safe to run more than once.
--
-- How it works (phase A):
--   * A guardian sends a REQUEST (no account): name, mobile, class, subjects, area. Only the admin reads requests. The mobile number is never public.
--   * A tutor signs in with Google (the site's member login) and fills a PROFILE in steps; drafts are saved on the server. Submitting puts it in review.
--   * The admin approves profiles and matches by hand (admin tab "ভাইয়া-আপু"). The public list (/tutor search) stays EMPTY until the admin switches "public_listing" on,
--     so nobody is shown before the owner decides. Approved profiles show: display name, institution, department, subjects, classes, mode, district and upazila, bio.
--     NEVER public: mobile number, full name, expected fee, admin notes, exact address.
--   * Every write goes through a function that checks the same things the pages check (the pages can be bypassed): lengths, lists, mobile format, no links/e-mail/phone in free text,
--     the bad-word list, limits per device, per mobile and per site. Tables are closed to the browser; only the admin (listed in admin_users) reads and changes them directly.
--   * A tutor's own profile is read and saved only through tutor_my_profile / tutor_profile_save (the signed-in member's own row).

create table if not exists public.tutor_settings (
  id int primary key default 1 check (id = 1),
  public_listing boolean not null default false,   -- false = the search never returns anybody
  requests_open boolean not null default true       -- false = new guardian requests are refused ("CLOSED")
);
insert into public.tutor_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.tutor_profiles (
  user_id uuid primary key,                                                        -- the member (auth user)
  pid text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),   -- the public id (never the user id)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'paused')),
  full_name text not null default '' check (char_length(full_name) <= 60),       -- real name: admin only
  display_name text not null default '' check (char_length(display_name) <= 30), -- shown to guardians
  gender text not null default '' check (gender in ('', 'female', 'male')),
  phone text not null default '' check (char_length(phone) <= 20),               -- WhatsApp/mobile: admin only (and the tutor)
  institution text not null default '' check (char_length(institution) <= 80),
  department text not null default '' check (char_length(department) <= 60),
  edu_level text not null default '' check (edu_level in ('', 'hsc', 'bachelor', 'masters', 'graduate')),
  subjects text[] not null default '{}' check (cardinality(subjects) <= 10),
  classes text[] not null default '{}' check (cardinality(classes) <= 5),
  modes text[] not null default '{}' check (cardinality(modes) <= 2),
  times text[] not null default '{}' check (cardinality(times) <= 4),
  district text not null default '' check (char_length(district) <= 40),
  upazila text not null default '' check (char_length(upazila) <= 60),
  area_note text not null default '' check (char_length(area_note) <= 80),       -- neighbourhood, admin only
  fee_note text not null default '' check (char_length(fee_note) <= 60),         -- expected fee, admin only
  bio text not null default '' check (char_length(bio) <= 400),
  age_ok boolean not null default false,
  terms_ok boolean not null default false,
  terms_at timestamptz,
  approved_at timestamptz,                                                         -- set the first time the admin approves (a paused tutor returns to approved)
  verify text not null default 'none' check (verify in ('none', 'pending', 'verified')),   -- only the admin sets this, after really checking
  verified_at timestamptz,
  admin_note text not null default '' check (char_length(admin_note) <= 600),
  edited boolean not null default false,        -- changed after approval: the admin should look again
  seen boolean not null default false           -- false = the admin has not looked yet (drives the badge)
);
create index if not exists tutor_profiles_search_idx on public.tutor_profiles (district, upazila) where status = 'approved';
create index if not exists tutor_profiles_status_idx on public.tutor_profiles (status, updated_at desc);

create table if not exists public.tutor_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 60),
  phone text not null check (phone ~ '^01[3-9][0-9]{8}$'),
  district text not null default '' check (char_length(district) <= 40),
  upazila text not null default '' check (char_length(upazila) <= 60),
  class_band text not null check (class_band in ('c1-5', 'c6-8', 'c9-10', 'c11-12', 'admission')),
  subjects text[] not null check (cardinality(subjects) between 1 and 6),
  mode text not null default 'any' check (mode in ('home', 'online', 'any')),
  note text not null default '' check (char_length(note) <= 300),
  tutor_pid text,                                   -- the profile the guardian asked for, if any
  device text not null check (char_length(device) between 8 and 64),
  user_id uuid,                                     -- set when the guardian was signed in
  status text not null default 'new' check (status in ('new', 'matching', 'matched', 'closed', 'spam')),
  admin_note text not null default '' check (char_length(admin_note) <= 600),
  seen boolean not null default false
);
create index if not exists tutor_requests_status_idx on public.tutor_requests (status, created_at desc);
create index if not exists tutor_requests_phone_idx on public.tutor_requests (phone, created_at desc);
create index if not exists tutor_requests_device_idx on public.tutor_requests (device, created_at desc);

create table if not exists public.tutor_matches (   -- who was sent which request (written by the admin page)
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_id uuid not null references public.tutor_requests(id) on delete cascade,
  tutor_id uuid not null references public.tutor_profiles(user_id) on delete cascade,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'started')),
  unique (request_id, tutor_id)
);

create or replace function public.tutor_touch() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists tutor_profiles_touch on public.tutor_profiles;
create trigger tutor_profiles_touch before update on public.tutor_profiles for each row execute function public.tutor_touch();

-- the closed tables: only the admin reads and changes them directly
alter table public.tutor_settings enable row level security;
alter table public.tutor_profiles enable row level security;
alter table public.tutor_requests enable row level security;
alter table public.tutor_matches enable row level security;
revoke all on public.tutor_settings, public.tutor_profiles, public.tutor_requests, public.tutor_matches from anon, authenticated;
grant select, update on public.tutor_settings to authenticated;
grant select, update, delete on public.tutor_profiles to authenticated;
grant select, update, delete on public.tutor_requests to authenticated;
grant select, insert, update, delete on public.tutor_matches to authenticated;
drop policy if exists tutor_settings_admin on public.tutor_settings;
create policy tutor_settings_admin on public.tutor_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists tutor_profiles_admin on public.tutor_profiles;
create policy tutor_profiles_admin on public.tutor_profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists tutor_requests_admin on public.tutor_requests;
create policy tutor_requests_admin on public.tutor_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists tutor_matches_admin on public.tutor_matches;
create policy tutor_matches_admin on public.tutor_matches for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- the lists (the same lists are in tutor-data.js) ----------
create or replace function public.tutor_subject_keys() returns text[] language sql immutable as $$
  select array['bangla','english','math','science','physics','chemistry','biology','hmath','ict','accounting','business','economics','social','religion','arabic','handwriting','admission','primary_all']
$$;
create or replace function public.tutor_class_keys() returns text[] language sql immutable as $$ select array['c1-5','c6-8','c9-10','c11-12','admission'] $$;
create or replace function public.tutor_mode_keys() returns text[] language sql immutable as $$ select array['home','online'] $$;
create or replace function public.tutor_time_keys() returns text[] language sql immutable as $$ select array['morning','afternoon','evening','weekend'] $$;

-- ---------- small helpers ----------
create or replace function public.tutor_clean(p text, p_max int) returns text language sql immutable as $$
  select left(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), p_max)
$$;

-- a Bangladeshi mobile number (01XXXXXXXXX, Bangla digits, spaces, dashes, +88 and 88 allowed), or '' when it is not one
create or replace function public.tutor_phone(p text) returns text language sql immutable as $$
  select case when n ~ '^8801[3-9][0-9]{8}$' then substr(n, 3) when n ~ '^01[3-9][0-9]{8}$' then n else '' end
    from (select regexp_replace(translate(coalesce(p, ''), '০১২৩৪৫৬৭৮৯', '0123456789'), '[\s\-\.\(\)\+]', '', 'g') as n) s
$$;

-- null when a free text is fine, else why not: BAD_TEXT (bad word), BAD_LINK (link or e-mail), BAD_PRIVATE (a phone number or a long number)
create or replace function public.tutor_text_problem(p text) returns text language plpgsql as $$
declare plain text; compact text;
begin
  if coalesce(p, '') = '' then return null; end if;
  if not public.skill_text_ok(p) then return 'BAD_TEXT'; end if;
  plain := translate(p, '০১২৩৪৫৬৭৮৯', '0123456789');
  compact := regexp_replace(plain, '[\s\-\.\(\)\+]', '', 'g');
  if plain ~* '(https?:|www\.|\.(com|net|org|info|xyz|link|bd)($|[^a-z]))' or plain ~ '[^\s@]+@[^\s@]+' then return 'BAD_LINK'; end if;
  if compact ~ '01[3-9][0-9]{8}' or plain ~ '[0-9]{10,}' then return 'BAD_PRIVATE'; end if;
  return null;
end $$;

-- a json array of strings -> only the allowed ones, no repeats, at most p_max, in a fixed order
create or replace function public.tutor_pick(p jsonb, p_allowed text[], p_max int) returns text[] language sql immutable as $$
  select coalesce((select array_agg(x order by x) from (select distinct v.x from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) as v(x) where v.x = any(p_allowed) limit p_max) t), '{}')
$$;

-- ---------- public: is the list on, are requests open ----------
create or replace function public.tutor_state() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('listing', coalesce(s.public_listing, false), 'requests', coalesce(s.requests_open, true)) from (select 1) o left join public.tutor_settings s on s.id = 1
$$;

-- ---------- public: the search (approved profiles, and only when the admin has switched the list on) ----------
create or replace function public.tutor_search(p_district text default null, p_upazila text default null, p_class text default null, p_subject text default null, p_mode text default null, p_limit int default 12, p_offset int default 0)
returns table (pid text, name text, gender text, institution text, department text, edu_level text, subjects text[], classes text[], modes text[], times text[], district text, upazila text, bio text, verified boolean, local boolean, total bigint)
language sql stable security definer set search_path = public as $$
  with s as (
    select t.*,
           ((nullif(p_district, '') is null or t.district = p_district) and (nullif(p_upazila, '') is null or t.upazila = p_upazila)) as loc_ok,
           ('online' = any(t.modes)) as online_ok
      from public.tutor_profiles t
     where coalesce((select x.public_listing from public.tutor_settings x where x.id = 1), false)
       and t.status = 'approved'
       and (nullif(p_class, '') is null or p_class = any(t.classes))
       and (nullif(p_subject, '') is null or p_subject = any(t.subjects))
  )
  select s.pid, coalesce(nullif(s.display_name, ''), split_part(s.full_name, ' ', 1)), s.gender, s.institution, s.department, s.edu_level, s.subjects, s.classes, s.modes, s.times, s.district, s.upazila, s.bio,
         s.verify = 'verified', s.loc_ok, count(*) over ()
    from s
   where case when p_mode = 'online' then s.online_ok
              when p_mode = 'home' then s.loc_ok and 'home' = any(s.modes)
              else (s.loc_ok or s.online_ok) end
   order by s.loc_ok desc, (s.verify = 'verified') desc, s.updated_at desc
   limit greatest(1, least(coalesce(p_limit, 12), 30))
  offset greatest(0, least(coalesce(p_offset, 0), 500))
$$;

-- ---------- public: a guardian's request. Answers {id}; a refusal raises one of:
-- SPAM CLOSED BAD_DEVICE BAD_NAME BAD_PHONE BAD_CLASS BAD_SUBJECT BAD_MODE BAD_AREA BAD_TEXT BAD_LINK BAD_PRIVATE TOO_FAST DAILY_LIMIT PHONE_LIMIT DUPLICATE BUSY
create or replace function public.tutor_request_add(
  p_device text, p_name text, p_phone text, p_district text, p_upazila text, p_class text,
  p_subjects text[], p_mode text, p_note text, p_tutor text, p_hp text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  dev text := left(coalesce(btrim(p_device), ''), 64);
  nm text := public.tutor_clean(p_name, 60);
  ph text := public.tutor_phone(p_phone);
  d text := public.tutor_clean(p_district, 40);
  u text := public.tutor_clean(p_upazila, 60);
  nt text := public.tutor_clean(p_note, 300);
  md text := coalesce(nullif(btrim(p_mode), ''), 'any');
  tp text := nullif(left(coalesce(btrim(p_tutor), ''), 24), '');
  subs text[]; open boolean; prob text; new_id uuid;
begin
  if coalesce(p_hp, '') <> '' then raise exception 'SPAM'; end if;
  if char_length(dev) < 8 then raise exception 'BAD_DEVICE'; end if;
  select s.requests_open into open from public.tutor_settings s where s.id = 1;
  if not coalesce(open, true) then raise exception 'CLOSED'; end if;
  if char_length(nm) < 2 then raise exception 'BAD_NAME'; end if;
  if ph = '' then raise exception 'BAD_PHONE'; end if;
  if p_class is null or not (p_class = any(public.tutor_class_keys())) then raise exception 'BAD_CLASS'; end if;
  select coalesce(array_agg(x order by x), '{}') into subs from (select distinct v.x from unnest(coalesce(p_subjects, '{}')) as v(x)) t;
  if cardinality(subs) < 1 or cardinality(subs) > 6 or not (subs <@ public.tutor_subject_keys()) then raise exception 'BAD_SUBJECT'; end if;
  if md not in ('home', 'online', 'any') then raise exception 'BAD_MODE'; end if;
  if md <> 'online' and (d = '' or u = '') then raise exception 'BAD_AREA'; end if;
  prob := coalesce(public.tutor_text_problem(nm), public.tutor_text_problem(nt));
  if prob is not null then raise exception '%', prob; end if;
  if exists (select 1 from public.tutor_requests r where r.device = dev and r.created_at > now() - interval '30 seconds') then raise exception 'TOO_FAST'; end if;
  if (select count(*) from public.tutor_requests r where r.device = dev and r.created_at > now() - interval '1 day') >= 3 then raise exception 'DAILY_LIMIT'; end if;
  if (select count(*) from public.tutor_requests r where r.phone = ph and r.created_at > now() - interval '1 day') >= 3 then raise exception 'PHONE_LIMIT'; end if;
  if exists (select 1 from public.tutor_requests r where r.phone = ph and r.class_band = p_class and r.subjects = subs and r.tutor_pid is not distinct from tp and r.created_at > now() - interval '7 days') then raise exception 'DUPLICATE'; end if;
  if (select count(*) from public.tutor_requests r where r.created_at > now() - interval '10 minutes') >= 60 then raise exception 'BUSY'; end if;
  insert into public.tutor_requests (name, phone, district, upazila, class_band, subjects, mode, note, tutor_pid, device, user_id)
  values (nm, ph, d, u, p_class, subs, md, nt, tp, dev, auth.uid())
  returning tutor_requests.id into new_id;
  return jsonb_build_object('id', new_id);
end $$;

-- ---------- a tutor's own profile (the signed-in member) ----------
create or replace function public.tutor_my_profile() returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(t) - 'admin_note' - 'seen' - 'user_id' from public.tutor_profiles t where t.user_id = auth.uid()
$$;

-- save (p_submit = false: a draft, only cleaned; true: the whole thing is checked and goes to review).
-- Refusals: NOT_SIGNED_IN BAD_TEXT BAD_LINK BAD_PRIVATE, and for a submit NEED_NAME NEED_PHONE NEED_STUDY NEED_SUBJECT NEED_CLASS NEED_MODE NEED_AREA NEED_BIO NEED_AGE NEED_TERMS
create or replace function public.tutor_profile_save(p_data jsonb, p_submit boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d jsonb := coalesce(p_data, '{}'::jsonb);
  cur public.tutor_profiles;
  fn text := public.tutor_clean(d->>'full_name', 60);
  dn text := public.tutor_clean(d->>'display_name', 30);
  gd text := case when d->>'gender' in ('female', 'male') then d->>'gender' else '' end;
  ph text := public.tutor_phone(d->>'phone');
  ins text := public.tutor_clean(d->>'institution', 80);
  dep text := public.tutor_clean(d->>'department', 60);
  lv text := case when d->>'edu_level' in ('hsc', 'bachelor', 'masters', 'graduate') then d->>'edu_level' else '' end;
  subs text[] := public.tutor_pick(d->'subjects', public.tutor_subject_keys(), 10);
  cls text[] := public.tutor_pick(d->'classes', public.tutor_class_keys(), 5);
  mds text[] := public.tutor_pick(d->'modes', public.tutor_mode_keys(), 2);
  tms text[] := public.tutor_pick(d->'times', public.tutor_time_keys(), 4);
  di text := public.tutor_clean(d->>'district', 40);
  up text := public.tutor_clean(d->>'upazila', 60);
  an text := public.tutor_clean(d->>'area_note', 80);
  fe text := public.tutor_clean(d->>'fee_note', 60);
  bi text := left(btrim(regexp_replace(regexp_replace(coalesce(d->>'bio', ''), '[ \t]+', ' ', 'g'), E'\n{3,}', E'\n\n', 'g')), 400);
  age boolean := coalesce((d->>'age_ok')::boolean, false);
  trm boolean := coalesce((d->>'terms_ok')::boolean, false);
  prob text; st text; ed boolean; sn boolean; ta timestamptz; out jsonb;
begin
  if uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  -- free text is always checked, a draft too: nothing bad is ever stored
  prob := coalesce(public.tutor_text_problem(fn), public.tutor_text_problem(dn), public.tutor_text_problem(ins), public.tutor_text_problem(dep), public.tutor_text_problem(an), public.tutor_text_problem(fe), public.tutor_text_problem(bi));
  if prob is not null then raise exception '%', prob; end if;
  if dn = '' then dn := left(split_part(fn, ' ', 1), 30); end if;
  if p_submit then
    if char_length(fn) < 2 or char_length(dn) < 2 then raise exception 'NEED_NAME'; end if;
    if ph = '' then raise exception 'NEED_PHONE'; end if;
    if char_length(ins) < 2 or char_length(dep) < 2 or lv = '' then raise exception 'NEED_STUDY'; end if;
    if cardinality(subs) < 1 then raise exception 'NEED_SUBJECT'; end if;
    if cardinality(cls) < 1 then raise exception 'NEED_CLASS'; end if;
    if cardinality(mds) < 1 then raise exception 'NEED_MODE'; end if;
    if (di = '' or up = '') and 'home' = any(mds) then raise exception 'NEED_AREA'; end if;
    if di = '' then raise exception 'NEED_AREA'; end if;
    if char_length(bi) < 20 then raise exception 'NEED_BIO'; end if;
    if not age then raise exception 'NEED_AGE'; end if;
    if not trm then raise exception 'NEED_TERMS'; end if;
  end if;
  select * into cur from public.tutor_profiles where user_id = uid;
  if not found then
    insert into public.tutor_profiles (user_id, status, full_name, display_name, gender, phone, institution, department, edu_level, subjects, classes, modes, times, district, upazila, area_note, fee_note, bio, age_ok, terms_ok, terms_at, seen)
    values (uid, case when p_submit then 'submitted' else 'draft' end, fn, dn, gd, ph, ins, dep, lv, subs, cls, mds, tms, di, up, an, fe, bi, age, trm, case when trm then now() end, not p_submit);
  else
    st := case when p_submit then (case when cur.status in ('approved', 'paused') then cur.status else 'submitted' end)
               else (case when cur.status = 'rejected' then 'draft' else cur.status end) end;
    -- an approved profile whose public words changed is flagged for another look (it stays visible meanwhile)
    ed := cur.edited or (cur.status = 'approved' and (cur.display_name, cur.institution, cur.department, cur.subjects, cur.classes, cur.modes, cur.district, cur.upazila, cur.bio) is distinct from (dn, ins, dep, subs, cls, mds, di, up, bi));
    sn := case when p_submit or (ed and not cur.edited) then false else cur.seen end;
    ta := case when trm and cur.terms_at is null then now() else cur.terms_at end;
    update public.tutor_profiles set status = st, full_name = fn, display_name = dn, gender = gd, phone = ph, institution = ins, department = dep, edu_level = lv, subjects = subs, classes = cls, modes = mds, times = tms,
           district = di, upazila = up, area_note = an, fee_note = fe, bio = bi, age_ok = age, terms_ok = trm, terms_at = ta, edited = ed, seen = sn where user_id = uid;
  end if;
  select public.tutor_my_profile() into out;
  return out;
end $$;

-- a tutor pauses or resumes their own approved profile
create or replace function public.tutor_profile_pause(p_pause boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  update public.tutor_profiles set status = case when p_pause then 'paused' else 'approved' end
   where user_id = uid and ((p_pause and status = 'approved') or (not p_pause and status = 'paused' and approved_at is not null));
  return public.tutor_my_profile();
end $$;

revoke all on function public.tutor_state() from public;
revoke all on function public.tutor_search(text, text, text, text, text, int, int) from public;
revoke all on function public.tutor_request_add(text, text, text, text, text, text, text[], text, text, text, text) from public;
revoke all on function public.tutor_my_profile() from public;
revoke all on function public.tutor_profile_save(jsonb, boolean) from public;
revoke all on function public.tutor_profile_pause(boolean) from public;
grant execute on function public.tutor_state() to anon, authenticated;
grant execute on function public.tutor_search(text, text, text, text, text, int, int) to anon, authenticated;
grant execute on function public.tutor_request_add(text, text, text, text, text, text, text[], text, text, text, text) to anon, authenticated;
grant execute on function public.tutor_my_profile() to authenticated;
grant execute on function public.tutor_profile_save(jsonb, boolean) to authenticated;
grant execute on function public.tutor_profile_pause(boolean) to authenticated;

-- check: all three answers must come without an error (the list is empty and "listing" is false until the admin switches it on)
select public.tutor_state() as state;
select count(*) as tutors from public.tutor_search(null, null, null, null, null, 5, 0);
select count(*) as requests from public.tutor_requests;
