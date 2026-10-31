#!/usr/bin/env node
/* Protishthan — institution import: turns a CSV from an official public source into SQL files you run in the Supabase SQL Editor.
 *
 *   node tools/import-institutions/import.mjs data.csv --source banbeis --source-url https://example.gov.bd/list
 *
 * CSV header (first row), any order. Only name_bn, type, district, upazila are required:
 *   name_bn   institute name in Bangla
 *   name_en   English name from the source
 *   A row needs at least one of the two. English-only rows are accepted: the English name goes to name_en AND (as a placeholder, in Title Case)
 *   to the main name, and the row is flagged needs_bn_name until someone adds the Bangla name (set_bangla_name). Use --bangla-only to refuse them.
 *   type      মাদ্রাসা | স্কুল | কলেজ | কোচিং সেন্টার  (madrasa / school / college / coaching also work)
 *   district  Bangla district name        upazila  Bangla upazila name
 *   eiin      the source's own id (EIIN) so the same institution is never imported twice (optional but strongly advised)
 *   address   a short address / village (optional)
 * If your file uses other column names:  --map name_bn="Institution Name (BN)" --map eiin=EIIN
 *
 * E-mails (optional): --contacts file.csv  (columns: eiin,email). They never go into the public table: out/contacts.json is for push.mjs, which stores them in the closed
 * table listing_private_contacts; the public row only gets a masked hint (sha*****ed@gmail.com). Keep that file out of git (*-contacts.csv is ignored).
 * What it does NOT do: it never collects phone numbers. Imported rows get contact_name = '' and contact_phone = ''.
 * Every row goes in as status 'approved' + verification 'unverified' (shown as "যাচাই হয়নি" until a Partner verifies it).
 * Output (folder tools/import-institutions/out/): part-0001.sql ..., rejected.csv (with the reason), review-same-name.csv, summary.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

// ---- args
const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('--') && !a.includes('='));
const opt = (name, def = '') => { const i = argv.indexOf('--' + name); return i > -1 && argv[i + 1] ? argv[i + 1] : def; };
const maps = {}; argv.forEach((a, i) => { if(a === '--map' && argv[i + 1] && argv[i + 1].includes('=')){ const [k, ...v] = argv[i + 1].split('='); maps[k.trim()] = v.join('=').trim(); } });
if(!file){ console.error('Usage: node tools/import-institutions/import.mjs data.csv --source banbeis --source-url https://...'); process.exit(1); }
const STRICT = argv.includes('--bangla-only');
const SOURCE = opt('source'), SOURCE_URL = opt('source-url'), BATCH = Number(opt('batch', '2000')), OUT = opt('out', path.join(HERE, 'out'));
if(!SOURCE){ console.error('--source is required (for example --source banbeis): it is stored with every row.'); process.exit(1); }

// ---- the same Bangla "forgiving key" as bnname.js / bn_key() in the database
const bnname = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'bnname.js'), 'utf8'), { window: bnname, document: { createElement: () => ({}), head: { appendChild(){} } } });
const { norm, key, hasLatin } = bnname.BnName;

// ---- districts and upazilas exactly as the website knows them (list-institution.html)
const html = fs.readFileSync(path.join(ROOT, 'list-institution.html'), 'utf8');
const m = html.match(/const BD_LOCATIONS = (\[.*?\]);/s);
if(!m){ console.error('Could not read BD_LOCATIONS from list-institution.html'); process.exit(1); }
const LOC = vm.runInNewContext('(' + m[1] + ')').map(d => ({ n: String(d.n).trim(), u: d.u.map(x => String(x).trim()) }));   // trims a stray tab that sits in one upazila name
const distByKey = new Map(LOC.map(d => [key(d.n), d]));
const upaByDist = new Map(LOC.map(d => [d.n, new Map(d.u.map(u => [key(u), u]))]));

// ---- types
const TYPE = { 'মাদ্রাসা': 'মাদ্রাসা', 'মাদরাসা': 'মাদ্রাসা', madrasa: 'মাদ্রাসা', madrasah: 'মাদ্রাসা', 'স্কুল': 'স্কুল', school: 'স্কুল', 'বিদ্যালয়': 'স্কুল', 'কলেজ': 'কলেজ', college: 'কলেজ', 'কোচিং সেন্টার': 'কোচিং সেন্টার', 'কোচিং': 'কোচিং সেন্টার', coaching: 'কোচিং সেন্টার' };
// ALL-CAPS source names -> Title Case ('DAKHIL MADRASAH' -> 'Dakhil Madrasah'); short all-caps words (BL, MD) stay as they are
const titleCase = s => s.split(' ').map((w, i) => {
  if(/[a-z]/.test(w) || !/[A-Z]/.test(w)) return w;
  const letters = w.replace(/[^A-Za-z]/g, '');
  if(/^(AND|THE|OF|FOR)$/.test(letters) && i > 0) return w.toLowerCase();
  if(letters.length <= 3) return w;
  return w.toLowerCase().replace(/(^|[^a-z])([a-z])/g, (m, a, b) => a + b.toUpperCase());
}).join(' ');
const hasBangla = s => /[\u0980-\u09FF]/.test(s);
let englishOnly = 0;
const CODE = { 'মাদ্রাসা': 'mad', 'স্কুল': 'sch', 'কলেজ': 'col', 'কোচিং সেন্টার': 'coa' };

// ---- a small CSV reader (quotes, commas and line breaks inside quotes)
function parseCSV(text){
  text = text.replace(/^﻿/, ''); const rows = []; let row = [], cur = '', q = false;
  for(let i = 0; i < text.length; i++){
    const c = text[i];
    if(q){ if(c === '"'){ if(text[i + 1] === '"'){ cur += '"'; i++; } else q = false; } else cur += c; }
    else if(c === '"') q = true;
    else if(c === ',') { row.push(cur); cur = ''; }
    else if(c === '\n' || c === '\r'){ if(c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if(row.some(x => x.trim() !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if(row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}
const csvCell = s => { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const MAIL_OK = new Set(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'yahoo.co.uk', 'ymail.com']);
// same masking as mask_email() in the database: first 3 + ***** + last 2 before the @; unusual domains are hidden too
function maskEmail(e){
  e = String(e || '').trim().toLowerCase(); if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return null;
  const [lp, dm] = e.split('@'); const shown = lp.length <= 3 ? lp.slice(0, 1) + '*****' : lp.length <= 6 ? lp.slice(0, 2) + '*****' : lp.slice(0, 3) + '*****' + lp.slice(-2);
  if(MAIL_OK.has(dm)) return shown + '@' + dm;
  return shown + '@' + dm.split('.')[0].slice(0, 1) + '*****.' + dm.replace(/^[^.]+\./, '');
}
const CONTACTS = new Map();
const contactsFile = opt('contacts');
if(contactsFile){ const cr = parseCSV(fs.readFileSync(contactsFile, 'utf8')); const ch = cr.shift().map(x => x.trim().toLowerCase()); const ei = ch.indexOf('eiin'), em = ch.indexOf('email');
  if(ei < 0 || em < 0){ console.error('--contacts needs the columns: eiin,email'); process.exit(1); }
  cr.forEach(r => { const id = String(r[ei] || '').replace(/\s+/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); const mail = String(r[em] || '').trim().toLowerCase(); if(id && maskEmail(mail)) CONTACTS.set(id, mail); }); }
const sql = s => s == null || s === '' ? "''" : "'" + String(s).replace(/'/g, "''") + "'";

// ---- read
const rows = parseCSV(fs.readFileSync(file, 'utf8'));
const head = rows.shift().map(h => h.trim());
const col = name => { const want = (maps[name] || name).toLowerCase(); return head.findIndex(h => h.toLowerCase() === want); };
const C = { name_bn: col('name_bn'), name_en: col('name_en'), type: col('type'), district: col('district'), upazila: col('upazila'), eiin: col('eiin'), address: col('address') };
for(const need of ['name_bn', 'type', 'district', 'upazila']) if(C[need] < 0){ console.error('Missing column: ' + (maps[need] || need) + '   (header found: ' + head.join(' | ') + ')'); process.exit(1); }
const get = (r, k) => C[k] < 0 ? '' : (r[C[k]] || '').trim();

// ---- check every row
const good = [], rejected = [], seen = new Map(), sameName = new Map();
const reject = (r, why) => rejected.push({ why, row: r });
rows.forEach(r => {
  const rawBn = norm(get(r, 'name_bn')), rawEn = get(r, 'name_en').replace(/\s+/g, ' ');
  let nameBn, nameEn;
  if(rawBn && (!hasLatin(rawBn) || hasBangla(rawBn))){ nameBn = rawBn; nameEn = rawEn ? titleCase(rawEn) : ''; }          // a Bangla name
  else {                                                                                                                  // English only
    const eng = rawEn || rawBn;
    if(!eng) return reject(r, 'নাম নেই (name_bn ও name_en দুটোই ফাঁকা)');
    if(STRICT) return reject(r, 'নামে ইংরেজি অক্ষর আছে, বাংলা নাম লাগবে');
    nameEn = titleCase(eng); nameBn = nameEn; englishOnly++;
  }
  if(nameBn.length < 3) return reject(r, 'নাম খুব ছোট');
  const type = TYPE[get(r, 'type').toLowerCase()] || TYPE[get(r, 'type')];
  if(!type) return reject(r, 'ধরন চেনা যায়নি: "' + get(r, 'type') + '"');
  const dist = distByKey.get(key(get(r, 'district')));
  if(!dist) return reject(r, 'জেলা চেনা যায়নি: "' + get(r, 'district') + '"');
  const upa = upaByDist.get(dist.n).get(key(get(r, 'upazila')));
  if(!upa) return reject(r, 'উপজেলা তালিকায় নেই: "' + get(r, 'upazila') + '" (' + dist.n + ')');
  const eiin = get(r, 'eiin').replace(/\s+/g, '');
  const k = key(nameBn), place = dist.n + '|' + upa + '|' + k;
  const sourceId = eiin ? eiin.toLowerCase().replace(/[^a-z0-9]/g, '') : 'x' + crypto.createHash('sha1').update(place + '|' + get(r, 'address')).digest('hex').slice(0, 10);
  const idKey = SOURCE + '|' + sourceId;
  if(seen.has(idKey)) return reject(r, 'একই আইডি (EIIN) ফাইলে আগেই আছে');
  seen.set(idKey, 1);
  sameName.set(place, (sameName.get(place) || []).concat(nameBn + (eiin ? ' [' + eiin + ']' : '')));
  good.push({ nameBn, nameEn, type, district: dist.n, upazila: upa, address: get(r, 'address'), sourceId, slug: CODE[type] + '-' + sourceId, place });
});

// ---- same name in the same upazila inside this file: kept (real schools share names; the id tells them apart) but listed for a look
const review = [...sameName.entries()].filter(([, v]) => v.length > 1);

// ---- write
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
// compact form: only what differs per row goes into VALUES; the constants (status, source, verification ...) are written once per file
const cols = 'institution_name, institution_type, district, upazila, contact_name, contact_phone, address_note, desired_slug, status, name_en, source, source_url, source_id, collected_at, verification';
let part = 0;
for(let i = 0; i < good.length; i += BATCH){
  const chunk = good.slice(i, i + BATCH);
  const values = chunk.map(g => '(' + [sql(g.nameBn), sql(g.type), sql(g.district), sql(g.upazila), sql(g.slug), g.nameEn ? sql(g.nameEn) : 'null', sql(g.sourceId), g.address ? sql(g.address) : 'null'].join(', ') + ')').join(',' + String.fromCharCode(10));
  fs.writeFileSync(path.join(OUT, 'part-' + String(++part).padStart(4, '0') + '.sql'),
    '-- ' + chunk.length + ' institutions from ' + SOURCE + ' (rows ' + (i + 1) + '-' + (i + chunk.length) + '). Safe to run twice: rows already imported are skipped.' + String.fromCharCode(10) +
    'insert into public.listing_submissions (' + cols + ')' + String.fromCharCode(10) +
    "select v.nm, v.ty, v.di, v.up, '', '', v.ad, v.sl, 'approved', v.en, " + sql(SOURCE) + ', ' + (SOURCE_URL ? sql(SOURCE_URL) : 'null') + ", v.sid, now(), 'unverified'" + String.fromCharCode(10) +
    'from (values' + String.fromCharCode(10) + values + String.fromCharCode(10) + ') as v(nm, ty, di, up, sl, en, sid, ad)' + String.fromCharCode(10) +
    'on conflict (source, source_id) where source is not null do nothing;' + String.fromCharCode(10));
}
// the same rows as plain data, for push.mjs (sends them straight to the database)
fs.writeFileSync(path.join(OUT, 'rows.json'), JSON.stringify(good.map(g => ({ institution_name: g.nameBn, institution_type: g.type, district: g.district, upazila: g.upazila, contact_name: '', contact_phone: '', address_note: g.address || null, desired_slug: g.slug, status: 'approved', name_en: g.nameEn || null, source: SOURCE, source_url: SOURCE_URL || null, source_id: g.sourceId, collected_at: new Date().toISOString(), verification: 'unverified', email_hint: CONTACTS.has(g.sourceId) ? maskEmail(CONTACTS.get(g.sourceId)) : null }))));
fs.writeFileSync(path.join(OUT, 'contacts.json'), JSON.stringify(good.filter(g => CONTACTS.has(g.sourceId)).map(g => ({ source_id: g.sourceId, email: CONTACTS.get(g.sourceId), source: SOURCE }))));
fs.writeFileSync(path.join(OUT, 'rejected.csv'), '﻿reason,' + head.map(csvCell).join(',') + '\n' + rejected.map(x => csvCell(x.why) + ',' + x.row.map(csvCell).join(',')).join('\n'));
fs.writeFileSync(path.join(OUT, 'review-same-name.csv'), '﻿district|upazila|name_key,names\n' + review.map(([p, v]) => csvCell(p) + ',' + csvCell(v.join(' ; '))).join('\n'));
const why = {}; rejected.forEach(x => { const w = x.why.replace(/: ".*$/, ''); why[w] = (why[w] || 0) + 1; });
const summary = ['Rows read: ' + rows.length, 'E-mails kept privately: ' + good.filter(g => CONTACTS.has(g.sourceId)).length, 'English-only (Bangla name still to add): ' + good.filter(g => !hasBangla(g.nameBn)).length, 'Ready to import: ' + good.length + '  (' + part + ' SQL file(s) of up to ' + BATCH + ' rows)', 'Rejected: ' + rejected.length, ...Object.entries(why).sort((a, b) => b[1] - a[1]).map(([w, n]) => '   ' + n + '  ' + w), 'Same name + same upazila inside the file: ' + review.length + ' place(s) (see review-same-name.csv)', '', 'Next: run part-0001.sql, part-0002.sql ... in the Supabase SQL Editor, in order. Then: select count(*) from public.listing_submissions where source = ' + sql(SOURCE) + ';'].join('\n');
fs.writeFileSync(path.join(OUT, 'summary.txt'), summary + '\n');
console.log(summary);
