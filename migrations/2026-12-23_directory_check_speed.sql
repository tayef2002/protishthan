-- directory_check() was timing out on the big districts (Dhaka answered "statement timeout"), so the duplicate guard of the listing form
-- and of the admin's Approve silently saw nothing there. Cause: no index on the name keys, so every check read the whole directory table.
-- This adds four small partial indexes (only pending and approved, not hidden, which is all the check looks at) and rewrites the function
-- to compute the two keys once, so the planner can use them. The answers and the columns are exactly the same as in 2026-12-22_duplicate_guard.sql.
-- Safe to run more than once.

create index if not exists listing_dupkey_idx     on public.listing_submissions (search_key)
  where status in ('pending', 'approved') and coalesce(is_hidden, false) = false;
create index if not exists listing_dupkey_en_idx  on public.listing_submissions (search_key_en)
  where status in ('pending', 'approved') and coalesce(is_hidden, false) = false;
create index if not exists listing_dupphon_idx    on public.listing_submissions (phon_key)
  where status in ('pending', 'approved') and coalesce(is_hidden, false) = false;
create index if not exists listing_dupphon_en_idx on public.listing_submissions (phon_key_en)
  where status in ('pending', 'approved') and coalesce(is_hidden, false) = false;

drop function if exists public.directory_check(text, text, text);
create function public.directory_check(p_name text, p_district text, p_upazila text default null)
returns table (match_level text, institution_name text, institution_type text, district text, upazila text,
               desired_slug text, status text, verification text, id uuid, needs_bn_name boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare q text := public.bn_key(p_name); p text := public.phon_key(p_name);
begin
  if coalesce(trim(p_district), '') = '' then return; end if;
  return query
  select case when m.exact and m.here then 'same_upazila'
              when m.exact then 'same_district'
              when m.here then 'likely_same'
              else 'similar' end,
         m.institution_name, m.institution_type, m.district, m.upazila,
         case when m.status = 'approved' then m.desired_slug end,
         m.status, m.verification, m.id, m.needs_bn_name
  from (
    select l.id, l.institution_name, l.institution_type, l.district, l.upazila, l.desired_slug, l.status, l.verification, l.needs_bn_name,
           coalesce(l.search_key = q or l.search_key_en = q, false) as exact,
           (coalesce(trim(p_upazila), '') <> '' and coalesce(trim(l.upazila), '') = trim(p_upazila)) as here
    from public.listing_submissions l
    where l.status in ('pending', 'approved') and coalesce(l.is_hidden, false) = false
      and ( (char_length(q) >= 2 and (l.search_key = q or l.search_key_en = q))
         or (char_length(p) >= 5 and (l.phon_key = p or l.phon_key_en = p)) )
      and trim(l.district) = trim(p_district)
  ) m
  order by m.exact desc, m.here desc, m.institution_name
  limit 6;
end $$;
revoke all on function public.directory_check(text, text, text) from public;
grant execute on function public.directory_check(text, text, text) to anon, authenticated;

-- check: the big district that timed out before, now a few hundred milliseconds at most
select * from public.directory_check('ঢাকা কলেজ', 'ঢাকা', 'ধানমন্ডি');
