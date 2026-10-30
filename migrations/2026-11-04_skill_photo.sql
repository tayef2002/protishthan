-- Skill identity: people upload their own photo (we do not use Google profile pictures).
-- The photo is cropped and shrunk to 256x256 in the browser and kept in the profile as a small JPEG
-- (about 20 KB), so no file storage is involved. This replaces the avatar rule of the profile guard:
-- an avatar is one of our own (av:<id>:<skin>) or an uploaded JPEG. Old Google-photo addresses are no longer accepted.
-- Run after 2026-11-01_skill_profiles.sql. Safe to run more than once.

create or replace function public.skill_profiles_guard()
returns trigger language plpgsql as $$
declare
  s jsonb; l jsonb; sk jsonb := '[]'::jsonb; lk jsonb := '[]'::jsonb; nm text; lv int; u text; t text; b text; becoming_public boolean;
  reserved text[] := array['admin','api','s','skill','skills','card','member','login','logout','signup','partner','army','agent','software','results','privacy','terms','about','help','support','protishthan','official','root','www','mail','static','assets','null','undefined','me','new','edit','settings'];
  ok_badges text[] := array['self-taught','freelancer','problem-solver','zero-degree','creator','builder','night-owl','mentor','learner','open-source'];
begin
  new.username := lower(trim(new.username));
  if new.username = any (reserved) then raise exception 'USERNAME_RESERVED'; end if;
  new.display_name := left(regexp_replace(trim(coalesce(new.display_name, '')), '\s+', ' ', 'g'), 60);
  new.headline := left(regexp_replace(trim(coalesce(new.headline, '')), '\s+', ' ', 'g'), 70);
  new.about := left(trim(coalesce(new.about, '')), 160);
  if not (public.skill_text_ok(new.username) and public.skill_text_ok(new.display_name) and public.skill_text_ok(new.headline) and public.skill_text_ok(new.about)) then
    raise exception 'BAD_TEXT';
  end if;

  if jsonb_typeof(coalesce(new.skills, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(new.skills, '[]'::jsonb)) > 8 then raise exception 'BAD_SKILLS'; end if;
  for s in select * from jsonb_array_elements(coalesce(new.skills, '[]'::jsonb)) loop
    nm := left(regexp_replace(trim(coalesce(s ->> 'n', '')), '\s+', ' ', 'g'), 30);
    begin lv := (s ->> 'l')::int; exception when others then lv := 2; end;
    if nm = '' then continue; end if;
    if not public.skill_text_ok(nm) then raise exception 'BAD_TEXT'; end if;
    sk := sk || jsonb_build_array(jsonb_build_object('n', nm, 'l', greatest(1, least(4, coalesce(lv, 2)))));
  end loop;
  new.skills := sk;

  if jsonb_typeof(coalesce(new.links, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(new.links, '[]'::jsonb)) > 3 then raise exception 'BAD_LINKS'; end if;
  for l in select * from jsonb_array_elements(coalesce(new.links, '[]'::jsonb)) loop
    u := trim(coalesce(l ->> 'u', '')); t := left(trim(coalesce(l ->> 't', '')), 30);
    if u = '' then continue; end if;
    if char_length(u) > 200 or u !~* '^https?://[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(/[^\s]*)?$' then raise exception 'BAD_LINK_URL'; end if;
    if not public.skill_text_ok(t) then raise exception 'BAD_TEXT'; end if;
    lk := lk || jsonb_build_array(jsonb_build_object('t', t, 'u', u));
  end loop;
  new.links := lk;

  if coalesce(array_length(new.badges, 1), 0) > 2 then raise exception 'BAD_BADGES'; end if;
  foreach b in array coalesce(new.badges, '{}') loop
    if not (b = any (ok_badges)) then raise exception 'BAD_BADGES'; end if;
  end loop;

  -- an avatar is one of ours, or the person's own uploaded photo (a small JPEG sent as a data address, at most 60 KB)
  if new.avatar is not null and new.avatar !~ '^av:[a-z0-9_-]{1,30}:[0-4]$'
     and not (new.avatar ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$' and char_length(new.avatar) <= 60000) then
    raise exception 'BAD_AVATAR';
  end if;

  -- becoming public (a new row that is already published, or a draft being published)
  becoming_public := false;
  if new.published then
    if tg_op = 'INSERT' then becoming_public := true;
    else becoming_public := not old.published; end if;
  end if;
  if becoming_public then
    if new.consent_at is null then raise exception 'NEED_CONSENT'; end if;
    if new.display_name = '' or jsonb_array_length(new.skills) = 0 then raise exception 'NEED_NAME_AND_SKILL'; end if;
    new.published_at := now();
  end if;

  if tg_op = 'UPDATE' then
    -- the preview image is re-made (and its address changes) only when what people see has changed
    if (new.username, new.display_name, new.headline, new.about, new.skills, new.links, new.badges, new.theme, new.avatar)
       is distinct from (old.username, old.display_name, old.headline, old.about, old.skills, old.links, old.badges, old.theme, old.avatar) then
      new.og_version := old.og_version + 1;
      new.updated_at := now();
    elsif new.published is distinct from old.published then
      new.updated_at := now();
    end if;
  else
    new.updated_at := now();
  end if;
  return new;
end $$;

-- clear any avatar that is still a Google address (they would block later edits)
update public.skill_profiles set avatar = 'av:stu-m:1' where avatar like 'https://%';

-- check
select count(*) as skill_profiles, count(*) filter (where avatar like 'data:image%') as with_own_photo from public.skill_profiles;
