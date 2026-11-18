-- প্রতিষ্ঠান লিগ, step 4: রশি টানাটানি, batch against batch, on the same live engine as step 3 (the same 12 verified questions, the same server clock, the same answer rules).
--  * mode 'rope': two sides. Side A = the host batch. Side B = the opponent batch: named when the challenge is given (opp_batch_id), or OPEN ("any batch": the first batch that accepts, rope_accept).
--  * A player's side: a member of the host batch is on side A; otherwise a member of the opponent batch is on side B (a member of both plays for A).
--  * The rope: lead = (right answers per player of A) - (right answers per player of B), per player who CAME (joined), so a big batch has no edge over a small one. The rope shows the lead live; after the 12th
--    question the larger average wins (equal = a draw). Winner +50 points, a draw +25 each, everybody keeps their right answers as points.
--  * The match counts only when BOTH sides have at least 5 players. If the opponent did not come, it is read as a game against the clock (no winner, no bonus), as in step 3.
--  * The names in the result are the first names of the best five of YOUR OWN side, shown only to those who played; nothing of the other side except counts.
--  * A challenge cannot be given to a batch that has another challenge within 30 minutes, nor can a batch be in more than 2 waiting challenges (as host or as opponent).
-- Needs 2027-01-12_batch_challenge.sql. Safe to run more than once; the functions of step 3 are replaced by versions that behave the same for mode 'clock'.

alter table public.batch_challenges add column if not exists opp_accepted_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'batch_challenges_opp_not_host') then
    alter table public.batch_challenges add constraint batch_challenges_opp_not_host check (opp_batch_id is null or opp_batch_id <> batch_id);
  end if;
end $$;
create index if not exists batch_challenges_opp_idx on public.batch_challenges (opp_batch_id, start_at desc) where opp_batch_id is not null;

-- which side the caller plays: 'a' (member of the host batch), 'b' (member of the opponent batch of a rope challenge), or null
create or replace function public.challenge_side(c public.batch_challenges) returns text language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null
              when exists (select 1 from public.batch_members m where m.batch_id = c.batch_id and m.user_id = auth.uid()) then 'a'
              when c.mode = 'rope' and c.opp_batch_id is not null and exists (select 1 from public.batch_members m where m.batch_id = c.opp_batch_id and m.user_id = auth.uid()) then 'b' end
$$;
-- may this batch take a challenge at this time? null = yes, otherwise the reason (as host or as opponent: at most 2 waiting, 30 minutes apart)
create or replace function public.challenge_conflict(p_batch uuid, p_start timestamptz) returns text language sql stable security definer set search_path = public as $$
  select case
    when (select count(*) from public.batch_challenges c where (c.batch_id = p_batch or c.opp_batch_id = p_batch) and not c.cancelled and c.start_at + make_interval(secs => c.slots * c.slot_s) > now()) >= 2 then 'LIMIT_BATCH'
    when exists (select 1 from public.batch_challenges c where (c.batch_id = p_batch or c.opp_batch_id = p_batch) and not c.cancelled and c.start_at between p_start - interval '30 minutes' and p_start + interval '30 minutes') then 'TOO_CLOSE'
    end
$$;
create or replace function public.challenge_team_size(p_batch uuid) returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.batch_members m where m.batch_id = p_batch
$$;

-- step 3's function again, the limits now count a batch as host or as opponent
create or replace function public.challenge_create(p_batch_id uuid, p_start timestamptz, p_target int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); new_id uuid; why text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if not public.challenge_is_member(p_batch_id) then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  if p_start is null or p_start < now() + interval '15 minutes' then return jsonb_build_object('ok', false, 'error', 'TOO_SOON'); end if;
  if p_start > now() + interval '7 days' then return jsonb_build_object('ok', false, 'error', 'TOO_FAR'); end if;
  if p_target is null or p_target < 20 or p_target > 300 or p_target % 5 <> 0 then return jsonb_build_object('ok', false, 'error', 'BAD_TARGET'); end if;
  if public.challenge_team_size(p_batch_id) < 5 then return jsonb_build_object('ok', false, 'error', 'BATCH_TOO_SMALL'); end if;
  if (select count(*) from public.quiz_questions q where q.status = 'verified') < 12 then return jsonb_build_object('ok', false, 'error', 'NOT_ENOUGH_QUESTIONS'); end if;
  if exists (select 1 from public.batch_challenges c where c.created_by = uid and c.created_at > now() - interval '24 hours') then return jsonb_build_object('ok', false, 'error', 'LIMIT_USER'); end if;
  why := public.challenge_conflict(p_batch_id, p_start); if why is not null then return jsonb_build_object('ok', false, 'error', why); end if;
  insert into public.batch_challenges (created_by, batch_id, start_at, target) values (uid, p_batch_id, p_start, p_target) returning batch_challenges.id into new_id;
  insert into public.challenge_players (challenge_id, user_id, batch_id) values (new_id, uid, p_batch_id) on conflict do nothing;
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

-- 1) give a rope challenge: p_opp_batch null = open to any batch, otherwise that batch is called by name
create or replace function public.rope_create(p_batch_id uuid, p_start timestamptz, p_opp_batch uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); new_id uuid; why text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if not public.challenge_is_member(p_batch_id) then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  if p_start is null or p_start < now() + interval '15 minutes' then return jsonb_build_object('ok', false, 'error', 'TOO_SOON'); end if;
  if p_start > now() + interval '7 days' then return jsonb_build_object('ok', false, 'error', 'TOO_FAR'); end if;
  if public.challenge_team_size(p_batch_id) < 5 then return jsonb_build_object('ok', false, 'error', 'BATCH_TOO_SMALL'); end if;
  if (select count(*) from public.quiz_questions q where q.status = 'verified') < 12 then return jsonb_build_object('ok', false, 'error', 'NOT_ENOUGH_QUESTIONS'); end if;
  if exists (select 1 from public.batch_challenges c where c.created_by = uid and c.created_at > now() - interval '24 hours') then return jsonb_build_object('ok', false, 'error', 'LIMIT_USER'); end if;
  why := public.challenge_conflict(p_batch_id, p_start); if why is not null then return jsonb_build_object('ok', false, 'error', why); end if;
  if p_opp_batch is not null then
    if p_opp_batch = p_batch_id then return jsonb_build_object('ok', false, 'error', 'SAME_BATCH'); end if;
    if not exists (select 1 from public.batches b where b.id = p_opp_batch) then return jsonb_build_object('ok', false, 'error', 'OPP_NOT_FOUND'); end if;
    if public.challenge_team_size(p_opp_batch) < 5 then return jsonb_build_object('ok', false, 'error', 'OPP_TOO_SMALL'); end if;
    if public.challenge_conflict(p_opp_batch, p_start) is not null then return jsonb_build_object('ok', false, 'error', 'OPP_BUSY'); end if;
  end if;
  insert into public.batch_challenges (created_by, batch_id, mode, opp_batch_id, start_at, target, opp_accepted_at)
    values (uid, p_batch_id, 'rope', p_opp_batch, p_start, 40, null) returning batch_challenges.id into new_id;
  insert into public.challenge_players (challenge_id, user_id, batch_id) values (new_id, uid, p_batch_id) on conflict do nothing;
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

-- 2) accept an OPEN rope challenge for a batch of mine (the first one wins), until it starts
create or replace function public.rope_accept(p_id uuid, p_batch_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.batch_challenges; why text; got uuid;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  select * into c from public.batch_challenges where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if c.mode <> 'rope' then return jsonb_build_object('ok', false, 'error', 'NOT_ROPE'); end if;
  if c.cancelled then return jsonb_build_object('ok', false, 'error', 'CANCELLED'); end if;
  if now() >= c.start_at then return jsonb_build_object('ok', false, 'error', 'TOO_LATE'); end if;
  if c.opp_batch_id is not null then return jsonb_build_object('ok', false, 'error', 'ALREADY_TAKEN'); end if;
  if p_batch_id = c.batch_id then return jsonb_build_object('ok', false, 'error', 'SAME_BATCH'); end if;
  if not public.challenge_is_member(p_batch_id) then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  if public.challenge_team_size(p_batch_id) < 5 then return jsonb_build_object('ok', false, 'error', 'BATCH_TOO_SMALL'); end if;
  why := public.challenge_conflict(p_batch_id, c.start_at); if why is not null then return jsonb_build_object('ok', false, 'error', 'BUSY'); end if;
  update public.batch_challenges set opp_batch_id = p_batch_id, opp_accepted_at = now() where id = p_id and opp_batch_id is null and not cancelled and now() < start_at returning id into got;
  if got is null then return jsonb_build_object('ok', false, 'error', 'ALREADY_TAKEN'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- 3) join (a player of either side), questions and answers: the side decides the batch of the player
create or replace function public.challenge_join(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.batch_challenges; st text; sd text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  select * into c from public.batch_challenges where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  st := public.challenge_status(c, now());
  if st = 'cancelled' then return jsonb_build_object('ok', false, 'error', 'CANCELLED'); end if;
  if st = 'done' then return jsonb_build_object('ok', false, 'error', 'OVER'); end if;
  if st = 'scheduled' then return jsonb_build_object('ok', false, 'error', 'NOT_OPEN_YET'); end if;
  sd := public.challenge_side(c);
  if sd is null then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  insert into public.challenge_players (challenge_id, user_id, batch_id) values (p_id, auth.uid(), case sd when 'a' then c.batch_id else c.opp_batch_id end) on conflict do nothing;
  return jsonb_build_object('ok', true, 'side', sd);
end $$;

create or replace function public.challenge_me(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.batch_challenges; sd text; opts jsonb := '[]'::jsonb;
begin
  select * into c from public.batch_challenges where id = p_id;
  if not found then return jsonb_build_object('found', false); end if;
  if auth.uid() is null then return jsonb_build_object('found', true, 'signed_in', false, 'member', false, 'joined', false, 'answers', '[]'::jsonb, 'creator', false, 'side', null, 'accept_batches', '[]'::jsonb); end if;
  sd := public.challenge_side(c);
  if c.mode = 'rope' and c.opp_batch_id is null and not c.cancelled and now() < c.start_at then       -- the batches of mine that could take the open challenge
    select coalesce(jsonb_agg(public.challenge_batch(b.id) || jsonb_build_object('members', public.challenge_team_size(b.id))), '[]'::jsonb) into opts
      from public.batch_members m join public.batches b on b.id = m.batch_id where m.user_id = auth.uid() and b.id <> c.batch_id and public.challenge_team_size(b.id) >= 5;
  end if;
  return jsonb_build_object('found', true, 'signed_in', true, 'member', sd is not null, 'side', sd, 'creator', c.created_by = auth.uid(),
    'joined', exists (select 1 from public.challenge_players p where p.challenge_id = p_id and p.user_id = auth.uid()),
    'answers', coalesce((select jsonb_agg(jsonb_build_object('slot', a.slot, 'correct', a.correct) order by a.slot) from public.challenge_answers a where a.challenge_id = p_id and a.user_id = auth.uid()), '[]'::jsonb),
    'accept_batches', opts);
end $$;

create or replace function public.challenge_questions(p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.batch_challenges; picked uuid[]; sd text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  select * into c from public.batch_challenges where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if c.cancelled then return jsonb_build_object('ok', false, 'error', 'CANCELLED'); end if;
  sd := public.challenge_side(c);
  if sd is null then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  if now() < c.start_at - interval '4 seconds' then return jsonb_build_object('ok', false, 'error', 'TOO_EARLY', 'start_ms', (extract(epoch from c.start_at) * 1000)::bigint, 'server_now_ms', public.challenge_ms()); end if;
  if c.qids is null then
    picked := public.challenge_pick(c.slots);
    if cardinality(picked) < c.slots then return jsonb_build_object('ok', false, 'error', 'NOT_ENOUGH_QUESTIONS'); end if;
    update public.batch_challenges set qids = picked where id = p_id and qids is null;
    select * into c from public.batch_challenges where id = p_id;
  end if;
  insert into public.challenge_players (challenge_id, user_id, batch_id) values (p_id, auth.uid(), case sd when 'a' then c.batch_id else c.opp_batch_id end) on conflict do nothing;
  return jsonb_build_object('ok', true, 'side', sd, 'slots', c.slots, 'slot_s', c.slot_s, 'window_s', c.window_s, 'start_ms', (extract(epoch from c.start_at) * 1000)::bigint, 'server_now_ms', public.challenge_ms(),
    'questions', (select jsonb_agg(jsonb_build_object('slot', t.ord - 1, 'id', q.id, 'topic', q.topic, 'text', q.question, 'options', q.options) order by t.ord)
                    from unnest(c.qids) with ordinality as t(qid, ord) join public.quiz_questions q on q.id = t.qid));
end $$;

create or replace function public.challenge_answer(p_id uuid, p_slot int, p_choice int) returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.batch_challenges; n timestamptz := clock_timestamp(); s timestamptz; q public.quiz_questions; good boolean; mine int; sd text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  select * into c from public.batch_challenges where id = p_id;
  if not found or c.cancelled or c.qids is null then return jsonb_build_object('ok', false, 'error', 'NOT_LIVE'); end if;
  sd := public.challenge_side(c);
  if sd is null then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  if p_slot is null or p_slot < 0 or p_slot >= c.slots or p_choice is null or p_choice < 0 or p_choice > 3 then return jsonb_build_object('ok', false, 'error', 'BAD_ANSWER'); end if;
  s := c.start_at + make_interval(secs => p_slot * c.slot_s);
  if n < s - interval '500 milliseconds' or n > s + make_interval(secs => c.window_s) + interval '1500 milliseconds' then return jsonb_build_object('ok', false, 'error', 'NOT_IN_WINDOW'); end if;
  select * into q from public.quiz_questions where id = c.qids[p_slot + 1];
  good := p_choice = q.answer_idx;
  begin
    insert into public.challenge_players (challenge_id, user_id, batch_id) values (p_id, auth.uid(), case sd when 'a' then c.batch_id else c.opp_batch_id end) on conflict do nothing;
    insert into public.challenge_answers (challenge_id, user_id, slot, qid, choice, correct) values (p_id, auth.uid(), p_slot, q.id, p_choice, good);
  exception when unique_violation then return jsonb_build_object('ok', false, 'error', 'ALREADY');
  end;
  select count(*)::int into mine from public.challenge_answers a where a.challenge_id = p_id and a.user_id = auth.uid() and a.correct;
  return jsonb_build_object('ok', true, 'correct', good, 'answer_idx', q.answer_idx, 'explanation', q.explanation, 'my_correct', mine);
end $$;

-- the numbers of one side: players that came, right answers, right answers per question
create or replace function public.challenge_side_numbers(p_id uuid, p_batch uuid, p_slots int) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'players', (select count(*)::int from public.challenge_players p where p.challenge_id = p_id and p.batch_id = p_batch),
    'per_slot', coalesce((select jsonb_agg(coalesce(s.n, 0) order by g) from generate_series(0, p_slots - 1) g
                  left join (select a.slot, count(*) filter (where a.correct)::int as n from public.challenge_answers a join public.challenge_players p on p.challenge_id = a.challenge_id and p.user_id = a.user_id
                              where a.challenge_id = p_id and p.batch_id = p_batch group by a.slot) s on s.slot = g), '[]'::jsonb))
$$;

-- 4) the public live numbers (counts only); for a rope challenge both sides and the lead
create or replace function public.challenge_state(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.batch_challenges; per jsonb; players int; corr int; answered int; now_t timestamptz := now(); base jsonb; st text;
        na jsonb; nb jsonb; pa int; pb int; ca int; cb int; aa numeric; ab numeric; valid boolean; win text;
begin
  select * into c from public.batch_challenges where id = p_id;
  if not found then return jsonb_build_object('found', false, 'server_now_ms', public.challenge_ms()); end if;
  st := public.challenge_status(c, now_t);
  select count(*)::int into players from public.challenge_players p where p.challenge_id = c.id;
  select coalesce(jsonb_agg(coalesce(s.n, 0) order by g), '[]'::jsonb), coalesce(sum(coalesce(s.n, 0)), 0)::int into per, corr
    from generate_series(0, c.slots - 1) g left join (select slot, count(*) filter (where correct)::int as n from public.challenge_answers where challenge_id = c.id group by slot) s on s.slot = g;
  select count(*)::int into answered from public.challenge_answers a where a.challenge_id = c.id;
  base := jsonb_build_object('found', true, 'id', c.id, 'status', st, 'server_now_ms', public.challenge_ms(), 'start_ms', (extract(epoch from c.start_at) * 1000)::bigint,
    'slots', c.slots, 'slot_s', c.slot_s, 'window_s', c.window_s, 'target', c.target, 'mode', c.mode, 'batch', public.challenge_batch(c.batch_id),
    'players', players, 'correct', corr, 'answered', answered, 'per_slot', per, 'reached', corr >= c.target and st = 'done');
  if c.mode <> 'rope' then return base; end if;
  na := public.challenge_side_numbers(c.id, c.batch_id, c.slots);
  nb := case when c.opp_batch_id is null then jsonb_build_object('players', 0, 'per_slot', (select jsonb_agg(0) from generate_series(1, c.slots))) else public.challenge_side_numbers(c.id, c.opp_batch_id, c.slots) end;
  pa := (na ->> 'players')::int; pb := (nb ->> 'players')::int;
  ca := coalesce((select sum(v::int) from jsonb_array_elements_text(na -> 'per_slot') v), 0); cb := coalesce((select sum(v::int) from jsonb_array_elements_text(nb -> 'per_slot') v), 0);
  aa := case when pa > 0 then round(ca::numeric / pa, 2) else 0 end; ab := case when pb > 0 then round(cb::numeric / pb, 2) else 0 end;
  valid := c.opp_batch_id is not null and pa >= 5 and pb >= 5;
  win := case when st <> 'done' or not valid then null when aa > ab then 'a' when ab > aa then 'b' else 'draw' end;
  return base || jsonb_build_object('opp', case when c.opp_batch_id is null then null else public.challenge_batch(c.opp_batch_id) end, 'open', c.opp_batch_id is null,
    'players_a', pa, 'players_b', pb, 'correct_a', ca, 'correct_b', cb, 'per_slot_a', na -> 'per_slot', 'per_slot_b', nb -> 'per_slot', 'avg_a', aa, 'avg_b', ab, 'lead', aa - ab, 'valid', valid, 'winner', win);
end $$;

-- 5) the result: clock as before; rope with both sides, the winner, the points, and the best five of the caller's own side
create or replace function public.challenge_result(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.batch_challenges; st jsonb; played boolean; mine int; top jsonb := '[]'::jsonb; sd text; mybatch uuid; win text; pts_a int; pts_b int;
begin
  select * into c from public.batch_challenges where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if public.challenge_status(c, now()) <> 'done' then return jsonb_build_object('ok', false, 'error', 'NOT_OVER'); end if;
  st := public.challenge_state(p_id);
  played := auth.uid() is not null and exists (select 1 from public.challenge_answers a where a.challenge_id = p_id and a.user_id = auth.uid());
  select count(*)::int into mine from public.challenge_answers a where a.challenge_id = p_id and a.user_id = auth.uid() and a.correct;
  if c.mode = 'rope' then
    sd := case when played then (select case when p.batch_id = c.batch_id then 'a' else 'b' end from public.challenge_players p where p.challenge_id = p_id and p.user_id = auth.uid()) end;
    mybatch := case sd when 'a' then c.batch_id when 'b' then c.opp_batch_id end;
    win := st ->> 'winner';
    pts_a := (st ->> 'correct_a')::int + case win when 'a' then 50 when 'draw' then 25 else 0 end;
    pts_b := (st ->> 'correct_b')::int + case win when 'b' then 50 when 'draw' then 25 else 0 end;
    if played then
      select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(public.batch_first_name(m.display_name), 'সদস্য'), 'correct', r.n, 'me', r.user_id = auth.uid()) order by r.n desc, r.fst), '[]'::jsonb) into top
        from (select a.user_id, count(*) filter (where a.correct)::int as n, min(a.answered_at) as fst from public.challenge_answers a join public.challenge_players p on p.challenge_id = a.challenge_id and p.user_id = a.user_id
               where a.challenge_id = p_id and p.batch_id = mybatch group by a.user_id order by 2 desc, 3 limit 5) r left join public.members m on m.user_id = r.user_id;
    end if;
    return st || jsonb_build_object('ok', true, 'played', played, 'my_side', sd, 'my_correct', coalesce(mine, 0), 'top', top,
      'points_a', case when (st ->> 'valid')::boolean then pts_a else (st ->> 'correct_a')::int end, 'points_b', case when (st ->> 'valid')::boolean then pts_b else (st ->> 'correct_b')::int end);
  end if;
  if played then
    select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(public.batch_first_name(m.display_name), 'সদস্য'), 'correct', r.n, 'me', r.user_id = auth.uid()) order by r.n desc, r.fst), '[]'::jsonb) into top
      from (select a.user_id, count(*) filter (where a.correct)::int as n, min(a.answered_at) as fst from public.challenge_answers a where a.challenge_id = p_id group by a.user_id order by 2 desc, 3 limit 5) r
      left join public.members m on m.user_id = r.user_id;
  end if;
  return st || jsonb_build_object('ok', true, 'points', (st ->> 'correct')::int + case when (st ->> 'reached')::boolean then 50 else 0 end, 'played', played, 'my_correct', coalesce(mine, 0), 'top', top);
end $$;

-- 6) the list for the hub, now with the mode and the opponent
create or replace function public.challenge_list(p_limit int default 30) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.s), '[]'::jsonb) from (
    select c.start_at as s, jsonb_build_object('id', c.id, 'status', public.challenge_status(c, now()), 'start_ms', (extract(epoch from c.start_at) * 1000)::bigint, 'slots', c.slots, 'slot_s', c.slot_s, 'target', c.target,
             'mode', c.mode, 'open', c.mode = 'rope' and c.opp_batch_id is null, 'batch', public.challenge_batch(c.batch_id), 'opp', case when c.opp_batch_id is null then null else public.challenge_batch(c.opp_batch_id) end,
             'players', (select count(*)::int from public.challenge_players p where p.challenge_id = c.id),
             'correct', (select count(*)::int from public.challenge_answers a where a.challenge_id = c.id and a.correct)) as j
      from public.batch_challenges c
     where not c.cancelled and c.start_at between now() - interval '24 hours' and now() + interval '7 days'
     order by c.start_at limit greatest(1, least(coalesce(p_limit, 30), 60))
  ) x
$$;

revoke all on function public.challenge_side(public.batch_challenges) from public, anon, authenticated;
revoke all on function public.challenge_conflict(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.challenge_team_size(uuid) from public, anon, authenticated;
revoke all on function public.challenge_side_numbers(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.rope_create(uuid, timestamptz, uuid) from public, anon;
revoke all on function public.rope_accept(uuid, uuid) from public, anon;
grant execute on function public.rope_create(uuid, timestamptz, uuid) to authenticated;
grant execute on function public.rope_accept(uuid, uuid) to authenticated;
grant execute on function public.challenge_create(uuid, timestamptz, int) to authenticated;
grant execute on function public.challenge_join(uuid) to authenticated;
grant execute on function public.challenge_me(uuid) to anon, authenticated;
grant execute on function public.challenge_questions(uuid) to authenticated;
grant execute on function public.challenge_answer(uuid, int, int) to authenticated;
grant execute on function public.challenge_state(uuid) to anon, authenticated;
grant execute on function public.challenge_result(uuid) to anon, authenticated;
grant execute on function public.challenge_list(int) to anon, authenticated;

-- 7) a batch's name for the "challenge this batch" link (?vs=): the school, the year, how many members. Public, counts only (the same facts a batch page shows).
create or replace function public.challenge_batch_info(p_batch uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select public.challenge_batch(p_batch) || jsonb_build_object('members', public.challenge_team_size(p_batch)) where exists (select 1 from public.batches b where b.id = p_batch)
$$;
revoke all on function public.challenge_batch_info(uuid) from public, anon;
grant execute on function public.challenge_batch_info(uuid) to anon, authenticated;
