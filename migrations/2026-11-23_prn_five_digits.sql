-- PRN = a RANDOM five-digit number (10000 – 99999), unique for every institution. Nobody can tell how many institutions exist or guess the next one.
--  * the numbers given in 2026-11-22 (1, 2, 3 … in order) are replaced by random ones, once (it only runs while some number is still below 10000)
--  * new_prn() picks a random number that is not used yet; imported institutions get one on insert, and the admin "approve" button (next_prn_number) uses it too
--  * the database itself refuses a repeated number (unique index); if all 90,000 numbers are ever used, it stops with an error, never repeats
-- Run after 2026-11-22. Safe to run more than once.

-- 1) one-time shuffle. The unique rule is checked row by row, so everything first moves to a free range (+100000), then gets its random number.
do $do$
begin
  if exists (select 1 from public.listing_submissions where prn_number is not null and prn_number < 10000) then
    update public.listing_submissions set prn_number = prn_number + 100000 where prn_number is not null;
    with rows_ as (select id, row_number() over (order by random()) as rn from public.listing_submissions where prn_number is not null),
         pool as (select n, row_number() over (order by random()) as rn from generate_series(10000, 99999) as n)
    update public.listing_submissions l set prn_number = pool.n from rows_ join pool on pool.rn = rows_.rn where l.id = rows_.id;
  end if;
end $do$;

-- 2) a random unused five-digit number (one at a time, so two approvals cannot pick the same one)
create or replace function public.new_prn()
returns integer language plpgsql security definer set search_path = public as $$
declare c integer; i integer := 0;
begin
  perform pg_advisory_xact_lock(7770001);
  loop
    c := 10000 + floor(random() * 90000)::integer;
    if not exists (select 1 from public.listing_submissions where prn_number = c) then return c; end if;
    i := i + 1;
    if i > 400 then
      -- almost full: take the smallest free number
      select g into c from generate_series(10000, 99999) g where not exists (select 1 from public.listing_submissions where prn_number = g) limit 1;
      if c is null then raise exception 'PRN_EXHAUSTED'; end if;
      return c;
    end if;
  end loop;
end $$;
revoke all on function public.new_prn() from public;

create or replace function public.listing_set_prn()
returns trigger language plpgsql as $$
begin
  if new.source is not null and new.prn_number is null then new.prn_number := public.new_prn(); end if;
  return new;
end $$;

create or replace function public.next_prn_number()
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  return public.new_prn();
end $$;
revoke all on function public.next_prn_number() from public;
grant execute on function public.next_prn_number() to authenticated;

-- check
select count(*) as numbered, min(prn_number) as lowest, max(prn_number) as highest, count(distinct prn_number) as distinct_prn,
       count(*) filter (where prn_number between 10000 and 99999) as five_digit from public.listing_submissions where prn_number is not null;
select institution_name, prn_number from public.listing_submissions where prn_number is not null order by id limit 5;
