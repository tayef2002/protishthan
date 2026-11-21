// Runs migrations/2027-01-17_league_guard.sql (after the quiz, the live game, the rope, the league and the duel) in a real Postgres engine (PGlite):
// the list of batches excluded from the league, and the limit for guests of the daily quiz.
//   one-time setup:  npm install --prefix %TEMP%\pgl @electric-sql/pglite      run:  set PGLITE_DIR=%TEMP%\pgl   then   node tools/tests/test_league_guard_sql.js
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
    insert into public.listing_submissions values ('school-a', 'এ স্কুল', 'approved', 'ঢাকা', false), ('school-b', 'বি স্কুল', 'approved', 'কুমিল্লা', false), ('school-c', 'সি স্কুল', 'approved', 'সিলেট', false);
    create table public.members (user_id uuid primary key, display_name text);
    create table public.member_institution (user_id uuid primary key, institution_slug text not null);
    create table public.batches (id uuid primary key default gen_random_uuid(), institution_slug text, level text, exam_year int);
    create table public.batch_members (batch_id uuid, user_id uuid, is_primary boolean default false, joined_at timestamptz default now());
    create function public.batch_first_name(n text) returns text language sql immutable as $$ select nullif(split_part(btrim(coalesce(n, '')), ' ', 1), '') $$;
  `);
  const U = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
  for (let i = 1; i <= 60; i++) { await db.exec(`insert into auth.users (id) values ('${U(i)}')`); await db.exec(`insert into public.members values ('${U(i)}', 'নাম${i} পদবি')`); }
  for (const f of ['2027-01-10_quiz_bank.sql', '2027-01-11_daily_quiz.sql', '2027-01-12_batch_challenge.sql', '2027-01-13_rope_pull.sql', '2027-01-14_league.sql', '2027-01-16_batch_duel.sql', '2027-01-17_league_guard.sql', '2027-01-17_league_guard.sql', '2027-01-18_quiz_bands.sql', '2027-01-18_quiz_bands.sql']) await db.exec(M(f));     // twice at the end: safe
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const call = async (uid, sql, params) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); try { return (await db.query(sql, params)).rows[0].r; } catch (e) { return { thrown: e.message }; } };
  const guard = async (role, uid, sql) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); await db.exec('set role ' + role); try { return (await db.query(sql)).rows; } catch (e) { return 'denied'; } finally { await db.exec('reset role'); } };
  const admin = async on => db.exec(`select set_config('test.admin', '${on ? 1 : 0}', false)`);
  await admin(false);
  const range = (a, n) => Array.from({ length: n }, (_, i) => a + i);
  const mkBatch = async (slug, year, users) => { const id = (await q(`insert into public.batches (institution_slug, level, exam_year) values ($1, 'ssc', $2) returning id`, [slug, year]))[0].id; for (const u of users) await db.exec(`insert into public.batch_members (batch_id, user_id, is_primary) values ('${id}', '${U(u)}', true)`); return id; };
  const A = await mkBatch('school-a', 2020, range(1, 8)), B = await mkBatch('school-b', 2019, range(9, 8)), C = await mkBatch('school-c', 2018, range(17, 8));
  const topics = ['bangla', 'english', 'math', 'science', 'gk', 'history'], qrows = [];
  for (let i = 0; i < 12; i++) qrows.push((await q(`insert into public.quiz_questions (topic, question, options, answer_idx, explanation, source, status) values ($1, $2, '["ক","খ","গ","ঘ"]'::jsonb, 1, 'ব্যাখ্যা', 'বই ক', 'verified') returning id`, [topics[i % 6], 'প্রশ্ন ' + i + ' কী?']))[0].id);
  const DAY = 86400; let host = 1;
  const make = async o => {
    const id = (await q(`insert into public.batch_challenges (created_by, batch_id, mode, opp_batch_id, start_at, target, qids) values ($1, $2, $3, $4, now() - interval '${o.ago} seconds', $5, $6::uuid[]) returning id`, [U(host++), o.batch, o.mode || 'clock', o.opp || null, o.target || 15, qrows]))[0].id;
    for (const side of o.sides) for (const u of side.users) { await db.query(`insert into public.challenge_players (challenge_id, user_id, batch_id) values ($1, $2, $3)`, [id, U(u), side.batch]); for (let sl = 0; sl < 12; sl++) await db.query(`insert into public.challenge_answers (challenge_id, user_id, slot, qid, choice, correct) values ($1, $2, $3, $4, 1, $5)`, [id, U(u), sl, qrows[sl], sl < side.right]); }
  };
  const play = async (day, user, batch, inst, total) => { for (let idx = 0; idx < 5; idx++) { const p = Math.max(0, Math.min(15, total - idx * 15)); await db.query(`insert into public.quiz_plays (day, player, user_id, inst_slug, batch_id, idx, qid, answered_at, points, correct, band) values ($1::date, $2, $3, $4, $5, $6, gen_random_uuid(), now(), $7, $8, 'c9-10')`, [day, 'u:' + U(user), U(user), inst, batch, idx, p, p > 0]); if (total - idx * 15 <= 0) break; } };
  const dayS = async n => (await q(`select (public.quiz_day() + ($1::int))::text as d`, [n]))[0].d;
  // the league: A clock 68, B clock 68, A beats C in a rope match (A 24 + 50, C 18), B beats C in a duel (50), B beats A in a duel (50)
  await make({ batch: A, ago: 3 * DAY, sides: [{ batch: A, users: range(1, 6), right: 3 }] });
  await make({ batch: B, ago: 3 * DAY, sides: [{ batch: B, users: range(9, 6), right: 3 }] });
  await make({ batch: A, opp: C, mode: 'rope', ago: 2 * DAY, sides: [{ batch: A, users: range(1, 6), right: 4 }, { batch: C, users: range(17, 6), right: 3 }] });
  const d1 = (await q(`insert into public.batch_duels (created_by, day, batch_a, batch_b) values ($1, public.quiz_day() - 1, $2, $3) returning day::text as d`, [U(9), B, C]))[0].d;
  for (const u of range(9, 3)) await play(d1, u, B, 'school-b', 60); for (const u of range(17, 3)) await play(d1, u, C, 'school-c', 30);
  const d2 = (await q(`insert into public.batch_duels (created_by, day, batch_a, batch_b) values ($1, public.quiz_day() - 2, $2, $3) returning day::text as d`, [U(9), A, B]))[0].d;
  for (const u of range(1, 3)) await play(d2, u, A, 'school-a', 30); for (const u of range(9, 3)) await play(d2, u, B, 'school-b', 60);
  const pts = async (scope, period) => Object.fromEntries((await call(null, `select public.league_board($1, $2, 20) as r`, [scope, period || 'all'])).map(x => [x.slug + (scope === 'batch' ? x.year : ''), x.points]));
  const before = await pts('batch');
  ok('before any exclusion: A 142 (68 + 74 + a lost duel), B 168 (68 + 50 + 50), C 18 (a lost rope match)', before.school_a === undefined && before['school-a2020'] === 142 && before['school-b2019'] === 168 && before['school-c2018'] === 18, JSON.stringify(before));

  // ---- the exclusion
  ok('only an admin can exclude or take back: a signed-in non-admin is refused (NOT_ADMIN), the public role is denied', (await call(3, `select public.league_exclude('${A}', 'x') as r`)).thrown === 'NOT_ADMIN' && (await call(3, `select public.league_include('${A}') as r`)).thrown === 'NOT_ADMIN' && (await call(3, 'select public.league_admin(10) as r')).thrown === 'NOT_ADMIN' && (await guard('anon', 0, `select public.league_exclude('${A}', 'x')`)) === 'denied' && (await guard('anon', 0, 'select public.league_admin(5)')) === 'denied');
  await admin(true);
  ok('the admin excludes batch A with a reason; an unknown batch is "not found"', (await call(50, `select public.league_exclude($1, 'নতুন অ্যাকাউন্টে ভরা') as r`, [A])).ok === true && (await call(50, `select public.league_exclude('00000000-0000-0000-0000-0000000000aa', 'x') as r`)).error === 'NOT_FOUND');
  await admin(false);
  const after = await pts('batch');
  ok('after: A is not on the board; B keeps 118 (the duel it won AGAINST A gives nothing any more); C has nothing (the rope match against A gives nothing to the other side either), so it is not listed', !('school-a2020' in after) && after['school-b2019'] === 118 && !('school-c2018' in after), JSON.stringify(after));
  const inst = await pts('institution'), bsum = await call(null, 'select public.league_batch($1) as r', [A]), bsB = await call(null, 'select public.league_batch($1) as r', [B]);
  ok('the institution board and the batch summaries follow: school A is gone, B 118; the summary of A shows 0 points', !('school-a' in inst) && inst['school-b'] === 118 && bsum.all_points === 0 && bsB.all_points === 118, JSON.stringify([inst, bsum.all_points, bsB.all_points]));
  // the daily quiz boards today: A and B with 4 players each
  const today = await dayS(0);
  for (const u of range(1, 4)) await play(today, u, A, 'school-a', 50); for (const u of range(9, 4)) await play(today, u, B, 'school-b', 40);
  const qb = await call(null, `select public.quiz_board('batch', 'today', null, 20, 'c9-10') as r`), qi = await call(null, `select public.quiz_board('institution', 'today', null, 20, 'c9-10') as r`);
  ok('the daily-quiz boards leave out the players of the excluded batch (batch board and school board): only B is listed', qb.length === 1 && qb[0].slug === 'school-b' && qi.length === 1 && qi[0].slug === 'school-b', JSON.stringify([qb.map(x => x.slug), qi.map(x => x.slug)]));
  const duelNow = await call(null, 'select public.duel_state($1) as r', [(await q(`select id from public.batch_duels where batch_a = $1 limit 1`, [A]))[0].id]);
  ok('the numbers of a single duel are still shown as they are (the exclusion is about points and boards, not about hiding what happened)', duelNow.found === true && duelNow.players_a === 3);
  await admin(true);
  const adm = await call(50, 'select public.league_admin(10) as r');
  ok('the admin view lists the excluded batch with its reason and the batches with points with members, newcomers of the last 24 hours, week and all-time points, matches and the excluded flag (A is marked, B and C are not)', adm.excluded.length === 1 && adm.excluded[0].reason === 'নতুন অ্যাকাউন্টে ভরা' && adm.excluded[0].batch.name === 'এ স্কুল' && adm.top.length === 3 && adm.top.find(x => x.batch.name === 'এ স্কুল').excluded === true && adm.top.find(x => x.batch.name === 'বি স্কুল').excluded === false && adm.top.find(x => x.batch.name === 'এ স্কুল').all === 142 && adm.top.find(x => x.batch.name === 'বি স্কুল').members === 8 && adm.top.find(x => x.batch.name === 'বি স্কুল').new24 === 8 && adm.top[0].batch.name === 'বি স্কুল', JSON.stringify(adm).slice(0, 300));
  ok('taking the batch back restores everything: A 142, B 168, C 18, and the quiz board lists both batches again', (await call(50, `select public.league_include($1) as r`, [A])).ok === true && JSON.stringify(await pts('batch')) === JSON.stringify(before) && (await call(null, `select public.quiz_board('batch', 'today', null, 20, 'c9-10') as r`)).length === 2);
  await admin(false);

  // ---- the guests of the daily quiz
  const dev = n => 'guest-device-' + n;
  const next = (uid, d) => call(uid, 'select public.quiz_next($1) as r', [d || null]);
  await db.exec(`insert into public.quiz_anon_day (day, n) values (public.quiz_day(), 9998) on conflict (day) do update set n = 9998`);
  const g1 = await next(null, dev(1)), g2 = await next(null, dev(2)), g3 = await next(null, dev(3));
  ok('the 9,999th and the 10,000th new guest of the day start; the 10,001st is refused (GUEST_LIMIT) and nothing is stored for it', g1.ok === true && g2.ok === true && g3.error === 'GUEST_LIMIT' && (await q(`select count(*)::int n from public.quiz_plays where player = 'd:' || $1`, [dev(3)]))[0].n === 0 && (await q('select n from public.quiz_anon_day where day = public.quiz_day()'))[0].n === 10000, JSON.stringify([g1.ok, g2.ok, g3]));
  const ans = (uid, d, i) => call(uid, 'select public.quiz_answer($1, $2, $3) as r', [d || null, i, 1]);
  ok('a guest who already started today goes on (the second question is not a new guest and the counter does not move); a member is never refused, even at the limit', await (async () => { const a = await ans(null, dev(1), 0); const n2 = await next(null, dev(1)); const m = await next(30); return a.ok === true && n2.ok === true && n2.idx === 1 && m.ok === true && (await q('select n from public.quiz_anon_day where day = public.quiz_day()'))[0].n === 10000; })());
  ok('the status of today (quiz_today) still works for a refused guest (no error, nothing stored)', (await call(null, 'select public.quiz_today($1) as r', [dev(3)])).ready === true);

  // ---- the clean-up: guest plays older than 14 days go when a new day is made; plays of members stay
  const old20 = await dayS(-20), old5 = await dayS(-5);
  await db.query(`insert into public.quiz_plays (day, player, user_id, idx, qid, answered_at, points) values ($1::date, 'd:old-guest-1', null, 0, gen_random_uuid(), now(), 10), ($1::date, 'u:' || $2::text, $2::uuid, 0, gen_random_uuid(), now(), 10), ($3::date, 'd:recent-guest-1', null, 0, gen_random_uuid(), now(), 10)`, [old20, U(31), old5]);
  await db.exec(`insert into public.quiz_anon_day (day, n) values (public.quiz_day() - 40, 77)`);
  await db.exec(`delete from public.quiz_daily where day = public.quiz_day()`);      // as at midnight: today's set does not exist yet
  await next(32);                                                                       // the first request of the day makes the set (and cleans)
  const left = (await q(`select player from public.quiz_plays where day in ($1::date, $2::date) order by player`, [old20, old5])).map(r => r.player);
  ok('a new day removes the guest plays older than 14 days (20 days ago) and the guest counters older than 30 days, and keeps a member\'s old play and a 5-day-old guest play', left.join() === `d:recent-guest-1,u:${U(31)}` && (await q('select count(*)::int n from public.quiz_anon_day where day < public.quiz_day() - 30'))[0].n === 0, JSON.stringify(left));
  ok('the new tables are closed to the public and to members', (await Promise.all(['select * from public.league_excluded', 'select * from public.quiz_anon_day'].map(s => guard('authenticated', 3, s)))).every(x => x === 'denied' || (Array.isArray(x) && x.length === 0)) && (await Promise.all(['select * from public.league_excluded', 'select * from public.quiz_anon_day'].map(s => guard('anon', 0, s)))).every(x => x === 'denied'));
  ok('the replaced public functions are still callable by the public (quiz_next, quiz_board, league_board), the helpers are not', Array.isArray(await guard('anon', 0, `select public.quiz_board('batch', 'today', null, 5)`)) && Array.isArray(await guard('anon', 0, `select public.league_board('batch', 'all', 5)`)) && Array.isArray(await guard('anon', 0, `select public.quiz_next('guest-device-xyz-1')`)) && (await guard('anon', 0, `select public.quiz_ensure_day(public.quiz_day())`)) === 'denied' && (await guard('anon', 0, `select * from public.league_rows_all('2000-01-01')`)) === 'denied' && (await guard('anon', 0, `select * from public.league_rows_raw('2000-01-01')`)) === 'denied');
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });
