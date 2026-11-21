// A whole day of the league on the REAL functions, nothing inserted by hand into the quiz tables: members of two batches play the daily quiz through quiz_next / quiz_answer,
// a duel of those two batches is read through duel_state, and the league board and the batch summary add its points.   node tools/tests/test_league_flow_sql.js
//   one-time setup:  npm install --prefix %TEMP%\pgl @electric-sql/pglite      run:  set PGLITE_DIR=%TEMP%\pgl   then   node tools/tests/test_league_flow_sql.js
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
    create table public.listing_submissions (desired_slug text, institution_name text, status text, district text, is_hidden boolean default false);
    insert into public.listing_submissions values ('school-a', 'এ স্কুল', 'approved', 'ঢাকা', false), ('school-b', 'বি স্কুল', 'approved', 'কুমিল্লা', false);
    create table public.members (user_id uuid primary key, display_name text);
    create table public.member_institution (user_id uuid primary key, institution_slug text not null);
    create table public.batches (id uuid primary key default gen_random_uuid(), institution_slug text, level text, exam_year int);
    create table public.batch_members (batch_id uuid, user_id uuid, is_primary boolean default false, joined_at timestamptz default now());
    create function public.batch_first_name(n text) returns text language sql immutable as $$ select nullif(split_part(btrim(coalesce(n, '')), ' ', 1), '') $$;
  `);
  const U = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
  for (let i = 1; i <= 20; i++) { await db.exec(`insert into auth.users (id) values ('${U(i)}')`); await db.exec(`insert into public.members values ('${U(i)}', 'নাম${i} পদবি')`); }
  for (const f of ['2027-01-10_quiz_bank.sql', '2027-01-11_daily_quiz.sql', '2027-01-12_batch_challenge.sql', '2027-01-13_rope_pull.sql', '2027-01-14_league.sql', '2027-01-16_batch_duel.sql', '2027-01-17_league_guard.sql', '2027-01-18_quiz_bands.sql']) await db.exec(M(f));
  await db.exec("select set_config('test.admin', '0', false)");
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const call = async (uid, sql, params) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); try { return (await db.query(sql, params)).rows[0].r; } catch (e) { return { thrown: e.message }; } };
  const mkBatch = async (slug, year, users) => { const id = (await q(`insert into public.batches (institution_slug, level, exam_year) values ($1, 'ssc', $2) returning id`, [slug, year]))[0].id; for (const u of users) await db.exec(`insert into public.batch_members (batch_id, user_id, is_primary) values ('${id}', '${U(u)}', true)`); return id; };
  const A = await mkBatch('school-a', 2020, [1, 2, 3, 4, 5, 6]), B = await mkBatch('school-b', 2019, [7, 8, 9, 10, 11, 12]);
  const topics = ['bangla', 'english', 'math', 'science', 'gk', 'history'];
  for (let i = 0; i < 12; i++) await db.query(`insert into public.quiz_questions (topic, question, options, answer_idx, explanation, source, status) values ($1, $2, '["ক","খ","গ","ঘ"]'::jsonb, 1, 'ব্যাখ্যা', 'বই ক', 'verified')`, [topics[i % 6], 'প্রশ্ন ' + i + ' কী?']);

  // everybody who plays: a member answers the 5 questions of today (choice 1 is right) - the first 'right' of them answer all right, the others miss some
  const playDay = async (uid, rightCount) => { for (let i = 0; i < 5; i++) { const n = await call(uid, `select public.quiz_next($1, 'c9-10') as r`, ['dev-' + uid]); if (!n || !n.ok) return { stuck: JSON.stringify(n) }; const a = await call(uid, `select public.quiz_answer($1, $2, $3) as r`, ['dev-' + uid, n.idx != null ? n.idx : i, i < rightCount ? 1 : 3]); if (!a || !a.ok) return { stuck: JSON.stringify(a) }; } return { ok: true }; };
  const r1 = await playDay(1, 5); ok('a member can play the whole daily quiz on the real functions (5 questions)', r1.ok === true, JSON.stringify(r1));
  for (const [u, n] of [[2, 5], [3, 4], [4, 3], [7, 2], [8, 2], [9, 1]]) await playDay(u, n);
  const rows = await q(`select count(*)::int as n, count(distinct user_id)::int as u, count(*) filter (where batch_id is null)::int as nobatch, sum(points)::int as pts from public.quiz_plays where user_id is not null`);
  ok('the quiz stores the member and the batch of the FIRST question on every row (no row without a batch), and points', rows[0].u === 7 && rows[0].nobatch === 0 && rows[0].pts > 0, JSON.stringify(rows[0]));
  const dd = (await q(`insert into public.batch_duels (created_by, day, batch_a, batch_b) values ($1, public.quiz_day(), $2, $3) returning id`, [U(1), A, B]))[0].id;
  const s = await call(null, 'select public.duel_state($1) as r', [dd]);
  ok('the duel of today counts exactly the members who played: A has 4, B has 3; the averages are the mean of their daily points; both sides are valid (3 or more players); live, so no winner yet', s.status === 'live' && s.players_a === 4 && s.players_b === 3 && s.valid === true && s.winner === null && s.avg_a > s.avg_b && s.avg_a > 0, JSON.stringify(s));
  const topA = (await q(`select round(avg(sc), 1) as a from (select sum(points) as sc from public.quiz_plays where user_id in ('${U(1)}','${U(2)}','${U(3)}','${U(4)}') group by user_id) x`))[0].a;
  ok('the average of side A is the plain mean of the points of its 4 players, worked out again from the quiz table', Number(topA) === s.avg_a, topA + ' vs ' + s.avg_a);
  // the day passes: the duel becomes "done" and the league gets its points
  await db.exec(`update public.batch_duels set day = public.quiz_day() - 1 where id = '${dd}'`); await db.exec(`update public.quiz_plays set day = day - 1`);
  const done = await call(null, 'select public.duel_state($1) as r', [dd]);
  ok('the next day the duel is done and A wins (higher average): the winner comes from the server', done.status === 'done' && done.winner === 'a' && done.valid === true, JSON.stringify(done));
  const lb = await call(null, `select public.league_board('batch', 'all', 10) as r`), li = await call(null, `select public.league_board('institution', 'week', 10) as r`), bs = await call(null, 'select public.league_batch($1) as r', [A]), bs2 = await call(null, 'select public.league_batch($1) as r', [B]);
  ok('the league boards give A 50 points (one win) and show B with none (a loss earns 0, so B is not listed)', lb.length === 1 && lb[0].slug === 'school-a' && lb[0].points === 50 && lb[0].wins === 1 && li.length === 1 && li[0].points === 50 && bs.week_points === 50 && bs.week_wins === 1 && bs2.week_points === 0, JSON.stringify([lb, bs2.week_points]));
  const qb = await call(null, `select public.quiz_board('batch', 'week', null, 10, 'c9-10') as r`);
  ok('the ordinary daily-quiz batch board and the duel agree about who is ahead (A before B), because they use the same rule', Array.isArray(qb) && qb.length === 2 && qb[0].slug === 'school-a' && qb[0].score > qb[1].score, JSON.stringify(qb.map(x => x.slug + x.score)));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });
