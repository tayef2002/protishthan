-- স্কিল আইডেন্টিটি: a live counter of how many skill certificates / images people have downloaded.
-- Same pattern as the card counter: one row, closed table, two functions (read the number, add one). Safe to run more than once.

create table if not exists public.skill_stats (
  id int primary key default 1 check (id = 1),
  downloads bigint not null default 0
);
insert into public.skill_stats (id, downloads) values (1, 0) on conflict (id) do nothing;

alter table public.skill_stats enable row level security;       -- no policies: the table itself is closed
revoke all on public.skill_stats from anon, authenticated;

create or replace function public.skill_downloads()
returns bigint language sql stable security definer set search_path = public as $$
  select downloads from public.skill_stats where id = 1
$$;

create or replace function public.bump_skill_downloads()
returns bigint language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  update public.skill_stats set downloads = downloads + 1 where id = 1 returning downloads into n;
  return n;
end $$;

revoke all on function public.skill_downloads() from public;
revoke all on function public.bump_skill_downloads() from public;
grant execute on function public.skill_downloads() to anon, authenticated;
grant execute on function public.bump_skill_downloads() to anon, authenticated;

-- check
select public.skill_downloads() as downloads;
