-- listing_submissions: who may change a directory listing. Before this file, anyone with the public key could change or approve
-- ANY listing. After it:
--   * anyone may still SUBMIT a new listing, but only as 'pending', with only the form's columns (no status, no source, no verification)
--   * only an admin may approve / reject / change the status, slug, PRN, owner link, verification, or delete
--   * a Partner may edit the details of the listings assigned to them (never the status/slug/owner)
--   * an institution may edit (and show/hide) only its own listing (never the status/slug/owner)
--   * reading stays as it is, so the public directory, cards and dashboards keep working
-- Functions that run as the database owner (publish_member_institution, sync_member_institution, imports run in the SQL editor)
-- are not affected. Run after 2026-11-10 and 2026-11-11. Safe to run more than once.

-- BEFORE: what the table allowed until now (look at this once, it is only a read)
select policyname, cmd, roles, qual from pg_policies where schemaname = 'public' and tablename = 'listing_submissions' order by cmd, policyname;

alter table public.listing_submissions enable row level security;

-- 1) remove every old policy (including the open "update_all" / "insert_all")
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'listing_submissions' loop
    execute format('drop policy %I on public.listing_submissions', p.policyname);
  end loop;
end $$;

-- 2) table privileges: start from nothing, give back reading, and only the form's columns for inserting
revoke all on public.listing_submissions from anon, authenticated;
grant select on public.listing_submissions to anon, authenticated;
grant update, delete on public.listing_submissions to authenticated;      -- still gated by the policies below
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ') into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'listing_submissions'
    and column_name in ('institution_id', 'institution_name', 'institution_type', 'district', 'upazila', 'student_count', 'contact_name',
      'contact_phone', 'address_note', 'desired_slug', 'status', 'founding_year', 'teacher_count', 'medium', 'other_medium', 'class_range',
      'session_start_month', 'other_session_month', 'gender_type', 'ownership', 'admission_status', 'fee_range', 'facilities',
      'other_facility', 'achievements', 'other_achievement', 'description', 'facebook_link');
  execute 'grant insert (' || cols || ') on public.listing_submissions to anon, authenticated';
end $$;

-- 3) policies
create policy ls_read on public.listing_submissions for select to anon, authenticated using (true);

create policy ls_submit on public.listing_submissions for insert to anon, authenticated
  with check (status = 'pending');

create policy ls_admin_update on public.listing_submissions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy ls_admin_delete on public.listing_submissions for delete to authenticated
  using (public.is_admin());

create policy ls_partner_update on public.listing_submissions for update to authenticated
  using (assigned_agent_id in (select a.id from public.agents a where a.user_id = auth.uid()))
  with check (assigned_agent_id in (select a.id from public.agents a where a.user_id = auth.uid()));

create policy ls_owner_update on public.listing_submissions for update to authenticated
  using (institution_id in (select i.id from public.institutions i where lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))))
  with check (institution_id in (select i.id from public.institutions i where lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))));

-- 4) the fields only an admin may change: a Partner or an institution editing their own row cannot touch these
create or replace function public.listing_guard()
returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    new.status := old.status;
    new.desired_slug := old.desired_slug;
    new.institution_id := old.institution_id;
    new.assigned_agent_id := old.assigned_agent_id;
    new.prn_number := old.prn_number;
    new.verification := old.verification;
    new.source := old.source;
    new.source_url := old.source_url;
    new.source_id := old.source_id;
    new.collected_at := old.collected_at;
    new.name_en := old.name_en;
  end if;
  return new;
end $$;
drop trigger if exists listing_guard_trg on public.listing_submissions;
create trigger listing_guard_trg before update on public.listing_submissions for each row execute function public.listing_guard();

-- AFTER: the new rules
select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'listing_submissions' order by cmd, policyname;
