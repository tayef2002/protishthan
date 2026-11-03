-- হোম পেজ ও কার্ড পেজ "যাচাইকৃত" প্রতিষ্ঠানের তালিকা আনে। ১ লক্ষের বেশি প্রতিষ্ঠানে সেই প্রশ্ন সময়সীমা ছাড়িয়ে ব্যর্থ হচ্ছিল ("statement timeout", পেজ খোলার প্রতিবারই লগে লাল এরর)।
-- The pages ask for "verified" institutions, newest first. With 100,000+ rows that query timed out on every page load. This index answers it instantly, and the pages now ask
-- for verification = 'verified' (the same set today) so the index applies. Run after 2026-12-03. Safe to run more than once.

create index if not exists listing_verified_new_idx on public.listing_submissions (created_at desc)
  where status = 'approved' and verification = 'verified';
analyze public.listing_submissions;

-- check (should be a few milliseconds)
explain analyze select id from public.listing_submissions where status = 'approved' and verification = 'verified' and coalesce(is_hidden, false) = false order by created_at desc limit 1000;
