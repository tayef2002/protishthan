-- Directory filter: সরকারি / বেসরকারি / এমপিওভুক্ত
-- Safe to run more than once.
alter table public.listing_submissions add column if not exists ownership text;
alter table public.listing_submissions drop constraint if exists listing_submissions_ownership_chk;
alter table public.listing_submissions add constraint listing_submissions_ownership_chk
  check (ownership is null or ownership in ('সরকারি', 'বেসরকারি', 'এমপিওভুক্ত'));
create index if not exists listing_submissions_ownership_idx on public.listing_submissions (ownership);

-- check
select ownership, count(*) from public.listing_submissions group by ownership;
