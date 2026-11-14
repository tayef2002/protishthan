-- মেমোরি কার্ড (/memory): a public counter of how many cards people have downloaded or shared.
-- A design counts ONCE per device: the same card downloaded again and again is one. A card that is edited (a new photo, new words, a new colour,
-- the photo moved) or a different card is another one, so the same phone making many different cards counts each.
-- The browser works out a short fingerprint of the design (no photo, no words are sent: only the fingerprint and a device id kept in the browser).
-- The table is closed to the browser; the site can only read the number and add through the two functions below.
-- A device that adds more than 40 new designs in a day stops adding to the public number (its cards still work).
-- Safe to run more than once.

create table if not exists public.memory_stats (
  id int primary key default 1 check (id = 1),
  downloads bigint not null default 0
);
insert into public.memory_stats (id, downloads) values (1, 0) on conflict (id) do nothing;
alter table public.memory_stats enable row level security;       -- no policies: the table itself is closed
revoke all on public.memory_stats from anon, authenticated;

create table if not exists public.memory_dl_keys (
  device text not null,                    -- the device id kept in the browser
  fp text not null,                        -- the fingerprint of the design
  created_at timestamptz not null default now(),
  primary key (device, fp)
);
create index if not exists memory_dl_keys_dev_idx on public.memory_dl_keys (device, created_at);
alter table public.memory_dl_keys enable row level security;     -- closed to the browser
revoke all on public.memory_dl_keys from anon, authenticated;

-- read the number
create or replace function public.memory_downloads()
returns bigint language sql stable security definer set search_path = public as $$
  select downloads from public.memory_stats where id = 1
$$;
revoke all on function public.memory_downloads() from public;
grant execute on function public.memory_downloads() to anon, authenticated;

-- count one design for one device (once), and return the number
create or replace function public.bump_memory_downloads(p_device text, p_fp text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  dev text := left(coalesce(trim(p_device), ''), 80);
  f text := left(coalesce(trim(p_fp), ''), 64);
  recent int := 0; ins int := 0;
begin
  if char_length(dev) < 8 or char_length(f) < 6 then return (select downloads from public.memory_stats where id = 1); end if;
  select count(*) into recent from public.memory_dl_keys where device = dev and created_at > now() - interval '1 day';
  insert into public.memory_dl_keys (device, fp) values (dev, f) on conflict do nothing;
  get diagnostics ins = row_count;
  if ins = 1 and recent < 40 then
    update public.memory_stats set downloads = downloads + 1 where id = 1;
  end if;
  return (select downloads from public.memory_stats where id = 1);
end $$;
revoke all on function public.bump_memory_downloads(text, text) from public;
grant execute on function public.bump_memory_downloads(text, text) to anon, authenticated;

-- check
select public.memory_downloads() as downloads, (select count(*) from public.memory_dl_keys) as designs;
