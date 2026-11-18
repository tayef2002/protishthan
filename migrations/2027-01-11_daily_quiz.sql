-- প্রতিষ্ঠান লিগ, step 2: the DAILY QUIZ ("আজকের কুইজ") and the school / batch boards.
--  * Every day (Bangladesh date, UTC+6) everybody gets the same 5 questions, taken ONLY from the VERIFIED questions of the bank (2027-01-10_quiz_bank.sql), one per topic first, never-used first.
--    The day's set is made on the first request of the day (or ahead of time by the admin) and kept in quiz_daily.
--  * A question is OPENED by quiz_next (the clock starts on the SERVER), ANSWERED by quiz_answer (15 seconds, 2 seconds of grace; later it counts as a timeout). One answer per question per player.
--    The answer is checked on the server and given back only AFTER the player answered; the browser never holds an answer. Points: 10 for a right answer + up to 5 for speed (max 75 a day).
--  * Anybody can play (a device id); only a SIGNED-IN member counts for the boards, with the institution (current institution, else the SSC school) and the SSC batch he had when he started.
--  * Boards (anyone can read; counts only, never a name): an institution (or a batch) is shown with the AVERAGE of its best 10 players (a big school does not win by size) and only with at least 3 players.
--  * A streak = days in a row with all 5 answered.
-- Needs 2027-01-10_quiz_bank.sql, 2027-01-06_my_institution.sql, 2027-01-07_current_institution.sql. Safe to run more than once.

create table if not exists public.quiz_daily (
  day date primary key,
  qids uuid[] not null check (cardinality(qids) = 5),
  source text not null default 'auto' check (source in ('auto', 'admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.quiz_plays (
  day date not null,
  player text not null,                              -- 'u:<member id>' or 'd:<device id>'
  user_id uuid,
  inst_slug text,                                    -- the institution when the first question was opened (members only)
  batch_id uuid,                                     -- the SSC batch at that moment (members only)
  idx smallint not null check (idx between 0 and 4),
  qid uuid not null,
  opened_at timestamptz not null default now(),
  answered_at timestamptz,
  choice smallint check (choice between 0 and 3),
  correct boolean,
  points smallint check (points between 0 and 15),
  primary key (day, player, idx)
);
create index if not exists quiz_plays_board_idx on public.quiz_plays (day, inst_slug) where user_id is not null and answered_at is not null;
create index if not exists quiz_plays_player_idx on public.quiz_plays (player, day);
alter table public.quiz_daily enable row level security;
alter table public.quiz_plays enable row level security;
revoke all on public.quiz_daily, public.quiz_plays from anon, authenticated;
grant select, insert, update, delete on public.quiz_daily, public.quiz_plays to authenticated;
drop policy if exists quiz_daily_admin on public.quiz_daily;
create policy quiz_daily_admin on public.quiz_daily for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists quiz_plays_admin on public.quiz_plays;
create policy quiz_plays_admin on public.quiz_plays for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- today in Bangladesh
create or replace function public.quiz_day() returns date language sql stable as $$ select ((now() at time zone 'utc') + interval '6 hours')::date $$;

-- who is playing: a member by id, anybody else by a device id of at least 8 characters
create or replace function public.quiz_player(p_device text) returns text language sql stable as $$
  select case when auth.uid() is not null then 'u:' || auth.uid()::text
              when char_length(coalesce(btrim(p_device), '')) >= 8 then 'd:' || left(btrim(p_device), 64) end
$$;

-- five verified questions: one per topic first (then a second of a topic...), the ones used longest ago (or never) first, then at random
create or replace function public.quiz_pick(p_exclude uuid[] default '{}') returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(z.id order by z.rn, z.lastday nulls first, z.rnd), '{}'::uuid[]) from (
    select t.* from (
      select q.id, row_number() over (partition by q.topic order by u.lastday nulls first, random()) as rn, u.lastday, random() as rnd
        from public.quiz_questions q
        left join (select x as qid, max(d.day) as lastday from public.quiz_daily d, unnest(d.qids) x group by x) u on u.qid = q.id
       where q.status = 'verified' and not (q.id = any(coalesce(p_exclude, '{}'::uuid[])))
    ) t order by t.rn, t.lastday nulls first, t.rnd limit 5
  ) z
$$;

-- the set of a day: made on the first request, or null while fewer than 5 verified questions exist
create or replace function public.quiz_ensure_day(p_day date) returns uuid[] language plpgsql security definer set search_path = public as $$
declare ids uuid[];
begin
  select d.qids into ids from public.quiz_daily d where d.day = p_day;
  if found then return ids; end if;
  ids := public.quiz_pick('{}');
  if cardinality(ids) < 5 then return null; end if;
  insert into public.quiz_daily (day, qids, source) values (p_day, ids, 'auto') on conflict (day) do nothing;
  select d.qids into ids from public.quiz_daily d where d.day = p_day;
  return ids;
end $$;

-- the question at a place of the day; one that is no longer verified (retired, edited) is replaced by another verified one
create or replace function public.quiz_qid_at(p_day date, p_idx int) returns uuid language plpgsql security definer set search_path = public as $$
declare ids uuid[]; q uuid; r uuid;
begin
  ids := public.quiz_ensure_day(p_day); if ids is null then return null; end if;
  q := ids[p_idx + 1];
  if exists (select 1 from public.quiz_questions x where x.id = q and x.status = 'verified') then return q; end if;
  select x.id into r from public.quiz_questions x where x.status = 'verified' and x.id <> all(ids) order by random() limit 1;
  if r is null then return null; end if;
  update public.quiz_daily set qids[p_idx + 1] = r where day = p_day;
  return r;
end $$;

-- days in a row with all 5 answered, counted back from today (or from yesterday while today is not finished yet)
create or replace function public.quiz_streak(p text, d date) returns int language sql stable security definer set search_path = public as $$
  with dd as (select day from public.quiz_plays where player = p and answered_at is not null group by day having count(*) = 5),
       a as (select case when exists (select 1 from dd where day = d) then d else d - 1 end as anchor)
  select coalesce(count(*), 0)::int from (
    select dd.day, a.anchor - (row_number() over (order by dd.day desc) - 1)::int as expect from dd, a where dd.day <= a.anchor
  ) t where t.day = t.expect
$$;

-- the state of today for this player
create or replace function public.quiz_today(p_device text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := public.quiz_day(); p text := public.quiz_player(p_device); uid uuid := auth.uid(); ids uuid[]; n int := 0; pts int := 0; res jsonb := '[]'::jsonb; inst jsonb := null;
begin
  ids := public.quiz_ensure_day(d);
  if ids is null then return jsonb_build_object('day', d, 'ready', false); end if;
  if p is not null then
    select count(*)::int, coalesce(sum(points), 0)::int, coalesce(jsonb_agg(jsonb_build_object('idx', idx, 'correct', coalesce(correct, false), 'points', coalesce(points, 0)) order by idx), '[]'::jsonb)
      into n, pts, res from public.quiz_plays where day = d and player = p and answered_at is not null;
  end if;
  if uid is not null then
    select jsonb_build_object('slug', l.desired_slug, 'name', l.institution_name) into inst
      from (select coalesce((select mi.institution_slug from public.member_institution mi where mi.user_id = uid),
                            (select b.institution_slug from public.batch_members m join public.batches b on b.id = m.batch_id where m.user_id = uid and b.level = 'ssc' order by m.is_primary desc, m.joined_at limit 1)) as slug) s
      join public.listing_submissions l on l.desired_slug = s.slug and l.status = 'approved' limit 1;
  end if;
  return jsonb_build_object('day', d, 'ready', true, 'total', 5, 'answered', n, 'points', pts, 'results', res, 'finished', n >= 5, 'signed_in', uid is not null, 'inst', inst,
    'streak', case when p is null then 0 else public.quiz_streak(p, d) end);
end $$;

-- open the next question (the clock starts now, on the server); a question already open is given back with the time that is left
create or replace function public.quiz_next(p_device text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := public.quiz_day(); p text := public.quiz_player(p_device); uid uuid := auth.uid(); r public.quiz_plays; q public.quiz_questions; n int; qid uuid; el numeric; inst text; bid uuid; binst text;
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

-- answer the open question: the server checks it and tells the right answer only now
create or replace function public.quiz_answer(p_device text, p_idx int, p_choice int) returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := public.quiz_day(); p text := public.quiz_player(p_device); r public.quiz_plays; q public.quiz_questions; el numeric; timed boolean; good boolean; pts int; total int; cnt int;
begin
  if p is null then return jsonb_build_object('ok', false, 'error', 'NO_PLAYER'); end if;
  select * into r from public.quiz_plays x where x.day = d and x.player = p and x.idx = p_idx and x.answered_at is null;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_OPEN'); end if;
  select * into q from public.quiz_questions where id = r.qid;
  el := extract(epoch from (now() - r.opened_at));
  timed := el > 17 or p_choice is null or p_choice < 0 or p_choice > 3;
  good := not timed and p_choice = q.answer_idx;
  pts := case when good then 10 + greatest(0, least(5, ceil(5 * (15 - el) / 15)::int)) else 0 end;
  update public.quiz_plays set answered_at = now(), choice = case when timed then null else p_choice end, correct = good, points = pts where day = d and player = p and idx = p_idx;
  select coalesce(sum(points), 0)::int, count(*)::int into total, cnt from public.quiz_plays where day = d and player = p and answered_at is not null;
  return jsonb_build_object('ok', true, 'idx', p_idx, 'correct', good, 'timeout', timed, 'answer_idx', q.answer_idx, 'explanation', q.explanation, 'points', pts, 'total_points', total, 'finished', cnt >= 5);
end $$;

-- the boards: scope 'institution' or 'batch', period 'today' or 'week' (the last 7 days); only members, only counts, at least 3 players, the best 10 average
create or replace function public.quiz_board(p_scope text default 'institution', p_period text default 'today', p_district text default null, p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date := public.quiz_day(); f date; lim int := greatest(1, least(coalesce(p_limit, 20), 50)); res jsonb;
begin
  f := case when p_period = 'week' then d - 6 else d end;
  if p_scope = 'batch' then
    with pl as (select user_id, (array_agg(batch_id order by day, idx))[1] as k, sum(points)::int as score from public.quiz_plays where day between f and d and user_id is not null and answered_at is not null group by user_id),
         pr as (select k, score, row_number() over (partition by k order by score desc) rn, count(*) over (partition by k) n from pl where k is not null),
         g as (select k, max(n)::int as n, avg(score) as sc from pr where rn <= 10 group by k having max(n) >= 3)
    select coalesce(jsonb_agg(x.j order by x.sc desc, x.n desc, x.slug), '[]'::jsonb) into res from (
      select g.sc, g.n, b.institution_slug as slug, jsonb_build_object('rank', row_number() over (order by g.sc desc, g.n desc, b.institution_slug), 'id', b.id, 'slug', b.institution_slug, 'name', l.institution_name, 'district', l.district, 'year', b.exam_year, 'players', g.n, 'score', round(g.sc, 1)) as j
        from g join public.batches b on b.id = g.k join public.listing_submissions l on l.desired_slug = b.institution_slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false
       where p_district is null or l.district = p_district order by g.sc desc, g.n desc, b.institution_slug limit lim) x;
  else
    with pl as (select user_id, (array_agg(inst_slug order by day, idx))[1] as k, sum(points)::int as score from public.quiz_plays where day between f and d and user_id is not null and answered_at is not null group by user_id),
         pr as (select k, score, row_number() over (partition by k order by score desc) rn, count(*) over (partition by k) n from pl where k is not null),
         g as (select k, max(n)::int as n, avg(score) as sc from pr where rn <= 10 group by k having max(n) >= 3)
    select coalesce(jsonb_agg(x.j order by x.sc desc, x.n desc, x.slug), '[]'::jsonb) into res from (
      select g.sc, g.n, g.k as slug, jsonb_build_object('rank', row_number() over (order by g.sc desc, g.n desc, g.k), 'slug', g.k, 'name', l.institution_name, 'district', l.district, 'players', g.n, 'score', round(g.sc, 1)) as j
        from g join public.listing_submissions l on l.desired_slug = g.k and l.status = 'approved' and coalesce(l.is_hidden, false) = false
       where p_district is null or l.district = p_district order by g.sc desc, g.n desc, g.k limit lim) x;
  end if;
  return res;
end $$;

-- the admin: make the sets of the next days ahead of time, and choose a day's set again (only while nobody has played that day)
create or replace function public.quiz_plan(p_days int default 7) returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := public.quiz_day(); i int; ids uuid[]; out jsonb := '[]'::jsonb;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'NOT_ADMIN'; end if;
  for i in 0 .. greatest(1, least(coalesce(p_days, 7), 30)) - 1 loop
    ids := public.quiz_ensure_day(d + i);
    exit when ids is null;
    out := out || jsonb_build_object('day', d + i, 'qids', ids);
  end loop;
  return out;
end $$;
create or replace function public.quiz_reroll(p_day date) returns jsonb language plpgsql security definer set search_path = public as $$
declare ids uuid[];
begin
  if not coalesce(public.is_admin(), false) then raise exception 'NOT_ADMIN'; end if;
  if p_day < public.quiz_day() then return jsonb_build_object('ok', false, 'error', 'PAST'); end if;
  if exists (select 1 from public.quiz_plays where day = p_day) then return jsonb_build_object('ok', false, 'error', 'ALREADY_PLAYED'); end if;
  delete from public.quiz_daily where day = p_day;
  ids := public.quiz_pick('{}');
  if cardinality(ids) < 5 then return jsonb_build_object('ok', false, 'error', 'NOT_ENOUGH'); end if;
  insert into public.quiz_daily (day, qids, source) values (p_day, ids, 'admin');
  return jsonb_build_object('ok', true, 'qids', ids);
end $$;

revoke all on function public.quiz_day() from public, anon, authenticated;
revoke all on function public.quiz_player(text) from public, anon, authenticated;
revoke all on function public.quiz_pick(uuid[]) from public, anon, authenticated;
revoke all on function public.quiz_ensure_day(date) from public, anon, authenticated;
revoke all on function public.quiz_qid_at(date, int) from public, anon, authenticated;
revoke all on function public.quiz_streak(text, date) from public, anon, authenticated;
revoke all on function public.quiz_plan(int) from public, anon;
revoke all on function public.quiz_reroll(date) from public, anon;
grant execute on function public.quiz_today(text) to anon, authenticated;
grant execute on function public.quiz_next(text) to anon, authenticated;
grant execute on function public.quiz_answer(text, int, int) to anon, authenticated;
grant execute on function public.quiz_board(text, text, text, int) to anon, authenticated;
grant execute on function public.quiz_plan(int) to authenticated;
grant execute on function public.quiz_reroll(date) to authenticated;
