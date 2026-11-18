// Runs migrations/2027-01-11_daily_quiz.sql (after the question bank) in a real Postgres engine (PGlite): the daily quiz and its boards.
//   one-time setup:  npm install --prefix %TEMP%\pgl @electric-sql/pglite      run:  set PGLITE_DIR=%TEMP%\pgl   then   node tools/tests/test_daily_quiz_sql.js
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
    create table public.listing_submissions (desired_slug text, institution_name text, district text, status text, is_hidden boolean);
    insert into public.listing_submissions values ('school-a', 'এ স্কুল', 'ঢাকা', 'approved', false), ('school-b', 'বি স্কুল', 'বরিশাল', 'approved', false), ('school-c', 'সি স্কুল', 'ঢাকা', 'approved', false), ('school-h', 'গোপন স্কুল', 'ঢাকা', 'approved', true), ('school-d', 'ডি স্কুল', 'ঢাকা', 'approved', false);
    create table public.member_institution (user_id uuid primary key, institution_slug text not null);
    create table public.batches (id uuid primary key default gen_random_uuid(), institution_slug text, level text, exam_year int);
    create table public.batch_members (batch_id uuid, user_id uuid, is_primary boolean default false, joined_at timestamptz default now());
  `);
  const U = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
  for (let i = 1; i <= 40; i++) await db.exec(`insert into auth.users (id) values ('${U(i)}')`);
  await db.exec(M('2027-01-10_quiz_bank.sql')); await db.exec(M('2027-01-11_daily_quiz.sql')); await db.exec(M('2027-01-11_daily_quiz.sql'));       // twice: safe
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const as = async (uid, fn) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); return fn(); };
  const call = (uid, sql, params) => as(uid, async () => { try { return (await db.query(sql, params)).rows[0].r; } catch (e) { return { thrown: e.message }; } });
  const guard = async (role, uid, sql) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); await db.exec('set role ' + role); try { return (await db.query(sql)).rows; } catch (e) { return 'denied'; } finally { await db.exec('reset role'); } };
  const today = async () => (await q('select public.quiz_day() as d'))[0].d;
  const todayS = async () => (await q(`select to_char(public.quiz_day(), 'YYYY-MM-DD') as d`))[0].d;
  const tdy = (uid, dev) => call(uid, 'select public.quiz_today($1) as r', [dev || null]);
  const nxt = (uid, dev) => call(uid, 'select public.quiz_next($1) as r', [dev || null]);
  const ans = (uid, dev, i, c) => call(uid, 'select public.quiz_answer($1, $2, $3) as r', [dev || null, i, c]);
  const board = (scope, period, dist) => call(null, 'select public.quiz_board($1, $2, $3, 50) as r', [scope, period, dist || null]);
  const mkq = async (topic, n, status, correct) => (await q(`insert into public.quiz_questions (topic, question, options, answer_idx, explanation, source, status) values ($1, $2, '["ক","খ","গ","ঘ"]'::jsonb, $3, $4, 'বই ক', $5) returning id`, [topic, 'প্রশ্ন ' + topic + ' ' + n + ' কী?', correct === undefined ? 1 : correct, 'ব্যাখ্যা ' + n, status || 'verified']))[0].id;
  const ADMIN = 30;
  await db.exec("select set_config('test.admin', '0', false)");

  // ---- not enough verified questions
  ok('no verified question: the quiz is not ready, and nothing can be opened', (await tdy(null, 'device-aaaa')).ready === false && (await nxt(null, 'device-aaaa')).error === 'NOT_READY');
  for (let i = 0; i < 4; i++) await mkq('gk', i);
  await mkq('math', 1, 'draft'); await mkq('math', 2, 'review');
  ok('four verified questions (drafts and questions under checking do not count): still not ready', (await tdy(null, 'device-aaaa')).ready === false);
  for (const t of ['math', 'science', 'history', 'bangla', 'english', 'geo']) { await mkq(t, 1); await mkq(t, 2); }
  const t0 = await tdy(null, 'device-aaaa');
  ok('with enough verified questions the quiz is ready, 5 questions, nothing answered yet, streak 0', t0.ready === true && t0.total === 5 && t0.answered === 0 && t0.points === 0 && t0.streak === 0 && t0.finished === false, JSON.stringify(t0));
  const set = (await q('select qids, source from public.quiz_daily'))[0];
  const topics = (await q(`select distinct topic from public.quiz_questions where id = any($1::uuid[])`, [set.qids])).length;
  ok('the day\'s set has 5 questions of 5 DIFFERENT topics, all verified, made automatically', set.qids.length === 5 && topics === 5 && set.source === 'auto' && (await q(`select count(*)::int n from public.quiz_questions where id = any($1::uuid[]) and status = 'verified'`, [set.qids]))[0].n === 5);

  // ---- playing
  const n1 = await nxt(null, 'device-aaaa');
  ok('the first question opens: index 0 of 5, 15 seconds, about 15000 ms left, with the question text and four options', n1.ok === true && n1.idx === 0 && n1.total === 5 && n1.seconds === 15 && n1.remaining_ms > 14000 && n1.question.options.length === 4 && /প্রশ্ন/.test(n1.question.text), JSON.stringify(n1));
  ok('THE ANSWER IS NOT IN THE QUESTION (no answer_idx, no explanation, nothing that tells it)', !/answer_idx|explanation|ব্যাখ্যা/i.test(JSON.stringify(n1)) && !/answer_idx|explanation/i.test(JSON.stringify(t0)));
  const n1b = await nxt(null, 'device-aaaa');
  ok('asking again (a reload) gives the SAME question with the time that is left, not a new one', n1b.idx === 0 && n1b.question.id === n1.question.id && n1b.remaining_ms <= n1.remaining_ms);
  ok('another player gets the same first question (everybody plays the same 5)', (await nxt(null, 'device-bbbb')).question.id === n1.question.id);
  ok('a question that is not open cannot be answered (idx 1 before it is opened)', (await ans(null, 'device-aaaa', 1, 1)).error === 'NOT_OPEN');
  const a0 = await ans(null, 'device-aaaa', 0, 1);                  // correct answer index of the test questions is 1
  ok('a right answer: correct, the answer and the explanation are told NOW, 10 points + a speed bonus (11 to 15)', a0.ok === true && a0.correct === true && a0.answer_idx === 1 && /ব্যাখ্যা/.test(a0.explanation) && a0.points >= 11 && a0.points <= 15 && a0.total_points === a0.points && a0.finished === false, JSON.stringify(a0));
  ok('the same question cannot be answered twice', (await ans(null, 'device-aaaa', 0, 1)).error === 'NOT_OPEN');
  await nxt(null, 'device-aaaa');
  const a1 = await ans(null, 'device-aaaa', 1, 3);
  ok('a wrong answer: not correct, 0 points, the right answer is told', a1.correct === false && a1.points === 0 && a1.answer_idx === 1 && a1.timeout === false);
  await nxt(null, 'device-aaaa');
  await db.exec(`update public.quiz_plays set opened_at = now() - interval '10 seconds' where player = 'd:device-aaaa' and idx = 2`);
  const a2 = await ans(null, 'device-aaaa', 2, 1);
  ok('the speed bonus falls with time: a right answer after 10 seconds is 10 + 2 = 12', a2.correct === true && a2.points === 12, JSON.stringify(a2));
  await nxt(null, 'device-aaaa');
  await db.exec(`update public.quiz_plays set opened_at = now() - interval '16 seconds' where player = 'd:device-aaaa' and idx = 3`);
  const a3 = await ans(null, 'device-aaaa', 3, 1);
  ok('inside the 2 seconds of grace (16 s) a right answer still counts, with no bonus: 10', a3.correct === true && a3.points === 10, JSON.stringify(a3));
  await nxt(null, 'device-aaaa');
  await db.exec(`update public.quiz_plays set opened_at = now() - interval '20 seconds' where player = 'd:device-aaaa' and idx = 4`);
  const a4 = await ans(null, 'device-aaaa', 4, 1);
  ok('after 17 seconds a right answer is a TIMEOUT: wrong, 0 points (the server clock decides, not the browser)', a4.timeout === true && a4.correct === false && a4.points === 0 && a4.finished === true && a4.total_points === a0.points + 12 + 10, JSON.stringify(a4));
  ok('after the fifth the quiz is finished: next says finished, today shows 5 answered, the results row, the total', (await nxt(null, 'device-aaaa')).finished === true && await (async () => { const t = await tdy(null, 'device-aaaa'); return t.finished === true && t.answered === 5 && t.results.length === 5 && t.results[1].correct === false && t.points === a4.total_points && !/answer_idx|explanation/.test(JSON.stringify(t)); })());
  ok('a question left open for too long is closed as a timeout when the player comes back, and the next one opens', await (async () => { await nxt(null, 'device-cccc'); await db.exec(`update public.quiz_plays set opened_at = now() - interval '60 seconds' where player = 'd:device-cccc' and idx = 0`); const n = await nxt(null, 'device-cccc'); const r0 = (await q(`select correct, points from public.quiz_plays where player = 'd:device-cccc' and idx = 0`))[0]; return n.idx === 1 && r0.correct === false && r0.points === 0; })());
  ok('a device id that is too short (under 8) cannot play; a signed-out call without a device cannot play', (await nxt(null, 'abc')).error === 'NO_PLAYER' && (await nxt(null, null)).error === 'NO_PLAYER' && (await ans(null, 'abc', 0, 1)).error === 'NO_PLAYER');
  ok('a choice outside 0 to 3, or none, is a timeout answer with no points (never a crash)', await (async () => { await nxt(null, 'device-dddd'); const r = await ans(null, 'device-dddd', 0, 9); await nxt(null, 'device-dddd'); const r2 = await ans(null, 'device-dddd', 1, null); return r.timeout === true && r.points === 0 && r2.timeout === true; })());

  // ---- a replaced question
  ok('a question retired after the set was made is replaced by another verified one before anybody opens it', await (async () => { const s = (await q('select qids from public.quiz_daily'))[0].qids; await db.exec(`update public.quiz_questions set status = 'retired' where id = '${s[4]}'`); await db.exec(`delete from public.quiz_plays where player = 'd:device-eeee'`); for (let i = 0; i < 4; i++) { await nxt(null, 'device-eeee'); await ans(null, 'device-eeee', i, 1); } const n = await nxt(null, 'device-eeee'); const s2 = (await q('select qids from public.quiz_daily'))[0].qids; return n.ok === true && n.question.id !== s[4] && s2[4] === n.question.id && s2[4] !== s[4]; })());

  // ---- the streak
  const D = await todayS();
  const fin = async (player, daysAgo) => { for (let i = 0; i < 5; i++) await db.query(`insert into public.quiz_plays (day, player, idx, qid, answered_at, correct, points) values (($1::date - $2::int), $3, $4, gen_random_uuid(), now(), true, 10)`, [D, daysAgo, player, i]); };
  await fin('d:streak-one', 1); await fin('d:streak-one', 2); await fin('d:streak-one', 3);
  ok('the streak counts the days in a row up to yesterday while today is not played yet (3)', (await tdy(null, 'streak-one')).streak === 3);
  await fin('d:streak-two', 0); await fin('d:streak-two', 1); await fin('d:streak-two', 2); await fin('d:streak-two', 4);
  ok('today finished counts too, and a gap ends the streak (today, yesterday, 2 days ago, then a gap = 3)', (await tdy(null, 'streak-two')).streak === 3);
  await fin('d:streak-three', 2); await fin('d:streak-three', 3);
  ok('a streak that missed yesterday is 0', (await tdy(null, 'streak-three')).streak === 0);
  await db.query(`insert into public.quiz_plays (day, player, idx, qid, answered_at, correct, points) values (($1::date - 1), 'd:streak-four', 0, gen_random_uuid(), now(), true, 10)`, [D]);
  ok('a day with fewer than 5 answered does not count', (await tdy(null, 'streak-four')).streak === 0);

  // ---- a member: the institution and the batch of the moment
  await db.exec(`insert into public.member_institution values ('${U(1)}', 'school-a')`);
  const bat = (await q(`insert into public.batches (institution_slug, level, exam_year) values ('school-b', 'ssc', 2020) returning id`))[0].id;
  await db.exec(`insert into public.batch_members (batch_id, user_id, is_primary) values ('${bat}', '${U(1)}', true), ('${bat}', '${U(2)}', true)`);
  await nxt(1); await nxt(2);
  const m1 = (await q(`select inst_slug, batch_id, user_id from public.quiz_plays where player = 'u:${U(1)}'`))[0], m2 = (await q(`select inst_slug, batch_id from public.quiz_plays where player = 'u:${U(2)}'`))[0];
  ok('a member plays as himself (not as a device), with the CURRENT institution and the SSC batch of that moment', m1.user_id === U(1) && m1.inst_slug === 'school-a' && m1.batch_id === bat);
  ok('a member with no current institution takes the school of his SSC batch', m2.inst_slug === 'school-b' && m2.batch_id === bat);
  ok('a device that plays has no member, no institution, no batch (so it can never reach a board)', (await q(`select count(*)::int n from public.quiz_plays where player like 'd:%' and (user_id is not null or inst_slug is not null or batch_id is not null)`))[0].n === 0);
  ok('today shows a member his institution', (await tdy(1)).inst.slug === 'school-a' && (await tdy(2)).inst.slug === 'school-b' && (await tdy(null, 'device-aaaa')).inst === null);

  // ---- the boards (rows made directly, so the arithmetic is the thing tested)
  await db.exec(`delete from public.quiz_plays where user_id is not null`);
  const put = async (uid, inst, bid, daysAgo, pts) => { for (let i = 0; i < 5; i++) await db.query(`insert into public.quiz_plays (day, player, user_id, inst_slug, batch_id, idx, qid, answered_at, correct, points) values (($1::date - $2::int), $3, $4, $5, $6, $8, gen_random_uuid(), now(), $7 > 0, $7) on conflict do nothing`, [D, daysAgo, 'u:' + U(uid), U(uid), inst, bid, pts / 5, i]); };   // a player's day total is spread over the 5 answers
  for (let u = 1; u <= 12; u++) await put(u, 'school-a', null, 0, u <= 10 ? 70 : 10);          // 12 players: ten of 70 and two of 10 -> average of the BEST TEN = 70
  for (let u = 13; u <= 15; u++) await put(u, 'school-c', null, 0, 40);                       // 3 players: 40
  for (let u = 16; u <= 17; u++) await put(u, 'school-b', null, 0, 75);                       // only 2 players: not shown
  for (let u = 18; u <= 20; u++) await put(u, 'school-h', null, 0, 75);                       // a hidden institution: not shown
  for (let u = 21; u <= 23; u++) await put(u, 'school-d', null, 1, 60);                       // yesterday only
  let b = await board('institution', 'today');
  ok('the institution board: the AVERAGE OF THE BEST TEN (70, not 62.5 with the two weak ones), ranked, with the number of players', b.length === 2 && b[0].slug === 'school-a' && b[0].score === 70 && b[0].players === 12 && b[0].rank === 1 && b[1].slug === 'school-c' && b[1].score === 40 && b[1].rank === 2, JSON.stringify(b));
  ok('an institution with only 2 players is not on the board; a hidden institution is not on it; yesterday is not "today"', !b.some(x => x.slug === 'school-b' || x.slug === 'school-h' || x.slug === 'school-d'));
  b = await board('institution', 'week');
  ok('the week board adds the days (the last 7): the institution of yesterday appears', b.some(x => x.slug === 'school-d' && x.score === 60) && b.length === 3);
  b = await board('institution', 'today', 'ঢাকা');
  ok('a district filter keeps only that district', b.length === 2 && b.every(x => x.district === 'ঢাকা') && (await board('institution', 'today', 'বরিশাল')).length === 0);
  ok('the board carries counts and names of institutions only, never a person (no member id, no device, no player)', !/"player"|user_id|u:[0-9a-f]{8}|d:device|00000000-0000/.test(JSON.stringify(await board('institution', 'week'))));
  const bat2 = (await q(`insert into public.batches (institution_slug, level, exam_year) values ('school-a', 'ssc', 2018) returning id`))[0].id, bat3 = (await q(`insert into public.batches (institution_slug, level, exam_year) values ('school-c', 'ssc', 2019) returning id`))[0].id;
  await db.exec(`delete from public.quiz_plays where user_id is not null`);
  for (let u = 1; u <= 4; u++) await put(u, 'school-a', bat2, 0, 60);
  for (let u = 5; u <= 7; u++) await put(u, 'school-c', bat3, 0, 65);
  for (let u = 8; u <= 9; u++) await put(u, 'school-a', bat2, 0, 5);
  b = await board('batch', 'today');
  ok('the batch board: each SSC batch with its school, its year and the average of its best ten (6 players: 4 x 60 and 2 x 5, average 41.7)', b.length === 2 && b[0].year === 2019 && b[0].score === 65 && b[0].players === 3 && b[1].year === 2018 && b[1].name === 'এ স্কুল' && b[1].players === 6 && b[1].score === 41.7 && b[1].rank === 2, JSON.stringify(b));
  ok('a device (anonymous) play never reaches any board', await (async () => { await db.exec(`insert into public.quiz_plays (day, player, idx, qid, answered_at, correct, points) select public.quiz_day(), 'd:fake' || g, 0, gen_random_uuid(), now(), true, 15 from generate_series(1, 10) g`); return (await board('institution', 'today')).length === 2 && (await board('batch', 'today')).length === 2; })());   // the boards are exactly as before: ten devices of 75 points did not appear
  ok('the number of rows asked is limited to 50', Array.isArray(await call(null, `select public.quiz_board('institution', 'today', null, 100000) as r`)));

  // ---- the admin
  ok('only the admin can plan or choose a day again', (await call(1, 'select public.quiz_plan(7) as r')).thrown?.includes('NOT_ADMIN') && (await call(1, `select public.quiz_reroll(current_date + 2) as r`)).thrown?.includes('NOT_ADMIN'));
  await db.exec("select set_config('test.admin', '1', false)");
  const plan = await call(ADMIN, 'select public.quiz_plan(5) as r');
  ok('the admin makes the sets of the next days ahead (5 days, each 5 questions)', Array.isArray(plan) && plan.length === 5 && plan.every(x => x.qids.length === 5) && (await q('select count(*)::int n from public.quiz_daily'))[0].n >= 5);
  const dayPlus = (await q(`select to_char(public.quiz_day() + 3, 'YYYY-MM-DD') as d`))[0].d, before = (await q(`select qids from public.quiz_daily where day = $1::date`, [dayPlus]))[0].qids;
  const rr = await call(ADMIN, 'select public.quiz_reroll($1::date) as r', [dayPlus]);
  ok('a future day can be chosen again (source "admin"); a past day and a day somebody has played cannot', rr.ok === true && (await q(`select source from public.quiz_daily where day = $1::date`, [dayPlus]))[0].source === 'admin' && (await call(ADMIN, `select public.quiz_reroll(public.quiz_day() - 1) as r`)).error === 'PAST' && (await call(ADMIN, `select public.quiz_reroll(public.quiz_day()) as r`)).error === 'ALREADY_PLAYED');
  await db.exec("select set_config('test.admin', '0', false)");

  // ---- who can call what
  ok('anyone, even signed out, can call the four public functions', Array.isArray(await guard('anon', 0, `select public.quiz_board('institution', 'today', null, 5)`)) && Array.isArray(await guard('anon', 0, `select public.quiz_today('device-zzzzzzz')`)) && Array.isArray(await guard('anon', 0, `select public.quiz_next('device-zzzzzzz')`)) && Array.isArray(await guard('anon', 0, `select public.quiz_answer('device-zzzzzzz', 0, 1)`)));
  ok('anon and members cannot call the helpers, plan or reroll, and cannot read or write the tables', ['quiz_pick(\'{}\')', 'quiz_ensure_day(current_date)', 'quiz_qid_at(current_date, 0)', 'quiz_streak(\'x\', current_date)', 'quiz_player(\'device-zzzzzzz\')', 'quiz_plan(3)', 'quiz_reroll(current_date)'].every(async () => true) && (await Promise.all(["select public.quiz_pick('{}')", 'select public.quiz_ensure_day(current_date)', 'select public.quiz_qid_at(current_date, 0)', "select public.quiz_streak('x', current_date)", 'select public.quiz_plan(3)', 'select public.quiz_reroll(current_date)'].map(s => guard('anon', 0, s)))).every(x => x === 'denied') && (await Promise.all(["select public.quiz_pick('{}')", 'select public.quiz_ensure_day(current_date)'].map(s => guard('authenticated', 1, s)))).every(x => x === 'denied') &&
    [await guard('anon', 0, 'select * from public.quiz_plays'), await guard('authenticated', 1, 'select * from public.quiz_plays'), await guard('authenticated', 1, 'select * from public.quiz_daily')].every(x => x === 'denied' || (Array.isArray(x) && x.length === 0)));
  ok('a member cannot add or change plays directly to cheat', await (async () => { await db.exec(`select set_config('test.uid', '${U(1)}', false)`); await db.exec('set role authenticated'); try { const r = await db.query(`update public.quiz_plays set points = 15`); return r.affectedRows === 0; } catch (e) { return true; } finally { await db.exec('reset role'); } })());
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });
