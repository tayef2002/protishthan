-- আমার ব্যাচ: the standing of a batch's institution on the শিক্ষিত কার্ড board, for the batch page ("প্রতিষ্ঠানের অগ্রগতি").
-- Read only and public data only (institution-level numbers that the leaderboard already shows). No names, no photos.
-- Needs 2026-10-31_card_leaderboard.sql (card_institute_counts, card_institute_people, listing_submissions). Safe to run more than once.
-- Until it is run, the batch page falls back to the plain total (card_institute_count) and hides rank, district and the gap.

create or replace function public.card_institute_standing(p_slug text)
returns table (n bigint, country_rank bigint, country_total bigint, district text, district_rank bigint, district_total bigint, ahead_n bigint, week_n bigint)
language sql stable security definer set search_path = public as $$
  with live as (       -- every institution that has at least one card and is still listed
    select c.slug, c.n, c.first_at, l.district
      from public.card_institute_counts c
      join public.listing_submissions l on l.desired_slug = c.slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false
     where c.n > 0
  ),
  mine as (select * from live where slug = p_slug),
  dist as (select district from public.listing_submissions where desired_slug = p_slug and status = 'approved' and coalesce(is_hidden, false) = false limit 1)
  select coalesce((select m.n from mine m), (select c.n from public.card_institute_counts c where c.slug = p_slug), 0)::bigint,
         (select 1 + count(*) from live x, mine m where x.n > m.n or (x.n = m.n and x.first_at < m.first_at)),
         (select count(*) from live),
         (select d.district from dist d),
         (select 1 + count(*) from live x, mine m where x.district = m.district and (x.n > m.n or (x.n = m.n and x.first_at < m.first_at))),
         (select count(*) from live x, mine m where x.district = m.district),
         -- the card count of the institution just above this one (the nearest one that is ahead)
         (select min(x.n) from live x, mine m where x.n > m.n or (x.n = m.n and x.first_at < m.first_at)),
         (select count(*) from public.card_institute_people p where p.slug = p_slug and p.created_at > now() - interval '7 days')
$$;

revoke all on function public.card_institute_standing(text) from public;
grant execute on function public.card_institute_standing(text) to anon, authenticated;

-- check
select * from public.card_institute_standing('dhaka-college');
