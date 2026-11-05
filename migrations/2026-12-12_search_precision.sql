-- দুই শব্দের সাধারণ সার্চ ("ঢাকা কলেজ") এখনও ১ সেকেন্ডের মতো নিচ্ছিল। শেষ ধাপটা (উচ্চারণ ধরে "ভেতরে আছে") tk%C-র মতো খুব ছোট টুকরো নিয়ে পুরো টেবিল ঘুরে দেখত, আর "Godagari College"-এর মতো অপ্রাসঙ্গিক নামও আনত।
-- Two common words ("ঢাকা কলেজ") still took about a second: the last step (sound alike, containing the words) scanned the whole table for tiny pieces like tk%C and also
-- brought junk such as "Godagari College". Now that step runs only when the pattern holds a piece of 3+ sound letters (rjs%C, jnb%l do; tk%C does not). Run after 2026-12-11. Safe to run more than once.

create or replace function public.pat_ok(t text)
returns boolean language sql immutable as $po$
  select exists (select 1 from regexp_split_to_table(coalesce(t, ''), '%') c where char_length(c) >= 3)
$po$;
grant execute on function public.pat_ok(text) to anon, authenticated;

create or replace function public.directory_search(p_q text, p_limit int default 8)
returns table (id uuid, institution_name text, institution_type text, district text, upazila text, desired_slug text,
               verification text, name_en text, match_kind text)
language plpgsql stable security definer set search_path = public as $fn$
declare
  qk   text := public.bn_key(p_q);
  pk   text := public.phon_key(p_q);
  lim  int  := least(greatest(coalesce(p_limit, 8), 1), 20);
  have int  := 0;
  seen uuid[] := '{}';
  r    record;
  i    int;
  cols constant text := 'l.id, l.institution_name, l.institution_type, l.district, l.upazila, l.desired_slug, l.verification, l.name_en';
  base constant text := ' from public.listing_submissions l where l.status = ''approved'' and coalesce(l.is_hidden, false) = false and ';
  args  text[];
  kinds text[] := array['exact', 'sound', 'exact', 'sound'];
  sqls  text[] := array[
    'select ' || cols || base || '(l.search_key like $1 || ''%'' or l.search_key_en like $1 || ''%'') and not (l.id = any($3)) '
      || 'order by (l.search_key = $1 or l.search_key_en = $1) desc, char_length(l.search_key), l.institution_name limit $2',
    'select ' || cols || base || '(l.phon_key like $1 || ''%'' or l.phon_key_en like $1 || ''%'') and not (l.id = any($3)) '
      || 'order by (l.phon_key = $1 or l.phon_key_en = $1) desc, char_length(l.phon_key), l.institution_name limit $2',
    'select c.* from (select ' || cols || ', l.search_key as sk' || base || '(l.search_key like ''%'' || $1 || ''%'' or l.search_key_en like ''%'' || $1 || ''%'') and not (l.id = any($3)) limit 200) c '
      || 'order by char_length(c.sk), c.institution_name limit $2',
    'select c.* from (select ' || cols || ', l.phon_key as sk' || base || '(l.phon_key like ''%'' || $1 || ''%'' or l.phon_key_en like ''%'' || $1 || ''%'') and not (l.id = any($3)) limit 200) c '
      || 'order by char_length(c.sk), c.institution_name limit $2' ];
begin
  args := array[qk, pk, public.key_pattern(p_q, false), public.key_pattern(p_q, true)];
  for i in 1..4 loop
    exit when have >= lim;
    continue when (i in (1, 3) and char_length(qk) < 2) or (i in (2, 4) and char_length(pk) < 3) or (i = 4 and not public.pat_ok(args[4]));
    for r in execute sqls[i] using args[i], lim - have, seen loop
      id := r.id; institution_name := r.institution_name; institution_type := r.institution_type; district := r.district; upazila := r.upazila;
      desired_slug := r.desired_slug; verification := r.verification; name_en := r.name_en; match_kind := kinds[i];
      seen := seen || r.id; have := have + 1; return next;
    end loop;
  end loop;
  return;
end
$fn$;
revoke all on function public.directory_search(text, int) from public;
grant execute on function public.directory_search(text, int) to anon, authenticated;

-- check: "ঢাকা কলেজ" should now answer in well under a second without junk like Godagari College
select institution_name, match_kind from public.directory_search('ঢাকা কলেজ', 7);
select institution_name, match_kind from public.directory_search('জানাব আলী', 7);
select institution_name, match_kind from public.directory_search('রাজশাহী কলেজ', 7);
