-- শিক্ষিত কার্ড: institution leaderboard. Each person counts ONCE per listed institution, however many levels
-- they studied there (PSC .. masters). Only institutions that are in the directory (approved listings) count.
-- Only numbers are kept (a random device id + the institution), no names, no photos. Run after
-- 2026-10-31_card_downloads.sql is not required (independent). Safe to run more than once.

create table if not exists public.card_institute_counts (
  slug text primary key,
  n bigint not null default 0,
  first_at timestamptz not null default now()
);
create table if not exists public.card_institute_people (
  device text not null check (char_length(device) between 8 and 64),
  slug text not null,
  created_at timestamptz not null default now(),
  primary key (device, slug)
);
alter table public.card_institute_counts enable row level security;      -- no policies: closed to everyone
alter table public.card_institute_people enable row level security;
revoke all on public.card_institute_counts from anon, authenticated;
revoke all on public.card_institute_people from anon, authenticated;

-- called when someone downloads a card: the institutions on it, each counted once per person
create or replace function public.count_card_institutes(p_device text, p_slugs text[])
returns int language plpgsql security definer set search_path = public as $$
declare s text; added int := 0; have int; ins int;
begin
  if p_device is null or char_length(p_device) < 8 or char_length(p_device) > 64 then return 0; end if;
  select count(*) into have from public.card_institute_people where device = p_device;
  for s in select distinct x from unnest(coalesce(p_slugs, '{}'::text[])) x limit 6 loop
    exit when have + added >= 6;                                           -- one device cannot count for more than six institutions
    continue when s is null or char_length(s) > 120;
    continue when not exists (select 1 from public.listing_submissions l where l.desired_slug = s and l.status = 'approved' and coalesce(l.is_hidden, false) = false);
    insert into public.card_institute_people (device, slug) values (p_device, s) on conflict do nothing;
    get diagnostics ins = row_count;
    if ins > 0 then
      insert into public.card_institute_counts (slug, n) values (s, 1) on conflict (slug) do update set n = public.card_institute_counts.n + 1;
      added := added + 1;
    end if;
  end loop;
  return added;
end $$;

-- top institutions, optionally for one district and/or one type (স্কুল / কলেজ / মাদ্রাসা / কোচিং সেন্টার)
create or replace function public.card_leaderboard(p_limit int default 10, p_district text default null, p_type text default null)
returns table (slug text, name text, district text, upazila text, itype text, n bigint, rank bigint)
language sql stable security definer set search_path = public as $$
  select c.slug, l.institution_name, l.district, l.upazila, l.institution_type, c.n,
         rank() over (order by c.n desc, c.first_at asc) as rank
    from public.card_institute_counts c
    join public.listing_submissions l on l.desired_slug = c.slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false
   where c.n > 0
     and (p_district is null or p_district = '' or l.district = p_district)
     and (p_type is null or p_type = '' or l.institution_type = p_type)
   order by c.n desc, c.first_at asc
   limit greatest(1, least(coalesce(p_limit, 10), 50))
$$;

-- find an institution by name and see its count and country rank
create or replace function public.card_institute_find(p_q text)
returns table (slug text, name text, district text, upazila text, itype text, n bigint, rank bigint)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select c.slug, c.n, rank() over (order by c.n desc, c.first_at asc) as rank
      from public.card_institute_counts c where c.n > 0
  )
  select l.desired_slug, l.institution_name, l.district, l.upazila, l.institution_type, coalesce(r.n, 0), r.rank
    from public.listing_submissions l
    left join ranked r on r.slug = l.desired_slug
   where l.status = 'approved' and coalesce(l.is_hidden, false) = false
     and char_length(coalesce(p_q, '')) >= 2
     and lower(l.institution_name) like '%' || lower(p_q) || '%'
   order by coalesce(r.n, 0) desc, l.institution_name
   limit 6
$$;

-- one institution's count (for the form and for the institution's own page)
create or replace function public.card_institute_count(p_slug text)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce((select n from public.card_institute_counts where slug = p_slug), 0)
$$;

revoke all on function public.count_card_institutes(text, text[]) from public;
revoke all on function public.card_leaderboard(int, text, text) from public;
revoke all on function public.card_institute_find(text) from public;
revoke all on function public.card_institute_count(text) from public;
grant execute on function public.count_card_institutes(text, text[]) to anon, authenticated;
grant execute on function public.card_leaderboard(int, text, text) to anon, authenticated;
grant execute on function public.card_institute_find(text) to anon, authenticated;
grant execute on function public.card_institute_count(text) to anon, authenticated;

-- check
select * from public.card_leaderboard(10, null, null);
