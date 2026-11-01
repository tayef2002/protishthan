-- সংখ্যা ক্যাশ ঠিক করা: the filter-count cache (2026-11-28) is refreshed by the first visitor after 10 minutes, but the API refuses a DELETE without a WHERE
-- ("DELETE requires a WHERE clause"), so the refresh failed and the numbers beside the filters went blank. Now the refresh uses a WHERE, and if a refresh ever fails
-- the visitor still gets the last good numbers instead of nothing. Run after 2026-11-29. Safe to run more than once.

create or replace function public.refresh_directory_counts()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.directory_count_cache where true;
  insert into public.directory_count_cache (institution_type, district, n)
    select l.institution_type, l.district, count(*) from public.listing_submissions l
    where l.status = 'approved' and l.verification = 'unverified' and coalesce(l.is_hidden, false) = false
    group by l.institution_type, l.district;
end $$;
revoke all on function public.refresh_directory_counts() from public, anon, authenticated;

create or replace function public.directory_counts()
returns table (institution_type text, district text, n bigint)
language plpgsql volatile security definer set search_path = public as $$
begin
  if (select min(c.refreshed_at) from public.directory_count_cache c) is null
     or (select min(c.refreshed_at) from public.directory_count_cache c) < now() - interval '10 minutes' then
    begin
      if pg_try_advisory_xact_lock(7770002) then perform public.refresh_directory_counts(); end if;
    exception when others then null;     -- keep the last good numbers
    end;
  end if;
  return query select c.institution_type, c.district, c.n from public.directory_count_cache c;
end $$;
revoke all on function public.directory_counts() from public;
grant execute on function public.directory_counts() to anon, authenticated;

-- fill the numbers now
select public.refresh_directory_counts();

-- check
select institution_type, sum(n) as n from public.directory_counts() group by institution_type order by n desc;

-- two university names came in with leftover web-page code; clean them (the search keys update by themselves)
update public.listing_submissions set institution_name = 'Ishakha International University', name_en = 'Ishakha International University'
  where desired_slug = 'uni-uiiub' and source = 'ugc-universities';
update public.listing_submissions set institution_name = 'Dr. Momtaz Begum University of Science and Technology', name_en = 'Dr. Momtaz Begum University of Science and Technology'
  where desired_slug = 'uni-umustx' and source = 'ugc-universities';
select institution_name from public.listing_submissions where source = 'ugc-universities' and institution_name ~ '[{}\[\]|]|http';
