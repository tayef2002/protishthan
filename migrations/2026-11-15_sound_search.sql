-- ভাষা পেরিয়ে সার্চ: a "sound key" that is the same for the Bangla and the English spelling of a name
-- ("ঢাকা কলেজ" and "Dhaka College" both become tkC), so a visitor who searches in Bangla still finds an institution that is
-- listed in English, and the other way round. It is a best guess: exact matches are always shown first, sound matches are
-- labelled "সম্ভাব্য মিল". Also: a table where visitors suggest the Bangla name of an English-listed institution.
-- Run after 2026-11-14_name_languages.sql. Safe to run more than once.

-- 1) the sound key (identical to the JavaScript version used for testing)
create or replace function public.phon_key(t text)
returns text language plpgsql immutable as $fn$
declare s text;
begin
  s := lower(normalize(coalesce(t, ''), NFC));
  -- joiners; ড় ঢ় typed as two keys become র; য় vanishes; ে+া = ো
  s := regexp_replace(s, E'[\u200B-\u200D]', '', 'g');
  s := replace(replace(s, E'\u09A1\u09BC', E'\u09B0'), E'\u09A2\u09BC', E'\u09B0');
  s := replace(s, E'\u09AF\u09BC', '');
  s := replace(s, E'\u09C7\u09BE', E'\u09CB');
  -- words that translate each other become one upper-case token
  s := regexp_replace(s, E'government|govt\\.?|\u09B8\u09B0\u0995\u09BE\u09B0\u09BF|\u09B8\u09B0\u0995\u09BE\u09B0\u09C0', ' G ', 'g');
  s := regexp_replace(s, E'primary|\u09AA\u09CD\u09B0\u09BE\u09A5\u09AE\u09BF\u0995', ' P ', 'g');
  s := regexp_replace(s, E'high|\u0989\u099A\u09CD\u099A|\u09B9\u09BE\u0987', ' H ', 'g');
  s := regexp_replace(s, E'\u09AC\u09BF\u09B6\u09CD\u09AC\u09AC\u09BF\u09A6\u09CD\u09AF\u09BE\u09B2|university', ' U ', 'g');
  s := regexp_replace(s, E'school|\u09B8\u09CD\u0995\u09C1\u09B2|\u09AC\u09BF\u09A6\u09CD\u09AF\u09BE\u09B2', ' S ', 'g');
  s := regexp_replace(s, E'college|\u0995\u09B2\u09C7\u099C', ' C ', 'g');
  s := regexp_replace(s, E'madrasah|madrasha|madrasa|madrassa|madrassah|\u09AE\u09BE\u09A6\u09CD\u09B0\u09BE\u09B8\u09BE|\u09AE\u09BE\u09A6\u09B0\u09BE\u09B8\u09BE', ' M ', 'g');
  s := regexp_replace(s, E'girls?|\u09AC\u09BE\u09B2\u09BF\u0995\u09BE', ' L ', 'g');
  s := regexp_replace(s, E'boys?|\u09AC\u09BE\u09B2\u0995', ' B ', 'g');
  s := regexp_replace(s, E'model|\u09AE\u09A1\u09C7\u09B2', ' O ', 'g');
  s := regexp_replace(s, E'ideal|\u0986\u0987\u09A1\u09BF\u09AF\u09BC\u09BE\u09B2', ' I ', 'g');
  s := regexp_replace(s, E'academy|\u098F\u0995\u09BE\u09A1\u09C7\u09AE\u09BF|\u098F\u0995\u09BE\u09A1\u09C7\u09AE\u09C0', ' A ', 'g');
  s := regexp_replace(s, E'institute|\u0987\u09A8\u09B8\u09CD\u099F\u09BF\u099F\u09BF\u0989\u099F', ' N ', 'g');
  s := regexp_replace(s, E'technical|\u0995\u09BE\u09B0\u09BF\u0997\u09B0\u09BF', ' T ', 'g');
  s := regexp_replace(s, E'dakhil|\u09A6\u09BE\u0996\u09BF\u09B2', ' D ', 'g');
  s := regexp_replace(s, E'alim|\u0986\u09B2\u09BF\u09AE', ' E ', 'g');
  s := regexp_replace(s, E'fazil|\u09AB\u09BE\u099C\u09BF\u09B2', ' F ', 'g');
  s := regexp_replace(s, E'kamil|\u0995\u09BE\u09AE\u09BF\u09B2', ' K ', 'g');
  s := regexp_replace(s, E'\\yand\\y|&', ' ', 'g');
  -- English spelling -> sound classes
  s := replace(s, 'dge', 'j'); s := replace(s, 'ph', 'p'); s := replace(s, 'sh', 's'); s := replace(s, 'ch', 'j');
  s := replace(s, 'th', 't'); s := replace(s, 'dh', 't'); s := replace(s, 'bh', 'b'); s := replace(s, 'kh', 'k');
  s := replace(s, 'gh', 'k'); s := replace(s, 'ck', 'k'); s := replace(s, 'qu', 'k'); s := replace(s, 'x', 'ks');
  s := regexp_replace(s, 'g(?=[eiy])', 'j', 'g'); s := regexp_replace(s, 'c(?=[eiy])', 's', 'g');
  s := translate(s, 'cqgzdvf', 'kkkjtbp');
  s := regexp_replace(s, '[aeiouyhw]', '', 'g');
  -- Bangla letters -> the same classes; other Bangla signs vanish
  s := translate(s, E'\u09C3\u098B\u0995\u0996\u0997\u0998\u099A\u099B\u099C\u099D\u09AF\u099F\u09A0\u09A1\u09A2\u09A4\u09A5\u09A6\u09A7\u09CE\u09A8\u09A3\u0999\u099E\u0982\u09AA\u09AB\u09AC\u09AD\u09AE\u09B0\u09B2\u09B6\u09B7\u09B8', 'rrkkkkjjjjjtttttttttnnnnnppbbmrlsss');
  s := regexp_replace(s, E'[\u0980-\u09FF]', '', 'g');
  s := regexp_replace(s, '[^A-Za-z0-9]', '', 'g');
  return regexp_replace(s, '(.)\1+', '\1', 'g');
end $fn$;
grant execute on function public.phon_key(text) to anon, authenticated;

-- 2) stored keys + indexes
alter table public.listing_submissions add column if not exists phon_key text, add column if not exists phon_key_en text;

create or replace function public.listing_set_search_key()
returns trigger language plpgsql as $$
begin
  new.search_key := public.bn_key(new.institution_name);
  new.search_key_en := nullif(public.bn_key(new.name_en), '');
  new.phon_key := public.phon_key(new.institution_name);
  new.phon_key_en := nullif(public.phon_key(new.name_en), '');
  return new;
end $$;
drop trigger if exists listing_search_key on public.listing_submissions;
create trigger listing_search_key before insert or update of institution_name, name_en on public.listing_submissions
  for each row execute function public.listing_set_search_key();

update public.listing_submissions set phon_key = public.phon_key(institution_name), phon_key_en = nullif(public.phon_key(name_en), '')
  where phon_key is distinct from public.phon_key(institution_name) or phon_key_en is distinct from nullif(public.phon_key(name_en), '');
create index if not exists listing_submissions_phon_trgm on public.listing_submissions using gin (phon_key gin_trgm_ops);
create index if not exists listing_submissions_phon_en_trgm on public.listing_submissions using gin (phon_key_en gin_trgm_ops);

-- 3) search: exact spelling first, then same sound (labelled match_kind = 'sound')
drop function if exists public.directory_search(text, int);
create or replace function public.directory_search(p_q text, p_limit int default 8)
returns table (id uuid, institution_name text, institution_type text, district text, upazila text, desired_slug text,
               verification text, name_en text, match_kind text)
language sql stable security definer set search_path = public as $$
  with k as (select public.bn_key(p_q) as q, public.phon_key(p_q) as p)
  select l.id, l.institution_name, l.institution_type, l.district, l.upazila, l.desired_slug, l.verification, l.name_en,
         case when l.search_key like '%' || k.q || '%' or l.search_key_en like '%' || k.q || '%' then 'exact' else 'sound' end
  from public.listing_submissions l, k
  where l.status = 'approved' and coalesce(l.is_hidden, false) = false
    and ( (char_length(k.q) >= 2 and (l.search_key like '%' || k.q || '%' or l.search_key_en like '%' || k.q || '%'))
       or (char_length(k.p) >= 3 and (l.phon_key like '%' || k.p || '%' or l.phon_key_en like '%' || k.p || '%')) )
  order by (l.search_key like '%' || k.q || '%' or l.search_key_en like '%' || k.q || '%') desc,
           (l.search_key like k.q || '%' or l.search_key_en like k.q || '%') desc, char_length(l.search_key), l.institution_name
  limit least(greatest(coalesce(p_limit, 8), 1), 20)
$$;
revoke all on function public.directory_search(text, int) from public;
grant execute on function public.directory_search(text, int) to anon, authenticated;

-- 4) the duplicate check: the same sound in the same district is a heads-up ('similar'), never a block
create or replace function public.directory_check(p_name text, p_district text, p_upazila text default null)
returns table (match_level text, institution_name text, institution_type text, district text, upazila text,
               desired_slug text, status text, verification text)
language sql stable security definer set search_path = public as $$
  with k as (select public.bn_key(p_name) as q, public.phon_key(p_name) as p)
  select case when (l.search_key = k.q or l.search_key_en = k.q) then
                case when coalesce(trim(p_upazila), '') <> '' and coalesce(trim(l.upazila), '') = trim(p_upazila) then 'same_upazila' else 'same_district' end
              else 'similar' end,
         l.institution_name, l.institution_type, l.district, l.upazila,
         case when l.status = 'approved' then l.desired_slug end,
         l.status, l.verification
  from public.listing_submissions l, k
  where trim(l.district) = trim(p_district)
    and l.status in ('pending', 'approved') and coalesce(l.is_hidden, false) = false
    and ( (char_length(k.q) >= 2 and (l.search_key = k.q or l.search_key_en = k.q))
       or (char_length(k.p) >= 5 and (l.phon_key = k.p or l.phon_key_en = k.p)) )
  order by (l.search_key = k.q or l.search_key_en = k.q) desc,
           (coalesce(trim(p_upazila), '') <> '' and coalesce(trim(l.upazila), '') = trim(p_upazila)) desc, l.institution_name
  limit 5
$$;
revoke all on function public.directory_check(text, text, text) from public;
grant execute on function public.directory_check(text, text, text) to anon, authenticated;

-- 5) visitors suggest the Bangla name of an institution that is listed only in English; a Partner / admin accepts it
--    with set_bangla_name() (the suggestions are read in the SQL editor for now)
create table if not exists public.bn_name_suggestions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listing_submissions(id) on delete cascade,
  bn_name text not null check (char_length(bn_name) between 3 and 120),
  user_id uuid,
  device text,
  status text not null default 'new' check (status in ('new', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);
create index if not exists bn_name_suggestions_listing_idx on public.bn_name_suggestions (listing_id, status);
alter table public.bn_name_suggestions enable row level security;      -- no policies: closed to the browser
revoke all on public.bn_name_suggestions from anon, authenticated;

create or replace function public.suggest_bangla_name(p_listing uuid, p_name text, p_device text default null)
returns void language plpgsql security definer set search_path = public as $$
declare nm text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')); dev text := left(coalesce(trim(p_device), ''), 80); n int;
begin
  if char_length(nm) < 3 or nm ~ '[A-Za-z]' then raise exception 'BAD_NAME'; end if;
  if not exists (select 1 from public.listing_submissions where id = p_listing and needs_bn_name and status = 'approved') then raise exception 'NOT_FOUND'; end if;
  if dev <> '' then
    select count(*) into n from public.bn_name_suggestions where device = dev and created_at > now() - interval '1 day';
    if n >= 15 then raise exception 'TOO_MANY'; end if;
    if exists (select 1 from public.bn_name_suggestions where listing_id = p_listing and device = dev and public.bn_key(bn_name) = public.bn_key(nm)) then return; end if;
  end if;
  insert into public.bn_name_suggestions (listing_id, bn_name, user_id, device) values (p_listing, nm, auth.uid(), nullif(dev, ''));
end $$;
revoke all on function public.suggest_bangla_name(uuid, text, text) from public;
grant execute on function public.suggest_bangla_name(uuid, text, text) to anon, authenticated;

-- check: these should print the same key on both lines of each pair
select public.phon_key('Dhaka College') as a, public.phon_key('ঢাকা কলেজ') as b;
select public.phon_key('Govt. Primary School') as a, public.phon_key('সরকারি প্রাথমিক বিদ্যালয়') as b;
