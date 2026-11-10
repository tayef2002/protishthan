#!/usr/bin/env node
/* Builds the saved name index the card page searches in the browser (card-index.js), so a visitor typing an institution name gets the list at once,
 * without a question to the database.   node tools/card-index/build.mjs
 *
 * Reads the rows of the official imports (tools/import-institutions: DPE primary schools, BANBEIS schools / colleges / madrasas / technical, UGC universities),
 * the same rows that went into the database. For every institution it saves one line: name, English name, type, district, upazila, page address (slug),
 * and the two sound keys (phon.js). The lines are cut into small files by the first two letters of the key a visitor's text is compared with:
 *   card-index/k/<hex>.txt   rows whose spelling key (bnname.js key()) of the name starts with those two Bangla letters
 *   card-index/p/<hex>.txt   rows whose sound key (phon.js) of the name or the English name starts with those two letters
 * A search loads one or two of these files (a few KB to a few hundred KB each) and is answered in the browser.
 * Institutions added to the database later (verified ones, new imports) are not in these files: the page still asks the server for those when the files
 * do not fill the list, so nothing is lost; rebuild this index after a big import and bump INDEX_VERSION in card.html.
 * Needs the saved import folders (the rows.json inside tools/import-institutions/out-primary, out-technical, out-extra, out-universities); the BANBEIS school and madrasa files are rebuilt from their CSVs on the way.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..', '..');
const IMP = path.join(ROOT, 'tools', 'import-institutions'), OUT = path.join(ROOT, 'card-index');
const require = createRequire(import.meta.url);
const PhonKey = require(path.join(ROOT, 'phon.js'));
const bn = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'bnname.js'), 'utf8'), { window: bn, document: { createElement: () => ({}), head: { appendChild() {} } } });
const { key } = bn.BnName;

// the CSV sources whose rows.json was not kept: rebuilt here (same tool, same default settings as the first import)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'card-index-'));
const csvSources = [['banbeis-2024.csv', 'banbeis-2024'], ['banbeis-madrasa-2024.csv', 'banbeis-madrasa-2024']];
const folders = ['out-primary', 'out-technical', 'out-extra', 'out-universities'].map(d => path.join(IMP, d, 'rows.json'));
for (const [csv, source] of csvSources) {
  const dir = path.join(tmp, source);
  execFileSync(process.execPath, [path.join(IMP, 'import.mjs'), path.join(IMP, csv), '--source', source, '--out', dir], { stdio: 'ignore' });
  folders.push(path.join(dir, 'rows.json'));
}

const clean = s => String(s == null ? '' : s).replace(/[\t\r\n]+/g, ' ').trim();
const bySlug = new Map();
for (const f of folders) {
  if (!fs.existsSync(f)) { console.error('missing: ' + f); process.exit(1); }
  for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    const slug = clean(r.desired_slug), name = clean(r.institution_name);
    if (!slug || !name || r.status !== 'approved' || bySlug.has(slug)) continue;
    const en = clean(r.name_en);
    bySlug.set(slug, { name, en: en && en !== name ? en : '', type: clean(r.institution_type), district: clean(r.district), upazila: clean(r.upazila), slug });
  }
}

const BANGLA = /^[ঀ-৿]/;
const first2 = s => s.slice(0, 2);
const sid = s2 => Array.from(s2).map(c => c.charCodeAt(0).toString(16)).join('-');
const shards = { k: new Map(), p: new Map() };
const put = (fam, k, line) => { const id = sid(first2(k)); let a = shards[fam].get(id); if (!a) shards[fam].set(id, a = []); a.push(line); };
let rows = 0;
for (const r of bySlug.values()) {
  const k = key(r.name), ke = r.en ? key(r.en) : '', pk = PhonKey(r.name), pke = r.en ? PhonKey(r.en) : '';
  const line = [r.name, r.en, r.type, r.district, r.upazila, r.slug, pk, pke].join('\t');
  rows++;
  const kids = new Set(), pids = new Set();
  if (BANGLA.test(k) && k.length >= 2) kids.add(sid(first2(k)));       // spelling files only for names that start with a Bangla letter: a visitor typing English is answered by the sound files (and by the server)
  if (BANGLA.test(ke) && ke.length >= 2) kids.add(sid(first2(ke)));
  if (pk.length >= 3) pids.add(sid(first2(pk)));
  if (pke.length >= 3) pids.add(sid(first2(pke)));
  for (const id of kids) { let a = shards.k.get(id); if (!a) shards.k.set(id, a = []); a.push(line); }
  for (const id of pids) { let a = shards.p.get(id); if (!a) shards.p.set(id, a = []); a.push(line); }
}

fs.rmSync(OUT, { recursive: true, force: true });
let files = 0, bytes = 0, biggest = { id: '', n: 0, bytes: 0 };
for (const fam of ['k', 'p']) {
  fs.mkdirSync(path.join(OUT, fam), { recursive: true });
  for (const [id, lines] of shards[fam]) {
    lines.sort();   // the same words sit next to each other: smaller after compression
    const body = lines.join('\n') + '\n';
    fs.writeFileSync(path.join(OUT, fam, id + '.txt'), body);
    files++; bytes += Buffer.byteLength(body);
    if (lines.length > biggest.n) biggest = { id: fam + '/' + id, n: lines.length, bytes: Buffer.byteLength(body) };
  }
}
fs.writeFileSync(path.join(OUT, 'README.txt'), 'Built by tools/card-index/build.mjs (' + new Date().toISOString().slice(0, 10) + ', ' + rows + ' institutions). Do not edit by hand; see the header of that script.\n');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(rows + ' institutions, ' + files + ' files, ' + (bytes / 1048576).toFixed(1) + ' MB; biggest file ' + biggest.id + ' with ' + biggest.n + ' lines (' + (biggest.bytes / 1024).toFixed(0) + ' KB)');
