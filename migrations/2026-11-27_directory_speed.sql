-- সাইট দ্রুত রাখা: the directory now holds 100,000+ institutions. The numbers beside the filters (directory_counts) took ~3 seconds because they counted every row;
-- this index lets the database count from the index alone. Also refreshes the database's statistics so it plans queries for the new size.
-- Run after 2026-11-26. Safe to run more than once.

create index if not exists listing_unverified_counts_idx on public.listing_submissions (institution_type, district)
  where status = 'approved' and verification = 'unverified' and coalesce(is_hidden, false) = false;

analyze public.listing_submissions;

-- check (should now be well under a second)
select count(*) as groups, sum(n) as unverified from public.directory_counts();
