-- Skill identity: optional contact details on the public page ("যোগাযোগ করুন").
-- The owner can add a WhatsApp number, a phone number and an email, and switch on "কাজের জন্য খোলা".
-- Everything is optional and public once published, so the editor says that clearly. Run after 2026-11-03_skill_socials.sql.
-- Safe to run more than once.

alter table public.skill_profiles add column if not exists contact jsonb not null default '{}'::jsonb;
grant insert (contact) on public.skill_profiles to authenticated;
grant update (contact) on public.skill_profiles to authenticated;

create or replace function public.skill_profiles_contact()
returns trigger language plpgsql as $$
declare
  c jsonb := coalesce(new.contact, '{}'::jsonb); wa text; ph text; em text; out jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(c) <> 'object' then raise exception 'BAD_CONTACT'; end if;
  wa := regexp_replace(coalesce(c ->> 'whatsapp', ''), '[^0-9]', '', 'g');
  ph := regexp_replace(coalesce(c ->> 'phone', ''), '[^0-9]', '', 'g');
  em := lower(trim(coalesce(c ->> 'email', '')));
  if wa <> '' and (char_length(wa) < 8 or char_length(wa) > 15) then raise exception 'BAD_CONTACT'; end if;
  if ph <> '' and (char_length(ph) < 8 or char_length(ph) > 15) then raise exception 'BAD_CONTACT'; end if;
  if em <> '' and (char_length(em) > 100 or em !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$') then raise exception 'BAD_CONTACT'; end if;
  if wa <> '' then out := out || jsonb_build_object('whatsapp', wa); end if;
  if ph <> '' then out := out || jsonb_build_object('phone', ph); end if;
  if em <> '' then out := out || jsonb_build_object('email', em); end if;
  if (c ->> 'open') = 'true' then out := out || jsonb_build_object('open', true); end if;
  new.contact := out;
  return new;
end $$;
drop trigger if exists trg_skill_profiles_contact on public.skill_profiles;
create trigger trg_skill_profiles_contact before insert or update on public.skill_profiles
  for each row execute function public.skill_profiles_contact();

-- the public page now also receives the contact details
create or replace function public.get_skill_profile(p_username text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'username', username, 'display_name', display_name, 'headline', headline, 'about', about,
    'skills', skills, 'links', links, 'socials', socials, 'contact', contact, 'badges', to_jsonb(badges), 'theme', theme, 'avatar', avatar,
    'og_key', og_key, 'og_version', og_version, 'views', views, 'published_at', published_at)
  from public.skill_profiles
  where lower(username) = lower(coalesce(p_username, '')) and published and not hidden
  limit 1;
$$;
revoke all on function public.get_skill_profile(text) from public;
grant execute on function public.get_skill_profile(text) to anon, authenticated;

-- check
select count(*) as skill_profiles, count(*) filter (where contact <> '{}'::jsonb) as with_contact from public.skill_profiles;
