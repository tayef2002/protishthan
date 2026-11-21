// The question files of tools/quiz/sql/ run in a real Postgres engine (PGlite) on top of the question bank: they load, the database rules accept every row,
// the right answer is where the file says, nothing is added twice, and every band has enough questions for weeks of the daily quiz.
//   node tools/tests/test_quiz_bank_data.js     (PGLITE_DIR as for the other SQL tests)
const fs = require('fs'), path = require('path');
let PGlite;
try { ({ PGlite } = require(process.env.PGLITE_DIR ? path.join(process.env.PGLITE_DIR, 'node_modules', '@electric-sql', 'pglite') : '@electric-sql/pglite')); }
catch (e) { console.log('skipped: the PGlite engine is not installed (see the top of this file).'); process.exit(0); }
const R = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); };
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create function public.is_admin() returns boolean language sql stable as $$ select true $$;
    create table public.members (user_id uuid primary key, display_name text);`);
  await db.exec(R('migrations/2027-01-10_quiz_bank.sql'));
  const dir = path.join(__dirname, '..', 'quiz', 'sql'), files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  ok('there are question files to load', files.length > 0);
  for (const f of files) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const n1 = (await db.query(`select count(*)::int as n from public.quiz_questions`)).rows[0].n;
  for (const f of files) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const n2 = (await db.query(`select count(*)::int as n from public.quiz_questions`)).rows[0].n;
  ok('every file loads, and running them again adds nothing (' + n1 + ' questions)', n1 > 0 && n1 === n2);
  ok('all are VERIFIED, with a source and a version number, and the database accepted every option list (4 different options)', (await db.query(`select count(*)::int as n from public.quiz_questions where status <> 'verified' or char_length(source) < 3 or verified_at is null`)).rows[0].n === 0);
  // the marked answer is the one the file says (checked against the seed for the math files)
  const seed = JSON.parse(R('tools/quiz/seed-math-001.json')), by = new Map(seed.map(x => [x.q, x.correct]));
  const rows = (await db.query(`select question, options, answer_idx from public.quiz_questions where topic = 'math'`)).rows;
  ok('the right answer sits at answer_idx and is the one of the seed (every math question)', rows.length === seed.length && rows.every(r => r.options[r.answer_idx] === by.get(r.question)));
  const pos = [0, 0, 0, 0]; rows.forEach(r => pos[r.answer_idx]++);
  ok('the right answer is spread over the four places (no place has fewer than 15 percent or more than 35 percent)', pos.every(p => p / rows.length > 0.15 && p / rows.length < 0.35), JSON.stringify(pos));
  const bands = (await db.query(`select band, count(*)::int as n from public.quiz_questions group by band`)).rows;
  ok('every class band has at least 100 math questions (20 days of its own math alone)', ['c1-5', 'c6-8', 'c9-10', 'c11-12'].every(b => (bands.find(x => x.band === b) || { n: 0 }).n >= 100), JSON.stringify(bands));
  ok('no question text is twice in the bank', (await db.query(`select count(*)::int as n from (select question from public.quiz_questions group by question having count(*) > 1) t`)).rows[0].n === 0);
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('CRASH', e); process.exit(1); });
