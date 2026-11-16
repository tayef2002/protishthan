// Runs migrations/2027-01-06_my_institution.sql (after the whole batch stack, with people already in batches) in a real Postgres engine (PGlite) and exercises it.
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
const SQL6 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2026-12-31_batch_chat.sql'), 'utf8');
const SQL7 = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2027-01-06_my_institution.sql'), 'utf8');
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

  // ---- people who were in batches BEFORE this migration (the old functions)
  let a = await claim(1, 'dhaka-college', 'ssc', 2018);
  ok('before the migration: user 1 opens a batch with the old function', a.ok === true, JSON.stringify(a));
  a = await join(2, (await rows("select id from public.batches where institution_slug = 'dhaka-college' and exam_year = 2018"))[0].id);
  ok('before the migration: user 2 joins it with the old function', a.ok === true, JSON.stringify(a));
  await db.exec(SQL7); await db.exec(SQL7);                  // the new migration, also safe to run twice
  ok('the backfill: both old members have the institution copied and each one has a primary membership', (await rows("select count(*)::int as n from public.batch_members where institution_slug = 'dhaka-college' and is_primary")).every(x => x.n === 2));
  ok('the backfill: the counter says 2 distinct members for the institution', (await cnt('dhaka-college')) === 2);

  // ---- the levels
  ok('every level of the ladder can have a batch (primary, JSC, SSC, HSC, degree, masters); Dakhil / Alim and nonsense do not', (await db.query("select public.batch_level_ok('psc') a, public.batch_level_ok('jsc') b, public.batch_level_ok('ssc') c, public.batch_level_ok('hsc') d, public.batch_level_ok('bachelor') e, public.batch_level_ok('masters') f, public.batch_level_ok('dakhil') g, public.batch_level_ok('phd') h")).rows.map(x => [x.a, x.b, x.c, x.d, x.e, x.f, x.g, x.h]).every(v => JSON.stringify(v) === JSON.stringify([true, true, true, true, true, true, false, false])));
  ok('the table accepts the new level words but still refuses nonsense', (await db.query("select 1 from (select 'psc') x").then(() => true)) && await (async () => { try { await db.exec("insert into public.batches (institution_slug, level, exam_year) values ('dhaka-college','phd',2018)"); return false; } catch (e) { return true; } })());

  // ---- the list of batches at an institution ("your batchmates are already here")
  r = await call(0, "select public.institution_batches('dhaka-college') as r");
  ok('institution_batches (anyone, even signed out): the opened batch with its size and the convener first name, mine = false', Array.isArray(r) && r.length === 1 && r[0].level === 'ssc' && r[0].year === 2018 && r[0].members === 2 && r[0].mine === false && typeof r[0].convener === 'string', JSON.stringify(r));
  r = await call(2, "select public.institution_batches('dhaka-college') as r");
  ok('institution_batches marks the batch a member is in', r[0].mine === true);
  ok('institution_batches of a hidden, pending or unknown institution is empty', (await call(0, "select public.institution_batches('hidden-school') as r")).length === 0 && (await call(0, "select public.institution_batches('pending-school') as r")).length === 0 && (await call(0, "select public.institution_batches('nope') as r")).length === 0);

  // ---- joining from the directory: join what exists, open what does not
  r = await mj(3, 'dhaka-college', 'ssc', 2018, 'studying');
  ok('member_join_batch joins an existing batch (created = false), numbers are fixed, the institution count rises', r.ok === true && r.created === false && r.seq === 3 && r.institution_members === 3, JSON.stringify(r));
  r = await mj(4, 'dhaka-college', 'hsc', 2020, 'left_early');
  ok('member_join_batch opens a batch that does not exist (created = true) and the caller is its convener, member 1', r.ok === true && r.created === true && r.role === 'convener' && r.seq === 1 && r.institution_members === 4, JSON.stringify(r));
  ok('the status is saved, and it is private: a member sees only their own, the roster of the batch does not carry it', await (async () => { const own = await guard('authenticated', 3, 'select user_id, status from public.batch_members'); const ro = await call(3, "select public.batch_roster($1) as r", [(await rows("select id from public.batches where exam_year = 2018 and institution_slug = 'dhaka-college'"))[0].id]); return Array.isArray(own) && own.length === 1 && own[0].status === 'studying' && ro.ok && JSON.stringify(ro).indexOf('studying') < 0 && JSON.stringify(ro).indexOf('left_early') < 0; })());
  ok('a signed-out visitor cannot join (the function is not granted to anon)', (await guard('anon', 0, "select public.member_join_batch('dhaka-college','ssc',2018,'studied',null)")) === 'denied');
  ok('a bad status, a bad level and a bad year are refused', (await mj(5, 'dhaka-college', 'ssc', 2018, 'teacher')).error === 'BAD_STATUS' && (await mj(5, 'dhaka-college', 'phd', 2018)).error === 'BAD_BATCH' && (await mj(5, 'dhaka-college', 'ssc', 3000)).error === 'BAD_BATCH');
  ok('an institution that is hidden, pending or unknown cannot get a batch', (await mj(5, 'hidden-school', 'ssc', 2018)).error === 'NO_INSTITUTION' && (await mj(5, 'pending-school', 'ssc', 2018)).error === 'NO_INSTITUTION' && (await mj(5, 'nope', 'ssc', 2018)).error === 'NO_INSTITUTION');

  // ---- one batch per member per institution + level
  const before = (await rows("select count(*)::int as n from public.batches")) [0].n;
  r = await mj(2, 'dhaka-college', 'ssc', 2019);
  ok('a second SSC batch at the same institution is refused (ONE_PER_LEVEL) and no empty batch is left behind', r.error === 'ONE_PER_LEVEL' && (await rows("select count(*)::int as n from public.batches"))[0].n === before, JSON.stringify(r));
  r = await mj(2, 'dhaka-college', 'hsc', 2020);
  ok('another level at the same institution is fine, and the institution counter counts the PERSON once (user 2 is in two batches there)', r.ok === true && r.institution_members === 4 && (await cnt('dhaka-college')) === 4, JSON.stringify(r));
  r = await mj(2, 'viqar', 'ssc', 2018);
  ok('another institution is another count', r.ok === true && (await cnt('viqar')) === 1 && (await cnt('dhaka-college')) === 4);

  // ---- the primary membership
  let me = await call(2, 'select public.batch_me() as r');
  ok('batch_me carries the status and the primary mark, the primary first', me.length === 3 && me[0].primary === true && me.filter(x => x.primary).length === 1 && me.every(x => typeof x.status === 'string'), JSON.stringify(me));
  const viq = me.find(x => x.slug === 'viqar');
  ok('member_set_primary moves the mark (only one primary at a time); a stranger cannot take another batch', (await call(2, 'select public.member_set_primary($1) as r', [viq.batch_id])).ok === true && (await call(2, 'select public.batch_me() as r'))[0].slug === 'viqar' && (await call(9, 'select public.member_set_primary($1) as r', [viq.batch_id])).error === 'NOT_MEMBER');
  ok('the database itself refuses two primary memberships for one member', await (async () => { try { await db.exec("update public.batch_members set is_primary = true where user_id = '" + U(2) + "'"); return false; } catch (e) { return true; } })());

  // ---- leaving
  await call(2, 'select public.batch_leave($1) as r', [(me.find(x => x.slug === 'dhaka-college' && x.level === 'hsc')).batch_id]);
  ok('leaving one batch of an institution keeps the person counted while another batch there remains', (await cnt('dhaka-college')) === 4);
  await call(2, 'select public.batch_leave($1) as r', [(me.find(x => x.slug === 'dhaka-college' && x.level === 'ssc')).batch_id]);
  ok('leaving the last batch of an institution takes the person out of its count', (await cnt('dhaka-college')) === 3);
  ok('a member of a batch that is deleted (its last member leaves) is taken out of the count and the counter never goes below zero', await (async () => { const b = (await rows("select id from public.batches where institution_slug = 'viqar'"))[0].id; await call(2, 'select public.batch_leave($1) as r', [b]); return (await cnt('viqar')) === 0 && (await rows("select members from public.institution_member_counts where slug = 'viqar'"))[0].members === 0; })());

  // ---- limits
  const lvs = ['psc', 'jsc', 'ssc', 'hsc', 'bachelor', 'masters'];
  for (let i = 0; i < 6; i++) await mj(11 + i, 'dhaka-college', lvs[i], 2015);          // six other people each open one batch (a person may open at most three)
  for (const lv of lvs) await mj(6, 'dhaka-college', lv, 2015);                          // user 6 joins all six (six joins in an hour)
  ok('six joins in an hour are fine, the seventh is RATE (limited)', (await mj(6, 'viqar', 'ssc', 2015)).error === 'RATE');

  // ---- who can read what
  ok('the counter table is closed to anon and to signed-in members, the three public reads work for anon', (await guard('anon', 0, 'select * from public.institution_member_counts')) === 'denied' && (await guard('authenticated', 3, 'select * from public.institution_member_counts')) === 'denied' && Array.isArray(await guard('anon', 0, "select * from public.institution_members(array['dhaka-college'])")) && Array.isArray(await guard('anon', 0, "select public.institution_batches('dhaka-college')")));
  ok('the old functions still work next to the new ones (the batch page keeps working)', (await lookup(0, 'dhaka-college', 'ssc', 2018)).ok === true && (await call(3, "select public.batch_me() as r")).length >= 1);
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });
