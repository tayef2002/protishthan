-- প্রতিষ্ঠান লিগ: the daily quiz by CLASS BAND (ধাপ), so that a pupil gets questions of his own level.
--  * Four bands: 'c1-5' (শ্রেণি ১-৫), 'c6-8', 'c9-10', 'c11-12' (একাদশ-দ্বাদশ / কলেজ). Every band has its OWN 5 questions a day (quiz_daily is now one row per day AND band).
--  * A band gets the verified questions of its own band, plus the "any" (all classes) questions that are not too hard for it (c1-5: easy only, c6-8: easy and medium, the others: all).
--    The five of a day are ordered easy to hard. The ones never used (then the ones used longest ago) in that band come first, spread over the topics, so nothing repeats until the whole pool of the band is used.
--  * A player plays ONE band a day: the band of his first question stays for the rest of that day (quiz_plays.band). Without a band the old default is used ('c6-8'), so an old page keeps working.
--  * The boards are per band (a school is only compared with schools of the same band). The batch duel (SSC batches) counts the 'c9-10' band only.
--  * quiz_today also tells which bands have enough verified questions today (bands), the band of the player (band) and whether it is already fixed for today (locked).
-- Replaces quiz_pick, quiz_ensure_day, quiz_qid_at, quiz_today, quiz_next, quiz_board, quiz_plan, quiz_reroll (2027-01-11, -17) and duel_side (2027-01-16).
-- If one of those files is ever run AGAIN, run this file again after it. Needs 2027-01-11, -16, -17. Safe to run more than once.

alter table public.quiz_daily add column if not exists band text not null default 'c6-8';
alter table public.quiz_daily drop constraint if exists quiz_daily_band_check;
alter table public.quiz_daily add constraint quiz_daily_band_check check (band in ('c1-5', 'c6-8', 'c9-10', 'c11-12'));
do $$ begin
  if exists (select 1 from pg_constraint where conrelid = 'public.quiz_daily'::regclass and contype = 'p' and cardinality(conkey) = 1) then
    alter table public.quiz_daily drop constraint quiz_daily_pkey;
    alter table public.quiz_daily add primary key (day, band);
  end if;
end $$;
alter table public.quiz_plays add column if not exists band text not null default 'c6-8';
alter table public.quiz_plays drop constraint if exists quiz_plays_band_check;
alter table public.quiz_plays add constraint quiz_plays_band_check check (band in ('c1-5', 'c6-8', 'c9-10', 'c11-12'));
create index if not exists quiz_plays_band_idx on public.quiz_plays (band, day, inst_slug) where user_id is not null and answered_at is not null;

-- a band name as it is kept (anything else becomes the default)
create or replace function public.quiz_band(p text) returns text language sql immutable as $$
  select case when p in ('c1-5', 'c6-8', 'c9-10', 'c11-12') then p else 'c6-8' end
$$;

-- five verified questions of a band, easy first; the ones used longest ago in this band (or never) first, one per topic first
drop function if exists public.quiz_pick(uuid[]);
create or replace function public.quiz_pick(p_exclude uuid[] default '{}', p_band text default 'c6-8') returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(z.id order by z.diff, z.rn, z.lastday nulls first, z.rnd), '{}'::uuid[]) from (
    select t.* from (
      select q.id, q.difficulty as diff, row_number() over (partition by q.topic order by u.lastday nulls first, random()) as rn, u.lastday, random() as rnd
        from public.quiz_questions q
        left join (select x as qid, max(d.day) as lastday from public.quiz_daily d, unnest(d.qids) x where d.band = public.quiz_band(p_band) group by x) u on u.qid = q.id
       where q.status = 'verified' and not (q.id = any(coalesce(p_exclude, '{}'::uuid[])))
         and (q.band = public.quiz_band(p_band) or (q.band = 'any' and q.difficulty <= case public.quiz_band(p_band) when 'c1-5' then 1 when 'c6-8' then 2 else 3 end))
    ) t order by t.lastday nulls first, t.rn, t.rnd limit 5
  ) z
$$;

-- the set of a day and a band: made on the first request, or null while fewer than 5 verified questions exist for the band
drop function if exists public.quiz_ensure_day(date);
create or replace function public.quiz_ensure_day(p_day date, p_band text default 'c6-8') returns uuid[] language plpgsql security definer set search_path = public as $$
declare ids uuid[]; cnt int; b text := public.quiz_band(p_band);
begin
  select d.qids into ids from public.quiz_daily d where d.day = p_day and d.band = b;
  if found then return ids; end if;
  ids := public.quiz_pick('{}', b);
  if cardinality(ids) < 5 then return null; end if;
  insert into public.quiz_daily (day, band, qids, source) values (p_day, b, ids, 'auto') on conflict (day, band) do nothing;
  get diagnostics cnt = row_count;
  if cnt > 0 then     -- a new set: the plays of GUESTS (no account) older than 14 days and the guest counters older than 30 days are removed; the plays of members stay
    delete from public.quiz_plays where user_id is null and day < public.quiz_day() - 14;
    delete from public.quiz_anon_day where day < public.quiz_day() - 30;
  end if;
  select d.qids into ids from public.quiz_daily d where d.day = p_day and d.band = b;
  return ids;
end $$;

-- the question at a place of the day; one that is no longer verified (retired, edited) is replaced by another verified one of the same band
drop function if exists public.quiz_qid_at(date, int);
create or replace function public.quiz_qid_at(p_day date, p_idx int, p_band text default 'c6-8') returns uuid language plpgsql security definer set search_path = public as $$
declare ids uuid[]; q uuid; r uuid; b text := public.quiz_band(p_band);
begin
  ids := public.quiz_ensure_day(p_day, b); if ids is null then return null; end if;
  q := ids[p_idx + 1];
  if exists (select 1 from public.quiz_questions x where x.id = q and x.status = 'verified') then return q; end if;
  r := (public.quiz_pick(ids, b))[1];
  if r is null then return null; end if;
  update public.quiz_daily set qids[p_idx + 1] = r where day = p_day and band = b;
  return r;
end $$;

-- the state of today for this player (his band if he has started, else the band asked for, else the default)
drop function if exists public.quiz_today(text);
create or replace function public.quiz_today(p_device text default null, p_band text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := public.quiz_day(); p text := public.quiz_player(p_device); uid uuid := auth.uid(); ids uuid[]; n int := 0; pts int := 0; res jsonb := '[]'::jsonb; inst jsonb := null; b text; locked boolean := false; bands jsonb;
begin
  b := public.quiz_band(p_band);
  if p is not null then
    select x.band into b from public.quiz_plays x where x.day = d and x.player = p order by x.idx limit 1;
    if found then locked := true; else b := public.quiz_band(p_band); end if;
  end if;
  select jsonb_build_object('c1-5', count(*) filter (where q.band = 'c1-5' or (q.band = 'any' and q.difficulty <= 1)) >= 5,
                            'c6-8', count(*) filter (where q.band = 'c6-8' or (q.band = 'any' and q.difficulty <= 2)) >= 5,
                            'c9-10', count(*) filter (where q.band = 'c9-10' or q.band = 'any') >= 5,
                            'c11-12', count(*) filter (where q.band = 'c11-12' or q.band = 'any') >= 5) into bands
    from public.quiz_questions q where q.status = 'verified';
  ids := public.quiz_ensure_day(d, b);
  if ids is null then return jsonb_build_object('day', d, 'ready', false, 'band', b, 'locked', locked, 'bands', bands); end if;
  if p is not null then
    select count(*)::int, coalesce(sum(points), 0)::int, coalesce(jsonb_agg(jsonb_build_object('idx', idx, 'correct', coalesce(correct, false), 'points', coalesce(points, 0)) order by idx), '[]'::jsonb)
      into n, pts, res from public.quiz_plays where day = d and player = p and answered_at is not null;
  end if;
  if uid is not null then
    select jsonb_build_object('slug', l.desired_slug, 'name', l.institution_name) into inst
      from (select coalesce((select mi.institution_slug from public.member_institution mi where mi.user_id = uid),
                            (select b2.institution_slug from public.batch_members m join public.batches b2 on b2.id = m.batch_id where m.user_id = uid and b2.level = 'ssc' order by m.is_primary desc, m.joined_at limit 1)) as slug) s
      join public.listing_submissions l on l.desired_slug = s.slug and l.status = 'approved' limit 1;
  end if;
  return jsonb_build_object('day', d, 'ready', true, 'total', 5, 'answered', n, 'points', pts, 'results', res, 'finished', n >= 5, 'signed_in', uid is not null, 'inst', inst,
    'band', b, 'locked', locked, 'bands', bands, 'streak', case when p is null then 0 else public.quiz_streak(p, d) end);
end $$;

-- open the next question (the clock starts now, on the server); a question already open is given back with the time that is left
drop function if exists public.quiz_next(text);
create or replace function public.quiz_next(p_device text default null, p_band text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := public.quiz_day(); p text := public.quiz_player(p_device); uid uuid := auth.uid(); r public.quiz_plays; q public.quiz_questions; n int; qid uuid; el numeric; inst text; bid uuid; binst text; cap_n int; b text;
begin
  if p is null then return jsonb_build_object('ok', false, 'error', 'NO_PLAYER'); end if;
  select x.band into b from public.quiz_plays x where x.day = d and x.player = p order by x.idx limit 1;     -- the band is fixed by the first question of the day
  if not found then b := public.quiz_band(p_band); end if;
  if public.quiz_ensure_day(d, b) is null then return jsonb_build_object('ok', false, 'error', 'NOT_READY', 'band', b); end if;
  loop
    select * into r from public.quiz_plays x where x.day = d and x.player = p and x.answered_at is null order by x.idx limit 1;
    exit when not found;
    el := extract(epoch from (now() - r.opened_at));
    if el <= 17 then
      select * into q from public.quiz_questions where id = r.qid;
      return jsonb_build_object('ok', true, 'idx', r.idx, 'total', 5, 'seconds', 15, 'band', b, 'remaining_ms', greatest(0, round((15 - el) * 1000))::int,
        'question', jsonb_build_object('id', q.id, 'topic', q.topic, 'text', q.question, 'options', q.options));
    end if;
    update public.quiz_plays set answered_at = now(), correct = false, points = 0, choice = null where day = d and player = p and idx = r.idx;   -- left open too long: a timeout
  end loop;
  select count(*)::int into n from public.quiz_plays where day = d and player = p;
  if n >= 5 then return jsonb_build_object('ok', true, 'finished', true, 'band', b); end if;
  qid := public.quiz_qid_at(d, n, b);
  if qid is null then return jsonb_build_object('ok', false, 'error', 'NOT_READY', 'band', b); end if;
  if uid is null and n = 0 then      -- a new guest today: counted; the 10,001st is refused (made-up device numbers could otherwise fill the small database)
    insert into public.quiz_anon_day as a (day, n) values (d, 1) on conflict (day) do update set n = a.n + 1 where a.n < 10000 returning a.n into cap_n;
    if cap_n is null then return jsonb_build_object('ok', false, 'error', 'GUEST_LIMIT'); end if;
  end if;
  if uid is not null then
    select mi.institution_slug into inst from public.member_institution mi where mi.user_id = uid;
    select bb.id, bb.institution_slug into bid, binst from public.batch_members m join public.batches bb on bb.id = m.batch_id where m.user_id = uid and bb.level = 'ssc' order by m.is_primary desc, m.joined_at limit 1;
    inst := coalesce(inst, binst);
  end if;
  insert into public.quiz_plays (day, player, user_id, inst_slug, batch_id, idx, qid, band) values (d, p, uid, inst, bid, n, qid, b) on conflict (day, player, idx) do nothing;
  select * into r from public.quiz_plays where day = d and player = p and idx = n;
  select * into q from public.quiz_questions where id = r.qid;
  el := extract(epoch from (now() - r.opened_at));
  return jsonb_build_object('ok', true, 'idx', r.idx, 'total', 5, 'seconds', 15, 'band', b, 'remaining_ms', greatest(0, round((15 - el) * 1000))::int,
    'question', jsonb_build_object('id', q.id, 'topic', q.topic, 'text', q.question, 'options', q.options));
end $$;

-- the boards of ONE band: scope 'institution' or 'batch', period 'today' or 'week'; only members, only counts, at least 3 players, the best 10 average; excluded batches left out
drop function if exists public.quiz_board(text, text, text, int);
create or replace function public.quiz_board(p_scope text default 'institution', p_period text default 'today', p_district text default null, p_limit int default 20, p_band text default 'c6-8') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date := public.quiz_day(); f date; lim int := greatest(1, least(coalesce(p_limit, 20), 50)); res jsonb; bb text := public.quiz_band(p_band);
begin
  f := case when p_period = 'week' then d - 6 else d end;
  if p_scope = 'batch' then
    with pl as (select user_id, (array_agg(batch_id order by day, idx))[1] as k, sum(points)::int as score from public.quiz_plays where band = bb and day between f and d and user_id is not null and answered_at is not null group by user_id),
         pr as (select k, score, row_number() over (partition by k order by score desc) rn, count(*) over (partition by k) n from pl where k is not null and k not in (select x.batch_id from public.league_excluded x)),
         g as (select k, max(n)::int as n, avg(score) as sc from pr where rn <= 10 group by k having max(n) >= 3)
    select coalesce(jsonb_agg(x.j order by x.sc desc, x.n desc, x.slug), '[]'::jsonb) into res from (
      select g.sc, g.n, b.institution_slug as slug, jsonb_build_object('rank', row_number() over (order by g.sc desc, g.n desc, b.institution_slug), 'id', b.id, 'slug', b.institution_slug, 'name', l.institution_name, 'district', l.district, 'year', b.exam_year, 'players', g.n, 'score', round(g.sc, 1)) as j
        from g join public.batches b on b.id = g.k join public.listing_submissions l on l.desired_slug = b.institution_slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false
       where p_district is null or l.district = p_district order by g.sc desc, g.n desc, b.institution_slug limit lim) x;
  else
    with pl as (select user_id, (array_agg(inst_slug order by day, idx))[1] as k, (array_agg(batch_id order by day, idx))[1] as bk, sum(points)::int as score from public.quiz_plays where band = bb and day between f and d and user_id is not null and answered_at is not null group by user_id),
         pr as (select k, score, row_number() over (partition by k order by score desc) rn, count(*) over (partition by k) n from pl where k is not null and (bk is null or bk not in (select x.batch_id from public.league_excluded x))),
         g as (select k, max(n)::int as n, avg(score) as sc from pr where rn <= 10 group by k having max(n) >= 3)
    select coalesce(jsonb_agg(x.j order by x.sc desc, x.n desc, x.slug), '[]'::jsonb) into res from (
      select g.sc, g.n, g.k as slug, jsonb_build_object('rank', row_number() over (order by g.sc desc, g.n desc, g.k), 'slug', g.k, 'name', l.institution_name, 'district', l.district, 'players', g.n, 'score', round(g.sc, 1)) as j
        from g join public.listing_submissions l on l.desired_slug = g.k and l.status = 'approved' and coalesce(l.is_hidden, false) = false
       where p_district is null or l.district = p_district order by g.sc desc, g.n desc, g.k limit lim) x;
  end if;
  return res;
end $$;

-- the admin: make the sets of the next days of ONE band ahead of time, and choose a day's set again (only while nobody has played that band that day)
drop function if exists public.quiz_reroll(date);
create or replace function public.quiz_plan(p_days int default 7, p_band text default 'c6-8') returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := public.quiz_day(); i int; ids uuid[]; out jsonb := '[]'::jsonb; b text := public.quiz_band(p_band);
begin
  if not coalesce(public.is_admin(), false) then raise exception 'NOT_ADMIN'; end if;
  for i in 0 .. greatest(1, least(coalesce(p_days, 7), 30)) - 1 loop
    ids := public.quiz_ensure_day(d + i, b);
    exit when ids is null;
    out := out || jsonb_build_object('day', d + i, 'band', b, 'qids', ids);
  end loop;
  return out;
end $$;
drop function if exists public.quiz_plan(int);
create or replace function public.quiz_reroll(p_day date, p_band text default 'c6-8') returns jsonb language plpgsql security definer set search_path = public as $$
declare ids uuid[]; b text := public.quiz_band(p_band);
begin
  if not coalesce(public.is_admin(), false) then raise exception 'NOT_ADMIN'; end if;
  if p_day < public.quiz_day() then return jsonb_build_object('ok', false, 'error', 'PAST'); end if;
  if exists (select 1 from public.quiz_plays where day = p_day and band = b) then return jsonb_build_object('ok', false, 'error', 'ALREADY_PLAYED'); end if;
  delete from public.quiz_daily where day = p_day and band = b;
  ids := public.quiz_pick('{}', b);
  if cardinality(ids) < 5 then return jsonb_build_object('ok', false, 'error', 'NOT_ENOUGH'); end if;
  insert into public.quiz_daily (day, band, qids, source) values (p_day, b, ids, 'admin');
  return jsonb_build_object('ok', true, 'band', b, 'qids', ids);
end $$;

-- one side of a duel on a day: the players of the 'c9-10' band (SSC batches), the batch they had at their first question, and the average of the best 10
create or replace function public.duel_side(p_batch uuid, p_day date) returns jsonb language sql stable security definer set search_path = public as $$
  with u as (
    select p.user_id, (array_agg(p.batch_id order by p.idx))[1] as b, sum(p.points)::int as score
      from public.quiz_plays p where p.day = p_day and p.band = 'c9-10' and p.user_id is not null and p.answered_at is not null group by p.user_id
  ), mine as (select score, row_number() over (order by score desc) as rn from u where b = p_batch)
  select jsonb_build_object('players', (select count(*)::int from mine), 'avg', coalesce((select round(avg(score), 1) from mine where rn <= 10), 0))
$$;

revoke all on function public.quiz_band(text) from public, anon, authenticated;
revoke all on function public.quiz_pick(uuid[], text) from public, anon, authenticated;
revoke all on function public.quiz_ensure_day(date, text) from public, anon, authenticated;
revoke all on function public.quiz_qid_at(date, int, text) from public, anon, authenticated;
revoke all on function public.quiz_plan(int, text) from public, anon;
revoke all on function public.quiz_reroll(date, text) from public, anon;
grant execute on function public.quiz_today(text, text) to anon, authenticated;
grant execute on function public.quiz_next(text, text) to anon, authenticated;
grant execute on function public.quiz_board(text, text, text, int, text) to anon, authenticated;
grant execute on function public.quiz_plan(int, text) to authenticated;
grant execute on function public.quiz_reroll(date, text) to authenticated;
