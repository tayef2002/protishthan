-- Protishthan social posting server.
-- Run this in the SQL Editor of the NEW Supabase project (protishthan-social), NOT the main site project.
-- It creates the queue table, the image bucket and the functions the publisher uses.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- one row per Facebook post waiting to go out (or already gone out)
create table if not exists public.fb_posts (
  id             uuid primary key default gen_random_uuid(),
  page_key       text not null,                 -- name of the page inside the FB_PAGES secret, e.g. 'main'
  image_path     text not null,                 -- file name inside the 'cards' bucket
  caption        text not null default '',
  first_comment  text,                          -- optional, posted right after the photo
  scheduled_at   timestamptz not null,
  status         text not null default 'queued' check (status in ('queued','publishing','posted','failed')),
  attempts       int  not null default 0,
  claimed_at     timestamptz,
  fb_post_id     text,
  comment_status text check (comment_status in ('posted','failed')),
  error          text,
  posted_at      timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists fb_posts_due_idx on public.fb_posts (scheduled_at) where status = 'queued';

-- private settings (function URL + shared secret); nobody but the service role can read them
create table if not exists public.social_config (
  key   text primary key,
  value text not null
);

-- lock both tables: no public access at all (the server and our scripts use the service role key)
alter table public.fb_posts enable row level security;
alter table public.social_config enable row level security;
revoke all on public.fb_posts from anon, authenticated;
revoke all on public.social_config from anon, authenticated;

-- public bucket so Facebook can fetch the image by URL (file names are random, nothing is listed)
insert into storage.buckets (id, name, public) values ('cards', 'cards', true) on conflict (id) do nothing;

-- take the next due posts, one runner at a time (no double posting)
create or replace function public.claim_due_posts(p_limit int default 3)
returns setof public.fb_posts
language plpgsql security definer set search_path = public as $$
begin
  return query
  with c as (
    select id from public.fb_posts
    where status = 'queued' and scheduled_at <= now() and attempts < 3
    order by scheduled_at
    limit p_limit
    for update skip locked
  )
  update public.fb_posts p
     set status = 'publishing', attempts = p.attempts + 1, claimed_at = now()
    from c
   where p.id = c.id
  returning p.*;
end $$;
revoke all on function public.claim_due_posts(int) from public, anon, authenticated;
grant execute on function public.claim_due_posts(int) to service_role;

-- called by pg_cron every minute: wakes the publisher only when something is due
create or replace function public.run_publisher()
returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  -- a post stuck in 'publishing' is NOT retried automatically (it may already be live): flag it for a human
  update public.fb_posts
     set status = 'failed', error = 'stuck while publishing, check the Facebook page before queueing again'
   where status = 'publishing' and claimed_at < now() - interval '20 minutes';

  if not exists (select 1 from public.fb_posts where status = 'queued' and scheduled_at <= now() and attempts < 3) then
    return;
  end if;

  select value into v_url    from public.social_config where key = 'function_url';
  select value into v_secret from public.social_config where key = 'cron_secret';
  if v_url is null or v_secret is null then return; end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end $$;
revoke all on function public.run_publisher() from public, anon, authenticated;
