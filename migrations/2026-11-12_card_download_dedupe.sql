-- শিক্ষিত কার্ড: a download counts once per person per name.
-- One person downloading the same card again and again (logged in or out, same account or same phone) is ONE download.
-- A different name on the same phone or account is another download, because someone may be making cards for friends.
-- Run 2026-11-10_directory_scale.sql first (it has bn_key). Safe to run more than once.

create table if not exists public.card_dl_keys (
  kind text not null check (kind in ('device', 'user')),
  owner text not null,                     -- the device id (kept in the browser) or the account id
  name_key text not null,                  -- the card's name, in a forgiving form (bn_key)
  created_at timestamptz not null default now(),
  primary key (kind, owner, name_key)
);
create index if not exists card_dl_keys_owner_idx on public.card_dl_keys (kind, owner, created_at);
alter table public.card_dl_keys enable row level security;       -- no policies: closed to the browser
revoke all on public.card_dl_keys from anon, authenticated;

-- the new counter: counts only when neither this device nor this account has already made a card with this name.
-- A device that adds more than 10 new names in a day stops adding to the public number (it still gets its card).
create or replace function public.bump_card_downloads(p_device text, p_name text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  n bigint; nk text := public.bn_key(p_name); dev text := left(coalesce(trim(p_device), ''), 80); uid uuid := auth.uid();
  dev_seen boolean := false; usr_seen boolean := false; recent int := 0;
begin
  if char_length(nk) < 2 then return (select downloads from public.card_stats where id = 1); end if;
  if dev <> '' then
    dev_seen := exists (select 1 from public.card_dl_keys where kind = 'device' and owner = dev and name_key = nk);
    select count(*) into recent from public.card_dl_keys where kind = 'device' and owner = dev and created_at > now() - interval '1 day';
  end if;
  if uid is not null then
    usr_seen := exists (select 1 from public.card_dl_keys where kind = 'user' and owner = uid::text and name_key = nk);
  end if;
  if dev <> '' then insert into public.card_dl_keys (kind, owner, name_key) values ('device', dev, nk) on conflict do nothing; end if;
  if uid is not null then insert into public.card_dl_keys (kind, owner, name_key) values ('user', uid::text, nk) on conflict do nothing; end if;
  if not dev_seen and not usr_seen and recent < 10 and (dev <> '' or uid is not null) then
    update public.card_stats set downloads = downloads + 1 where id = 1 returning downloads into n;
  end if;
  return coalesce(n, (select downloads from public.card_stats where id = 1));
end $$;
revoke all on function public.bump_card_downloads(text, text) from public;
grant execute on function public.bump_card_downloads(text, text) to anon, authenticated;

-- the old, argument-less version (pages opened before this change still call it): it no longer adds, it only reads
create or replace function public.bump_card_downloads()
returns bigint language sql stable security definer set search_path = public as $$
  select downloads from public.card_stats where id = 1
$$;
revoke all on function public.bump_card_downloads() from public;
grant execute on function public.bump_card_downloads() to anon, authenticated;

-- check
select public.card_downloads() as downloads, (select count(*) from public.card_dl_keys) as keys;
