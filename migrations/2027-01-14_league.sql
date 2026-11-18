-- প্রতিষ্ঠান লিগ, step 5: the league boards of the live ব্যাচ চ্যালেঞ্জ, and what a batch page shows about its own challenges.
-- Needs 2027-01-12_batch_challenge.sql and 2027-01-13_rope_pull.sql. Safe to run more than once. Nothing here writes: it only reads the finished challenges.
--  * A finished challenge gives each side the points that its result screen shows: the right answers of its players, +50 for the target (clock) or the win (rope; +25 each for a draw).
--  * For the LEAGUE a side counts only if at least 5 of its members played that challenge (so a batch cannot farm points with two friends), and a rope match counts as a match only when BOTH sides had 5.
--    A challenge nobody took (open rope) counts for its host as a clock game without bonus.
--  * Boards: by batch or by institution (the sum of its batches), this week (the last 7 days, by start time) or all time. Counts only: no person, no name of a player. Hidden institutions are left out.
create or replace function public.league_rows(p_since timestamptz) returns table (challenge_id uuid, batch_id uuid, pts int, won boolean, drew boolean, rope boolean)
language sql stable security definer set search_path = public as $$
  with fin as (
    select c.* from public.batch_challenges c
     where not c.cancelled and c.qids is not null and c.start_at >= p_since and c.start_at + make_interval(secs => c.slots * c.slot_s) <= now()
  ), side as (
    select f.id as cid, f.mode, f.target, f.batch_id as host, f.opp_batch_id as opp, p.batch_id as b,
           count(distinct p.user_id)::int as pl,
           count(a.slot) filter (where a.correct)::int as ok
      from fin f join public.challenge_players p on p.challenge_id = f.id
      left join public.challenge_answers a on a.challenge_id = p.challenge_id and a.user_id = p.user_id
     group by f.id, f.mode, f.target, f.batch_id, f.opp_batch_id, p.batch_id
  ), pair as (
    select s.cid, s.mode, s.target, s.b, s.pl, s.ok, s.host, s.opp,
           (select x.pl from side x where x.cid = s.cid and x.b = s.host) as pl_a, (select x.ok from side x where x.cid = s.cid and x.b = s.host) as ok_a,
           (select x.pl from side x where x.cid = s.cid and x.b = s.opp)  as pl_b, (select x.ok from side x where x.cid = s.cid and x.b = s.opp)  as ok_b
      from side s
  )
  select q.cid, q.b,
         (q.ok + case when q.mode = 'clock' then (case when q.ok >= q.target then 50 else 0 end)
                      when q.valid then (case when q.res = 'draw' then 25 when q.res = q.who then 50 else 0 end) else 0 end)::int,
         q.mode = 'rope' and q.valid and q.res = q.who,
         q.mode = 'rope' and q.valid and q.res = 'draw',
         q.mode = 'rope' and q.valid
    from (
      select pr.*, case when pr.b = pr.host then 'a' else 'b' end as who,
             (pr.opp is not null and coalesce(pr.pl_a, 0) >= 5 and coalesce(pr.pl_b, 0) >= 5) as valid,
             case when coalesce(pr.pl_a, 0) = 0 or coalesce(pr.pl_b, 0) = 0 then null
                  when pr.ok_a::numeric / pr.pl_a > pr.ok_b::numeric / pr.pl_b then 'a' when pr.ok_b::numeric / pr.pl_b > pr.ok_a::numeric / pr.pl_a then 'b' else 'draw' end as res
        from pair pr
    ) q
   where q.pl >= 5
$$;

-- the board: p_scope 'batch' | 'institution', p_period 'week' | 'all'
create or replace function public.league_board(p_scope text default 'institution', p_period text default 'week', p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := case when p_period = 'all' then '2000-01-01'::timestamptz else now() - interval '7 days' end; lim int := greatest(1, least(coalesce(p_limit, 20), 50)); res jsonb;
begin
  if p_scope = 'batch' then
    select coalesce(jsonb_agg(x.j order by x.pts desc, x.m desc, x.slug, x.yr), '[]'::jsonb) into res from (
      select g.pts, g.m, b.institution_slug as slug, b.exam_year as yr,
             jsonb_build_object('rank', row_number() over (order by g.pts desc, g.m desc, b.institution_slug, b.exam_year), 'id', b.id, 'slug', b.institution_slug, 'year', b.exam_year, 'name', l.institution_name, 'district', l.district,
                                'points', g.pts, 'matches', g.m, 'wins', g.w) as j
        from (select r.batch_id, sum(r.pts)::int as pts, count(*)::int as m, count(*) filter (where r.won)::int as w from public.league_rows(since) r group by r.batch_id having sum(r.pts) > 0) g
        join public.batches b on b.id = g.batch_id
        join public.listing_submissions l on l.desired_slug = b.institution_slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false
       order by g.pts desc, g.m desc, b.institution_slug, b.exam_year limit lim) x;
  else
    select coalesce(jsonb_agg(x.j order by x.pts desc, x.m desc, x.slug), '[]'::jsonb) into res from (
      select g.pts, g.m, g.slug,
             jsonb_build_object('rank', row_number() over (order by g.pts desc, g.m desc, g.slug), 'slug', g.slug, 'name', l.institution_name, 'district', l.district, 'points', g.pts, 'matches', g.m, 'wins', g.w, 'batches', g.nb) as j
        from (select b.institution_slug as slug, sum(r.pts)::int as pts, count(*)::int as m, count(*) filter (where r.won)::int as w, count(distinct r.batch_id)::int as nb
                from public.league_rows(since) r join public.batches b on b.id = r.batch_id group by b.institution_slug having sum(r.pts) > 0) g
        join public.listing_submissions l on l.desired_slug = g.slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false
       order by g.pts desc, g.m desc, g.slug limit lim) x;
  end if;
  return res;
end $$;

-- one batch: its league numbers and its challenges that are coming, live or just over (for the banner on the batch page). Public, counts only.
create or replace function public.league_batch(p_batch uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare wk record; al record; rk int := null; total int := null; items jsonb;
begin
  if not exists (select 1 from public.batches b where b.id = p_batch) then return null; end if;
  select coalesce(sum(r.pts), 0)::int as pts, count(*)::int as m, count(*) filter (where r.won)::int as w into wk from public.league_rows(now() - interval '7 days') r where r.batch_id = p_batch;
  select coalesce(sum(r.pts), 0)::int as pts, count(*)::int as m, count(*) filter (where r.won)::int as w into al from public.league_rows('2000-01-01'::timestamptz) r where r.batch_id = p_batch;
  if wk.pts > 0 then
    -- the rank is among the batches that can be shown (a hidden institution is not in the league)
    select 1 + count(*) filter (where o.pts > wk.pts)::int, count(*)::int into rk, total
      from (select r.batch_id, sum(r.pts) as pts from public.league_rows(now() - interval '7 days') r
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

revoke all on function public.league_rows(timestamptz) from public, anon, authenticated;
revoke all on function public.league_board(text, text, int) from public, anon;
revoke all on function public.league_batch(uuid) from public, anon;
grant execute on function public.league_board(text, text, int) to anon, authenticated;
grant execute on function public.league_batch(uuid) to anon, authenticated;
