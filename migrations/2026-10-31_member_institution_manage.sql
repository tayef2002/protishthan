-- সদস্য: manage an institution that is not in the directory yet.
-- A member keeps a draft in their profile, fills in the details, and publishes it. Publishing creates a normal
-- 'pending' listing that your admin approves in the usual queue. After that, every edit the member makes in the
-- profile is copied to the listing, so the directory page always shows their latest details.
-- Run 2026-10-31_member_custom_institutions.sql first. Safe to run more than once.

alter table public.member_custom_institutions
  add column if not exists upazila text,
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists address_note text,
  add column if not exists founding_year text,
  add column if not exists student_count text,
  add column if not exists teacher_count text,
  add column if not exists medium text[],
  add column if not exists class_range text,
  add column if not exists gender_type text,
  add column if not exists admission_status text,
  add column if not exists fee_range text,
  add column if not exists facilities text[],
  add column if not exists achievements text[],
  add column if not exists description text,
  add column if not exists facebook_link text,
  add column if not exists ownership text,
  add column if not exists listing_id uuid references public.listing_submissions(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.member_custom_institutions drop constraint if exists mci_ownership_chk;
alter table public.member_custom_institutions add constraint mci_ownership_chk
  check (ownership is null or ownership in ('সরকারি', 'বেসরকারি', 'এমপিওভুক্ত'));

-- a member may change only the descriptive columns, never the link to a listing
revoke insert, update on public.member_custom_institutions from authenticated;
grant insert (user_id, name, itype, district) on public.member_custom_institutions to authenticated;
grant update (name, itype, district, upazila, contact_name, contact_phone, address_note, founding_year, student_count,
              teacher_count, medium, class_range, gender_type, admission_status, fee_range, facilities, achievements,
              description, facebook_link, ownership, updated_at) on public.member_custom_institutions to authenticated;
drop policy if exists mci_own_update on public.member_custom_institutions;
create policy mci_own_update on public.member_custom_institutions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- publish: turns the draft into a normal 'pending' listing for the admin to approve
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

-- sync: copies the member's latest details to the published listing (status and slug are never touched,
-- except that a rejected listing goes back to 'pending' when the member improves it)
create or replace function public.sync_member_institution(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.member_custom_institutions;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into r from public.member_custom_institutions where id = p_id and user_id = auth.uid();
  if not found or r.listing_id is null then return; end if;
  if r.contact_phone is not null and r.contact_phone !~ '^01[0-9]{9}$' then raise exception 'BAD_PHONE'; end if;
  update public.listing_submissions l set
    institution_name = coalesce(nullif(trim(r.name), ''), l.institution_name),
    institution_type = coalesce(nullif(r.itype, ''), l.institution_type),
    district = coalesce(nullif(trim(r.district), ''), l.district),
    upazila = coalesce(nullif(trim(r.upazila), ''), l.upazila),
    contact_name = coalesce(nullif(trim(r.contact_name), ''), l.contact_name),
    contact_phone = coalesce(nullif(trim(r.contact_phone), ''), l.contact_phone),
    address_note = r.address_note, founding_year = r.founding_year, student_count = r.student_count,
    teacher_count = r.teacher_count, medium = r.medium, class_range = r.class_range, gender_type = r.gender_type,
    admission_status = r.admission_status, fee_range = r.fee_range, facilities = r.facilities,
    achievements = r.achievements, description = r.description, facebook_link = r.facebook_link, ownership = r.ownership,
    status = case when l.status = 'rejected' then 'pending' else l.status end
   where l.id = r.listing_id;
end $$;

revoke all on function public.publish_member_institution(uuid) from public;
revoke all on function public.sync_member_institution(uuid) from public;
grant execute on function public.publish_member_institution(uuid) to authenticated;
grant execute on function public.sync_member_institution(uuid) to authenticated;

-- check
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'member_custom_institutions' order by ordinal_position;
