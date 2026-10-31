-- দুই ভাষায় নাম: an institution keeps its English name (name_en) and its Bangla name (institution_name).
-- Imported institutions often have only an English name from the official source: then institution_name temporarily holds that
-- English name (so every page keeps working) and needs_bn_name = true. When someone adds the Bangla name, it replaces
-- institution_name and the English one stays in name_en. Search works in both languages.
-- Run after 2026-11-10, -11, -13. Safe to run more than once.

-- 1) a flag that is true exactly while the main name still has English letters (Partners' to-do list: "বাংলা নাম বাকি")
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'listing_submissions' and column_name = 'needs_bn_name') then
    alter table public.listing_submissions add column needs_bn_name boolean generated always as (institution_name ~ '[A-Za-z]') stored;
  end if;
end $$;
create index if not exists listing_submissions_needs_bn_idx on public.listing_submissions (district, upazila) where needs_bn_name;

-- 2) search in both languages
alter table public.listing_submissions add column if not exists search_key_en text;

create or replace function public.listing_set_search_key()
returns trigger language plpgsql as $$
begin
  new.search_key := public.bn_key(new.institution_name);
  new.search_key_en := nullif(public.bn_key(new.name_en), '');
  return new;
end $$;
drop trigger if exists listing_search_key on public.listing_submissions;
create trigger listing_search_key before insert or update of institution_name, name_en on public.listing_submissions
  for each row execute function public.listing_set_search_key();

update public.listing_submissions set search_key = public.bn_key(institution_name), search_key_en = nullif(public.bn_key(name_en), '')
  where search_key is distinct from public.bn_key(institution_name) or search_key_en is distinct from nullif(public.bn_key(name_en), '');
create index if not exists listing_submissions_search_en_trgm on public.listing_submissions using gin (search_key_en gin_trgm_ops);

drop function if exists public.directory_search(text, int);
create or replace function public.directory_search(p_q text, p_limit int default 8)
returns table (institution_name text, institution_type text, district text, upazila text, desired_slug text, verification text, name_en text)
language sql stable security definer set search_path = public as $$
  with k as (select public.bn_key(p_q) as q)
  select l.institution_name, l.institution_type, l.district, l.upazila, l.desired_slug, l.verification, l.name_en
  from public.listing_submissions l, k
  where char_length(k.q) >= 2
    and l.status = 'approved' and coalesce(l.is_hidden, false) = false
    and (l.search_key like '%' || k.q || '%' or l.search_key_en like '%' || k.q || '%')
  order by (l.search_key like k.q || '%' or l.search_key_en like k.q || '%') desc, char_length(l.search_key), l.institution_name
  limit least(greatest(coalesce(p_limit, 8), 1), 20)
$$;
revoke all on function public.directory_search(text, int) from public;
grant execute on function public.directory_search(text, int) to anon, authenticated;

-- the duplicate check looks at both names too
create or replace function public.directory_check(p_name text, p_district text, p_upazila text default null)
returns table (match_level text, institution_name text, institution_type text, district text, upazila text,
               desired_slug text, status text, verification text)
language sql stable security definer set search_path = public as $$
  with k as (select public.bn_key(p_name) as q)
  select case when coalesce(trim(p_upazila), '') <> '' and coalesce(trim(l.upazila), '') = trim(p_upazila) then 'same_upazila' else 'same_district' end,
         l.institution_name, l.institution_type, l.district, l.upazila,
         case when l.status = 'approved' then l.desired_slug end,
         l.status, l.verification
  from public.listing_submissions l, k
  where char_length(k.q) >= 2
    and (l.search_key = k.q or l.search_key_en = k.q)
    and trim(l.district) = trim(p_district)
    and l.status in ('pending', 'approved') and coalesce(l.is_hidden, false) = false
  order by (coalesce(trim(p_upazila), '') <> '' and coalesce(trim(l.upazila), '') = trim(p_upazila)) desc, l.institution_name
  limit 5
$$;
revoke all on function public.directory_check(text, text, text) from public;
grant execute on function public.directory_check(text, text, text) to anon, authenticated;

-- 3) adding the Bangla name: the English one moves to name_en, the Bangla one becomes the main name.
--    Allowed for an admin, the Partner the listing is assigned to, or the institution that owns it.
create or replace function public.set_bangla_name(p_listing uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare nm text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')); l public.listing_submissions; ok boolean;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  if char_length(nm) < 3 or nm ~ '[A-Za-z]' then raise exception 'BAD_NAME'; end if;
  select * into l from public.listing_submissions where id = p_listing;
  if not found then raise exception 'NOT_FOUND'; end if;
  ok := public.is_admin()
     or l.assigned_agent_id in (select a.id from public.agents a where a.user_id = auth.uid())
     or l.institution_id in (select i.id from public.institutions i where lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
  if not ok then raise exception 'NOT_ALLOWED'; end if;
  if exists (
    select 1 from public.listing_submissions x
    where x.id <> l.id and x.search_key = public.bn_key(nm) and trim(x.district) = trim(l.district)
      and coalesce(trim(x.upazila), '') = coalesce(trim(l.upazila), '')
      and x.status in ('pending', 'approved') and coalesce(x.is_hidden, false) = false
  ) then raise exception 'DUPLICATE_INSTITUTION'; end if;
  update public.listing_submissions
     set name_en = coalesce(nullif(name_en, ''), case when institution_name ~ '[A-Za-z]' then institution_name end),
         institution_name = nm
   where id = p_listing;
end $$;
revoke all on function public.set_bangla_name(uuid, text) from public;
grant execute on function public.set_bangla_name(uuid, text) to authenticated;

-- check
select count(*) as rows, count(*) filter (where needs_bn_name) as english_only, count(name_en) as with_english_name from public.listing_submissions;
select * from public.directory_search('school', 3);
