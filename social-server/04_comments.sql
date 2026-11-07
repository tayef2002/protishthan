-- Run in the SQL Editor of protishthan-social (safe to run again).
-- Wakes the publisher also when a reel's first comment is waiting (so it goes out about a minute after the reel).

create or replace function public.run_publisher()
returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  -- a post stuck in 'publishing' is NOT retried automatically (it may already be live): flag it for a human
  update public.fb_posts
     set status = 'failed', error = 'stuck while publishing, check the Facebook page before queueing again'
   where status = 'publishing' and claimed_at < now() - interval '20 minutes';

  if not exists (select 1 from public.fb_posts where status = 'queued' and scheduled_at <= now() and attempts < 3)
     and not exists (select 1 from public.fb_posts
                      where status = 'posted' and comment_status is null and first_comment is not null
                        and posted_at < now() - interval '60 seconds' and posted_at > now() - interval '6 hours') then
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
