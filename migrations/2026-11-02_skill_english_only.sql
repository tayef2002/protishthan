-- Skill certificate: name, headline and skill names must be English (A-Z, digits, space and . , ' & + / # ( ) _ @ : -).
-- The certificate is printed in English script fonts, and one spelling per skill keeps the "popular skills" count meaningful.
-- The free-text "about" stays open (it is shown on the web page only). Run after 2026-11-01_skill_profiles.sql. Safe to run more than once.

create or replace function public.skill_profiles_english()
returns trigger language plpgsql as $$
declare e jsonb; re text := '^[A-Za-z0-9 .,''&+/#()_@:-]+$';
begin
  if coalesce(new.display_name, '') <> '' and new.display_name !~ re then raise exception 'ENGLISH_ONLY'; end if;
  if coalesce(new.headline, '') <> '' and new.headline !~ re then raise exception 'ENGLISH_ONLY'; end if;
  for e in select * from jsonb_array_elements(coalesce(new.skills, '[]'::jsonb)) loop
    if coalesce(e ->> 'n', '') !~ re then raise exception 'ENGLISH_ONLY'; end if;
  end loop;
  return new;
end $$;
drop trigger if exists trg_skill_profiles_english on public.skill_profiles;
create trigger trg_skill_profiles_english before insert or update on public.skill_profiles
  for each row execute function public.skill_profiles_english();

-- check: rows that still have non-English text (they must be edited before they can be saved again)
select user_id, username, display_name, headline from public.skill_profiles
 where display_name ~ '[^A-Za-z0-9 .,''&+/#()_@:-]' or headline ~ '[^A-Za-z0-9 .,''&+/#()_@:-]';
