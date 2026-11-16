-- আমার ব্যাচ, প্রতিযোগিতা ধাপ ৩: how many members of a batch made a card, and how the batch stands among the other batches of the same institution.
--   COUNTS ONLY. Never who did, never who did not. Only batches with at least 5 members are counted or listed (a smaller batch could be read person by person).
--   Only a member of the batch (or an admin) can ask; the answer is the member's own batch plus the other batches (>= 5 members) of the same institution and level.
--   "Made a card" = a signed-in member's logged action (member_actions: card, memory, skill; 2027-01-03). Members who made cards before the log existed, or without signing in, are not counted.
--   Rank = by the number of members who did at least one of the three (more first), then by the size of the batch; ties share a rank.
-- Needs 2026-12-26_batches.sql, 2026-12-27_batch_name.sql (batches.name), 2026-10-26_admin_users.sql (is_admin), 2027-01-03_member_actions.sql. Safe to run more than once.

create or replace function public.batch_activity(p_batch_id uuid)
returns table (batch_id uuid, exam_year int, name text, members bigint, made_card bigint, made_memory bigint, made_skill bigint, made_any bigint, new_week bigint, rank bigint, batch_count bigint, is_mine boolean)
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); b record;
begin
  if uid is null or p_batch_id is null then return; end if;
  select x.institution_slug, x.level into b from public.batches x where x.id = p_batch_id;
  if not found then return; end if;
  if not (exists (select 1 from public.batch_members m where m.batch_id = p_batch_id and m.user_id = uid) or public.is_admin()) then return; end if;
  return query
  with sib as (
    select x.id, x.exam_year, x.name
      from public.batches x
     where x.institution_slug = b.institution_slug and x.level = b.level
  ),
  mem as (                                   -- only batches with at least 5 members take part
    select m.batch_id, count(*) as n
      from public.batch_members m join sib on sib.id = m.batch_id
     group by m.batch_id
    having count(*) >= 5
  ),
  act as (                                   -- one row per member + action in these batches
    select bm.batch_id, a.user_id, a.action, min(a.first_at) as first_at
      from public.batch_members bm
      join mem on mem.batch_id = bm.batch_id
      join public.member_actions a on a.user_id = bm.user_id
     group by bm.batch_id, a.user_id, a.action
  ),
  agg as (
    select mem.batch_id, mem.n,
           count(distinct a.user_id) filter (where a.action = 'card') as c,
           count(distinct a.user_id) filter (where a.action = 'memory') as mm,
           count(distinct a.user_id) filter (where a.action = 'skill') as s,
           count(distinct a.user_id) as anyn,
           count(distinct a.user_id) filter (where a.first_at > now() - interval '7 days') as wk
      from mem left join act a on a.batch_id = mem.batch_id
     group by mem.batch_id, mem.n
  )
  select agg.batch_id, sib.exam_year, sib.name, agg.n, agg.c, agg.mm, agg.s, agg.anyn, agg.wk,
         rank() over (order by agg.anyn desc, agg.n desc), count(*) over (), agg.batch_id = p_batch_id
    from agg join sib on sib.id = agg.batch_id
   order by 10, sib.exam_year desc;
end $$;
revoke all on function public.batch_activity(uuid) from public;
grant execute on function public.batch_activity(uuid) to authenticated;
