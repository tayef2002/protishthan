// Compares the saved name index with the live database search:  node tools/card-index/verify_live.mjs
// For each query it asks directory_search (the server) and the saved index (card-index.js) and says whether the first rows agree (same institutions, same order).
// Rows the database has but the saved files do not (verified or newly added institutions) show up as differences: that is expected for a few queries, a long list of
// differences means the saved files are out of date (rebuild) or a key function drifted (run verify_keys.mjs). Needs the internet; reads only.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..', '..');
const require = createRequire(import.meta.url);
const PhonKey = require(path.join(ROOT, 'phon.js')), CardIndex = require(path.join(ROOT, 'card-index.js'));
const bn = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'bnname.js'), 'utf8'), { window: bn, document: { createElement: () => ({}), head: { appendChild() {} } } });
const load = async p => { const f = path.join(ROOT, 'card-index', p.replace(/\?.*$/, '')); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; };
const ix = CardIndex.create({ BnName: bn.BnName, PhonKey, load, version: 'v' });

const html = fs.readFileSync(path.join(ROOT, 'card.html'), 'utf8');
const KEY = html.match(/eyJ[A-Za-z0-9_.-]{100,}/)[0], SB = 'https://eoqeeuujvpydhmfteqqj.supabase.co';
const server = async q => { const r = await fetch(SB + '/rest/v1/rpc/directory_search', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_q: q, p_limit: 7 }), signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error('directory_search ' + r.status); return r.json(); };

const queries = process.argv.slice(2).length ? process.argv.slice(2) : [
  'ঢাকা কলেজ', 'রাজশাহী কলেজ', 'জানাব আলী', 'বাণী', 'মির্জাপুর', 'চট্টগ্রাম', 'কুমিল্লা জিলা স্কুল', 'নটর ডেম', 'হবিগঞ্জ', 'বাসুদেবপুর',
  'আল আমিন', 'দারুল', 'সরকারি প্রাথমিক বিদ্যালয়', 'খুলনা', 'বরিশাল', 'সিলেট সরকারি', 'পাবনা', 'রংপুর', 'গাজীপুর', 'মেঘনা',
  'উত্তর', 'দক্ষিণ চর', 'ইসলামিয়া', 'নূরানী', 'শহীদ', 'বঙ্গবন্ধু', 'কামিল', 'দাখিল মাদ্রাসা', 'টেকনিক্যাল', 'ঢাকা বিশ্ববিদ্যালয়',
];
let same = 0, partial = 0, diff = 0;
for (const q of queries) {
  let s, l;
  try { s = await server(q); } catch (e) { console.log('SKIP  ' + q + '  (' + e.message + ')'); continue; }
  l = await ix.search(q, { limit: 7 });
  const sSlugs = s.map(x => x.desired_slug), lSlugs = l.rows.map(x => x.desired_slug);
  const n = lSlugs.length, head = sSlugs.slice(0, n);
  const equal = head.length === n && head.every((x, i) => x === lSlugs[i]);
  if (equal && (n === 7 || l.complete === false) && n > 0) { (n === 7 ? same++ : partial++); console.log((n === 7 ? 'SAME  ' : 'PREFIX') + ' ' + q + '  (' + n + ' of 7 from the saved files)'); }
  else if (n === 0) { partial++; console.log('EMPTY  ' + q + '  (saved files had nothing; server rows: ' + s.length + ')'); }
  else { diff++; console.log('DIFF  ' + q + '\n   server: ' + s.map(x => x.institution_name + ' [' + x.match_kind + ']').join(' | ') + '\n   saved : ' + l.rows.map(x => x.institution_name + ' [' + x.match_kind + ']').join(' | ')); }
}
console.log('\nsame ' + same + ', prefix/empty ' + partial + ', different ' + diff + ' of ' + (same + partial + diff) + ' compared');
