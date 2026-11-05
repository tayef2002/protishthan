-- প্রতিষ্ঠানের নাম খোঁজা এখন তাৎক্ষণিক। Institute search without the 3-second wait.
--
-- Why it was slow: a common search ("ঢাকা", "মাদ্রাসা", "মেডি") matches tens of thousands of names. The old function found ALL of them, worked out a
-- ranking for every one, and only then kept the best 7, so the database ran out of time (statement timeout, about 3 seconds) and the page showed nothing.
--
-- What it does now: it asks in small steps and stops as soon as it has enough names.
--   1) names that START with what was typed        (a prefix index answers this instantly; shortest names first)
--   2) names that contain it somewhere, word by word (only if step 1 gave fewer than the limit; "জনাব আলী" finds "জনাব মোঃ আলী")
--   3) names that SOUND alike, also word by word    (only if still short: typing slips such as আ/অ, ি/ী, জনাব/জানাব, শ/স; a Bangla search also finds English-listed names)
-- The answer is the same kind of rows as before, with match_kind = 'exact' or 'sound'. Safe to run more than once. Run after 2026-12-09.

set statement_timeout = '10min';

-- prefix indexes (the existing trigram indexes stay and are still used for "contains")
create index if not exists listing_search_key_pfx    on public.listing_submissions (search_key text_pattern_ops)    where status = 'approved' and coalesce(is_hidden, false) = false;
create index if not exists listing_search_key_en_pfx on public.listing_submissions (search_key_en text_pattern_ops) where status = 'approved' and coalesce(is_hidden, false) = false;
create index if not exists listing_phon_key_pfx      on public.listing_submissions (phon_key text_pattern_ops)      where status = 'approved' and coalesce(is_hidden, false) = false;
create index if not exists listing_phon_key_en_pfx   on public.listing_submissions (phon_key_en text_pattern_ops)   where status = 'approved' and coalesce(is_hidden, false) = false;
analyze public.listing_submissions;

-- a search text turned into a pattern, word by word, in order: "রাজশাহী কলেজ" becomes %রাজসাহি%কলেজ%, so it still finds "Rajshahi Govt. College"
-- (sound keys: %rjs%C% matches rjsGC, the "Govt." in the middle no longer blocks it) and "জনাব আলী" finds "জনাব মোঃ আলী"
create or replace function public.key_pattern(t text, phon boolean default false)
returns text language sql immutable as $kp$
  select coalesce(string_agg(w, '%' order by n), '') from (
    select n, case when phon then public.phon_key(x) else public.bn_key(x) end as w
    from regexp_split_to_table(coalesce(t, ''), '\s+') with ordinality as sp(x, n)
  ) q where w <> ''
$kp$;
grant execute on function public.key_pattern(text, boolean) to anon, authenticated;

create or replace function public.directory_search(p_q text, p_limit int default 8)
returns table (id uuid, institution_name text, institution_type text, district text, upazila text, desired_slug text,
               verification text, name_en text, match_kind text)
language plpgsql stable security definer set search_path = public as $fn$
declare
  qk   text := public.bn_key(p_q);
  pk   text := public.phon_key(p_q);
  qp   text := public.key_pattern(p_q, false);
  pp   text := public.key_pattern(p_q, true);
  lim  int  := least(greatest(coalesce(p_limit, 8), 1), 20);
  have int  := 0;
  seen uuid[] := '{}';
  r    record;
  cols constant text := 'l.id, l.institution_name, l.institution_type, l.district, l.upazila, l.desired_slug, l.verification, l.name_en';
  base constant text := ' from public.listing_submissions l where l.status = ''approved'' and coalesce(l.is_hidden, false) = false and ';
begin
  -- 1) spelled alike, starting with what was typed (exact match first, then the shortest names)
  if char_length(qk) >= 2 then
    for r in execute 'select ' || cols || base || '(l.search_key like $1 || ''%'' or l.search_key_en like $1 || ''%'') '
                  || 'order by (l.search_key = $1 or l.search_key_en = $1) desc, char_length(l.search_key), l.institution_name limit $2'
             using qk, lim
    loop
      id := r.id; institution_name := r.institution_name; institution_type := r.institution_type; district := r.district; upazila := r.upazila;
      desired_slug := r.desired_slug; verification := r.verification; name_en := r.name_en; match_kind := 'exact';
      seen := seen || r.id; have := have + 1; return next;
    end loop;
    -- 2) spelled alike, anywhere in the name
    if have < lim then
      for r in execute 'select c.* from (select ' || cols || ', l.search_key as sk' || base || '(l.search_key like ''%'' || $1 || ''%'' or l.search_key_en like ''%'' || $1 || ''%'') and not (l.id = any($3)) limit 200) c '
                    || 'order by char_length(c.sk), c.institution_name limit $2'
               using qp, lim - have, seen
      loop
        id := r.id; institution_name := r.institution_name; institution_type := r.institution_type; district := r.district; upazila := r.upazila;
        desired_slug := r.desired_slug; verification := r.verification; name_en := r.name_en; match_kind := 'exact';
        seen := seen || r.id; have := have + 1; return next;
      end loop;
    end if;
  end if;
  -- 3) sounds alike: starting with the sound, then containing it
  if have < lim and char_length(pk) >= 3 then
    for r in execute 'select ' || cols || base || '(l.phon_key like $1 || ''%'' or l.phon_key_en like $1 || ''%'') and not (l.id = any($3)) '
                  || 'order by (l.phon_key = $1 or l.phon_key_en = $1) desc, char_length(l.phon_key), l.institution_name limit $2'
             using pk, lim - have, seen
    loop
      id := r.id; institution_name := r.institution_name; institution_type := r.institution_type; district := r.district; upazila := r.upazila;
      desired_slug := r.desired_slug; verification := r.verification; name_en := r.name_en; match_kind := 'sound';
      seen := seen || r.id; have := have + 1; return next;
    end loop;
    if have < lim then
      for r in execute 'select c.* from (select ' || cols || ', l.phon_key as sk' || base || '(l.phon_key like ''%'' || $1 || ''%'' or l.phon_key_en like ''%'' || $1 || ''%'') and not (l.id = any($3)) limit 200) c '
                    || 'order by char_length(c.sk), c.institution_name limit $2'
               using pp, lim - have, seen
      loop
        id := r.id; institution_name := r.institution_name; institution_type := r.institution_type; district := r.district; upazila := r.upazila;
        desired_slug := r.desired_slug; verification := r.verification; name_en := r.name_en; match_kind := 'sound';
        seen := seen || r.id; have := have + 1; return next;
      end loop;
    end if;
  end if;
  return;
end
$fn$;
revoke all on function public.directory_search(text, int) from public;
grant execute on function public.directory_search(text, int) to anon, authenticated;

-- check: each of these used to time out or take seconds; now they should return at once
select institution_name, match_kind from public.directory_search('ঢাকা', 7);
select institution_name, match_kind from public.directory_search('মাদ্রাসা', 7);
select institution_name, match_kind from public.directory_search('মেডি', 7);
select institution_name, match_kind from public.directory_search('জানাব আলী', 7);
select institution_name, match_kind from public.directory_search('রাজশাহী কলেজ', 7);
