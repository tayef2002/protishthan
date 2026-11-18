-- প্রতিষ্ঠান লিগ, step 7: the extra game "কোন জেলায়?" (guess the district of an institution from the directory).
-- One public read function: a pool of institutions for a Bangladesh day, in a fixed order that is the same for everybody on that day (so "today's 10" are the same on every phone).
--  * Only listed, visible institutions of a kind that can be guessed: universities, colleges, technical institutes, madrasas, and schools that are secondary (a primary school's name tells nothing).
--  * Not those whose name already contains their district (too easy), not names that are too short or too long, not names without Bangla letters.
--  * Returns only what the directory already shows to everybody (name, kind, district, upazila, slug); no contact, no person. Nothing here writes.
-- Safe to run more than once.
create or replace function public.guess_pool(p_day date default null, p_n int default 150) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('slug', s.desired_slug, 'name', s.institution_name, 'type', s.institution_type, 'district', s.district, 'upazila', s.upazila) order by s.k), '[]'::jsonb)
    from (
      select l.desired_slug, btrim(l.institution_name) as institution_name, l.institution_type, btrim(l.district) as district, btrim(coalesce(l.upazila, '')) as upazila,
             md5(l.desired_slug || coalesce(p_day, (now() at time zone 'utc' + interval '6 hours')::date)::text) as k
        from public.listing_submissions l
       where l.status = 'approved' and coalesce(l.is_hidden, false) = false
         and l.desired_slug is not null and btrim(coalesce(l.district, '')) <> ''
         and l.institution_name ~ '[ঀ-৿]'
         and char_length(btrim(l.institution_name)) between 6 and 70
         and position(btrim(l.district) in l.institution_name) = 0
         and (l.institution_type in ('কলেজ', 'কারিগরি', 'বিশ্ববিদ্যালয়', 'মাদ্রাসা')
              or (l.institution_type = 'স্কুল' and l.institution_name ~ '(মাধ্যমিক|উচ্চ বিদ্যালয়|হাই স্কুল|স্কুল (অ্যান্ড|এন্ড|ও) কলেজ|স্কুল এন্ড কলেজ)'))
       order by k
       limit greatest(30, least(coalesce(p_n, 150), 300))
    ) s
$$;
revoke all on function public.guess_pool(date, int) from public, anon;
grant execute on function public.guess_pool(date, int) to anon, authenticated;
