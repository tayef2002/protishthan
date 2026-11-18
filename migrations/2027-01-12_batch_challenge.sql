-- প্রতিষ্ঠান লিগ, step 3: ব্যাচ চ্যালেঞ্জ, the LIVE game ("ব্যাচ বনাম ঘড়ি": a batch fills a bar together, inside a set time).
--  * A member of a batch (>= 5 members) sets a time (15 minutes to 7 days ahead). At that time everybody who is there plays the SAME 12 questions at the SAME moment: question i opens at start + i * 14 s and can be
--    answered for 12 s (+ 1.5 s of grace for a slow phone). Every right answer fills the batch's bar; the goal (target) is a number of right answers. The batch that reaches it wins the round.
--  * The questions are chosen from the VERIFIED bank at the start, never given before (4 s) and never with the answer; the right answer is told by quiz-style answer only after the player answered.
--  * Only members of the host batch can join (self-declared batch membership, as everywhere). One answer per question per player. The server decides the window; the browser only shows it.
--  * The live numbers (players, right answers per question) are PUBLIC and counts only; they are read from an edge cache (functions/api/challenge.js), not by every player every second.
--  * Names appear only in the result and only to those who played in that challenge: the first names of the best five (the same first names the batch page already shows its members).
--  * mode 'rope' (batch against batch) and opp_batch_id are for the next step; nothing in this file uses them yet.
-- Needs the batch tables (2026-12-26_batches.sql ... 2027-01-06), the question bank (2027-01-10_quiz_bank.sql). Safe to run more than once.

create table if not exists public.batch_challenges (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  mode text not null default 'clock' check (mode in ('clock', 'rope')),
  opp_batch_id uuid references public.batches(id) on delete set null,
  start_at timestamptz not null,
  slots int not null default 12 check (slots between 5 and 20),
  slot_s int not null default 14 check (slot_s between 10 and 30),
  window_s int not null default 12 check (window_s between 8 and 25),
  target int not null default 40 check (target between 5 and 600),
  qids uuid[],
  cancelled boolean not null default false,
  check (window_s < slot_s)
);
create index if not exists batch_challenges_start_idx on public.batch_challenges (start_at desc);
create index if not exists batch_challenges_batch_idx on public.batch_challenges (batch_id, start_at desc);
create table if not exists public.challenge_players (
  challenge_id uuid not null references public.batch_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create table if not exists public.challenge_answers (
  challenge_id uuid not null references public.batch_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check (slot between 0 and 19),
  qid uuid not null,
  choice smallint not null check (choice between 0 and 3),
  correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key (challenge_id, user_id, slot)
);
create index if not exists challenge_answers_slot_idx on public.challenge_answers (challenge_id, slot) where correct;
alter table public.batch_challenges enable row level security;
alter table public.challenge_players enable row level security;
alter table public.challenge_answers enable row level security;
revoke all on public.batch_challenges, public.challenge_players, public.challenge_answers from anon, authenticated;
grant select, insert, update, delete on public.batch_challenges, public.challenge_players, public.challenge_answers to authenticated;
drop policy if exists batch_challenges_admin on public.batch_challenges;
create policy batch_challenges_admin on public.batch_challenges for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists challenge_players_admin on public.challenge_players;
create policy challenge_players_admin on public.challenge_players for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists challenge_answers_admin on public.challenge_answers;
create policy challenge_answers_admin on public.challenge_answers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- the phase of a challenge at a moment
create or replace function public.challenge_status(c public.batch_challenges, n timestamptz) returns text language sql stable as $$
  select case when c.cancelled then 'cancelled'
              when n < c.start_at - interval '300 seconds' then 'scheduled'
              when n < c.start_at then 'lobby'
              when n < c.start_at + make_interval(secs => c.slots * c.slot_s) then 'live'
              else 'done' end
$$;
create or replace function public.challenge_ms() returns bigint language sql stable as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;
create or replace function public.challenge_is_member(p_batch uuid) returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.batch_members m where m.batch_id = p_batch and m.user_id = auth.uid())
$$;
-- the questions of a challenge: verified ones, one per topic first, then at random; the order is mixed
create or replace function public.challenge_pick(p_n int) returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(z.id order by random()), '{}'::uuid[]) from (
    select t.id from (select q.id, row_number() over (partition by q.topic order by random()) as rn, random() as rnd from public.quiz_questions q where q.status = 'verified') t order by t.rn, t.rnd limit p_n
  ) z
$$;

-- a short description of the batch for the screens
create or replace function public.challenge_batch(p_batch uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', b.id, 'slug', b.institution_slug, 'year', b.exam_year,
           'name', (select l.institution_name from public.listing_submissions l where l.desired_slug = b.institution_slug and l.status = 'approved' limit 1))
    from public.batches b where b.id = p_batch
$$;

-- 1) give a challenge
create or replace function public.challenge_create(p_batch_id uuid, p_start timestamptz, p_target int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); new_id uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if not public.challenge_is_member(p_batch_id) then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  if p_start is null or p_start < now() + interval '15 minutes' then return jsonb_build_object('ok', false, 'error', 'TOO_SOON'); end if;
  if p_start > now() + interval '7 days' then return jsonb_build_object('ok', false, 'error', 'TOO_FAR'); end if;
  if p_target is null or p_target < 20 or p_target > 300 or p_target % 5 <> 0 then return jsonb_build_object('ok', false, 'error', 'BAD_TARGET'); end if;
  if (select count(*) from public.batch_members m where m.batch_id = p_batch_id) < 5 then return jsonb_build_object('ok', false, 'error', 'BATCH_TOO_SMALL'); end if;
  if (select count(*) from public.quiz_questions q where q.status = 'verified') < 12 then return jsonb_build_object('ok', false, 'error', 'NOT_ENOUGH_QUESTIONS'); end if;
  if exists (select 1 from public.batch_challenges c where c.created_by = uid and c.created_at > now() - interval '24 hours') then return jsonb_build_object('ok', false, 'error', 'LIMIT_USER'); end if;
  if (select count(*) from public.batch_challenges c where c.batch_id = p_batch_id and not c.cancelled and c.start_at + make_interval(secs => c.slots * c.slot_s) > now()) >= 2 then return jsonb_build_object('ok', false, 'error', 'LIMIT_BATCH'); end if;
  if exists (select 1 from public.batch_challenges c where c.batch_id = p_batch_id and not c.cancelled and c.start_at between p_start - interval '30 minutes' and p_start + interval '30 minutes') then return jsonb_build_object('ok', false, 'error', 'TOO_CLOSE'); end if;
  insert into public.batch_challenges (created_by, batch_id, start_at, target) values (uid, p_batch_id, p_start, p_target) returning batch_challenges.id into new_id;
  insert into public.challenge_players (challenge_id, user_id, batch_id) values (new_id, uid, p_batch_id) on conflict do nothing;      -- the one who gives it is in
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

-- 2) cancel (the one who gave it, or the admin), only before it starts
create or replace function public.challenge_cancel(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.batch_challenges;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  select * into c from public.batch_challenges where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if c.created_by <> auth.uid() and not coalesce(public.is_admin(), false) then return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED'); end if;
  if now() >= c.start_at then return jsonb_build_object('ok', false, 'error', 'ALREADY_STARTED'); end if;
  update public.batch_challenges set cancelled = true where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- 3) join (a member of the host batch; any time until it is over)
create or replace function public.challenge_join(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.batch_challenges; st text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  select * into c from public.batch_challenges where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  st := public.challenge_status(c, now());
  if st = 'cancelled' then return jsonb_build_object('ok', false, 'error', 'CANCELLED'); end if;
  if st = 'done' then return jsonb_build_object('ok', false, 'error', 'OVER'); end if;
  if st = 'scheduled' then return jsonb_build_object('ok', false, 'error', 'NOT_OPEN_YET'); end if;
  if not public.challenge_is_member(c.batch_id) then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  insert into public.challenge_players (challenge_id, user_id, batch_id) values (p_id, auth.uid(), c.batch_id) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- 4) my side: am I a member, have I joined, what did I answer
create or replace function public.challenge_me(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.batch_challenges;
begin
  select * into c from public.batch_challenges where id = p_id;
  if not found then return jsonb_build_object('found', false); end if;
  if auth.uid() is null then return jsonb_build_object('found', true, 'signed_in', false, 'member', false, 'joined', false, 'answers', '[]'::jsonb, 'creator', false); end if;
  return jsonb_build_object('found', true, 'signed_in', true, 'member', public.challenge_is_member(c.batch_id), 'creator', c.created_by = auth.uid(),
    'joined', exists (select 1 from public.challenge_players p where p.challenge_id = p_id and p.user_id = auth.uid()),
    'answers', coalesce((select jsonb_agg(jsonb_build_object('slot', a.slot, 'correct', a.correct) order by a.slot) from public.challenge_answers a where a.challenge_id = p_id and a.user_id = auth.uid()), '[]'::jsonb));
end $$;

-- 5) the questions (from 4 s before the start; no answers; the same for everybody)
create or replace function public.challenge_questions(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.batch_challenges; st text; picked uuid[];
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  select * into c from public.batch_challenges where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if c.cancelled then return jsonb_build_object('ok', false, 'error', 'CANCELLED'); end if;
  if not public.challenge_is_member(c.batch_id) then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  if now() < c.start_at - interval '4 seconds' then return jsonb_build_object('ok', false, 'error', 'TOO_EARLY', 'start_ms', (extract(epoch from c.start_at) * 1000)::bigint, 'server_now_ms', public.challenge_ms()); end if;
  if c.qids is null then
    picked := public.challenge_pick(c.slots);
    if cardinality(picked) < c.slots then return jsonb_build_object('ok', false, 'error', 'NOT_ENOUGH_QUESTIONS'); end if;
    update public.batch_challenges set qids = picked where id = p_id and qids is null;
    select * into c from public.batch_challenges where id = p_id;
  end if;
  insert into public.challenge_players (challenge_id, user_id, batch_id) values (p_id, auth.uid(), c.batch_id) on conflict do nothing;
  return jsonb_build_object('ok', true, 'slots', c.slots, 'slot_s', c.slot_s, 'window_s', c.window_s, 'start_ms', (extract(epoch from c.start_at) * 1000)::bigint, 'server_now_ms', public.challenge_ms(),
    'questions', (select jsonb_agg(jsonb_build_object('slot', t.ord - 1, 'id', q.id, 'topic', q.topic, 'text', q.question, 'options', q.options) order by t.ord)
                    from unnest(c.qids) with ordinality as t(qid, ord) join public.quiz_questions q on q.id = t.qid));
end $$;

-- 6) answer: only inside the window of that question, one answer each; the right answer is told only now
create or replace function public.challenge_answer(p_id uuid, p_slot int, p_choice int) returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.batch_challenges; n timestamptz := clock_timestamp(); s timestamptz; q public.quiz_questions; good boolean; mine int;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  select * into c from public.batch_challenges where id = p_id;
  if not found or c.cancelled or c.qids is null then return jsonb_build_object('ok', false, 'error', 'NOT_LIVE'); end if;
  if not public.challenge_is_member(c.batch_id) then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  if p_slot is null or p_slot < 0 or p_slot >= c.slots or p_choice is null or p_choice < 0 or p_choice > 3 then return jsonb_build_object('ok', false, 'error', 'BAD_ANSWER'); end if;
  s := c.start_at + make_interval(secs => p_slot * c.slot_s);
  if n < s - interval '500 milliseconds' or n > s + make_interval(secs => c.window_s) + interval '1500 milliseconds' then return jsonb_build_object('ok', false, 'error', 'NOT_IN_WINDOW'); end if;
  select * into q from public.quiz_questions where id = c.qids[p_slot + 1];
  good := p_choice = q.answer_idx;
  begin
    insert into public.challenge_players (challenge_id, user_id, batch_id) values (p_id, auth.uid(), c.batch_id) on conflict do nothing;
    insert into public.challenge_answers (challenge_id, user_id, slot, qid, choice, correct) values (p_id, auth.uid(), p_slot, q.id, p_choice, good);
  exception when unique_violation then return jsonb_build_object('ok', false, 'error', 'ALREADY');
  end;
  select count(*)::int into mine from public.challenge_answers a where a.challenge_id = p_id and a.user_id = auth.uid() and a.correct;
  return jsonb_build_object('ok', true, 'correct', good, 'answer_idx', q.answer_idx, 'explanation', q.explanation, 'my_correct', mine);
end $$;

-- 7) the public live numbers (counts only): read through the edge cache, so many screens cost one question a second
create or replace function public.challenge_state(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.batch_challenges; per jsonb; players int; corr int; answered int; now_t timestamptz := now();
begin
  select * into c from public.batch_challenges where id = p_id;
  if not found then return jsonb_build_object('found', false, 'server_now_ms', public.challenge_ms()); end if;
  select count(*)::int into players from public.challenge_players p where p.challenge_id = c.id;
  select coalesce(jsonb_agg(coalesce(s.n, 0) order by g), '[]'::jsonb), coalesce(sum(coalesce(s.n, 0)), 0)::int into per, corr
    from generate_series(0, c.slots - 1) g left join (select slot, count(*) filter (where correct)::int as n from public.challenge_answers where challenge_id = c.id group by slot) s on s.slot = g;
  select count(*)::int into answered from public.challenge_answers a where a.challenge_id = c.id;
  return jsonb_build_object('found', true, 'id', c.id, 'status', public.challenge_status(c, now_t), 'server_now_ms', public.challenge_ms(), 'start_ms', (extract(epoch from c.start_at) * 1000)::bigint,
    'slots', c.slots, 'slot_s', c.slot_s, 'window_s', c.window_s, 'target', c.target, 'mode', c.mode, 'batch', public.challenge_batch(c.batch_id),
    'players', players, 'correct', corr, 'answered', answered, 'per_slot', per, 'reached', corr >= c.target and public.challenge_status(c, now_t) = 'done');
end $$;

-- 8) the result: for the ones who played (the first names of the best five)
create or replace function public.challenge_result(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.batch_challenges; st jsonb; played boolean; mine int; top jsonb := '[]'::jsonb;
begin
  select * into c from public.batch_challenges where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if public.challenge_status(c, now()) <> 'done' then return jsonb_build_object('ok', false, 'error', 'NOT_OVER'); end if;
  st := public.challenge_state(p_id);
  played := auth.uid() is not null and exists (select 1 from public.challenge_answers a where a.challenge_id = p_id and a.user_id = auth.uid());
  select count(*)::int into mine from public.challenge_answers a where a.challenge_id = p_id and a.user_id = auth.uid() and a.correct;
  if played then
    select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(public.batch_first_name(m.display_name), 'সদস্য'), 'correct', r.n, 'me', r.user_id = auth.uid()) order by r.n desc, r.fst), '[]'::jsonb) into top
      from (select a.user_id, count(*) filter (where a.correct)::int as n, min(a.answered_at) as fst from public.challenge_answers a where a.challenge_id = p_id group by a.user_id order by 2 desc, 3 limit 5) r
      left join public.members m on m.user_id = r.user_id;
  end if;
  return st || jsonb_build_object('ok', true, 'points', (st ->> 'correct')::int + case when (st ->> 'reached')::boolean then 50 else 0 end, 'played', played, 'my_correct', coalesce(mine, 0), 'top', top);
end $$;

-- 9) the list for the hub: from yesterday to a week ahead, counts only
create or replace function public.challenge_list(p_limit int default 30) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.s), '[]'::jsonb) from (
    select c.start_at as s, jsonb_build_object('id', c.id, 'status', public.challenge_status(c, now()), 'start_ms', (extract(epoch from c.start_at) * 1000)::bigint, 'slots', c.slots, 'slot_s', c.slot_s, 'target', c.target,
             'batch', public.challenge_batch(c.batch_id), 'players', (select count(*)::int from public.challenge_players p where p.challenge_id = c.id),
             'correct', (select count(*)::int from public.challenge_answers a where a.challenge_id = c.id and a.correct)) as j
      from public.batch_challenges c
     where not c.cancelled and c.start_at between now() - interval '24 hours' and now() + interval '7 days'
     order by c.start_at limit greatest(1, least(coalesce(p_limit, 30), 60))
  ) x
$$;

revoke all on function public.challenge_status(public.batch_challenges, timestamptz) from public, anon, authenticated;
revoke all on function public.challenge_ms() from public, anon, authenticated;
revoke all on function public.challenge_is_member(uuid) from public, anon, authenticated;
revoke all on function public.challenge_pick(int) from public, anon, authenticated;
revoke all on function public.challenge_batch(uuid) from public, anon, authenticated;
revoke all on function public.challenge_create(uuid, timestamptz, int) from public, anon;
revoke all on function public.challenge_cancel(uuid) from public, anon;
revoke all on function public.challenge_join(uuid) from public, anon;
revoke all on function public.challenge_me(uuid) from public, anon;
revoke all on function public.challenge_questions(uuid) from public, anon;
revoke all on function public.challenge_answer(uuid, int, int) from public, anon;
grant execute on function public.challenge_create(uuid, timestamptz, int) to authenticated;
grant execute on function public.challenge_cancel(uuid) to authenticated;
grant execute on function public.challenge_join(uuid) to authenticated;
grant execute on function public.challenge_me(uuid) to anon, authenticated;
grant execute on function public.challenge_questions(uuid) to authenticated;
grant execute on function public.challenge_answer(uuid, int, int) to authenticated;
grant execute on function public.challenge_state(uuid) to anon, authenticated;
grant execute on function public.challenge_result(uuid) to anon, authenticated;
grant execute on function public.challenge_list(int) to anon, authenticated;
