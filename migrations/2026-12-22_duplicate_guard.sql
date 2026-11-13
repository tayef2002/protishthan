-- One institution, one listing (2026-12-22).
--
-- 1) directory_check() now tells apart three kinds of match, and returns the id and whether the listing still needs its Bangla name:
--      same_upazila  the same name (in either language) in the same upazila            -> the form refuses
--      likely_same   a name that SOUNDS the same (Bangla against English) in the same upazila -> red alert, the person must look and choose
--      same_district the same name in another upazila of the district                  -> a note
--      similar       a sound-alike elsewhere in the district                           -> a note
--    The admin asks the same function before approving, so two listings of one institution are not approved by accident.
-- 2) A name written with English letters can no longer be INSERTED by a visitor or a member (the form already refuses it; this is the server's own guard).
--    Imported rows (source is not null), the admin, and rows that are only updated are not touched.
-- Safe to run more than once.

drop function if exists public.directory_check(text, text, text);
create function public.directory_check(p_name text, p_district text, p_upazila text default null)
returns table (match_level text, institution_name text, institution_type text, district text, upazila text,
               desired_slug text, status text, verification text, id uuid, needs_bn_name boolean)
language sql stable security definer set search_path = public as $$
  with k as (select public.bn_key(p_name) as q, public.phon_key(p_name) as p),
  m as (
    select l.id, l.institution_name, l.institution_type, l.district, l.upazila, l.desired_slug, l.status, l.verification, l.needs_bn_name,
           (l.search_key = k.q or l.search_key_en = k.q) as exact,
           (coalesce(trim(p_upazila), '') <> '' and coalesce(trim(l.upazila), '') = trim(p_upazila)) as here
    from public.listing_submissions l, k
    where trim(l.district) = trim(p_district)
      and l.status in ('pending', 'approved') and coalesce(l.is_hidden, false) = false
      and ( (char_length(k.q) >= 2 and (l.search_key = k.q or l.search_key_en = k.q))
         or (char_length(k.p) >= 5 and (l.phon_key = k.p or l.phon_key_en = k.p)) )
  )
  select case when m.exact and m.here then 'same_upazila'
              when m.exact then 'same_district'
              when m.here then 'likely_same'
              else 'similar' end,
         m.institution_name, m.institution_type, m.district, m.upazila,
         case when m.status = 'approved' then m.desired_slug end,
         m.status, m.verification, m.id, m.needs_bn_name
  from m
  order by m.exact desc, m.here desc, m.institution_name
  limit 6
$$;
revoke all on function public.directory_check(text, text, text) from public;
grant execute on function public.directory_check(text, text, text) to anon, authenticated;

create or replace function public.listing_bn_only() returns trigger language plpgsql as $$
begin
  if new.source is null and new.institution_name ~ '[A-Za-z]' and not coalesce(public.is_admin(), false) then
    raise exception 'ENGLISH_NAME_NOT_ALLOWED' using hint = 'প্রতিষ্ঠানের নাম বাংলায় লিখুন';
  end if;
  return new;
end $$;
drop trigger if exists listing_bn_only_trg on public.listing_submissions;
create trigger listing_bn_only_trg before insert on public.listing_submissions
  for each row execute function public.listing_bn_only();

-- check 1: the three new columns are there and the same name in the same upazila still stops
select * from public.directory_check('ঢাকা কলেজ', 'ঢাকা', 'ধানমন্ডি');
-- check 2: an English name is refused (this should raise ENGLISH_NAME_NOT_ALLOWED; roll it back if it does not)
-- insert into public.listing_submissions (institution_name, institution_type, district, upazila, contact_name, contact_phone, desired_slug, status)
--   values ('Test School', 'স্কুল', 'ঢাকা', 'ধানমন্ডি', 'x', '01700000000', 'pending-0', 'pending');
