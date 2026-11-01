-- সাইট দ্রুত: with 100,000+ institutions two things on the home page were slow (3 seconds each):
--  1) the numbers beside the filters (directory_counts) counted every row each time. They are now kept in a small table and refreshed at most every 10 minutes (the first visitor after that pays ~1 second, everyone else gets them instantly).
--  2) the first page you see before choosing anything. It sorted every row by a daily-changing key just to pick 30. Now it reads 30 rows straight from the PRN index, starting at a different point each day
--     (PRNs are random, so this is still a fair daily mix) and takes the total from the cached counts.
-- Searches and filtered lists are unchanged. Run after 2026-11-27. Safe to run more than once.

create table if not exists public.directory_count_cache (
  institution_type text, district text, n bigint not null, refreshed_at timestamptz not null default now()
);
revoke all on public.directory_count_cache from anon, authenticated;

create or replace function public.refresh_directory_counts()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.directory_count_cache;
  insert into public.directory_count_cache (institution_type, district, n)
    select l.institution_type, l.district, count(*) from public.listing_submissions l
    where l.status = 'approved' and l.verification = 'unverified' and coalesce(l.is_hidden, false) = false
    group by l.institution_type, l.district;
end $$;
revoke all on function public.refresh_directory_counts() from public, anon, authenticated;

drop function if exists public.directory_counts();
create or replace function public.directory_counts()
returns table (institution_type text, district text, n bigint)
language plpgsql volatile security definer set search_path = public as $$
begin
  if (select min(c.refreshed_at) from public.directory_count_cache c) is null
     or (select min(c.refreshed_at) from public.directory_count_cache c) < now() - interval '10 minutes' then
    if pg_try_advisory_xact_lock(7770002) then perform public.refresh_directory_counts(); end if;
  end if;
  return query select c.institution_type, c.district, c.n from public.directory_count_cache c;
end $$;
revoke all on function public.directory_counts() from public;
grant execute on function public.directory_counts() to anon, authenticated;

drop function if exists public.directory_browse(text, text[], text, text, int, int);
create or replace function public.directory_browse(p_q text default null, p_districts text[] default null, p_upazila text default null,
                                                   p_type text default null, p_limit int default 30, p_offset int default 0)
returns table (id uuid, institution_name text, name_en text, institution_type text, district text, upazila text,
               desired_slug text, verification text, email_hint text, source_id text, prn_number integer, total bigint)
language plpgsql stable security definer set search_path = public as $$
declare q text := nullif(public.bn_key(p_q), ''); p text := nullif(public.phon_key(p_q), '');
        lim int := least(greatest(coalesce(p_limit, 30), 1), 60); off int := greatest(coalesce(p_offset, 0), 0);
        up text := nullif(p_upazila, ''); ty text := nullif(p_type, '');
        s int; tot bigint;
begin
  if q is null and p_districts is null and up is null and ty is null then
    -- the page before anything is chosen: a fair daily mix, read straight from the PRN index
    s := 100000 + ((extract(doy from current_date)::int * 37123 + extract(year from current_date)::int * 101) % 900000);
    tot := coalesce((select sum(c.n) from public.directory_count_cache c), 0);
    return query
      select x.id, x.institution_name, x.name_en, x.institution_type, x.district, x.upazila, x.desired_slug, x.verification, x.email_hint, x.source_id, x.prn_number, tot
      from (
        (select l.id, l.institution_name, l.name_en, l.institution_type, l.district, l.upazila, l.desired_slug, l.verification, l.email_hint, l.source_id, l.prn_number, 0 as g
           from public.listing_submissions l
           where l.status = 'approved' and l.verification = 'unverified' and coalesce(l.is_hidden, false) = false and l.prn_number >= s
           order by l.prn_number limit lim + off)
        union all
        (select l.id, l.institution_name, l.name_en, l.institution_type, l.district, l.upazila, l.desired_slug, l.verification, l.email_hint, l.source_id, l.prn_number, 1 as g
           from public.listing_submissions l
           where l.status = 'approved' and l.verification = 'unverified' and coalesce(l.is_hidden, false) = false and l.prn_number < s
           order by l.prn_number limit lim + off)
      ) x
      order by x.g, x.prn_number limit lim offset off;
    return;
  end if;
  -- everything else: built as text and run with EXECUTE, so the planner sees the real values every time
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
    || 'district, upazila, institution_name, id limit $6 offset $7'
    using p_districts, up, ty, q, p, lim, off;
end $$;
revoke all on function public.directory_browse(text, text[], text, text, int, int) from public;
grant execute on function public.directory_browse(text, text[], text, text, int, int) to anon, authenticated;

-- fill the counts once now
select public.refresh_directory_counts();

-- check
select count(*) as groups, sum(n) as unverified from public.directory_counts();
select institution_name, prn_number, total from public.directory_browse(null, null, null, null, 3, 0);
