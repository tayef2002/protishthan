-- Protishthan's own income from institutions + Army commission per payment.
-- Rule: an institution's FIRST payment gives its Army owner 50%, every later payment 25%.
-- Only admins (admin_users / is_admin()) can record payments or mark commission as paid.
-- Run 2026-10-26_admin_users.sql first. Safe to run more than once.

-- 1) payments an institution makes to Protishthan (entered by an admin)
create table if not exists public.institution_payments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_at date not null default current_date,
  method text not null default 'bkash',
  reference text,
  period_label text,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists institution_payments_inst_idx on public.institution_payments (institution_id, paid_at);

alter table public.institution_payments enable row level security;
drop policy if exists institution_payments_admin_all on public.institution_payments;
create policy institution_payments_admin_all on public.institution_payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2) commission rows now point at the payment they came from
alter table public.agent_commissions add column if not exists payment_id uuid references public.institution_payments(id) on delete cascade;
alter table public.agent_commissions add column if not exists rate numeric;
alter table public.agent_commissions add column if not exists kind text;
create unique index if not exists agent_commissions_payment_uidx on public.agent_commissions (payment_id) where payment_id is not null;

alter table public.agent_commissions enable row level security;
drop policy if exists agent_commissions_admin_all on public.agent_commissions;
create policy agent_commissions_admin_all on public.agent_commissions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists agent_commissions_member_read on public.agent_commissions;
create policy agent_commissions_member_read on public.agent_commissions
  for select to authenticated
  using (agent_id in (select a.id from public.agents a where a.user_id = auth.uid()));

-- 3) every recorded payment creates the owner's commission automatically
create or replace function public.commission_from_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid; inst_name text; earlier int; pct numeric;
begin
  select assigned_agent_id, name into owner, inst_name from public.institutions where id = new.institution_id;
  if owner is null then return new; end if;            -- nobody verified/brought it: no commission
  select count(*) into earlier from public.institution_payments
   where institution_id = new.institution_id and id <> new.id
     and (paid_at < new.paid_at or (paid_at = new.paid_at and created_at < new.created_at));
  pct := case when earlier = 0 then 50 else 25 end;
  insert into public.agent_commissions (agent_id, institution_id, institution_name, amount, status, payment_id, rate, kind)
  values (owner, new.institution_id, inst_name, round(new.amount * pct / 100, 2), 'pending', new.id, pct,
          case when earlier = 0 then 'first' else 'recurring' end)
  on conflict do nothing;
  -- the first payment also marks the institution as paying since that date
  update public.institutions set paid_since = new.paid_at where id = new.institution_id and paid_since is null;
  return new;
end $$;

drop trigger if exists commission_from_payment on public.institution_payments;
create trigger commission_from_payment after insert on public.institution_payments
for each row execute function public.commission_from_payment();

-- 4) the old one-off "commission when the plan changes" would now double count — switch it off
drop trigger if exists trg_auto_create_commission on public.institutions;

-- 5) admin marks a member's commission as handed over (bKash etc.)
create or replace function public.mark_commission_paid(ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  update public.agent_commissions set status = 'paid', paid_at = now()
   where id = any(ids) and status <> 'paid';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mark_commission_paid(uuid[]) from public;
grant execute on function public.mark_commission_paid(uuid[]) to authenticated;

-- 6) check
select 'institution_payments' as t, count(*) from public.institution_payments
union all select 'agent_commissions', count(*) from public.agent_commissions;
