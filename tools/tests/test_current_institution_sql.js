// Runs migrations/2027-01-07_current_institution.sql (after the whole batch stack and 2027-01-06, with people already in batches) in a real Postgres engine (PGlite) and exercises it.
//   one-time setup (nothing is added to the project):  npm install --prefix %TEMP%\pglite @electric-sql/pglite
//   run:  set PGLITE_DIR=%TEMP%\pglite   then   node tools/tests/test_current_institution_sql.js          (without the engine it says so and stops, it does not fail)
const fs = require('fs'), path = require('path');
let PGlite;
try { ({ PGlite } = require(process.env.PGLITE_DIR ? path.join(process.env.PGLITE_DIR, 'node_modules', '@electric-sql', 'pglite') : '@electric-sql/pglite')); }
catch (e) { console.log('skipped: the PGlite engine is not installed (see the two lines at the top of this file).'); process.exit(0); }
const SQL = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-26_batches.sql'), 'utf8');
const SQL2 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-27_batch_name.sql'), 'utf8');
const SQL3 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-28_batch_roster_admin.sql'), 'utf8');
const SQL4 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-29_batch_my_invites.sql'), 'utf8');
const SQL5 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-30_batch_photos.sql'), 'utf8');
const SQL6 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-31_batch_chat.sql'), 'utf8');
const SQL7 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2027-01-06_my_institution.sql'), 'utf8');
const SQL8 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2027-01-07_current_institution.sql'), 'utf8');
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
  await db.exec(SQL6); await db.exec(SQL6);                 // the room, also safe to run twice
  const as = async (n, fn) => { await db.exec(`select set_config('test.uid', '${n ? U(n) : ''}', false)`); return fn(); };
  const call = async (n, sql, params) => as(n, async () => { try { return (await db.query(sql, params)).rows[0].r; } catch (e) { return { thrown: e.message }; } });
  const lookup = (n, slug, lv, y) => call(n, 'select public.batch_lookup($1,$2,$3) as r', [slug, lv, y]);
  const claim = (n, slug, lv, y, line, theme) => call(n, 'select public.batch_claim($1,$2,$3,$4,$5) as r', [slug, lv, y, line === undefined ? null : line, theme || 'blue']);
  const join = (n, id, ref) => call(n, 'select public.batch_join($1,$2) as r', [id, ref || null]);
  const rows = async sql => (await db.query(sql)).rows;

  const guard = async (role, uid, sql) => { await db.exec("select set_config('test.uid', '" + (uid ? U(uid) : '') + "', false)"); await db.exec('set role ' + role); try { return (await db.query(sql)).rows; } catch (e) { return 'denied'; } finally { await db.exec('reset role'); } };

  await db.exec("insert into public.listing_submissions values ('viqar', 'ভিকারুননিসা', 'ঢাকা', 'মতিঝিল', 'স্কুল', 'approved', false)");
  let r;
  const mj = (n, slug, lv, y, st, ref) => call(n, 'select public.member_join_batch($1,$2,$3,$4,$5) as r', [slug, lv, y, st === undefined ? 'studied' : st, ref || null]);
  const cnt = async slug => { const r = await db.query('select * from public.institution_members($1)', [[slug]]); return r.rows.length ? r.rows[0].members : 0; };

  const Y = new Date().getFullYear();
  const setI = (n, slug, st) => call(n, 'select public.member_set_institution($1,$2) as r', [slug, st === undefined ? 'studying' : st]);
  const meI = n => call(n, 'select public.member_institution_me() as r');
  const countRow = async slug => { const x = await rows("select members from public.institution_member_counts where slug = '" + slug + "'"); return x.length ? x[0].members : 0; };

  // ---- people who were in batches BEFORE this migration (2027-01-06 is run, 2027-01-07 is not yet)
  await db.exec(SQL7);
  await mj(1, 'dhaka-college', 'ssc', 2018, 'studying');          // opens it: "studying"
  await mj(2, 'dhaka-college', 'ssc', 2018, 'studied');           // joins it: "studied"
  await mj(3, 'dhaka-college', 'hsc', 2020, 'studying');          // an HSC batch of the earlier (wider) version: it must stay readable
  ok('before: three people are counted at dhaka-college', (await cnt('dhaka-college')) === 3);
  await db.exec(SQL8); await db.exec(SQL8);                        // the new migration, also safe to run twice

  // ---- the backfill: "studying" said in a batch is the current institution; "studied" is not guessed
  r = await meI(1);
  ok('the backfill: a member who said studying in a batch has that institution as the current one, with its name and type', r.slug === 'dhaka-college' && r.status === 'studying' && r.name === 'ঢাকা কলেজ' && r.type === 'কলেজ', JSON.stringify(r));
  ok('the backfill: a member who said studied gets nothing guessed', JSON.stringify(await meI(2)) === '{}');
  ok('the counter still counts a person once (one batch + one current institution at the same place is still one person)', (await cnt('dhaka-college')) === 3 && (await countRow('dhaka-college')) === 3);

  // ---- the batch is SSC only again, the year goes up to now + 6
  const lv = (await db.query("select public.batch_level_ok('ssc') a, public.batch_level_ok('psc') b, public.batch_level_ok('jsc') c, public.batch_level_ok('hsc') d, public.batch_level_ok('bachelor') e, public.batch_level_ok('dakhil') f")).rows[0];
  ok('only the SSC level can have a batch (primary, JSC, HSC, degree are closed again)', lv.a === true && !lv.b && !lv.c && !lv.d && !lv.e && !lv.f);
  ok('a batch of another level is refused when someone tries to open or join one', (await mj(5, 'dhaka-college', 'hsc', 2021)).error === 'BAD_BATCH' && (await mj(5, 'dhaka-college', 'bachelor', 2021)).error === 'BAD_BATCH');
  ok('the batch that already exists at an older level stays readable (nothing is deleted)', (await call(0, "select public.institution_batches('dhaka-college') as r")).some(x => x.level === 'hsc' && x.year === 2020));
  const yr = (await db.query('select public.batch_year_ok($1) a, public.batch_year_ok($2) b, public.batch_year_ok($3) c, public.batch_year_ok($4) d, public.batch_year_ok($5) e', [Y + 6, Y + 7, 1970, 1969, null])).rows[0];
  ok('the SSC year may be up to now + 6 (a student who is still at school), not further, not before 1970', yr.a === true && yr.b === false && yr.c === true && yr.d === false && yr.e === false);
  r = await mj(7, 'dhaka-college', 'ssc', Y + 3, 'studying');
  ok('a school student opens the batch of the year they will sit SSC', r.ok === true && r.created === true && r.seq === 1, JSON.stringify(r));

  // ---- choosing the current institution
  ok('a signed-out visitor and anon cannot call any of the three functions', (await guard('anon', 0, "select public.member_set_institution('viqar','studying')")) === 'denied' && (await guard('anon', 0, 'select public.member_clear_institution()')) === 'denied' && (await guard('anon', 0, 'select public.member_institution_me()')) === 'denied');
  ok('signed out (no uid) the answer is NOT_SIGNED_IN, and {} for the read', (await setI(0, 'viqar')).error === 'NOT_SIGNED_IN' && (await call(0, 'select public.member_clear_institution() as r')).error === 'NOT_SIGNED_IN' && JSON.stringify(await meI(0)) === '{}');
  ok('a bad status and an institution that is hidden, pending or unknown are refused', (await setI(5, 'viqar', 'teacher')).error === 'BAD_STATUS' && (await setI(5, 'hidden-school')).error === 'NO_INSTITUTION' && (await setI(5, 'pending-school')).error === 'NO_INSTITUTION' && (await setI(5, 'nope')).error === 'NO_INSTITUTION');
  r = await setI(5, 'viqar', 'studying');
  ok('a member sets the current institution: the answer carries the count, the counter rises', r.ok === true && r.slug === 'viqar' && r.institution_members === 1 && (await cnt('viqar')) === 1, JSON.stringify(r));
  r = await setI(5, 'viqar', 'studied');
  ok('changing only the status changes nothing in the count', r.ok === true && (await meI(5)).status === 'studied' && (await cnt('viqar')) === 1);
  r = await setI(5, 'dhaka-college', 'studying');
  ok('moving to another institution moves the person: the old count goes down, the new one up', r.ok === true && (await cnt('viqar')) === 0 && (await cnt('dhaka-college')) === 5, JSON.stringify(r));
  ok('there is only ever one current institution per member (the table holds one row each)', (await rows("select count(*)::int as n from public.member_institution where user_id = '" + U(5) + "'"))[0].n === 1);

  // ---- a person counted once across both links
  await mj(6, 'viqar', 'ssc', 2018, 'studied');
  ok('a member who joins a batch at an institution is counted there', (await cnt('viqar')) === 1);
  await setI(6, 'viqar', 'studying');
  ok('the same person also choosing it as the current institution is still ONE person', (await cnt('viqar')) === 1 && (await countRow('viqar')) === 1);
  await call(6, 'select public.member_clear_institution() as r');
  ok('taking the current institution away keeps the person counted while the batch remains', (await cnt('viqar')) === 1);
  await setI(6, 'viqar', 'studying');
  await call(6, 'select public.batch_leave($1) as r', [(await rows("select id from public.batches where institution_slug = 'viqar'"))[0].id]);
  ok('leaving the batch keeps the person counted while the current institution remains', (await cnt('viqar')) === 1);
  await call(6, 'select public.member_clear_institution() as r');
  ok('with neither link left the person is out of the count', (await cnt('viqar')) === 0);
  await call(6, 'select public.member_clear_institution() as r'); await call(6, 'select public.member_clear_institution() as r');
  ok('clearing again changes nothing and the counter never goes below zero', (await countRow('viqar')) === 0 && JSON.stringify(await meI(6)) === '{}');

  // ---- a person at two institutions through the two links
  await setI(1, 'viqar', 'studying');       // user 1 was current at dhaka-college (the backfill) and has the batch there
  ok('a member who has the batch at one institution and the current at another is counted at both', (await cnt('viqar')) === 1 && (await cnt('dhaka-college')) === 5);
  await call(5, 'select public.member_clear_institution() as r');
  ok('a member who only had the current institution leaves the count when it is cleared', (await cnt('dhaka-college')) === 4);

  // ---- who can read what
  ok('the table is closed to anon and to signed-in members, everything goes through the functions', (await guard('anon', 0, 'select * from public.member_institution')) === 'denied' && (await guard('authenticated', 1, 'select * from public.member_institution')) === 'denied' && (await guard('authenticated', 1, "insert into public.member_institution (user_id, institution_slug) values ('" + U(1) + "', 'viqar')")) === 'denied');
  ok('a member reads only their own current institution (the read has no argument)', (await meI(1)).slug === 'viqar' && (await meI(2)).slug === undefined);
  ok('the earlier public reads still work for anon, and the batch page calls keep working', Array.isArray(await guard('anon', 0, "select * from public.institution_members(array['dhaka-college'])")) && (await lookup(0, 'dhaka-college', 'ssc', 2018)).ok === true && (await call(2, 'select public.batch_me() as r')).length === 1);
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });
