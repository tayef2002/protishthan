// Step 6 of the league: what does ONE call of the live game cost the database, and how does it grow with the number of players?
// It runs the real SQL (migrations 2027-01-10, -12, -13, -14) in PGlite (a real Postgres compiled to WebAssembly, ONE connection, no network),
// fills a challenge with N players, and times every call a phone makes: challenge_questions, challenge_answer (12 per player), challenge_state, challenge_result, challenge_me.
// PGlite is slower than a native Postgres (my guess: 2-4 times) and has no network or connection pool, so the numbers are a rough upper bound for the QUERY cost only.
// They say nothing about the pooler, PostgREST or the CPU share of the free server: those are measured by probe.mjs against the real API, gently.
//   one-time setup:  npm install --prefix %TEMP%\pgl @electric-sql/pglite        run:  set PGLITE_DIR=%TEMP%\pgl   then   node tools/loadtest/cost.js [players=100] [rope]
const fs = require('fs'), path = require('path');
const { PGlite } = require(path.join(process.env.PGLITE_DIR || '', 'node_modules', '@electric-sql/pglite'));
const M = f => fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', f), 'utf8');
const N = Number(process.argv[2]) || 100, ROPE = process.argv.includes('rope');
const stat = a => { const s = a.slice().sort((x, y) => x - y), sum = a.reduce((p, c) => p + c, 0); return { n: a.length, mean: sum / a.length, p50: s[Math.floor(s.length * .5)], p95: s[Math.floor(s.length * .95)], max: s[s.length - 1], total: sum }; };
const f1 = x => (Math.round(x * 10) / 10).toFixed(1);
(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_admin() returns boolean language sql stable as $$ select false $$;
    create table public.listing_submissions (desired_slug text, institution_name text, status text, district text, is_hidden boolean default false);
    insert into public.listing_submissions (desired_slug, institution_name, status, district) values ('school-a', 'এ স্কুল', 'approved', 'ঢাকা'), ('school-b', 'বি স্কুল', 'approved', 'কুমিল্লা');
    create table public.members (user_id uuid primary key, display_name text);
    create table public.batches (id uuid primary key default gen_random_uuid(), institution_slug text, level text, exam_year int);
    create table public.batch_members (batch_id uuid, user_id uuid, joined_at timestamptz default now());
    create function public.batch_first_name(n text) returns text language sql immutable as $$ select nullif(split_part(btrim(coalesce(n, '')), ' ', 1), '') $$;
  `);
  for (const f of ['2027-01-10_quiz_bank.sql', '2027-01-12_batch_challenge.sql', '2027-01-13_rope_pull.sql', '2027-01-14_league.sql']) await db.exec(M(f));
  const U = n => '00000000-0000-0000-' + String(Math.floor(n / 1e6)).padStart(4, '0') + '-' + String(n % 1e6).padStart(12, '0');
  const total = ROPE ? N * 2 : N;
  await db.exec(`insert into auth.users select ('00000000-0000-0000-' || lpad((g / 1000000)::text, 4, '0') || '-' || lpad((g % 1000000)::text, 12, '0'))::uuid from generate_series(1, ${total}) g`);
  await db.exec(`insert into public.members select id, 'নাম ' || id from auth.users`);
  const bA = (await db.query(`insert into public.batches (institution_slug, level, exam_year) values ('school-a', 'ssc', 2020) returning id`)).rows[0].id;
  const bB = (await db.query(`insert into public.batches (institution_slug, level, exam_year) values ('school-b', 'ssc', 2019) returning id`)).rows[0].id;
  await db.exec(`insert into public.batch_members (batch_id, user_id) select '${bA}', id from auth.users order by id limit ${N}`);
  if (ROPE) await db.exec(`insert into public.batch_members (batch_id, user_id) select '${bB}', id from auth.users order by id offset ${N} limit ${N}`);
  // a bank of 300 verified questions (about what the owner will have after the first weeks) and the history of 40 old challenges, so that the tables are not empty
  await db.exec(`insert into public.quiz_questions (topic, question, options, answer_idx, explanation, source, status) select (array['bangla','english','math','science','gk','history','ict','geo','sports','school','puzzle'])[1 + g % 11], 'প্রশ্ন ' || g || ' কী?', '["ক","খ","গ","ঘ"]'::jsonb, 1, 'ব্যাখ্যা', 'বই ক', 'verified' from generate_series(1, 300) g`);
  const first = (await db.query('select id from auth.users order by id limit 1')).rows[0].id;
  await db.exec(`insert into public.batch_challenges (created_by, batch_id, start_at, target, qids) select '${first}', '${bA}', now() - (g || ' days')::interval, 40, (select array_agg(id) from (select id from public.quiz_questions limit 12) q) from generate_series(2, 41) g`);
  await db.exec(`insert into public.challenge_players select id, u.id, '${bA}', now() from public.batch_challenges c cross join lateral (select id from auth.users order by id limit 30) u where c.start_at < now() - interval '1 day'`).catch(() => {});

  const as = uid => db.exec(`select set_config('test.uid', '${uid}', false)`);
  const timed = async (uid, sql, params) => { if (uid !== undefined) await as(uid); const t = process.hrtime.bigint(); const r = await db.query(sql, params); return [Number(process.hrtime.bigint() - t) / 1e6, r.rows[0] && r.rows[0].r]; };
  await db.exec(`select set_config('test.admin', '0', false)`);
  const id = (await db.query(`insert into public.batch_challenges (created_by, batch_id, mode, opp_batch_id, start_at, target) values ('${first}', '${bA}', '${ROPE ? 'rope' : 'clock'}', ${ROPE ? `'${bB}'` : 'null'}, now() + interval '3 seconds', 60) returning id`)).rows[0].id;
  const users = (await db.query(`select id from auth.users order by id limit ${total}`)).rows.map(r => r.id);

  const R = {};
  // 1) everybody asks for the questions (the first one chooses them)
  R.questions = []; for (const u of users) R.questions.push((await timed(u, 'select public.challenge_questions($1) as r', [id]))[0]);
  // 2) the answers: slot by slot the window is moved so that the slot is open, then every player answers (some wrong, some late-joined)
  R.answer = []; R.state_live = []; R.me = [];
  for (let slot = 0; slot < 12; slot++) {
    await db.query(`update public.batch_challenges set start_at = now() - interval '${slot * 14 + 2} seconds' where id = $1`, [id]);
    for (let k = 0; k < users.length; k++) { const [ms] = await timed(users[k], 'select public.challenge_answer($1, $2, $3) as r', [id, slot, (k + slot) % 4]); R.answer.push(ms); }
    for (let k = 0; k < 5; k++) R.state_live.push((await timed(null, 'select public.challenge_state($1) as r', [id]))[0]);
    for (let k = 0; k < 5; k++) R.me.push((await timed(users[k], 'select public.challenge_me($1) as r', [id]))[0]);
  }
  // 3) over: every player asks for the result (the heaviest read)
  await db.query(`update public.batch_challenges set start_at = now() - interval '400 seconds' where id = $1`, [id]);
  R.result = []; for (const u of users) R.result.push((await timed(u, 'select public.challenge_result($1) as r', [id]))[0]);
  R.state_done = []; for (let k = 0; k < 20; k++) R.state_done.push((await timed(null, 'select public.challenge_state($1) as r', [id]))[0]);
  R.list = []; for (let k = 0; k < 10; k++) R.list.push((await timed(null, 'select public.challenge_list(30) as r'))[0]);
  R.board = []; for (let k = 0; k < 10; k++) R.board.push((await timed(null, `select public.league_board('institution', 'week', 20) as r`))[0]);
  const rows = (await db.query('select (select count(*) from public.challenge_answers) as a, (select count(*) from public.challenge_players) as p')).rows[0];

  console.log('players: ' + N + (ROPE ? ' per side (rope, ' + total + ' in all)' : ' (clock)') + '   answers stored: ' + rows.a + '   (PGlite, one connection, no network)\n');
  console.log('call                     calls    mean ms    p95 ms    max ms    calls/s (one connection)');
  const line = (name, a) => { const s = stat(a); console.log(name.padEnd(24) + String(s.n).padEnd(9) + f1(s.mean).padEnd(11) + f1(s.p95).padEnd(10) + f1(s.max).padEnd(10) + Math.round(1000 / s.mean)); return s; };
  const out = {};
  out.questions = line('challenge_questions', R.questions); out.answer = line('challenge_answer', R.answer); out.me = line('challenge_me', R.me);
  out.state = line('challenge_state (live)', R.state_live); out.state_done = line('challenge_state (done)', R.state_done); out.result = line('challenge_result', R.result);
  out.list = line('challenge_list', R.list); out.board = line('league_board', R.board);
  console.log('\nJSON ' + JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { mean: +f1(v.mean), p95: +f1(v.p95), max: +f1(v.max) }]))));
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });
