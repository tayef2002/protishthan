-- প্রতিষ্ঠান লিগ, step 7: the extra game "কোন জেলায়?" (guess the district of an institution from the directory).
-- One public read function: a pool of institutions for a Bangladesh day, in a fixed order that is the same for everybody on that day (so "today's 10" are the same on every phone).
--  * Only listed, visible institutions of a kind that can be guessed: universities, colleges, technical institutes, madrasas, and schools that are secondary (a primary school's name tells nothing).
--  * Not those whose name already contains their district (too easy), not names that are too short or too long, not names without Bangla letters.
--  * Returns only what the directory already shows to everybody (name, kind, district, upazila, slug); no contact, no person. Nothing here writes.
-- HOW IT STAYS FAST: the directory has about 100,000 rows and the public role has a 3 second limit, so the function never scans it. The PRN numbers (prn_number, unique and indexed, about one number in nine is used)
-- are drawn by a fixed formula from the day (md5 of day + counter), the draws are given to the index as one list (= any(array)), so each draw is ONE lookup in the index, the unusable rows are dropped, and the first p_n in the order of the draws are kept.
-- The first version of this file sorted the whole table by md5 and was cancelled by the 3 second limit on the real database: do not go back to that.
-- Safe to run more than once (it replaces the first version).
create or replace function public.guess_pool(p_day date default null, p_n int default 150) returns jsonb
language sql stable security definer set search_path = public as $$
  with p as (select coalesce(p_day, (now() at time zone 'utc' + interval '6 hours')::date)::text as d, greatest(30, least(coalesce(p_n, 150), 300)) as n),
  draws as (
    select g, 100000 + (('x' || substr(md5(p.d || ':' || g::text), 1, 7))::bit(28)::int % 900000) as prn
      from p, generate_series(1, least(p.n * 30, 9000)) g
  ), hit as (
    select dr.g, l.desired_slug, btrim(l.institution_name) as institution_name, l.institution_type, btrim(l.district) as district, btrim(coalesce(l.upazila, '')) as upazila
      from public.listing_submissions l join draws dr on dr.prn = l.prn_number
     where l.prn_number = any (array(select x.prn from draws x))      -- an index condition on the list of draws, so the planner can never choose to read the whole table for each draw
       and l.status = 'approved' and coalesce(l.is_hidden, false) = false
       and l.desired_slug is not null and btrim(coalesce(l.district, '')) <> ''
       and l.institution_name ~ '[ঀ-৿]'
       and char_length(btrim(l.institution_name)) between 6 and 70
       and position(btrim(l.district) in l.institution_name) = 0
       and (l.institution_type in ('কলেজ', 'কারিগরি', 'বিশ্ববিদ্যালয়', 'মাদ্রাসা')
            or (l.institution_type = 'স্কুল' and l.institution_name ~ '(মাধ্যমিক|উচ্চ বিদ্যালয়|হাই স্কুল|স্কুল (অ্যান্ড|এন্ড|ও) কলেজ|স্কুল এন্ড কলেজ)'))
  ), uniq as (select distinct on (desired_slug) * from hit order by desired_slug, g), cut as (select u.* from uniq u order by u.g limit (select n from p))
  select coalesce(jsonb_agg(jsonb_build_object('slug', c.desired_slug, 'name', c.institution_name, 'type', c.institution_type, 'district', c.district, 'upazila', c.upazila) order by c.g), '[]'::jsonb) from cut c
$$;
revoke all on function public.guess_pool(date, int) from public, anon;
grant execute on function public.guess_pool(date, int) to anon, authenticated;
