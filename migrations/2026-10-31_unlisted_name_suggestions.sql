-- Names of institutions that people type on the শিক্ষিত কার্ড but that are not in the directory yet.
-- Visitors who are logged out cannot save to a profile, so their names are collected here and show up in the
-- admin panel ("নাম-অনুরোধ"), most requested first. Only the name and a count are kept: no user, no photo.
-- One device counts once per name. Safe to run more than once.

create table if not exists public.unlisted_name_suggestions (
  key text primary key,                                   -- lower-cased, spaces collapsed
  name text not null,                                     -- as first typed
  n int not null default 1,                               -- how many different devices typed it
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'added', 'ignored'))
);
create table if not exists public.unlisted_name_devices (
  device text not null check (char_length(device) between 8 and 64),
  key text not null,
  created_at timestamptz not null default now(),
  primary key (device, key)
);
alter table public.unlisted_name_suggestions enable row level security;
alter table public.unlisted_name_devices enable row level security;
revoke all on public.unlisted_name_suggestions from anon, authenticated;
revoke all on public.unlisted_name_devices from anon, authenticated;
grant select on public.unlisted_name_suggestions to authenticated;
grant update (status) on public.unlisted_name_suggestions to authenticated;
grant delete on public.unlisted_name_suggestions to authenticated;
drop policy if exists uns_admin_read on public.unlisted_name_suggestions;
drop policy if exists uns_admin_update on public.unlisted_name_suggestions;
drop policy if exists uns_admin_delete on public.unlisted_name_suggestions;
create policy uns_admin_read on public.unlisted_name_suggestions for select to authenticated using (public.is_admin());
create policy uns_admin_update on public.unlisted_name_suggestions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy uns_admin_delete on public.unlisted_name_suggestions for delete to authenticated using (public.is_admin());

-- called from the card page (logged in or not) after someone stops typing an institution name
create or replace function public.suggest_unlisted_institution(p_device text, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare nm text; k text; recent int; ins int;
begin
  if p_device is null or char_length(p_device) < 8 or char_length(p_device) > 64 then return; end if;
  nm := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if char_length(nm) < 4 or char_length(nm) > 120 then return; end if;
  k := lower(nm);
  -- already in the directory (or waiting for approval): nothing to suggest
  if exists (select 1 from public.listing_submissions l where lower(l.institution_name) = k and l.status in ('approved', 'pending')) then return; end if;
  -- one device cannot flood the list
  select count(*) into recent from public.unlisted_name_devices where device = p_device and created_at > now() - interval '1 day';
  if recent >= 10 then return; end if;
  insert into public.unlisted_name_devices (device, key) values (p_device, k) on conflict do nothing;
  get diagnostics ins = row_count;
  if ins = 0 then return; end if;                         -- this device already told us this name
  insert into public.unlisted_name_suggestions (key, name) values (k, nm)
    on conflict (key) do update set n = public.unlisted_name_suggestions.n + 1, last_at = now();
end $$;
revoke all on function public.suggest_unlisted_institution(text, text) from public;
grant execute on function public.suggest_unlisted_institution(text, text) to anon, authenticated;

-- check
select count(*) as suggestions from public.unlisted_name_suggestions;
