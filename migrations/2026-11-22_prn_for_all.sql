-- PRN for every institution. Until now no listing had a PRN (it was only given when an admin approved a hand-submitted one).
--  * one sequence (prn_seq) hands out every PRN, so two institutions can never get the same number
--  * the imported institutions are numbered now (PRN-0001 … in EIIN order), and any institution imported later gets its PRN on insert
--  * next_prn_number() (used when an admin approves a listing) now draws from the same sequence, so it continues after the last imported one
--  * directory_browse() also returns the PRN, for the card
-- Run after 2026-11-21. Safe to run more than once (a listing that has a PRN keeps it).

create sequence if not exists public.prn_seq;
create unique index if not exists listing_prn_unique on public.listing_submissions (prn_number) where prn_number is not null;

-- 1) number the imported institutions that have none yet, in EIIN order
with n as (
  select id, row_number() over (order by source, nullif(regexp_replace(source_id, '[^0-9]', '', 'g'), '')::bigint, id) + (select coalesce(max(prn_number), 0) from public.listing_submissions) as rn
  from public.listing_submissions where source is not null and prn_number is null
)
update public.listing_submissions l set prn_number = n.rn from n where l.id = n.id;
select setval('public.prn_seq', greatest((select coalesce(max(prn_number), 0) from public.listing_submissions), 1), (select count(*) > 0 from public.listing_submissions where prn_number is not null));

-- 2) later imports are numbered on insert
create or replace function public.listing_set_prn()
returns trigger language plpgsql as $$
begin
  if new.source is not null and new.prn_number is null then new.prn_number := nextval('public.prn_seq'); end if;
  return new;
end $$;
drop trigger if exists listing_prn_on_insert on public.listing_submissions;
create trigger listing_prn_on_insert before insert on public.listing_submissions for each row execute function public.listing_set_prn();

-- 3) the admin approval button draws from the same sequence
create or replace function public.next_prn_number()
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  return nextval('public.prn_seq')::integer;
end $$;
revoke all on function public.next_prn_number() from public;
grant execute on function public.next_prn_number() to authenticated;

-- 4) the card
drop function if exists public.directory_browse(text, text[], text, text, int, int);
create or replace function public.directory_browse(p_q text default null, p_districts text[] default null, p_upazila text default null,
                                                   p_type text default null, p_limit int default 30, p_offset int default 0)
returns table (id uuid, institution_name text, name_en text, institution_type text, district text, upazila text,
               desired_slug text, verification text, email_hint text, source_id text, prn_number integer, total bigint)
language plpgsql stable security definer set search_path = public as $$
declare q text := nullif(public.bn_key(p_q), ''); p text := nullif(public.phon_key(p_q), '');
        lim int := least(greatest(coalesce(p_limit, 30), 1), 60); off int := greatest(coalesce(p_offset, 0), 0);
        up text := nullif(p_upazila, ''); ty text := nullif(p_type, '');
begin
  -- built as text and run with EXECUTE, so the planner sees the real values every time (a cached generic plan made the search time out)
  return query execute
    'with m as materialized (
       select l.id, l.institution_name, l.name_en, l.institution_type, l.district, l.upazila, l.desired_slug, l.verification, l.email_hint, l.source_id, l.prn_number,
              l.search_key, l.search_key_en, l.phon_key, l.phon_key_en
       from public.listing_submissions l
       where l.status = ''approved'' and l.verification = ''unverified'' and coalesce(l.is_hidden, false) = false'
    || case when p_districts is null then '' else ' and l.district = any ($1)' end
    || case when up is null then '' else ' and l.upazila = $2' end
    || case when ty is null then '' else ' and l.institution_type = $3' end
    || case when q is null then '' else ' and (l.search_key like ''%'' || $4 || ''%'' or l.search_key_en like ''%'' || $4 || ''%''
         or (char_length(coalesce($5, '''')) >= 3 and (l.phon_key like ''%'' || $5 || ''%'' or l.phon_key_en like ''%'' || $5 || ''%'')))' end
    || ')
     select id, institution_name, name_en, institution_type, district, upazila, desired_slug, verification, email_hint, source_id, prn_number, count(*) over ()
     from m
     order by ' || case when q is null then '' else '(search_key like ''%'' || $4 || ''%'' or search_key_en like ''%'' || $4 || ''%'') desc, (phon_key = $5 or phon_key_en = $5) desc, (phon_key like $5 || ''%'' or phon_key_en like $5 || ''%'') desc, ' end
    || case when q is null and p_districts is null and up is null and ty is null then 'md5(id::text || current_date::text), id' else 'district, upazila, institution_name, id' end
    || ' limit $6 offset $7'
    using p_districts, up, ty, q, p, lim, off;
end $$;
revoke all on function public.directory_browse(text, text[], text, text, int, int) from public;
grant execute on function public.directory_browse(text, text[], text, text, int, int) to anon, authenticated;

-- check
select count(*) as numbered, min(prn_number) as first_prn, max(prn_number) as last_prn, count(distinct prn_number) as distinct_prn from public.listing_submissions where prn_number is not null;
select institution_name, prn_number, source_id from public.directory_browse(null, null, null, null, 3, 0);
