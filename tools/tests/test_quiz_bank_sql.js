// Runs migrations/2027-01-10_quiz_bank.sql in a real Postgres engine (PGlite): the question bank and its verification flow.
//   one-time setup:  npm install --prefix %TEMP%\pgl @electric-sql/pglite      run:  set PGLITE_DIR=%TEMP%\pgl   then   node tools/tests/test_quiz_bank_sql.js
const fs = require('fs'), path = require('path');
let PGlite;
try { ({ PGlite } = require(process.env.PGLITE_DIR ? path.join(process.env.PGLITE_DIR, 'node_modules', '@electric-sql', 'pglite') : '@electric-sql/pglite')); }
catch (e) { console.log('skipped: the PGlite engine is not installed (see the top of this file).'); process.exit(0); }
const SQL = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2027-01-10_quiz_bank.sql'), 'utf8');
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
  `);
  const U = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
  for (let i = 1; i <= 6; i++) await db.exec(`insert into auth.users (id) values ('${U(i)}')`);
  await db.exec(SQL); await db.exec(SQL);                                       // twice: safe
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const err = async (sql, params) => { try { await db.query(sql, params); return null; } catch (e) { return e.message; } };
  const as = async (uid, fn) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); return fn(); };
  const call = (uid, sql, params) => as(uid, async () => { try { return (await db.query(sql, params)).rows[0].r; } catch (e) { return { thrown: e.message }; } });
  const guard = async (role, uid, sql) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); await db.exec('set role ' + role); try { return (await db.query(sql)).rows; } catch (e) { return 'denied'; } finally { await db.exec('reset role'); } };
  const ADMIN = 1, R1 = 2, R2 = 3, R3 = 4, PLAYER = 5;
  await db.exec(`insert into public.quiz_reviewers (user_id, note) values ('${U(R1)}', 'শিক্ষক'), ('${U(R2)}', 'শিক্ষক'), ('${U(R3)}', 'ছাত্র')`);
  const add = async (o) => { const p = Object.assign({ topic: 'gk', band: 'any', difficulty: 2, question: 'বাংলাদেশের রাজধানীর নাম কী?', options: ['ঢাকা', 'চট্টগ্রাম', 'খুলনা', 'রাজশাহী'], answer_idx: 0, explanation: '', source: '', status: 'draft', created_by: U(ADMIN) }, o || {});
    return (await db.query(`insert into public.quiz_questions (topic, band, difficulty, question, options, answer_idx, explanation, source, status, created_by) values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10) returning id`, [p.topic, p.band, p.difficulty, p.question, JSON.stringify(p.options), p.answer_idx, p.explanation, p.source, p.status, p.created_by])).rows[0].id; };
  const st = async id => (await q('select status, rev, verified_by, verified_at from public.quiz_questions where id = $1', [id]))[0];

  // ---- the rules of a question
  const bad = async (o) => err(`insert into public.quiz_questions (topic, question, options, answer_idx) values ($1, $2, $3::jsonb, $4)`, [o.t || 'gk', o.q || 'প্রশ্নটা কী?', JSON.stringify(o.o || ['ক', 'খ', 'গ', 'ঘ']), o.a === undefined ? 0 : o.a]);
  ok('a good question is stored as a draft, version 1', await (async () => { const id = await add(); const s = await st(id); return s.status === 'draft' && s.rev === 1; })());
  ok('refused: an unknown topic, 3 options, 5 options, a repeated option, an empty option, an answer index of 4, a too short question', /check/.test(await bad({ t: 'nonsense' })) && /check/.test(await bad({ o: ['ক', 'খ', 'গ'] })) && /check/.test(await bad({ o: ['ক', 'খ', 'গ', 'ঘ', 'ঙ'] })) && /check/.test(await bad({ o: ['ক', 'ক', 'গ', 'ঘ'] })) && /check/.test(await bad({ o: ['ক', '', 'গ', 'ঘ'] })) && /check/.test(await bad({ a: 4 })) && /check/.test(await bad({ q: 'কী' })));
  ok('options that are not text (numbers) are refused', /check/.test(await err(`insert into public.quiz_questions (topic, question, options, answer_idx) values ('gk', 'প্রশ্নটা কী?', '[1,2,3,4]'::jsonb, 0)`)));
  ok('going to checking or being verified needs a source', /NEED_SOURCE/.test(await add({ status: 'review' }).catch(e => e.message)) && /NEED_SOURCE/.test(await add({ status: 'verified' }).catch(e => e.message)));

  // ---- the flow: two reviewers say ok -> verified
  const a = await add({ source: 'প্রাথমিক বাংলাদেশ ও বিশ্বপরিচয়, শ্রেণি ৩' });
  await q(`update public.quiz_questions set status = 'review' where id = $1`, [a]);
  ok('sent to checking: status review', (await st(a)).status === 'review');
  ok('a reviewer sees it in the queue with the answer and the source; the count of waiting questions says 1', await (async () => { const l = await call(R1, 'select public.quiz_review_queue(5) as r'); const me = await call(R1, 'select public.quiz_review_me() as r'); return l.length === 1 && l[0].id === a && l[0].answer_idx === 0 && l[0].source.includes('প্রাথমিক') && me.reviewer === true && me.waiting === 1 && me.done === 0; })());
  ok('a player (not a reviewer) sees nothing and is told so', (await call(PLAYER, 'select public.quiz_review_queue(5) as r')).length === 0 && (await call(PLAYER, 'select public.quiz_review_me() as r')).reviewer === false && (await call(PLAYER, `select public.quiz_review_submit($1, 'ok', '') as r`, [a])).error === 'NOT_REVIEWER');
  ok('a signed-out call and a bad verdict are refused', (await call(null, `select public.quiz_review_submit($1, 'ok', '') as r`, [a])).error === 'NOT_SIGNED_IN' && (await call(R1, `select public.quiz_review_submit($1, 'fine', '') as r`, [a])).error === 'BAD_VERDICT');
  ok('one ok is not enough: still in review', (await call(R1, `select public.quiz_review_submit($1, 'ok', '') as r`, [a])).status === 'review');
  ok('the same reviewer saying ok again does not count twice (still review)', (await call(R1, `select public.quiz_review_submit($1, 'ok', '') as r`, [a])).status === 'review' && (await q('select count(*)::int n from public.quiz_checks where question_id = $1', [a]))[0].n === 1);
  ok('a checked question leaves that reviewer\'s queue, stays in the other\'s', (await call(R1, 'select public.quiz_review_queue(5) as r')).length === 0 && (await call(R2, 'select public.quiz_review_queue(5) as r')).length === 1);
  ok('a second, different reviewer says ok: VERIFIED by the reviewers, with the time', await (async () => { const r = await call(R2, `select public.quiz_review_submit($1, 'ok', '') as r`, [a]); const s = await st(a); return r.status === 'verified' && s.status === 'verified' && s.verified_by === 'reviewers' && !!s.verified_at; })());
  ok('an "unsure" does not count as ok', await (async () => { const b = await add({ source: 'x বই' }); await q(`update public.quiz_questions set status = 'review' where id = $1`, [b]); await call(R1, `select public.quiz_review_submit($1, 'ok', '') as r`, [b]); const r = await call(R2, `select public.quiz_review_submit($1, 'unsure', 'পাতা মিলছে না') as r`, [b]); return r.status === 'review'; })());

  // ---- a wrong verdict
  const w = await add({ source: 'বই ক' }); await q(`update public.quiz_questions set status = 'review' where id = $1`, [w]);
  ok('"wrong" needs a written note', (await call(R1, `select public.quiz_review_submit($1, 'wrong', '') as r`, [w])).error === 'NEED_NOTE' && (await call(R1, `select public.quiz_review_submit($1, 'wrong', 'ক') as r`, [w])).error === 'NEED_NOTE');
  ok('one wrong with a note: flagged for the admin, even if another reviewer said ok', await (async () => { await call(R2, `select public.quiz_review_submit($1, 'ok', '') as r`, [w]); const r = await call(R1, `select public.quiz_review_submit($1, 'wrong', 'উত্তর ঢাকা নয়, বইয়ে অন্যটা আছে') as r`, [w]); return r.status === 'flagged' && (await st(w)).status === 'flagged'; })());
  ok('two oks cannot outvote a wrong (the third reviewer says ok: still flagged)', (await call(R3, `select public.quiz_review_submit($1, 'ok', '') as r`, [w])).status === 'flagged');
  ok('the reviewer who was wrong changes their mind: the flag goes (two ok remain, it becomes verified)', (await call(R1, `select public.quiz_review_submit($1, 'ok', '') as r`, [w])).status === 'verified');

  // ---- editing starts again
  ok('editing a verified question: a new version, back to draft, the old verdicts no longer count, the verified mark is gone', await (async () => { await q(`update public.quiz_questions set question = 'বাংলাদেশের রাজধানী কোন শহর?' where id = $1`, [a]); const s = await st(a); return s.rev === 2 && s.status === 'draft' && s.verified_by === null && s.verified_at === null; })());
  ok('after the edit it must be sent again, and the old oks do not count: one new ok is not enough', await (async () => { await q(`update public.quiz_questions set status = 'review' where id = $1`, [a]); const r = await call(R1, `select public.quiz_review_submit($1, 'ok', '') as r`, [a]); return r.status === 'review' && (await st(a)).rev === 2; })());
  ok('editing only the admin note or the schedule does not start a new version', await (async () => { await q(`update public.quiz_questions set admin_note = 'ঠিক আছে', publish_on = current_date where id = $1`, [a]); return (await st(a)).rev === 2 && (await st(a)).status === 'review'; })());

  // ---- limits of a reviewer
  const own = await add({ source: 'নিজের বই', created_by: U(R1) }); await q(`update public.quiz_questions set status = 'review' where id = $1`, [own]);
  ok('a reviewer cannot check a question they wrote (not in the queue, not accepted)', !(await call(R1, 'select public.quiz_review_queue(10) as r')).some(x => x.id === own) && (await call(R1, `select public.quiz_review_submit($1, 'ok', '') as r`, [own])).error === 'NOT_FOUND');
  const dr = await add({ source: 'পাঠ্যবই ক' });
  ok('a draft cannot be checked (only a question sent for checking)', (await call(R1, `select public.quiz_review_submit($1, 'ok', '') as r`, [dr])).error === 'NOT_FOUND' && !(await call(R1, 'select public.quiz_review_queue(10) as r')).some(x => x.id === dr));
  ok('the queue never gives more than 10 at a time', (await call(R3, 'select public.quiz_review_queue(500) as r')).length <= 10);
  ok('the admin can verify directly (an override), marked as by the admin', await (async () => { await q(`update public.quiz_questions set status = 'verified' where id = $1`, [dr]); const s = await st(dr); return s.verified_by === 'admin' && !!s.verified_at; })());
  ok('retiring clears the verified mark', await (async () => { await q(`update public.quiz_questions set status = 'retired' where id = $1`, [dr]); return (await st(dr)).verified_by === null; })());

  // ---- who can read what
  ok('the closed tables: anon and an ordinary member get nothing (denied, or no rows), only the admin reads them directly', await (async () => {
    const r = [await guard('anon', 0, 'select * from public.quiz_questions'), await guard('authenticated', PLAYER, 'select * from public.quiz_questions'), await guard('authenticated', R1, 'select * from public.quiz_checks'), await guard('authenticated', R1, 'select * from public.quiz_reviewers')];
    await db.exec("select set_config('test.admin', '1', false)"); const adm = await guard('authenticated', ADMIN, 'select * from public.quiz_questions'); await db.exec("select set_config('test.admin', '0', false)");
    return r.every(x => x === 'denied' || (Array.isArray(x) && x.length === 0)) && Array.isArray(adm) && adm.length > 3; })());
  ok('an ordinary member cannot write questions, verdicts or reviewers directly (row security)', await (async () => {
    const t = async sql => { await db.exec(`select set_config('test.uid', '${U(PLAYER)}', false)`); await db.exec('set role authenticated'); try { const r = await db.query(sql); return r.affectedRows === 0 ? 'none' : 'wrote'; } catch (e) { return 'denied'; } finally { await db.exec('reset role'); } };
    const out = [await t(`insert into public.quiz_questions (topic, question, options, answer_idx) values ('gk', 'প্রশ্নটা কী?', '["ক","খ","গ","ঘ"]', 0)`), await t(`insert into public.quiz_reviewers (user_id) values ('${U(PLAYER)}')`), await t(`update public.quiz_questions set status = 'verified'`)];
    return out.every(x => x === 'denied' || x === 'none'); })());
  ok('anon cannot call the three reviewer functions', (await guard('anon', 0, 'select public.quiz_review_me()')) === 'denied' && (await guard('anon', 0, 'select public.quiz_review_queue(5)')) === 'denied' && (await guard('anon', 0, `select public.quiz_review_submit('${a}', 'ok', '')`)) === 'denied');
  ok('the answer is never in any public read: no public function or view serves a question yet (the next step will, without the answer)', (await q(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'quiz%' and has_function_privilege('anon', p.oid, 'execute') and p.proname not in ('quiz_options_ok')`))[0].n === 0);
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });
