#!/usr/bin/env node
/* Cumilla Board (BISE Cumilla): zilla-wise institution result tables -> the import file for Admin > বোর্ড ফলাফল.
 *
 *   node tools/board-results/fetch-cumilla.mjs SSC 2025 > data/board-results/comilla-ssc-2025.json
 *
 * The board publishes, on its own result site (https://result19.comillaboard.gov.bd/<year>/zilla/), one page per zilla with, for every institution (EIIN),
 * the examinees, GPA bands and passed per group and in total. Only these aggregate numbers are collected: no student names, rolls or marks.
 * It asks the site politely (one zilla at a time, a pause between requests; six requests in all) and checks every institution:
 *   groups add up to the total · passed adds up · GPA bands add up to the passed · the printed % matches
 * Institutions that fail a check are reported on stderr and still written (so you can look), but the line "failing checks" must be 0 before importing.
 * No CAPTCHA or bot protection is involved (none is bypassed). */
const exam = (process.argv[2] || 'SSC').toUpperCase(), year = Number(process.argv[3] || 2025);
const BASE = 'https://result19.comillaboard.gov.bd/' + year + '/zilla/';
const ZILLAS = [['BRAHMANBARIA', 42, 'ব্রাহ্মণবাড়িয়া'], ['CHANDPUR', 35, 'চাঁদপুর'], ['CUMILLA', 37, 'কুমিল্লা'], ['FENI', 33, 'ফেনী'], ['LAXMIPUR', 34, 'লক্ষ্মীপুর'], ['NOAKHALI', 30, 'নোয়াখালী']];
const GRP = { SCIENCE: 'science', HUM: 'humanities', HUMANITIES: 'humanities', 'BUS.STD': 'business', BUSINESS: 'business', 'BUS. STD': 'business', TOTAL: 'total' };
const SMALL = new Set(['and', 'of', 'the', 'at', 'in', '&']);
const title = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
  .replace(/[a-z][a-z'’.-]*/g, (w, i) => (i > 0 && SMALL.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1))
  .replace(/\(([a-z])/g, (m, c) => '(' + c.toUpperCase());
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cell = c => c.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#039;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
const num = s => { const n = parseInt(String(s).replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : 0; };

const out = []; let failing = 0, institutions = 0; const unknownGroups = new Set();
for(const [en, id, bn] of ZILLAS){
  let html = '';
  for(let t = 0; t < 4 && !html; t++){
    try{
      const r = await fetch(BASE + 'result_z.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'ProtishthanDirectory/1.0 (aggregate board statistics)' }, body: 'zilla=' + id });
      if(r.ok) html = await r.text(); else await sleep(4000 * (t + 1));
    }catch(e){ await sleep(3000); }
  }
  if(!html){ console.error('could not read zilla', en); process.exit(1); }
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(c => cell(c[1])));
  let cur = null; const insts = [];
  for(const r of rows){
    if(r.length < 12 || /^(School|College|Madrasa|Institution)/i.test(r[0]) && r[1] === 'EIIN') continue;
    if(r[0] && /^\d{4,7}$/.test(r[1])){ cur = { eiin: r[1], name: r[0], groups: {} }; insts.push(cur); }
    if(!cur) continue;
    const g = GRP[String(r[2]).toUpperCase().trim()];
    if(!g){ unknownGroups.add(r[2]); continue; }
    cur.groups[g] = { appeared: num(r[3]), g5: num(r[4]), g4: num(r[5]), g35: num(r[6]), g3: num(r[7]), g2: num(r[8]), g1: num(r[9]), passed: num(r[10]), pct: parseFloat(r[11]) };
  }
  for(const inst of insts){
    institutions++;
    const t = inst.groups.total; if(!t){ failing++; console.error('no TOTAL row:', inst.eiin, inst.name); continue; }
    const parts = Object.entries(inst.groups).filter(([k]) => k !== 'total').map(([, v]) => v);
    const sum = f => parts.reduce((a, v) => a + v[f], 0);
    const bands = v => v.g5 + v.g4 + v.g35 + v.g3 + v.g2 + v.g1;
    const bad = [];
    if(parts.length && sum('appeared') !== t.appeared) bad.push('groups != total appeared');
    if(parts.length && sum('passed') !== t.passed) bad.push('groups != total passed');
    for(const [k, v] of Object.entries(inst.groups)) if(bands(v) !== v.passed) bad.push(k + ': bands ' + bands(v) + ' != passed ' + v.passed);
    const calc = t.appeared ? Math.round(t.passed * 10000 / t.appeared) / 100 : 0;
    if(Math.abs(calc - (t.pct || 0)) > 0.05) bad.push('pct ' + t.pct + ' vs ' + calc);
    if(bad.length){ failing++; console.error('CHECK', inst.eiin, inst.name, '|', bad.join('; ')); }
    for(const [grp, v] of Object.entries(inst.groups)){
      out.push({ exam, year, board: 'comilla', eiin: inst.eiin, institution_name: title(inst.name), district: bn, upazila: null, grp,
        appeared: v.appeared, passed: v.passed, gpa5: v.g5, gpa_bands: { '1': v.g1, '2': v.g2, '3': v.g3, '4': v.g4, '5': v.g5, '3.5': v.g35 }, source_url: BASE });
    }
  }
  console.error(en + ': ' + insts.length + ' institutions');
  await sleep(2500);
}
if(unknownGroups.size) console.error('group names not recognised (skipped):', [...unknownGroups].join(', '));
console.error('institutions: ' + institutions + ', rows: ' + out.length + ', failing checks: ' + failing);
process.stdout.write(JSON.stringify(out));
