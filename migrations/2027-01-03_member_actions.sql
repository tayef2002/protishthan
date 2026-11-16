-- প্রতিযোগিতার ভিত (competition base): one place that remembers WHO did WHAT for WHICH institution, and which division a district belongs to.
--
-- 1) bd_districts / bd_division(): the 64 districts and their 8 divisions (the same list is in bd-locations.js as BD_DIVISIONS). Boards can then be filtered by division.
-- 2) member_actions: a signed-in member's actions (card, memory, skill), one row per member + action + institution, with a counter and the first / last time.
--    It lets the site later say "N members of this batch made a card" without ever showing who did not. The browser cannot write to it directly;
--    only log_member_action() adds, for the signed-in member, and only for listed institutions. A member can read only their own rows.
--    Anonymous downloads are NOT in this table (they are still counted per device by the card board, count_card_institutes).
-- Needs: 2026-10-29_members.sql (member_cards), 2026-10-31_card_leaderboard.sql (listing_submissions rules are the same as count_card_institutes). Safe to run more than once.

create table if not exists public.bd_districts (
  district text primary key,
  division text not null
);
insert into public.bd_districts (district, division) values
  ('ঢাকা', 'ঢাকা'),
  ('গাজীপুর', 'ঢাকা'),
  ('নারায়ণগঞ্জ', 'ঢাকা'),
  ('নরসিংদী', 'ঢাকা'),
  ('মানিকগঞ্জ', 'ঢাকা'),
  ('মুন্সিগঞ্জ', 'ঢাকা'),
  ('কিশোরগঞ্জ', 'ঢাকা'),
  ('টাঙ্গাইল', 'ঢাকা'),
  ('ফরিদপুর', 'ঢাকা'),
  ('গোপালগঞ্জ', 'ঢাকা'),
  ('মাদারীপুর', 'ঢাকা'),
  ('রাজবাড়ী', 'ঢাকা'),
  ('শরীয়তপুর', 'ঢাকা'),
  ('চট্টগ্রাম', 'চট্টগ্রাম'),
  ('কক্সবাজার', 'চট্টগ্রাম'),
  ('কুমিল্লা', 'চট্টগ্রাম'),
  ('ব্রাহ্মণবাড়িয়া', 'চট্টগ্রাম'),
  ('চাঁদপুর', 'চট্টগ্রাম'),
  ('লক্ষ্মীপুর', 'চট্টগ্রাম'),
  ('নোয়াখালী', 'চট্টগ্রাম'),
  ('ফেনী', 'চট্টগ্রাম'),
  ('খাগড়াছড়ি', 'চট্টগ্রাম'),
  ('রাঙ্গামাটি', 'চট্টগ্রাম'),
  ('বান্দরবান', 'চট্টগ্রাম'),
  ('রাজশাহী', 'রাজশাহী'),
  ('নওগাঁ', 'রাজশাহী'),
  ('নাটোর', 'রাজশাহী'),
  ('চাঁপাইনবাবগঞ্জ', 'রাজশাহী'),
  ('পাবনা', 'রাজশাহী'),
  ('বগুড়া', 'রাজশাহী'),
  ('জয়পুরহাট', 'রাজশাহী'),
  ('সিরাজগঞ্জ', 'রাজশাহী'),
  ('খুলনা', 'খুলনা'),
  ('বাগেরহাট', 'খুলনা'),
  ('সাতক্ষীরা', 'খুলনা'),
  ('যশোর', 'খুলনা'),
  ('নড়াইল', 'খুলনা'),
  ('মাগুরা', 'খুলনা'),
  ('ঝিনাইদহ', 'খুলনা'),
  ('কুষ্টিয়া', 'খুলনা'),
  ('চুয়াডাঙ্গা', 'খুলনা'),
  ('মেহেরপুর', 'খুলনা'),
  ('বরিশাল', 'বরিশাল'),
  ('ভোলা', 'বরিশাল'),
  ('ঝালকাঠি', 'বরিশাল'),
  ('পটুয়াখালী', 'বরিশাল'),
  ('পিরোজপুর', 'বরিশাল'),
  ('বরগুনা', 'বরিশাল'),
  ('সিলেট', 'সিলেট'),
  ('মৌলভীবাজার', 'সিলেট'),
  ('হবিগঞ্জ', 'সিলেট'),
  ('সুনামগঞ্জ', 'সিলেট'),
  ('রংপুর', 'রংপুর'),
  ('দিনাজপুর', 'রংপুর'),
  ('গাইবান্ধা', 'রংপুর'),
  ('কুড়িগ্রাম', 'রংপুর'),
  ('লালমনিরহাট', 'রংপুর'),
  ('নীলফামারী', 'রংপুর'),
  ('পঞ্চগড়', 'রংপুর'),
  ('ঠাকুরগাঁও', 'রংপুর'),
  ('ময়মনসিংহ', 'ময়মনসিংহ'),
  ('জামালপুর', 'ময়মনসিংহ'),
  ('শেরপুর', 'ময়মনসিংহ'),
  ('নেত্রকোণা', 'ময়মনসিংহ')
on conflict (district) do update set division = excluded.division;
alter table public.bd_districts enable row level security;
drop policy if exists bd_districts_read on public.bd_districts;
create policy bd_districts_read on public.bd_districts for select to anon, authenticated using (true);
revoke all on public.bd_districts from anon, authenticated;
grant select on public.bd_districts to anon, authenticated;

create or replace function public.bd_division(p_district text)
returns text language sql stable security definer set search_path = public as $$
  select division from public.bd_districts where district = btrim(coalesce(p_district, ''))
$$;
revoke all on function public.bd_division(text) from public;
grant execute on function public.bd_division(text) to anon, authenticated;

create table if not exists public.member_actions (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('card', 'memory', 'skill')),
  institution_slug text not null default '',            -- '' = the member has no listed institution yet
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  n int not null default 1,
  primary key (user_id, action, institution_slug)
);
create index if not exists member_actions_action_slug_idx on public.member_actions (action, institution_slug);
create index if not exists member_actions_first_idx on public.member_actions (first_at);
alter table public.member_actions enable row level security;
drop policy if exists member_actions_own_read on public.member_actions;
create policy member_actions_own_read on public.member_actions for select to authenticated using (user_id = auth.uid());
revoke all on public.member_actions from anon, authenticated;
grant select on public.member_actions to authenticated;

-- log one action of the signed-in member.
--   p_action : 'card' | 'memory' | 'skill'
--   p_slugs  : the institutions on the card (the card page sends them). When none are given (memory card, skill card) the institutions on the member's SAVED education card are used.
-- Only approved, visible listings count; at most 6 institutions per call. Returns how many rows were written (0 = nothing, e.g. not signed in).
create or replace function public.log_member_action(p_action text, p_slugs text[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s text; wrote int := 0; slugs text[] := '{}';
begin
  if uid is null or p_action is null or p_action not in ('card', 'memory', 'skill') then return 0; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text || p_action));
  if p_slugs is not null and array_length(p_slugs, 1) is not null then
    slugs := p_slugs;
  else
    select coalesce(array_agg(distinct e.value ->> 'slug'), '{}') into slugs
      from public.member_cards mc, jsonb_each(coalesce(mc.data -> 'edu', '{}'::jsonb)) e
     where mc.user_id = uid and coalesce(e.value ->> 'slug', '') <> '';
  end if;
  for s in select distinct x from unnest(slugs) x limit 6 loop
    continue when s is null or char_length(s) > 120;
    continue when not exists (select 1 from public.listing_submissions l where l.desired_slug = s and l.status = 'approved' and coalesce(l.is_hidden, false) = false);
    insert into public.member_actions (user_id, action, institution_slug) values (uid, p_action, s)
      on conflict (user_id, action, institution_slug) do update set n = public.member_actions.n + 1, last_at = now();
    wrote := wrote + 1;
  end loop;
  if wrote = 0 then      -- no listed institution known: keep the plain action so the member still counts for a batch
    insert into public.member_actions (user_id, action, institution_slug) values (uid, p_action, '')
      on conflict (user_id, action, institution_slug) do update set n = public.member_actions.n + 1, last_at = now();
    wrote := 1;
  end if;
  return wrote;
end $$;
revoke all on function public.log_member_action(text, text[]) from public;
grant execute on function public.log_member_action(text, text[]) to authenticated;

-- check
select division, count(*) as districts from public.bd_districts group by division order by division;
select public.bd_division('হবিগঞ্জ') as habiganj_division;
