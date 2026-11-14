-- আমার ব্যাচ: group pictures and albums. Only members of a batch can see or add pictures; a visitor only sees HOW MANY pictures there are.
-- The files live in a PRIVATE storage bucket 'batch-photos' (path '<batch_id>/<photo_id>.jpg', and '<batch_id>/<photo_id>_t.jpg' for the small version; the browser makes both as JPEG); the pages read them with short-lived signed links.
-- Albums are fixed categories (group picture, class, trip, event, other), so there is no free text to moderate. Limits: 12 pictures per member per batch, 80 per batch, 2 MB per file (the browser shrinks every picture first).
-- Needs: 2026-12-26_batches.sql, 2026-12-27_batch_name.sql, 2026-12-28_batch_roster_admin.sql. Safe to run more than once.

-- ---------- the private bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('batch-photos', 'batch-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ---------- tables ----------
create table if not exists public.batch_photos (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  uploader_id uuid references auth.users(id) on delete cascade,
  path text not null unique,
  category text not null check (category in ('group', 'class', 'trip', 'event', 'other')),
  w int, h int,
  created_at timestamptz not null default now()
);
create index if not exists batch_photos_batch_idx on public.batch_photos (batch_id, created_at desc);
alter table public.batches add column if not exists cover_photo_id uuid references public.batch_photos(id) on delete set null;

create table if not exists public.batch_photo_reports (
  photo_id uuid not null references public.batch_photos(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('offensive', 'private', 'other')),
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now(),
  primary key (photo_id, reporter_id)
);
alter table public.batch_photos enable row level security;
alter table public.batch_photo_reports enable row level security;
revoke all on public.batch_photos, public.batch_photo_reports from anon, authenticated;

-- ---------- who may touch the files ----------
drop policy if exists batch_photos_read on storage.objects;
create policy batch_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'batch-photos' and (public.is_admin() or exists (
    select 1 from public.batch_members m where m.user_id = auth.uid() and m.batch_id::text = (storage.foldername(name))[1])));
drop policy if exists batch_photos_write on storage.objects;
create policy batch_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'batch-photos' and exists (
    select 1 from public.batch_members m where m.user_id = auth.uid() and m.batch_id::text = (storage.foldername(name))[1]));
drop policy if exists batch_photos_remove on storage.objects;
create policy batch_photos_remove on storage.objects for delete to authenticated
  using (bucket_id = 'batch-photos' and (public.is_admin() or exists (
    select 1 from public.batch_members m where m.user_id = auth.uid() and m.role in ('convener', 'co') and m.batch_id::text = (storage.foldername(name))[1])
    or owner = auth.uid()));

-- ---------- 1) add a picture (the file is already uploaded; this records it) ----------
create or replace function public.batch_photo_add(p_batch_id uuid, p_path text, p_category text, p_w int, p_h int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pid uuid; mine int; total int; b public.batches;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if not exists (select 1 from public.batch_members where batch_id = p_batch_id and user_id = uid) then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  if p_category not in ('group', 'class', 'trip', 'event', 'other') then return jsonb_build_object('ok', false, 'error', 'BAD_CATEGORY'); end if;
  if p_path is null or p_path !~ ('^' || p_batch_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$') then return jsonb_build_object('ok', false, 'error', 'BAD_PATH'); end if;
  if p_w is null or p_h is null or p_w not between 100 and 8000 or p_h not between 100 and 8000 then return jsonb_build_object('ok', false, 'error', 'BAD_SIZE'); end if;
  select * into b from public.batches where id = p_batch_id for update;
  select count(*) into mine from public.batch_photos where batch_id = p_batch_id and uploader_id = uid;
  if mine >= 12 then return jsonb_build_object('ok', false, 'error', 'TOO_MANY_MINE'); end if;
  select count(*) into total from public.batch_photos where batch_id = p_batch_id;
  if total >= 80 then return jsonb_build_object('ok', false, 'error', 'FULL'); end if;
  begin
    insert into public.batch_photos (batch_id, uploader_id, path, category, w, h) values (p_batch_id, uid, p_path, p_category, p_w, p_h) returning id into pid;
  exception when unique_violation then return jsonb_build_object('ok', false, 'error', 'BAD_PATH');
  end;
  if p_category = 'group' and b.cover_photo_id is null then update public.batches set cover_photo_id = pid where id = p_batch_id; end if;
  return jsonb_build_object('ok', true, 'id', pid);
end $$;

-- ---------- 2) the list: members only ----------
create or replace function public.batch_photos(p_batch_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); lead boolean; b public.batches;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if not (public.is_admin() or exists (select 1 from public.batch_members where batch_id = p_batch_id and user_id = uid)) then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  lead := public.is_admin() or exists (select 1 from public.batch_members where batch_id = p_batch_id and user_id = uid and role in ('convener', 'co'));
  select * into b from public.batches where id = p_batch_id;
  return jsonb_build_object('ok', true, 'cover', b.cover_photo_id, 'lead', lead, 'photos', coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'path', p.path, 'category', p.category, 'w', p.w, 'h', p.h, 'at', p.created_at,
      'mine', p.uploader_id = uid, 'can_delete', lead or p.uploader_id = uid, 'by', coalesce(public.batch_first_name(m.display_name), 'সদস্য')) order by p.created_at desc)
    from (select * from public.batch_photos where batch_id = p_batch_id order by created_at desc limit 200) p
    left join public.members m on m.user_id = p.uploader_id), '[]'::jsonb));
end $$;

-- ---------- 3) delete one: the one who added it, a convener, or an admin (the page then removes the files) ----------
create or replace function public.batch_photo_delete(p_photo_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.batch_photos;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  select * into p from public.batch_photos where id = p_photo_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_PHOTO'); end if;
  if not (p.uploader_id = uid or public.is_admin() or exists (select 1 from public.batch_members where batch_id = p.batch_id and user_id = uid and role in ('convener', 'co'))) then
    return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED');
  end if;
  delete from public.batch_photos where id = p_photo_id;
  return jsonb_build_object('ok', true, 'path', p.path);
end $$;

-- ---------- 4) the convener picks the group picture shown at the top of the batch ----------
create or replace function public.batch_photo_set_cover(p_photo_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.batch_photos;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  select * into p from public.batch_photos where id = p_photo_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_PHOTO'); end if;
  if not exists (select 1 from public.batch_members where batch_id = p.batch_id and user_id = uid and role in ('convener', 'co')) then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  update public.batches set cover_photo_id = p.id where id = p.batch_id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 5) a member reports a picture ----------
create or replace function public.batch_photo_report(p_photo_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.batch_photos;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if p_reason not in ('offensive', 'private', 'other') then return jsonb_build_object('ok', false, 'error', 'BAD_REASON'); end if;
  select * into p from public.batch_photos where id = p_photo_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_PHOTO'); end if;
  if not exists (select 1 from public.batch_members where batch_id = p.batch_id and user_id = uid) then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  insert into public.batch_photo_reports (photo_id, reporter_id, reason) values (p_photo_id, uid, p_reason)
  on conflict (photo_id, reporter_id) do update set reason = excluded.reason, status = 'new', created_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 6) the public page learns only how many pictures there are ----------
create or replace function public.batch_lookup(p_slug text, p_level text, p_year int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  inst record; b public.batches; n int; conv text; me public.batch_members; mine jsonb := null; ph int := 0;
begin
  if not public.batch_level_ok(p_level) or not public.batch_year_ok(p_year) then
    return jsonb_build_object('ok', false, 'error', 'BAD_BATCH');
  end if;
  select l.institution_name, l.district, l.upazila, l.institution_type into inst
    from public.listing_submissions l
   where l.desired_slug = p_slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false limit 1;
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_INSTITUTION'); end if;
  select * into b from public.batches where institution_slug = p_slug and level = p_level and exam_year = p_year;
  if found then
    select count(*) into n from public.batch_members where batch_id = b.id;
    select count(*) into ph from public.batch_photos where batch_id = b.id;
    select public.batch_first_name(m.display_name) into conv from public.members m where m.user_id = b.convener_id;
    if auth.uid() is not null then
      select * into me from public.batch_members where batch_id = b.id and user_id = auth.uid();
      if found then mine := jsonb_build_object('joined', true, 'seq', me.seq, 'role', me.role, 'ref', me.ref_code); end if;
    end if;
  end if;
  return jsonb_build_object('ok', true,
    'inst', jsonb_build_object('name', inst.institution_name, 'district', inst.district, 'upazila', inst.upazila, 'type', inst.institution_type),
    'batch', case when b.id is null then null else jsonb_build_object('id', b.id, 'members', n, 'convener', conv, 'name', b.name, 'line', b.line, 'theme', b.theme, 'status', b.status, 'photos', ph) end,
    'me', mine);
end $$;

-- ---------- 7) admin: the list counts picture reports too, the detail shows the pictures, "reports handled" covers them ----------
create or replace function public.admin_batch_list(p_q text default null, p_only_reported boolean default false, p_limit int default 60)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(r order by (r->>'reports_new')::int desc, r->>'created_at' desc) from (
      select jsonb_build_object(
        'id', b.id, 'slug', b.institution_slug, 'inst', (select l.institution_name from public.listing_submissions l where l.desired_slug = b.institution_slug and l.status = 'approved' limit 1),
        'level', b.level, 'year', b.exam_year, 'name', b.name, 'line', b.line, 'theme', b.theme, 'status', b.status, 'created_at', b.created_at,
        'members', (select count(*) from public.batch_members x where x.batch_id = b.id),
        'photos', (select count(*) from public.batch_photos x where x.batch_id = b.id),
        'convener', (select coalesce(p.display_name, '') || ' ' || coalesce(p.email, '') from public.members p where p.user_id = b.convener_id),
        'reports_new', (select count(*) from public.batch_reports x where x.batch_id = b.id and x.status = 'new')
                     + (select count(*) from public.batch_photo_reports x join public.batch_photos ph on ph.id = x.photo_id where ph.batch_id = b.id and x.status = 'new'),
        'reports_all', (select count(*) from public.batch_reports x where x.batch_id = b.id)) as r
      from public.batches b
      where (q is null or b.institution_slug ilike '%' || q || '%' or coalesce(b.name, '') ilike '%' || q || '%' or coalesce(b.line, '') ilike '%' || q || '%'
             or exists (select 1 from public.listing_submissions l where l.desired_slug = b.institution_slug and l.institution_name ilike '%' || q || '%')
             or exists (select 1 from public.members p where p.user_id = b.convener_id and (coalesce(p.display_name, '') ilike '%' || q || '%' or coalesce(p.email, '') ilike '%' || q || '%')))
        and (not coalesce(p_only_reported, false)
             or exists (select 1 from public.batch_reports x where x.batch_id = b.id and x.status = 'new')
             or exists (select 1 from public.batch_photo_reports x join public.batch_photos ph on ph.id = x.photo_id where ph.batch_id = b.id and x.status = 'new'))
      order by b.created_at desc limit greatest(1, least(coalesce(p_limit, 60), 200))
    ) t
  ), '[]'::jsonb));
end $$;

create or replace function public.admin_batch_detail(p_batch_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  return jsonb_build_object('ok', true,
    'members', coalesce((select jsonb_agg(jsonb_build_object('seq', m.seq, 'role', m.role, 'name', coalesce(p.display_name, ''), 'email', coalesce(p.email, ''), 'joined_at', m.joined_at) order by m.seq)
                         from public.batch_members m left join public.members p on p.user_id = m.user_id where m.batch_id = p_batch_id), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('reason', r.reason, 'note', r.note, 'status', r.status, 'at', r.created_at, 'by', coalesce(p.display_name, '') || ' ' || coalesce(p.email, '')) order by r.created_at desc)
                         from public.batch_reports r left join public.members p on p.user_id = r.reporter_id where r.batch_id = p_batch_id), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'path', ph.path, 'category', ph.category, 'at', ph.created_at,
                          'by', coalesce(p.display_name, '') || ' ' || coalesce(p.email, ''),
                          'reports', (select count(*) from public.batch_photo_reports x where x.photo_id = ph.id and x.status = 'new')) order by ph.created_at desc)
                        from public.batch_photos ph left join public.members p on p.user_id = ph.uploader_id where ph.batch_id = p_batch_id), '[]'::jsonb));
end $$;

create or replace function public.admin_batch_moderate(p_batch_id uuid, p_action text, p_seq int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.batches; tgt public.batch_members; n int; detail text := null;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  select * into b from public.batches where id = p_batch_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_BATCH'); end if;
  if p_action = 'clear_text' then
    detail := coalesce(b.name, '') || ' | ' || coalesce(b.line, '');
    update public.batches set name = null, line = null where id = b.id;
  elsif p_action = 'lock' then update public.batches set status = 'locked' where id = b.id;
  elsif p_action = 'unlock' then update public.batches set status = 'active' where id = b.id;
  elsif p_action = 'make_convener' then
    select * into tgt from public.batch_members where batch_id = b.id and seq = p_seq;
    if not found then return jsonb_build_object('ok', false, 'error', 'NO_MEMBER'); end if;
    update public.batch_members set role = 'member' where batch_id = b.id and role = 'convener';
    update public.batch_members set role = 'convener' where batch_id = b.id and user_id = tgt.user_id;
    update public.batches set convener_id = tgt.user_id where id = b.id;
    detail := 'seq ' || p_seq;
  elsif p_action = 'remove_member' then
    select * into tgt from public.batch_members where batch_id = b.id and seq = p_seq;
    if not found then return jsonb_build_object('ok', false, 'error', 'NO_MEMBER'); end if;
    select count(*) into n from public.batch_members where batch_id = b.id;
    if tgt.role = 'convener' and n > 1 then return jsonb_build_object('ok', false, 'error', 'IS_CONVENER'); end if;
    delete from public.batch_members where batch_id = b.id and user_id = tgt.user_id;
    detail := 'seq ' || p_seq;
    if n <= 1 then delete from public.batches where id = b.id; end if;
  elsif p_action = 'delete' then
    detail := b.institution_slug || ' ' || b.level || ' ' || b.exam_year || ' | ' || coalesce(b.name, '') || ' | ' || coalesce(b.line, '');
    delete from public.batches where id = b.id;
  elsif p_action = 'dismiss_reports' then
    update public.batch_reports set status = 'done' where batch_id = b.id and status = 'new';
    update public.batch_photo_reports set status = 'done' where status = 'new' and photo_id in (select id from public.batch_photos where batch_id = b.id);
  else
    return jsonb_build_object('ok', false, 'error', 'BAD_ACTION');
  end if;
  insert into public.batch_admin_log (admin_id, batch_id, action, detail) values (auth.uid(), p_batch_id, p_action, detail);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.batch_photo_add(uuid, text, text, int, int) from public;
revoke all on function public.batch_photos(uuid) from public;
revoke all on function public.batch_photo_delete(uuid) from public;
revoke all on function public.batch_photo_set_cover(uuid) from public;
revoke all on function public.batch_photo_report(uuid, text) from public;
revoke all on function public.batch_lookup(text, text, int) from public;
revoke all on function public.admin_batch_list(text, boolean, int) from public;
revoke all on function public.admin_batch_detail(uuid) from public;
revoke all on function public.admin_batch_moderate(uuid, text, int) from public;
grant execute on function public.batch_photo_add(uuid, text, text, int, int) to authenticated;
grant execute on function public.batch_photos(uuid) to authenticated;
grant execute on function public.batch_photo_delete(uuid) to authenticated;
grant execute on function public.batch_photo_set_cover(uuid) to authenticated;
grant execute on function public.batch_photo_report(uuid, text) to authenticated;
grant execute on function public.batch_lookup(text, text, int) to anon, authenticated;
grant execute on function public.admin_batch_list(text, boolean, int) to authenticated;     -- each admin function checks is_admin() itself
grant execute on function public.admin_batch_detail(uuid) to authenticated;
grant execute on function public.admin_batch_moderate(uuid, text, int) to authenticated;

-- check
select count(*) as photos from public.batch_photos;
