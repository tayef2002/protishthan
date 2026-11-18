// Runs migrations/2027-01-12_batch_challenge.sql (after the question bank) in a real Postgres engine (PGlite): the live ব্যাচ চ্যালেঞ্জ.
//   one-time setup:  npm install --prefix %TEMP%\pgl @electric-sql/pglite      run:  set PGLITE_DIR=%TEMP%\pgl   then   node tools/tests/test_challenge_sql.js
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
    insert into public.listing_submissions values ('school-a', 'এ স্কুল', 'approved'), ('school-b', 'বি স্কুল', 'approved');
    create table public.members (user_id uuid primary key, display_name text);
    create table public.batches (id uuid primary key default gen_random_uuid(), institution_slug text, level text, exam_year int);
    create table public.batch_members (batch_id uuid, user_id uuid, joined_at timestamptz default now());
    create function public.batch_first_name(n text) returns text language sql immutable as $$ select nullif(split_part(btrim(coalesce(n, '')), ' ', 1), '') $$;
  `);
  const U = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
  for (let i = 1; i <= 12; i++) { await db.exec(`insert into auth.users (id) values ('${U(i)}')`); await db.exec(`insert into public.members values ('${U(i)}', 'নাম${i} পদবি')`); }
  await db.exec(M('2027-01-10_quiz_bank.sql')); await db.exec(M('2027-01-12_batch_challenge.sql')); await db.exec(M('2027-01-12_batch_challenge.sql'));     // twice: safe
  await db.exec("select set_config('test.admin', '0', false)");
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const as = async (uid, fn) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); return fn(); };
  const call = (uid, sql, params) => as(uid, async () => { try { return (await db.query(sql, params)).rows[0].r; } catch (e) { return { thrown: e.message }; } });
  const guard = async (role, uid, sql) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); await db.exec('set role ' + role); try { return (await db.query(sql)).rows; } catch (e) { return 'denied'; } finally { await db.exec('reset role'); } };
  const bA = (await q(`insert into public.batches (institution_slug, level, exam_year) values ('school-a', 'ssc', 2020) returning id`))[0].id;
  const bB = (await q(`insert into public.batches (institution_slug, level, exam_year) values ('school-b', 'ssc', 2019) returning id`))[0].id;
  for (let i = 1; i <= 6; i++) await db.exec(`insert into public.batch_members (batch_id, user_id) values ('${bA}', '${U(i)}')`);
  for (let i = 8; i <= 10; i++) await db.exec(`insert into public.batch_members (batch_id, user_id) values ('${bB}', '${U(i)}')`);
  const topics = ['bangla', 'english', 'math', 'science', 'gk', 'history', 'ict', 'geo', 'sports', 'school', 'puzzle'];
  const addQ = async (n, status) => (await q(`insert into public.quiz_questions (topic, question, options, answer_idx, explanation, source, status) values ($1, $2, '["ক","খ","গ","ঘ"]'::jsonb, 1, $3, 'বই ক', $4) returning id`, [topics[n % topics.length], 'চ্যালেঞ্জের প্রশ্ন ' + n + ' কী?', 'ব্যাখ্যা ' + n, status || 'verified']))[0].id;
  const iso = (secs) => `now() + interval '${secs} seconds'`;
  const mkc = async (startSecs, o) => { o = o || {}; return (await q(`insert into public.batch_challenges (created_by, batch_id, start_at, target, cancelled) values ($1, $2, ${iso(startSecs)}, $3, $4) returning id`, [U(o.by || 1), o.batch || bA, o.target || 40, !!o.cancelled]))[0].id; };
  const st = id => call(null, 'select public.challenge_state($1) as r', [id]);
  const startIn = mins => `now() + interval '${mins} minutes'`;
  const create = (uid, batch, mins, target) => call(uid, `select public.challenge_create($1, ${startIn(mins)}, $2) as r`, [batch, target === undefined ? 60 : target]);

  // ---- giving a challenge
  ok('signed out and a non-member cannot give one', (await create(null, bA, 60)).error === 'NOT_SIGNED_IN' && (await create(7, bA, 60)).error === 'NOT_MEMBER');
  ok('too soon (under 15 minutes), too far (over 7 days), a target that is not a multiple of 5 or outside 20 to 300 are refused', (await create(1, bA, 5)).error === 'TOO_SOON' && (await create(1, bA, 60 * 24 * 8)).error === 'TOO_FAR' && (await create(1, bA, 60, 22)).error === 'BAD_TARGET' && (await create(1, bA, 60, 15)).error === 'BAD_TARGET' && (await create(1, bA, 60, 305)).error === 'BAD_TARGET');
  ok('a batch of fewer than 5 members cannot give one (it would not be a game)', (await create(8, bB, 60)).error === 'BATCH_TOO_SMALL');
  ok('without 12 verified questions there is no challenge (drafts do not count)', (await create(1, bA, 60)).error === 'NOT_ENOUGH_QUESTIONS');
  for (let i = 0; i < 11; i++) await addQ(i); await addQ(50, 'draft');
  ok('11 verified are still not enough', (await create(1, bA, 60)).error === 'NOT_ENOUGH_QUESTIONS');
  await addQ(11);
  const c1 = await create(1, bA, 60, 60);
  ok('a member of a batch with 12 verified questions in the bank can give one; the one who gives it is in', c1.ok === true && (await q('select count(*)::int n from public.challenge_players where challenge_id = $1 and user_id = $2', [c1.id, U(1)]))[0].n === 1);
  ok('the same member cannot give a second one within 24 hours', (await create(1, bA, 60 * 5)).error === 'LIMIT_USER');
  ok('another challenge of the same batch within 30 minutes is refused; one 3 hours later is fine; a third that is still waiting is refused (2 at a time)', (await create(2, bA, 75)).error === 'TOO_CLOSE' && (await create(2, bA, 180)).ok === true && (await create(3, bA, 60 * 6)).error === 'LIMIT_BATCH');
  ok('what is stored: scheduled, 12 slots of 14 s with a 12 s window, the target, no questions chosen yet, nothing hidden is in the public state', await (async () => { const s = await st(c1.id); const row = (await q('select * from public.batch_challenges where id = $1', [c1.id]))[0]; return s.status === 'scheduled' && s.slots === 12 && s.slot_s === 14 && s.window_s === 12 && s.target === 60 && s.players === 1 && row.qids === null && row.mode === 'clock' && !/answer_idx|explanation|created_by|qids/.test(JSON.stringify(s)); })());

  // ---- cancelling
  const cc = await mkc(3600, { by: 2 });
  ok('only the one who gave it (or the admin) cancels, only before it starts', (await call(3, 'select public.challenge_cancel($1) as r', [cc])).error === 'NOT_ALLOWED' && (await call(2, 'select public.challenge_cancel($1) as r', [cc])).ok === true && (await st(cc)).status === 'cancelled');
  ok('the admin can cancel any; a started one cannot be cancelled', await (async () => { const a = await mkc(7200, { by: 2 }); await db.exec("select set_config('test.admin', '1', false)"); const r = await call(11, 'select public.challenge_cancel($1) as r', [a]); await db.exec("select set_config('test.admin', '0', false)"); const live = await mkc(-10); return r.ok === true && (await call(1, 'select public.challenge_cancel($1) as r', [live])).error === 'ALREADY_STARTED'; })());

  // ---- the phases by the clock
  const cs = await mkc(900), cl = await mkc(120), cv = await mkc(-20), cd = await mkc(-400);
  ok('the phases follow the clock: scheduled (15 min away), lobby (2 min away), live (20 s in), done (400 s ago)', (await st(cs)).status === 'scheduled' && (await st(cl)).status === 'lobby' && (await st(cv)).status === 'live' && (await st(cd)).status === 'done');
  ok('the state carries the server time, the start, the batch with its school and year, and an unknown id says not found', await (async () => { const s = await st(cl); const miss = await st('00000000-0000-0000-0000-0000000000ff'); return s.found === true && s.server_now_ms > 1e12 && s.start_ms > s.server_now_ms && s.batch.name === 'এ স্কুল' && s.batch.year === 2020 && miss.found === false; })());

  // ---- joining
  ok('joining: not before the lobby (5 minutes), not a non-member, not when over or cancelled, a signed-out call is refused', (await call(2, 'select public.challenge_join($1) as r', [cs])).error === 'NOT_OPEN_YET' && (await call(7, 'select public.challenge_join($1) as r', [cl])).error === 'NOT_MEMBER' && (await call(2, 'select public.challenge_join($1) as r', [cd])).error === 'OVER' && (await call(2, 'select public.challenge_join($1) as r', [cc])).error === 'CANCELLED' && (await call(null, 'select public.challenge_join($1) as r', [cl])).error === 'NOT_SIGNED_IN');
  ok('a member joins in the lobby, twice counts once, and the count goes up (2)', (await call(2, 'select public.challenge_join($1) as r', [cl])).ok === true && (await call(2, 'select public.challenge_join($1) as r', [cl])).ok === true && (await call(3, 'select public.challenge_join($1) as r', [cl])).ok === true && (await st(cl)).players === 2);   // two joined (the challenge was inserted directly, so its maker is not a player)
  ok('"my side": a member sees that he is a member, that he joined, and his answers; a stranger and a signed-out visitor see nothing of the kind', await (async () => { const m = await call(2, 'select public.challenge_me($1) as r', [cl]); const o = await call(7, 'select public.challenge_me($1) as r', [cl]); const n = await call(null, 'select public.challenge_me($1) as r', [cl]); return m.member === true && m.joined === true && o.member === false && o.joined === false && n.signed_in === false; })());

  // ---- the questions
  ok('the questions are not given early: 2 minutes before the start the answer is "too early" with the start time', await (async () => { const r = await call(2, 'select public.challenge_questions($1) as r', [cl]); return r.error === 'TOO_EARLY' && r.start_ms > r.server_now_ms; })());
  const cs3 = await mkc(2);        // starts in 2 s: inside the 4 s before the start
  const qs = await call(2, 'select public.challenge_questions($1) as r', [cs3]);
  ok('from 4 seconds before the start: 12 questions with text and four options each, in an order, NO answer and NO explanation anywhere', qs.ok === true && qs.questions.length === 12 && qs.slots === 12 && qs.slot_s === 14 && qs.window_s === 12 && qs.questions.every((x, i) => x.slot === i && x.options.length === 4 && /চ্যালেঞ্জের প্রশ্ন/.test(x.text)) && !/answer|explanation|ব্যাখ্যা/i.test(JSON.stringify(qs)), JSON.stringify(qs).slice(0, 200));
  ok('every player gets the SAME set (chosen once, stored), all 12 different, all verified (the draft was never picked)', await (async () => { const b = await call(3, 'select public.challenge_questions($1) as r', [cs3]); const ids = a => a.questions.map(x => x.id).join(','); const stored = (await q('select qids from public.batch_challenges where id = $1', [cs3]))[0].qids; return ids(qs) === ids(b) && new Set(stored).size === 12 && (await q(`select count(*)::int n from public.quiz_questions where id = any($1::uuid[]) and status = 'verified'`, [stored]))[0].n === 12; })());
  ok('a non-member, a signed-out visitor and a cancelled challenge get no questions', (await call(7, 'select public.challenge_questions($1) as r', [cs3])).error === 'NOT_MEMBER' && (await call(null, 'select public.challenge_questions($1) as r', [cs3])).error === 'NOT_SIGNED_IN' && (await call(2, 'select public.challenge_questions($1) as r', [cc])).error === 'CANCELLED');
  ok('getting the questions also puts the player in', (await q('select count(*)::int n from public.challenge_players where challenge_id = $1', [cs3]))[0].n === 2);

  // ---- answering: slot 1 is open (20 s after the start: slot 1 opened at 14 s and lasts to 26 s)
  const live = await mkc(-20); await call(2, 'select public.challenge_questions($1) as r', [live]); await call(3, 'select public.challenge_questions($1) as r', [live]);
  ok('before anybody asked for the questions a challenge cannot be answered (nothing is chosen)', (await call(4, 'select public.challenge_answer($1, 1, 1) as r', [(await mkc(-20))])).error === 'NOT_LIVE');
  const a1 = await call(2, 'select public.challenge_answer($1, 1, 1) as r', [live]);
  ok('a right answer inside its window: correct, the right answer and the explanation are told NOW, the count of my right answers', a1.ok === true && a1.correct === true && a1.answer_idx === 1 && /ব্যাখ্যা/.test(a1.explanation) && a1.my_correct === 1, JSON.stringify(a1));
  ok('a wrong answer is recorded, the right one told, no point for the bar', await (async () => { const r = await call(3, 'select public.challenge_answer($1, 1, 3) as r', [live]); return r.ok === true && r.correct === false && r.answer_idx === 1 && r.my_correct === 0; })());
  ok('the same question cannot be answered twice (ALREADY)', (await call(2, 'select public.challenge_answer($1, 1, 1) as r', [live])).error === 'ALREADY');
  ok('a question that already closed (slot 0: closed 6 s ago) and one that has not opened yet (slot 2) cannot be answered: NOT_IN_WINDOW', (await call(2, 'select public.challenge_answer($1, 0, 1) as r', [live])).error === 'NOT_IN_WINDOW' && (await call(2, 'select public.challenge_answer($1, 2, 1) as r', [live])).error === 'NOT_IN_WINDOW' && (await call(2, 'select public.challenge_answer($1, 11, 1) as r', [live])).error === 'NOT_IN_WINDOW');
  ok('a slow phone gets 1.5 s of grace: an answer 13 s after a question opened still counts (slot 1 started 6 s ago here)', await (async () => { const g = await mkc(-27); await call(2, 'select public.challenge_questions($1) as r', [g]); return (await call(2, 'select public.challenge_answer($1, 1, 1) as r', [g])).ok === true; })());
  ok('bad answers: a choice of 4, none, a slot of 99 or -1', (await call(4, 'select public.challenge_answer($1, 1, 4) as r', [live])).error === 'BAD_ANSWER' && (await call(4, 'select public.challenge_answer($1, 1, null) as r', [live])).error === 'BAD_ANSWER' && (await call(4, 'select public.challenge_answer($1, 99, 1) as r', [live])).error === 'BAD_ANSWER' && (await call(4, 'select public.challenge_answer($1, -1, 1) as r', [live])).error === 'BAD_ANSWER');
  ok('a non-member and a signed-out visitor cannot answer', (await call(7, 'select public.challenge_answer($1, 1, 1) as r', [live])).error === 'NOT_MEMBER' && (await call(null, 'select public.challenge_answer($1, 1, 1) as r', [live])).error === 'NOT_SIGNED_IN');
  ok('a late joiner plays from the question that is open now (member 4 joins in the middle and answers slot 1)', (await call(4, 'select public.challenge_answer($1, 1, 1) as r', [live])).ok === true && (await st(live)).players >= 3);

  // ---- the live numbers
  const s = await st(live);
  ok('the live numbers: players, right answers in total and per question (12 numbers), answers; counts only, nothing about a person', s.players === 3 && s.correct === 2 && s.answered === 3 && s.per_slot.length === 12 && s.per_slot[1] === 2 && s.per_slot.reduce((a, b) => a + b, 0) === 2 && s.status === 'live' && s.reached === false && !/user_id|created_by|answer_idx|explanation|display|নাম[০-৯0-9]/.test(JSON.stringify(s)), JSON.stringify(s));

  // ---- the result
  ok('the result is not given before it is over', (await call(2, 'select public.challenge_result($1) as r', [live])).error === 'NOT_OVER');
  const done = await mkc(-400, { target: 5 }); const qrows = await q('select id from public.quiz_questions where status = $1 limit 12', ['verified']);
  await db.query(`update public.batch_challenges set qids = $2::uuid[] where id = $1`, [done, qrows.map(r => r.id)]);
  const give = async (uid, slot, good) => db.query(`insert into public.challenge_answers (challenge_id, user_id, slot, qid, choice, correct) values ($1, $2, $3, $4, 1, $5)`, [done, U(uid), slot, qrows[slot].id, good]);
  for (let sl = 0; sl < 4; sl++) await give(1, sl, true);
  for (let sl = 0; sl < 3; sl++) await give(2, sl, true);
  await give(2, 3, false); for (let sl = 0; sl < 2; sl++) await give(3, sl, true); await give(4, 0, true);
  for (let u = 1; u <= 4; u++) await db.query(`insert into public.challenge_players (challenge_id, user_id, batch_id) values ($1, $2, $3) on conflict do nothing`, [done, U(u), bA]);
  const rs = await call(2, 'select public.challenge_result($1) as r', [done]);
  ok('the result: total right (10), players, the target reached (5), 10 + 50 points, my own right answers, the best first names with the right-answer counts (the first name only)', rs.ok === true && rs.correct === 10 && rs.players === 4 && rs.reached === true && rs.points === 60 && rs.my_correct === 3 && rs.played === true && rs.top.length === 4 && rs.top[0].name === 'নাম1' && rs.top[0].correct === 4 && rs.top.some(x => x.me === true && x.name === 'নাম2') && !/পদবি/.test(JSON.stringify(rs)), JSON.stringify(rs));
  ok('someone who did not play, a stranger and a signed-out visitor see the totals but NO names', await (async () => { const a = await call(5, 'select public.challenge_result($1) as r', [done]); const b = await call(null, 'select public.challenge_result($1) as r', [done]); return a.ok && a.correct === 10 && a.played === false && a.top.length === 0 && b.top.length === 0 && b.correct === 10; })());
  ok('a challenge that did not reach its target: no bonus (the target 50 here), points = right answers', await (async () => { await db.query('update public.batch_challenges set target = 50 where id = $1', [done]); const r = await call(2, 'select public.challenge_result($1) as r', [done]); await db.query('update public.batch_challenges set target = 5 where id = $1', [done]); return r.reached === false && r.points === 10; })());

  // ---- the list
  const lst = await call(null, 'select public.challenge_list(60) as r');
  ok('the list for the hub: scheduled, lobby, live and the recent done challenges with counts; not the cancelled, not the old ones (over a day ago)', Array.isArray(lst) && lst.some(x => x.id === cs) && lst.some(x => x.id === cl) && lst.some(x => x.id === live) && lst.some(x => x.id === done) && !lst.some(x => x.id === cc) && await (async () => { const old = await mkc(-60 * 60 * 30); const l2 = await call(null, 'select public.challenge_list(60) as r'); return !l2.some(x => x.id === old); })());
  ok('the list carries the batch, school, year, the players and the right answers, and nothing about a person', await (async () => { const x = lst.find(y => y.id === done); return x.batch.name === 'এ স্কুল' && x.players === 4 && x.correct === 10 && x.target === 5 && !/user|created_by|qids|name":"নাম/.test(JSON.stringify(x)); })());

  // ---- who can call what
  ok('anyone can read the state, the result, the list and "my side"; only a signed-in member can create, join, ask for questions, answer or cancel', Array.isArray(await guard('anon', 0, `select public.challenge_state('${live}')`)) && Array.isArray(await guard('anon', 0, `select public.challenge_result('${done}')`)) && Array.isArray(await guard('anon', 0, 'select public.challenge_list(5)')) && Array.isArray(await guard('anon', 0, `select public.challenge_me('${live}')`)) &&
    (await Promise.all([`select public.challenge_create('${bA}', now() + interval '1 day', 40)`, `select public.challenge_join('${live}')`, `select public.challenge_questions('${live}')`, `select public.challenge_answer('${live}', 1, 1)`, `select public.challenge_cancel('${cs}')`].map(s2 => guard('anon', 0, s2)))).every(x => x === 'denied'));
  ok('the helpers cannot be called by anyone; the three tables are closed; a member cannot write answers or players himself to cheat', (await Promise.all([`select public.challenge_pick(12)`, `select public.challenge_ms()`, `select public.challenge_is_member('${bA}')`, `select public.challenge_batch('${bA}')`].map(s2 => guard('anon', 0, s2)))).every(x => x === 'denied') && (await Promise.all(['select * from public.challenge_answers', 'select * from public.challenge_players', 'select * from public.batch_challenges'].map(s2 => guard('authenticated', 2, s2)))).every(x => x === 'denied' || (Array.isArray(x) && x.length === 0)) && await (async () => { await db.exec(`select set_config('test.uid', '${U(2)}', false)`); await db.exec('set role authenticated'); try { const r = await db.query(`insert into public.challenge_answers (challenge_id, user_id, slot, qid, choice, correct) values ('${live}', '${U(2)}', 5, gen_random_uuid(), 1, true)`); return false; } catch (e) { return true; } finally { await db.exec('reset role'); } })());
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });
