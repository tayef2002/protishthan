-- The /feedback page (2026-12-24). It reads the SAME card_comments table as the card page's board, so a post written on either page shows on both.
-- Two small additions, both read-only for visitors:
--   1) card_comment_feed gets one more optional argument, p_label, so the page can show "what we are working on / what is done" (the status the admin sets in the admin's কার্ড মতামত tab).
--      The old calls (4 arguments) keep working exactly as before.
--   2) card_comment_stats(): the real numbers for the top of the page (published posts, per kind, per status, replied, total votes). No names, no devices.
-- Until this is run, the page still works: the status filter is hidden and the numbers are counted from what is loaded.
-- Safe to run more than once.

drop function if exists public.card_comment_feed(int, int, text, text);
create function public.card_comment_feed(p_limit int default 10, p_offset int default 0, p_kind text default null, p_sort text default 'new', p_label text default null)
returns table (id uuid, created_at timestamptz, kind text, name text, body text, reply text, replied_at timestamptz, votes int, label text, pinned boolean, total bigint)
language sql stable security definer set search_path = public as $$
  select c.id, c.created_at, c.kind, coalesce(nullif(c.name, ''), 'একজন ব্যবহারকারী'), c.body, c.reply, c.replied_at, c.votes, c.status_label, c.pinned, count(*) over ()
    from public.card_comments c
   where c.status = 'published'
     and (p_kind is null or p_kind = '' or c.kind = p_kind)
     and (p_label is null or p_label = ''
          or (p_label = 'open' and (c.status_label is null or c.status_label = 'review'))
          or c.status_label = p_label)
   order by c.pinned desc,
            (case when p_sort = 'top' then c.votes else 0 end) desc,
            c.created_at desc
   limit greatest(1, least(coalesce(p_limit, 10), 30))
  offset greatest(0, least(coalesce(p_offset, 0), 1000))
$$;
revoke all on function public.card_comment_feed(int, int, text, text, text) from public;
grant execute on function public.card_comment_feed(int, int, text, text, text) to anon, authenticated;

create or replace function public.card_comment_stats()
returns table (total bigint, opinions bigint, ideas bigint, problems bigint, replied bigint, planned bigint, progress bigint, done bigint, votes bigint)
language sql stable security definer set search_path = public as $$
  select count(*),
         count(*) filter (where c.kind = 'opinion'),
         count(*) filter (where c.kind = 'idea'),
         count(*) filter (where c.kind = 'problem'),
         count(*) filter (where nullif(trim(coalesce(c.reply, '')), '') is not null),
         count(*) filter (where c.status_label = 'planned'),
         count(*) filter (where c.status_label = 'progress'),
         count(*) filter (where c.status_label = 'done'),
         coalesce(sum(c.votes), 0)
    from public.card_comments c
   where c.status = 'published'
$$;
revoke all on function public.card_comment_stats() from public;
grant execute on function public.card_comment_stats() to anon, authenticated;

-- check: both answer, and the old 4-argument call still works
select * from public.card_comment_stats();
select id, kind, votes, label, total from public.card_comment_feed(3, 0, null, 'top');
select id, kind, votes, label, total from public.card_comment_feed(3, 0, null, 'new', 'done');
