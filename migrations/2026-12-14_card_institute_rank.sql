-- শিক্ষিত কার্ড: "the Nth card holder of my institution".
-- Every person (device) counted for a listed institution gets a FIXED number there: 1 for the first, 2 for the next, and so on.
-- The number never changes, however many times the same person downloads again or in which size.
-- Builds on 2026-10-31_card_leaderboard.sql (needs it first). Only numbers and a random device id are kept, no names, no photos.
-- Safe to run more than once. Until it is run, the card page simply shows no number (it falls back to the old counting call).

alter table public.card_institute_people add column if not exists seq bigint;

-- 1) numbers for the people already counted: in the order they were counted
with o as (
  select device, slug, row_number() over (partition by slug order by created_at, device) as rn
    from public.card_institute_people
)
update public.card_institute_people p set seq = o.rn
  from o where p.device = o.device and p.slug = o.slug and p.seq is null;

-- 2) the per-institution counter must never be below the highest number given, so the next person cannot get a number already used
update public.card_institute_counts c
   set n = greatest(c.n, x.m)
  from (select slug, max(seq) as m from public.card_institute_people group by slug) x
 where x.slug = c.slug;

-- 3) the old counting call (still used by pages that were opened before this change) now gives numbers too.
--    The counter row is the ticket machine: updating it hands out the next number, and concurrent people queue on that row.
--    One call per device at a time (advisory lock), so the same person pressing twice cannot be counted twice.
create or replace function public.count_card_institutes(p_device text, p_slugs text[])
returns int language plpgsql security definer set search_path = public as $$
declare s text; added int := 0; have int; newn bigint;
begin
  if p_device is null or char_length(p_device) < 8 or char_length(p_device) > 64 then return 0; end if;
  perform pg_advisory_xact_lock(hashtext(p_device));
  select count(*) into have from public.card_institute_people where device = p_device;
  for s in select distinct x from unnest(coalesce(p_slugs, '{}'::text[])) x limit 6 loop
    exit when have + added >= 6;                                           -- one device cannot count for more than six institutions
    continue when s is null or char_length(s) > 120;
    continue when not exists (select 1 from public.listing_submissions l where l.desired_slug = s and l.status = 'approved' and coalesce(l.is_hidden, false) = false);
    continue when exists (select 1 from public.card_institute_people q where q.device = p_device and q.slug = s);   -- already counted: keeps its number
    insert into public.card_institute_counts (slug, n) values (s, 1)
      on conflict (slug) do update set n = public.card_institute_counts.n + 1
      returning n into newn;
    insert into public.card_institute_people (device, slug, seq) values (p_device, s, newn);
    added := added + 1;
  end loop;
  return added;
end $$;

-- 4) what the card page calls: counts this person for the listed institutions on the card (once each) and returns this person's numbers
create or replace function public.card_claim_ranks(p_device text, p_slugs text[])
returns table (slug text, name text, seq bigint)
language plpgsql security definer set search_path = public as $$
begin
  perform public.count_card_institutes(p_device, p_slugs);
  return query
    select p.slug, l.institution_name, p.seq
      from public.card_institute_people p
      join public.listing_submissions l on l.desired_slug = p.slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false
     where p.device = p_device and p.seq is not null and p.slug = any (coalesce(p_slugs, '{}'::text[]))
     order by p.seq asc
     limit 6;
end $$;

revoke all on function public.count_card_institutes(text, text[]) from public;
revoke all on function public.card_claim_ranks(text, text[]) from public;
grant execute on function public.count_card_institutes(text, text[]) to anon, authenticated;
grant execute on function public.card_claim_ranks(text, text[]) to anon, authenticated;

-- check: the first people of the most counted institutions (numbers must be 1, 2, 3 ... with no repeats)
select slug, count(*) as people, min(seq) as first_no, max(seq) as last_no, count(distinct seq) as distinct_nos
  from public.card_institute_people group by slug order by people desc limit 10;

-- OPTIONAL, only BEFORE real people hold numbers (e.g. to remove your own test downloads), then close the gaps:
--   delete from public.card_institute_people where device in ('<your test device ids>');
--   with o as (select device, slug, row_number() over (partition by slug order by created_at, device) as rn from public.card_institute_people)
--   update public.card_institute_people p set seq = o.rn from o where p.device = o.device and p.slug = o.slug;
--   update public.card_institute_counts c set n = coalesce((select max(seq) from public.card_institute_people q where q.slug = c.slug), 0);
-- After people have seen their numbers, do not renumber: cards already saved would show a different number than the server.
