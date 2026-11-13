-- The admin's "Listing Submissions" queue asks for the hand-submitted rows (source is null), newest first.
-- Without an index that question scans the whole directory table (tens of thousands of rows) and times out when the database is busy.
-- This partial index holds only the hand-submitted rows, so the question reads them directly. Safe to run more than once.
create index if not exists listing_handsubmitted_idx on public.listing_submissions (created_at desc) where source is null;

-- check: the same question as the admin asks, now fast (a few rows, no sequential scan on the whole table)
explain select * from public.listing_submissions where source is null order by created_at desc;