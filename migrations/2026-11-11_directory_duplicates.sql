-- একই প্রতিষ্ঠান দুইবার নয়: one listing per institution. Run 2026-11-10_directory_scale.sql first (it adds search_key and bn_key).
--
-- The rule: inside the same district, two listings may not have the same name (spelling variants such as মাদ্রাসা / মাদরাসা count as
-- the same). Same name + same upazila  = DUPLICATE, not allowed.  Same name + different upazila = allowed, but the person is told.
-- Anyone who comes later sees the existing listing instead of creating a second one.
--   * listings that were imported from a public source (source is not null) are exempt from the database constraint, because
--     real schools do share a name inside one upazila (different unions); they are told apart by their source id (EIIN).
--     The check function below still looks at them, so a person registering a school that was already imported is told about it.
-- Safe to run more than once.

-- 1) the check the pages call while the person types (anyone may call it; it returns only public facts)
create or replace function public.directory_check(p_name text, p_district text, p_upazila text default null)
returns table (match_level text, institution_name text, institution_type text, district text, upazila text,
               desired_slug text, status text, verification text)
language sql stable security definer set search_path = public as $$
  with k as (select public.bn_key(p_name) as q)
  select case when coalesce(trim(p_upazila), '') <> '' and coalesce(trim(l.upazila), '') = trim(p_upazila) then 'same_upazila' else 'same_district' end,
         l.institution_name, l.institution_type, l.district, l.upazila,
         case when l.status = 'approved' then l.desired_slug end,
         l.status, l.verification
  from public.listing_submissions l, k
  where char_length(k.q) >= 2
    and l.search_key = k.q
    and trim(l.district) = trim(p_district)
    and l.status in ('pending', 'approved') and coalesce(l.is_hidden, false) = false
  order by (coalesce(trim(p_upazila), '') <> '' and coalesce(trim(l.upazila), '') = trim(p_upazila)) desc, l.institution_name
  limit 5
$$;
revoke all on function public.directory_check(text, text, text) from public;
grant execute on function public.directory_check(text, text, text) to anon, authenticated;

-- 2) the database itself refuses a second hand-registered listing for the same name in the same upazila
--    (the pages check first; this is the guard for two people submitting at the same moment)
do $$
begin
  if exists (
    select 1 from public.listing_submissions
    where source is null and status in ('pending', 'approved') and coalesce(is_hidden, false) = false and search_key is not null and char_length(search_key) >= 2
    group by trim(district), coalesce(trim(upazila), ''), search_key having count(*) > 1
  ) then
    raise notice 'Duplicates already exist: the unique index was NOT created. Run the SELECT at the bottom, merge or hide the extra rows, then run this file again.';
  else
    create unique index if not exists listing_unique_name_place on public.listing_submissions (trim(district), coalesce(trim(upazila), ''), search_key)
      where source is null and status in ('pending', 'approved') and coalesce(is_hidden, false) = false and search_key is not null and char_length(search_key) >= 2;
  end if;
end $$;

-- 3) publishing a member's own institution goes through the same check
create or replace function public.publish_member_institution(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.member_custom_institutions; lid uuid;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into r from public.member_custom_institutions where id = p_id and user_id = auth.uid();
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.listing_id is not null then raise exception 'ALREADY_PUBLISHED'; end if;
  if coalesce(trim(r.name), '') = '' or coalesce(r.itype, '') = '' or coalesce(trim(r.district), '') = ''
     or coalesce(trim(r.upazila), '') = '' or coalesce(trim(r.contact_name), '') = '' or coalesce(trim(r.contact_phone), '') = '' then
    raise exception 'MISSING_FIELDS';
  end if;
  if r.contact_phone !~ '^01[0-9]{9}$' then raise exception 'BAD_PHONE'; end if;
  if exists (
    select 1 from public.listing_submissions l
    where l.search_key = public.bn_key(r.name) and trim(l.district) = trim(r.district) and coalesce(trim(l.upazila), '') = trim(r.upazila)
      and l.status in ('pending', 'approved') and coalesce(l.is_hidden, false) = false
  ) then raise exception 'DUPLICATE_INSTITUTION'; end if;
  insert into public.listing_submissions (
    institution_name, institution_type, district, upazila, contact_name, contact_phone, address_note, desired_slug, status,
    founding_year, teacher_count, student_count, medium, class_range, gender_type, admission_status, fee_range,
    facilities, achievements, description, facebook_link, ownership)
  values (
    r.name, r.itype, r.district, r.upazila, r.contact_name, r.contact_phone, r.address_note,
    'pending-' || (extract(epoch from now()) * 1000)::bigint || '-' || substr(md5(random()::text), 1, 4), 'pending',
    r.founding_year, r.teacher_count, r.student_count, r.medium, r.class_range, r.gender_type, r.admission_status, r.fee_range,
    r.facilities, r.achievements, r.description, r.facebook_link, r.ownership)
  returning id into lid;
  update public.member_custom_institutions set listing_id = lid, updated_at = now() where id = p_id;
  return lid;
end $$;

-- check: any duplicates that already exist (should be empty)
select trim(district) as district, coalesce(trim(upazila), '') as upazila, search_key, count(*) as copies, array_agg(institution_name) as names
from public.listing_submissions
where status in ('pending', 'approved') and coalesce(is_hidden, false) = false and search_key is not null and char_length(search_key) >= 2
group by 1, 2, 3 having count(*) > 1;
