-- সদস্যের "নিজে প্রতিষ্ঠান যোগ": the dialog now offers every type (স্কুল, মাদ্রাসা, কলেজ, কারিগরি, বিশ্ববিদ্যালয়, কোচিং সেন্টার) and a district + upazila/thana choice.
-- The member's own list only accepted four types and could not store the upazila when the institution was first saved; this widens both.
-- Run after 2026-11-30. Safe to run more than once.

alter table public.member_custom_institutions drop constraint if exists member_custom_institutions_itype_check;
alter table public.member_custom_institutions
  add constraint member_custom_institutions_itype_check
  check (itype is null or itype in ('স্কুল', 'মাদ্রাসা', 'কলেজ', 'কারিগরি', 'বিশ্ববিদ্যালয়', 'কোচিং সেন্টার'));

grant insert (user_id, name, itype, district, upazila) on public.member_custom_institutions to authenticated;

-- check
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.member_custom_institutions'::regclass and conname like '%itype%';
