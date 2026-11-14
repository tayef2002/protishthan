// Runs migrations/2026-12-26_batches.sql in a real Postgres engine (PGlite) with stand-ins for the parts of Supabase it relies on, then exercises every function.
//   one-time setup (nothing is added to the project):  npm install --prefix %TEMP%\pglite @electric-sql/pglite
//   run:  set PGLITE_DIR=%TEMP%\pglite   then   node tools/tests/test_batches_sql.js          (without the engine it says so and stops, it does not fail)
const fs = require('fs'), path = require('path');
let PGlite;
try { ({ PGlite } = require(process.env.PGLITE_DIR ? path.join(process.env.PGLITE_DIR, 'node_modules', '@electric-sql', 'pglite') : '@electric-sql/pglite')); }
catch (e) { console.log('skipped: the PGlite engine is not installed (see the two lines at the top of this file).'); process.exit(0); }
const SQL = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-26_batches.sql'), 'utf8');
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
    create table public.members (user_id uuid primary key references auth.users(id) on delete cascade, display_name text, avatar_url text, email text, created_at timestamptz default now(), last_seen timestamptz default now());
    create function public.ensure_member() returns public.members language plpgsql security definer as $$ declare me public.members; begin
      insert into auth.users (id) values (auth.uid()) on conflict do nothing;
      insert into public.members (user_id, display_name, email) values (auth.uid(), auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() ->> 'email') on conflict (user_id) do update set last_seen = now() returning * into me; return me; end $$;
  `);
  for (let i = 1; i <= 40; i++) await db.exec(`insert into auth.users (id) values ('${U(i)}')`);
  await db.exec(SQL);
  await db.exec(SQL);                                       // a second run changes nothing
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
  ok('the convener changes the line and the theme', (await call(1, `select public.batch_set_look($1, 'নতুন লাইন', 'teal') as r`, [BID])).ok === true && (await lookup(0, 'dhaka-college', 'ssc', 2018)).batch.theme === 'teal');
  ok('an ordinary member cannot: NOT_ALLOWED; a bad line is refused', (await call(2, `select public.batch_set_look($1, 'x', 'teal') as r`, [BID])).error === 'NOT_ALLOWED' && (await call(1, `select public.batch_set_look($1, 'www.x.com', 'teal') as r`, [BID])).error === 'BAD_LINE');

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