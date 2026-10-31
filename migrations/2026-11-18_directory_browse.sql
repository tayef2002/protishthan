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
  -- built as text and run with EXECUTE, so the planner sees the real values every time (a cached generic plan made the search time out)
  return query execute
    'with m as materialized (
       select l.id, l.institution_name, l.name_en, l.institution_type, l.district, l.upazila, l.desired_slug, l.verification, l.email_hint,
              l.search_key, l.search_key_en, l.phon_key, l.phon_key_en
       from public.listing_submissions l
       where l.status = ''approved'' and l.verification = ''unverified'' and coalesce(l.is_hidden, false) = false'
    || case when p_districts is null then '' else ' and l.district = any ($1)' end
    || case when up is null then '' else ' and l.upazila = $2' end
    || case when ty is null then '' else ' and l.institution_type = $3' end
    || case when q is null then '' else ' and (l.search_key like ''%'' || $4 || ''%'' or l.search_key_en like ''%'' || $4 || ''%''
         or (char_length(coalesce($5, '''')) >= 3 and (l.phon_key like ''%'' || $5 || ''%'' or l.phon_key_en like ''%'' || $5 || ''%'')))' end
    || ')
     select id, institution_name, name_en, institution_type, district, upazila, desired_slug, verification, email_hint, count(*) over ()
     from m
     order by ' || case when q is null then '' else '(search_key like ''%'' || $4 || ''%'' or search_key_en like ''%'' || $4 || ''%'') desc, (phon_key = $5 or phon_key_en = $5) desc, (phon_key like $5 || ''%'' or phon_key_en like $5 || ''%'') desc, ' end
    || 'district, upazila, institution_name, id limit $6 offset $7'
    using p_districts, up, ty, q, p, lim, off;
end $$;
revoke all on function public.directory_browse(text, text[], text, text, int, int) from public;
grant execute on function public.directory_browse(text, text[], text, text, int, int) to anon, authenticated;

-- check
select institution_name, upazila, district, total from public.directory_browse('নটর ডেম', null, null, null, 5, 0);
select institution_name, upazila, district, total from public.directory_browse(null, array['ঢাকা'], null, null, 3, 0);
