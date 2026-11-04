-- "এটাই আমার প্রতিষ্ঠান": a signed-in member claims a listed institution; an admin (or the Partner it is assigned to) reviews.
--  * claims live in their own table, which only the claimant and admins can read (the phone number never reaches the public listing)
--  * approving a claim marks the listing as confirmed by the institution itself (claimed_at / claimed_role, both public) and "verified"
--  * one institution can have only one approved claim; one member can have only one open claim per institution
-- Run after 2026-11-25_contributor_credit.sql. Safe to run more than once.

alter table public.listing_submissions add column if not exists claimed_at timestamptz, add column if not exists claimed_role text;

-- owners may not edit the claim marks themselves
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
    new.contributor_id := old.contributor_id;
    new.verified_at := old.verified_at;
    new.verified_method := old.verified_method;
    new.contributor_name := old.contributor_name;
    new.claimed_at := old.claimed_at;
    new.claimed_role := old.claimed_role;
  end if;
  return new;
end $$;

create table if not exists public.institution_claims (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listing_submissions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  claimant_name text not null check (char_length(claimant_name) between 2 and 80),
  role text not null check (role in ('head', 'owner', 'teacher', 'staff')),
  phone text not null check (phone ~ '^01[0-9]{9}$'),
  email text check (email is null or char_length(email) <= 120),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists claim_one_open on public.institution_claims (listing_id, user_id) where status = 'pending';
create unique index if not exists claim_one_approved on public.institution_claims (listing_id) where status = 'approved';
create index if not exists claim_user_idx on public.institution_claims (user_id, created_at desc);
create index if not exists claim_open_idx on public.institution_claims (status, created_at) where status = 'pending';
alter table public.institution_claims enable row level security;
revoke all on public.institution_claims from anon, authenticated;
grant select on public.institution_claims to authenticated;
drop policy if exists claim_own_read on public.institution_claims;
create policy claim_own_read on public.institution_claims for select to authenticated using (user_id = auth.uid());
drop policy if exists claim_admin_read on public.institution_claims;
create policy claim_admin_read on public.institution_claims for select to authenticated using (public.is_admin());

-- submit a claim
create or replace function public.submit_claim(p_listing uuid, p_name text, p_role text, p_phone text, p_email text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare l public.listing_submissions; cid uuid; nm text := btrim(coalesce(p_name, '')); ph text := btrim(coalesce(p_phone, '')); em text := nullif(btrim(coalesce(p_email, '')), '');
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  perform public.ensure_member();
  select * into l from public.listing_submissions where id = p_listing and status = 'approved';
  if not found then raise exception 'NOT_FOUND'; end if;
  if l.claimed_at is not null then raise exception 'ALREADY_CLAIMED'; end if;
  if char_length(nm) < 2 or char_length(nm) > 80 then raise exception 'BAD_NAME'; end if;
  if p_role is null or p_role not in ('head', 'owner', 'teacher', 'staff') then raise exception 'BAD_ROLE'; end if;
  if ph !~ '^01[0-9]{9}$' then raise exception 'BAD_PHONE'; end if;
  if em is not null and em !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'BAD_EMAIL'; end if;
  if (select count(*) from public.institution_claims where user_id = auth.uid() and status = 'pending') >= 5 then raise exception 'TOO_MANY'; end if;
  if (select count(*) from public.institution_claims where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then raise exception 'TOO_MANY'; end if;
  insert into public.institution_claims (listing_id, user_id, claimant_name, role, phone, email, note)
  values (p_listing, auth.uid(), nm, p_role, ph, left(em, 120), left(nullif(btrim(coalesce(p_note, '')), ''), 500))
  returning id into cid;
  return cid;
exception when unique_violation then raise exception 'ALREADY_PENDING';
end $$;
revoke all on function public.submit_claim(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.submit_claim(uuid, text, text, text, text, text) to authenticated;

-- review: an admin, or the Partner the listing is assigned to
create or replace function public.review_claim(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.institution_claims; l public.listing_submissions;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into c from public.institution_claims where id = p_id and status = 'pending' for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into l from public.listing_submissions where id = c.listing_id for update;
  if not (public.is_admin() or l.assigned_agent_id in (select a.id from public.agents a where a.user_id = auth.uid())) then raise exception 'NOT_ALLOWED'; end if;
  if p_approve then
    if l.claimed_at is not null then raise exception 'ALREADY_CLAIMED'; end if;
    update public.listing_submissions x set
      claimed_at = now(), claimed_role = c.role,
      verification = 'verified',
      verified_at = coalesce(x.verified_at, now()),
      verified_method = coalesce(x.verified_method, 'claimed')
    where x.id = c.listing_id;
    update public.institution_claims set status = 'rejected', review_note = 'অন্য একটি দাবি অনুমোদিত হয়েছে', reviewed_by = auth.uid(), reviewed_at = now()
      where listing_id = c.listing_id and status = 'pending' and id <> c.id;
  end if;
  update public.institution_claims set status = case when p_approve then 'approved' else 'rejected' end,
    review_note = left(nullif(btrim(coalesce(p_note, '')), ''), 300), reviewed_by = auth.uid(), reviewed_at = now()
  where id = c.id;
end $$;
revoke all on function public.review_claim(uuid, boolean, text) from public, anon;
grant execute on function public.review_claim(uuid, boolean, text) to authenticated;

-- what the institution page needs: is it already claimed, and what is MY claim's state (never who else claimed)
create or replace function public.claim_state(p_listing uuid)
returns table (claimed boolean, mine text, mine_note text) language sql stable security definer set search_path = public as $$
  select (select l.claimed_at is not null from public.listing_submissions l where l.id = p_listing),
         (select c.status from public.institution_claims c where c.listing_id = p_listing and c.user_id = auth.uid() order by c.created_at desc limit 1),
         (select c.review_note from public.institution_claims c where c.listing_id = p_listing and c.user_id = auth.uid() order by c.created_at desc limit 1)
$$;
revoke all on function public.claim_state(uuid) from public;
grant execute on function public.claim_state(uuid) to anon, authenticated;
