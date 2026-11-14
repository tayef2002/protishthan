// Runs migrations/2026-12-26_batches.sql in a real Postgres engine (PGlite) with stand-ins for the parts of Supabase it relies on, then exercises every function.
//   one-time setup (nothing is added to the project):  npm install --prefix %TEMP%\pglite @electric-sql/pglite
//   run:  set PGLITE_DIR=%TEMP%\pglite   then   node tools/tests/test_batches_sql.js          (without the engine it says so and stops, it does not fail)
const fs = require('fs'), path = require('path');
let PGlite;
try { ({ PGlite } = require(process.env.PGLITE_DIR ? path.join(process.env.PGLITE_DIR, 'node_modules', '@electric-sql', 'pglite') : '@electric-sql/pglite')); }
catch (e) { console.log('skipped: the PGlite engine is not installed (see the two lines at the top of this file).'); process.exit(0); }
const SQL = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-26_batches.sql'), 'utf8');
const SQL2 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-27_batch_name.sql'), 'utf8');
const SQL3 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-28_batch_roster_admin.sql'), 'utf8');
const SQL4 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-29_batch_my_invites.sql'), 'utf8');
const SQL5 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-30_batch_photos.sql'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); };
(async () => {
  const db = new PGlite();
  const U = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
  await db.exec(`
    create role anon; create role authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('test.uid', true) || '@x.com', 'user_metadata', jsonb_build_object('full_name', 'User ' || current_setting('test.uid', true))) $$;
    create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin', true) = '1' $$;
    create function public.skill_text_ok(t text) returns boolean language sql immutable as $$ select t is null or lower(t) !~ 'badword|খারাপশব্দ' $$;
    create table public.listing_submissions (desired_slug text, institution_name text, district text, upazila text, institution_type text, status text, is_hidden boolean);
    insert into public.listing_submissions values ('dhaka-college', 'ঢাকা কলেজ', 'ঢাকা', 'ধানমন্ডি', 'কলেজ', 'approved', false), ('hidden-school', 'গোপন স্কুল', 'ঢাকা', 'x', 'স্কুল', 'approved', true), ('pending-school', 'অপেক্ষার স্কুল', 'ঢাকা', 'x', 'স্কুল', 'pending', false);
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid() primary key, bucket_id text, name text, owner uuid);
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
    create table public.members (user_id uuid primary key references auth.users(id) on delete cascade, display_name text, avatar_url text, email text, created_at timestamptz default now(), last_seen timestamptz default now());
    create function public.ensure_member() returns public.members language plpgsql security definer as $$ declare me public.members; begin
      insert into auth.users (id) values (auth.uid()) on conflict do nothing;
      insert into public.members (user_id, display_name, email) values (auth.uid(), auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() ->> 'email') on conflict (user_id) do update set last_seen = now() returning * into me; return me; end $$;
  `);
  for (let i = 1; i <= 40; i++) await db.exec(`insert into auth.users (id) values ('${U(i)}')`);
  await db.exec(SQL);
  await db.exec(SQL);                                       // a second run changes nothing
  await db.exec(SQL2); await db.exec(SQL2);                 // the name migration, also safe to run twice
  await db.exec(SQL3); await db.exec(SQL3);                 // the roster and admin migration, also safe to run twice
  await db.exec(SQL4); await db.exec(SQL4);                 // the invite counts, also safe to run twice
  await db.exec(SQL5); await db.exec(SQL5);                 // the pictures, also safe to run twice
  const as = async (n, fn) => { await db.exec(`select set_config('test.uid', '${n ? U(n) : ''}', false)`); return fn(); };
  const call = async (n, sql, params) => as(n, async () => { try { return (await db.query(sql, params)).rows[0].r; } catch (e) { return { thrown: e.message }; } });
  const lookup = (n, slug, lv, y) => call(n, 'select public.batch_lookup($1,$2,$3) as r', [slug, lv, y]);
  const claim = (n, slug, lv, y, line, theme) => call(n, 'select public.batch_claim($1,$2,$3,$4,$5) as r', [slug, lv, y, line === undefined ? null : line, theme || 'blue']);
  const join = (n, id, ref) => call(n, 'select public.batch_join($1,$2) as r', [id, ref || null]);
  const rows = async sql => (await db.query(sql)).rows;

  // ---- lookup
  let r = await lookup(0, 'dhaka-college', 'ssc', 2018);
  ok('lookup of a listed institution with no batch: ok, batch null, institution named', r.ok && r.batch === null && r.inst.name === 'ঢাকা কলেজ' && r.me === null, JSON.stringify(r));
  ok('lookup: unknown institution, pending institution and hidden institution are all NO_INSTITUTION', ['nope', 'pending-school', 'hidden-school'].every(async () => true) && (await lookup(0, 'nope', 'ssc', 2018)).error === 'NO_INSTITUTION' && (await lookup(0, 'pending-school', 'ssc', 2018)).error === 'NO_INSTITUTION' && (await lookup(0, 'hidden-school', 'ssc', 2018)).error === 'NO_INSTITUTION');
  ok('lookup: a level that does not exist, HSC (not opened yet), a year in the far future and a year before 1970 are BAD_BATCH', (await lookup(0, 'dhaka-college', 'primary', 2018)).error === 'BAD_BATCH' && (await lookup(0, 'dhaka-college', 'hsc', 2018)).error === 'BAD_BATCH' && (await claim(1, 'dhaka-college', 'hsc', 2018)).error === 'BAD_BATCH' && (await claim(1, 'dhaka-college', 'bachelor', 2018)).error === 'BAD_BATCH' && (await lookup(0, 'dhaka-college', 'ssc', 2999)).error === 'BAD_BATCH' && (await lookup(0, 'dhaka-college', 'ssc', 1950)).error === 'BAD_BATCH');

  ok('the level word is checked by one small function: only ssc passes for now (the table list stays wide so more levels can be opened by changing that function)', (await db.query("select public.batch_level_ok('ssc') as a").then(r => r.rows[0].a)) === true && (await db.query("select public.batch_level_ok('hsc') as a").then(r => r.rows[0].a)) === false && (await db.query("select public.batch_level_ok('dakhil') as a").then(r => r.rows[0].a)) === false);
  // ---- opening a batch
  ok('claim needs a sign-in: NOT_SIGNED_IN', (await claim(0, 'dhaka-college', 'ssc', 2018)).error === 'NOT_SIGNED_IN');
  r = await claim(1, 'dhaka-college', 'ssc', 2018, '  একই   গেট দিয়ে ঢুকেছিলাম  ', 'violet');
  ok('claim: the first member opens it, is the convener, number 1, and gets an invite code', r.ok && r.seq === 1 && r.role === 'convener' && /^[0-9a-f]{8}$/.test(r.ref), JSON.stringify(r));
  const BID = r.batch_id, REF1 = r.ref;
  ok('claim again for the same batch: EXISTS (the second person must join, not open a copy)', (await claim(2, 'dhaka-college', 'ssc', 2018)).error === 'EXISTS');
  r = await lookup(0, 'dhaka-college', 'ssc', 2018);
  ok('lookup now: 1 member, the convener first name only, the cleaned line, the theme', r.batch && r.batch.members === 1 && r.batch.convener === 'User' && r.batch.line === 'একই গেট দিয়ে ঢুকেছিলাম' && r.batch.theme === 'violet', JSON.stringify(r));
  ok('lookup leaks no user id, e-mail or code', !/00000000-0000|@x\.com|[0-9a-f]{8}/.test(JSON.stringify(r).replace(BID, '')) , JSON.stringify(r));
  const bad = { url: 'দেখুন www.example.com', mail: 'a@b.com', phone: 'ফোন ০১৭১১২২৩৩৪৪', word: 'this is badword', long: 'ক'.repeat(121), http: 'https://x.y' };
  for (const k of Object.keys(bad)) ok('claim refuses a bad line: ' + k, (await claim(3, 'dhaka-college', 'ssc', 2016, bad[k])).error === 'BAD_LINE');
  ok('claim refuses an unknown theme', (await claim(3, 'dhaka-college', 'ssc', 2016, null, 'neon')).error === 'BAD_THEME');
  ok('claim refuses a level or a year that is not allowed, and an institution that is not listed', (await claim(3, 'dhaka-college', 'x', 2016)).error === 'BAD_BATCH' && (await claim(3, 'nope', 'ssc', 2016)).error === 'NO_INSTITUTION' && (await claim(3, 'hidden-school', 'ssc', 2016)).error === 'NO_INSTITUTION');
  for (const [i, y] of [2010, 2011, 2012].entries()) ok('one person can open three batches: ' + (i + 1), (await claim(4, 'dhaka-college', 'ssc', y)).ok === true);
  ok('a fourth batch by the same person: TOO_MANY', (await claim(4, 'dhaka-college', 'ssc', 2013)).error === 'TOO_MANY');

  // ---- joining
  r = await join(2, BID, REF1);
  ok('join: the next number (2), as a member', r.ok && r.seq === 2 && r.role === 'member', JSON.stringify(r));
  const inv = await rows(`select invited_by from public.batch_members where user_id = '${U(2)}' and batch_id = '${BID}'`);
  ok('the invite code of member 1 is recorded as the one who brought member 2', inv[0].invited_by === U(1), JSON.stringify(inv));
  r = await join(2, BID);
  ok('join twice: the same number comes back (again)', r.ok && r.again === true && r.seq === 2);
  r = await join(3, BID, 'zzzzzzzz');
  ok('an unknown invite code is ignored, the join still works (number 3)', r.ok && r.seq === 3 && (await rows(`select invited_by from public.batch_members where user_id = '${U(3)}'`))[0].invited_by === null);
  ok('a person cannot invite themselves', (await join(1, BID, REF1)).again === true);
  ok('join with no sign-in: NOT_SIGNED_IN; join a batch that does not exist: NO_BATCH', (await join(0, BID)).error === 'NOT_SIGNED_IN' && (await join(5, '99999999-9999-9999-9999-999999999999')).error === 'NO_BATCH');
  await db.exec(`update public.batches set status = 'locked' where id = '${BID}'`);
  ok('a locked batch cannot be joined: LOCKED (a member who is in already still gets in)', (await join(6, BID)).error === 'LOCKED' && (await join(2, BID)).again === true);
  await db.exec(`update public.batches set status = 'active' where id = '${BID}'`);

  // ---- my batches
  r = await call(2, 'select public.batch_me() as r');
  ok('batch_me lists my batch with my number, the count and the institution name', Array.isArray(r) && r.length === 1 && r[0].seq === 2 && r[0].members === 3 && r[0].name === 'ঢাকা কলেজ' && r[0].level === 'ssc' && r[0].year === 2018, JSON.stringify(r));
  ok('batch_me is empty when not signed in', (await call(0, 'select public.batch_me() as r')).length === 0);

  // ---- the look
  ok('the convener changes the line and the theme', (await call(1, `select public.batch_set_look($1, null, 'নতুন লাইন', 'teal') as r`, [BID])).ok === true && (await lookup(0, 'dhaka-college', 'ssc', 2018)).batch.theme === 'teal');
  ok('an ordinary member cannot: NOT_ALLOWED; a bad line is refused', (await call(2, `select public.batch_set_look($1, null, 'x', 'teal') as r`, [BID])).error === 'NOT_ALLOWED' && (await call(1, `select public.batch_set_look($1, null, 'www.x.com', 'teal') as r`, [BID])).error === 'BAD_LINE');

  // ---- the batch name (2026-12-27)
  ok('a batch opened with no name has name null in lookup and in my list', (await lookup(0, 'dhaka-college', 'ssc', 2018)).batch.name === null && (await call(2, 'select public.batch_me() as r'))[0].bname === null);
  ok('the convener sets the name; lookup and my list show it, with the line and colour', (await call(1, `select public.batch_set_look($1, '  Dhaka   Collegiyan 2018 ', 'লাইন', 'rose') as r`, [BID])).ok === true && (await lookup(0, 'dhaka-college', 'ssc', 2018)).batch.name === 'Dhaka Collegiyan 2018' && (await call(2, 'select public.batch_me() as r'))[0].bname === 'Dhaka Collegiyan 2018' && (await lookup(0, 'dhaka-college', 'ssc', 2018)).batch.theme === 'rose');
  const badN = { url: 'www.x.com', mail: 'a@b.com', phone: '০১৭১১২২৩৩৪৪', word: 'badword club', one: 'ক', long: 'ক'.repeat(41) };
  for (const k of Object.keys(badN)) ok('a bad name is refused: ' + k, (await call(1, `select public.batch_set_look($1, $2, null, 'blue') as r`, [BID, badN[k]])).error === 'BAD_NAME');
  ok('an ordinary member cannot set the name; saving with an empty name clears it', (await call(2, `select public.batch_set_look($1, 'Hack', null, 'blue') as r`, [BID])).error === 'NOT_ALLOWED' && (await call(1, `select public.batch_set_look($1, '', null, 'blue') as r`, [BID])).ok === true && (await lookup(0, 'dhaka-college', 'ssc', 2018)).batch.name === null);
  await call(1, `select public.batch_set_look($1, 'Dhaka Collegiyan 2018', null, 'blue') as r`, [BID]);
  ok('the old three-argument batch_set_look is gone (no overload to confuse a call)', (await db.query("select count(*)::int as n from pg_proc where proname = 'batch_set_look'")).rows[0].n === 1);

  // ---- leaving: numbers are never given twice
  ok('a member leaves, then a new person joins: the new number is 4, the old 3 is not reused', (await call(3, 'select public.batch_leave($1) as r', [BID])).ok === true && (await join(7, BID)).seq === 4);
  ok('leave by someone who is not in: NOT_MEMBER', (await call(9, 'select public.batch_leave($1) as r', [BID])).error === 'NOT_MEMBER');
  ok('the convener leaves: the earliest member (number 2) becomes the convener', (await call(1, 'select public.batch_leave($1) as r', [BID])).ok === true && (await rows(`select role from public.batch_members where user_id = '${U(2)}' and batch_id = '${BID}'`))[0].role === 'convener' && (await rows(`select convener_id from public.batches where id = '${BID}'`))[0].convener_id === U(2));
  await call(2, 'select public.batch_leave($1) as r', [BID]); await call(7, 'select public.batch_leave($1) as r', [BID]);
  ok('the last member leaves: the batch is removed, and it can be opened again', (await rows(`select 1 from public.batches where id = '${BID}'`)).length === 0 && (await claim(8, 'dhaka-college', 'ssc', 2018)).ok === true);

  // ---- a person can be in at most 12 batches
  await db.exec(`insert into public.listing_submissions values ('many-school', 'অনেক স্কুল', 'ঢাকা', 'x', 'স্কুল', 'approved', false)`);
  const ids = [];
  for (let i = 0; i < 13; i++) { const c = await claim(10 + Math.floor(i / 3), 'many-school', 'ssc', 2000 + i); if (c.ok) ids.push(c.batch_id); }
  let last = null, joined = 0;
  for (const id of ids) { last = await join(30, id); if (last.ok) joined++; }
  ok('twelve joins work and the thirteenth is TOO_MANY', joined === 12 && last.error === 'TOO_MANY', joined + ' ' + JSON.stringify(last));


  // ---- the member list, reports and the admin tools (2026-12-28)
  const adm = async v => db.exec(`select set_config('test.admin', '${v ? 1 : 0}', false)`);
  await adm(false);
  await db.exec(`update public.members set avatar_url = 'https://img.example/a.png' where user_id = '${U(20)}'`).catch(() => {});
  const nb = await claim(20, 'dhaka-college', 'ssc', 2005, 'লাইন', 'blue'); const NB = nb.batch_id;
  await call(1 + 20, 'select 1 as r'); await join(21, NB, nb.ref); await join(22, NB);
  r = await call(20, 'select public.batch_roster($1) as r', [NB]);
  ok('a member sees the list in number order with names, roles and who is me', r.ok && r.members.length === 3 && r.members.map(m => m.seq).join() === '1,2,3' && r.members[0].role === 'convener' && r.members[0].me === true && r.members[1].me === false && r.members.every(m => m.name.startsWith('User')), JSON.stringify(r));
  ok('the list leaks no e-mail, user id or invite code', !/email|user_id|ref_code|"ref"|@x\.com/.test(JSON.stringify(r)), JSON.stringify(r));
  ok('someone who is not in the batch gets NOT_MEMBER, a visitor NOT_SIGNED_IN', (await call(30, 'select public.batch_roster($1) as r', [NB])).error === 'NOT_MEMBER' && (await call(0, 'select public.batch_roster($1) as r', [NB])).error === 'NOT_SIGNED_IN');
  await adm(true); ok('an admin can read the list too', (await call(30, 'select public.batch_roster($1) as r', [NB])).ok === true); await adm(false);

  ok('a report needs a sign-in, a known reason and a batch that exists', (await call(0, `select public.batch_report($1, 'fake') as r`, [NB])).error === 'NOT_SIGNED_IN' && (await call(30, `select public.batch_report($1, 'spam') as r`, [NB])).error === 'BAD_REASON' && (await call(30, `select public.batch_report('99999999-9999-9999-9999-999999999999', 'fake') as r`)).error === 'NO_BATCH' && (await call(30, `select public.batch_report($1, 'fake', $2) as r`, [NB, 'ক'.repeat(201)])).error === 'BAD_NOTE');
  ok('a visitor can report once; reporting again replaces the first report (still one)', (await call(30, `select public.batch_report($1, 'fake', 'ভুয়া') as r`, [NB])).ok === true && (await call(30, `select public.batch_report($1, 'offensive') as r`, [NB])).ok === true && (await rows(`select count(*)::int n from public.batch_reports where batch_id = '${NB}'`))[0].n === 1);
  ok('one person can send at most 20 reports a day', await (async () => { const ids = []; for (let i = 0; i < 21; i++) { const c = await claim(31 + Math.floor(i / 3), 'many-school', 'ssc', 1971 + i); if (c.ok) ids.push(c.batch_id); } let last = null, okn = 0; for (const id of ids) { last = await call(39, `select public.batch_report($1, 'other') as r`, [id]); if (last.ok) okn++; } return okn === 20 && last.error === 'TOO_MANY' ? true : (console.log("  [debug] ids", ids.length, "ok", okn, JSON.stringify(last)), false); })());

  ok('the admin tools refuse everybody who is not an admin', (await call(20, 'select public.admin_batch_list() as r')).error === 'NOT_ALLOWED' && (await call(20, 'select public.admin_batch_detail($1) as r', [NB])).error === 'NOT_ALLOWED' && (await call(20, `select public.admin_batch_moderate($1, 'delete') as r`, [NB])).error === 'NOT_ALLOWED' && (await rows(`select 1 from public.batches where id = '${NB}'`)).length === 1);
  await adm(true);
  r = await call(30, 'select public.admin_batch_list($1, true) as r', ['Collegiyan']);
  ok('admin list: search by batch name works; no match gives an empty list', r.ok === true && Array.isArray(r.rows) && (await call(30, 'select public.admin_batch_list($1) as r', ['zzzz-no-such'])).rows.length === 0);
  r = await call(30, 'select public.admin_batch_list(null, true) as r');
  ok('admin list: only-reported shows the reported batch first with its report count', r.rows.length >= 1 && r.rows.some(x => x.id === NB && x.reports_new === 1 && x.members === 3 && x.inst === 'ঢাকা কলেজ' && /User/.test(x.convener) && /@x\.com/.test(x.convener)), JSON.stringify(r.rows.slice(0, 2)));
  r = await call(30, 'select public.admin_batch_detail($1) as r', [NB]);
  ok('admin detail: every member with e-mail and the report with its reason and reporter', r.ok && r.members.length === 3 && /@x\.com/.test(r.members[0].email) && r.reports.length === 1 && r.reports[0].reason === 'offensive' && /User/.test(r.reports[0].by), JSON.stringify(r));
  const mod = (a, s) => call(30, 'select public.admin_batch_moderate($1, $2, $3) as r', [NB, a, s === undefined ? null : s]);
  await call(1, `select 1 as r`); await call(20, `select public.batch_set_look($1, 'নামটা', 'খারাপ লাইন', 'blue') as r`, [NB]);
  ok('admin: clear_text removes the name and the line', (await mod('clear_text')).ok === true && (await lookup(0, 'dhaka-college', 'ssc', 2005)).batch.name === null && (await lookup(0, 'dhaka-college', 'ssc', 2005)).batch.line === null);
  ok('admin: lock stops a new member (LOCKED) and unlock lets them in again', (await mod('lock')).ok === true && (await join(23, NB)).error === 'LOCKED' && (await mod('unlock')).ok === true && (await join(23, NB)).ok === true);
  ok('admin: make_convener moves the role and the convener id; there is still exactly one convener', (await mod('make_convener', 2)).ok === true && (await rows(`select count(*)::int n from public.batch_members where batch_id = '${NB}' and role = 'convener'`))[0].n === 1 && (await rows(`select convener_id from public.batches where id = '${NB}'`))[0].convener_id === U(21) && (await mod('make_convener', 99)).error === 'NO_MEMBER');
  ok('admin: the convener cannot be removed while others remain (IS_CONVENER); another member can, and the number is not reused', (await mod('remove_member', 2)).error === 'IS_CONVENER' && (await mod('remove_member', 3)).ok === true && (await join(24, NB)).seq === 5);
  ok('admin: dismiss_reports marks them done (the count of new reports falls to 0)', (await mod('dismiss_reports')).ok === true && (await call(30, 'select public.admin_batch_list(null, true) as r')).rows.every(x => x.id !== NB));
  ok('admin: an unknown action is BAD_ACTION and a batch that is gone is NO_BATCH', (await mod('explode')).error === 'BAD_ACTION' && (await call(30, `select public.admin_batch_moderate('99999999-9999-9999-9999-999999999999', 'lock') as r`)).error === 'NO_BATCH');
  ok('admin: delete removes the batch with its members and reports, and the same batch can be opened again', (await mod('delete')).ok === true && (await rows(`select 1 from public.batches where id = '${NB}'`)).length === 0 && (await rows(`select 1 from public.batch_members where batch_id = '${NB}'`)).length === 0 && (await rows(`select 1 from public.batch_reports where batch_id = '${NB}'`)).length === 0 && (await claim(25, 'dhaka-college', 'ssc', 2005)).ok === true);
  const lg = await rows('select action from public.batch_admin_log order by id');
  ok('every admin action was written to the log', lg.length === 7 && lg.some(x => x.action === 'delete') && lg.some(x => x.action === 'clear_text'), JSON.stringify(lg.map(x => x.action)));
  await adm(false);
  ok('the new tables are closed to anon and to signed-in members', await (async () => { const g = async (role, tb) => { await db.exec(`set role ${role}`); try { await db.query('select * from public.' + tb); return 'open'; } catch (e) { return 'denied'; } finally { await db.exec('reset role'); } }; return (await g('anon', 'batch_reports')) === 'denied' && (await g('authenticated', 'batch_reports')) === 'denied' && (await g('authenticated', 'batch_admin_log')) === 'denied'; })());

  // ---- how many each member brought (2026-12-29)
  const inv0 = await claim(60, 'dhaka-college', 'ssc', 2001); const IB = inv0.batch_id; await join(61, IB, inv0.ref); await join(62, IB, inv0.ref); await join(63, IB);
  r = await call(60, 'select public.batch_my_invites() as r');
  ok('the convener brought two (the third joined without a code); the list has only their own batches', Array.isArray(r) && r.length === 1 && r[0].batch_id === IB && r[0].invited === 2, JSON.stringify(r));
  ok('a member who came through a code and invited nobody has 0; a visitor gets an empty list; no names or codes come back', (await call(61, 'select public.batch_my_invites() as r'))[0].invited === 0 && (await call(0, 'select public.batch_my_invites() as r')).length === 0 && !/name|email|ref|user/.test(JSON.stringify(r)), JSON.stringify(r));

  // ---- pictures and albums (2026-12-30)
  const pb = await claim(70, 'dhaka-college', 'ssc', 1999, 'লাইন', 'blue'); const PBID = pb.batch_id; await join(71, PBID); await join(72, PBID);
  const U2 = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
  const pid = () => (Math.random().toString(16) + '00000000').slice(2, 10) + '-aaaa-bbbb-cccc-' + (Math.random().toString(16) + '000000000000').slice(2, 14);
  const pPath = (b, id) => b + '/' + (id || pid()) + '.jpg';
  const add = (n, b, path, cat, w, h) => call(n, 'select public.batch_photo_add($1,$2,$3,$4,$5) as r', [b, path, cat || 'class', w === undefined ? 1600 : w, h === undefined ? 1066 : h]);
  const bk = (await rows("select * from storage.buckets where id = 'batch-photos'"))[0];
  ok('the bucket is private, 2 MB, JPEG only', bk && bk.public === false && Number(bk.file_size_limit) === 2097152 && bk.allowed_mime_types.join() === 'image/jpeg', JSON.stringify(bk));
  ok('three storage rules (read, write, remove), all for signed-in members', (await rows("select count(*)::int n from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'batch_photos_%'"))[0].n === 3);
  ok('adding needs a sign-in and a membership', (await add(0, PBID, pPath(PBID))).error === 'NOT_SIGNED_IN' && (await add(80, PBID, pPath(PBID))).error === 'NOT_MEMBER');
  ok('a bad category, a path of another batch, a path that is not a UUID.jpg, and a silly size are refused', (await add(71, PBID, pPath(PBID), 'party')).error === 'BAD_CATEGORY' && (await add(71, PBID, pPath(BID))).error === 'BAD_PATH' && (await add(71, PBID, PBID + '/x.jpg')).error === 'BAD_PATH' && (await add(71, PBID, PBID + '/' + pid() + '.png')).error === 'BAD_PATH' && (await add(71, PBID, pPath(PBID), 'class', 50, 50)).error === 'BAD_SIZE' && (await add(71, PBID, pPath(PBID), 'class', null, 600)).error === 'BAD_SIZE');
  const g1 = await add(71, PBID, pPath(PBID), 'group'); const g2 = await add(72, PBID, pPath(PBID), 'group');
  ok('the first group picture becomes the cover; a second one does not replace it', g1.ok === true && g2.ok === true && (await rows("select cover_photo_id from public.batches where id = '" + PBID + "'"))[0].cover_photo_id === g1.id);
  ok('the same path twice is BAD_PATH (it would be the same file)', await (async () => { const p = pPath(PBID); const a = await add(71, PBID, p); const b2 = await add(71, PBID, p); return a.ok === true && b2.error === 'BAD_PATH'; })());
  r = await call(72, 'select public.batch_photos($1) as r', [PBID]);
  ok('a member gets the list with the cover, who added each picture (first name only), and can_delete only for their own', r.ok && r.cover === g1.id && r.lead === false && r.photos.length === 3 && r.photos.every(p => p.by === 'User') && r.photos.find(p => p.id === g2.id).can_delete === true && r.photos.find(p => p.id === g1.id).can_delete === false && !/email|user_id/.test(JSON.stringify(r)), JSON.stringify(r).slice(0, 300));
  ok('the convener can delete any; the list says so', (await call(70, 'select public.batch_photos($1) as r', [PBID])).lead === true && (await call(70, 'select public.batch_photos($1) as r', [PBID])).photos.every(p => p.can_delete === true));
  ok('a visitor gets NOT_SIGNED_IN, a stranger NOT_MEMBER, an admin the list', (await call(0, 'select public.batch_photos($1) as r', [PBID])).error === 'NOT_SIGNED_IN' && (await call(80, 'select public.batch_photos($1) as r', [PBID])).error === 'NOT_MEMBER' && await (async () => { await adm(true); const x = await call(80, 'select public.batch_photos($1) as r', [PBID]); await adm(false); return x.ok === true; })());
  r = await lookup(0, 'dhaka-college', 'ssc', 1999);
  ok('the public page learns only the number of pictures, no path and no id', r.batch.photos === 3 && !/batch-photos|\.jpg|"cover"/.test(JSON.stringify(r)), JSON.stringify(r));
  ok('a member can add 12 and not the 13th (TOO_MANY_MINE)', await (async () => { let last = null, oks = 0; for (let i = 0; i < 14; i++) { last = await add(72, PBID, pPath(PBID)); if (last.ok) oks++; } return oks === 11 && last.error === 'TOO_MANY_MINE'; })());
  ok('a batch holds 80 pictures, then FULL', await (async () => { await db.exec("insert into public.batch_photos (batch_id, uploader_id, path, category, w, h) select '" + PBID + "', '" + U2(71) + "', '" + PBID + "/' || gen_random_uuid() || '.jpg', 'other', 800, 600 from generate_series(1, 80 - (select count(*) from public.batch_photos where batch_id = '" + PBID + "'))"); return (await add(70, PBID, pPath(PBID))).error === 'FULL'; })());
  ok('a stranger cannot delete (NOT_ALLOWED); the one who added it can; the convener can; the path comes back so the page can remove the files', (await call(80, 'select public.batch_photo_delete($1) as r', [g2.id])).error === 'NOT_ALLOWED' && (await call(71, 'select public.batch_photo_delete($1) as r', [g2.id])).error === 'NOT_ALLOWED' && (await call(72, 'select public.batch_photo_delete($1) as r', [g2.id])).path.endsWith('.jpg') && (await call(70, 'select public.batch_photo_delete($1) as r', [g1.id])).ok === true && (await call(70, 'select public.batch_photo_delete($1) as r', [g1.id])).error === 'NO_PHOTO');
  ok('deleting the cover clears it (it is not left pointing at nothing)', (await rows("select cover_photo_id from public.batches where id = '" + PBID + "'"))[0].cover_photo_id === null);
  const g3 = await call(71, 'select public.batch_photos($1) as r', [PBID]); const keep = g3.photos[0].id;
  ok('only a convener sets the cover', (await call(71, 'select public.batch_photo_set_cover($1) as r', [keep])).error === 'NOT_ALLOWED' && (await call(70, 'select public.batch_photo_set_cover($1) as r', [keep])).ok === true && (await rows("select cover_photo_id from public.batches where id = '" + PBID + "'"))[0].cover_photo_id === keep);
  ok('a member reports a picture (once, a second report replaces it); a stranger and a bad reason are refused', (await call(71, "select public.batch_photo_report($1, 'private') as r", [keep])).ok === true && (await call(71, "select public.batch_photo_report($1, 'offensive') as r", [keep])).ok === true && (await rows("select count(*)::int n from public.batch_photo_reports where photo_id = '" + keep + "'"))[0].n === 1 && (await call(80, "select public.batch_photo_report($1, 'other') as r", [keep])).error === 'NOT_MEMBER' && (await call(71, "select public.batch_photo_report($1, 'spam') as r", [keep])).error === 'BAD_REASON');
  await adm(true);
  r = await call(80, 'select public.admin_batch_list(null, true) as r');
  ok('admin: a picture report makes the batch show up under "reported", with the picture count', r.rows.some(x => x.id === PBID && x.reports_new >= 1 && x.photos >= 1), JSON.stringify(r.rows.slice(0, 1)));
  r = await call(80, 'select public.admin_batch_detail($1) as r', [PBID]);
  ok('admin detail lists the pictures with the uploader and the number of new reports', r.photos.length >= 1 && r.photos.some(p => p.id === keep && p.reports === 1) && r.photos.every(p => /User/.test(p.by) && p.path.startsWith(PBID + '/')));
  ok('admin: "reports handled" also closes the picture reports; an admin can delete a picture', (await call(80, "select public.admin_batch_moderate($1, 'dismiss_reports') as r", [PBID])).ok === true && (await rows("select count(*)::int n from public.batch_photo_reports where status = 'new'"))[0].n === 0 && (await call(80, 'select public.batch_photo_delete($1) as r', [keep])).ok === true);
  await adm(false);
  ok('deleting a batch removes its picture rows too', await (async () => { await adm(true); const n0 = (await rows("select count(*)::int n from public.batch_photos where batch_id = '" + PBID + "'"))[0].n; const d = await call(80, "select public.admin_batch_moderate($1, 'delete') as r", [PBID]); await adm(false); return n0 > 0 && d.ok === true && (await rows("select count(*)::int n from public.batch_photos where batch_id = '" + PBID + "'"))[0].n === 0; })());
  ok('the picture tables are closed to anon and signed-in members', await (async () => { const g = async (role, tb) => { await db.exec('set role ' + role); try { await db.query('select * from public.' + tb); return 'open'; } catch (e) { return 'denied'; } finally { await db.exec('reset role'); } }; return (await g('anon', 'batch_photos')) === 'denied' && (await g('authenticated', 'batch_photos')) === 'denied' && (await g('authenticated', 'batch_photo_reports')) === 'denied'; })());

  // ---- the tables are closed
  const guard = async (role, uid, sql) => { await db.exec(`select set_config('test.uid', '${uid ? U(uid) : ''}', false)`); await db.exec(`set role ${role}`); try { return (await db.query(sql)).rows; } catch (e) { return 'denied'; } finally { await db.exec('reset role'); } };
  ok('anon cannot read either table', (await guard('anon', 0, 'select * from public.batches')) === 'denied' && (await guard('anon', 0, 'select * from public.batch_members')) === 'denied');
  const own = await guard('authenticated', 8, 'select user_id from public.batch_members');
  ok('a signed-in member sees only their own membership rows, never the others', Array.isArray(own) && own.length === 1 && own.every(x => x.user_id === U(8)), JSON.stringify(own));
  ok('nobody can write a table directly', (await guard('authenticated', 8, `insert into public.batches (institution_slug, level, exam_year) values ('x','ssc',2018)`)) === 'denied' && (await guard('authenticated', 8, `update public.batch_members set seq = 99`)) === 'denied');
  await db.exec(`select set_config('test.admin', '1', false)`);
  ok('an admin can read every batch', Array.isArray(await guard('authenticated', 8, 'select * from public.batches')) && (await guard('authenticated', 8, 'select * from public.batches')).length >= 10);
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });