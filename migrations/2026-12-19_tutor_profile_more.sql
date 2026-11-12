-- ভাইয়া-আপু, ধাপ ১: টিউটরের ঐচ্ছিক বাড়তি তথ্য (পড়ানোর ধরন, অভিজ্ঞতা, প্রতিশ্রুতি) আর অভিভাবকের ঐচ্ছিক পছন্দ।
-- Optional extras on a tutor's profile (how they teach, experience, promises) and a guardian's optional wishes on a request.
-- Needs 2026-12-17_tutors.sql. Safe to run more than once, and safe while the old pages are still live: every new column has a default, the old request call (11 arguments) still works.
--
-- What is public and what is not:
--   * PUBLIC on an approved profile (when the admin has switched the list on): medium, exam focus, teaching style, trial yes/no, batch size, days and class length, experience and number taught (both "self-declared"),
--     the tutor's own SSC/HSC GPA and one achievement line (self-declared), the three-promise badge, and the fee range ONLY when the tutor ticked "show my fee".
--   * Nothing here is ever "verified": only the admin's verify mark (set after really looking at papers) is. The pages label every one of these as the tutor's own words.
--   * Still never public: mobile number, real name, exact area, admin notes.

alter table public.tutor_profiles
  add column if not exists medium text[] not null default '{}' check (cardinality(medium) <= 4),
  add column if not exists exams text[] not null default '{}' check (cardinality(exams) <= 8),
  add column if not exists style text[] not null default '{}' check (cardinality(style) <= 5),
  add column if not exists trial boolean not null default false,                                           -- "the first class is a free trial"
  add column if not exists batch text not null default '' check (batch in ('', 'one', 'small', 'both')),
  add column if not exists days_max smallint not null default 0 check (days_max between 0 and 7),        -- at most this many days a week (0 = not said)
  add column if not exists session_mins smallint not null default 0 check (session_mins in (0, 45, 60, 90, 120)),
  add column if not exists exp text not null default '' check (exp in ('', 'new', 'lt1', 'y1_2', 'y3_5', 'y5p')),
  add column if not exists taught text not null default '' check (taught in ('', 'none', 'n1_5', 'n6_20', 'n20p')),
  add column if not exists ssc_gpa text not null default '' check (ssc_gpa = '' or case when ssc_gpa ~ '^[1-5](\.[0-9]{1,2})?$' then ssc_gpa::numeric between 1 and 5 else false end),
  add column if not exists hsc_gpa text not null default '' check (hsc_gpa = '' or case when hsc_gpa ~ '^[1-5](\.[0-9]{1,2})?$' then hsc_gpa::numeric between 1 and 5 else false end),
  add column if not exists achv text not null default '' check (char_length(achv) <= 120),
  add column if not exists fee_show boolean not null default false,                                       -- true = the fee range (fee_note) is shown to guardians
  add column if not exists pledge text[] not null default '{}' check (cardinality(pledge) <= 3);

alter table public.tutor_requests
  add column if not exists pref_gender text not null default '' check (pref_gender in ('', 'female', 'male')),
  add column if not exists student_level text not null default '' check (student_level in ('', 'weak', 'mid', 'good')),
  add column if not exists goal text not null default '' check (goal in ('', 'exam', 'concept', 'homework')),
  add column if not exists want_trial boolean not null default false;

-- ---------- the lists (the same lists are in tutor-data.js) ----------
create or replace function public.tutor_medium_keys() returns text[] language sql immutable as $$ select array['bangla','english_version','english_medium','madrasa'] $$;
create or replace function public.tutor_exam_keys() returns text[] language sql immutable as $$ select array['scholarship','ssc','hsc','admission_med','admission_eng','admission_uni','ielts','olevel'] $$;
create or replace function public.tutor_style_keys() returns text[] language sql immutable as $$ select array['concept','practice','homework','patient','fun'] $$;
create or replace function public.tutor_pledge_keys() returns text[] language sql immutable as $$ select array['guardian_first','open_place','hours'] $$;

-- a GPA typed by a person ("৪.৮৩", "4.83", "5"): the clean text, '' when empty, null when it is not a GPA between 1.00 and 5.00
create or replace function public.tutor_gpa(p text) returns text language sql immutable as $$
  select case when t = '' then '' when t !~ '^[1-5](\.[0-9]{1,2})?$' then null when t::numeric between 1 and 5 then t else null end
    from (select regexp_replace(translate(coalesce(p, ''), '০১২৩৪৫৬৭৮৯।,', '0123456789..'), '\s+', '', 'g') as t) s
$$;

-- ---------- public: the search. It gains columns, so it is dropped and made again ----------
drop function if exists public.tutor_search(text, text, text, text, text, int, int, text, text, text, boolean, boolean, boolean, text);
drop function if exists public.tutor_search(text, text, text, text, text, int, int);
create function public.tutor_search(p_district text default null, p_upazila text default null, p_class text default null, p_subject text default null, p_mode text default null, p_limit int default 12, p_offset int default 0)
returns table (pid text, name text, gender text, institution text, department text, edu_level text, subjects text[], classes text[], modes text[], times text[], district text, upazila text, bio text, verified boolean, local boolean, total bigint,
               medium text[], exams text[], style text[], trial boolean, batch text, days_max int, session_mins int, exp text, taught text, ssc_gpa text, hsc_gpa text, achv text, fee text, pledge_all boolean)
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
         s.verify = 'verified', s.loc_ok, count(*) over (),
         s.medium, s.exams, s.style, s.trial, s.batch, s.days_max::int, s.session_mins::int, s.exp, s.taught, s.ssc_gpa, s.hsc_gpa, s.achv,
         case when s.fee_show then s.fee_note else '' end, cardinality(s.pledge) >= 3
    from s
   where case when p_mode = 'online' then s.online_ok
              when p_mode = 'home' then s.loc_ok and 'home' = any(s.modes)
              else (s.loc_ok or s.online_ok) end
   order by s.loc_ok desc, (s.verify = 'verified') desc, s.updated_at desc
   limit greatest(1, least(coalesce(p_limit, 12), 30))
  offset greatest(0, least(coalesce(p_offset, 0), 500))
$$;
revoke all on function public.tutor_search(text, text, text, text, text, int, int) from public;
grant execute on function public.tutor_search(text, text, text, text, text, int, int) to anon, authenticated;

-- ---------- public: a guardian's request, now with optional wishes (the 11-argument call of the old page still works: the new arguments have defaults) ----------
drop function if exists public.tutor_request_add(text, text, text, text, text, text, text[], text, text, text, text);
create or replace function public.tutor_request_add(
  p_device text, p_name text, p_phone text, p_district text, p_upazila text, p_class text,
  p_subjects text[], p_mode text, p_note text, p_tutor text, p_hp text,
  p_pref text default '', p_level text default '', p_goal text default '', p_trial boolean default false)
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
  pg text := coalesce(nullif(btrim(p_pref), ''), '');
  lv text := coalesce(nullif(btrim(p_level), ''), '');
  gl text := coalesce(nullif(btrim(p_goal), ''), '');
  tr boolean := coalesce(p_trial, false);
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
  if pg not in ('', 'female', 'male') then raise exception 'BAD_PREF'; end if;
  if lv not in ('', 'weak', 'mid', 'good') then raise exception 'BAD_LEVEL'; end if;
  if gl not in ('', 'exam', 'concept', 'homework') then raise exception 'BAD_GOAL'; end if;
  prob := coalesce(public.tutor_text_problem(nm), public.tutor_text_problem(nt));
  if prob is not null then raise exception '%', prob; end if;
  if exists (select 1 from public.tutor_requests r where r.device = dev and r.created_at > now() - interval '30 seconds') then raise exception 'TOO_FAST'; end if;
  if (select count(*) from public.tutor_requests r where r.device = dev and r.created_at > now() - interval '1 day') >= 3 then raise exception 'DAILY_LIMIT'; end if;
  if (select count(*) from public.tutor_requests r where r.phone = ph and r.created_at > now() - interval '1 day') >= 3 then raise exception 'PHONE_LIMIT'; end if;
  if exists (select 1 from public.tutor_requests r where r.phone = ph and r.class_band = p_class and r.subjects = subs and r.tutor_pid is not distinct from tp and r.created_at > now() - interval '7 days') then raise exception 'DUPLICATE'; end if;
  if (select count(*) from public.tutor_requests r where r.created_at > now() - interval '10 minutes') >= 60 then raise exception 'BUSY'; end if;
  insert into public.tutor_requests (name, phone, district, upazila, class_band, subjects, mode, note, tutor_pid, device, user_id, pref_gender, student_level, goal, want_trial)
  values (nm, ph, d, u, p_class, subs, md, nt, tp, dev, auth.uid(), pg, lv, gl, tr)
  returning tutor_requests.id into new_id;
  return jsonb_build_object('id', new_id);
end $$;
revoke all on function public.tutor_request_add(text, text, text, text, text, text, text[], text, text, text, text, text, text, text, boolean) from public;
grant execute on function public.tutor_request_add(text, text, text, text, text, text, text[], text, text, text, text, text, text, text, boolean) to anon, authenticated;

-- ---------- a tutor's own save, now with the extras (a draft is only cleaned; a submit is checked as before: the extras are never required) ----------
-- Refusals as before, plus BAD_GPA (a GPA that is not between 1.00 and 5.00)
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
  -- the optional extras
  xmd text[] := public.tutor_pick(d->'medium', public.tutor_medium_keys(), 4);
  xex text[] := public.tutor_pick(d->'exams', public.tutor_exam_keys(), 8);
  xst text[] := public.tutor_pick(d->'style', public.tutor_style_keys(), 5);
  xtr boolean := coalesce((d->>'trial')::boolean, false);
  xbt text := case when d->>'batch' in ('one', 'small', 'both') then d->>'batch' else '' end;
  xdm int := case when d->>'days_max' ~ '^[0-7]$' then (d->>'days_max')::int else 0 end;
  xsm int := case when d->>'session_mins' in ('45', '60', '90', '120') then (d->>'session_mins')::int else 0 end;
  xxp text := case when d->>'exp' in ('new', 'lt1', 'y1_2', 'y3_5', 'y5p') then d->>'exp' else '' end;
  xtg text := case when d->>'taught' in ('none', 'n1_5', 'n6_20', 'n20p') then d->>'taught' else '' end;
  xsg text := public.tutor_gpa(d->>'ssc_gpa');
  xhg text := public.tutor_gpa(d->>'hsc_gpa');
  xac text := public.tutor_clean(d->>'achv', 120);
  xfs boolean := coalesce((d->>'fee_show')::boolean, false);
  xpl text[] := public.tutor_pick(d->'pledge', public.tutor_pledge_keys(), 3);
  prob text; st text; ed boolean; sn boolean; ta timestamptz; out jsonb;
begin
  if uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  -- free text is always checked, a draft too: nothing bad is ever stored
  prob := coalesce(public.tutor_text_problem(fn), public.tutor_text_problem(dn), public.tutor_text_problem(ins), public.tutor_text_problem(dep), public.tutor_text_problem(an), public.tutor_text_problem(fe), public.tutor_text_problem(xac), public.tutor_text_problem(bi));
  if prob is not null then raise exception '%', prob; end if;
  if (nullif(btrim(coalesce(d->>'ssc_gpa', '')), '') is not null and xsg is null) or (nullif(btrim(coalesce(d->>'hsc_gpa', '')), '') is not null and xhg is null) then raise exception 'BAD_GPA'; end if;
  xsg := coalesce(xsg, ''); xhg := coalesce(xhg, '');
  if fe = '' then xfs := false; end if;       -- there is no fee to show
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
    insert into public.tutor_profiles (user_id, status, full_name, display_name, gender, phone, institution, department, edu_level, subjects, classes, modes, times, district, upazila, area_note, fee_note, bio, age_ok, terms_ok, terms_at, seen,
                                       medium, exams, style, trial, batch, days_max, session_mins, exp, taught, ssc_gpa, hsc_gpa, achv, fee_show, pledge)
    values (uid, case when p_submit then 'submitted' else 'draft' end, fn, dn, gd, ph, ins, dep, lv, subs, cls, mds, tms, di, up, an, fe, bi, age, trm, case when trm then now() end, not p_submit,
            xmd, xex, xst, xtr, xbt, xdm, xsm, xxp, xtg, xsg, xhg, xac, xfs, xpl);
  else
    st := case when p_submit then (case when cur.status in ('approved', 'paused') then cur.status else 'submitted' end)
               else (case when cur.status = 'rejected' then 'draft' else cur.status end) end;
    -- an approved profile whose public words changed is flagged for another look (it stays visible meanwhile); the free-text extras count too
    ed := cur.edited or (cur.status = 'approved' and (cur.display_name, cur.institution, cur.department, cur.subjects, cur.classes, cur.modes, cur.district, cur.upazila, cur.bio, cur.achv, case when cur.fee_show then cur.fee_note else '' end)
                                                      is distinct from (dn, ins, dep, subs, cls, mds, di, up, bi, xac, case when xfs then fe else '' end));
    sn := case when p_submit or (ed and not cur.edited) then false else cur.seen end;
    ta := case when trm and cur.terms_at is null then now() else cur.terms_at end;
    update public.tutor_profiles set status = st, full_name = fn, display_name = dn, gender = gd, phone = ph, institution = ins, department = dep, edu_level = lv, subjects = subs, classes = cls, modes = mds, times = tms,
           district = di, upazila = up, area_note = an, fee_note = fe, bio = bi, age_ok = age, terms_ok = trm, terms_at = ta, edited = ed, seen = sn,
           medium = xmd, exams = xex, style = xst, trial = xtr, batch = xbt, days_max = xdm, session_mins = xsm, exp = xxp, taught = xtg, ssc_gpa = xsg, hsc_gpa = xhg, achv = xac, fee_show = xfs, pledge = xpl
     where user_id = uid;
  end if;
  select public.tutor_my_profile() into out;
  return out;
end $$;
-- the grants of tutor_profile_save did not change (create or replace keeps them); say them again so this file stands on its own
revoke all on function public.tutor_profile_save(jsonb, boolean) from public;
grant execute on function public.tutor_profile_save(jsonb, boolean) to authenticated;
revoke execute on function public.tutor_profile_save(jsonb, boolean) from anon;

notify pgrst, 'reload schema';

-- check: the new columns are there (14 on profiles, 4 on requests) and the search still answers
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'tutor_profiles' and column_name in ('medium','exams','style','trial','batch','days_max','session_mins','exp','taught','ssc_gpa','hsc_gpa','achv','fee_show','pledge')) as profile_columns,
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'tutor_requests' and column_name in ('pref_gender','student_level','goal','want_trial')) as request_columns;
select count(*) as tutors from public.tutor_search(null, null, null, null, null, 5, 0);
