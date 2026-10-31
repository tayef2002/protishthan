-- প্রতিষ্ঠানের ইমেইল: stored, but hidden.
--  * the full address lives in a closed table nobody can read from the browser (no policies, no grants)
--  * the public listing only carries a masked hint ("sha*****ed@gmail.com"): enough for the owner to recognise it, useless to a spammer
--  * only an admin, or the Partner a listing is assigned to, can read the full address (listing_email())
-- Run after 2026-11-13 (listing lockdown). Safe to run more than once.

-- 1) the masked hint, public like the rest of the listing; only an admin / the server can set it
alter table public.listing_submissions add column if not exists email_hint text;

-- 2) the full address, closed
create table if not exists public.listing_private_contacts (
  listing_id uuid primary key references public.listing_submissions(id) on delete cascade,
  email text not null,
  source text,
  created_at timestamptz not null default now()
);
alter table public.listing_private_contacts enable row level security;        -- no policies: nobody reads it from the browser
revoke all on public.listing_private_contacts from anon, authenticated;

-- 3) how an address is masked: first 3 + ***** + last 2 of the part before @ (shorter names show less); common mail providers keep their
--    domain, any other domain is hidden except its first letter and ending (so a school's own mail domain does not leak)
create or replace function public.mask_email(e text)
returns text language plpgsql immutable as $$
declare lp text; dm text; tld text; lab text; shown text;
begin
  e := lower(btrim(coalesce(e, '')));
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return null; end if;
  lp := split_part(e, '@', 1); dm := split_part(e, '@', 2);
  if char_length(lp) <= 3 then shown := left(lp, 1) || '*****';
  elsif char_length(lp) <= 6 then shown := left(lp, 2) || '*****';
  else shown := left(lp, 3) || '*****' || right(lp, 2); end if;
  if dm in ('gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'yahoo.co.uk', 'ymail.com') then
    return shown || '@' || dm;
  end if;
  tld := regexp_replace(dm, '^[^.]+\.', '');
  lab := split_part(dm, '.', 1);
  return shown || '@' || left(lab, 1) || '*****.' || tld;
end $$;

-- 4) the full address, for an admin or the assigned Partner only
create or replace function public.listing_email(p_listing uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare l public.listing_submissions;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into l from public.listing_submissions where id = p_listing;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not (public.is_admin() or l.assigned_agent_id in (select a.id from public.agents a where a.user_id = auth.uid())) then raise exception 'NOT_ALLOWED'; end if;
  return (select c.email from public.listing_private_contacts c where c.listing_id = p_listing);
end $$;
revoke all on function public.listing_email(uuid) from public;
grant execute on function public.listing_email(uuid) to authenticated;

-- 5) the guard also keeps the hint away from non-admin edits
create or replace function public.listing_guard()
returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    new.status := old.status;
    new.desired_slug := old.desired_slug;
    new.institution_id := old.institution_id;
    new.assigned_agent_id := old.assigned_agent_id;
    new.prn_number := old.prn_number;
    new.verification := old.verification;
    new.source := old.source;
    new.source_url := old.source_url;
    new.source_id := old.source_id;
    new.collected_at := old.collected_at;
    new.name_en := old.name_en;
    new.email_hint := old.email_hint;
  end if;
  return new;
end $$;

-- check
select public.mask_email('shakhariahs@gmail.com') as a, public.mask_email('abc@gmail.com') as b, public.mask_email('principal@abcschool.edu.bd') as c, public.mask_email('nonsense') as d;
