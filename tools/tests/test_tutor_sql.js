// Runs migrations/2026-12-17_tutors.sql in a real Postgres engine (PGlite) with stand-ins for the parts of Supabase it relies on, then exercises every function.
//   one-time setup (nothing is added to the project):  npm install --prefix %TEMP%\pglite @electric-sql/pglite
//   run:  set PGLITE_DIR=%TEMP%\pglite   then   node tools/tests/test_tutor_sql.js          (without the engine it says so and stops, it does not fail)
const fs = require('fs'), path = require('path');
let PGlite;
try { ({ PGlite } = require(process.env.PGLITE_DIR ? path.join(process.env.PGLITE_DIR, 'node_modules', '@electric-sql', 'pglite') : '@electric-sql/pglite')); }
catch (e) { console.log('skipped: the PGlite engine is not installed (see the two lines at the top of this file).'); process.exit(0); }
const SQL = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-17_tutors.sql'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); };
(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;   -- what Supabase does by itself
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin', true) = '1' $$;
    create function public.skill_text_ok(t text) returns boolean language sql immutable as $$ select lower(t) !~ 'badword|খারাপশব্দ' $$;
  `);
  await db.exec(SQL);
  const SQL2 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-18_tutor_request_status.sql'), 'utf8');
  await db.exec(SQL2);
  const as = async (uid, fn) => { await db.exec(`select set_config('test.uid', '${uid || ''}', false)`); return fn(); };
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const err = async (sql, params) => { try { await db.query(sql, params); return null; } catch (e) { return e.message; } };
  const U1 = '11111111-1111-1111-1111-111111111111', U2 = '22222222-2222-2222-2222-222222222222';

  // ---- state and the empty search
  let r = (await q('select public.tutor_state() as s'))[0].s;
  ok('state: list off, requests open by default', r.listing === false && r.requests === true, JSON.stringify(r));
  ok('the search is empty on a fresh install', (await q('select * from public.tutor_search()')).length === 0);

  // ---- guardian requests
  const REQ = (over) => Object.assign({ dev: 'device-0001', name: 'রহিমা বেগম', phone: '01712345678', d: 'বরিশাল', u: 'বরিশাল সদর', c: 'c6-8', s: ['math', 'english'], m: 'home', n: 'সপ্তাহে ৩ দিন', t: null, hp: '' }, over || {});
  const add = async (o) => { const p = REQ(o); return err('select public.tutor_request_add($1,$2,$3,$4,$5,$6,$7::text[],$8,$9,$10,$11)', [p.dev, p.name, p.phone, p.d, p.u, p.c, p.s, p.m, p.n, p.t, p.hp]); };
  ok('a good request is accepted', (await add()) === null);
  const row = (await q('select * from public.tutor_requests'))[0];
  ok('the row is stored clean: mobile, class, sorted subjects, status new', row.phone === '01712345678' && row.class_band === 'c6-8' && JSON.stringify(row.subjects) === JSON.stringify(['english', 'math']) && row.status === 'new', JSON.stringify(row));
  ok('a second request at once from the same device: TOO_FAST', /TOO_FAST/.test(await add({ phone: '01812345678' })));
  await db.exec(`update public.tutor_requests set created_at = now() - interval '2 minutes'`);
  ok('Bangla digits and +88 are understood as a mobile number', (await add({ dev: 'device-0002', phone: '+৮৮০১৯১২৩৪৫৬৭৮' })) === null && (await q(`select 1 from public.tutor_requests where phone = '01912345678'`)).length === 1);
  const bad = { phone: ['BAD_PHONE', { dev: 'device-0003', phone: '12345' }], name: ['BAD_NAME', { dev: 'device-0003', name: 'র' }], cls: ['BAD_CLASS', { dev: 'device-0003', c: 'c99' }], sub: ['BAD_SUBJECT', { dev: 'device-0003', s: ['nonsense'] }], nosub: ['BAD_SUBJECT', { dev: 'device-0003', s: [] }],
    mode: ['BAD_MODE', { dev: 'device-0003', m: 'zoomzoom' }], area: ['BAD_AREA', { dev: 'device-0003', d: '', u: '' }], dev: ['BAD_DEVICE', { dev: 'x' }], hp: ['SPAM', { dev: 'device-0003', hp: 'http://x' }],
    link: ['BAD_LINK', { dev: 'device-0003', n: 'দেখুন www.example.com' }], mail: ['BAD_LINK', { dev: 'device-0003', n: 'a@b.com' }], priv: ['BAD_PRIVATE', { dev: 'device-0003', n: 'আমার নম্বর ০১৭১১২২৩৩৪৪' }], word: ['BAD_TEXT', { dev: 'device-0003', n: 'this is badword' }] };
  for (const k of Object.keys(bad)) { const e = await add(bad[k][1]); ok('refused: ' + k + ' -> ' + bad[k][0], e && e.includes(bad[k][0]), String(e)); }
  ok('online with no area is fine', (await add({ dev: 'device-0004', phone: '01512345678', m: 'online', d: '', u: '' })) === null);
  await db.exec(`update public.tutor_requests set created_at = now() - interval '2 minutes'`);
  ok('the same request again within a week: DUPLICATE', /DUPLICATE/.test(await add({ dev: 'device-0005' })));
  for (const [i, ph] of [['a', '01611111111'], ['b', '01622222222'], ['c', '01655555555']].entries()) { await db.exec(`update public.tutor_requests set created_at = now() - interval '2 minutes'`); ok('device 6, request ' + (i + 1) + ' of 3 in a day is accepted', (await add({ dev: 'device-0006', phone: ph[1], s: ['bangla', 'math', 'ict'].slice(0, 1 + i), c: ['c1-5', 'c9-10', 'c6-8'][i] })) === null); }
  await db.exec(`update public.tutor_requests set created_at = now() - interval '2 minutes'`);
  ok('a fourth request in a day from one device: DAILY_LIMIT', /DAILY_LIMIT/.test(await add({ dev: 'device-0006', phone: '01633333333', c: 'c11-12' })));
  await db.exec(`update public.tutor_requests set created_at = now() - interval '2 minutes' where phone <> '01712345678'`);
  for (const [i, c] of ['c1-5', 'c9-10', 'c11-12'].entries()) { await db.exec(`update public.tutor_requests set created_at = now() - interval '2 minutes'`); await add({ dev: 'device-1' + i + '00', phone: '01744444444', c, s: ['hmath'] }); }
  await db.exec(`update public.tutor_requests set created_at = now() - interval '2 minutes'`);
  ok('a fourth request in a day with one mobile number: PHONE_LIMIT', /PHONE_LIMIT/.test(await add({ dev: 'device-1999', phone: '01744444444', c: 'admission', s: ['ict'] })));
  await db.exec(`update public.tutor_settings set requests_open = false`);
  ok('requests switched off: CLOSED', /CLOSED/.test(await add({ dev: 'device-2000', phone: '01855555555' })));
  await db.exec(`update public.tutor_settings set requests_open = true`);

  // ---- tutor profiles
  const PROF = { full_name: 'মোঃ করিম উদ্দিন', display_name: 'করিম ভাইয়া', gender: 'male', phone: '০১৭১১-২২৩৩৪৪', institution: 'বরিশাল বিশ্ববিদ্যালয়', department: 'গণিত', edu_level: 'bachelor', subjects: ['math', 'physics', 'bogus'], classes: ['c6-8', 'c9-10'], modes: ['home', 'online'], times: ['evening'], district: 'বরিশাল', upazila: 'বরিশাল সদর', area_note: 'রূপাতলী', fee_note: 'মাসে ২০০০', bio: 'আমি গণিত আর পদার্থবিজ্ঞান পড়াতে ভালোবাসি। ৩ বছরের অভিজ্ঞতা আছে।', age_ok: true, terms_ok: true };
  const save = (uid, data, submit) => as(uid, async () => { try { return { out: (await q('select public.tutor_profile_save($1::jsonb, $2) as p', [JSON.stringify(data), !!submit]))[0].p }; } catch (e) { return { err: e.message }; } });
  ok('not signed in: NOT_SIGNED_IN', /NOT_SIGNED_IN/.test((await save('', PROF, true)).err || ''));
  let s = await save(U1, { full_name: '  করিম   উদ্দিন ', phone: 'abc' }, false);
  ok('a draft is accepted half-filled and cleaned', s.out && s.out.status === 'draft' && s.out.full_name === 'করিম উদ্দিন' && s.out.phone === '', JSON.stringify(s));
  ok('my_profile hides admin_note, seen and user_id', s.out && !('admin_note' in s.out) && !('seen' in s.out) && !('user_id' in s.out));
  for (const [code, mut] of [['NEED_NAME', { full_name: '' }], ['NEED_PHONE', { phone: '123' }], ['NEED_STUDY', { institution: '' }], ['NEED_SUBJECT', { subjects: [] }], ['NEED_CLASS', { classes: [] }], ['NEED_MODE', { modes: [] }], ['NEED_AREA', { district: '' }], ['NEED_BIO', { bio: 'ছোট' }], ['NEED_AGE', { age_ok: false }], ['NEED_TERMS', { terms_ok: false }]]) {
    const e = (await save(U1, Object.assign({}, PROF, mut), true)).err || ''; ok('submit refused: ' + code, e.includes(code), e);
  }
  for (const [code, mut] of [['BAD_LINK', { bio: 'আমার সাইট www.example.com আছে, দেখে নিন ভালো করে' }], ['BAD_PRIVATE', { bio: 'আমাকে ডাকুন ০১৭১১২২৩৩৪৪ নম্বরে, সহজেই পাবেন' }], ['BAD_TEXT', { display_name: 'badword' }]]) {
    const e = (await save(U1, Object.assign({}, PROF, mut), false)).err || ''; ok('even a draft refuses: ' + code, e.includes(code), e);
  }
  s = await save(U1, PROF, true);
  ok('a full submit goes to review, mobile normalised, unknown subject dropped', s.out && s.out.status === 'submitted' && s.out.phone === '01711223344' && JSON.stringify(s.out.subjects) === JSON.stringify(['math', 'physics']), JSON.stringify(s));
  ok('terms time is recorded', s.out && s.out.terms_at != null);
  const pid = s.out.pid;
  ok('a public id exists and is not the user id', /^[0-9a-f]{12}$/.test(pid));
  ok('nothing is listed before approval, even if the list is on', (await q('select * from public.tutor_search()')).length === 0 && (await db.exec(`update public.tutor_settings set public_listing = true`), (await q('select * from public.tutor_search()')).length === 0));
  await db.exec(`update public.tutor_profiles set status = 'approved', approved_at = now(), verify = 'verified', admin_note = 'ID দেখা হয়েছে' where user_id = '${U1}'`);
  await db.exec(`update public.tutor_settings set public_listing = false`);
  ok('approved but the list is switched off: still nobody', (await q('select * from public.tutor_search()')).length === 0);
  await db.exec(`update public.tutor_settings set public_listing = true`);
  let rows = await q('select * from public.tutor_search()');
  ok('approved and the list on: one tutor, display name only', rows.length === 1 && rows[0].name === 'করিম ভাইয়া' && rows[0].verified === true && Number(rows[0].total) === 1, JSON.stringify(rows));
  const cols = Object.keys(rows[0]);
  ok('the search never returns the phone, the full name, the fee, the admin note or the user id', !cols.some(c => ['phone', 'full_name', 'fee_note', 'admin_note', 'user_id', 'area_note'].includes(c)), cols.join(','));
  // a second tutor: online only, from Dhaka, English
  await save(U2, Object.assign({}, PROF, { full_name: 'সুমি আক্তার', display_name: 'সুমি আপু', gender: 'female', phone: '01811111111', district: 'ঢাকা', upazila: 'ধানমন্ডি', modes: ['online'], subjects: ['english'], classes: ['c1-5', 'c6-8'], institution: 'ঢাকা বিশ্ববিদ্যালয়' }), true);
  await db.exec(`update public.tutor_profiles set status = 'approved', approved_at = now() where user_id = '${U2}'`);
  const S = (...a) => q('select * from public.tutor_search($1,$2,$3,$4,$5,$6,$7)', a);
  ok('Barisal Sadar, home: only the Barisal tutor', (await S('বরিশাল', 'বরিশাল সদর', null, null, 'home', 12, 0)).map(x => x.pid).join() === pid);
  ok('Barisal Sadar, no mode: the local tutor first, then the online one from Dhaka', (await S('বরিশাল', 'বরিশাল সদর', null, null, null, 12, 0)).map(x => x.name).join() === 'করিম ভাইয়া,সুমি আপু');
  ok('online: both, wherever they live', (await S('বরিশাল', 'বরিশাল সদর', null, null, 'online', 12, 0)).length === 2);
  ok('class and subject filters work', (await S(null, null, 'c9-10', 'math', null, 12, 0)).length === 1 && (await S(null, null, 'c1-5', 'math', null, 12, 0)).length === 0);
  ok('limit and offset work, total stays', (await S(null, null, null, null, null, 1, 1)).length === 1 && Number((await S(null, null, null, null, null, 1, 0))[0].total) === 2);
  ok('a district nobody is in, home: nobody', (await S('সিলেট', 'সিলেট সদর', null, null, 'home', 12, 0)).length === 0);
  // editing after approval
  s = await save(U1, Object.assign({}, PROF, { bio: 'আমি গণিত পড়াই। এখন নতুন করে আরও ভালোভাবে লিখলাম নিজের কথা।' }), true);
  ok('editing an approved profile keeps it approved and flags it for another look', s.out && s.out.status === 'approved' && s.out.edited === true, JSON.stringify(s));
  ok('and the admin sees it as unseen again', (await q(`select seen from public.tutor_profiles where user_id = '${U1}'`))[0].seen === false);
  const pz = await as(U1, async () => (await q('select public.tutor_profile_pause(true) as p'))[0].p);
  ok('pause hides the tutor from the search', pz.status === 'paused' && (await S('বরিশাল', 'বরিশাল সদর', null, null, 'home', 12, 0)).length === 0);
  const rs = await as(U1, async () => (await q('select public.tutor_profile_pause(false) as p'))[0].p);
  ok('resume brings the tutor back', rs.status === 'approved' && (await S('বরিশাল', 'বরিশাল সদর', null, null, 'home', 12, 0)).length === 1);
  const rj = await db.exec(`update public.tutor_profiles set status = 'rejected' where user_id = '${U2}'`);
  s = await save(U2, { bio: 'নতুন করে লিখছি নিজের কথা অনেকটা বড় করে' }, false);
  ok('editing a rejected profile reopens it as a draft', s.out && s.out.status === 'draft', JSON.stringify(s));
  ok('a pause by someone not approved does nothing', (await as(U2, async () => (await q('select public.tutor_profile_pause(true) as p'))[0].p)).status === 'draft');

  // ---- the doors: who may touch what
  const can = async (role, sql) => (await q(`select ${sql} as v`))[0].v;
  for (const t of ['tutor_profiles', 'tutor_requests', 'tutor_matches', 'tutor_settings']) ok('anon has no direct access to ' + t, !(await can('anon', `has_table_privilege('anon', 'public.${t}', 'select')`)) && !(await can('anon', `has_table_privilege('anon', 'public.${t}', 'insert')`)));
  ok('the signed-in role cannot insert profiles or requests directly (only the functions can)', !(await can('x', `has_table_privilege('authenticated', 'public.tutor_profiles', 'insert')`)) && !(await can('x', `has_table_privilege('authenticated', 'public.tutor_requests', 'insert')`)));
  ok('anon may call the search, the state and the request function', await can('x', `has_function_privilege('anon', 'public.tutor_search(text,text,text,text,text,int,int)', 'execute') and has_function_privilege('anon', 'public.tutor_state()', 'execute') and has_function_privilege('anon', 'public.tutor_request_add(text,text,text,text,text,text,text[],text,text,text,text)', 'execute')`));
  ok('anon may NOT call the profile functions', !(await can('x', `has_function_privilege('anon', 'public.tutor_profile_save(jsonb,boolean)', 'execute') or has_function_privilege('anon', 'public.tutor_my_profile()', 'execute') or has_function_privilege('anon', 'public.tutor_profile_pause(boolean)', 'execute')`)));
  ok('row security is on for all four tables', (await q(`select count(*)::int n from pg_class where relname in ('tutor_profiles','tutor_requests','tutor_matches','tutor_settings') and relrowsecurity`))[0].n === 4);
  ok('there is an admin-only policy on each', (await q(`select count(*)::int n from pg_policies where tablename like 'tutor_%' and policyname like '%admin'`))[0].n === 4);
  // ---- the status of a request
  const rid = (await q('select id from public.tutor_requests order by created_at limit 1'))[0].id;
  let st = (await q('select public.tutor_request_status($1::uuid) as s', [rid]))[0].s;
  ok('status of a request: the status, the time and how many were sent, nothing else', st && st.status === 'new' && Number(st.sent) === 0 && st.created_at && Object.keys(st).sort().join() === 'created_at,sent,status', JSON.stringify(st));
  await db.exec(`insert into public.tutor_matches (request_id, tutor_id) values ('${rid}', '${U1}')`); await db.exec(`update public.tutor_requests set status = 'matching' where id = '${rid}'`);
  st = (await q('select public.tutor_request_status($1::uuid) as s', [rid]))[0].s;
  ok('after the admin sent a profile: "matching" and 1 sent', st.status === 'matching' && Number(st.sent) === 1, JSON.stringify(st));
  ok('an id that does not exist answers null', (await q(`select public.tutor_request_status('00000000-0000-0000-0000-000000000000') as s`))[0].s === null);
  await db.exec(`update public.tutor_requests set status = 'spam' where id = '${rid}'`);
  ok('a request marked spam answers nothing', (await q('select public.tutor_request_status($1::uuid) as s', [rid]))[0].s === null);
  ok('anon may ask the status', await can('x', `has_function_privilege('anon', 'public.tutor_request_status(uuid)', 'execute')`));
  // run it twice: safe to run again
  let again = null; try { await db.exec(SQL); await db.exec(SQL2); } catch (e) { again = e.message; }
  ok('the migration can run twice without an error', again === null, String(again));
  ok('and the settings row is still one row', (await q('select count(*)::int n from public.tutor_settings'))[0].n === 1);

  // ================= the extras (2026-12-19): run as an UPGRADE on top of the data made above =================
  const SQL3 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-19_tutor_profile_more.sql'), 'utf8');
  let up = null; try { await db.exec(SQL3); } catch (e) { up = e.message; }
  ok('the extras migration runs on a database that already has tutors and requests', up === null, String(up));
  let up2 = null; try { await db.exec(SQL3); await db.exec(SQL2); } catch (e) { up2 = e.message; }
  ok('and it can run twice', up2 === null, String(up2));
  ok('exactly one tutor_request_add and one tutor_search remain (no overload to confuse a call)', (await q(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'tutor_request_add'`))[0].n === 1 && (await q(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'tutor_search'`))[0].n === 1);
  ok('the OLD page\'s 11-argument request call still works against the new function', (await add({ dev: 'device-3001', phone: '01899999991', c: 'c9-10', s: ['bangla'] })) === null);
  const oldRow = (await q(`select * from public.tutor_requests where phone = '01899999991'`))[0];
  ok('and the wishes it did not send are empty', oldRow.pref_gender === '' && oldRow.student_level === '' && oldRow.goal === '' && oldRow.want_trial === false, JSON.stringify(oldRow));
  const add2 = async (o) => { const p = Object.assign({ dev: 'device-4001', name: 'রহিমা বেগম', phone: '01877777771', d: 'বরিশাল', u: 'বরিশাল সদর', c: 'c6-8', s: ['math'], m: 'home', n: '', t: null, hp: '', pref: 'female', level: 'weak', goal: 'exam', trial: true }, o || {}); return err('select public.tutor_request_add($1,$2,$3,$4,$5,$6,$7::text[],$8,$9,$10,$11,$12,$13,$14,$15)', [p.dev, p.name, p.phone, p.d, p.u, p.c, p.s, p.m, p.n, p.t, p.hp, p.pref, p.level, p.goal, p.trial]); };
  ok('a request with wishes is accepted', (await add2()) === null);
  const wr = (await q(`select * from public.tutor_requests where phone = '01877777771'`))[0];
  ok('the wishes are stored', wr.pref_gender === 'female' && wr.student_level === 'weak' && wr.goal === 'exam' && wr.want_trial === true, JSON.stringify(wr));
  for (const [code, over] of [['BAD_PREF', { dev: 'device-4002', phone: '01877777772', pref: 'alien' }], ['BAD_LEVEL', { dev: 'device-4003', phone: '01877777773', level: 'x' }], ['BAD_GOAL', { dev: 'device-4004', phone: '01877777774', goal: 'x' }]]) { const e = await add2(over); ok('refused: ' + code, e && e.includes(code), String(e)); }
  ok('blank wishes are fine', (await add2({ dev: 'device-4005', phone: '01877777775', pref: '', level: '', goal: '', trial: false, c: 'c11-12' })) === null);

  // the tutor side: the extras are saved, cleaned and shown only as designed
  await db.exec(`update public.tutor_profiles set edited = false where user_id = '${U1}'`);
  const EX = { medium: ['bangla', 'english_version', 'bogus'], exams: ['ssc', 'hsc', 'nonsense'], style: ['concept', 'fun'], trial: true, batch: 'both', days_max: 4, session_mins: 90, exp: 'y3_5', taught: 'n6_20', ssc_gpa: '৫.০০', hsc_gpa: '4.8', achv: 'ঢাবি ভর্তি পরীক্ষায় উত্তীর্ণ', fee_show: true, fee_note: 'মাসে ২০০০', pledge: ['guardian_first', 'open_place', 'hours'] };
  s = await save(U1, Object.assign({}, PROF, EX), true);
  ok('extras are saved, unknown keys dropped, the GPA written in clean digits', s.out && JSON.stringify(s.out.medium) === JSON.stringify(['bangla', 'english_version']) && JSON.stringify(s.out.exams) === JSON.stringify(['hsc', 'ssc']) && s.out.trial === true && s.out.batch === 'both' && s.out.days_max === 4 && s.out.session_mins === 90 && s.out.exp === 'y3_5' && s.out.taught === 'n6_20' && s.out.ssc_gpa === '5.00' && s.out.hsc_gpa === '4.8' && s.out.fee_show === true && s.out.pledge.length === 3, JSON.stringify(s));
  ok('my_profile hands the extras back to the tutor', s.out && ['medium', 'trial', 'pledge', 'fee_show', 'ssc_gpa'].every(k => k in s.out));
  rows = await S('বরিশাল', 'বরিশাল সদর', null, null, 'home', 12, 0);
  const t1 = rows[0];
  ok('the public search shows the extras', t1 && t1.trial === true && t1.exp === 'y3_5' && t1.taught === 'n6_20' && t1.ssc_gpa === '5.00' && t1.hsc_gpa === '4.8' && t1.batch === 'both' && t1.days_max === 4 && t1.session_mins === 90 && JSON.stringify(t1.medium) === JSON.stringify(['bangla', 'english_version']) && t1.achv === 'ঢাবি ভর্তি পরীক্ষায় উত্তীর্ণ' && t1.pledge_all === true, JSON.stringify(t1));
  ok('the fee shows when the tutor ticked "show my fee"', t1 && t1.fee === 'মাসে ২০০০');
  const cols2 = Object.keys(t1);
  ok('the search still never returns the phone, real name, area note, admin note, user id, nor the raw fee switch or promise list', !cols2.some(c => ['phone', 'full_name', 'fee_note', 'fee_show', 'pledge', 'admin_note', 'user_id', 'area_note'].includes(c)), cols2.join(','));
  s = await save(U1, Object.assign({}, PROF, EX, { fee_show: false }), true);
  ok('with the fee switch off the fee is not in the search', (await S('বরিশাল', 'বরিশাল সদর', null, null, 'home', 12, 0))[0].fee === '');
  s = await save(U1, Object.assign({}, PROF, EX, { fee_show: true, fee_note: '' }), true);
  ok('"show my fee" with no fee written switches itself off', s.out && s.out.fee_show === false, JSON.stringify(s));
  s = await save(U1, Object.assign({}, PROF, EX, { pledge: ['guardian_first', 'hours'] }), true);
  ok('two promises are not the badge (all three are)', (await S('বরিশাল', 'বরিশাল সদর', null, null, 'home', 12, 0))[0].pledge_all === false);
  s = await save(U1, Object.assign({}, PROF, { batch: 'x', days_max: 9, session_mins: 50, exp: 'forever', taught: 'many', pledge: ['x'], medium: ['x'] }), true);
  ok('out-of-list values become empty, not an error', s.out && s.out.batch === '' && s.out.days_max === 0 && s.out.session_mins === 0 && s.out.exp === '' && s.out.taught === '' && s.out.pledge.length === 0 && s.out.medium.length === 0, JSON.stringify(s));
  for (const [what, mut] of [['5.5', { ssc_gpa: '5.5' }], ['0.9', { ssc_gpa: '0.9' }], ['text', { hsc_gpa: 'abc' }], ['6', { hsc_gpa: '6' }]]) { const e = (await save(U1, Object.assign({}, PROF, mut), false)).err || ''; ok('a GPA of ' + what + ' is refused, even in a draft: BAD_GPA', e.includes('BAD_GPA'), e); }
  ok('empty GPAs are fine and a GPA of 5 or 1.00 is fine', (await save(U1, Object.assign({}, PROF, { ssc_gpa: '', hsc_gpa: '' }), false)).out && (await save(U1, Object.assign({}, PROF, { ssc_gpa: '5', hsc_gpa: '1.00' }), false)).out.ssc_gpa === '5');
  const eLink = (await save(U1, Object.assign({}, PROF, { achv: 'দেখুন www.example.com' }), false)).err || '';
  ok('a link in the achievement line is refused', eLink.includes('BAD_LINK'), eLink);
  await save(U1, Object.assign({}, PROF, EX), true);       // the baseline: the text the guardian reads is now what it is
  await db.exec(`update public.tutor_profiles set edited = false where user_id = '${U1}'`);
  await save(U1, Object.assign({}, PROF, EX, { trial: false, exp: 'new' }), true);
  ok('changing only a tick or a choice does not ask the admin to look again', (await q(`select edited from public.tutor_profiles where user_id = '${U1}'`))[0].edited === false);
  await save(U1, Object.assign({}, PROF, EX, { achv: 'আরেকটা অর্জন, এবার নতুন লিখলাম' }), true);
  ok('changing the achievement text does (it is free text the guardian reads)', (await q(`select edited from public.tutor_profiles where user_id = '${U1}'`))[0].edited === true);
  ok('the database itself refuses a bad GPA, batch or session even from a direct write', /check/i.test(String(await err(`update public.tutor_profiles set ssc_gpa = '7.0' where user_id = '${U1}'`))) && /check/i.test(String(await err(`update public.tutor_profiles set batch = 'x' where user_id = '${U1}'`))) && /check/i.test(String(await err(`update public.tutor_profiles set session_mins = 50 where user_id = '${U1}'`))));
  ok('after the upgrade the grants are the same: anon may search and send requests, anon may NOT save profiles', await can('x', `has_function_privilege('anon', 'public.tutor_search(text,text,text,text,text,int,int)', 'execute') and has_function_privilege('anon', 'public.tutor_request_add(text,text,text,text,text,text,text[],text,text,text,text,text,text,text,boolean)', 'execute') and not has_function_privilege('anon', 'public.tutor_profile_save(jsonb,boolean)', 'execute') and has_function_privilege('authenticated', 'public.tutor_profile_save(jsonb,boolean)', 'execute')`));

  // ================= the browse system (2026-12-20): filters, sorts and counts, run as an UPGRADE on top of everything above =================
  const SQL4 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-20_tutor_browse.sql'), 'utf8');
  let b1 = null; try { await db.exec(SQL4); } catch (e) { b1 = e.message; }
  ok('the browse migration runs on a database that already has tutors', b1 === null, String(b1));
  let b2 = null; try { await db.exec(SQL4); await db.exec(SQL4); await db.exec(SQL); await db.exec(SQL2); await db.exec(SQL3); await db.exec(SQL4); } catch (e) { b2 = e.message; }
  ok('and it can run twice, and all the files can be run again in order', b2 === null, String(b2));
  ok('exactly one tutor_search and one tutor_facets exist (the old 7-argument form is gone)', (await q(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'tutor_search'`))[0].n === 1 && (await q(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'tutor_facets'`))[0].n === 1);
  ok('the OLD page\'s 7-argument search call still works (the new arguments have defaults)', (await S('বরিশাল', 'বরিশাল সদর', null, null, 'home', 12, 0)).length >= 1);

  // five tutors with known attributes (the trigger that touches updated_at is paused so the order is under control)
  const U3 = '33333333-3333-3333-3333-333333333333', U4 = '44444444-4444-4444-4444-444444444444', U5 = '55555555-5555-5555-5555-555555555555', U6 = '66666666-6666-6666-6666-666666666666';
  const mk = (extra) => Object.assign({}, PROF, { display_name: 'x', age_ok: true, terms_ok: true }, extra);
  await save(U1, mk({ display_name: 'করিম ভাইয়া', gender: 'male', district: 'বরিশাল', upazila: 'বরিশাল সদর', modes: ['home', 'online'], classes: ['c6-8', 'c9-10'], subjects: ['math', 'physics'], medium: ['bangla'], exams: ['ssc'], trial: true, pledge: ['guardian_first', 'open_place', 'hours'], fee_note: '', fee_show: false, achv: '', ssc_gpa: '', hsc_gpa: '' }), true);
  await save(U3, mk({ full_name: 'নীলা আহমেদ', display_name: 'নীলা আপু', gender: 'female', phone: '01811111112', district: 'ঢাকা', upazila: 'ধানমন্ডি', modes: ['home'], classes: ['c9-10', 'c11-12'], subjects: ['math', 'physics'], medium: ['english_version'], exams: ['hsc', 'admission_eng'], trial: true, pledge: ['guardian_first', 'open_place', 'hours'] }), true);
  await save(U4, mk({ full_name: 'রাফি হাসান', display_name: 'রাফি ভাইয়া', gender: 'male', phone: '01811111113', district: 'বরিশাল', upazila: 'বরিশাল সদর', modes: ['home', 'online'], classes: ['c6-8'], subjects: ['english'], medium: ['bangla'], exams: ['ssc'], trial: false, pledge: [] }), true);
  await save(U5, mk({ full_name: 'মিম জাহান', display_name: 'মিম আপু', gender: 'female', phone: '01811111114', district: 'খুলনা', upazila: 'ডুমুরিয়া', modes: ['online'], classes: ['c1-5'], subjects: ['math'], medium: ['bangla'], exams: [], trial: true, pledge: ['guardian_first', 'hours'] }), true);
  await save(U6, mk({ full_name: 'অপেক্ষায় আছেন', display_name: 'অপেক্ষা', phone: '01811111115' }), true);        // submitted, never approved
  await db.exec(`alter table public.tutor_profiles disable trigger tutor_profiles_touch`);
  await db.exec(`update public.tutor_profiles set status = 'approved', verify = 'verified', approved_at = '2026-03-01', updated_at = '2026-05-01' where user_id = '${U1}'`);
  await db.exec(`update public.tutor_profiles set status = 'approved', verify = 'none', approved_at = '2026-01-01', updated_at = '2026-05-02' where user_id = '${U3}'`);
  await db.exec(`update public.tutor_profiles set status = 'approved', verify = 'none', approved_at = '2026-04-01', updated_at = '2026-05-03' where user_id = '${U4}'`);
  await db.exec(`update public.tutor_profiles set status = 'approved', verify = 'none', approved_at = '2026-02-01', updated_at = '2026-05-04' where user_id = '${U5}'`);
  await db.exec(`update public.tutor_profiles set status = 'submitted' where user_id in ('${U6}', '${U2}')`);
  await db.exec(`alter table public.tutor_profiles enable trigger tutor_profiles_touch`);
  await db.exec(`update public.tutor_settings set public_listing = true`);
  const SB = (o) => q('select * from public.tutor_search(' + Object.keys(o).map((k, i) => k + ' => $' + (i + 1)).join(', ') + ')', Object.values(o));
  const names = (rs) => rs.map(r => r.name).join(',');
  ok('with the list on there are four tutors (the submitted ones are never shown)', (await SB({ p_limit: 30 })).length === 4 && Number((await SB({ p_limit: 1 }))[0].total) === 4);
  ok('filter: who teaches (apu / bhaiya)', names(await SB({ p_gender: 'female', p_limit: 30 })).split(',').sort().join() === 'নীলা আপু,মিম আপু' && names(await SB({ p_gender: 'male', p_limit: 30 })).split(',').sort().join() === 'করিম ভাইয়া,রাফি ভাইয়া');
  ok('filter: medium and exam focus', names(await SB({ p_medium: 'english_version', p_limit: 30 })) === 'নীলা আপু' && (await SB({ p_medium: 'bangla', p_limit: 30 })).length === 3 && (await SB({ p_exam: 'ssc', p_limit: 30 })).length === 2 && names(await SB({ p_exam: 'hsc', p_limit: 30 })) === 'নীলা আপু' && (await SB({ p_exam: 'ielts', p_limit: 30 })).length === 0);
  ok('filter: free trial, verified only, three promises', (await SB({ p_trial: true, p_limit: 30 })).length === 3 && names(await SB({ p_verified: true, p_limit: 30 })) === 'করিম ভাইয়া' && (await SB({ p_pledge: true, p_limit: 30 })).length === 2);
  ok('filters combine (and a false flag is no filter)', names(await SB({ p_gender: 'female', p_trial: true, p_pledge: true, p_limit: 30 })) === 'নীলা আপু' && (await SB({ p_trial: false, p_verified: false, p_pledge: false, p_limit: 30 })).length === 4);
  ok('a filter value that does not exist is no error, only an empty answer; an unknown sort is the default one', (await SB({ p_gender: 'alien', p_limit: 30 })).length === 0 && names(await SB({ p_sort: 'zzz', p_district: 'ঢাকা', p_upazila: 'ধানমন্ডি', p_limit: 30 })) === names(await SB({ p_district: 'ঢাকা', p_upazila: 'ধানমন্ডি', p_limit: 30 })));
  const dhaka = { p_district: 'ঢাকা', p_upazila: 'ধানমন্ডি', p_limit: 30 }, barisal = { p_district: 'বরিশাল', p_upazila: 'বরিশাল সদর', p_limit: 30 };
  ok('sort best: the area first, then verified, then recently active', names(await SB(Object.assign({ p_sort: 'best' }, dhaka))) === 'নীলা আপু,করিম ভাইয়া,মিম আপু,রাফি ভাইয়া' && names(await SB(barisal)) === 'করিম ভাইয়া,রাফি ভাইয়া,মিম আপু', names(await SB(Object.assign({ p_sort: 'best' }, dhaka))));
  ok('sort verified: the verified tutor first even when from elsewhere, then the area', names(await SB(Object.assign({ p_sort: 'verified' }, dhaka))) === 'করিম ভাইয়া,নীলা আপু,মিম আপু,রাফি ভাইয়া', names(await SB(Object.assign({ p_sort: 'verified' }, dhaka))));
  ok('sort new: the area first, then who joined last', names(await SB(Object.assign({ p_sort: 'new' }, dhaka))) === 'নীলা আপু,রাফি ভাইয়া,করিম ভাইয়া,মিম আপু' && names(await SB(Object.assign({ p_sort: 'new' }, barisal))) === 'রাফি ভাইয়া,করিম ভাইয়া,মিম আপু', names(await SB(Object.assign({ p_sort: 'new' }, barisal))));
  const pages = []; for (const o of [0, 1, 2, 3]) pages.push(...(await SB({ p_limit: 1, p_offset: o })).map(r => r.pid));
  ok('paging is stable: one by one gives every tutor once', new Set(pages).size === 4 && pages.length === 4, pages.join());
  const F = async (d, u, m) => (await q('select public.tutor_facets($1,$2,$3) as f', [d, u, m]))[0].f;
  let f1 = await F('বরিশাল', 'বরিশাল সদর', null);
  ok('facets for Barisal Sadar: total, modes, classes, subjects', f1.total === 3 && f1.modes.home === 2 && f1.modes.online === 3 && f1.classes['c6-8'] === 2 && f1.classes['c9-10'] === 1 && f1.classes['c1-5'] === 1 && !('c11-12' in f1.classes) && f1.subjects.math === 2 && f1.subjects.physics === 1 && f1.subjects.english === 1, JSON.stringify(f1));
  ok('facets: gender, medium, exams, trial, verified, three promises', f1.gender.male === 2 && f1.gender.female === 1 && f1.medium.bangla === 3 && f1.exams.ssc === 2 && f1.trial === 2 && f1.verified === 1 && f1.pledge === 1, JSON.stringify(f1));
  const f2 = await F('ঢাকা', 'ধানমন্ডি', 'home');
  ok('facets follow the mode: Dhanmondi at home is only the one tutor who teaches there', f2.total === 1 && f2.modes.home === 1 && f2.classes['c11-12'] === 1 && f2.medium.english_version === 1, JSON.stringify(f2));
  ok('facets give only counts: the keys are fixed and no name, number or id appears', Object.keys(f1).sort().join() === 'classes,exams,gender,medium,modes,pledge,subjects,total,trial,verified' && !/করিম|নীলা|0181|01711|[0-9a-f]{12}/.test(JSON.stringify(f1)), JSON.stringify(f1));
  await db.exec(`update public.tutor_settings set public_listing = false`);
  const f0 = await F(null, null, null);
  ok('with the list off the facets are all zero (nothing is revealed) and the search is empty', f0.total === 0 && Object.keys(f0.classes).length === 0 && f0.trial === 0 && (await SB({ p_limit: 30 })).length === 0, JSON.stringify(f0));
  await db.exec(`update public.tutor_settings set public_listing = true`);
  ok('anon may call the new search and the facets, and still not the profile functions', await can('x', `has_function_privilege('anon', 'public.tutor_search(text,text,text,text,text,int,int,text,text,text,boolean,boolean,boolean,text)', 'execute') and has_function_privilege('anon', 'public.tutor_facets(text,text,text)', 'execute') and not has_function_privilege('anon', 'public.tutor_profile_save(jsonb,boolean)', 'execute') and not has_function_privilege('anon', 'public.tutor_my_profile()', 'execute')`));
  const cols3 = Object.keys((await SB({ p_limit: 1 }))[0]);
  ok('the search still returns the same columns and never the phone, real name, area note, admin note, user id, fee switch or promise list', ['pid', 'name', 'gender', 'trial', 'pledge_all', 'fee', 'total', 'local'].every(c => cols3.includes(c)) && !cols3.some(c => ['phone', 'full_name', 'fee_note', 'fee_show', 'pledge', 'admin_note', 'user_id', 'area_note'].includes(c)), cols3.join());

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
