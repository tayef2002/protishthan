-- Remove the four test institutions from the public directory before the announcement.
-- STEP 1: run the SELECT and look at every row. Only if all of them are test data, run STEP 2.

-- STEP 1 (look first)
select id, institution_name, institution_type, district, status, created_at
from public.listing_submissions
where lower(institution_name) in ('auto reg', 'madrasha kishurganj', 'test', 'darul quran')
order by created_at;

-- STEP 2 (delete; uncomment after checking the rows above)
-- delete from public.listing_submissions
-- where lower(institution_name) in ('auto reg', 'madrasha kishurganj', 'test', 'darul quran');
-- Note: if an institution account is linked to a row (institutions.id = listing_submissions.institution_id), the account stays; remove it separately from the admin panel if it is also test data.
