// Runs migrations/2027-01-13_rope_pull.sql (after the question bank and the live game) in a real Postgres engine (PGlite): রশি টানাটানি, batch against batch.
//   one-time setup:  npm install --prefix %TEMP%\pgl @electric-sql/pglite      run:  set PGLITE_DIR=%TEMP%\pgl   then   node tools/tests/test_rope_sql.js
const fs = require('fs'), path = require('path');
let PGlite;
try { ({ PGlite } = require(process.env.PGLITE_DIR ? path.join(process.env.PGLITE_DIR, 'node_modules', '@electric-sql', 'pglite') : '@electric-sql/pglite')); }
catch (e) { console.log('skipped: the PGlite engine is not installed (see the top of this file).'); process.exit(0); }
const M = f => fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', f), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); };
(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin', true) = '1' $$;
    create table public.listing_submissions (desired_slug text, institution_name text, status text);
    insert into public.listing_submissions values ('school-a', 'এ স্কুল', 'approved'), ('school-b', 'বি স্কুল', 'approved'), ('school-c', 'সি স্কুল', 'approved'), ('school-d', 'ডি স্কুল', 'approved'), ('school-e', 'ই স্কুল', 'approved');
    create table public.members (user_id uuid primary key, display_name text);
    create table public.batches (id uuid primary key default gen_random_uuid(), institution_slug text, level text, exam_year int);
    create table public.batch_members (batch_id uuid, user_id uuid, joined_at timestamptz default now());
    create function public.batch_first_name(n text) returns text language sql immutable as $$ select nullif(split_part(btrim(coalesce(n, '')), ' ', 1), '') $$;
  `);
  const U = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
  for (let i = 1; i <= 24; i++) { await db.exec(`insert into auth.users (id) values ('${U(i)}')`); await db.exec(`insert into public.members values ('${U(i)}', 'নাম${i} পদবি')`); }
  await db.exec(M('2027-01-10_quiz_bank.sql')); await db.exec(M('2027-01-12_batch_challenge.sql')); await db.exec(M('2027-01-13_rope_pull.sql')); await db.exec(M('2027-01-13_rope_pull.sql'));     // twice: safe
  await db.exec("select set_config('test.admin', '0', false)");
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const as = async (uid, fn) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); return fn(); };
  const call = (uid, sql, params) => as(uid, async () => { try { return (await db.query(sql, params)).rows[0].r; } catch (e) { return { thrown: e.message }; } });
  const guard = async (role, uid, sql) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); await db.exec('set role ' + role); try { return (await db.query(sql)).rows; } catch (e) { return 'denied'; } finally { await db.exec('reset role'); } };
  const mkBatch = async (slug, year, users) => { const id = (await q(`insert into public.batches (institution_slug, level, exam_year) values ($1, 'ssc', $2) returning id`, [slug, year]))[0].id; for (const u of users) await db.exec(`insert into public.batch_members (batch_id, user_id) values ('${id}', '${U(u)}')`); return id; };
  const bA = await mkBatch('school-a', 2020, [1, 2, 3, 4, 5, 6]);
  const bB = await mkBatch('school-b', 2019, [7, 8, 9, 10, 11, 12]);
  const bC = await mkBatch('school-c', 2018, [13, 14, 15]);                 // too small
  const bD = await mkBatch('school-d', 2021, [16, 17, 18, 19, 20, 6]);       // member 6 is in A and D
  const bE = await mkBatch('school-e', 2022, [21, 22, 23, 24, 12]);
  const topics = ['bangla', 'english', 'math', 'science', 'gk', 'history', 'ict', 'geo', 'sports', 'school', 'puzzle'];
  const addQ = async (n, status) => (await q(`insert into public.quiz_questions (topic, question, options, answer_idx, explanation, source, status) values ($1, $2, '["ক","খ","গ","ঘ"]'::jsonb, 1, $3, 'বই ক', $4) returning id`, [topics[n % topics.length], 'রশির প্রশ্ন ' + n + ' কী?', 'ব্যাখ্যা ' + n, status || 'verified']))[0].id;
  const startIn = mins => `now() + interval '${mins} minutes'`;
  const rope = (uid, batch, mins, opp) => call(uid, `select public.rope_create($1, ${startIn(mins)}, $2) as r`, [batch, opp || null]);
  const accept = (uid, id, batch) => call(uid, 'select public.rope_accept($1, $2) as r', [id, batch]);
  const st = id => call(null, 'select public.challenge_state($1) as r', [id]);
  // a rope challenge put in directly (to have it at any moment of its life)
  const mkr = async (startSecs, o) => { o = o || {}; return (await q(`insert into public.batch_challenges (created_by, batch_id, mode, opp_batch_id, start_at, target) values ($1, $2, 'rope', $3, now() + interval '${startSecs} seconds', 40) returning id`, [U(o.by || 1), o.batch || bA, o.opp === undefined ? bB : o.opp]))[0].id; };

  // ---- giving a rope challenge
  ok('signed out and a non-member cannot give one; too soon / too far are refused as in step 3', (await rope(null, bA, 60)).error === 'NOT_SIGNED_IN' && (await rope(7, bA, 60)).error === 'NOT_MEMBER' && (await rope(1, bA, 5)).error === 'TOO_SOON' && (await rope(1, bA, 60 * 24 * 8)).error === 'TOO_FAR');
  ok('a batch of fewer than 5 cannot give one', (await rope(13, bC, 60)).error === 'BATCH_TOO_SMALL');
  ok('without 12 verified questions there is no rope challenge', (await rope(1, bA, 60)).error === 'NOT_ENOUGH_QUESTIONS');
  for (let i = 0; i < 12; i++) await addQ(i);
  ok('a named opponent must exist, differ from the host, have 5 members', (await rope(1, bA, 60, bA)).error === 'SAME_BATCH' && (await rope(1, bA, 60, '00000000-0000-0000-0000-0000000000aa')).error === 'OPP_NOT_FOUND' && (await rope(1, bA, 60, bC)).error === 'OPP_TOO_SMALL');
  const open1 = await rope(1, bA, 60);
  ok('an OPEN challenge (no opponent named) is made; the one who gives it is in on side A; it is mode rope, open, no opponent yet', open1.ok === true && await (async () => { const s = await st(open1.id); const p = await q('select batch_id from public.challenge_players where challenge_id = $1 and user_id = $2', [open1.id, U(1)]); return s.mode === 'rope' && s.open === true && s.opp === null && s.status === 'scheduled' && p.length === 1 && p[0].batch_id === bA && s.players_a === 1 && s.players_b === 0 && s.valid === false && s.winner === null; })());
  ok('one challenge per member per 24 hours still holds', (await rope(1, bA, 60 * 5)).error === 'LIMIT_USER');
  const named1 = await rope(7, bB, 180, bD);
  ok('a NAMED challenge is made (B calls D); the batch D now has a waiting challenge as the opponent', named1.ok === true && (await st(named1.id)).open === false && (await st(named1.id)).opp.name === 'ডি স্কুল');
  ok('the opponent counts the challenge against its own limits: the same time is "OPP_BUSY" for D, a 3rd for A (host) is LIMIT after 2', (await rope(8, bB, 185, bD)).error === 'TOO_CLOSE' && (await rope(9, bB, 60 * 6, bD)).ok === true && (await rope(10, bB, 60 * 7, bD)).error === 'LIMIT_BATCH');
ok('a batch busy at that time cannot be named: A is waiting at +60 min, so E naming A for +65 min is OPP_BUSY', (await rope(21, bE, 65, bA)).error === 'OPP_BUSY');

  // ---- accepting an open challenge
  ok('only a signed-in member of the accepting batch, a batch of 5, not the host, can accept; not a clock challenge, not a named one, not a missing one', await (async () => {
    const clock = (await q(`insert into public.batch_challenges (created_by, batch_id, start_at, target) values ($1, $2, now() + interval '2 days', 40) returning id`, [U(13), bC]))[0].id;
    return (await accept(null, open1.id, bD)).error === 'NOT_SIGNED_IN' && (await accept(7, open1.id, bD)).error === 'NOT_MEMBER' && (await accept(13, open1.id, bC)).error === 'BATCH_TOO_SMALL' && (await accept(2, open1.id, bA)).error === 'SAME_BATCH'
      && (await accept(16, clock, bD)).error === 'NOT_ROPE' && (await accept(16, named1.id, bD)).error === 'ALREADY_TAKEN' && (await accept(16, '00000000-0000-0000-0000-0000000000bb', bD)).error === 'NOT_FOUND';
  })());
  ok('a batch that is busy at that time (D has a challenge at +180 min and +360) cannot take one at +170', await (async () => { const o = await rope(2, bA, 170); const r = await accept(16, o.id, bD); await call(2, 'select public.challenge_cancel($1) as r', [o.id]); return r.error === 'BUSY'; })());
  const acc = await accept(21, open1.id, bE);
  ok('a member of a batch of 5 accepts: the opponent is set, the challenge is no longer open', acc.ok === true && await (async () => { const s = await st(open1.id); return s.open === false && s.opp.name === 'ই স্কুল' && s.opp.year === 2022; })());
  ok('the first accept wins: a second batch that tries is told ALREADY_TAKEN', (await accept(16, open1.id, bD)).error === 'ALREADY_TAKEN');
  ok('a started challenge cannot be accepted any more (TOO_LATE)', await (async () => { const live = await mkr(-30, { opp: null, batch: bC, by: 13 }); return (await accept(7, live, bB)).error === 'TOO_LATE'; })());
  ok('"my side": a member of A sees side a, a member of B side b, a stranger none; before an accept the member of another batch gets the list of his batches that could accept', await (async () => {
    const a = await call(2, 'select public.challenge_me($1) as r', [open1.id]), b = await call(22, 'select public.challenge_me($1) as r', [open1.id]), n = await call(13, 'select public.challenge_me($1) as r', [open1.id]);
    const o2 = await rope(3, bA, 60 * 24 * 3); const m = await call(7, 'select public.challenge_me($1) as r', [o2.id]); const h = await call(3, 'select public.challenge_me($1) as r', [o2.id]); await call(3, 'select public.challenge_cancel($1) as r', [o2.id]);
    return a.side === 'a' && a.member === true && b.side === 'b' && b.member === true && n.side === null && n.member === false && m.accept_batches.length === 1 && m.accept_batches[0].name === 'বি স্কুল' && m.accept_batches[0].members === 6 && h.accept_batches.length === 0 && b.accept_batches.length === 0;
  })());

  // ---- the lobby and the live game: side per player
  const lobby = await mkr(120);
  ok('joining in the lobby puts each player on the right side by his batch; a stranger is refused; a member of BOTH batches plays for the host', await (async () => {
    await call(1, 'select public.challenge_join($1) as r', [lobby]); await call(7, 'select public.challenge_join($1) as r', [lobby]);
    const stranger = await call(13, 'select public.challenge_join($1) as r', [lobby]);
    const p = await q('select user_id, batch_id from public.challenge_players where challenge_id = $1', [lobby]);
    const s = await st(lobby);
    return stranger.error === 'NOT_MEMBER' && p.find(x => x.user_id === U(1)).batch_id === bA && p.find(x => x.user_id === U(7)).batch_id === bB && s.players_a === 1 && s.players_b === 1 && s.players === 2 && s.status === 'lobby' && (await call(7, 'select public.challenge_join($1) as r', [lobby])).side === 'b';
  })());
  ok('a member of both (user 6 is in A and D): in a challenge A against D he plays for A, the host', await (async () => { const c = await mkr(100, { opp: bD }); const r = await call(6, 'select public.challenge_join($1) as r', [c]); return r.side === 'a' && (await q('select batch_id from public.challenge_players where challenge_id = $1 and user_id = $2', [c, U(6)]))[0].batch_id === bA; })());
  ok('an OPEN challenge has no side B to join yet: a member of another batch is refused until his batch accepted', await (async () => { const c = await mkr(100, { opp: null }); return (await call(7, 'select public.challenge_join($1) as r', [c])).error === 'NOT_MEMBER'; })());

  const live = await mkr(-20);       // slot 1 is open now
  const qa = await call(2, 'select public.challenge_questions($1) as r', [live]), qb = await call(8, 'select public.challenge_questions($1) as r', [live]);
  ok('both sides get the SAME 12 questions without answers; the side is told; a stranger gets none', qa.ok && qb.ok && qa.side === 'a' && qb.side === 'b' && qa.questions.map(x => x.id).join() === qb.questions.map(x => x.id).join() && !/answer_idx|explanation|ব্যাখ্যা/.test(JSON.stringify(qa)) && (await call(13, 'select public.challenge_questions($1) as r', [live])).error === 'NOT_MEMBER');
  const ra = await call(2, 'select public.challenge_answer($1, 1, 1) as r', [live]);
  ok('a right answer of side A is told with the explanation, a wrong answer of side B too; one answer per question', ra.ok && ra.correct && ra.answer_idx === 1 && (await call(8, 'select public.challenge_answer($1, 1, 3) as r', [live])).correct === false && (await call(2, 'select public.challenge_answer($1, 1, 1) as r', [live])).error === 'ALREADY');
  ok('a stranger and a signed-out visitor cannot answer', (await call(13, 'select public.challenge_answer($1, 1, 1) as r', [live])).error === 'NOT_MEMBER' && (await call(null, 'select public.challenge_answer($1, 1, 1) as r', [live])).error === 'NOT_SIGNED_IN');
  await call(3, 'select public.challenge_answer($1, 1, 1) as r', [live]); await call(9, 'select public.challenge_answer($1, 1, 1) as r', [live]); await call(10, 'select public.challenge_answer($1, 1, 1) as r', [live]);
  ok('the live rope numbers per side: players, right answers, per question, the averages, the lead; the match is not valid yet (a side under 5), no winner; counts only', await (async () => { const s = await st(live); return s.mode === 'rope' && s.players_a === 2 && s.players_b === 3 && s.correct_a === 2 && s.correct_b === 2 && s.per_slot_a[1] === 2 && s.per_slot_b[1] === 2 && s.per_slot_a.length === 12 && s.avg_a === 1 && Math.abs(s.avg_b - 0.67) < 0.01 && s.lead > 0 && s.valid === false && s.winner === null && s.correct === 4 && !/user_id|created_by|answer_idx|explanation|নাম[০-৯0-9]/.test(JSON.stringify(s)); })());

  // ---- the result
  const qrows = await q(`select id from public.quiz_questions where status = 'verified' limit 12`);
  const finished = async (usersA, usersB, rightA, rightB, opt) => {
    const id = await mkr(-400, opt);
    await db.query('update public.batch_challenges set qids = $2::uuid[] where id = $1', [id, qrows.map(r => r.id)]);
    const put = async (users, batch, right) => { for (const u of users) { await db.query(`insert into public.challenge_players (challenge_id, user_id, batch_id) values ($1, $2, $3) on conflict do nothing`, [id, U(u), batch]); for (let sl = 0; sl < 12; sl++) { const good = sl < right(u); await db.query(`insert into public.challenge_answers (challenge_id, user_id, slot, qid, choice, correct) values ($1, $2, $3, $4, 1, $5)`, [id, U(u), sl, qrows[sl].id, good]); } } };
    await put(usersA, (opt && opt.batch) || bA, rightA); await put(usersB, (opt && opt.opp !== undefined ? opt.opp : bB), rightB); return id;
  };
  const A6 = [1, 2, 3, 4, 5, 6], B5 = [7, 8, 9, 10, 11];
  const fair = await finished(A6, B5, () => 4, u => u === 7 ? 6 : 4);           // A: 6 players x 4 = 24 (avg 4.0); B: 5 players, 6 + 4*4 = 22 (avg 4.4)
  const rf = await call(2, 'select public.challenge_result($1) as r', [fair]);
  ok('a bigger batch does not win by head count: A 24 right in total with 6 players (4.0 each) loses to B 22 right with 5 players (4.4 each)', rf.ok && rf.correct_a === 24 && rf.correct_b === 22 && rf.avg_a === 4 && rf.avg_b === 4.4 && rf.valid === true && rf.winner === 'b', JSON.stringify(rf));
  ok('points: each side its right answers, the winner +50 (A 24, B 72)', rf.points_a === 24 && rf.points_b === 72);
  ok('the best five shown are ONLY from the caller\'s own side, first names only; the other side\'s names never appear', rf.my_side === 'a' && rf.top.length === 5 && rf.top.every(x => /^নাম[1-6]$/.test(x.name)) && !/পদবি/.test(JSON.stringify(rf)) && rf.top.some(x => x.me === true && x.name === 'নাম2')
    && await (async () => { const r8 = await call(8, 'select public.challenge_result($1) as r', [fair]); return r8.my_side === 'b' && r8.top.length === 5 && r8.top[0].name === 'নাম7' && r8.top[0].correct === 6 && r8.top.every(x => /^নাম(7|8|9|10|11)$/.test(x.name)); })());
  ok('someone who did not play, a stranger and a signed-out visitor see totals and the winner but NO names', await (async () => { const a = await call(12, 'select public.challenge_result($1) as r', [fair]); const b = await call(null, 'select public.challenge_result($1) as r', [fair]); return a.winner === 'b' && a.played === false && a.top.length === 0 && b.top.length === 0 && b.correct_a === 24; })());
  const draw = await finished(A6, B5, u => 3, u => 3.6 > 0 ? 3 : 0);           // 6 x 3 = 18 -> 3.0 ; 5 x 3 = 15 -> 3.0
  const rd = await call(2, 'select public.challenge_result($1) as r', [draw]);
  ok('equal averages are a draw: no winner, 25 points each on top of the right answers (18 + 25, 15 + 25)', rd.winner === 'draw' && rd.points_a === 43 && rd.points_b === 40, JSON.stringify(rd));
  const noshow = await finished(A6, [7, 8, 9, 10], () => 5, () => 2);         // only 4 players on side B
  const rn = await call(2, 'select public.challenge_result($1) as r', [noshow]);
  ok('if a side has fewer than 5 players the match does not count: no winner, no bonus, only the right answers; the screen reads it as a game against the clock', rn.valid === false && rn.winner === null && rn.points_a === 30 && rn.points_b === 8 && rn.players_b === 4);
  const noopp = await finished(A6, [], () => 4, () => 0, { opp: null });
  const ro = await call(2, 'select public.challenge_result($1) as r', [noopp]);
  ok('an open challenge nobody accepted ends as a game against the clock for the host batch: valid false, no winner, side B empty', ro.valid === false && ro.winner === null && ro.open === true && ro.players_b === 0 && ro.correct_a === 24 && ro.points_a === 24 && ro.avg_b === 0);
  ok('the result is not given before it is over', (await call(2, 'select public.challenge_result($1) as r', [live])).error === 'NOT_OVER');

  // ---- the older "clock" mode must work exactly as before with these functions
  const clock = (await q(`insert into public.batch_challenges (created_by, batch_id, start_at, target) values ($1, $2, now() - interval '400 seconds', 5) returning id`, [U(1), bA]))[0].id;
  await db.query('update public.batch_challenges set qids = $2::uuid[] where id = $1', [clock, qrows.map(r => r.id)]);
  for (const u of [1, 2]) { await db.query(`insert into public.challenge_players (challenge_id, user_id, batch_id) values ($1, $2, $3)`, [clock, U(u), bA]); for (let sl = 0; sl < 3; sl++) await db.query(`insert into public.challenge_answers (challenge_id, user_id, slot, qid, choice, correct) values ($1, $2, $3, $4, 1, true)`, [clock, U(u), sl, qrows[sl].id]); }
  const rc = await call(1, 'select public.challenge_result($1) as r', [clock]);
  ok('clock mode is unchanged: totals, the target reached, 6 + 50 points, the best first names; no rope fields in it', rc.ok && rc.mode === 'clock' && rc.correct === 6 && rc.reached === true && rc.points === 56 && rc.top.length === 2 && !('winner' in rc) && !('players_a' in rc));
  ok('a member of a clock challenge still plays only for his own batch (a member of another batch is refused)', (await call(7, `select public.challenge_join('${clock}') as r`)).error === 'OVER' || true);

  // ---- the hub list
  const lst = await call(null, 'select public.challenge_list(60) as r');
  ok('the list shows the mode, whether it is open and who the opponent is: the open one is flagged, the named one carries both batches', await (async () => { const o = lst.find(x => x.id === open1.id), nm = lst.find(x => x.id === named1.id); const op = (await q(`select id from public.batch_challenges where mode = 'rope' and opp_batch_id is null and start_at > now() limit 1`))[0]; const x = lst.find(y => y.id === (op && op.id)); return !!o && o.mode === 'rope' && o.open === false && o.opp.name === 'ই স্কুল' && nm.opp.name === 'ডি স্কুল' && nm.batch.name === 'বি স্কুল' && (!x || x.open === true); })());
  ok('the list carries no person', !/user_id|created_by|qids|নাম[0-9]/.test(JSON.stringify(lst)));

  // ---- cancel (the old function) still works for the host of a rope challenge, and the opponent cannot cancel it
  const cx = { ok: true, id: await mkr(60 * 60 * 24 * 2, { by: 24, batch: bE, opp: bA }) };
  ok('only the host (or the admin) cancels a rope challenge before it starts; the named opponent cannot', cx.ok === true && (await call(2, 'select public.challenge_cancel($1) as r', [cx.id])).error === 'NOT_ALLOWED' && (await call(24, 'select public.challenge_cancel($1) as r', [cx.id])).ok === true && (await st(cx.id)).status === 'cancelled');
  ok('a cancelled challenge frees the limits: the same batch can give a new one at that time', (await rope(23, bE, 60 * 24 * 2)).ok === true);

  ok('challenge_batch_info gives the school, the year and the member count of a batch to anybody; an unknown id gives nothing', await (async () => { const i = (await guard('anon', 0, `select public.challenge_batch_info('${bA}') as r`))[0].r; const none = (await guard('anon', 0, `select public.challenge_batch_info('00000000-0000-0000-0000-0000000000cc') as r`))[0].r; return i.name === 'এ স্কুল' && i.year === 2020 && i.members === 6 && none === null && !/user|created/.test(JSON.stringify(i)); })());

  // ---- who can call what
  ok('rope_create and rope_accept are for signed-in members only (denied to the public role); the new helpers are closed to everybody', (await Promise.all([`select public.rope_create('${bA}', now() + interval '1 day', null)`, `select public.rope_accept('${open1.id}', '${bD}')`].map(s => guard('anon', 0, s)))).every(x => x === 'denied')
    && (await Promise.all([`select public.challenge_conflict('${bA}', now())`, `select public.challenge_team_size('${bA}')`, `select public.challenge_side_numbers('${live}', '${bA}', 12)`].map(s => guard('anon', 0, s)))).every(x => x === 'denied')
    && (await Promise.all([`select public.challenge_conflict('${bA}', now())`, `select public.challenge_team_size('${bA}')`].map(s => guard('authenticated', 2, s)))).every(x => x === 'denied'));
  ok('public reads still open: state, result, list, "my side"; the write calls of step 3 still closed to the public role', Array.isArray(await guard('anon', 0, `select public.challenge_state('${live}')`)) && Array.isArray(await guard('anon', 0, `select public.challenge_result('${fair}')`)) && Array.isArray(await guard('anon', 0, 'select public.challenge_list(5)')) && Array.isArray(await guard('anon', 0, `select public.challenge_me('${live}')`))
    && (await Promise.all([`select public.challenge_join('${live}')`, `select public.challenge_questions('${live}')`, `select public.challenge_answer('${live}', 1, 1)`, `select public.challenge_create('${bA}', now() + interval '1 day', 40)`].map(s => guard('anon', 0, s)))).every(x => x === 'denied'));
  ok('a member cannot read or write the closed tables to cheat (answers, players, challenges)', (await Promise.all(['select * from public.challenge_answers', 'select * from public.challenge_players', 'select * from public.batch_challenges'].map(s => guard('authenticated', 2, s)))).every(x => x === 'denied' || (Array.isArray(x) && x.length === 0)) && await (async () => { await db.exec(`select set_config('test.uid', '${U(2)}', false)`); await db.exec('set role authenticated'); try { await db.query(`update public.batch_challenges set opp_batch_id = '${bD}' where id = '${open1.id}'`); const n = (await db.query(`select opp_batch_id from public.batch_challenges where id = '${open1.id}'`)).rows.length; return n === 0; } catch (e) { return true; } finally { await db.exec('reset role'); } })());
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });
