// Runs migrations/2027-01-14_league.sql (after the question bank, the live game and the rope) in a real Postgres engine (PGlite): the league boards and the batch summary.
//   one-time setup:  npm install --prefix %TEMP%\pgl @electric-sql/pglite      run:  set PGLITE_DIR=%TEMP%\pgl   then   node tools/tests/test_league_sql.js
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
    insert into public.listing_submissions (desired_slug, institution_name, status, district, is_hidden) values ('school-a', 'এ স্কুল', 'approved', 'ঢাকা', false), ('school-b', 'বি স্কুল', 'approved', 'কুমিল্লা', false), ('school-c', 'সি স্কুল', 'approved', 'ঢাকা', true);
    create table public.members (user_id uuid primary key, display_name text);
    create table public.batches (id uuid primary key default gen_random_uuid(), institution_slug text, level text, exam_year int);
    create table public.batch_members (batch_id uuid, user_id uuid, joined_at timestamptz default now());
    create function public.batch_first_name(n text) returns text language sql immutable as $$ select nullif(split_part(btrim(coalesce(n, '')), ' ', 1), '') $$;
  `);
  const U = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
  for (let i = 1; i <= 40; i++) { await db.exec(`insert into auth.users (id) values ('${U(i)}')`); await db.exec(`insert into public.members values ('${U(i)}', 'নাম${i} পদবি')`); }
  await db.exec(M('2027-01-10_quiz_bank.sql')); await db.exec(M('2027-01-12_batch_challenge.sql')); await db.exec(M('2027-01-13_rope_pull.sql')); await db.exec(M('2027-01-14_league.sql')); await db.exec(M('2027-01-14_league.sql'));     // twice: safe
  await db.exec("select set_config('test.admin', '0', false)");
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const guard = async (role, sql) => { await db.exec('set role ' + role); try { return (await db.query(sql)).rows; } catch (e) { return 'denied'; } finally { await db.exec('reset role'); } };
  const mkBatch = async (slug, year, users) => { const id = (await q(`insert into public.batches (institution_slug, level, exam_year) values ($1, 'ssc', $2) returning id`, [slug, year]))[0].id; for (const u of users) await db.exec(`insert into public.batch_members (batch_id, user_id) values ('${id}', '${U(u)}')`); return id; };
  const range = (a, n) => Array.from({ length: n }, (_, i) => a + i);
  const A20 = await mkBatch('school-a', 2020, range(1, 8)), A19 = await mkBatch('school-a', 2019, range(9, 8)), B20 = await mkBatch('school-b', 2020, range(17, 8)), C20 = await mkBatch('school-c', 2020, range(25, 8));
  const qrows = []; for (let i = 0; i < 12; i++) qrows.push((await q(`insert into public.quiz_questions (topic, question, options, answer_idx, explanation, source, status) values ('gk', $1, '["ক","খ","গ","ঘ"]'::jsonb, 1, 'ব্যাখ্যা', 'বই ক', 'verified') returning id`, ['প্রশ্ন ' + i]))[0].id);
  // a finished challenge: ago = seconds since its start; sides = [{ batch, users: [..], right: u => number }]
  let host = 1;
  const make = async (o) => {
    const id = (await q(`insert into public.batch_challenges (created_by, batch_id, mode, opp_batch_id, start_at, target, cancelled, qids) values ($1, $2, $3, $4, now() - interval '${o.ago} seconds', $5, $6, $7::uuid[]) returning id`,
      [U(host++), o.batch, o.mode || 'clock', o.opp || null, o.target || 40, !!o.cancelled, o.noq ? null : qrows])) [0].id;
    for (const side of o.sides) for (const u of side.users) {
      await db.query(`insert into public.challenge_players (challenge_id, user_id, batch_id) values ($1, $2, $3) on conflict do nothing`, [id, U(u), side.batch]);
      const r = side.right(u); for (let sl = 0; sl < 12; sl++) await db.query(`insert into public.challenge_answers (challenge_id, user_id, slot, qid, choice, correct) values ($1, $2, $3, $4, 1, $5)`, [id, U(u), sl, qrows[sl], sl < r]);
    }
    return id;
  };
  const DAY = 86400;
  // 1. clock, school A batch 2020: 6 players x 3 = 18 right, target 15 -> 18 + 50 = 68
  await make({ batch: A20, ago: 3 * DAY, target: 15, sides: [{ batch: A20, users: range(1, 6), right: () => 3 }] });
  // 2. clock, only 4 players: does not count
  await make({ batch: A19, ago: 3 * DAY, target: 5, sides: [{ batch: A19, users: range(9, 4), right: () => 5 }] });
  // 3. rope valid: A19 (6 players x 4 = 24, avg 4) against B20 (5 players, 22 right, avg 4.4): B20 wins -> A19 24, B20 22 + 50 = 72
  await make({ batch: A19, opp: B20, mode: 'rope', ago: 2 * DAY, sides: [{ batch: A19, users: range(9, 6), right: () => 4 }, { batch: B20, users: range(17, 5), right: u => u === 17 ? 6 : 4 }] });
  // 4. rope draw: A20 (5 x 3) against B20 (5 x 3): 15 + 25 each
  await make({ batch: A20, opp: B20, mode: 'rope', ago: 1 * DAY, sides: [{ batch: A20, users: range(1, 5), right: () => 3 }, { batch: B20, users: range(17, 5), right: () => 3 }] });
  // 5. rope where the opponent had 4 players: no match; A20 gets 5 x 2 = 10 right and no bonus; B20 not counted
  await make({ batch: A20, opp: B20, mode: 'rope', ago: 1 * DAY, sides: [{ batch: A20, users: range(1, 5), right: () => 2 }, { batch: B20, users: range(17, 4), right: () => 9 }] });
  // 6. open rope nobody took: host A20, 5 x 1 = 5 right, no bonus
  await make({ batch: A20, mode: 'rope', ago: 1 * DAY, sides: [{ batch: A20, users: range(1, 5), right: () => 1 }] });
  // 7. cancelled, not started yet (live), without questions, and 10 days old (only "all")
  await make({ batch: A20, ago: 5 * DAY, cancelled: true, sides: [{ batch: A20, users: range(1, 6), right: () => 12 }] });
  await make({ batch: A20, ago: 60, sides: [{ batch: A20, users: range(1, 6), right: () => 12 }] });
  await make({ batch: A20, ago: 4 * DAY, noq: true, sides: [{ batch: A20, users: range(1, 6), right: () => 12 }] });
  await make({ batch: B20, ago: 10 * DAY, target: 10, sides: [{ batch: B20, users: range(17, 5), right: () => 2 }] });      // 10 right + 50 = 60, only in "all"
  // 8. a hidden institution (school-c): points exist, but it is left out of every board
  await make({ batch: C20, ago: 1 * DAY, target: 5, sides: [{ batch: C20, users: range(25, 5), right: () => 4 }] });

  const rows = await q('select * from public.league_rows($1)', ['2000-01-01']);
  const of = (b) => rows.filter(r => r.batch_id === b).map(r => r.pts).sort((x, y) => x - y);
  ok('points per finished challenge: clock 18 right + 50 for the target (68); fewer than 5 players, cancelled, still running and without questions are not counted', JSON.stringify(of(A19)) === JSON.stringify([24]) && of(A20).includes(68) && rows.filter(r => r.batch_id === A20).length === 4, JSON.stringify(rows.filter(r => r.batch_id === A20).map(r => r.pts)));
  ok('rope: the winner of the match gets right answers + 50, the loser only right answers (A19 24, B20 72); the bigger batch by head count does not win', rows.some(r => r.batch_id === B20 && r.pts === 72 && r.won === true) && rows.some(r => r.batch_id === A19 && r.pts === 24 && r.won === false));
  ok('rope draw: 15 + 25 for both (a draw is not a win); a rope match whose opponent had 4 players gives the host its right answers only and the 4-player side nothing; an open challenge nobody took counts as a clock game without the bonus', rows.filter(r => r.drew).length === 2 && rows.filter(r => r.drew).every(r => r.pts === 40 && !r.won) && of(A20).includes(10) && of(A20).includes(5) && !rows.some(r => r.batch_id === B20 && r.pts === 36));
  const wk = await q(`select public.league_board('batch', 'week', 20) as r`), wkr = wk[0].r;
  ok('the weekly batch board is ordered by points (A20 68+40+10+5 = 123 first, then B20 72+40 = 112, then A19 24), with matches and wins; the all-time one also counts the old challenge', wkr.map(x => x.year + x.slug).join() === '2020school-a,2020school-b,2019school-a' && wkr[0].points === 123 && wkr[0].matches === 4 && wkr[1].points === 112 && wkr[1].wins === 1 && wkr[2].points === 24 && wkr[0].rank === 1 && wkr[2].rank === 3, JSON.stringify(wkr));
  const all = (await q(`select public.league_board('batch', 'all', 20) as r`))[0].r;
  ok('all time: B20 gets 112 + 60 = 172 and goes first', all[0].slug === 'school-b' && all[0].points === 172 && all.length === 3);
  const inst = (await q(`select public.league_board('institution', 'week', 20) as r`))[0].r;
  ok('the institution board adds its batches: school A = 123 + 24 = 147 (2 batches) goes before school B = 112', inst.length === 2 && inst[0].slug === 'school-a' && inst[0].points === 147 && inst[0].batches === 2 && inst[1].slug === 'school-b' && inst[1].points === 112 && inst[0].name === 'এ স্কুল');
  ok('a hidden institution is in no board, and no board carries a person (no user id, no member name)', !JSON.stringify([wkr, all, inst]).includes('school-c') && !/user|নাম[0-9]|created_by/.test(JSON.stringify([wkr, all, inst])));
  ok('the limit works and a bad scope or period gives the institution/week board instead of an error', (await q(`select public.league_board('batch', 'week', 1) as r`))[0].r.length === 1 && Array.isArray((await q(`select public.league_board('x', 'y', 5) as r`))[0].r));
  ok('an empty league is an empty list, not an error', await (async () => { await db.exec('begin'); await db.exec('delete from public.challenge_answers; delete from public.challenge_players; delete from public.batch_challenges'); const e = (await q(`select public.league_board('batch', 'week', 20) as r`))[0].r; await db.exec('rollback'); return Array.isArray(e) && e.length === 0; })());

  // the batch summary
  const bs = (await q('select public.league_batch($1) as r', [A20]))[0].r;
  ok('the batch summary: week points 123, 4 matches, rank 1 of 3 batches, all-time numbers, member count; an unknown batch gives nothing', bs.week_points === 123 && bs.week_matches === 4 && bs.week_rank === 1 && bs.week_total === 3 && bs.all_points >= 123 && bs.members === 8 && (await q(`select public.league_batch('00000000-0000-0000-0000-0000000000aa') as r`))[0].r === null);
  const b2 = (await q('select public.league_batch($1) as r', [B20]))[0].r;
  ok('rank counts only batches with MORE points (B20 is second of 3), and the hidden school is not counted in the total', b2.week_rank === 2 && b2.week_total === 3);
  // coming challenges for a batch (as host and as opponent)
  const mk2 = async (batch, opp, mins, o) => (await q(`insert into public.batch_challenges (created_by, batch_id, mode, opp_batch_id, start_at) values ($1, $2, $3, $4, now() + interval '${mins} minutes') returning id`, [U(host++), batch, o || 'rope', opp]))[0].id;
  const up1 = await mk2(A20, null, 60), up2 = await mk2(B20, A20, 180), up3 = await mk2(A19, B20, 240), up4 = await mk2(A20, B20, 60 * 24 * 9);
  const bc = (await q('select public.league_batch($1) as r', [A20]))[0].r.challenges;
  ok('a batch sees its coming challenges as host (open: no other side yet) and as opponent (the host is "other"), soonest first, not the ones of other batches, not those more than 7 days away; no person in them', bc.length === 3 && bc[0].status === 'live' && bc[1].id === up1 && bc[1].hosting === true && bc[1].open === true && bc[1].other === null && bc[2].id === up2 && bc[2].hosting === false && bc[2].other.name === 'বি স্কুল' && !/user|created_by|qids/.test(JSON.stringify(bc)));
  ok('the status is the one of the live game: the one that started a minute ago is live, the others scheduled', bc.map(x => x.status).join() === 'live,scheduled,scheduled');

  ok('the board and the batch summary can be read by anybody; the points helper is closed to everybody', Array.isArray(await guard('anon', `select public.league_board('batch', 'week', 5)`)) && Array.isArray(await guard('anon', `select public.league_batch('${A20}')`)) && Array.isArray(await guard('authenticated', `select public.league_board('institution', 'all', 5)`)) && (await guard('anon', `select * from public.league_rows('2000-01-01')`)) === 'denied' && (await guard('authenticated', `select * from public.league_rows('2000-01-01')`)) === 'denied');
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });
