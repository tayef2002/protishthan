// Runs migrations/2027-01-15_guess_pool.sql in a real Postgres engine (PGlite): the pool of the game "কোন জেলায়?", on a directory of the REAL SIZE (about 100,000 rows)
// because the first version (sort the whole table) was cancelled by the 3 second limit of the public role on the real database.
//   one-time setup:  npm install --prefix %TEMP%\pgl @electric-sql/pglite      run:  set PGLITE_DIR=%TEMP%\pgl   then   node tools/tests/test_guess_sql.js
const fs = require('fs'), path = require('path');
let PGlite;
try { ({ PGlite } = require(process.env.PGLITE_DIR ? path.join(process.env.PGLITE_DIR, 'node_modules', '@electric-sql', 'pglite') : '@electric-sql/pglite')); }
catch (e) { console.log('skipped: the PGlite engine is not installed (see the top of this file).'); process.exit(0); }
const SQL = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '2027-01-15_guess_pool.sql'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); };
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; alter default privileges in schema public grant execute on functions to anon, authenticated;
    create table public.listing_submissions (id serial primary key, desired_slug text, institution_name text, institution_type text, district text, upazila text, status text, is_hidden boolean default false, contact_phone text, prn_number int);
    create unique index listing_prn_unique on public.listing_submissions (prn_number) where prn_number is not null;`);
  // 102,000 rows like the directory: 84% schools (most of them primary), 9% madrasas, 5% colleges, 2% technical; PRN numbers spread over 100000-999999 (about one in nine used)
  await db.exec(`insert into public.listing_submissions (desired_slug, institution_name, institution_type, district, upazila, status, contact_phone, prn_number)
    select 'inst-' || g,
           case when g % 100 < 84 then (case when g % 10 < 7 then 'নমুনা ' || g || ' সরকারি প্রাথমিক বিদ্যালয়' else 'নমুনা ' || g || ' মাধ্যমিক বিদ্যালয়' end)
                when g % 100 < 93 then 'নমুনা ' || g || ' দাখিল মাদ্রাসা' when g % 100 < 98 then 'নমুনা ' || g || ' ডিগ্রি কলেজ' else 'নমুনা ' || g || ' পলিটেকনিক' end,
           case when g % 100 < 84 then 'স্কুল' when g % 100 < 93 then 'মাদ্রাসা' when g % 100 < 98 then 'কলেজ' else 'কারিগরি' end,
           (array['ঢাকা','কুমিল্লা','সিলেট','বরিশাল','রংপুর','খুলনা','রাজশাহী','চট্টগ্রাম'])[1 + g % 8], 'উপজেলা ' || g, 'approved', '01700000000',
           100000 + (g::bigint * 7919 % 900000)::int
      from generate_series(1, 102000) g`);
  await db.exec('analyze public.listing_submissions');
  await db.exec(SQL); await db.exec(SQL);     // twice: safe
  const pool = async (d, n) => (await db.query('select public.guess_pool($1, $2) as r', [d, n])).rows[0].r;
  const t0 = Date.now(); const a = await pool('2026-11-18', 150), ms = Date.now() - t0;
  const b = await pool('2026-11-18', 150), c = await pool('2026-11-19', 150);
  ok('on a directory of 102,000 rows the pool of a day is 150 institutions, and it came back in well under the 3 second limit (PGlite is slower than the real server): ' + ms + ' ms', a.length === 150 && ms < 1500, ms + ' ms, ' + a.length + ' rows');
  const inner = (await db.query(`explain (analyze, costs off) with draws as (select g, 100000 + (('x' || substr(md5('2026-11-18:' || g::text), 1, 7))::bit(28)::int % 900000) as prn from generate_series(1, 4500) g) select count(*) from public.listing_submissions l join draws dr on dr.prn = l.prn_number where l.prn_number = any (array(select x.prn from draws x)) and l.status = 'approved'`)).rows.map(r => Object.values(r)[0]).join('\n');
  ok('the draws are given to the unique PRN index as one list: the plan uses listing_prn_unique and does NOT read the whole table (the form the function uses; the first form, a plain join, was planned as a nested loop over the whole table on a big table and never finished)', /listing_prn_unique/.test(inner) && !/Seq Scan on listing_submissions/.test(inner), inner.slice(0, 500));
  ok('the pool of a day is the SAME every time it is asked for (the same order), another day another set', JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.slice(0, 10).map(x => x.slug)) !== JSON.stringify(c.slice(0, 10).map(x => x.slug)));
  ok('every row is guessable: a college, madrasa, technical or a SECONDARY school; no primary school; the district is not in the name; Bangla name', a.every(x => /ডিগ্রি কলেজ|দাখিল মাদ্রাসা|পলিটেকনিক|মাধ্যমিক বিদ্যালয়/.test(x.name) && !/প্রাথমিক/.test(x.name) && !x.name.includes(x.district) && /[ঀ-৿]/.test(x.name)));
  ok('no row twice, the shape is slug, name, type, district, upazila only (no contact, no number)', new Set(a.map(x => x.slug)).size === 150 && Object.keys(a[0]).sort().join() === 'district,name,slug,type,upazila' && !/0170|contact|prn/.test(JSON.stringify(a)));
  ok('the mix is reasonable (colleges, madrasas and secondary schools all appear in 150)', ['কলেজ', 'মাদ্রাসা', 'স্কুল'].every(t => a.some(x => x.type === t)));
  // targeted rows on the numbers that the first draws of a day will use: the unusable kinds must be dropped, a good one kept
  const day = '2027-02-02', prns = (await db.query(`select 100000 + (('x' || substr(md5($1 || ':' || g::text), 1, 7))::bit(28)::int % 900000) as p from generate_series(1, 7) g order by g`, [day])).rows.map(r => r.p);
  await db.query('delete from public.listing_submissions where prn_number = any($1::int[])', [prns]);
  const put = (i, name, type, dist, o) => db.query(`insert into public.listing_submissions (desired_slug, institution_name, institution_type, district, upazila, status, is_hidden, prn_number) values ($1,$2,$3,$4,'উপজেলা',$5,$6,$7)`, ['t-' + i, name, type, dist, (o && o.status) || 'approved', !!(o && o.hidden), prns[i]]);
  await put(0, 'ঢাকা সিটি কলেজ কখ', 'কলেজ', 'ঢাকা'); await put(1, 'লুকানো কলেজ কখগ', 'কলেজ', 'রংপুর', { hidden: true }); await put(2, 'অপেক্ষার কলেজ কখগ', 'কলেজ', 'রংপুর', { status: 'pending' });
  await put(3, 'Only English College', 'কলেজ', 'রংপুর'); await put(4, 'কলেজ', 'কলেজ', 'রংপুর'); await put(5, 'জেলাহীন কলেজ কখগ', 'কলেজ', ''); await put(6, 'ভালো সরকারি কলেজ', 'কলেজ', 'বরিশাল');
  const d = await pool(day, 30), slugs = d.map(x => x.slug);
  ok('on the very first draws of a day the unusable rows are dropped (district in the name, hidden, pending, English-only name, too-short name, no district) and the good one is kept FIRST', slugs.every(s => s === 't-6' || !s.startsWith('t-')) && slugs[0] === 't-6', JSON.stringify(slugs.slice(0, 4)));
  ok('the number asked for is kept between 30 and 300 (a silly number is clipped), and no day means the Bangladesh day', (await pool('2026-11-18', 5)).length === 30 && (await pool('2026-11-18', 9999)).length === 300 && (await db.query('select jsonb_array_length(public.guess_pool()) n')).rows[0].n === 150);
  await db.exec('set role anon'); let anon; try { anon = (await db.query(`select jsonb_array_length(public.guess_pool('2026-11-18', 40)) as n`)).rows[0].n; } catch (e) { anon = 'denied'; } await db.exec('reset role');
  ok('anybody can read it (the public role), and it is a plain read', anon === 40);
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });
