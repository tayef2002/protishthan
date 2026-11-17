-- Tutor Alert: a tutor sees, in their own dashboard, the requests that were made for them, with the details of the request.
-- Two things make an alert:
--   1) a guardian sends a request FOR THIS TUTOR (tutor_requests.tutor_pid = the tutor's public id) and the tutor is approved: a row in tutor_matches is made at once (source 'guardian')
--   2) the admin sends a request to a tutor (the admin page already writes tutor_matches; source 'admin')
-- The tutor answers "interested" (accepted) or "cannot" (declined); the admin sees the answer in the match status that the admin tab already shows, and arranges the number exchange
-- only when the guardian agrees. THE GUARDIAN'S NAME AND NUMBER ARE NEVER RETURNED here (privacy.html section 8: no tutor sees a guardian's number unless the guardian agrees).
-- Needs 2026-12-17_tutors.sql .. 2026-12-20_tutor_browse.sql. Safe to run more than once.

-- 1) the columns: where the alert came from, when the tutor saw it, when the tutor answered
alter table public.tutor_matches add column if not exists source text not null default 'admin';
alter table public.tutor_matches add column if not exists replied_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tutor_matches_source_check') then
    alter table public.tutor_matches add constraint tutor_matches_source_check check (source in ('admin', 'guardian'));
  end if;
  -- the matches that existed before this file were seen by the way they were sent (WhatsApp): they must not all appear as "new" (done once, when the column is made)
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tutor_matches' and column_name = 'seen_at') then
    alter table public.tutor_matches add column seen_at timestamptz;
    update public.tutor_matches set seen_at = created_at;
  end if;
end $$;
create index if not exists tutor_matches_tutor_idx on public.tutor_matches (tutor_id, created_at desc);

-- 2) a request for one tutor becomes an alert for that tutor (only an approved one; a paused or rejected profile gets nothing)
create or replace function public.tutor_request_alert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tutor_pid is not null then
    insert into public.tutor_matches (request_id, tutor_id, source)
      select new.id, p.user_id, 'guardian' from public.tutor_profiles p where p.pid = new.tutor_pid and p.status = 'approved'
      on conflict (request_id, tutor_id) do nothing;
  end if;
  return null;
end $$;
drop trigger if exists tutor_requests_alert on public.tutor_requests;
create trigger tutor_requests_alert after insert on public.tutor_requests for each row execute function public.tutor_request_alert();

-- 3) my alerts (newest first, at most 60): the request details, never a name or a number
create or replace function public.tutor_alerts_me() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.at desc), '[]'::jsonb) from (
    select m.created_at as at, jsonb_build_object(
        'id', m.id, 'status', m.status, 'source', m.source, 'created_at', m.created_at, 'seen', m.seen_at is not null, 'replied_at', m.replied_at,
        'class_band', r.class_band, 'subjects', r.subjects, 'mode', r.mode, 'district', r.district, 'upazila', r.upazila, 'note', r.note,
        'pref_gender', r.pref_gender, 'student_level', r.student_level, 'goal', r.goal, 'want_trial', r.want_trial, 'req_status', r.status) as j
      from public.tutor_matches m join public.tutor_requests r on r.id = m.request_id
     where m.tutor_id = auth.uid() and auth.uid() is not null and r.status <> 'spam'
     order by m.created_at desc limit 60
  ) x
$$;

-- 4) how many are new (not seen, not answered): the number on the menu
create or replace function public.tutor_alert_unread() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.tutor_matches m join public.tutor_requests r on r.id = m.request_id
   where m.tutor_id = auth.uid() and auth.uid() is not null and m.seen_at is null and m.status = 'sent' and r.status <> 'spam'
$$;

-- 5) the tutor has seen these
create or replace function public.tutor_alert_seen(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  update public.tutor_matches set seen_at = now() where tutor_id = auth.uid() and seen_at is null and id = any(coalesce(p_ids, '{}'::uuid[]));
  return jsonb_build_object('ok', true);
end $$;

-- 6) the answer: 'accepted' (interested) or 'declined' (cannot); it can be changed until the admin marks the tuition as started
create or replace function public.tutor_alert_reply(p_id uuid, p_reply text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if p_reply is null or p_reply not in ('accepted', 'declined') then return jsonb_build_object('ok', false, 'error', 'BAD_REPLY'); end if;
  select m.status into cur from public.tutor_matches m join public.tutor_requests r on r.id = m.request_id
   where m.id = p_id and m.tutor_id = auth.uid() and r.status <> 'spam';
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if cur = 'started' then return jsonb_build_object('ok', false, 'error', 'ALREADY_STARTED'); end if;
  update public.tutor_matches set status = p_reply, replied_at = now(), seen_at = coalesce(seen_at, now()) where id = p_id;
  return jsonb_build_object('ok', true, 'status', p_reply);
end $$;

revoke all on function public.tutor_request_alert() from public, anon, authenticated;
-- Supabase grants execute to anon on every new function by default, so anon is named here too
revoke all on function public.tutor_alerts_me() from public, anon;
revoke all on function public.tutor_alert_unread() from public, anon;
revoke all on function public.tutor_alert_seen(uuid[]) from public, anon;
revoke all on function public.tutor_alert_reply(uuid, text) from public, anon;
grant execute on function public.tutor_alerts_me() to authenticated;
grant execute on function public.tutor_alert_unread() to authenticated;
grant execute on function public.tutor_alert_seen(uuid[]) to authenticated;
grant execute on function public.tutor_alert_reply(uuid, text) to authenticated;
