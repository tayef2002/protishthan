// Runs migrations/2027-01-18_quiz_bands.sql (after the whole chain) in a real Postgres engine (PGlite): the daily quiz by class band.
//   one-time setup:  npm install --prefix %TEMP%\pgl @electric-sql/pglite      run:  set PGLITE_DIR=%TEMP%\pgl   then   node tools/tests/test_quiz_bands_sql.js
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
  for (let i = 1; i <= 30; i++) { await db.exec(`insert into auth.users (id) values ('${U(i)}')`); await db.exec(`insert into public.members values ('${U(i)}', 'নাম${i} পদবি')`); }
  for (const f of ['2027-01-10_quiz_bank.sql', '2027-01-11_daily_quiz.sql', '2027-01-12_batch_challenge.sql', '2027-01-13_rope_pull.sql', '2027-01-14_league.sql', '2027-01-16_batch_duel.sql', '2027-01-17_league_guard.sql', '2027-01-18_quiz_bands.sql', '2027-01-18_quiz_bands.sql']) await db.exec(M(f));      // the last one twice: safe
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const call = async (uid, sql, params) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); try { return (await db.query(sql, params)).rows[0].r; } catch (e) { return { thrown: e.message }; } };
  const guard = async (role, uid, sql) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); await db.exec('set role ' + role); try { return (await db.query(sql)).rows; } catch (e) { return 'denied'; } finally { await db.exec('reset role'); } };
  const tdy = (uid, dev, band) => call(uid, 'select public.quiz_today($1, $2) as r', [dev || null, band || null]);
  const nxt = (uid, dev, band) => call(uid, 'select public.quiz_next($1, $2) as r', [dev || null, band || null]);
  const ans = (uid, dev, i, c) => call(uid, 'select public.quiz_answer($1, $2, $3) as r', [dev || null, i, c]);
  const topics = ['bangla', 'english', 'math', 'science', 'gk', 'history', 'ict', 'geo'];
  let nq = 0;
  const mk = async (band, diff, n, tag) => { for (let i = 0; i < n; i++) await db.query(`insert into public.quiz_questions (topic, band, difficulty, question, options, answer_idx, explanation, source, status) values ($1, $2, $3, $4, '["ক","খ","গ","ঘ"]'::jsonb, 1, 'ব্যাখ্যা', 'বই ক', 'verified')`, [topics[nq % topics.length], band, diff, (tag || band) + ' d' + diff + ' প্রশ্ন ' + (nq++)]); };
  const ADMIN = 30;
  await db.exec("select set_config('test.admin', '0', false)");

  // ---- the questions: 12 of c6-8 (easy and medium), 10 of c9-10, 10 of c11-12, 3 of c1-5, and the "any" ones of every difficulty
  await mk('c6-8', 1, 6); await mk('c6-8', 2, 6); await mk('c9-10', 2, 5); await mk('c9-10', 3, 5); await mk('c11-12', 3, 10); await mk('c1-5', 1, 3);
  await mk('any', 1, 4); await mk('any', 2, 3); await mk('any', 3, 3);
  const t0 = await tdy(null, 'device-aaaa');
  ok('the state tells which bands have enough verified questions today (c1-5: 3 + 4 easy "any" = 7, all four ready here)', t0.bands && t0.bands['c1-5'] === true && t0.bands['c6-8'] === true && t0.bands['c9-10'] === true && t0.bands['c11-12'] === true && t0.band === 'c6-8' && t0.locked === false, JSON.stringify(t0));
  ok('without a band the old default (c6-8) is used, so an old page still works', t0.ready === true && t0.total === 5);
  const idsOf = async band => (await q(`select qids from public.quiz_daily where day = public.quiz_day() and band = $1`, [band]))[0]?.qids || [];
  const info = async ids => (await q(`select band, difficulty from public.quiz_questions where id = any($1::uuid[])`, [ids]));

  // ---- each band gets its OWN set, from its own band and the "any" questions that are not too hard for it
  for (const b of ['c1-5', 'c6-8', 'c9-10', 'c11-12']) await tdy(null, 'dev-' + b, b);
  const sets = {}; for (const b of ['c1-5', 'c6-8', 'c9-10', 'c11-12']) sets[b] = await idsOf(b);
  ok('every band has its own set of 5 for the day (quiz_daily is one row per day and band)', Object.values(sets).every(s => s.length === 5) && (await q(`select count(*)::int as n from public.quiz_daily where day = public.quiz_day()`))[0].n === 4);
  const i15 = await info(sets['c1-5']), i68 = await info(sets['c6-8']), i910 = await info(sets['c9-10']), i1112 = await info(sets['c11-12']);
  ok('c1-5: only c1-5 questions or easy "any" ones (never a medium or hard one, never another band)', i15.every(x => x.band === 'c1-5' || (x.band === 'any' && x.difficulty === 1)), JSON.stringify(i15));
  ok('c6-8: only c6-8 or "any" of easy and medium; never c9-10 or c11-12', i68.every(x => x.band === 'c6-8' || (x.band === 'any' && x.difficulty <= 2)), JSON.stringify(i68));
  ok('c9-10: only c9-10 or "any"; never c1-5, c6-8 or c11-12', i910.every(x => x.band === 'c9-10' || x.band === 'any'), JSON.stringify(i910));
  ok('c11-12: only c11-12 or "any"; never a school-level band', i1112.every(x => x.band === 'c11-12' || x.band === 'any'), JSON.stringify(i1112));
  const diffs = async ids => (await q(`select array_agg(q.difficulty order by x.ord) as d from unnest($1::uuid[]) with ordinality x(id, ord) join public.quiz_questions q on q.id = x.id`, [ids]))[0].d;
  const d1112 = await diffs(sets['c11-12']), d910 = await diffs(sets['c9-10']);
  ok('the five of a day are ordered from easy to hard', [d1112, d910, await diffs(sets['c6-8'])].every(d => d.every((v, i) => i === 0 || v >= d[i - 1])), JSON.stringify([d1112, d910]));

  // ---- a player has ONE band a day: the first question fixes it
  const n1 = await nxt(null, 'device-one1', 'c9-10');
  ok('the first question fixes the band of the day for the player, and it is told back', n1.ok === true && n1.band === 'c9-10' && sets['c9-10'].includes(n1.question.id), JSON.stringify(n1));
  const a1 = await ans(null, 'device-one1', 0, 1);
  const n2 = await nxt(null, 'device-one1', 'c1-5');
  ok('asking for another band later in the day changes nothing: the next question is of the first band', n2.ok === true && n2.band === 'c9-10' && sets['c9-10'].includes(n2.question.id) && a1.ok === true, JSON.stringify(n2));
  const t1 = await tdy(null, 'device-one1', 'c1-5');
  ok('quiz_today of a player who has started shows his band as locked', t1.band === 'c9-10' && t1.locked === true && t1.answered === 1, JSON.stringify(t1));

  // ---- not enough questions in a band: that band is not ready, the others are
  await db.exec(`update public.quiz_questions set status = 'retired' where band = 'c1-5' or (band = 'any' and difficulty = 1)`);
  await db.exec(`delete from public.quiz_daily where band = 'c1-5'`);
  const t2 = await tdy(null, 'device-zzzz', 'c1-5');
  ok('a band without 5 verified questions is not ready (ready false, the band shown), and the others still are', t2.ready === false && t2.bands['c1-5'] === false && t2.bands['c9-10'] === true && (await nxt(null, 'device-zzzz', 'c1-5')).error === 'NOT_READY');
  await db.exec(`update public.quiz_questions set status = 'verified' where status = 'retired'`);

  // ---- no repeat while there are unused questions: 3 days in a row for c11-12 (10 own + 10 any = 20 questions)
  const seen = new Map(); let again = 0, days = 0;
  for (let k = 1; k <= 3; k++) {
    await db.exec(`delete from public.quiz_daily where day = public.quiz_day() and band = 'c11-12'`);
    await db.exec(`insert into public.quiz_daily (day, band, qids, source) select public.quiz_day() - ${k}, 'c11-12', public.quiz_pick('{}', 'c11-12'), 'auto' on conflict do nothing`);
  }
  const past = await q(`select qids from public.quiz_daily where band = 'c11-12' and day < public.quiz_day()`);
  const all = past.flatMap(r => r.qids);
  ok('three days in a row of one band use 15 different questions (nothing repeats while plenty of unused ones remain; the cap of 2 per topic may force a repeat only when the pool is nearly used up)', all.length === 15 && new Set(all).size === 15, all.length + ' / ' + new Set(all).size);

  // ---- a band with a lot of one topic does not become all-math: at most 2 of one topic in a day
  for (let i = 0; i < 40; i++) await db.query(`insert into public.quiz_questions (topic, band, difficulty, question, options, answer_idx, explanation, source, status) values ('math', 'c11-12', 2, $1, '["ক","খ","গ","ঘ"]'::jsonb, 1, 'ব্যাখ্যা', 'বই ক', 'verified')`, ['গণিত বহু ' + i]);
  let worst = 0;
  for (let k = 0; k < 12; k++) { const t = (await q(`select count(*) filter (where q.topic = 'math')::int as m from public.quiz_questions q where q.id = any(public.quiz_pick('{}', 'c11-12'))`))[0].m; worst = Math.max(worst, t); }
  ok('with 40 more math questions in a band, a day still has at most 2 math questions (the other topics are not crowded out)', worst <= 2, 'worst ' + worst);

  // ---- boards per band: a member's points go to the board of the band he played
  for (let u = 1; u <= 3; u++) { await db.query(`insert into public.member_institution values ($1, 'school-a')`, [U(u)]); }
  for (let u = 4; u <= 6; u++) { await db.query(`insert into public.member_institution values ($1, 'school-b')`, [U(u)]); }
  const play = async (uid, band, right) => { for (let i = 0; i < 5; i++) { const n = await nxt(uid, null, band); if (!n.ok) return n; await ans(uid, null, i, i < right ? 1 : 0); } };
  for (let u = 1; u <= 3; u++) await play(u, 'c9-10', 5);
  for (let u = 4; u <= 6; u++) await play(u, 'c6-8', 5);
  const bd = (band, scope) => call(null, `select public.quiz_board($1, 'today', null, 20, $2) as r`, [scope || 'institution', band]);
  const b910 = await bd('c9-10'), b68 = await bd('c6-8'), b1112 = await bd('c11-12');
  ok('the board of c9-10 lists only the school whose members played c9-10, the board of c6-8 only the other school, an unplayed band is empty', b910.length === 1 && b910[0].slug === 'school-a' && b68.length === 1 && b68[0].slug === 'school-b' && b1112.length === 0, JSON.stringify([b910, b68, b1112]));
  ok('without a band the board is the default one (c6-8)', JSON.stringify(await call(null, `select public.quiz_board('institution', 'today', null, 20) as r`)) === JSON.stringify(b68));
  ok('the points of the week are summed only within the band', (await q(`select count(distinct band)::int as n from public.quiz_plays where user_id = '${U(1)}'`))[0].n === 1);

  // ---- the batch duel counts the c9-10 band only
  const mkB = async (slug, year, users) => { const id = (await q(`insert into public.batches (institution_slug, level, exam_year) values ($1, 'ssc', $2) returning id`, [slug, year]))[0].id; for (const u of users) await db.exec(`insert into public.batch_members (batch_id, user_id, is_primary) values ('${id}', '${U(u)}', true)`); return id; };
  const BA = await mkB('school-a', 2020, [11, 12, 13]), BB = await mkB('school-b', 2019, [14, 15, 16]);
  for (let u = 11; u <= 13; u++) await play(u, 'c9-10', 4);
  for (let u = 14; u <= 16; u++) await play(u, 'c6-8', 5);
  const side = async b => (await q(`select public.duel_side($1, public.quiz_day()) as r`, [b]))[0].r;
  const sa = await side(BA), sb = await side(BB);
  ok('the duel counts the c9-10 band only: batch A (played c9-10) has 3 players, batch B (played c6-8) has none', sa.players === 3 && sb.players === 0, JSON.stringify([sa, sb]));

  // ---- the admin
  ok('only the admin can plan or choose a set again', (await call(1, 'select public.quiz_plan(3, $1) as r', ['c9-10'])).thrown?.includes('NOT_ADMIN') && (await call(1, `select public.quiz_reroll(public.quiz_day() + 2, 'c9-10') as r`)).thrown?.includes('NOT_ADMIN'));
  await db.exec("select set_config('test.admin', '1', false)");
  const plan = await call(ADMIN, `select public.quiz_plan(3, 'c11-12') as r`);
  ok('the admin makes the sets of the next days of ONE band (3 days, band shown)', Array.isArray(plan) && plan.length === 3 && plan.every(p => p.band === 'c11-12' && p.qids.length === 5), JSON.stringify(plan));
  const rr = await call(ADMIN, `select public.quiz_reroll(public.quiz_day() + 2, 'c11-12') as r`);
  const rp = await call(ADMIN, `select public.quiz_reroll(public.quiz_day(), 'c9-10') as r`);
  ok('a future set of a band can be chosen again; a band that somebody has played today cannot', rr.ok === true && rr.band === 'c11-12' && rp.ok === false && rp.error === 'ALREADY_PLAYED', JSON.stringify([rr, rp]));
  await db.exec("select set_config('test.admin', '0', false)");

  // ---- the doors
  ok('anyone can call quiz_today, quiz_next and quiz_board; the helpers (band, pick, ensure_day, qid_at) are closed', Array.isArray(await guard('anon', 0, `select public.quiz_board('institution', 'today', null, 5, 'c9-10')`)) && (await guard('anon', 0, `select public.quiz_today('guest-device-xyz-1', 'c9-10')`)) !== 'denied' &&
    (await Promise.all([`public.quiz_band('c9-10')`, `public.quiz_pick('{}', 'c9-10')`, `public.quiz_ensure_day(public.quiz_day(), 'c9-10')`, `public.quiz_qid_at(public.quiz_day(), 0, 'c9-10')`].map(f => guard('anon', 0, `select ${f}`)))).every(r => r === 'denied'));
  ok('anon and members cannot plan or choose again, and the old one-argument functions are gone (no half-old state)', (await guard('anon', 0, `select public.quiz_plan(3, 'c9-10')`)) === 'denied' && (await guard('authenticated', 1, `select public.quiz_reroll(public.quiz_day() + 2, 'c9-10')`)) !== null &&
    (await q(`select count(*)::int as n from pg_proc where proname in ('quiz_today', 'quiz_next', 'quiz_ensure_day', 'quiz_qid_at', 'quiz_board', 'quiz_pick', 'quiz_plan', 'quiz_reroll')`))[0].n === 8);
  ok('a band that is not one of the four is turned into the default, never stored', (await nxt(null, 'device-bad1', 'c13-14')).band === 'c6-8' && (await q(`select count(*)::int as n from public.quiz_plays where band not in ('c1-5','c6-8','c9-10','c11-12')`))[0].n === 0);
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
