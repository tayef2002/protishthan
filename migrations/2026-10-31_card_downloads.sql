-- শিক্ষিত কার্ড: a live counter of how many people have downloaded their card.
-- One row, no direct table access for anyone: the site can only (a) read the number and (b) add one,
-- both through the two functions below. Safe to run more than once.

create table if not exists public.card_stats (
  id int primary key default 1 check (id = 1),
  downloads bigint not null default 0
);
insert into public.card_stats (id, downloads) values (1, 0) on conflict (id) do nothing;

alter table public.card_stats enable row level security;       -- no policies: the table itself is closed
revoke all on public.card_stats from anon, authenticated;

-- read the current number
create or replace function public.card_downloads()
returns bigint language sql stable security definer set search_path = public as $$
  select downloads from public.card_stats where id = 1
$$;

-- add one download and return the new number
create or replace function public.bump_card_downloads()
returns bigint language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  update public.card_stats set downloads = downloads + 1 where id = 1 returning downloads into n;
  return n;
end $$;

revoke all on function public.card_downloads() from public;
revoke all on function public.bump_card_downloads() from public;
grant execute on function public.card_downloads() to anon, authenticated;
grant execute on function public.bump_card_downloads() to anon, authenticated;

-- check
select public.card_downloads() as downloads;
