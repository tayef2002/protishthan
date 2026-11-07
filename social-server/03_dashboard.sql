-- Run this in the SQL Editor of the protishthan-social project (after 01_schema.sql and 02_cron_SECRET.sql).
-- Adds: content kinds (text / card / reel), a 'stock' state for finished content that is not scheduled yet,
-- titles and thumbnails for the /content dashboard. Safe to run more than once.

-- finished content waiting in stock has no time yet
alter table public.fb_posts alter column scheduled_at drop not null;

alter table public.fb_posts drop constraint if exists fb_posts_status_check;
alter table public.fb_posts add constraint fb_posts_status_check check (status in ('stock','queued','publishing','posted','failed'));

alter table public.fb_posts add column if not exists kind text not null default 'card';
alter table public.fb_posts drop constraint if exists fb_posts_kind_check;
alter table public.fb_posts add constraint fb_posts_kind_check check (kind in ('text','card','reel'));

alter table public.fb_posts add column if not exists title text;
alter table public.fb_posts add column if not exists thumb_path text;   -- small preview in the 'thumbs' bucket
alter table public.fb_posts add column if not exists sort_key text;     -- order inside the stock (file name order)
alter table public.fb_posts add column if not exists rank bigint;       -- 'move to front' sets a small number here; empty = normal order

-- the first test post was a text card
update public.fb_posts set kind = 'text', title = coalesce(title, 'পরীক্ষার আগের রাতে (টেস্ট পোস্ট)')
 where kind = 'card' and caption like 'কমেন্টে বলুন, কার এমন হয়%';

-- small previews; names are random, the dashboard only hands out the links after the access code
insert into storage.buckets (id, name, public) values ('thumbs', 'thumbs', true) on conflict (id) do nothing;

create index if not exists fb_posts_status_time_idx on public.fb_posts (status, scheduled_at);
