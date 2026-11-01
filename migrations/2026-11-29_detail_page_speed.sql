-- প্রতিষ্ঠানের পেজ খোলা: an institution page is found by its address name (desired_slug). With 100,000+ institutions that lookup had no index and took 2+ seconds, so the page
-- gave up and said "not found". These indexes make the page lookup, the "other institutions nearby" list and the view counter instant again.
-- Run after 2026-11-28. Safe to run more than once. (Can take a few seconds.)

create index if not exists listing_slug_idx on public.listing_submissions (desired_slug);
create index if not exists listing_area_idx on public.listing_submissions (district, upazila);
create index if not exists listing_type_idx on public.listing_submissions (institution_type) where status = 'approved';

analyze public.listing_submissions;

-- check (each should be a few milliseconds)
explain analyze select id from public.listing_submissions where desired_slug = 'pri-160618' and status = 'approved' limit 1;
