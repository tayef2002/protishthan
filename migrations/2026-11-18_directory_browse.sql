-- তথ্যভান্ডার (home page): browse / search the imported, not-yet-verified directory on the server, a page at a time.
-- The home page still downloads the verified institutions; this adds the unverified ones for the place / type / search the visitor chose.
-- Returns one page plus the total count (same on every row). Run after 2026-11-17. Safe to run more than once.
-- (v2: plpgsql, keys computed once, and a plain query for each case, so the trigram indexes are used and the search does not time out.)

drop function if exists public.directory_browse(text, text[], text, text, int, int);
create or replace function public.directory_browse(p_q text default null, p_districts text[] default null, p_upazila text default null,
                                                   p_type text default null, p_limit int default 30, p_offset int default 0)
returns table (id uuid, institution_name text, name_en text, institution_type text, district text, upazila text,
               desired_slug text, verification text, email_hint text, total bigint)
language plpgsql stable security definer set search_path = public as $$
declare q text := nullif(public.bn_key(p_q), ''); p text := nullif(public.phon_key(p_q), '');
        lim int := least(greatest(coalesce(p_limit, 30), 1), 60); off int := greatest(coalesce(p_offset, 0), 0);
        up text := nullif(p_upazila, ''); ty text := nullif(p_type, '');
begin
  if q is null then
    return query
      select l.id, l.institution_name, l.name_en, l.institution_type, l.district, l.upazila, l.desired_slug, l.verification, l.email_hint,
             count(*) over ()
      from public.listing_submissions l
      where l.status = 'approved' and l.verification = 'unverified' and coalesce(l.is_hidden, false) = false
        and (p_districts is null or l.district = any (p_districts))
        and (up is null or l.upazila = up) and (ty is null or l.institution_type = ty)
      order by l.district, l.upazila, l.institution_name, l.id
      limit lim offset off;
  else
    return query
      select l.id, l.institution_name, l.name_en, l.institution_type, l.district, l.upazila, l.desired_slug, l.verification, l.email_hint,
             count(*) over ()
      from public.listing_submissions l
      where l.status = 'approved' and l.verification = 'unverified' and coalesce(l.is_hidden, false) = false
        and (p_districts is null or l.district = any (p_districts))
        and (up is null or l.upazila = up) and (ty is null or l.institution_type = ty)
        and (l.search_key like '%' || q || '%' or l.search_key_en like '%' || q || '%'
             or (p is not null and char_length(p) >= 3 and (l.phon_key like '%' || p || '%' or l.phon_key_en like '%' || p || '%')))
      order by (l.search_key like '%' || q || '%' or l.search_key_en like '%' || q || '%') desc,
               (p is not null and (l.phon_key = p or l.phon_key_en = p)) desc,
               l.district, l.upazila, l.institution_name, l.id
      limit lim offset off;
  end if;
end $$;
revoke all on function public.directory_browse(text, text[], text, text, int, int) from public;
grant execute on function public.directory_browse(text, text[], text, text, int, int) to anon, authenticated;

-- check
select institution_name, upazila, district, total from public.directory_browse('নটর ডেম', null, null, null, 5, 0);
select institution_name, upazila, district, total from public.directory_browse(null, array['ঢাকা'], null, null, 3, 0);
