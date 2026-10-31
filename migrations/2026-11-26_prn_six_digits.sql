-- PRN = a RANDOM six-digit number (100000 – 999999), unique, for every institution.
-- Why: five digits hold only 90,000 numbers and the directory is already past that (100,000+ institutions are coming: schools, madrasas, colleges,
-- technical, primary, later universities / qawmi). Six digits hold 900,000, so it will not run out, and every PRN has the same length.
--  * every PRN already given (five digits) is replaced ONCE by a random six-digit one (it only runs while some PRN is still below 100000)
--  * new_prn() now draws from 100000–999999; imported institutions get theirs on insert, the admin "approve" button uses the same function
--  * the database itself refuses a repeated number (unique index); if all 900,000 are ever used it stops with an error, never repeats
-- Run after 2026-11-23. Safe to run more than once. The shuffle touches ~90,000 rows and can take up to a minute or two.

set statement_timeout = '10min';

-- 1) one-time shuffle. The unique rule is checked row by row, so everything first moves to a free range (+10,000,000), then gets its random number.
do $do$
begin
  if exists (select 1 from public.listing_submissions where prn_number is not null and prn_number < 100000) then
    update public.listing_submissions set prn_number = prn_number + 10000000 where prn_number is not null;
    with rows_ as (select id, row_number() over (order by random()) as rn from public.listing_submissions where prn_number is not null),
         pool as (select n, row_number() over (order by random()) as rn from generate_series(100000, 999999) as n)
    update public.listing_submissions l set prn_number = pool.n from rows_ join pool on pool.rn = rows_.rn where l.id = rows_.id;
  end if;
end $do$;

-- 2) a random unused six-digit number (one at a time, so two approvals / two import batches cannot pick the same one)
create or replace function public.new_prn()
returns integer language plpgsql security definer set search_path = public as $$
declare c integer; i integer := 0;
begin
  perform pg_advisory_xact_lock(7770001);
  loop
    c := 100000 + floor(random() * 900000)::integer;
    if not exists (select 1 from public.listing_submissions where prn_number = c) then return c; end if;
    i := i + 1;
    if i > 400 then
      -- almost full: take the smallest free number
      select g into c from generate_series(100000, 999999) g where not exists (select 1 from public.listing_submissions where prn_number = g) limit 1;
      if c is null then raise exception 'PRN_EXHAUSTED'; end if;
      return c;
    end if;
  end loop;
end $$;
revoke all on function public.new_prn() from public;

-- check
select count(*) as numbered, min(prn_number) as lowest, max(prn_number) as highest, count(distinct prn_number) as distinct_prn,
       count(*) filter (where prn_number between 100000 and 999999) as six_digit from public.listing_submissions where prn_number is not null;
