// Runs migrations/2027-01-08_tutor_alerts.sql (after the whole tutor stack, with matches that already exist) in a real Postgres engine (PGlite).
//   one-time setup:  npm install --prefix %TEMP%\pgl @electric-sql/pglite      run:  set PGLITE_DIR=%TEMP%\pgl   then   node tools/tests/test_tutor_alert_sql.js
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
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin', true) = '1' $$;
    create function public.skill_text_ok(t text) returns boolean language sql immutable as $$ select lower(t) !~ 'badword|খারাপশব্দ' $$;
  `);
  for (const f of ['2026-12-17_tutors.sql', '2026-12-18_tutor_request_status.sql', '2026-12-19_tutor_profile_more.sql', '2026-12-20_tutor_browse.sql']) await db.exec(M(f));
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const as = async (uid, fn) => { await db.exec(`select set_config('test.uid', '${uid || ''}', false)`); return fn(); };
  const call = async (uid, sql, params) => as(uid, async () => { try { return (await db.query(sql, params)).rows[0].r; } catch (e) { return { thrown: e.message }; } });
  const guard = async (role, uid, sql) => { await db.exec("select set_config('test.uid', '" + (uid || '') + "', false)"); await db.exec('set role ' + role); try { return (await db.query(sql)).rows; } catch (e) { return 'denied'; } finally { await db.exec('reset role'); } };
  const T1 = '11111111-1111-1111-1111-111111111111', T2 = '22222222-2222-2222-2222-222222222222', T3 = '33333333-3333-3333-3333-333333333333', G = '99999999-9999-9999-9999-999999999999';

  const prof = (id, pid, status) => db.query(`insert into public.tutor_profiles (user_id, pid, status, display_name, full_name, phone) values ($1, $2, $3, 'ভাইয়া', 'আসল নাম', '01711111111')`, [id, pid, status]);
  await prof(T1, 'pid-approved', 'approved'); await prof(T2, 'pid-paused', 'paused'); await prof(T3, 'pid-draft', 'draft');
  let n = 0;
  const reqIns = async (o) => { n++; const p = Object.assign({ name: 'গোপন অভিভাবক', phone: '01899999999', class_band: 'c9-10', subjects: ['math', 'physics'], mode: 'home', district: 'বরিশাল', upazila: 'বরিশাল সদর', note: 'সপ্তাহে ৩ দিন, বিকেলে', tutor_pid: null, device: 'device-00' + n, pref_gender: 'female', student_level: 'mid', goal: 'exam', want_trial: true }, o || {}); return (await db.query(`insert into public.tutor_requests (name, phone, district, upazila, class_band, subjects, mode, note, tutor_pid, device, pref_gender, student_level, goal, want_trial) values ($1,$2,$3,$4,$5,$6::text[],$7,$8,$9,$10,$11,$12,$13,$14) returning id`, [p.name, p.phone, p.district, p.upazila, p.class_band, p.subjects, p.mode, p.note, p.tutor_pid, p.device, p.pref_gender, p.student_level, p.goal, p.want_trial])).rows[0].id; };

  // matches that existed BEFORE this migration (the admin sent a request to a tutor by WhatsApp)
  const oldReq = await reqIns();
  await db.query(`insert into public.tutor_matches (request_id, tutor_id) values ($1, $2)`, [oldReq, T1]);
  await db.exec(M('2027-01-08_tutor_alerts.sql')); await db.exec(M('2027-01-08_tutor_alerts.sql'));     // twice: safe

  ok('the matches that existed before are not shown as new (they were sent already)', (await call(T1, 'select public.tutor_alert_unread() as r')) === 0 && (await call(T1, 'select public.tutor_alerts_me() as r'))[0].seen === true);
  ok('a second run of the migration does not mark a NEW alert as seen', await (async () => { const rid = await reqIns({ tutor_pid: 'pid-approved' }); await db.exec(M('2027-01-08_tutor_alerts.sql')); const x = await call(T1, 'select public.tutor_alert_unread() as r'); await db.query('delete from public.tutor_requests where id = $1', [rid]); return x === 1; })());

  // ---- a guardian asks for one tutor
  const r1 = await reqIns({ tutor_pid: 'pid-approved', note: 'ছেলে নবম শ্রেণিতে' });
  ok('a request for an approved tutor becomes an alert for that tutor at once (source guardian, status sent, not seen)', await (async () => { const m = (await q(`select * from public.tutor_matches where request_id = $1`, [r1]))[0]; return m && m.tutor_id === T1 && m.source === 'guardian' && m.status === 'sent' && m.seen_at === null; })());
  ok('the unread count is 1', (await call(T1, 'select public.tutor_alert_unread() as r')) === 1);
  const rp = await reqIns({ tutor_pid: 'pid-paused' }), rd = await reqIns({ tutor_pid: 'pid-draft' }), rn = await reqIns({ tutor_pid: 'no-such' }), rg = await reqIns({});
  ok('a request for a paused, draft or unknown tutor makes no alert, and a request for nobody in particular makes none', (await q(`select count(*)::int n from public.tutor_matches where request_id = any($1::uuid[])`, [[rp, rd, rn, rg]]))[0].n === 0);
  ok('the same request cannot make two alerts for one tutor (the admin sending it too does not break)', await (async () => { try { await db.query(`insert into public.tutor_matches (request_id, tutor_id) values ($1, $2) on conflict do nothing`, [r1, T1]); return (await q(`select count(*)::int n from public.tutor_matches where request_id = $1`, [r1]))[0].n === 1; } catch (e) { return false; } })());

  // ---- what the tutor sees
  const alerts = await call(T1, 'select public.tutor_alerts_me() as r');
  const a = alerts.find(x => x.source === 'guardian');
  ok('the alert carries the request details: class, subjects, mode, area, note, the wishes (gender, level, goal, trial), the time', a && a.class_band === 'c9-10' && a.subjects.includes('math') && a.mode === 'home' && a.upazila === 'বরিশাল সদর' && a.note === 'ছেলে নবম শ্রেণিতে' && a.pref_gender === 'female' && a.student_level === 'mid' && a.goal === 'exam' && a.want_trial === true && !!a.created_at, JSON.stringify(a));
  const text = JSON.stringify(alerts);
  ok('THE GUARDIAN\'S NAME AND NUMBER ARE NOT IN THE ANSWER (nor the device, nor the user id, nor the admin note)', !/গোপন অভিভাবক|01899999999|device-00|user_id|admin_note|"phone"|"name"|"device"|tutor_pid/.test(text), text);
  ok('a tutor sees only their own alerts: another tutor gets none of them, a signed-out call gets none', (await call(T2, 'select public.tutor_alerts_me() as r')).length === 0 && JSON.stringify(await call(null, 'select public.tutor_alerts_me() as r')) === '[]');
  ok('a request the admin marked as spam disappears from the tutor and from the count', await (async () => { await db.query(`update public.tutor_requests set status = 'spam' where id = $1`, [r1]); const l = (await call(T1, 'select public.tutor_alerts_me() as r')).some(x => x.source === 'guardian'); const c = await call(T1, 'select public.tutor_alert_unread() as r'); await db.query(`update public.tutor_requests set status = 'new' where id = $1`, [r1]); return !l && c === 0; })());
  ok('newest first', (await call(T1, 'select public.tutor_alerts_me() as r'))[0].source === 'guardian');

  // ---- seen
  const aid = a.id;
  ok('seeing marks only the given alerts of the caller, and the count goes down', (await call(T2, 'select public.tutor_alert_seen($1::uuid[]) as r', [[aid]])).ok === true && (await call(T1, 'select public.tutor_alert_unread() as r')) === 1 && (await call(T1, 'select public.tutor_alert_seen($1::uuid[]) as r', [[aid]])).ok === true && (await call(T1, 'select public.tutor_alert_unread() as r')) === 0);

  // ---- the answer
  ok('a signed-out call and a bad answer are refused', (await call(null, `select public.tutor_alert_reply($1, 'accepted') as r`, [aid])).error === 'NOT_SIGNED_IN' && (await call(T1, `select public.tutor_alert_reply($1, 'maybe') as r`, [aid])).error === 'BAD_REPLY');
  ok('another tutor cannot answer for this one', (await call(T2, `select public.tutor_alert_reply($1, 'accepted') as r`, [aid])).error === 'NOT_FOUND');
  ok('the tutor answers "interested": the match status becomes accepted (the admin tab shows it), the time is kept, the alert counts as seen', await (async () => { const r = await call(T1, `select public.tutor_alert_reply($1, 'accepted') as r`, [aid]); const m = (await q('select * from public.tutor_matches where id = $1', [aid]))[0]; return r.ok === true && m.status === 'accepted' && !!m.replied_at && !!m.seen_at; })());
  ok('the answer can be changed (declined), until the admin marks it as started', (await call(T1, `select public.tutor_alert_reply($1, 'declined') as r`, [aid])).status === 'declined');
  await db.query(`update public.tutor_matches set status = 'started' where id = $1`, [aid]);
  ok('after "started" the tutor can no longer change it', (await call(T1, `select public.tutor_alert_reply($1, 'declined') as r`, [aid])).error === 'ALREADY_STARTED');
  ok('an answer to a request marked spam is refused', await (async () => { const m = (await q(`select id from public.tutor_matches where request_id = $1`, [oldReq]))[0].id; await db.query(`update public.tutor_requests set status = 'spam' where id = $1`, [oldReq]); const r = await call(T1, `select public.tutor_alert_reply($1, 'accepted') as r`, [m]); await db.query(`update public.tutor_requests set status = 'new' where id = $1`, [oldReq]); return r.error === 'NOT_FOUND'; })());

  // ---- who can call what
  ok('anon cannot call any of the four functions, a signed-in member can', (await guard('anon', '', 'select public.tutor_alerts_me()')) === 'denied' && (await guard('anon', '', 'select public.tutor_alert_unread()')) === 'denied' && (await guard('anon', '', `select public.tutor_alert_reply('${aid}', 'accepted')`)) === 'denied' && (await guard('anon', '', `select public.tutor_alert_seen(array['${aid}']::uuid[])`)) === 'denied' && Array.isArray(await guard('authenticated', T1, 'select public.tutor_alerts_me()')));
  ok('the closed tables stay closed (a tutor cannot read the matches or the requests directly)', [await guard('authenticated', T1, 'select * from public.tutor_matches'), await guard('authenticated', T1, 'select * from public.tutor_requests')].every(x => x === 'denied' || (Array.isArray(x) && x.length === 0)));   // denied, or row security gives an ordinary member no rows
  ok('the older tutor calls still work next to the new ones', (await q('select public.tutor_state() as s'))[0].s.requests === true && (await call(T1, 'select public.tutor_my_profile() as r')).pid === 'pid-approved');
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });
