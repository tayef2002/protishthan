// Runs migrations/2027-01-16_batch_duel.sql (after the quiz, the live game, the rope and the league) in a real Postgres engine (PGlite): ব্যাচ ডুয়েল, the daily quiz of two batches.
//   one-time setup:  npm install --prefix %TEMP%\pgl @electric-sql/pglite      run:  set PGLITE_DIR=%TEMP%\pgl   then   node tools/tests/test_duel_sql.js
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
    insert into public.listing_submissions values ('school-a', 'এ স্কুল', 'approved', 'ঢাকা', false), ('school-b', 'বি স্কুল', 'approved', 'কুমিল্লা', false), ('school-c', 'সি স্কুল', 'approved', 'সিলেট', false), ('school-d', 'ডি স্কুল', 'approved', 'বরিশাল', false), ('school-e', 'ই স্কুল', 'approved', 'রংপুর', false);
    create table public.members (user_id uuid primary key, display_name text);
    create table public.member_institution (user_id uuid primary key, institution_slug text not null);
    create table public.batches (id uuid primary key default gen_random_uuid(), institution_slug text, level text, exam_year int);
    create table public.batch_members (batch_id uuid, user_id uuid, is_primary boolean default false, joined_at timestamptz default now());
    create function public.batch_first_name(n text) returns text language sql immutable as $$ select nullif(split_part(btrim(coalesce(n, '')), ' ', 1), '') $$;
  `);
  const U = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
  for (let i = 1; i <= 60; i++) { await db.exec(`insert into auth.users (id) values ('${U(i)}')`); await db.exec(`insert into public.members values ('${U(i)}', 'নাম${i} পদবি')`); }
  for (const f of ['2027-01-10_quiz_bank.sql', '2027-01-11_daily_quiz.sql', '2027-01-12_batch_challenge.sql', '2027-01-13_rope_pull.sql', '2027-01-14_league.sql', '2027-01-16_batch_duel.sql', '2027-01-16_batch_duel.sql', '2027-01-17_league_guard.sql', '2027-01-18_quiz_bands.sql', '2027-01-18_quiz_bands.sql']) await db.exec(M(f));     // twice at the end: safe
  await db.exec("select set_config('test.admin', '0', false)");
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const as = async (uid, fn) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); return fn(); };
  const call = (uid, sql, params) => as(uid, async () => { try { return (await db.query(sql, params)).rows[0].r; } catch (e) { return { thrown: e.message }; } });
  const guard = async (role, uid, sql) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); await db.exec('set role ' + role); try { return (await db.query(sql)).rows; } catch (e) { return 'denied'; } finally { await db.exec('reset role'); } };
  const day = async n => (await q(`select (public.quiz_day() + ($1::int))::text as d`, [n]))[0].d;
  const mkBatch = async (slug, year, users) => { const id = (await q(`insert into public.batches (institution_slug, level, exam_year) values ($1, 'ssc', $2) returning id`, [slug, year]))[0].id; for (const u of users) await db.exec(`insert into public.batch_members (batch_id, user_id) values ('${id}', '${U(u)}')`); return id; };
  const range = (a, n) => Array.from({ length: n }, (_, i) => a + i);
  const A = await mkBatch('school-a', 2020, range(1, 8)), B = await mkBatch('school-b', 2019, range(9, 8)), Cc = await mkBatch('school-c', 2018, range(17, 8)), Dd = await mkBatch('school-d', 2021, range(25, 8)), Ee = await mkBatch('school-e', 2022, range(33, 8)), Small = await mkBatch('school-a', 2015, [41, 42, 43]);
  const create = (uid, batch, dayN, opp) => day(dayN).then(d => call(uid, 'select public.duel_create($1, $2::date, $3) as r', [batch, d, opp || null]));
  const accept = (uid, id, batch) => call(uid, 'select public.duel_accept($1, $2) as r', [id, batch]);
  const state = id => call(null, 'select public.duel_state($1) as r', [id]);
  // quiz points of one member on one day, as the daily quiz stores them (5 rows of up to 15 points, the batch of the first question)
  const play = async (d, user, batch, total, o) => { o = o || {}; for (let idx = 0; idx < 5; idx++) { const p = Math.max(0, Math.min(15, total - idx * 15)); await db.query(`insert into public.quiz_plays (day, player, user_id, batch_id, idx, qid, answered_at, points, correct, band) values ($1::date, $2, $3, $4, $5, gen_random_uuid(), $6, $7, $8, 'c9-10')`, [d, o.device ? 'd:xxxxxxxx' + user : 'u:' + U(user), o.device ? null : U(user), (o.batchAt && o.batchAt[idx]) || batch, idx, o.unanswered ? null : new Date(), p, p > 0]); if (total - idx * 15 <= 0) break; } };

  // ---- calling a duel
  ok('signed out and a non-member cannot call one; a day that is today, in the past or more than 7 days ahead is refused (tomorrow to +7 only); a batch of fewer than 5 cannot', (await create(null, A, 2)).error === 'NOT_SIGNED_IN' && (await create(9, A, 2)).error === 'NOT_MEMBER' && (await create(1, A, 0)).error === 'BAD_DAY' && (await create(1, A, -1)).error === 'BAD_DAY' && (await create(1, A, 8)).error === 'BAD_DAY' && (await create(41, Small, 2)).error === 'BATCH_TOO_SMALL');
  const open1 = await create(1, A, 2);
  ok('an OPEN duel is made for day +2; the maker\'s batch is side A; it is open, nobody is on side B, nothing is valid yet', open1.ok === true && await (async () => { const s = await state(open1.id); return s.status === 'open' && s.open === true && s.b === null && s.a.name === 'এ স্কুল' && s.a.year === 2020 && s.players_a === 0 && s.valid === false && s.winner === null; })());
  ok('one duel per member in 24 hours; one duel per batch per day (BUSY) also for a different member', (await create(1, A, 3)).error === 'LIMIT_USER' && (await create(2, A, 2)).error === 'BUSY');
  const named1 = await create(9, B, 3, Cc);
  ok('a NAMED duel (B calls C for day +3) is made; the opponent is set at once', named1.ok === true && (await state(named1.id)).status === 'upcoming' && (await state(named1.id)).b.name === 'সি স্কুল');
  ok('a named opponent must exist, differ from the caller, have 5 members, and be free that day (OPP_BUSY: C is busy on +3)', (await create(25, Dd, 3, Dd)).error === 'SAME_BATCH' && (await create(25, Dd, 3, '00000000-0000-0000-0000-0000000000aa')).error === 'OPP_NOT_FOUND' && (await create(25, Dd, 3, Small)).error === 'OPP_TOO_SMALL' && (await create(25, Dd, 3, Cc)).error === 'OPP_BUSY');
  ok('a batch can wait for at most 3 duels: C has one (+3); two more on other days are fine, a fourth is refused (BUSY)', await (async () => { const d1 = await create(18, Cc, 4); const d2 = await create(19, Cc, 5); const d3 = await create(20, Cc, 6); return d1.ok && d2.ok && d3.error === 'BUSY'; })());

  // ---- accepting
  ok('only a signed-in member of a batch of 5 can accept an open duel, not the maker\'s batch, not a named one, not a missing one', (await accept(null, open1.id, B)).error === 'NOT_SIGNED_IN' && (await accept(9, open1.id, Dd)).error === 'NOT_MEMBER' && (await accept(41, open1.id, Small)).error === 'BATCH_TOO_SMALL' && (await accept(2, open1.id, A)).error === 'SAME_BATCH' && (await accept(26, named1.id, Dd)).error === 'ALREADY_TAKEN' && (await accept(26, '00000000-0000-0000-0000-0000000000bb', Dd)).error === 'NOT_FOUND');
  ok('a batch that already has a duel that day cannot accept another one then (B plays on +3)', await (async () => { const o = await create(34, Ee, 3); return (await accept(10, o.id, B)).error === 'BUSY'; })());
  const acc = await accept(26, open1.id, Dd);
  ok('D accepts the open duel: the opponent is set, the duel is upcoming, and a second batch is told ALREADY_TAKEN', acc.ok === true && (await state(open1.id)).status === 'upcoming' && (await state(open1.id)).b.name === 'ডি স্কুল' && (await accept(34, open1.id, Ee)).error === 'ALREADY_TAKEN');
  ok('a duel whose day has come cannot be accepted any more (TOO_LATE)', await (async () => { const id = (await q(`insert into public.batch_duels (created_by, day, batch_a) values ($1, public.quiz_day(), $2) returning id`, [U(34), Ee]))[0].id; return (await accept(10, id, B)).error === 'TOO_LATE'; })());

  // ---- the numbers of a duel: the average of the best 10 players, players that answered, the batch of the first question
  const dd = await q(`insert into public.batch_duels (created_by, day, batch_a, batch_b) values ($1, public.quiz_day(), $2, $3) returning id, day::text as d`, [U(1), A, B]), live = dd[0];
  for (const u of range(1, 8)) await play(live.d, u, A, 40 + u);        // A: 8 players with 41..48
  for (const u of range(9, 3)) await play(live.d, u, B, 30);            // B: 3 players with 30
  await play(live.d, 12, B, 70, { unanswered: true });                  // a player who opened a question but did not answer: not counted
  await play(live.d, 13, B, 70, { device: true });                      // a device without an account: not counted
  await play(live.d, 14, B, 60, { batchAt: [A, B, B, B, B] });          // opened the first question as a member of A: counts for A (A has 9 players now), not for B
  const sl = await state(live.id);
  ok('a duel today is live; players = members who answered at least one question with the batch of their FIRST question; devices and unanswered questions are not counted', sl.status === 'live' && sl.players_a === 9 && sl.players_b === 3, JSON.stringify([sl.players_a, sl.players_b]));
  ok('a side\'s score is the AVERAGE of its best 10 players (A: 9 players, 41..48 and 60: the mean of all nine; B: 30), the lead is their difference, and no winner is named while it is live', sl.avg_a === 46.2 && sl.avg_b === 30 && sl.lead === 16.2 && sl.valid === true && sl.winner === null, JSON.stringify(sl));
  for (const u of range(15, 2)) await play(live.d, u, A, 20);           // A now has 11 players: only the best 10 count
  ok('with more than 10 players only the best 10 count (the weakest is left out)', (await state(live.id)).players_a === 11 && (await state(live.id)).avg_a === Math.round((41 + 42 + 43 + 44 + 45 + 46 + 47 + 48 + 60 + 20) / 10 * 10) / 10, JSON.stringify(await state(live.id)));
  // finished duels: a win, a draw, an invalid one
  const mkDone = async (back, a, b) => (await q(`insert into public.batch_duels (created_by, day, batch_a, batch_b) values ($1, public.quiz_day() - $2::int, $3, $4) returning id, day::text as d`, [U(1), back, a, b]))[0];
  const w = await mkDone(1, Cc, Dd); for (const u of range(17, 4)) await play(w.d, u, Cc, 50); for (const u of range(25, 3)) await play(w.d, u, Dd, 40);
  const dr = await mkDone(2, A, Ee); for (const u of range(1, 3)) await play(dr.d, u, A, 45); for (const u of range(33, 3)) await play(dr.d, u, Ee, 45);
  const iv = await mkDone(3, B, Ee); for (const u of range(9, 5)) await play(iv.d, u, B, 70); for (const u of range(33, 2)) await play(iv.d, u, Ee, 10);
  const sw = await state(w.id), sd = await state(dr.id), si = await state(iv.id);
  ok('a finished duel names the winner by the higher average (C 50 beats D 40); equal averages are a draw; a side with fewer than 3 players makes the duel invalid: no winner', sw.status === 'done' && sw.valid && sw.winner === 'a' && sd.winner === 'draw' && si.valid === false && si.winner === null && si.players_b === 2);
  ok('an open duel nobody took before its day is "expired" (not listed, no points), and a cancelled one is "cancelled"', await (async () => { const e = (await q(`insert into public.batch_duels (created_by, day, batch_a) values ($1, public.quiz_day(), $2) returning id`, [U(1), Ee]))[0].id; const c = (await q(`insert into public.batch_duels (created_by, day, batch_a, cancelled) values ($1, public.quiz_day() + 4, $2, true) returning id`, [U(1), Ee]))[0].id; return (await state(e)).status === 'expired' && (await state(c)).status === 'cancelled'; })());
  ok('counts only: nothing about a person in the public state', !/user|created_by|নাম[0-9]|player"/.test(JSON.stringify([sl, sw, sd, si])));

  // ---- cancel, my side, the lists
  ok('only the maker (or the admin) cancels a duel, only before its day; the maker is also told "creator"', await (async () => { const o = await create(35, Ee, 7); const c1 = await call(36, 'select public.duel_cancel($1) as r', [o.id]); const me = await call(35, 'select public.duel_me($1) as r', [o.id]); const c2 = await call(35, 'select public.duel_cancel($1) as r', [o.id]); const late = await call(1, 'select public.duel_cancel($1) as r', [live.id]); return c1.error === 'NOT_ALLOWED' && me.creator === true && c2.ok === true && (await state(o.id)).status === 'cancelled' && late.error === 'ALREADY_STARTED'; })());
  ok('the admin can cancel any duel before its day', await (async () => { const o = await create(33, Ee, 6); await db.exec("select set_config('test.admin', '1', false)"); const r = await call(50, 'select public.duel_cancel($1) as r', [o.id]); await db.exec("select set_config('test.admin', '0', false)"); return r.ok === true; })());
  const open2 = await create(41 + 0 === 0 ? 1 : 2, A, 4);   // member 2 of A, another day
  ok('"my side": a member of A sees side a, a member of D (accepted) side b, a stranger none; a member of a free batch with 5 gets the batches that could accept an open duel; nobody gets them after it was taken', await (async () => {
    const a = await call(3, 'select public.duel_me($1) as r', [open1.id]), b = await call(27, 'select public.duel_me($1) as r', [open1.id]), n = await call(40, 'select public.duel_me($1) as r', [open1.id]);
    const o = await call(34, 'select public.duel_me($1) as r', [open2.id]);
    return a.side === 'a' && a.member && b.side === 'b' && n.side === null && n.member === false && o.accept_batches.length === 1 && o.accept_batches[0].name === 'ই স্কুল' && b.accept_batches.length === 0;
  })());
  const lst = await call(null, 'select public.duel_list(60) as r');
  ok('the list: open, upcoming, today and the last 3 days; not cancelled, not expired; sorted by day; nothing about a person', Array.isArray(lst) && lst.some(x => x.id === open2.id && x.open === true) && lst.some(x => x.id === live.id && x.status === 'live') && lst.some(x => x.id === w.id && x.status === 'done') && !lst.some(x => ['cancelled', 'expired'].includes(x.status)) && lst.map(x => x.day).join() === lst.map(x => x.day).sort().join() && !/user|created_by/.test(JSON.stringify(lst)));
  ok('duel_mine (for the quiz page): the duels of MY batches that are today or tomorrow, with an opponent; empty when signed out or when my batches have none', await (async () => { const mine = await call(3, 'select public.duel_mine() as r'); const none = await call(40, 'select public.duel_mine() as r'); const out = await call(null, 'select public.duel_mine() as r'); return mine.length === 1 && mine[0].id === live.id && mine[0].status === 'live' && mine[0].hosting === true && none.length === 0 && out.length === 0; })());

  // ---- the league: duel points join the challenge points
  const rows = await q(`select * from public.duel_rows('2000-01-01') order by pts desc`);
  ok('league points of finished duels: the winner 50, a draw 25 each, the loser 0; an invalid duel and a duel of today give nothing', rows.length === 4 && rows.filter(r => r.pts === 50).length === 1 && rows.filter(r => r.pts === 25).length === 2 && rows.filter(r => r.pts === 0).length === 1 && rows.find(r => r.pts === 50).batch_id === Cc && rows.find(r => r.pts === 50).won === true && rows.filter(r => r.drew).length === 2);
  const lb = (await q(`select public.league_board('batch', 'all', 20) as r`))[0].r;
  ok('the league boards now count them: C 50, A 25, E 25 and D 0 (not listed: no points)', lb.length === 3 && lb[0].slug === 'school-c' && lb[0].points === 50 && lb.find(x => x.slug === 'school-a').points === 25 && lb.find(x => x.slug === 'school-e').points === 25 && !lb.some(x => x.slug === 'school-d'), JSON.stringify(lb.map(x => x.slug + x.points)));
  const lbi = (await q(`select public.league_board('institution', 'all', 20) as r`))[0].r, lbw = (await q(`select public.league_board('batch', 'week', 20) as r`))[0].r, bs = (await q('select public.league_batch($1) as r', [Cc]))[0].r;
  ok('the institution board, the weekly board and the batch summary read the same rows (batch C: 50 points, 1 match, 1 win)', lbi.length === 3 && lbw.length === 3 && bs.all_points === 50 && bs.all_matches === 1 && bs.all_wins === 1 && bs.week_points === 50);

  // ---- who can call what
  ok('anybody can read the state, "my side" and the list; only a signed-in member can call, accept, cancel or ask for "mine"; the helpers are closed to everybody; the table is closed', Array.isArray(await guard('anon', 0, `select public.duel_state('${live.id}')`)) && Array.isArray(await guard('anon', 0, `select public.duel_me('${live.id}')`)) && Array.isArray(await guard('anon', 0, 'select public.duel_list(5)')) &&
    (await Promise.all([`select public.duel_create('${A}', public.quiz_day() + 2, null)`, `select public.duel_accept('${open2.id}', '${B}')`, `select public.duel_cancel('${open2.id}')`, 'select public.duel_mine()'].map(s => guard('anon', 0, s)))).every(x => x === 'denied') &&
    (await Promise.all([`select public.duel_side('${A}', public.quiz_day())`, `select public.duel_busy('${A}', public.quiz_day())`, `select * from public.duel_rows('2000-01-01')`, `select * from public.league_rows_all('2000-01-01')`].map(s => guard('anon', 0, s)))).every(x => x === 'denied') &&
    (await Promise.all(['select * from public.batch_duels'].map(s => guard('authenticated', 3, s)))).every(x => x === 'denied' || (Array.isArray(x) && x.length === 0)));
  ok('the public league functions are still readable by anybody after being replaced', Array.isArray(await guard('anon', 0, `select public.league_board('batch', 'week', 5)`)) && Array.isArray(await guard('anon', 0, `select public.league_batch('${A}')`)));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });
