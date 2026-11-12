-- শিক্ষিত কার্ডের মতামত বোর্ড, দ্বিতীয় ধাপ: ভোট (সমর্থন), অবস্থা-ট্যাগ, পিন, রিপোর্টের কারণ, ধরন ও জনপ্রিয়তা অনুযায়ী সাজানো।
-- Opinion board, step 2 (needs 2026-12-15_card_comments.sql first): votes, a status label the admin sets (under review / planned / in progress / done), a pin, the reason of a report,
-- and a feed that can be filtered by kind and sorted by votes. ONLY ADDS: the old functions (card_comment_list, card_comment_report) stay exactly as they are, so the live board keeps
-- working while this is run, and an old copy of the page still works. Safe to run more than once.
--
--   votes:  one per device per comment (a second tap takes it back). 60 new votes per device per hour. Only published comments can be voted on.
--   labels: set by the admin in the "কার্ড মতামত" tab; shown as a small tag on the comment (ideas and problems mostly: "পরিকল্পনায়", "কাজ চলছে", "হয়ে গেছে").
--   pin:    the admin can pin a comment to the top of the board.

alter table public.card_comments add column if not exists votes int not null default 0;
alter table public.card_comments add column if not exists status_label text check (status_label is null or status_label in ('review', 'planned', 'progress', 'done'));
alter table public.card_comments add column if not exists pinned boolean not null default false;
alter table public.card_comment_reports add column if not exists reason text check (reason is null or reason in ('spam', 'abuse', 'private', 'other'));

create table if not exists public.card_comment_votes (
  comment_id uuid not null references public.card_comments(id) on delete cascade,
  device text not null check (char_length(device) between 8 and 64),
  created_at timestamptz not null default now(),
  primary key (comment_id, device)
);
create index if not exists card_comment_votes_device_idx on public.card_comment_votes (device, created_at desc);
create index if not exists card_comments_top_idx on public.card_comments (votes desc, created_at desc) where status = 'published';

alter table public.card_comment_votes enable row level security;
revoke all on public.card_comment_votes from anon, authenticated;
grant select on public.card_comment_votes to authenticated;
drop policy if exists card_comment_votes_admin on public.card_comment_votes;
create policy card_comment_votes_admin on public.card_comment_votes for select to authenticated using (public.is_admin());

-- the public feed: published comments, the pinned one first, then newest ('new') or most voted ('top'); optionally one kind only
create or replace function public.card_comment_feed(p_limit int default 10, p_offset int default 0, p_kind text default null, p_sort text default 'new')
returns table (id uuid, created_at timestamptz, kind text, name text, body text, reply text, replied_at timestamptz, votes int, label text, pinned boolean, total bigint)
language sql stable security definer set search_path = public as $$
  select c.id, c.created_at, c.kind, coalesce(nullif(c.name, ''), 'একজন ব্যবহারকারী'), c.body, c.reply, c.replied_at, c.votes, c.status_label, c.pinned, count(*) over ()
    from public.card_comments c
   where c.status = 'published'
     and (p_kind is null or p_kind = '' or c.kind = p_kind)
   order by c.pinned desc,
            (case when p_sort = 'top' then c.votes else 0 end) desc,
            c.created_at desc
   limit greatest(1, least(coalesce(p_limit, 10), 30))
  offset greatest(0, least(coalesce(p_offset, 0), 1000))
$$;

-- a vote on (p_on = true) or off (false); answers the new number of votes. Raises BAD_DEVICE, TOO_FAST, NOT_FOUND.
create or replace function public.card_comment_vote(p_id uuid, p_device text, p_on boolean default true)
returns int language plpgsql security definer set search_path = public as $$
declare dev text := left(coalesce(trim(p_device), ''), 64); n int; changed int;
begin
  if char_length(dev) < 8 or p_id is null then raise exception 'BAD_DEVICE'; end if;
  if (select count(*) from public.card_comment_votes v where v.device = dev and v.created_at > now() - interval '1 hour') >= 60 then raise exception 'TOO_FAST'; end if;
  if not exists (select 1 from public.card_comments c where c.id = p_id and c.status = 'published') then raise exception 'NOT_FOUND'; end if;
  if coalesce(p_on, true) then
    insert into public.card_comment_votes (comment_id, device) values (p_id, dev) on conflict do nothing;
    get diagnostics changed = row_count;
    if changed > 0 then update public.card_comments c set votes = c.votes + 1 where c.id = p_id; end if;
  else
    delete from public.card_comment_votes v where v.comment_id = p_id and v.device = dev;
    get diagnostics changed = row_count;
    if changed > 0 then update public.card_comments c set votes = greatest(0, c.votes - 1) where c.id = p_id; end if;
  end if;
  select c.votes into n from public.card_comments c where c.id = p_id;
  return coalesce(n, 0);
end $$;

-- a report with its reason (spam / abuse / private / other); same rule as before: once per device, 3 different devices hide the comment until the admin looks
create or replace function public.card_comment_flag(p_id uuid, p_device text, p_reason text default 'other')
returns void language plpgsql security definer set search_path = public as $$
declare dev text := left(coalesce(trim(p_device), ''), 64); ins int;
        why text := case when p_reason in ('spam', 'abuse', 'private', 'other') then p_reason else 'other' end;
begin
  if char_length(dev) < 8 or p_id is null then return; end if;
  insert into public.card_comment_reports (comment_id, device, reason)
    select c.id, dev, why from public.card_comments c where c.id = p_id
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

revoke all on function public.card_comment_feed(int, int, text, text) from public;
revoke all on function public.card_comment_vote(uuid, text, boolean) from public;
revoke all on function public.card_comment_flag(uuid, text, text) from public;
grant execute on function public.card_comment_feed(int, int, text, text) to anon, authenticated;
grant execute on function public.card_comment_vote(uuid, text, boolean) to anon, authenticated;
grant execute on function public.card_comment_flag(uuid, text, text) to anon, authenticated;

-- check: the feed answers without an error, and the votes column exists
select id, kind, votes, label, pinned, total from public.card_comment_feed(5, 0, null, 'top');
select count(*) as comments, coalesce(sum(votes), 0) as votes from public.card_comments;
