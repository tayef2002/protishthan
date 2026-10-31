-- PRN = always five digits (10000 – 99999), unique. The numbers given in 2026-11-22 (1 … 24594) move up by 10000 (10001 …), so none starts with zeros
-- and every PRN looks the same length. The shared sequence now only hands out 10000–99999 (it stops with an error if that ever runs out, never repeats).
-- Run after 2026-11-22. Safe to run more than once (it only runs while some number is still below 10000).

-- every number moves up by 10000. The unique rule is checked row by row, so a direct "+ 10000" would bump into numbers that already exist (e.g. 1 -> 10001 while 10001 is
-- still taken): all numbers first go to a free range (+100000), then come back as (old + 10000).
do $do$
begin
  if exists (select 1 from public.listing_submissions where prn_number is not null and prn_number < 10000) then
    update public.listing_submissions set prn_number = prn_number + 100000 where prn_number is not null;
    update public.listing_submissions set prn_number = prn_number - 90000 where prn_number >= 100000;
  end if;
end $do$;

alter sequence public.prn_seq minvalue 10000 maxvalue 99999;
select setval('public.prn_seq', greatest((select coalesce(max(prn_number), 0) from public.listing_submissions), 10000), (select count(*) > 0 from public.listing_submissions where prn_number is not null));

-- check
select count(*) as numbered, min(prn_number) as first_prn, max(prn_number) as last_prn, count(distinct prn_number) as distinct_prn,
       count(*) filter (where prn_number between 10000 and 99999) as five_digit from public.listing_submissions where prn_number is not null;
