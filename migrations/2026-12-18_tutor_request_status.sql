-- ভাইয়া-আপু: a guardian can see what became of their request ("we are looking", "tutors were sent", "matched").
-- Needs 2026-12-17_tutors.sql. Safe to run more than once.
--
-- The request id (a random UUID nobody can guess) is given to the guardian's browser when the request is sent; the page keeps it on that device and asks this function.
-- It answers only the status, when it was sent, and how many tutor profiles were sent to the guardian. Never a name, a number, a tutor or a note. A request marked spam answers nothing.

create or replace function public.tutor_request_status(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('status', r.status, 'created_at', r.created_at, 'sent', (select count(*)::int from public.tutor_matches m where m.request_id = r.id))
    from public.tutor_requests r
   where r.id = p_id and r.status <> 'spam'
$$;

revoke all on function public.tutor_request_status(uuid) from public;
grant execute on function public.tutor_request_status(uuid) to anon, authenticated;

-- check: answers null for an id that does not exist
select public.tutor_request_status('00000000-0000-0000-0000-000000000000') as nothing;
