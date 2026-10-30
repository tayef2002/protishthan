-- Skill identity: social profiles (Facebook, Instagram, YouTube, LinkedIn, X, TikTok, WhatsApp, Telegram, GitHub, Behance).
-- Shown as round icons under the name on the public page. Each link must belong to the platform's own domain,
-- one per platform, up to 8. Run after 2026-11-01_skill_profiles.sql. Safe to run more than once.

alter table public.skill_profiles add column if not exists socials jsonb not null default '[]'::jsonb;
grant insert (socials) on public.skill_profiles to authenticated;
grant update (socials) on public.skill_profiles to authenticated;

create or replace function public.skill_profiles_socials()
returns trigger language plpgsql as $$
declare
  doms jsonb := '{"facebook":["facebook.com","fb.com","fb.me"],"instagram":["instagram.com"],"youtube":["youtube.com","youtu.be"],"linkedin":["linkedin.com"],"x":["x.com","twitter.com"],"tiktok":["tiktok.com"],"whatsapp":["wa.me","whatsapp.com"],"telegram":["t.me","telegram.me"],"github":["github.com"],"behance":["behance.net"]}'::jsonb;
  e jsonb; k text; u text; h text; d text; ok boolean; seen text[] := '{}'; out jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(coalesce(new.socials, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(new.socials, '[]'::jsonb)) > 8 then raise exception 'BAD_SOCIALS'; end if;
  for e in select * from jsonb_array_elements(coalesce(new.socials, '[]'::jsonb)) loop
    k := e ->> 'p'; u := trim(coalesce(e ->> 'u', ''));
    if u = '' then continue; end if;
    if (doms -> k) is null then raise exception 'BAD_SOCIALS'; end if;
    if k = any (seen) then continue; end if;
    if char_length(u) > 200 or u !~* '^https://[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(/[^\s]*)?$' then raise exception 'BAD_SOCIALS'; end if;
    h := regexp_replace(lower(substring(u from '^https://([^/?#:]+)')), '^www\.', '');
    ok := false;
    for d in select jsonb_array_elements_text(doms -> k) loop
      if h = d or h like '%.' || d then ok := true; end if;
    end loop;
    if not ok then raise exception 'BAD_SOCIALS'; end if;
    seen := seen || k;
    out := out || jsonb_build_array(jsonb_build_object('p', k, 'u', u));
  end loop;
  new.socials := out;
  return new;
end $$;
drop trigger if exists trg_skill_profiles_socials on public.skill_profiles;
create trigger trg_skill_profiles_socials before insert or update on public.skill_profiles
  for each row execute function public.skill_profiles_socials();

-- the public page now also receives the socials
create or replace function public.get_skill_profile(p_username text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'username', username, 'display_name', display_name, 'headline', headline, 'about', about,
    'skills', skills, 'links', links, 'socials', socials, 'badges', to_jsonb(badges), 'theme', theme, 'avatar', avatar,
    'og_key', og_key, 'og_version', og_version, 'views', views, 'published_at', published_at)
  from public.skill_profiles
  where lower(username) = lower(coalesce(p_username, '')) and published and not hidden
  limit 1;
$$;
revoke all on function public.get_skill_profile(text) from public;
grant execute on function public.get_skill_profile(text) to anon, authenticated;

-- check
select count(*) as skill_profiles from public.skill_profiles;
