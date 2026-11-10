// Checks the saved name index and its search without the internet:  node tools/card-index/test_index.js   (run tools/card-index/build.mjs first)
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..', '..');
const PhonKey = require(path.join(ROOT, 'phon.js')), CardIndex = require(path.join(ROOT, 'card-index.js'));
const bn = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'bnname.js'), 'utf8'), { window: bn, document: { createElement: () => ({}), head: { appendChild() {} } } });
const BnName = bn.BnName;

let fetched = [], mode = 'files';
const load = async p => {
  fetched.push(p);
  if (mode === 'offline') throw new Error('network down');
  const f = path.join(ROOT, 'card-index', p.replace(/\?.*$/, ''));
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
};
const ix = () => CardIndex.create({ BnName, PhonKey, load, version: 't' });
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

(async () => {
  if (!fs.existsSync(path.join(ROOT, 'card-index', 'p'))) { console.error('card-index/ is missing: run node tools/card-index/build.mjs first'); process.exit(1); }
  let idx = ix(), r;

  // a Bangla primary school name: spelled-alike answers, all start with what was typed, list is full
  r = await idx.search('মির্জাপুর', { limit: 7 });
  ok(r.rows.length === 7 && r.complete && !r.failed, 'মির্জাপুর fills the list from the saved files');
  ok(r.rows.every(x => BnName.key(x.institution_name).indexOf(BnName.key('মির্জাপুর')) === 0 || x.match_kind === 'sound'), 'every spelled-alike answer starts with what was typed');
  ok(r.rows[0].match_kind === 'exact', 'spelled-alike answers come first');
  ok(r.rows.every(x => x.desired_slug && x.institution_type && x.district), 'each answer has a page address, type and district');
  ok(r.rows.every(x => x.verification === 'unverified'), 'saved rows are shown as not yet verified');
  ok(new Set(r.rows.map(x => x.desired_slug)).size === r.rows.length, 'no row twice');
  const filesFor = fetched.length; ok(filesFor <= 2, 'one search loads at most two small files (' + filesFor + ')');

  // the same word again, or one more letter: no new file for the same two letters
  fetched = []; await idx.search('মির্জাপুর স', { limit: 7 }); ok(fetched.length === 0, 'typing on from the same two letters needs no new file');

  // an English-listed college found with a Bangla word: the sound step
  r = await idx.search('ঢাকা কলেজ', { limit: 7 });
  ok(r.rows.length > 0 && r.rows.some(x => /dhaka/i.test(x.institution_name + ' ' + x.name_en) && /college/i.test(x.institution_name + ' ' + x.name_en)), 'ঢাকা কলেজ finds a "Dhaka … College" listed in English');
  ok(r.rows.every(x => x.match_kind === 'exact' || x.match_kind === 'sound'), 'answers are labelled exact or sound');

  // nothing starts with these letters: empty, not an error
  r = await idx.search('ঀঀঀঀ', { limit: 7 }); ok(r.rows.length === 0 && !r.failed && !r.complete, 'unknown letters: an empty answer, not a failure');

  // short text
  r = await idx.search('ম', { limit: 7 }); ok(r.rows.length === 0 && !r.complete, 'one letter: nothing yet');

  // the page's own rows (verified ones) win over the saved row with the same address
  const first = (await ix().search('মির্জাপুর', { limit: 3 })).rows[0];
  r = await ix().search('মির্জাপুর', { limit: 3, extra: [{ id: 'u1', institution_name: first.institution_name, name_en: first.name_en, institution_type: first.institution_type, district: first.district, upazila: first.upazila, desired_slug: first.desired_slug, verification: 'verified' }] });
  const got = r.rows.find(x => x.desired_slug === first.desired_slug); ok(got && got.verification === 'verified' && got.id === 'u1', 'a verified row from the page replaces the saved one');
  r = await ix().search('অনন্যনামের', { limit: 7, extra: [{ id: 'u2', institution_name: 'অনন্যনামের উচ্চ বিদ্যালয়', name_en: '', institution_type: 'স্কুল', district: 'ঢাকা', upazila: 'সাভার', desired_slug: 'my-new-school', verification: 'verified' }] });
  ok(r.rows.length >= 1 && r.rows[0].desired_slug === 'my-new-school' && r.rows[0].match_kind === 'exact', 'a verified row that is not in the saved files is still found, first (spelled alike), before same-sound rows');
  ok(!r.complete, 'a short list is not complete');

  // English typed: found by sound, but the server is still asked (no spelling files for Latin letters)
  r = await ix().search('dhaka college', { limit: 7 });
  ok(r.rows.length > 0 && !r.complete, 'English text: instant sound answers, never "complete"');

  // the network fails while loading a file
  mode = 'offline'; r = await ix().search('বাণী', { limit: 7 }); ok(r.failed && r.rows.length === 0 && !r.complete, 'files cannot be loaded: failed, so the page asks the server');
  mode = 'files'; const idx2 = ix(); r = await idx2.search('বাণী', { limit: 7 }); ok(!r.failed, 'a later search works again');

  // speed: a search whose files are already loaded
  const t0 = process.hrtime.bigint(); for (let i = 0; i < 50; i++) await idx.search('মির্জাপুর', { limit: 7 }); const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 50;
  ok(ms < 25, 'a search with its files already loaded takes ' + ms.toFixed(1) + ' ms (limit 25)');
  const big = ix(); const tb = process.hrtime.bigint(); await big.search('চট্টগ্রাম', { limit: 7 }); const first_ms = Number(process.hrtime.bigint() - tb) / 1e6;
  console.log('   (first search of a big file group incl. parsing: ' + first_ms.toFixed(0) + ' ms; warm: ' + ms.toFixed(1) + ' ms)');

  console.log('all ' + n + ' checks passed');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
