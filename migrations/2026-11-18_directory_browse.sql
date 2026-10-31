-- তথ্যভান্ডার (home page): browse / search the imported, not-yet-verified directory on the server, a page at a time.
-- The home page still downloads the verified institutions; this adds the unverified ones for the place / type / search the visitor chose.
-- Returns one page plus the total count (same on every row). Run after 2026-11-17. Safe to run more than once.

create or replace function public.directory_browse(p_q text default null, p_districts text[] default null, p_upazila text default null,
                                                   p_type text default null, p_limit int default 30, p_offset int default 0)
returns table (id uuid, institution_name text, name_en text, institution_type text, district text, upazila text,
               desired_slug text, verification text, email_hint text, total bigint)
language sql stable security definer set search_path = public as $$
  with k as (select nullif(public.bn_key(p_q), '') as q, nullif(public.phon_key(p_q), '') as p)
  select l.id, l.institution_name, l.name_en, l.institution_type, l.district, l.upazila, l.desired_slug, l.verification, l.email_hint,
         count(*) over () as total
  from public.listing_submissions l, k
  where l.status = 'approved' and l.verification = 'unverified' and coalesce(l.is_hidden, false) = false
    and (p_districts is null or l.district = any (p_districts))
    and (nullif(p_upazila, '') is null or l.upazila = p_upazila)
    and (nullif(p_type, '') is null or l.institution_type = p_type)
    and (k.q is null
         or (char_length(k.q) >= 2 and (l.search_key like '%' || k.q || '%' or l.search_key_en like '%' || k.q || '%'))
         or (char_length(coalesce(k.p, '')) >= 3 and (l.phon_key like '%' || k.p || '%' or l.phon_key_en like '%' || k.p || '%')))
  order by (k.q is not null and (l.search_key like '%' || k.q || '%' or l.search_key_en like '%' || k.q || '%')) desc,
           (k.p is not null and (l.phon_key = k.p or l.phon_key_en = k.p)) desc,
           l.district, l.upazila, l.institution_name, l.id
  limit least(greatest(coalesce(p_limit, 30), 1), 60) offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke all on function public.directory_browse(text, text[], text, text, int, int) from public;
grant execute on function public.directory_browse(text, text[], text, text, int, int) to anon, authenticated;

-- check
select institution_name, upazila, district, total from public.directory_browse(null, array['ঢাকা'], null, null, 5, 0);
