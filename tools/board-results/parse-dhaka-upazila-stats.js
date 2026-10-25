// Parse a Dhaka Board "Zilla & Upazila Wise Result Statistics" PDF into institution rows.
// usage: node parse-dhaka-upazila-stats.js <file.pdf> <EXAM> <YEAR> [source_url] > out.json
// Each institution block has 4 rows (science / humanities / business / total) and, by x position,
// columns: appeared, GPA 5, 4-<5, 3.5-<4, 3-<3.5, 2-<3, 1-<2, total pass, % of pass.
'use strict';
const { pages } = require('./pdftext');

// numbers are right-aligned, so a cell is matched to the column whose right edge is nearest
const COLS = [['appeared', 426], ['g5', 473], ['g4', 507], ['g35', 555], ['g3', 600], ['g2', 645], ['g1', 688], ['passed', 738], ['pct', 804]];
const GLYPH = 5.04;   // digit width at 10.08pt
const ROWS = [['science', 40], ['humanities', 24], ['business', 10], ['total', -4]];   // y offset from the "EIIN" label

function parse(file){
  const out = [];
  for(const items of pages(file)){
    const eiins = items.filter(it => /^\d{6}$/.test(it.s.trim()) && it.x > 100 && it.x < 130);
    for(const e of eiins){
      const near = it => it.y > e.y - 9 && it.y < e.y + 48;
      // name: text left of the numbers, above the EIIN line
      const name = items.filter(it => near(it) && it.x < 340 && it.y > e.y + 2 && !/^\s*\d+\s*$/.test(it.s)).sort((a, b) => b.y - a.y || a.x - b.x).map(it => it.s).join('').replace(/\s+/g, ' ').trim();
      const parts = name.split(',').map(s => s.trim()).filter(Boolean);
      const code = parts.length && /^\d+$/.test(parts[parts.length - 1]) ? parts.pop() : '';
      const zilla = parts.length > 2 ? parts.pop() : '';
      const upazila = parts.length > 1 ? parts.pop() : '';
      const rec = { eiin: e.s.trim(), institution_name: parts.join(', '), upazila, district: zilla, inst_code: code, groups: {} };
      for(const [grp, dy] of ROWS){
        const rowItems = items.filter(it => Math.abs(it.y - (e.y + dy)) < 4 && it.x > 390);
        const g = {};
        COLS.forEach(([key]) => { g[key] = 0; });
        for(const it of rowItems){
          const v = it.s.trim();
          if(!/^[\d.,]+$/.test(v)) continue;            // big counts are printed with commas, e.g. "3,085"
          const commas = (v.match(/,/g) || []).length;
          const right = it.x + (v.length - commas) * GLYPH + commas * GLYPH / 2;
          let best = null, dist = Infinity;
          for(const [key, edge] of COLS){ const d = Math.abs(edge - right); if(d < dist){ dist = d; best = key; } }
          if(dist < 14) g[best] = Number(v.replace(/,/g, ''));
        }
        rec.groups[grp] = g;
      }
      // the Total row's grade cells are not the sum of the groups in these PDFs; rebuild them from the groups
      const t = rec.groups.total, gs = ['science', 'humanities', 'business'].map(k => rec.groups[k]);
      ['g5', 'g4', 'g35', 'g3', 'g2', 'g1'].forEach(k => { t[k] = gs.reduce((sum, g) => sum + (g[k] || 0), 0); });
      out.push(rec);
    }
  }
  return out;
}

function check(rec){
  const t = rec.groups.total, parts = ['science', 'humanities', 'business'].map(k => rec.groups[k]);
  const sum = k => parts.reduce((s, g) => s + (g[k] || 0), 0);
  const issues = [];
  if(sum('appeared') !== t.appeared) issues.push('appeared');
  if(sum('passed') !== t.passed) issues.push('passed');
  const bands = t.g5 + t.g4 + t.g35 + t.g3 + t.g2 + t.g1;
  if(bands !== t.passed) issues.push('bands');
  if(t.appeared && Math.abs(t.passed * 100 / t.appeared - t.pct) > 0.06) issues.push('pct');
  return issues;
}

if(require.main === module){
  const [file, exam, year, src] = process.argv.slice(2);
  const recs = parse(file);
  let bad = 0;
  const rows = [];
  for(const r of recs){
    const issues = check(r);
    if(issues.length) bad++;
    for(const [grp, g] of Object.entries(r.groups)){
      if(grp !== 'total' && !g.appeared) continue;
      rows.push({ exam, year: +year, board: 'dhaka', eiin: r.eiin, institution_name: r.institution_name, district: r.district, upazila: r.upazila, grp,
        appeared: g.appeared, passed: g.passed, gpa5: g.g5,
        gpa_bands: { '5': g.g5, '4': g.g4, '3.5': g.g35, '3': g.g3, '2': g.g2, '1': g.g1 }, source_url: src || null, _issues: grp === 'total' ? issues : undefined });
    }
  }
  console.error(`institutions: ${recs.length}, failing checks: ${bad}`);
  process.stdout.write(JSON.stringify(rows));
}
module.exports = { parse, check };
