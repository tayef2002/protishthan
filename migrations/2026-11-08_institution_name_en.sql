-- প্রতিষ্ঠানের ইংরেজি নাম (ঐচ্ছিক): the directory always shows the Bangla name (institutions.name).
-- The English name is for the institution's own papers (question paper, certificates, reports) and is set in Settings.
-- Safe to run more than once.

alter table public.institutions add column if not exists name_en text;

-- check
select count(*) as institutions, count(name_en) as with_english_name from public.institutions;
