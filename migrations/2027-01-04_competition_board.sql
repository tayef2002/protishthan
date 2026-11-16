-- প্রতিযোগিতার বোর্ড (competition board), step 2: ONE read function for every board on the card page.
--   p_metric : 'card'   = শিক্ষিত কার্ড, everybody (counted once per device and institution, as the old board)
--              'memory' = মেমোরি কার্ড, signed-in members only (from member_actions)
--              'skill'  = স্কিল কার্ড, signed-in members only (from member_actions, counted when the member publishes the page)
--   p_period : 'all' = since the start,  'week' = new in the last 7 days (so a small school can win a week)
--   p_scope  : 'institution' = one row per institution,  'district' = one row per district,  'division' = one row per division (sums of their institutions)
--   p_division / p_district / p_type : optional filters (type = স্কুল / কলেজ / মাদ্রাসা / কোচিং সেন্টার, used by the institution scope)
-- Returns the institution (or area) key and name, the count n, the rank (ties share a rank, ties on the old board are broken by who was first), and for areas the number of institutions that have a count.
-- Public numbers only: no member, no device, no name of a person. Needs 2026-10-31_card_leaderboard.sql, 2027-01-03_member_actions.sql (bd_districts, member_actions). Safe to run more than once.

create index if not exists card_institute_people_created_idx on public.card_institute_people (created_at);

create or replace function public.competition_board(
  p_metric text default 'card', p_period text default 'all', p_scope text default 'institution',
  p_division text default null, p_district text default null, p_type text default null, p_limit int default 10)
returns table (key text, name text, district text, division text, upazila text, itype text, n bigint, rank bigint, inst_count bigint)
language plpgsql stable security definer set search_path = public as $$
declare lim int := greatest(1, least(coalesce(p_limit, 10), 50));
begin
  if coalesce(p_metric, 'card') not in ('card', 'memory', 'skill') or coalesce(p_period, 'all') not in ('all', 'week')
     or coalesce(p_scope, 'institution') not in ('institution', 'district', 'division') then
    return;
  end if;
  return query
  with base as (
    select c.slug, c.n::bigint as n, c.first_at as first_at
      from public.card_institute_counts c
     where coalesce(p_metric, 'card') = 'card' and coalesce(p_period, 'all') = 'all' and c.n > 0
    union all
    select p.slug, count(*)::bigint, min(p.created_at)
      from public.card_institute_people p
     where coalesce(p_metric, 'card') = 'card' and p_period = 'week' and p.created_at > now() - interval '7 days'
     group by p.slug
    union all
    select a.institution_slug, count(distinct a.user_id)::bigint, min(a.first_at)
      from public.member_actions a
     where p_metric in ('memory', 'skill') and a.action = p_metric and a.institution_slug <> ''
       and (coalesce(p_period, 'all') = 'all' or a.first_at > now() - interval '7 days')
     group by a.institution_slug
  ),
  rows as (
    select b.slug, l.institution_name as nm, l.district as dist, d.division as div, l.upazila as upz, l.institution_type as it, b.n, b.first_at
      from base b
      join public.listing_submissions l on l.desired_slug = b.slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false
      left join public.bd_districts d on d.district = l.district
     where (p_division is null or p_division = '' or d.division = p_division)
       and (p_district is null or p_district = '' or l.district = p_district)
       and (p_type is null or p_type = '' or l.institution_type = p_type)
  )
  select * from (
    select r.slug, r.nm, r.dist, r.div, r.upz, r.it, r.n,
           rank() over (order by r.n desc, r.first_at asc) as rk, 1::bigint as ic
      from rows r
     where coalesce(p_scope, 'institution') = 'institution'
    union all
    select r.dist, r.dist, r.dist, max(r.div), null::text, null::text, sum(r.n)::bigint,
           rank() over (order by sum(r.n) desc, r.dist), count(*)::bigint
      from rows r
     where p_scope = 'district' and r.dist is not null
     group by r.dist
    union all
    select r.div, r.div, null::text, r.div, null::text, null::text, sum(r.n)::bigint,
           rank() over (order by sum(r.n) desc, r.div), count(*)::bigint
      from rows r
     where p_scope = 'division' and r.div is not null
     group by r.div
  ) q
  order by q.rk, q.nm
  limit lim;
end $$;
revoke all on function public.competition_board(text, text, text, text, text, text, int) from public;
grant execute on function public.competition_board(text, text, text, text, text, text, int) to anon, authenticated;

-- check
select * from public.competition_board('card', 'all', 'division', null, null, null, 8);
select * from public.competition_board('card', 'week', 'institution', null, null, null, 5);
