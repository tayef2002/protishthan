-- শিক্ষিত কার্ড পেজের "মতামত" সেকশন: কার্ড নিয়ে মতামত, আইডিয়া বা সমস্যা লেখা যায়। লেখাগুলো সবাই দেখতে পায়, অ্যাডমিন প্যানেল থেকে দেখা, লুকানো, উত্তর দেওয়া আর মোছা যায়।
-- Opinions, ideas and problems about the card, written on the card page. Public to everybody; the admin panel (কার্ড মতামত) reads, hides, answers and deletes them.
-- Needs 2026-10-26_admin_users.sql (is_admin) and 2026-11-01_skill_profiles.sql (skill_text_ok, the bad-word list). Safe to run more than once.
--
-- Rules the server enforces (the page checks the same things first, but the page can be bypassed):
--   8 to 600 characters; no links, e-mail addresses or phone numbers (protects the writer's privacy and keeps spam out); the bad-word list;
--   one comment per 45 seconds and 4 per day per device; the same text twice from one device is refused; at most 40 new comments in any 10 minutes for the whole site.
--   New comments are public at once, unless the admin switches "approve first" on (then they wait as 'pending'). 3 different devices reporting a comment hides it until the admin looks.
--   Only the author name (optional) and the text are public. The device id (random, kept in the browser) is for the admin only.

create table if not exists public.card_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('opinion', 'idea', 'problem')),
  name text not null default '',
  body text not null check (char_length(body) between 8 and 600),
  device text not null check (char_length(device) between 8 and 64),
  user_id uuid,                                    -- set when the writer was signed in (admin only)
  status text not null default 'published' check (status in ('published', 'pending', 'hidden')),
  reports int not null default 0,
  reply text check (reply is null or char_length(reply) <= 800),
  replied_at timestamptz,
  seen boolean not null default false              -- false = the admin has not looked at it yet (drives the badge)
);
create index if not exists card_comments_pub_idx on public.card_comments (created_at desc) where status = 'published';
create index if not exists card_comments_device_idx on public.card_comments (device, created_at desc);
create index if not exists card_comments_recent_idx on public.card_comments (created_at desc);

create table if not exists public.card_comment_reports (
  comment_id uuid not null references public.card_comments(id) on delete cascade,
  device text not null check (char_length(device) between 8 and 64),
  created_at timestamptz not null default now(),
  primary key (comment_id, device)
);

create table if not exists public.card_comment_settings (
  id int primary key default 1 check (id = 1),
  approve_first boolean not null default false
);
insert into public.card_comment_settings (id) values (1) on conflict (id) do nothing;

-- the tables are closed to the browser; only the admin (signed in, listed in admin_users) can read and change them directly
alter table public.card_comments enable row level security;
alter table public.card_comment_reports enable row level security;
alter table public.card_comment_settings enable row level security;
revoke all on public.card_comments, public.card_comment_reports, public.card_comment_settings from anon, authenticated;
grant select, update, delete on public.card_comments to authenticated;
grant select on public.card_comment_reports to authenticated;
grant select, update on public.card_comment_settings to authenticated;
drop policy if exists card_comments_admin on public.card_comments;
create policy card_comments_admin on public.card_comments for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists card_comment_reports_admin on public.card_comment_reports;
create policy card_comment_reports_admin on public.card_comment_reports for select to authenticated using (public.is_admin());
drop policy if exists card_comment_settings_admin on public.card_comment_settings;
create policy card_comment_settings_admin on public.card_comment_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- the public list: published comments, newest first, with the total (the page asks for it through /api/dir, which keeps each answer for a minute)
create or replace function public.card_comment_list(p_limit int default 10, p_offset int default 0)
returns table (id uuid, created_at timestamptz, kind text, name text, body text, reply text, replied_at timestamptz, total bigint)
language sql stable security definer set search_path = public as $$
  select c.id, c.created_at, c.kind, coalesce(nullif(c.name, ''), 'একজন ব্যবহারকারী'), c.body, c.reply, c.replied_at, count(*) over ()
    from public.card_comments c
   where c.status = 'published'
   order by c.created_at desc
   limit greatest(1, least(coalesce(p_limit, 10), 30))
  offset greatest(0, least(coalesce(p_offset, 0), 1000))
$$;

-- write one comment. Answers {id, created_at, status}; a refusal raises one of: BAD_DEVICE BAD_KIND TOO_SHORT TOO_LONG BAD_TEXT BAD_LINK BAD_PRIVATE TOO_FAST DAILY_LIMIT DUPLICATE BUSY
create or replace function public.card_comment_add(p_device text, p_name text, p_kind text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  dev text := left(coalesce(trim(p_device), ''), 64);
  nm text := left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 40);
  b text := regexp_replace(regexp_replace(trim(coalesce(p_body, '')), '[ \t]+', ' ', 'g'), E'\n{3,}', E'\n\n', 'g');
  plain text; compact text; approve boolean; st text; new_id uuid; made timestamptz;
begin
  if char_length(dev) < 8 then raise exception 'BAD_DEVICE'; end if;
  if p_kind is null or p_kind not in ('opinion', 'idea', 'problem') then raise exception 'BAD_KIND'; end if;
  if char_length(b) < 8 then raise exception 'TOO_SHORT'; end if;
  if char_length(b) > 600 then raise exception 'TOO_LONG'; end if;
  if not (public.skill_text_ok(b) and public.skill_text_ok(nm)) then raise exception 'BAD_TEXT'; end if;
  -- no links, e-mail addresses or phone numbers (Bangla digits are turned into 0-9 first)
  plain := translate(b || ' ' || nm, '০১২৩৪৫৬৭৮৯', '0123456789');
  compact := regexp_replace(plain, '[\s\-\.\(\)\+]', '', 'g');
  if plain ~* '(https?:|www\.|\.(com|net|org|info|xyz|link|bd)($|[^a-z]))' or plain ~ '[^\s@]+@[^\s@]+' then raise exception 'BAD_LINK'; end if;
  if compact ~ '01[3-9][0-9]{8}' or plain ~ '[0-9]{10,}' then raise exception 'BAD_PRIVATE'; end if;
  -- limits
  if exists (select 1 from public.card_comments c where c.device = dev and c.created_at > now() - interval '45 seconds') then raise exception 'TOO_FAST'; end if;
  if (select count(*) from public.card_comments c where c.device = dev and c.created_at > now() - interval '1 day') >= 4 then raise exception 'DAILY_LIMIT'; end if;
  if exists (select 1 from public.card_comments c where c.device = dev and lower(c.body) = lower(b)) then raise exception 'DUPLICATE'; end if;
  if (select count(*) from public.card_comments c where c.created_at > now() - interval '10 minutes') >= 40 then raise exception 'BUSY'; end if;
  select s.approve_first into approve from public.card_comment_settings s where s.id = 1;
  st := case when coalesce(approve, false) then 'pending' else 'published' end;
  insert into public.card_comments (kind, name, body, device, user_id, status)
  values (p_kind, nm, b, dev, auth.uid(), st)
  returning card_comments.id, card_comments.created_at into new_id, made;
  return jsonb_build_object('id', new_id, 'created_at', made, 'status', st);
end $$;

-- a visitor reports a comment (once per device); 3 different devices hide it until the admin looks
create or replace function public.card_comment_report(p_id uuid, p_device text)
returns void language plpgsql security definer set search_path = public as $$
declare dev text := left(coalesce(trim(p_device), ''), 64); ins int;
begin
  if char_length(dev) < 8 or p_id is null then return; end if;
  insert into public.card_comment_reports (comment_id, device)
    select c.id, dev from public.card_comments c where c.id = p_id
  on conflict do nothing;
  get diagnostics ins = row_count;
  if ins > 0 then
    update public.card_comments c
       set reports = c.reports + 1,
           status = case when c.status = 'published' and c.reports + 1 >= 3 then 'hidden' else c.status end,
           seen = false
     where c.id = p_id;
  end if;
end $$;

revoke all on function public.card_comment_list(int, int) from public;
revoke all on function public.card_comment_add(text, text, text, text) from public;
revoke all on function public.card_comment_report(uuid, text) from public;
grant execute on function public.card_comment_list(int, int) to anon, authenticated;
grant execute on function public.card_comment_add(text, text, text, text) to anon, authenticated;
grant execute on function public.card_comment_report(uuid, text) to anon, authenticated;

-- check: both answers must come without an error (the first list is empty until somebody writes)
select count(*) as comments from public.card_comments;
select * from public.card_comment_list(5, 0);
