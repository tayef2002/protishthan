-- কার্ড পেজে "এই কার্ডের পুরো গল্প" কতজন পড়েছেন: প্রতি ডিভাইসে একবার গোনা হয় (গল্পটা ৪ সেকেন্ড পর্দায় থাকলে)।
-- How many people have read the story on the card page: one per device (the story was on screen for 4 seconds). Safe to run more than once.

create table if not exists public.card_story_reads (
  device text primary key,
  first_at timestamptz not null default now()
);
alter table public.card_story_reads enable row level security;       -- no policy: only the two functions below touch it

create table if not exists public.card_story_stats (
  id int primary key,
  reads bigint not null default 0
);
alter table public.card_story_stats enable row level security;
insert into public.card_story_stats (id, reads) values (1, 0) on conflict (id) do nothing;

-- the number (read only)
create or replace function public.card_story_reads_total()
returns bigint language sql stable security definer set search_path = public as $$
  select reads from public.card_story_stats where id = 1
$$;

-- count this device once and return the number
create or replace function public.card_story_read(p_device text)
returns bigint language plpgsql security definer set search_path = public as $$
declare dev text := left(coalesce(trim(p_device), ''), 80);
begin
  if char_length(dev) >= 8 then
    insert into public.card_story_reads (device) values (dev) on conflict do nothing;
    if found then update public.card_story_stats set reads = reads + 1 where id = 1; end if;
  end if;
  return (select reads from public.card_story_stats where id = 1);
end $$;

revoke all on function public.card_story_reads_total() from public;
revoke all on function public.card_story_read(text) from public;
grant execute on function public.card_story_reads_total() to anon, authenticated;
grant execute on function public.card_story_read(text) to anon, authenticated;

-- check: 0 right after the first run
select public.card_story_reads_total() as story_reads;
