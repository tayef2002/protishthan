-- PRN = always five digits (10000 – 99999), unique. The numbers given in 2026-11-22 (1 … 24594) move up by 10000 (10001 …), so none starts with zeros
-- and every PRN looks the same length. The shared sequence now only hands out 10000–99999 (it stops with an error if that ever runs out, never repeats).
-- Run after 2026-11-22. Safe to run more than once (only numbers below 10000 are moved).

update public.listing_submissions set prn_number = prn_number + 10000 where prn_number is not null and prn_number < 10000;

alter sequence public.prn_seq minvalue 10000 maxvalue 99999;
select setval('public.prn_seq', greatest((select coalesce(max(prn_number), 0) from public.listing_submissions), 10000), (select count(*) > 0 from public.listing_submissions where prn_number is not null));

-- check
select count(*) as numbered, min(prn_number) as first_prn, max(prn_number) as last_prn, count(distinct prn_number) as distinct_prn,
       count(*) filter (where prn_number between 10000 and 99999) as five_digit from public.listing_submissions where prn_number is not null;
