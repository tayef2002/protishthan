-- দেখার সংখ্যা: the "N বার দেখা হয়েছে" counter stopped working when listing writes were locked down (2026-11-13): the counter function
-- changed the listing row as the visitor, who may no longer write to it ("permission denied for table listing_submissions").
-- It now runs with the owner's rights and changes ONLY the counter of an approved listing. Safe to run more than once.

drop function if exists public.increment_view_count(text);
create or replace function public.increment_view_count(institution_slug text)
returns void language sql security definer set search_path = public as $$
  update public.listing_submissions set view_count = coalesce(view_count, 0) + 1
  where desired_slug = institution_slug and status = 'approved'
$$;
revoke all on function public.increment_view_count(text) from public;
grant execute on function public.increment_view_count(text) to anon, authenticated;

-- check (adds 1 to this listing's counter)
select public.increment_view_count('sch-124383');
select institution_name, view_count from public.listing_submissions where desired_slug = 'sch-124383';
