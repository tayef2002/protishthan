-- প্রতিষ্ঠান লিগ, guards before the league is made public:
--  1) a list of batches that are EXCLUDED from the league (a cheating batch): league_excluded, with admin functions to add, remove and to SEE the batches that look suspicious (league_admin).
--     An excluded batch earns no league points (challenges, rope matches, duels; a match against it gives nothing to the other side either), and its players are not counted in the daily-quiz boards.
--  2) a limit for GUESTS of the daily quiz: at most 10,000 new guests (players with no account) a day, then only members start a new game; the plays of guests older than 14 days are removed
--     (the first live design had no limit: made-up device numbers could have filled the small database). Members are never refused and their plays stay.
-- Replaces quiz_ensure_day, quiz_next and quiz_board of 2027-01-11_daily_quiz.sql and league_rows_all of 2027-01-16_batch_duel.sql: if one of those files is ever run AGAIN, run this file again after it.
-- Needs 2027-01-11, -12, -13, -14, -16. Safe to run more than once.
create table if not exists public.league_excluded (
  batch_id uuid primary key references public.batches(id) on delete cascade,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.quiz_anon_day (day date primary key, n int not null default 0);
alter table public.league_excluded enable row level security;
alter table public.quiz_anon_day enable row level security;
revoke all on public.league_excluded, public.quiz_anon_day from anon, authenticated;
grant select, insert, update, delete on public.league_excluded, public.quiz_anon_day to authenticated;
drop policy if exists league_excluded_admin on public.league_excluded;
create policy league_excluded_admin on public.league_excluded for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists quiz_anon_day_admin on public.quiz_anon_day;
create policy quiz_anon_day_admin on public.quiz_anon_day for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.quiz_ensure_day(p_day date) returns uuid[] language plpgsql security definer set search_path = public as $$
declare ids uuid[]; cnt int;
begin
  select d.qids into ids from public.quiz_daily d where d.day = p_day;
  if found then return ids; end if;
  ids := public.quiz_pick('{}');
  if cardinality(ids) < 5 then return null; end if;
  insert into public.quiz_daily (day, qids, source) values (p_day, ids, 'auto') on conflict (day) do nothing;
  get diagnostics cnt = row_count;
  if cnt > 0 then     -- a new day: the plays of GUESTS (no account) older than 14 days and the guest counters older than 30 days are removed; the plays of members stay
    delete from public.quiz_plays where user_id is null and day < public.quiz_day() - 14;
    delete from public.quiz_anon_day where day < public.quiz_day() - 30;
  end if;
  select d.qids into ids from public.quiz_daily d where d.day = p_day;
  return ids;
end $$;

create or replace function public.quiz_next(p_device text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := public.quiz_day(); p text := public.quiz_player(p_device); uid uuid := auth.uid(); r public.quiz_plays; q public.quiz_questions; n int; qid uuid; el numeric; inst text; bid uuid; binst text; cap_n int;
begin
  if p is null then return jsonb_build_object('ok', false, 'error', 'NO_PLAYER'); end if;
  if public.quiz_ensure_day(d) is null then return jsonb_build_object('ok', false, 'error', 'NOT_READY'); end if;
  loop
    select * into r from public.quiz_plays x where x.day = d and x.player = p and x.answered_at is null order by x.idx limit 1;
    exit when not found;
    el := extract(epoch from (now() - r.opened_at));
    if el <= 17 then
      select * into q from public.quiz_questions where id = r.qid;
      return jsonb_build_object('ok', true, 'idx', r.idx, 'total', 5, 'seconds', 15, 'remaining_ms', greatest(0, round((15 - el) * 1000))::int,
        'question', jsonb_build_object('id', q.id, 'topic', q.topic, 'text', q.question, 'options', q.options));
    end if;
    update public.quiz_plays set answered_at = now(), correct = false, points = 0, choice = null where day = d and player = p and idx = r.idx;   -- left open too long: a timeout
  end loop;
  select count(*)::int into n from public.quiz_plays where day = d and player = p;
  if n >= 5 then return jsonb_build_object('ok', true, 'finished', true); end if;
  qid := public.quiz_qid_at(d, n);
  if qid is null then return jsonb_build_object('ok', false, 'error', 'NOT_READY'); end if;
  if uid is null and n = 0 then      -- a new guest today: counted; the 10,001st is refused (made-up device numbers could otherwise fill the small database)
    insert into public.quiz_anon_day as a (day, n) values (d, 1) on conflict (day) do update set n = a.n + 1 where a.n < 10000 returning a.n into cap_n;
    if cap_n is null then return jsonb_build_object('ok', false, 'error', 'GUEST_LIMIT'); end if;
  end if;
  if uid is not null then
    select mi.institution_slug into inst from public.member_institution mi where mi.user_id = uid;
    select b.id, b.institution_slug into bid, binst from public.batch_members m join public.batches b on b.id = m.batch_id where m.user_id = uid and b.level = 'ssc' order by m.is_primary desc, m.joined_at limit 1;
    inst := coalesce(inst, binst);
  end if;
  insert into public.quiz_plays (day, player, user_id, inst_slug, batch_id, idx, qid) values (d, p, uid, inst, bid, n, qid) on conflict (day, player, idx) do nothing;
  select * into r from public.quiz_plays where day = d and player = p and idx = n;
  select * into q from public.quiz_questions where id = r.qid;
  el := extract(epoch from (now() - r.opened_at));
  return jsonb_build_object('ok', true, 'idx', r.idx, 'total', 5, 'seconds', 15, 'remaining_ms', greatest(0, round((15 - el) * 1000))::int,
    'question', jsonb_build_object('id', q.id, 'topic', q.topic, 'text', q.question, 'options', q.options));
end $$;

create or replace function public.quiz_board(p_scope text default 'institution', p_period text default 'today', p_district text default null, p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date := public.quiz_day(); f date; lim int := greatest(1, least(coalesce(p_limit, 20), 50)); res jsonb;
begin
  f := case when p_period = 'week' then d - 6 else d end;
  if p_scope = 'batch' then
    with pl as (select user_id, (array_agg(batch_id order by day, idx))[1] as k, sum(points)::int as score from public.quiz_plays where day between f and d and user_id is not null and answered_at is not null group by user_id),
         pr as (select k, score, row_number() over (partition by k order by score desc) rn, count(*) over (partition by k) n from pl where k is not null and k not in (select x.batch_id from public.league_excluded x)),
         g as (select k, max(n)::int as n, avg(score) as sc from pr where rn <= 10 group by k having max(n) >= 3)
    select coalesce(jsonb_agg(x.j order by x.sc desc, x.n desc, x.slug), '[]'::jsonb) into res from (
      select g.sc, g.n, b.institution_slug as slug, jsonb_build_object('rank', row_number() over (order by g.sc desc, g.n desc, b.institution_slug), 'id', b.id, 'slug', b.institution_slug, 'name', l.institution_name, 'district', l.district, 'year', b.exam_year, 'players', g.n, 'score', round(g.sc, 1)) as j
        from g join public.batches b on b.id = g.k join public.listing_submissions l on l.desired_slug = b.institution_slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false
       where p_district is null or l.district = p_district order by g.sc desc, g.n desc, b.institution_slug limit lim) x;
  else
    with pl as (select user_id, (array_agg(inst_slug order by day, idx))[1] as k, (array_agg(batch_id order by day, idx))[1] as bk, sum(points)::int as score from public.quiz_plays where day between f and d and user_id is not null and answered_at is not null group by user_id),
         pr as (select k, score, row_number() over (partition by k order by score desc) rn, count(*) over (partition by k) n from pl where k is not null and (bk is null or bk not in (select x.batch_id from public.league_excluded x))),
         g as (select k, max(n)::int as n, avg(score) as sc from pr where rn <= 10 group by k having max(n) >= 3)
    select coalesce(jsonb_agg(x.j order by x.sc desc, x.n desc, x.slug), '[]'::jsonb) into res from (
      select g.sc, g.n, g.k as slug, jsonb_build_object('rank', row_number() over (order by g.sc desc, g.n desc, g.k), 'slug', g.k, 'name', l.institution_name, 'district', l.district, 'players', g.n, 'score', round(g.sc, 1)) as j
        from g join public.listing_submissions l on l.desired_slug = g.k and l.status = 'approved' and coalesce(l.is_hidden, false) = false
       where p_district is null or l.district = p_district order by g.sc desc, g.n desc, g.k limit lim) x;
  end if;
  return res;
end $$;

-- the league rows, with and without the exclusions (internal)
create or replace function public.league_rows_raw(p_since timestamptz) returns table (challenge_id uuid, batch_id uuid, pts int, won boolean, drew boolean, rope boolean)
language sql stable security definer set search_path = public as $$
  select * from public.league_rows(p_since) union all select * from public.duel_rows(p_since)
$$;
create or replace function public.league_rows_all(p_since timestamptz) returns table (challenge_id uuid, batch_id uuid, pts int, won boolean, drew boolean, rope boolean)
language sql stable security definer set search_path = public as $$
  select r.* from public.league_rows_raw(p_since) r
   where r.batch_id not in (select x.batch_id from public.league_excluded x)
     and not exists (select 1 from public.batch_challenges c join public.league_excluded x on x.batch_id in (c.batch_id, c.opp_batch_id) where c.id = r.challenge_id)
     and not exists (select 1 from public.batch_duels d join public.league_excluded x on x.batch_id in (d.batch_a, d.batch_b) where d.id = r.challenge_id)
$$;

-- admin: exclude a batch from the league, take it back, and look at the batches with points (members, newcomers of the last 24 hours, points) to see who looks suspicious
create or replace function public.league_exclude(p_batch uuid, p_reason text default null) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then raise exception 'NOT_ADMIN'; end if;
  if not exists (select 1 from public.batches b where b.id = p_batch) then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  insert into public.league_excluded (batch_id, reason, created_by) values (p_batch, nullif(left(btrim(coalesce(p_reason, '')), 300), ''), auth.uid())
    on conflict (batch_id) do update set reason = excluded.reason, created_by = excluded.created_by, created_at = now();
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.league_include(p_batch uuid) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then raise exception 'NOT_ADMIN'; end if;
  delete from public.league_excluded where batch_id = p_batch;
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.league_admin(p_limit int default 40) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then raise exception 'NOT_ADMIN'; end if;
  return jsonb_build_object(
    'excluded', (select coalesce(jsonb_agg(jsonb_build_object('batch', public.challenge_batch(x.batch_id), 'reason', x.reason, 'at', x.created_at) order by x.created_at desc), '[]'::jsonb) from public.league_excluded x),
    'top', (select coalesce(jsonb_agg(t.j order by t.pw desc, t.pa desc), '[]'::jsonb) from (
      select jsonb_build_object('batch', public.challenge_batch(b.id), 'members', public.challenge_team_size(b.id),
               'new24', (select count(*)::int from public.batch_members m where m.batch_id = b.id and m.joined_at > now() - interval '24 hours'),
               'week', coalesce(w.pts, 0), 'all', a.pts, 'matches', a.m, 'excluded', exists (select 1 from public.league_excluded x where x.batch_id = b.id)) as j,
             coalesce(w.pts, 0) as pw, a.pts as pa
        from (select r.batch_id, sum(r.pts)::int as pts, count(*)::int as m from public.league_rows_raw('2000-01-01'::timestamptz) r group by r.batch_id) a
        left join (select r.batch_id, sum(r.pts)::int as pts from public.league_rows_raw(now() - interval '7 days') r group by r.batch_id) w on w.batch_id = a.batch_id
        join public.batches b on b.id = a.batch_id
       order by coalesce(w.pts, 0) desc, a.pts desc limit greatest(1, least(coalesce(p_limit, 40), 100))
    ) t));
end $$;
revoke all on function public.league_rows_raw(timestamptz) from public, anon, authenticated;
revoke all on function public.league_rows_all(timestamptz) from public, anon, authenticated;
revoke all on function public.league_exclude(uuid, text) from public, anon;
revoke all on function public.league_include(uuid) from public, anon;
revoke all on function public.league_admin(int) from public, anon;
grant execute on function public.league_exclude(uuid, text) to authenticated;
grant execute on function public.league_include(uuid) to authenticated;
grant execute on function public.league_admin(int) to authenticated;
grant execute on function public.quiz_next(text) to anon, authenticated;
grant execute on function public.quiz_board(text, text, text, int) to anon, authenticated;
revoke all on function public.quiz_ensure_day(date) from public, anon, authenticated;
