-- আমার ব্যাচ: the batch room, a TEXT-ONLY chat for the members of one batch (no voice, no pictures, no files, no links).
-- Every batch has its room from the moment it is opened; it shows in the Message page next to the skill-page chats.
-- Only members of the batch can read or write (every function checks it); a visitor never sees a word.
-- Rules in the database: 1-300 characters, no link / e-mail / phone number / bad word, 5 a minute and 200 a day per person, a muted member cannot write, the convener can switch the room to "announcements only" or off.
-- A message can be reported by a member, deleted by its writer, the convener or an admin (the row stays for the admin, the text is hidden).
-- Needs: 2026-12-26_batches.sql, 2026-12-28_batch_roster_admin.sql (admin list / detail), 2026-12-30_batch_photos.sql. Safe to run more than once.

alter table public.batches add column if not exists chat_mode text not null default 'open';
alter table public.batches drop constraint if exists batches_chat_mode_ok;
alter table public.batches add constraint batches_chat_mode_ok check (chat_mode in ('open', 'announce', 'off'));
alter table public.batch_members add column if not exists chat_read bigint not null default 0;     -- the newest message this member has seen
alter table public.batch_members add column if not exists muted boolean not null default false;

create table if not exists public.batch_messages (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.batches(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 300),
  deleted_by text check (deleted_by is null or deleted_by in ('writer', 'convener', 'admin')),
  created_at timestamptz not null default now()
);
create index if not exists batch_messages_idx on public.batch_messages (batch_id, id desc);
create table if not exists public.batch_message_reports (
  message_id bigint not null references public.batch_messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('offensive', 'private', 'other')),
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now(),
  primary key (message_id, reporter_id)
);
alter table public.batch_messages enable row level security;
alter table public.batch_message_reports enable row level security;
revoke all on public.batch_messages, public.batch_message_reports from anon, authenticated;

-- ---------- 1) my rooms (one per batch I am in): last message, unread, the mode ----------
create or replace function public.batch_chat_rooms()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(r order by coalesce(r->>'last_at', r->>'joined_at') desc) from (
      select jsonb_build_object(
        'batch_id', b.id, 'slug', b.institution_slug, 'level', b.level, 'year', b.exam_year, 'bname', b.name, 'mode', b.chat_mode, 'role', m.role, 'muted', m.muted, 'joined_at', m.joined_at,
        'inst', (select l.institution_name from public.listing_submissions l where l.desired_slug = b.institution_slug and l.status = 'approved' limit 1),
        'last', (select case when x.deleted_by is null then left(x.body, 90) else 'মেসেজ মুছে ফেলা হয়েছে' end from public.batch_messages x where x.batch_id = b.id order by x.id desc limit 1),
        'last_at', (select x.created_at from public.batch_messages x where x.batch_id = b.id order by x.id desc limit 1),
        'unread', (select count(*) from (select 1 from public.batch_messages x where x.batch_id = b.id and x.id > m.chat_read and x.sender_id is distinct from auth.uid() and x.deleted_by is null limit 99) q)) as r
      from public.batch_members m join public.batches b on b.id = m.batch_id where m.user_id = auth.uid() and b.chat_mode <> 'off'
    ) t), '[]'::jsonb);
end $$;

-- ---------- 2) the messages of one room (members only); the first call gives the last 80, later calls only what is newer; reading marks it read ----------
create or replace function public.batch_chat_messages(p_batch_id uuid, p_after bigint default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); me public.batch_members; b public.batches; msgs jsonb; top bigint;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  select * into me from public.batch_members where batch_id = p_batch_id and user_id = uid;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  select * into b from public.batches where id = p_batch_id;
  if b.chat_mode = 'off' then return jsonb_build_object('ok', false, 'error', 'CHAT_OFF'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'mine', x.sender_id = uid, 'by', coalesce(p.display_name, 'সদস্য'), 'avatar', p.avatar_url, 'seq', s.seq, 'role', s.role, 'muted', case when me.role in ('convener', 'co') then s.muted else null end,
      'body', case when x.deleted_by is null then x.body else null end, 'deleted', x.deleted_by is not null, 'at', x.created_at) order by x.id), '[]'::jsonb), max(x.id)
    into msgs, top
    from (select * from public.batch_messages where batch_id = p_batch_id and id > coalesce(p_after, 0) order by id desc limit case when coalesce(p_after, 0) = 0 then 80 else 200 end) x
    left join public.members p on p.user_id = x.sender_id
    left join public.batch_members s on s.batch_id = x.batch_id and s.user_id = x.sender_id;
  if top is not null and top > me.chat_read then update public.batch_members set chat_read = top where batch_id = p_batch_id and user_id = uid; end if;
  return jsonb_build_object('ok', true, 'mode', b.chat_mode, 'can_write', not me.muted and (b.chat_mode = 'open' or me.role in ('convener', 'co')), 'muted', me.muted, 'lead', me.role in ('convener', 'co'), 'messages', msgs);
end $$;

-- ---------- 3) write a message ----------
create or replace function public.batch_chat_send(p_batch_id uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); me public.batch_members; b public.batches; t text := btrim(regexp_replace(coalesce(p_body, ''), '[ \t]+', ' ', 'g')); n int; nid bigint;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  select * into me from public.batch_members where batch_id = p_batch_id and user_id = uid;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  select * into b from public.batches where id = p_batch_id;
  if b.chat_mode = 'off' then return jsonb_build_object('ok', false, 'error', 'CHAT_OFF'); end if;
  if b.chat_mode = 'announce' and me.role not in ('convener', 'co') then return jsonb_build_object('ok', false, 'error', 'ANNOUNCE_ONLY'); end if;
  if me.muted then return jsonb_build_object('ok', false, 'error', 'MUTED'); end if;
  if char_length(t) < 1 or char_length(t) > 300 then return jsonb_build_object('ok', false, 'error', 'BAD_LENGTH'); end if;
  if t ~* '(https?:|www\.|\.com|\.net|\.org|\.bd|@|[0-9০-৯]{8,})' or not public.skill_text_ok(t) then return jsonb_build_object('ok', false, 'error', 'BAD_TEXT'); end if;
  select count(*) into n from public.batch_messages where sender_id = uid and created_at > now() - interval '1 minute';
  if n >= 5 then return jsonb_build_object('ok', false, 'error', 'TOO_FAST'); end if;
  select count(*) into n from public.batch_messages where sender_id = uid and created_at > now() - interval '1 day';
  if n >= 200 then return jsonb_build_object('ok', false, 'error', 'TOO_MANY'); end if;
  insert into public.batch_messages (batch_id, sender_id, body) values (p_batch_id, uid, t) returning id into nid;
  update public.batch_members set chat_read = nid where batch_id = p_batch_id and user_id = uid and chat_read < nid;
  return jsonb_build_object('ok', true, 'id', nid);
end $$;

-- ---------- 4) delete: the writer, the convener, an admin (the row stays, the text is hidden) ----------
create or replace function public.batch_chat_delete(p_message_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); x public.batch_messages; who text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  select * into x from public.batch_messages where id = p_message_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_MESSAGE'); end if;
  if public.is_admin() then who := 'admin';
  elsif exists (select 1 from public.batch_members where batch_id = x.batch_id and user_id = uid and role in ('convener', 'co')) then who := 'convener';
  elsif x.sender_id = uid and exists (select 1 from public.batch_members where batch_id = x.batch_id and user_id = uid) then who := 'writer';
  else return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  update public.batch_messages set deleted_by = who where id = p_message_id and deleted_by is null;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 5) the convener: mute / unmute a member (by number) and set the room mode ----------
create or replace function public.batch_chat_mute(p_batch_id uuid, p_seq int, p_mute boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); tgt public.batch_members;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if not (public.is_admin() or exists (select 1 from public.batch_members where batch_id = p_batch_id and user_id = uid and role in ('convener', 'co'))) then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  select * into tgt from public.batch_members where batch_id = p_batch_id and seq = p_seq;
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_MEMBER'); end if;
  if tgt.role in ('convener', 'co') then return jsonb_build_object('ok', false, 'error', 'IS_LEAD'); end if;
  update public.batch_members set muted = coalesce(p_mute, true) where batch_id = p_batch_id and user_id = tgt.user_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.batch_chat_mode(p_batch_id uuid, p_mode text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if p_mode not in ('open', 'announce', 'off') then return jsonb_build_object('ok', false, 'error', 'BAD_MODE'); end if;
  if not (public.is_admin() or exists (select 1 from public.batch_members where batch_id = p_batch_id and user_id = uid and role in ('convener', 'co'))) then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  update public.batches set chat_mode = p_mode where id = p_batch_id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 6) a member reports a message ----------
create or replace function public.batch_chat_report(p_message_id bigint, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); x public.batch_messages;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if p_reason not in ('offensive', 'private', 'other') then return jsonb_build_object('ok', false, 'error', 'BAD_REASON'); end if;
  select * into x from public.batch_messages where id = p_message_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_MESSAGE'); end if;
  if not exists (select 1 from public.batch_members where batch_id = x.batch_id and user_id = uid) then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  insert into public.batch_message_reports (message_id, reporter_id, reason) values (p_message_id, uid, p_reason)
  on conflict (message_id, reporter_id) do update set reason = excluded.reason, status = 'new', created_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 7) the little dot: how many unread room messages I have in all my batches ----------
create or replace function public.batch_chat_unread()
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(least(99, (select count(*) from (select 1 from public.batch_messages x where x.batch_id = m.batch_id and x.id > m.chat_read and x.sender_id is distinct from m.user_id and x.deleted_by is null limit 99) q))), 0)::int
  from public.batch_members m join public.batches b on b.id = m.batch_id where m.user_id = auth.uid() and b.chat_mode <> 'off' and auth.uid() is not null;
$$;

-- ---------- 8) admin: the latest messages of a batch (with who wrote them and how many reports each has), and the list counts message reports too ----------
create or replace function public.admin_batch_chat(p_batch_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  return jsonb_build_object('ok', true, 'mode', (select chat_mode from public.batches where id = p_batch_id), 'messages', coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'body', x.body, 'deleted_by', x.deleted_by, 'at', x.created_at,
      'by', coalesce(p.display_name, '') || ' ' || coalesce(p.email, ''),
      'reports', (select count(*) from public.batch_message_reports r where r.message_id = x.id and r.status = 'new')) order by x.id desc)
    from (select * from public.batch_messages where batch_id = p_batch_id order by id desc limit 100) x left join public.members p on p.user_id = x.sender_id), '[]'::jsonb));
end $$;

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
        'messages', (select count(*) from public.batch_messages x where x.batch_id = b.id),
        'chat_mode', b.chat_mode,
        'convener', (select coalesce(p.display_name, '') || ' ' || coalesce(p.email, '') from public.members p where p.user_id = b.convener_id),
        'reports_new', (select count(*) from public.batch_reports x where x.batch_id = b.id and x.status = 'new')
                     + (select count(*) from public.batch_photo_reports x join public.batch_photos ph on ph.id = x.photo_id where ph.batch_id = b.id and x.status = 'new')
                     + (select count(*) from public.batch_message_reports x join public.batch_messages mm on mm.id = x.message_id where mm.batch_id = b.id and x.status = 'new'),
        'reports_all', (select count(*) from public.batch_reports x where x.batch_id = b.id)) as r
      from public.batches b
      where (q is null or b.institution_slug ilike '%' || q || '%' or coalesce(b.name, '') ilike '%' || q || '%' or coalesce(b.line, '') ilike '%' || q || '%'
             or exists (select 1 from public.listing_submissions l where l.desired_slug = b.institution_slug and l.institution_name ilike '%' || q || '%')
             or exists (select 1 from public.members p where p.user_id = b.convener_id and (coalesce(p.display_name, '') ilike '%' || q || '%' or coalesce(p.email, '') ilike '%' || q || '%')))
        and (not coalesce(p_only_reported, false)
             or exists (select 1 from public.batch_reports x where x.batch_id = b.id and x.status = 'new')
             or exists (select 1 from public.batch_photo_reports x join public.batch_photos ph on ph.id = x.photo_id where ph.batch_id = b.id and x.status = 'new')
             or exists (select 1 from public.batch_message_reports x join public.batch_messages mm on mm.id = x.message_id where mm.batch_id = b.id and x.status = 'new'))
      order by b.created_at desc limit greatest(1, least(coalesce(p_limit, 60), 200))
    ) t
  ), '[]'::jsonb));
end $$;

-- "reports handled" in the admin tab also closes the message reports
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
    update public.batch_message_reports set status = 'done' where status = 'new' and message_id in (select id from public.batch_messages where batch_id = b.id);
  else
    return jsonb_build_object('ok', false, 'error', 'BAD_ACTION');
  end if;
  insert into public.batch_admin_log (admin_id, batch_id, action, detail) values (auth.uid(), p_batch_id, p_action, detail);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.batch_chat_rooms() from public;
revoke all on function public.batch_chat_messages(uuid, bigint) from public;
revoke all on function public.batch_chat_send(uuid, text) from public;
revoke all on function public.batch_chat_delete(bigint) from public;
revoke all on function public.batch_chat_mute(uuid, int, boolean) from public;
revoke all on function public.batch_chat_mode(uuid, text) from public;
revoke all on function public.batch_chat_report(bigint, text) from public;
revoke all on function public.batch_chat_unread() from public;
revoke all on function public.admin_batch_chat(uuid) from public;
revoke all on function public.admin_batch_list(text, boolean, int) from public;
revoke all on function public.admin_batch_moderate(uuid, text, int) from public;
grant execute on function public.batch_chat_rooms() to authenticated;
grant execute on function public.batch_chat_messages(uuid, bigint) to authenticated;
grant execute on function public.batch_chat_send(uuid, text) to authenticated;
grant execute on function public.batch_chat_delete(bigint) to authenticated;
grant execute on function public.batch_chat_mute(uuid, int, boolean) to authenticated;
grant execute on function public.batch_chat_mode(uuid, text) to authenticated;
grant execute on function public.batch_chat_report(bigint, text) to authenticated;
grant execute on function public.batch_chat_unread() to authenticated;
grant execute on function public.admin_batch_chat(uuid) to authenticated;          -- each admin function checks is_admin() itself
grant execute on function public.admin_batch_list(text, boolean, int) to authenticated;
grant execute on function public.admin_batch_moderate(uuid, text, int) to authenticated;

-- check
select count(*) as messages from public.batch_messages;
