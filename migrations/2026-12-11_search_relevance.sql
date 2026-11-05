-- সার্চের ক্রম আরও সঠিক: "ঢাকা কলেজ" লিখলে আগে "Dhaka College", "ঢাকা কলেজ", "D.K. College" আসবে; আগে "চলঢাকা … কলেজিয়েট" আসত।
-- Search order, better: names that START like the search (spelled alike, then sound alike) now come before names that merely CONTAIN the words.
--   1) spelled alike, starting with what was typed        2) sound alike, starting with it  (typing slips, English-listed names)
--   3) spelled alike, containing the words in order        4) sound alike, containing the words in order
-- Each step runs only if the earlier ones gave fewer than the limit, so it stays fast. Run after 2026-12-10_search_instant.sql. Safe to run more than once.

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
    continue when (i in (1, 3) and char_length(qk) < 2) or (i in (2, 4) and char_length(pk) < 3);
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

-- check: the first rows for "ঢাকা কলেজ" should now be Dhaka College / ঢাকা কলেজ / D.K. College, not "চলঢাকা … কলেজিয়েট"
select institution_name, match_kind from public.directory_search('ঢাকা কলেজ', 7);
select institution_name, match_kind from public.directory_search('জানাব আলী', 7);
select institution_name, match_kind from public.directory_search('রাজশাহী কলেজ', 7);
