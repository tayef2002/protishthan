-- Admin-controlled promo popup for the home page (and room for sponsor placements later).
-- Anyone can read the promo only while it is switched on and inside its schedule;
-- only admins can read drafts or change anything. Run 2026-10-26_admin_users.sql first (is_admin()).
-- Safe to run more than once.

create table if not exists public.site_promos (
  slot text primary key check (slot in ('home_popup')),
  active boolean not null default false,
  audience text not null default 'all' check (audience in ('all', 'guests', 'members')),
  badge text check (badge is null or char_length(badge) <= 30),
  title text not null check (char_length(title) between 1 and 90),
  body text check (body is null or char_length(body) <= 500),
  cta_label text check (cta_label is null or char_length(cta_label) <= 40),
  cta_url text check (cta_url is null or cta_url ~ '^(https://[^[:space:]]+|/[^[:space:]]*|[a-z0-9_./?=&#-]+\.html([?#][^[:space:]]*)?)$'),
  image_url text check (image_url is null or image_url ~ '^https://[^[:space:]]+$'),
  sponsored boolean not null default false,
  sponsor_name text check (sponsor_name is null or char_length(sponsor_name) <= 60),
  delay_seconds int not null default 8 check (delay_seconds between 0 and 120),
  frequency_days int not null default 3 check (frequency_days between 0 and 365),
  starts_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.site_promos_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists site_promos_touch on public.site_promos;
create trigger site_promos_touch before insert or update on public.site_promos
for each row execute function public.site_promos_touch();

alter table public.site_promos enable row level security;

drop policy if exists site_promos_public_read on public.site_promos;
create policy site_promos_public_read on public.site_promos for select to anon, authenticated
  using (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

drop policy if exists site_promos_admin_all on public.site_promos;
create policy site_promos_admin_all on public.site_promos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.site_promos to anon, authenticated;
grant insert, update, delete on public.site_promos to authenticated;   -- narrowed to admins by the policy above

-- a switched-off starter draft, so the admin screen opens with something to edit
insert into public.site_promos (slot, active, title, body, badge, cta_label, cta_url)
values ('home_popup', false, 'আপনার প্রতিষ্ঠান কি তালিকায় আছে?', 'মাত্র ২ মিনিটে বিনামূল্যে যুক্ত করুন। অভিভাবক ও শিক্ষার্থীরা সরাসরি আপনার প্রতিষ্ঠানের পাতা খুঁজে পাবেন।', 'বিনামূল্যে', 'তালিকাভুক্ত করুন', 'list-institution.html')
on conflict (slot) do nothing;

-- check: one draft row, switched off
select slot, active, title from public.site_promos;
