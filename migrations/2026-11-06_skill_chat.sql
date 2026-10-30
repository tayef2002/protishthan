-- Skill identity: direct chat between a visitor (signed in with Google) and the owner of a skill page.
-- Everything goes through the functions below. The two tables have row level security on, no policies and no grants,
-- so nobody can read or write them directly from the browser. Run after 2026-11-05_skill_contact.sql. Safe to run more than once.

-- the owner switches chat on in the editor
alter table public.skill_profiles add column if not exists chat_enabled boolean not null default false;
grant insert (chat_enabled) on public.skill_profiles to authenticated;
grant update (chat_enabled) on public.skill_profiles to authenticated;

create table if not exists public.skill_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  visitor_id uuid not null,
  username text not null,
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  owner_unread int not null default 0,
  visitor_unread int not null default 0,
  blocked boolean not null default false,
  unique (owner_id, visitor_id),
  check (owner_id <> visitor_id)
);
create table if not exists public.skill_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.skill_threads(id) on delete cascade,
  sender_id uuid not null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists skill_messages_thread_idx on public.skill_messages (thread_id, id);
create index if not exists skill_threads_owner_idx on public.skill_threads (owner_id, last_at desc);
create index if not exists skill_threads_visitor_idx on public.skill_threads (visitor_id, last_at desc);
alter table public.skill_threads enable row level security;
alter table public.skill_messages enable row level security;
revoke all on public.skill_threads from anon, authenticated;
revoke all on public.skill_messages from anon, authenticated;

-- send a message: starts the thread when p_thread is null (needs the profile username), otherwise replies in it
create or replace function public.skill_chat_send(p_username text, p_thread uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); t public.skill_threads; prof public.skill_profiles; b text := trim(coalesce(p_body, '')); n int;
begin
  if me is null then raise exception 'NEED_LOGIN'; end if;
  if char_length(b) < 1 or char_length(b) > 1000 then raise exception 'BAD_MESSAGE'; end if;
  if not public.skill_text_ok(b) then raise exception 'BAD_TEXT'; end if;
  select count(*) into n from public.skill_messages where sender_id = me and created_at > now() - interval '1 minute';
  if n >= 6 then raise exception 'TOO_FAST'; end if;
  select count(*) into n from public.skill_messages where sender_id = me and created_at > now() - interval '1 day';
  if n >= 150 then raise exception 'TOO_MANY'; end if;

  if p_thread is not null then
    select * into t from public.skill_threads where id = p_thread and (owner_id = me or visitor_id = me);
    if not found then raise exception 'NO_THREAD'; end if;
    if me = t.visitor_id and not exists (select 1 from public.skill_profiles where user_id = t.owner_id and published and not hidden and chat_enabled) then
      raise exception 'CHAT_OFF';
    end if;
  else
    select * into prof from public.skill_profiles
      where lower(username) = lower(coalesce(p_username, '')) and published and not hidden and chat_enabled limit 1;
    if not found then raise exception 'CHAT_OFF'; end if;
    if prof.user_id = me then raise exception 'SELF'; end if;
    select * into t from public.skill_threads where owner_id = prof.user_id and visitor_id = me;
    if not found then
      select count(*) into n from public.skill_threads where visitor_id = me and created_at > now() - interval '1 day';
      if n >= 10 then raise exception 'TOO_MANY'; end if;
      insert into public.skill_threads (owner_id, visitor_id, username) values (prof.user_id, me, prof.username) returning * into t;
    end if;
  end if;
  if t.blocked then raise exception 'BLOCKED'; end if;

  insert into public.skill_messages (thread_id, sender_id, body) values (t.id, me, b);
  update public.skill_threads set last_at = now(),
    owner_unread = owner_unread + case when me = owner_id then 0 else 1 end,
    visitor_unread = visitor_unread + case when me = visitor_id then 0 else 1 end
  where id = t.id;
  return jsonb_build_object('thread', t.id);
end $$;

-- my conversations (as the page owner and as a visitor), newest first
create or replace function public.skill_chat_threads()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'role', case when t.owner_id = auth.uid() then 'owner' else 'visitor' end,
    'name', case when t.owner_id = auth.uid() then coalesce(m.display_name, 'সদস্য') else coalesce(sp.display_name, t.username) end,
    'avatar', case when t.owner_id = auth.uid() then m.avatar_url else null end,
    'username', t.username,
    'last', (select left(x.body, 90) from public.skill_messages x where x.thread_id = t.id order by x.id desc limit 1),
    'last_at', t.last_at,
    'unread', case when t.owner_id = auth.uid() then t.owner_unread else t.visitor_unread end,
    'blocked', t.blocked
  ) order by t.last_at desc), '[]'::jsonb)
  from (select * from public.skill_threads where owner_id = auth.uid() or visitor_id = auth.uid() order by last_at desc limit 50) t
  left join public.members m on m.user_id = t.visitor_id
  left join public.skill_profiles sp on sp.user_id = t.owner_id
  where auth.uid() is not null;
$$;

-- the messages of one thread (only for its two people); opening it marks it read for me
create or replace function public.skill_chat_messages(p_thread uuid, p_after bigint default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t public.skill_threads; msgs jsonb; who text; oname text; oav text;
begin
  if me is null then raise exception 'NEED_LOGIN'; end if;
  select * into t from public.skill_threads where id = p_thread and (owner_id = me or visitor_id = me);
  if not found then raise exception 'NO_THREAD'; end if;
  who := case when t.owner_id = me then 'owner' else 'visitor' end;
  if who = 'owner' then select display_name, avatar_url into oname, oav from public.members where user_id = t.visitor_id;
  else select display_name into oname from public.skill_profiles where user_id = t.owner_id; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'mine', x.sender_id = me, 'body', x.body, 'at', x.created_at) order by x.id), '[]'::jsonb)
    into msgs from (select * from public.skill_messages where thread_id = t.id and id > coalesce(p_after, 0) order by id desc limit 200) x;
  if who = 'owner' then update public.skill_threads set owner_unread = 0 where id = t.id and owner_unread <> 0;
  else update public.skill_threads set visitor_unread = 0 where id = t.id and visitor_unread <> 0; end if;
  return jsonb_build_object('role', who, 'name', coalesce(oname, 'সদস্য'), 'avatar', oav, 'username', t.username, 'blocked', t.blocked, 'messages', msgs);
end $$;

-- how many unread messages do I have (for the little dot on the bell)
create or replace function public.skill_chat_unread()
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when owner_id = auth.uid() then owner_unread else visitor_unread end), 0)::int
  from public.skill_threads where (owner_id = auth.uid() or visitor_id = auth.uid()) and auth.uid() is not null;
$$;

-- the page owner can stop a visitor from writing again (and undo it)
create or replace function public.skill_chat_block(p_thread uuid, p_block boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NEED_LOGIN'; end if;
  update public.skill_threads set blocked = coalesce(p_block, true) where id = p_thread and owner_id = auth.uid();
  if not found then raise exception 'NO_THREAD'; end if;
end $$;

revoke all on function public.skill_chat_send(text, uuid, text) from public;
revoke all on function public.skill_chat_threads() from public;
revoke all on function public.skill_chat_messages(uuid, bigint) from public;
revoke all on function public.skill_chat_unread() from public;
revoke all on function public.skill_chat_block(uuid, boolean) from public;
grant execute on function public.skill_chat_send(text, uuid, text) to authenticated;
grant execute on function public.skill_chat_threads() to authenticated;
grant execute on function public.skill_chat_messages(uuid, bigint) to authenticated;
grant execute on function public.skill_chat_unread() to authenticated;
grant execute on function public.skill_chat_block(uuid, boolean) to authenticated;

-- the public page only learns whether chat is on (never who the owner is)
create or replace function public.get_skill_profile(p_username text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'username', username, 'display_name', display_name, 'headline', headline, 'about', about,
    'skills', skills, 'links', links, 'socials', socials, 'contact', contact, 'chat', chat_enabled, 'badges', to_jsonb(badges), 'theme', theme, 'avatar', avatar,
    'og_key', og_key, 'og_version', og_version, 'views', views, 'published_at', published_at)
  from public.skill_profiles
  where lower(username) = lower(coalesce(p_username, '')) and published and not hidden
  limit 1;
$$;
revoke all on function public.get_skill_profile(text) from public;
grant execute on function public.get_skill_profile(text) to anon, authenticated;

-- check
select (select count(*) from public.skill_threads) as threads, (select count(*) from public.skill_messages) as messages;
