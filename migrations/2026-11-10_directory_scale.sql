-- ডিরেক্টরি বড় করার ভিত্তি: the directory is about to grow from a handful to tens of thousands of institutions.
-- 1) columns for imported data: where it came from, and whether a person has checked it ("যাচাই হয়নি")
-- 2) a forgiving Bangla search key (same idea as bnname.js: ি/ী, ু/ূ, ণ/ন, শ/ষ/স, য়/য, hasanta ignored) + a trigram index
-- 3) directory_search(): server-side search, so the pages no longer have to download every institution
-- Safe to run more than once. Existing rows keep verification = 'verified' (they were all approved by an admin).

create extension if not exists pg_trgm;

alter table public.listing_submissions
  add column if not exists name_en text,
  add column if not exists source text,            -- e.g. 'banbeis', 'ugc', 'madrasa-board'
  add column if not exists source_url text,
  add column if not exists source_id text,         -- e.g. the EIIN, so the same institution is never imported twice
  add column if not exists collected_at timestamptz,
  add column if not exists search_key text;

alter table public.listing_submissions
  add column if not exists verification text not null default 'verified';
alter table public.listing_submissions drop constraint if exists listing_submissions_verification_chk;
alter table public.listing_submissions
  add constraint listing_submissions_verification_chk check (verification in ('verified', 'unverified'));

create unique index if not exists listing_submissions_source_uidx on public.listing_submissions (source, source_id) where source is not null;

-- the search key
create or replace function public.bn_key(t text)
returns text language sql immutable as $$
  select lower(regexp_replace(
    translate(
      replace(replace(replace(replace(replace(replace(replace(replace(
        normalize(coalesce(t, ''), NFC),
        E'ড়', 'র'), E'ঢ়', 'র'), E'য়', 'য'),      -- ড় ঢ় য় typed as two keys
        E'ো', E'ো'), E'ৌ', E'ৌ'),                  -- ে+া = ো , ে+ৗ = ৌ
        E'‌', ''), E'‍', ''), E'়', ''),                            -- joiners, stray nukta
      'ীূঈঊণষশৎ০১২৩৪৫৬৭৮৯0123456789', 'িুইউনসসত০১২৩৪৫৬৭৮৯০১২৩৪৫৬৭৮৯'),
    E'[্ঁংঃ\\s.,''"()\\-/]', '', 'g'));
$$;

create or replace function public.listing_set_search_key()
returns trigger language plpgsql as $$
begin
  new.search_key := public.bn_key(new.institution_name);
  return new;
end $$;

drop trigger if exists listing_search_key on public.listing_submissions;
create trigger listing_search_key before insert or update of institution_name on public.listing_submissions
  for each row execute function public.listing_set_search_key();

update public.listing_submissions set search_key = public.bn_key(institution_name) where search_key is distinct from public.bn_key(institution_name);

create index if not exists listing_submissions_search_trgm on public.listing_submissions using gin (search_key gin_trgm_ops);

-- server-side search: only approved, visible rows; best matches (starts with the text) first
create or replace function public.directory_search(p_q text, p_limit int default 8)
returns table (institution_name text, institution_type text, district text, upazila text, desired_slug text, verification text)
language sql stable security definer set search_path = public as $$
  with k as (select public.bn_key(p_q) as q)
  select l.institution_name, l.institution_type, l.district, l.upazila, l.desired_slug, l.verification
  from public.listing_submissions l, k
  where char_length(k.q) >= 2
    and l.status = 'approved' and coalesce(l.is_hidden, false) = false
    and l.search_key like '%' || k.q || '%'
  order by (l.search_key like k.q || '%') desc, char_length(l.search_key), l.institution_name
  limit least(greatest(coalesce(p_limit, 8), 1), 20)
$$;
revoke all on function public.directory_search(text, int) from public;
grant execute on function public.directory_search(text, int) to anon, authenticated;

-- check
select count(*) as rows, count(search_key) as with_key, count(*) filter (where verification = 'verified') as verified from public.listing_submissions;
select * from public.directory_search('মাদরাসা', 3);
