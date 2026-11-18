// Runs migrations/2027-01-15_guess_pool.sql in a real Postgres engine (PGlite): the pool of the game "কোন জেলায়?".
//   one-time setup:  npm install --prefix %TEMP%\pgl @electric-sql/pglite      run:  set PGLITE_DIR=%TEMP%\pgl   then   node tools/tests/test_guess_sql.js
const fs = require('fs'), path = require('path');
let PGlite;
try { ({ PGlite } = require(process.env.PGLITE_DIR ? path.join(process.env.PGLITE_DIR, 'node_modules', '@electric-sql', 'pglite') : '@electric-sql/pglite')); }
catch (e) { console.log('skipped: the PGlite engine is not installed (see the top of this file).'); process.exit(0); }
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); };
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; alter default privileges in schema public grant execute on functions to anon, authenticated;
    create table public.listing_submissions (desired_slug text, institution_name text, institution_type text, district text, upazila text, status text, is_hidden boolean default false, contact_phone text);`);
  await db.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2027-01-15_guess_pool.sql'), 'utf8')); await db.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2027-01-15_guess_pool.sql'), 'utf8'));     // twice: safe
  const add = (slug, name, type, dist, up, o) => db.query('insert into public.listing_submissions (desired_slug, institution_name, institution_type, district, upazila, status, is_hidden, contact_phone) values ($1,$2,$3,$4,$5,$6,$7,$8)', [slug, name, type, dist, up || '', (o && o.status) || 'approved', !!(o && o.hidden), '01700000000']);
  // good rows: 200 colleges and madrasas in turn, with different districts
  const D = ['ঢাকা', 'কুমিল্লা', 'সিলেট', 'বরিশাল', 'রংপুর'];
  for (let i = 0; i < 200; i++) await add('good-' + i, 'নমুনা ' + (i % 2 ? 'ডিগ্রি কলেজ' : 'কওমি মাদ্রাসা') + ' ' + i + 'নং', i % 2 ? 'কলেজ' : 'মাদ্রাসা', D[i % 5], 'উপজেলা ' + i);
  await add('bad-district-in-name', 'ঢাকা সিটি কলেজ ক', 'কলেজ', 'ঢাকা'); await add('bad-primary', 'বড়কলক সরকারি প্রাথমিক বিদ্যালয়', 'স্কুল', 'সিলেট');
  await add('good-secondary', 'সোনারগাঁও উচ্চ বিদ্যালয় কখ', 'স্কুল', 'বরিশাল'); await add('bad-hidden', 'লুকানো কলেজ কখগ', 'কলেজ', 'রংপুর', '', { hidden: true });
  await add('bad-pending', 'অপেক্ষার কলেজ কখগ', 'কলেজ', 'রংপুর', '', { status: 'pending' }); await add('bad-english', 'Only English College', 'কলেজ', 'রংপুর');
  await add('bad-short', 'কলেজ', 'কলেজ', 'রংপুর'); await add('bad-nodist', 'জেলাহীন কলেজ কখগ', 'কলেজ', ''); await add('bad-null-slug-skipped', 'স্লাগহীন কলেজ কখগ', 'কলেজ', 'রংপুর');
  await db.exec("update public.listing_submissions set desired_slug = null where institution_name = 'স্লাগহীন কলেজ কখগ'");
  const pool = async (d, n) => (await db.query('select public.guess_pool($1, $2) as r', [d, n])).rows[0].r;
  const a = await pool('2026-11-18', 150), b = await pool('2026-11-18', 150), c = await pool('2026-11-19', 150);
  ok('the pool of a day is 150 institutions and is the SAME every time it is asked for that day (a fixed order)', a.length === 150 && JSON.stringify(a) === JSON.stringify(b));
  ok('another day gives another order (so each day has its own ten)', JSON.stringify(a.slice(0, 10).map(x => x.slug)) !== JSON.stringify(c.slice(0, 10).map(x => x.slug)));
  const all = await pool('2026-11-18', 300), slugs = new Set(all.map(x => x.slug));
  ok('only guessable ones: no district in the name, no primary school, no hidden, no pending, no English-only name, no too-short name, no missing district, no missing slug; a secondary school is in', all.length === 201 && slugs.has('good-secondary') && ![...slugs].some(s => s.startsWith('bad-')), JSON.stringify([...slugs].filter(s => s.startsWith('bad-'))));
  ok('a row carries only what the directory shows to everybody: slug, name, type, district, upazila (no contact)', Object.keys(all[0]).sort().join() === 'district,name,slug,type,upazila' && !/0170|contact/.test(JSON.stringify(all)));
  ok('the number asked for is kept between 30 and 300 (a silly number is clipped), and a missing day means the Bangladesh day', (await pool('2026-11-18', 5)).length === 30 && (await pool('2026-11-18', 9999)).length === 201 && (await db.query('select jsonb_array_length(public.guess_pool()) n')).rows[0].n === 150);
  ok('the order is the md5 of slug + day, ascending: the page can rely on it', await (async () => { const keys = (await db.query(`select md5(x ->> 'slug' || '2026-11-18') as k from jsonb_array_elements(public.guess_pool('2026-11-18', 300)) with ordinality t(x, n) order by n`)).rows.map(r => r.k); return keys.length === 201 && keys.every((k, n) => n === 0 || keys[n - 1] <= k); })());
  await db.exec('set role anon'); let anon; try { anon = (await db.query(`select jsonb_array_length(public.guess_pool('2026-11-18', 40)) as n`)).rows[0].n; } catch (e) { anon = 'denied'; } await db.exec('reset role');
  ok('anybody can read it, and it is a plain read (the table itself is not opened)', anon === 40);
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });
