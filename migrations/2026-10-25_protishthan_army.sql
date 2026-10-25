-- Protishthan Army (formerly "Agent"): upazila-based membership, up to 3 per upazila,
-- and members can no longer change the plan / payment fields that drive commission.
-- Safe to run more than once.

-- 1) members now belong to an upazila, not a whole district
alter table public.agents add column if not exists upazila text;
create index if not exists agents_district_upazila_idx on public.agents (district, upazila);

-- 2) drop the old "one agent per district" uniqueness (constraint or plain unique index)
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.agents'::regclass and c.contype = 'u'
      and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
           where a.attrelid = c.conrelid and a.attnum = any(c.conkey)) = array['district']
  loop
    execute format('alter table public.agents drop constraint %I', r.conname);
  end loop;
  for r in
    select i.indexrelid::regclass::text as idx
    from pg_index i
    where i.indrelid = 'public.agents'::regclass and i.indisunique and not i.indisprimary
      and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)
      and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
           where a.attrelid = i.indrelid and a.attnum = any(i.indkey)) = array['district']
  loop
    execute format('drop index %s', r.idx);
  end loop;
end $$;

-- 3) at most 3 active (not rejected) members per upazila
create or replace function public.army_seat_limit()
returns trigger language plpgsql as $$
begin
  if new.upazila is null or new.status = 'rejected' then return new; end if;
  perform pg_advisory_xact_lock(hashtext(coalesce(new.district,'') || '|' || new.upazila));
  if (select count(*) from public.agents a
      where a.district = new.district and a.upazila = new.upazila
        and a.status <> 'rejected' and a.id <> new.id) >= 3 then
    raise exception 'ARMY_UPAZILA_FULL: % উপজেলায় ৩ জন Army সদস্য পূর্ণ', new.upazila;
  end if;
  return new;
end $$;

drop trigger if exists army_seat_limit on public.agents;
create trigger army_seat_limit before insert or update of district, upazila, status on public.agents
for each row execute function public.army_seat_limit();

-- 4) an Army member may edit an institution's basic info, but never its plan,
--    payment date or which member it belongs to (those decide the commission)
create or replace function public.army_protect_billing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.agents a where a.user_id = auth.uid())
     and (new.plan is distinct from old.plan
          or new.paid_since is distinct from old.paid_since
          or new.assigned_agent_id is distinct from old.assigned_agent_id) then
    raise exception 'ARMY_BILLING_LOCKED: প্ল্যান ও পেমেন্টের তথ্য শুধু Admin পরিবর্তন করতে পারবেন';
  end if;
  return new;
end $$;

drop trigger if exists army_protect_billing on public.institutions;
create trigger army_protect_billing before update on public.institutions
for each row execute function public.army_protect_billing();

-- 5) check: which existing triggers/functions assign institutions to a member?
--    (paste this result back so the "whoever verifies it first owns it" rule can be wired in)
select p.proname as function_name, t.tgname as trigger_name, t.tgrelid::regclass as on_table
from pg_proc p
left join pg_trigger t on t.tgfoid = p.oid and not t.tgisinternal
where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
  and (pg_get_functiondef(p.oid) ilike '%assigned_agent_id%' or pg_get_functiondef(p.oid) ilike '%from public.agents%' or pg_get_functiondef(p.oid) ilike '%from agents%')
  and p.proname not in ('army_seat_limit', 'army_protect_billing');
