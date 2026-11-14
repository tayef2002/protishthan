-- আমার ব্যাচ: how many people each member brought into each of their batches (the invite code is already recorded when someone joins through a link).
-- One small function for the member's dashboard; it only ever counts the caller's own invitations and returns no names.
-- Needs: 2026-12-26_batches.sql. Safe to run more than once.

create or replace function public.batch_my_invites()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'batch_id', m.batch_id,
      'invited', (select count(*) from public.batch_members x where x.batch_id = m.batch_id and x.invited_by = uid)))
    from public.batch_members m where m.user_id = uid
  ), '[]'::jsonb);
end $$;

revoke all on function public.batch_my_invites() from public;
grant execute on function public.batch_my_invites() to authenticated;

-- check
select count(*) as batches from public.batches;
