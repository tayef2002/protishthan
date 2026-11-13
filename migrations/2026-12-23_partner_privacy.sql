-- Partner privacy (2026-12-23). With only the PUBLIC key (the one in every page of the site) anyone could read:
--   * the whole Partner list: full name, mobile, e-mail, referral code, commission rate and type  (public.agents)
--   * every Partner's name, district and the commission earned                                    (the view public.agent_commission_summary)
-- Nothing in the site needs that: a Partner reads only their own row (partner-dashboard, partner-login), the admin reads all, and applying only inserts.
--
-- What this does
--   1) agents: row security on, every old policy removed, and five exact ones made:
--        admin: everything · a Partner: only their own row · anyone: may APPLY (insert) but only as 'pending_review', never pre-approved
--   2) the view reads with the caller's rights (security_invoker) and the public key is refused
--   3) the 3-seats-per-upazila trigger counted rows as whoever applied; with row security that would count only their own rows, so it now runs as the owner
-- Not touched on purpose: public.institutions (it also holds mobile and e-mail, but the old pages and the phone login read it; that needs its own plan).
-- Run once. If a Partner cannot apply or the admin's Partner Management looks empty afterwards, tell me: the first check below shows what is left.

alter table public.agents enable row level security;

do $$ declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'agents' loop
    execute format('drop policy if exists %I on public.agents', p.policyname);
  end loop;
end $$;

create policy agents_admin_all on public.agents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy agents_own_read on public.agents for select to authenticated
  using (user_id = auth.uid());
create policy agents_apply on public.agents for insert to anon, authenticated
  with check (status = 'pending_review' and approved_at is null and approved_by is null);

revoke all on public.agents from anon;
grant insert on public.agents to anon;

alter view public.agent_commission_summary set (security_invoker = true);
revoke all on public.agent_commission_summary from anon;

alter function public.army_seat_limit() security definer set search_path = public;

-- check 1: the policies that are left on agents (should be exactly three)
select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'agents' order by policyname;
-- check 2: with the public key these two must now answer 401 / empty (open a private window, or ask me to test it)
