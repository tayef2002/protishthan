-- সার্চের ক্রম: a name whose sound key is EQUAL to the search comes before names that only contain it
-- ("ঢাকা কলেজ" used to show D.K. College first because its key merely contained the search's key).
-- Order now: spelled the same > same sound key > starts with > shorter name. Run after 2026-11-15. Safe to run more than once.

create or replace function public.directory_search(p_q text, p_limit int default 8)
returns table (id uuid, institution_name text, institution_type text, district text, upazila text, desired_slug text,
               verification text, name_en text, match_kind text)
language sql stable security definer set search_path = public as $$
  with k as (select public.bn_key(p_q) as q, public.phon_key(p_q) as p)
  select l.id, l.institution_name, l.institution_type, l.district, l.upazila, l.desired_slug, l.verification, l.name_en,
         case when l.search_key like '%' || k.q || '%' or l.search_key_en like '%' || k.q || '%' then 'exact' else 'sound' end
  from public.listing_submissions l, k
  where l.status = 'approved' and coalesce(l.is_hidden, false) = false
    and ( (char_length(k.q) >= 2 and (l.search_key like '%' || k.q || '%' or l.search_key_en like '%' || k.q || '%'))
       or (char_length(k.p) >= 3 and (l.phon_key like '%' || k.p || '%' or l.phon_key_en like '%' || k.p || '%')) )
  order by (l.search_key like '%' || k.q || '%' or l.search_key_en like '%' || k.q || '%') desc,
           (l.phon_key = k.p or l.phon_key_en = k.p) desc,
           (l.search_key like k.q || '%' or l.search_key_en like k.q || '%') desc,
           (l.phon_key like k.p || '%' or l.phon_key_en like k.p || '%') desc,
           char_length(l.search_key), l.institution_name
  limit least(greatest(coalesce(p_limit, 8), 1), 20)
$$;
revoke all on function public.directory_search(text, int) from public;
grant execute on function public.directory_search(text, int) to anon, authenticated;

-- check
select institution_name, name_en, match_kind from public.directory_search('ঢাকা কলেজ', 8);
