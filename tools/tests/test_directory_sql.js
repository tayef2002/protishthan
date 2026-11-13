// Runs migrations/2026-12-22_duplicate_guard.sql (the check), 2026-12-23_directory_check_speed.sql and 2026-12-23_partner_privacy.sql in a real Postgres engine (PGlite)
// with stand-ins for the parts of Supabase they rely on.
//   one-time setup (nothing is added to the project):  npm install --prefix %TEMP%\pglite @electric-sql/pglite
//   run:  set PGLITE_DIR=%TEMP%\pglite   then   node tools/tests/test_directory_sql.js        (without the engine it says so and stops, it does not fail)
const fs = require('fs'), path = require('path');
let PGlite;
try { ({ PGlite } = require(process.env.PGLITE_DIR ? path.join(process.env.PGLITE_DIR, 'node_modules', '@electric-sql', 'pglite') : '@electric-sql/pglite')); }
catch (e) { console.log('skipped: the PGlite engine is not installed (see the two lines at the top of this file).'); process.exit(0); }
const read = f => fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', f), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); };
(async () => {
  const db = new PGlite();
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const err = async (sql, params) => { try { await db.query(sql, params); return null; } catch (e) { return e.message; } };
  await db.exec(`
    create role anon; create role authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin', true) = '1' $$;
    -- stand-ins for the two name keys (the real ones are in 2026-11-10 and 2026-11-15)
    create function public.bn_key(t text) returns text language sql immutable as $$ select lower(regexp_replace(coalesce(t, ''), '\\s', '', 'g')) $$;
    create function public.phon_key(t text) returns text language sql immutable as $$ select case when public.bn_key(t) in ('ঢাকাকলেজ', 'dhakacollege') then 'dhakakolej' else public.bn_key(t) end $$;
    create table public.listing_submissions (id uuid primary key default gen_random_uuid(), institution_name text, institution_type text, district text, upazila text, desired_slug text,
      status text default 'pending', verification text default 'verified', source text, is_hidden boolean, search_key text, search_key_en text, phon_key text, phon_key_en text,
      needs_bn_name boolean generated always as (institution_name ~ '[A-Za-z]') stored);
    grant select, insert, update on public.listing_submissions to anon, authenticated;
  `);
  // ---- the check, first the 12-22 version, then the faster 12-23 one: the same answers
  const row = (name, d, u, st, extra) => db.query(`insert into public.listing_submissions (institution_name, institution_type, district, upazila, desired_slug, status, search_key, search_key_en, phon_key, phon_key_en, is_hidden)
      values ($1, 'কলেজ', $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [name, d, u, 'slug-' + Math.random().toString(16).slice(2, 7), st, /[A-Za-z]/.test(name) ? null : (await_key(name)), /[A-Za-z]/.test(name) ? await_key(name) : null, /[A-Za-z]/.test(name) ? null : (await_phon(name)), /[A-Za-z]/.test(name) ? await_phon(name) : null, !!(extra && extra.hidden)]);
  const await_key = n => n.toLowerCase().replace(/\s/g, ''), await_phon = n => (['ঢাকাকলেজ', 'dhakacollege'].includes(await_key(n)) ? 'dhakakolej' : await_key(n));
  await row('ঢাকা কলেজ', 'ঢাকা', 'ধানমন্ডি', 'approved');
  await row('Dhaka College', 'ঢাকা', 'ধানমন্ডি', 'approved');
  await row('ঢাকা কলেজ', 'ঢাকা', 'মিরপুর', 'approved');
  await row('গোপন কলেজ', 'ঢাকা', 'ধানমন্ডি', 'approved', { hidden: true });
  await row('বাতিল কলেজ', 'ঢাকা', 'ধানমন্ডি', 'rejected');
  await row('অপেক্ষার কলেজ', 'ঢাকা', 'ধানমন্ডি', 'pending');
  await row('চট্টগ্রাম সিটি কলেজ', 'চট্টগ্রাম', 'কর্ণফুলী', 'pending');
  const levels = async (n, d, u) => (await q('select match_level, institution_name, upazila, status, needs_bn_name, id from public.directory_check($1,$2,$3)', [n, d, u]));
  for (const [label, file] of [['2026-12-22 (the first version)', '2026-12-22_duplicate_guard.sql'], ['2026-12-23 (the fast version)', '2026-12-23_directory_check_speed.sql']]) {
    // the 12-22 file also adds the insert trigger, which needs is_admin and the table: both exist here
    await db.exec(read(file));
    const a = await levels('ঢাকা কলেজ', 'ঢাকা', 'ধানমন্ডি');
    ok(label + ': the same Bangla name in the same upazila is "same_upazila"', a.some(r => r.match_level === 'same_upazila' && r.institution_name === 'ঢাকা কলেজ' && r.upazila === 'ধানমন্ডি'), JSON.stringify(a));
    ok(label + ': the English listing with the same sound in the same upazila is "likely_same" and says it needs a Bangla name', a.some(r => r.match_level === 'likely_same' && r.institution_name === 'Dhaka College' && r.needs_bn_name === true), JSON.stringify(a));
    ok(label + ': the same name in another upazila is "same_district"', a.some(r => r.match_level === 'same_district' && r.upazila === 'মিরপুর'), JSON.stringify(a));
    ok(label + ': the best match comes first, every row carries its id', a[0].match_level === 'same_upazila' && a.every(r => !!r.id), JSON.stringify(a.map(r => r.match_level)));
    ok(label + ': a hidden or rejected listing is never reported', (await levels('গোপন কলেজ', 'ঢাকা', 'ধানমন্ডি')).length === 0 && (await levels('বাতিল কলেজ', 'ঢাকা', 'ধানমন্ডি')).length === 0);
    ok(label + ': a pending listing is reported (it is the one waiting for approval)', (await levels('অপেক্ষার কলেজ', 'ঢাকা', 'ধানমন্ডি'))[0].match_level === 'same_upazila' && (await levels('অপেক্ষার কলেজ', 'ঢাকা', 'ধানমন্ডি'))[0].status === 'pending');
    ok(label + ': with only the district (no upazila) the same name is "same_district"', (await levels('চট্টগ্রাম সিটি কলেজ', 'চট্টগ্রাম', null))[0].match_level === 'same_district');
    ok(label + ': another district sees nothing, and a name that matches nothing sees nothing', (await levels('ঢাকা কলেজ', 'চট্টগ্রাম', 'কর্ণফুলী')).length === 0 && (await levels('কোনো নামই নেই', 'ঢাকা', 'ধানমন্ডি')).length === 0);
    ok(label + ': no district gives no answer (instead of the whole country)', (await levels('ঢাকা কলেজ', '', null)).length === 0);
  }
  // the fast version: the four indexes exist and the query shape can use them (checked with a forced plan, the table here is tiny)
  const idx = (await q(`select indexname from pg_indexes where tablename = 'listing_submissions' and indexname like 'listing_dup%' order by 1`)).map(r => r.indexname);
  ok('the four partial indexes were made', JSON.stringify(idx) === JSON.stringify(['listing_dupkey_en_idx', 'listing_dupkey_idx', 'listing_dupphon_en_idx', 'listing_dupphon_idx']), JSON.stringify(idx));
  await db.exec('set enable_seqscan = off');
  const plan = (await q(`explain select id from public.listing_submissions l where l.status in ('pending','approved') and coalesce(l.is_hidden,false) = false
      and ((l.search_key = 'ঢাকাকলেজ' or l.search_key_en = 'ঢাকাকলেজ') or (l.phon_key = 'dhakakolej' or l.phon_key_en = 'dhakakolej')) and trim(l.district) = 'ঢাকা'`)).map(r => r['QUERY PLAN']).join('\n');
  ok('the question can be answered from the indexes (no sequential scan of the whole table)', /listing_dup/.test(plan) && !/Seq Scan/.test(plan), plan);
  await db.exec('set enable_seqscan = on');
  ok('the function stays closed to everyone but the form and the admin (anon and authenticated may run it)', (await q(`select has_function_privilege('anon', 'public.directory_check(text,text,text)', 'execute') as a, has_function_privilege('authenticated', 'public.directory_check(text,text,text)', 'execute') as b`))[0].a === true);

  // ---- the English-name guard on insert (from 12-22)
  await db.exec('set role anon');
  ok('an English letter in a new hand-submitted name is refused', /ENGLISH_NAME_NOT_ALLOWED/.test(await err(`insert into public.listing_submissions (institution_name, institution_type, district, upazila, status) values ('Test School','স্কুল','ঢাকা','ধানমন্ডি','pending')`)));
  await db.exec(`reset role; select set_config('test.admin','1',false); set role authenticated`);
  ok('the admin may still insert one', (await err(`insert into public.listing_submissions (institution_name, institution_type, district, upazila, status) values ('Admin School','স্কুল','ঢাকা','ধানমন্ডি','pending')`)) === null);
  await db.exec(`reset role; select set_config('test.admin','0',false)`);
  ok('an imported row (source set) may carry an English name', (await err(`insert into public.listing_submissions (institution_name, institution_type, district, upazila, status, source) values ('Import School','স্কুল','ঢাকা','ধানমন্ডি','approved','banbeis')`)) === null);
  ok('an UPDATE of an old English-named hand-submitted row is not blocked (the guard is insert-only)', (await err(`update public.listing_submissions set verification = 'unverified' where institution_name = 'Dhaka College'`)) === null);

  // ---- partner privacy
  await db.exec(`
    create table public.agents (id uuid primary key default gen_random_uuid(), user_id uuid, full_name text, phone text, email text, district text, upazila text, status text default 'pending_review',
      is_active boolean default true, commission_rate numeric, approved_at timestamptz, approved_by uuid, created_at timestamptz default now());
    create table public.agent_commissions (id uuid primary key default gen_random_uuid(), agent_id uuid, amount numeric);
    create view public.agent_commission_summary as select a.id as agent_id, a.full_name as agent_name, a.district, coalesce(sum(c.amount), 0) as total_accrued_commission from public.agents a left join public.agent_commissions c on c.agent_id = a.id group by a.id;
    grant select on public.agents, public.agent_commissions, public.agent_commission_summary to anon, authenticated;            -- how Supabase leaves them before the lockdown
    grant insert on public.agents to anon; grant insert, update, delete on public.agents to authenticated;       -- Supabase hands authenticated every right; row security decides
    create function public.army_seat_limit() returns trigger language plpgsql as $f$ begin
      if new.upazila is null or new.status = 'rejected' then return new; end if;
      if (select count(*) from public.agents a where a.district = new.district and a.upazila = new.upazila and a.status <> 'rejected' and a.id <> new.id) >= 3 then raise exception 'ARMY_UPAZILA_FULL'; end if;
      return new; end $f$;
    create trigger army_seat_limit before insert or update of district, upazila, status on public.agents for each row execute function public.army_seat_limit();
    create policy old_public_read on public.agents for select using (true);              -- the situation found on the live site: anyone can read
    alter table public.agents enable row level security;
  `);
  const U1 = '11111111-1111-1111-1111-111111111111', U2 = '22222222-2222-2222-2222-222222222222';
  await db.exec(`insert into public.agents (user_id, full_name, phone, email, district, upazila, status) values ('${U1}','পার্টনার এক','01711111111','a@x.com','ঢাকা','ধানমন্ডি','approved'), ('${U2}','পার্টনার দুই','01722222222','b@x.com','ঢাকা','ধানমন্ডি','approved')`);
  await db.exec('set role anon');
  ok('before the lockdown the public key reads names and mobiles (this is what was found live)', (await q('select * from public.agents')).length === 2 && (await q('select * from public.agent_commission_summary')).length === 2);
  await db.exec('reset role');
  await db.exec(read('2026-12-23_partner_privacy.sql'));
  const polys = (await q(`select policyname from pg_policies where tablename = 'agents' order by 1`)).map(r => r.policyname);
  ok('after: exactly three policies are left on agents (the old open one is gone)', JSON.stringify(polys) === JSON.stringify(['agents_admin_all', 'agents_apply', 'agents_own_read']), JSON.stringify(polys));
  await db.exec('set role anon');
  ok('the public key now sees no Partner (no names, no mobiles, no e-mails): the table is closed to it', /permission denied/.test(String(await err('select * from public.agents'))));
  ok('the public key is refused the commission view', /permission denied/.test(await err('select * from public.agent_commission_summary')));
  ok('anyone may still APPLY, as pending_review', (await err(`insert into public.agents (user_id, full_name, phone, email, district, upazila, status, is_active) values ('33333333-3333-3333-3333-333333333333','আবেদনকারী','01733333333','c@x.com','ঢাকা','মিরপুর','pending_review',true)`)) === null);
  ok('but not pre-approved: an application saying status approved is refused', /row-level security/.test(await err(`insert into public.agents (full_name, phone, district, upazila, status) values ('চালাক','01744444444','ঢাকা','মিরপুর','approved')`)));
  await db.exec('reset role');
  await db.exec(`select set_config('test.uid','${U1}',false); set role authenticated`);
  const own = await q('select full_name from public.agents');
  ok('a Partner reads only their own row', own.length === 1 && own[0].full_name === 'পার্টনার এক', JSON.stringify(own));
  ok('a Partner cannot edit their own commission rate', (await q(`update public.agents set commission_rate = 99 where user_id = '${U1}' returning 1`)).length === 0);
  await db.exec(`reset role; select set_config('test.admin','1',false); set role authenticated`);
  ok('the admin reads every Partner and the commission view', (await q('select * from public.agents')).length === 3 && (await q('select * from public.agent_commission_summary')).length === 3);
  ok('the admin can update a Partner', (await q(`update public.agents set commission_rate = 50 where user_id = '${U1}' returning 1`)).length === 1);
  await db.exec(`reset role; select set_config('test.admin','0',false); set role anon`);
  // the 3 seats per upazila must still hold for a stranger applying: the trigger now sees all the rows
  await db.exec('reset role');
  await db.exec(`insert into public.agents (user_id, full_name, phone, district, upazila, status) values ('44444444-4444-4444-4444-444444444444','তৃতীয়','01755555555','ঢাকা','ধানমন্ডি','approved')`);
  await db.exec('set role anon');
  ok('the 3-seats-per-upazila rule still refuses a 4th applicant (the trigger counts everyone, not only what the applicant may see)', /ARMY_UPAZILA_FULL/.test(await err(`insert into public.agents (full_name, phone, district, upazila, status) values ('চতুর্থ','01766666666','ঢাকা','ধানমন্ডি','pending_review')`)));
  await db.exec('reset role');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e.message, (e.stack || '').split('\n').slice(0,4).join(' | ')); process.exit(1); });
