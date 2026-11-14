-- আমার ব্যাচ: the member list (for members only), reports from visitors, and the admin tools (list, clear the text, lock, change the convener, remove a member, delete a batch).
-- Needs: 2026-12-26_batches.sql and 2026-12-27_batch_name.sql. Safe to run more than once.
-- Every function is security definer with a pinned search_path; the tables stay closed (no grant to anon or authenticated).

-- ---------- reports: one per person per batch ----------
create table if not exists public.batch_reports (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('offensive', 'squatting', 'fake', 'other')),
  note text check (note is null or char_length(note) <= 200),
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now(),
  unique (batch_id, reporter_id)
);
create index if not exists batch_reports_batch_idx on public.batch_reports (batch_id, status);
alter table public.batch_reports enable row level security;
revoke all on public.batch_reports from anon, authenticated;

-- what the admins did (the batch row may be gone afterwards, so no foreign key)
create table if not exists public.batch_admin_log (
  id bigint generated always as identity primary key,
  admin_id uuid,
  batch_id uuid,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
alter table public.batch_admin_log enable row level security;
revoke all on public.batch_admin_log from anon, authenticated;

-- ---------- 1) the member list: only a member of that batch (or an admin) can ask ----------
create or replace function public.batch_roster(p_batch_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if not (public.is_admin() or exists (select 1 from public.batch_members where batch_id = p_batch_id and user_id = uid)) then
    return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER');
  end if;
  return jsonb_build_object('ok', true, 'members', coalesce((
    select jsonb_agg(jsonb_build_object(
      'seq', m.seq, 'role', m.role, 'name', coalesce(nullif(btrim(p.display_name), ''), 'সদস্য'), 'avatar', p.avatar_url,
      'me', m.user_id = uid, 'joined_at', m.joined_at) order by m.seq)
    from (select * from public.batch_members where batch_id = p_batch_id order by seq limit 500) m
    left join public.members p on p.user_id = m.user_id
  ), '[]'::jsonb));
end $$;

-- ---------- 2) a visitor reports a batch ----------
create or replace function public.batch_report(p_batch_id uuid, p_reason text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nt text := nullif(btrim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g')), '');
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if p_reason not in ('offensive', 'squatting', 'fake', 'other') then return jsonb_build_object('ok', false, 'error', 'BAD_REASON'); end if;
  if nt is not null and char_length(nt) > 200 then return jsonb_build_object('ok', false, 'error', 'BAD_NOTE'); end if;
  if not exists (select 1 from public.batches where id = p_batch_id) then return jsonb_build_object('ok', false, 'error', 'NO_BATCH'); end if;
  if (select count(*) from public.batch_reports where reporter_id = uid and created_at > now() - interval '1 day') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'TOO_MANY');
  end if;
  insert into public.batch_reports (batch_id, reporter_id, reason, note) values (p_batch_id, uid, p_reason, nt)
  on conflict (batch_id, reporter_id) do update set reason = excluded.reason, note = excluded.note, status = 'new', created_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 3) admin: the list ----------
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
        'convener', (select coalesce(p.display_name, '') || ' ' || coalesce(p.email, '') from public.members p where p.user_id = b.convener_id),
        'reports_new', (select count(*) from public.batch_reports x where x.batch_id = b.id and x.status = 'new'),
        'reports_all', (select count(*) from public.batch_reports x where x.batch_id = b.id)) as r
      from public.batches b
      where (q is null or b.institution_slug ilike '%' || q || '%' or coalesce(b.name, '') ilike '%' || q || '%' or coalesce(b.line, '') ilike '%' || q || '%'
             or exists (select 1 from public.listing_submissions l where l.desired_slug = b.institution_slug and l.institution_name ilike '%' || q || '%')
             or exists (select 1 from public.members p where p.user_id = b.convener_id and (coalesce(p.display_name, '') ilike '%' || q || '%' or coalesce(p.email, '') ilike '%' || q || '%')))
        and (not coalesce(p_only_reported, false) or exists (select 1 from public.batch_reports x where x.batch_id = b.id and x.status = 'new'))
      order by b.created_at desc limit greatest(1, least(coalesce(p_limit, 60), 200))
    ) t
  ), '[]'::jsonb));
end $$;

-- ---------- 4) admin: one batch in full (members with names and e-mails, and its reports) ----------
create or replace function public.admin_batch_detail(p_batch_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  return jsonb_build_object('ok', true,
    'members', coalesce((select jsonb_agg(jsonb_build_object('seq', m.seq, 'role', m.role, 'name', coalesce(p.display_name, ''), 'email', coalesce(p.email, ''), 'joined_at', m.joined_at) order by m.seq)
                         from public.batch_members m left join public.members p on p.user_id = m.user_id where m.batch_id = p_batch_id), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('reason', r.reason, 'note', r.note, 'status', r.status, 'at', r.created_at, 'by', coalesce(p.display_name, '') || ' ' || coalesce(p.email, '')) order by r.created_at desc)
                         from public.batch_reports r left join public.members p on p.user_id = r.reporter_id where r.batch_id = p_batch_id), '[]'::jsonb));
end $$;

-- ---------- 5) admin: act on a batch ----------
--   clear_text  : removes the name and the line          lock / unlock : stops / allows new members
--   make_convener (p_seq) : that member becomes the convener     remove_member (p_seq) : takes a member out (not the convener while others remain; an empty batch is removed)
--   delete : removes the batch and everything in it       dismiss_reports : marks the reports as handled
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
  else
    return jsonb_build_object('ok', false, 'error', 'BAD_ACTION');
  end if;
  insert into public.batch_admin_log (admin_id, batch_id, action, detail) values (auth.uid(), p_batch_id, p_action, detail);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.batch_roster(uuid) from public;
revoke all on function public.batch_report(uuid, text, text) from public;
revoke all on function public.admin_batch_list(text, boolean, int) from public;
revoke all on function public.admin_batch_detail(uuid) from public;
revoke all on function public.admin_batch_moderate(uuid, text, int) from public;
grant execute on function public.batch_roster(uuid) to authenticated;
grant execute on function public.batch_report(uuid, text, text) to authenticated;
grant execute on function public.admin_batch_list(text, boolean, int) to authenticated;     -- each one checks is_admin() itself
grant execute on function public.admin_batch_detail(uuid) to authenticated;
grant execute on function public.admin_batch_moderate(uuid, text, int) to authenticated;

-- check
select count(*) as reports from public.batch_reports;
