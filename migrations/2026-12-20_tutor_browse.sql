-- ভাইয়া-আপু: the results system of /tutor, the same way the directory shows its results (filters with counts, sort, load more).
-- Needs 2026-12-17_tutors.sql and 2026-12-19_tutor_profile_more.sql. Safe to run more than once, and safe while the old page is still live:
-- every new argument has a default, so the old 7-argument search call still works.
--
--   * tutor_search gets filters (who teaches: apu / bhaiya, medium, exam focus, free trial, verified only, three promises) and a sort (best match, newest, verified first).
--     It still returns the same columns, and still nothing at all until the admin has switched the public list on.
--   * tutor_facets answers "how many tutors are there for each option" for the area and mode the guardian has chosen: only counts, nothing about any person.
--     The page shows them next to the filter options (like the directory), so a guardian does not click into an empty result.

-- ---------- the search, with the new filters and sorts. It keeps its columns but gains arguments, so it is dropped and made again ----------
drop function if exists public.tutor_search(text, text, text, text, text, int, int);
create or replace function public.tutor_search(
  p_district text default null, p_upazila text default null, p_class text default null, p_subject text default null, p_mode text default null, p_limit int default 12, p_offset int default 0,
  p_gender text default null, p_medium text default null, p_exam text default null, p_trial boolean default null, p_verified boolean default null, p_pledge boolean default null, p_sort text default 'best')
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
       and (nullif(p_gender, '') is null or t.gender = p_gender)
       and (nullif(p_medium, '') is null or p_medium = any(t.medium))
       and (nullif(p_exam, '') is null or p_exam = any(t.exams))
       and (not coalesce(p_trial, false) or t.trial)
       and (not coalesce(p_verified, false) or t.verify = 'verified')
       and (not coalesce(p_pledge, false) or cardinality(t.pledge) >= 3)
  )
  select s.pid, coalesce(nullif(s.display_name, ''), split_part(s.full_name, ' ', 1)), s.gender, s.institution, s.department, s.edu_level, s.subjects, s.classes, s.modes, s.times, s.district, s.upazila, s.bio,
         s.verify = 'verified', s.loc_ok, count(*) over (),
         s.medium, s.exams, s.style, s.trial, s.batch, s.days_max::int, s.session_mins::int, s.exp, s.taught, s.ssc_gpa, s.hsc_gpa, s.achv,
         case when s.fee_show then s.fee_note else '' end, cardinality(s.pledge) >= 3
    from s
   where case when p_mode = 'online' then s.online_ok
              when p_mode = 'home' then s.loc_ok and 'home' = any(s.modes)
              else (s.loc_ok or s.online_ok) end
   -- best (default): the area first, then verified, then recently active. new: the area first, then who joined last. verified: verified first, then the area. The id at the end keeps the pages from shifting.
   order by case when p_sort = 'verified' then (s.verify = 'verified')::int else 0 end desc,
            s.loc_ok desc,
            case when p_sort = 'new' then extract(epoch from s.approved_at) end desc nulls last,
            (s.verify = 'verified') desc,
            s.updated_at desc,
            s.pid
   limit greatest(1, least(coalesce(p_limit, 12), 30))
  offset greatest(0, least(coalesce(p_offset, 0), 500))
$$;
revoke all on function public.tutor_search(text, text, text, text, text, int, int, text, text, text, boolean, boolean, boolean, text) from public;
grant execute on function public.tutor_search(text, text, text, text, text, int, int, text, text, text, boolean, boolean, boolean, text) to anon, authenticated;

-- ---------- how many tutors per option, for the chosen area and mode (only counts) ----------
create or replace function public.tutor_facets(p_district text default null, p_upazila text default null, p_mode text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select t.*,
           ((nullif(p_district, '') is null or t.district = p_district) and (nullif(p_upazila, '') is null or t.upazila = p_upazila)) as loc_ok,
           ('online' = any(t.modes)) as online_ok
      from public.tutor_profiles t
     where coalesce((select x.public_listing from public.tutor_settings x where x.id = 1), false) and t.status = 'approved'
  ), b as (
    select * from s
     where case when p_mode = 'online' then online_ok when p_mode = 'home' then loc_ok and 'home' = any(modes) else (loc_ok or online_ok) end
  )
  select jsonb_build_object(
    'total',    (select count(*) from b),
    'modes',    jsonb_build_object('home', (select count(*) from b where loc_ok and 'home' = any(modes)), 'online', (select count(*) from b where online_ok)),
    'classes',  (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select k, count(*) as n from b, unnest(b.classes) as k group by k) x),
    'subjects', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select k, count(*) as n from b, unnest(b.subjects) as k group by k) x),
    'medium',   (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select k, count(*) as n from b, unnest(b.medium) as k group by k) x),
    'exams',    (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select k, count(*) as n from b, unnest(b.exams) as k group by k) x),
    'gender',   (select coalesce(jsonb_object_agg(g, n), '{}'::jsonb) from (select gender as g, count(*) as n from b where gender <> '' group by gender) x),
    'trial',    (select count(*) from b where trial),
    'verified', (select count(*) from b where verify = 'verified'),
    'pledge',   (select count(*) from b where cardinality(pledge) >= 3)
  )
$$;
revoke all on function public.tutor_facets(text, text, text) from public;
grant execute on function public.tutor_facets(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- check: both answer without an error (the counts are all 0 and the list empty until the admin switches the public list on)
select public.tutor_facets(null, null, null) as facets;
select count(*) as tutors from public.tutor_search(null, null, null, null, null, 5, 0);
