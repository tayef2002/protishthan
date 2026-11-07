-- Run in the SQL Editor of protishthan-social (safe to run again).
-- Adds a new content type 'series' (the three daily university series) next to text / card / reel.

alter table public.fb_posts drop constraint if exists fb_posts_kind_check;
alter table public.fb_posts add constraint fb_posts_kind_check check (kind in ('text','card','reel','series'));
