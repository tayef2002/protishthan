-- agent_commissions was still readable without login: an older, open policy
-- sits next to the new ones. Drop every policy on the table except the two
-- from 2026-10-26_institution_payments.sql (admin: all, member: own rows).
-- Safe to run more than once.

-- 1) what is there now (look before it is removed)
select policyname, cmd, roles::text, qual from pg_policies
where schemaname = 'public' and tablename = 'agent_commissions';

-- 2) remove the old open policies
do $$
declare r record;
begin
  for r in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'agent_commissions'
             and policyname not in ('agent_commissions_admin_all', 'agent_commissions_member_read')
  loop
    execute format('drop policy %I on public.agent_commissions', r.policyname);
  end loop;
end $$;

alter table public.agent_commissions enable row level security;
revoke all on public.agent_commissions from anon;

-- 3) check: only the two new policies should remain
select policyname, cmd, roles::text from pg_policies
where schemaname = 'public' and tablename = 'agent_commissions';
