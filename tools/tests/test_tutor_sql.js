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
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin', true) = '1' $$;
    create function public.skill_text_ok(t text) returns boolean language sql immutable as $$ select lower(t) !~ 'badword|খারাপশব্দ' $$;
  `);
  await db.exec(SQL);
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
  // run it twice: safe to run again
  let again = null; try { await db.exec(SQL); } catch (e) { again = e.message; }
  ok('the migration can run twice without an error', again === null, String(again));
  ok('and the settings row is still one row', (await q('select count(*)::int n from public.tutor_settings'))[0].n === 1);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
