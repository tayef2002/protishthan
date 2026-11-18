-- NOTE: this file replaces league_board and league_batch of 2027-01-14_league.sql: if 2027-01-14 is ever run AGAIN after this file, run this file again after it.
-- প্রতিষ্ঠান লিগ, step 7: ব্যাচ ডুয়েল, the DAILY QUIZ of two batches against each other.
-- A member of a batch (at least 5 members) calls a duel for a day from tomorrow to 7 days ahead: against any batch ("open": the first batch that accepts) or a named one.
-- On that Bangladesh day the members of both batches play the ordinary daily quiz (/quiz); nothing new is played or stored for the duel. Each side is scored as the quiz boards score a batch:
-- the AVERAGE of the points of its best 10 players of that day (a big batch does not win by size), counting the players that answered at least one question with the batch they had when they started.
-- A duel counts when both sides have at least 3 players; the higher average wins, equal is a draw. Winner +50 league points, a draw +25 each (a loss 0), added to the league boards with the challenge points.
-- A batch has one duel a day, at most 3 waiting, a member calls one duel in 24 hours. The tables are closed; the public functions give counts only (no name of a player).
-- Needs 2027-01-11_daily_quiz.sql, 2027-01-12_batch_challenge.sql, 2027-01-13_rope_pull.sql, 2027-01-14_league.sql. Safe to run more than once.
create table if not exists public.batch_duels (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  day date not null,
  batch_a uuid not null references public.batches(id) on delete cascade,
  batch_b uuid references public.batches(id) on delete cascade,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (batch_b is null or batch_b <> batch_a)
);
create index if not exists batch_duels_day_idx on public.batch_duels (day);
create index if not exists batch_duels_a_idx on public.batch_duels (batch_a, day);
create index if not exists batch_duels_b_idx on public.batch_duels (batch_b, day) where batch_b is not null;
alter table public.batch_duels enable row level security;
revoke all on public.batch_duels from anon, authenticated;
grant select, insert, update, delete on public.batch_duels to authenticated;
drop policy if exists batch_duels_admin on public.batch_duels;
create policy batch_duels_admin on public.batch_duels for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- cancelled | open (nobody accepted yet, the day is ahead) | upcoming | live (today) | done | expired (nobody accepted before the day came)
create or replace function public.duel_status(d public.batch_duels) returns text language sql stable as $$
  select case when d.cancelled then 'cancelled'
              when d.day > public.quiz_day() then case when d.batch_b is null then 'open' else 'upcoming' end
              when d.batch_b is null then 'expired'
              when d.day = public.quiz_day() then 'live' else 'done' end
$$;
-- one side of a duel on a day: the players (members who answered at least one question, with the batch they had at their first question) and the average of the best 10
create or replace function public.duel_side(p_batch uuid, p_day date) returns jsonb language sql stable security definer set search_path = public as $$
  with u as (
    select p.user_id, (array_agg(p.batch_id order by p.idx))[1] as b, sum(p.points)::int as score
      from public.quiz_plays p where p.day = p_day and p.user_id is not null and p.answered_at is not null group by p.user_id
  ), mine as (select score, row_number() over (order by score desc) as rn from u where b = p_batch)
  select jsonb_build_object('players', (select count(*)::int from mine), 'avg', coalesce((select round(avg(score), 1) from mine where rn <= 10), 0))
$$;
create or replace function public.duel_busy(p_batch uuid, p_day date) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.batch_duels d where not d.cancelled and d.day = p_day and (d.batch_a = p_batch or d.batch_b = p_batch))
      or (select count(*) from public.batch_duels d where not d.cancelled and d.day > public.quiz_day() and (d.batch_a = p_batch or d.batch_b = p_batch)) >= 3
$$;

-- the public numbers of one duel (counts only)
create or replace function public.duel_state(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d public.batch_duels; st text; sa jsonb; sb jsonb; pa int; pb int; aa numeric; ab numeric; valid boolean; win text;
begin
  select * into d from public.batch_duels where id = p_id;
  if not found then return jsonb_build_object('found', false); end if;
  st := public.duel_status(d);
  sa := public.duel_side(d.batch_a, d.day); sb := case when d.batch_b is null then jsonb_build_object('players', 0, 'avg', 0) else public.duel_side(d.batch_b, d.day) end;
  pa := (sa ->> 'players')::int; pb := (sb ->> 'players')::int; aa := (sa ->> 'avg')::numeric; ab := (sb ->> 'avg')::numeric;
  valid := d.batch_b is not null and pa >= 3 and pb >= 3;
  win := case when st <> 'done' or not valid then null when aa > ab then 'a' when ab > aa then 'b' else 'draw' end;
  return jsonb_build_object('found', true, 'id', d.id, 'status', st, 'day', d.day, 'today', public.quiz_day(), 'server_now_ms', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'a', public.challenge_batch(d.batch_a), 'b', case when d.batch_b is null then null else public.challenge_batch(d.batch_b) end, 'open', d.batch_b is null,
    'players_a', pa, 'players_b', pb, 'avg_a', aa, 'avg_b', ab, 'lead', aa - ab, 'valid', valid, 'winner', win);
end $$;

-- call a duel: p_opp null = open to any batch
create or replace function public.duel_create(p_batch uuid, p_day date, p_opp uuid default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); new_id uuid; t date := public.quiz_day();
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if not public.challenge_is_member(p_batch) then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  if p_day is null or p_day < t + 1 or p_day > t + 7 then return jsonb_build_object('ok', false, 'error', 'BAD_DAY'); end if;
  if public.challenge_team_size(p_batch) < 5 then return jsonb_build_object('ok', false, 'error', 'BATCH_TOO_SMALL'); end if;
  if exists (select 1 from public.batch_duels x where x.created_by = uid and x.created_at > now() - interval '24 hours') then return jsonb_build_object('ok', false, 'error', 'LIMIT_USER'); end if;
  if public.duel_busy(p_batch, p_day) then return jsonb_build_object('ok', false, 'error', 'BUSY'); end if;
  if p_opp is not null then
    if p_opp = p_batch then return jsonb_build_object('ok', false, 'error', 'SAME_BATCH'); end if;
    if not exists (select 1 from public.batches b where b.id = p_opp) then return jsonb_build_object('ok', false, 'error', 'OPP_NOT_FOUND'); end if;
    if public.challenge_team_size(p_opp) < 5 then return jsonb_build_object('ok', false, 'error', 'OPP_TOO_SMALL'); end if;
    if public.duel_busy(p_opp, p_day) then return jsonb_build_object('ok', false, 'error', 'OPP_BUSY'); end if;
  end if;
  insert into public.batch_duels (created_by, day, batch_a, batch_b, accepted_at) values (uid, p_day, p_batch, p_opp, null) returning batch_duels.id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;
-- accept an OPEN duel for a batch of mine (the first one wins), until its day begins
create or replace function public.duel_accept(p_id uuid, p_batch uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.batch_duels; got uuid;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  select * into d from public.batch_duels where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if d.cancelled then return jsonb_build_object('ok', false, 'error', 'CANCELLED'); end if;
  if d.day <= public.quiz_day() then return jsonb_build_object('ok', false, 'error', 'TOO_LATE'); end if;
  if d.batch_b is not null then return jsonb_build_object('ok', false, 'error', 'ALREADY_TAKEN'); end if;
  if p_batch = d.batch_a then return jsonb_build_object('ok', false, 'error', 'SAME_BATCH'); end if;
  if not public.challenge_is_member(p_batch) then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  if public.challenge_team_size(p_batch) < 5 then return jsonb_build_object('ok', false, 'error', 'BATCH_TOO_SMALL'); end if;
  if public.duel_busy(p_batch, d.day) then return jsonb_build_object('ok', false, 'error', 'BUSY'); end if;
  update public.batch_duels set batch_b = p_batch, accepted_at = now() where id = p_id and batch_b is null and not cancelled and day > public.quiz_day() returning id into got;
  if got is null then return jsonb_build_object('ok', false, 'error', 'ALREADY_TAKEN'); end if;
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.duel_cancel(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.batch_duels;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  select * into d from public.batch_duels where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if d.created_by <> auth.uid() and not coalesce(public.is_admin(), false) then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  if d.day <= public.quiz_day() then return jsonb_build_object('ok', false, 'error', 'ALREADY_STARTED'); end if;
  update public.batch_duels set cancelled = true where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
-- "my side" of a duel for the signed-in caller: a member of A is side a, a member of B side b; the batches of mine that could accept an open duel
create or replace function public.duel_me(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d public.batch_duels; sd text; opts jsonb := '[]'::jsonb;
begin
  select * into d from public.batch_duels where id = p_id;
  if not found then return jsonb_build_object('found', false); end if;
  if auth.uid() is null then return jsonb_build_object('found', true, 'signed_in', false, 'member', false, 'side', null, 'creator', false, 'accept_batches', '[]'::jsonb); end if;
  sd := case when exists (select 1 from public.batch_members m where m.batch_id = d.batch_a and m.user_id = auth.uid()) then 'a'
             when d.batch_b is not null and exists (select 1 from public.batch_members m where m.batch_id = d.batch_b and m.user_id = auth.uid()) then 'b' end;
  if d.batch_b is null and not d.cancelled and d.day > public.quiz_day() then
    select coalesce(jsonb_agg(public.challenge_batch(b.id) || jsonb_build_object('members', public.challenge_team_size(b.id))), '[]'::jsonb) into opts
      from public.batch_members m join public.batches b on b.id = m.batch_id where m.user_id = auth.uid() and b.id <> d.batch_a and public.challenge_team_size(b.id) >= 5 and not public.duel_busy(b.id, d.day);
  end if;
  return jsonb_build_object('found', true, 'signed_in', true, 'member', sd is not null, 'side', sd, 'creator', d.created_by = auth.uid(), 'accept_batches', opts);
end $$;
-- the hub: duels that are open, coming, today or finished in the last 3 days
create or replace function public.duel_list(p_limit int default 30) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.s, x.c), '[]'::jsonb) from (
    select d.day as s, d.created_at as c, jsonb_build_object('id', d.id, 'status', public.duel_status(d), 'day', d.day, 'open', d.batch_b is null, 'a', public.challenge_batch(d.batch_a),
             'b', case when d.batch_b is null then null else public.challenge_batch(d.batch_b) end) as j
      from public.batch_duels d
     where not d.cancelled and d.day between public.quiz_day() - 3 and public.quiz_day() + 7 and not (d.batch_b is null and d.day <= public.quiz_day())
     order by d.day, d.created_at limit greatest(1, least(coalesce(p_limit, 30), 60))
  ) x
$$;
-- for the quiz page: the duels of the caller's batches that are today or tomorrow (a banner "your batch plays today")
create or replace function public.duel_mine() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.s), '[]'::jsonb) from (
    select d.day as s, jsonb_build_object('id', d.id, 'status', public.duel_status(d), 'day', d.day, 'hosting', exists (select 1 from public.batch_members m where m.batch_id = d.batch_a and m.user_id = auth.uid()),
             'a', public.challenge_batch(d.batch_a), 'b', case when d.batch_b is null then null else public.challenge_batch(d.batch_b) end) as j
      from public.batch_duels d
     where auth.uid() is not null and not d.cancelled and d.batch_b is not null and d.day between public.quiz_day() and public.quiz_day() + 1
       and exists (select 1 from public.batch_members m where m.user_id = auth.uid() and m.batch_id in (d.batch_a, d.batch_b))
     order by d.day limit 5
  ) x
$$;

-- the league points of finished duels (internal), and the league rows with the duels added: the league boards read this one
create or replace function public.duel_rows(p_since timestamptz) returns table (challenge_id uuid, batch_id uuid, pts int, won boolean, drew boolean, rope boolean)
language sql stable security definer set search_path = public as $$
  with f as (
    select d.id, d.batch_a, d.batch_b, public.duel_side(d.batch_a, d.day) as sa, public.duel_side(d.batch_b, d.day) as sb
      from public.batch_duels d
     where not d.cancelled and d.batch_b is not null and d.day < public.quiz_day() and d.day >= ((p_since at time zone 'utc') + interval '6 hours')::date
  ), r as (
    select f.*, (f.sa ->> 'players')::int as pa, (f.sb ->> 'players')::int as pb, (f.sa ->> 'avg')::numeric as aa, (f.sb ->> 'avg')::numeric as ab from f
  ), v as (select r.*, case when aa > ab then 'a' when ab > aa then 'b' else 'draw' end as res from r where pa >= 3 and pb >= 3)
  select v.id, v.batch_a, (case v.res when 'a' then 50 when 'draw' then 25 else 0 end)::int, v.res = 'a', v.res = 'draw', false from v
  union all
  select v.id, v.batch_b, (case v.res when 'b' then 50 when 'draw' then 25 else 0 end)::int, v.res = 'b', v.res = 'draw', false from v
$$;
create or replace function public.league_rows_all(p_since timestamptz) returns table (challenge_id uuid, batch_id uuid, pts int, won boolean, drew boolean, rope boolean)
language sql stable security definer set search_path = public as $$
  select * from public.league_rows(p_since) union all select * from public.duel_rows(p_since)
$$;

-- the boards and the batch summary of 2027-01-14_league.sql, now reading the rows with the duels
create or replace function public.league_board(p_scope text default 'institution', p_period text default 'week', p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := case when p_period = 'all' then '2000-01-01'::timestamptz else now() - interval '7 days' end; lim int := greatest(1, least(coalesce(p_limit, 20), 50)); res jsonb;
begin
  if p_scope = 'batch' then
    select coalesce(jsonb_agg(x.j order by x.pts desc, x.m desc, x.slug, x.yr), '[]'::jsonb) into res from (
      select g.pts, g.m, b.institution_slug as slug, b.exam_year as yr,
             jsonb_build_object('rank', row_number() over (order by g.pts desc, g.m desc, b.institution_slug, b.exam_year), 'id', b.id, 'slug', b.institution_slug, 'year', b.exam_year, 'name', l.institution_name, 'district', l.district,
                                'points', g.pts, 'matches', g.m, 'wins', g.w) as j
        from (select r.batch_id, sum(r.pts)::int as pts, count(*)::int as m, count(*) filter (where r.won)::int as w from public.league_rows_all(since) r group by r.batch_id having sum(r.pts) > 0) g
        join public.batches b on b.id = g.batch_id
        join public.listing_submissions l on l.desired_slug = b.institution_slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false
       order by g.pts desc, g.m desc, b.institution_slug, b.exam_year limit lim) x;
  else
    select coalesce(jsonb_agg(x.j order by x.pts desc, x.m desc, x.slug), '[]'::jsonb) into res from (
      select g.pts, g.m, g.slug,
             jsonb_build_object('rank', row_number() over (order by g.pts desc, g.m desc, g.slug), 'slug', g.slug, 'name', l.institution_name, 'district', l.district, 'points', g.pts, 'matches', g.m, 'wins', g.w, 'batches', g.nb) as j
        from (select b.institution_slug as slug, sum(r.pts)::int as pts, count(*)::int as m, count(*) filter (where r.won)::int as w, count(distinct r.batch_id)::int as nb
                from public.league_rows_all(since) r join public.batches b on b.id = r.batch_id group by b.institution_slug having sum(r.pts) > 0) g
        join public.listing_submissions l on l.desired_slug = g.slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false
       order by g.pts desc, g.m desc, g.slug limit lim) x;
  end if;
  return res;
end $$;

create or replace function public.league_batch(p_batch uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare wk record; al record; rk int := null; total int := null; items jsonb;
begin
  if not exists (select 1 from public.batches b where b.id = p_batch) then return null; end if;
  select coalesce(sum(r.pts), 0)::int as pts, count(*)::int as m, count(*) filter (where r.won)::int as w into wk from public.league_rows_all(now() - interval '7 days') r where r.batch_id = p_batch;
  select coalesce(sum(r.pts), 0)::int as pts, count(*)::int as m, count(*) filter (where r.won)::int as w into al from public.league_rows_all('2000-01-01'::timestamptz) r where r.batch_id = p_batch;
  if wk.pts > 0 then
    -- the rank is among the batches that can be shown (a hidden institution is not in the league)
    select 1 + count(*) filter (where o.pts > wk.pts)::int, count(*)::int into rk, total
      from (select r.batch_id, sum(r.pts) as pts from public.league_rows_all(now() - interval '7 days') r
              join public.batches b on b.id = r.batch_id join public.listing_submissions l on l.desired_slug = b.institution_slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false
             group by r.batch_id) o;
  end if;
  select coalesce(jsonb_agg(z.j order by z.s), '[]'::jsonb) into items from (
    select c.start_at as s, jsonb_build_object('id', c.id, 'status', public.challenge_status(c, now()), 'start_ms', (extract(epoch from c.start_at) * 1000)::bigint, 'mode', c.mode,
             'open', c.mode = 'rope' and c.opp_batch_id is null, 'hosting', c.batch_id = p_batch,
             'other', case when c.batch_id = p_batch then case when c.opp_batch_id is null then null else public.challenge_batch(c.opp_batch_id) end else public.challenge_batch(c.batch_id) end) as j
      from public.batch_challenges c
     where not c.cancelled and (c.batch_id = p_batch or c.opp_batch_id = p_batch)
       and c.start_at + make_interval(secs => c.slots * c.slot_s) > now() - interval '12 hours' and c.start_at < now() + interval '7 days'
     order by c.start_at limit 5) z;
  return jsonb_build_object('week_points', wk.pts, 'week_matches', wk.m, 'week_wins', wk.w, 'all_points', al.pts, 'all_matches', al.m, 'all_wins', al.w, 'week_rank', rk, 'week_total', total, 'members', public.challenge_team_size(p_batch), 'challenges', items);
end $$;

revoke all on function public.duel_status(public.batch_duels) from public, anon, authenticated;
revoke all on function public.duel_side(uuid, date) from public, anon, authenticated;
revoke all on function public.duel_busy(uuid, date) from public, anon, authenticated;
revoke all on function public.duel_rows(timestamptz) from public, anon, authenticated;
revoke all on function public.league_rows_all(timestamptz) from public, anon, authenticated;
revoke all on function public.duel_create(uuid, date, uuid) from public, anon;
revoke all on function public.duel_accept(uuid, uuid) from public, anon;
revoke all on function public.duel_cancel(uuid) from public, anon;
revoke all on function public.duel_mine() from public, anon;
grant execute on function public.duel_create(uuid, date, uuid) to authenticated;
grant execute on function public.duel_accept(uuid, uuid) to authenticated;
grant execute on function public.duel_cancel(uuid) to authenticated;
grant execute on function public.duel_mine() to authenticated;
grant execute on function public.duel_state(uuid) to anon, authenticated;
grant execute on function public.duel_me(uuid) to anon, authenticated;
grant execute on function public.duel_list(int) to anon, authenticated;
grant execute on function public.league_board(text, text, int) to anon, authenticated;
grant execute on function public.league_batch(uuid) to anon, authenticated;
