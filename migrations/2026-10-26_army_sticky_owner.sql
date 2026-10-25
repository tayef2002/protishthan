-- Protishthan Army: an institution's owner (assigned_agent_id) is sticky.
-- Before: every plan/district change re-picked "any approved agent of the district"
-- (limit 1, no order), so with several members per district the owner — and the
-- commission — could jump to a random person. Now the owner is never auto-picked
-- and never overwritten; it is set when a member's listing is linked to the
-- institution (later: when a member's verification is approved).
-- Safe to run more than once.

-- 1) institutions: keep whatever owner is already set; no district guessing
create or replace function public.auto_assign_agent_institutions()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    new.assigned_agent_id := coalesce(new.assigned_agent_id, old.assigned_agent_id);
  end if;
  return new;
end $$;

-- 2) listings: same rule
create or replace function public.auto_assign_agent_listings()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    new.assigned_agent_id := coalesce(new.assigned_agent_id, old.assigned_agent_id);
  end if;
  return new;
end $$;

-- 3) when a listing that belongs to a member gets linked to its institution,
--    the institution inherits that member (only if it has no owner yet)
create or replace function public.army_owner_from_listing()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.institution_id is not null and new.assigned_agent_id is not null then
    update public.institutions
       set assigned_agent_id = new.assigned_agent_id
     where id = new.institution_id and assigned_agent_id is null;
  end if;
  return new;
end $$;

drop trigger if exists army_owner_from_listing on public.listing_submissions;
create trigger army_owner_from_listing after insert or update of institution_id, assigned_agent_id on public.listing_submissions
for each row execute function public.army_owner_from_listing();

-- 4) check: how many rows currently have an owner (counts only, no personal data)
select 'institutions' as t, count(*) filter (where assigned_agent_id is not null) as with_owner, count(*) as total from public.institutions
union all
select 'listing_submissions', count(*) filter (where assigned_agent_id is not null), count(*) from public.listing_submissions
union all
select 'agents (approved)', count(*) filter (where status = 'approved'), count(*) from public.agents;
