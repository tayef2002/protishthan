-- SEO: the lists that the sitemaps and the area pages (/area/...) are built from.
-- Run once in the Supabase SQL editor of the MAIN project (eoqeeuujvpydhmfteqqj). Safe to run more than once.
--
--   seo_sitemap_pages(size)   how many sitemap files the institution list needs (size = width of the PRN number range per file; the website uses 40,000, about 4,500 pages)
--   seo_sitemap_slugs(page)   the address names (desired_slug) of one file, taken by PRN number range so it is fast and stable
--   seo_area_counts           a small table: how many institutions of each kind in each district + upazila (about 2,000 rows)
--   refresh_seo_area_counts() rebuilds that table from listing_submissions. Run it after every big import (it takes a few seconds).
--   seo_area_rows()           what the website reads: the table above as one JSON list
-- Everything here is public information that the directory already shows.

-- 1) sitemap helpers --------------------------------------------------------------------------------------------------------------
create or replace function public.seo_sitemap_pages(p_size int default 5000)
returns int language sql stable set search_path = public as $$
  select coalesce(((max(prn_number) - min(prn_number)) / greatest(p_size, 1)) + 1, 0)::int
  from public.listing_submissions where prn_number is not null;
$$;

create or replace function public.seo_sitemap_slugs(p_page int, p_size int default 5000)
returns text language sql stable set search_path = public as $$
  with b as (select min(prn_number) as m from public.listing_submissions where prn_number is not null)
  select coalesce(string_agg(l.desired_slug, E'\n' order by l.prn_number), '')
  from public.listing_submissions l, b
  where l.prn_number >= b.m + (greatest(p_page, 1) - 1) * greatest(p_size, 1)
    and l.prn_number <  b.m + greatest(p_page, 1) * greatest(p_size, 1)
    and l.status = 'approved' and coalesce(l.is_hidden, false) = false
    and l.desired_slug is not null and l.desired_slug <> '';
$$;

-- 2) area numbers -----------------------------------------------------------------------------------------------------------------
create table if not exists public.seo_area_counts (
  district text not null,
  upazila  text not null default '',
  type     text not null,
  n        int  not null,
  primary key (district, upazila, type)
);
alter table public.seo_area_counts enable row level security;      -- nobody reads the table directly; the website reads through seo_area_rows()

create or replace function public.refresh_seo_area_counts()
returns int language plpgsql security definer set search_path = public set statement_timeout = '120s' as $$
declare rows_n int;
begin
  delete from public.seo_area_counts;
  insert into public.seo_area_counts (district, upazila, type, n)
  select district, coalesce(upazila, ''), institution_type, count(*)::int
  from public.listing_submissions
  where status = 'approved' and coalesce(is_hidden, false) = false
    and district is not null and district <> '' and institution_type is not null and institution_type <> ''
  group by 1, 2, 3;
  get diagnostics rows_n = row_count;
  return rows_n;
end $$;
revoke all on function public.refresh_seo_area_counts() from public, anon, authenticated;

create or replace function public.seo_area_rows()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('district', district, 'upazila', upazila, 'type', type, 'n', n) order by district, upazila, type), '[]'::json)
  from public.seo_area_counts;
$$;

grant execute on function public.seo_sitemap_pages(int), public.seo_sitemap_slugs(int, int), public.seo_area_rows() to anon, authenticated;

-- fill it now
select public.refresh_seo_area_counts() as rows_written;

-- check (each should answer in well under a second)
select public.seo_sitemap_pages(5000) as sitemap_files;
select length(public.seo_sitemap_slugs(1, 5000)) > 0 as first_file_has_pages;
select count(*) as area_rows, sum(n) as institutions from public.seo_area_counts;
