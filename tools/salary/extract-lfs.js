// Reads the published tables of the BBS Labour Force Survey and writes tools/salary/lfs-tables.json (the numbers the salary tool starts from).
//   node tools/salary/extract-lfs.js <LFS-2024 Excel file> <LFS-2022 report text>
// LFS 2024 final report (Excel): https://bbs.gov.bd/site/page/111d09ce-718a-4ae6-8188-f7d938ada348/Labor-&-Employment  (Table 10.4.1, 10.5.1, 10.6.1: average monthly income from employment, wage/salary, in Taka)
// LFS 2022 final report (PDF text, the same tables). Public statistics of the Bangladesh Bureau of Statistics; the method page of the tool cites them.
const fs = require('fs'), path = require('path');
const [x24, t22] = [process.argv[2], process.argv[3]];
if (!x24 || !t22) { console.error('usage: node tools/salary/extract-lfs.js <lfs2024.xlsx> <lfs2022.txt>'); process.exit(2); }
const X = require(path.join(process.env.TEMP || '/tmp', 'lfs', 'node_modules', 'xlsx'));
const cols = ['rural_m', 'rural_f', 'rural', 'urban_m', 'urban_f', 'urban', 'all_m', 'all_f', 'all'];
const row = (label, nums) => ({ label, v: Object.fromEntries(cols.map((c, i) => [c, nums[i]])) });
const OCC = ['Managers', 'Professionals', 'Technicians and Associate Professionals', 'Clerical Support Workers', 'Service and Sales Workers', 'Skilled Agricultural, Forestry and Fisheries', 'Craft and Related Trades Workers', 'Plant and Machine Operators, and Assembler', 'Elementary Occupations', 'Other Occupations', 'Total'];

// ---- 2024 from the Excel file
const wb = X.readFile(x24), rows = X.utils.sheet_to_json(wb.Sheets['Chapter 10'], { header: 1, defval: '' });
const take = (start, labels) => { const out = []; for (let i = start; i < start + 40 && i < rows.length; i++) { if (i > start && String(rows[i][0]).startsWith('Table')) break; const r = rows[i].filter(x => x !== ''); const lab = String(r[0] || '').trim(); const hit = labels.find(l => l === lab); if (hit && r.length >= 10) out.push(row(hit, r.slice(1, 10).map(Number))); } return out; };
const iOcc = rows.findIndex(r => String(r[0]).startsWith('Table 10.4.1')), iAge = rows.findIndex(r => String(r[0]).startsWith('Table 10.5.1')), iSec = rows.findIndex(r => String(r[0]).startsWith('Table 10.6.1'));
const AGE = ['15-29', '30-64', '65+', 'Total'], SEC = ['Agriculture', 'Industry', 'Service', 'Total'];
rows.slice(iAge).forEach(r => { r[0] = String(r[0]).replace(/\s+/g, ''); });
const y24 = { occupation: take(iOcc, OCC), age: take(iAge, AGE), sector: take(iSec, SEC) };

// ---- 2022 from the text of the PDF report
const lines = fs.readFileSync(t22, 'utf8').split('\n');
const s0 = lines.findIndex(l => /^Table 10\.4\.1 Average monthly income/.test(l));
const grab = (from, labels) => { const out = []; for (let i = from; i < from + 40; i++) { if (i > from && /^Table /.test((lines[i] || '').trim())) break; const l = (lines[i] || '').trim().replace(/\s+/g, ' '); for (const lab of labels) if (l.startsWith(lab + ' ')) { const nums = l.slice(lab.length).trim().split(' ').map(Number).filter(n => !isNaN(n)); if (nums.length === 9) out.push(row(lab, nums)); } } return out; };
const a0 = lines.findIndex((l, i) => i > s0 && /^Table 10\.5\.1 Average monthly income/.test(l));
const y22 = { occupation: grab(s0, OCC), age: grab(a0, ['15-29', '30-64', '64+', 'Total']).map(r => r.label === '64+' ? { ...r, label: '65+' } : r) };

const check = (y, n) => { if (y.occupation.length !== 11) throw new Error(n + ': occupation rows ' + y.occupation.length); if (y.age.length !== 4) throw new Error(n + ': age rows ' + y.age.length); const bad = [...y.occupation, ...y.age].filter(r => Object.values(r.v).some(v => !(v > 0))); if (bad.length) throw new Error(n + ': a number is missing in ' + bad.map(b => b.label).join(', ')); };
check(y24, '2024'); check(y22, '2022');
const out = { note: 'Average monthly income from employment (wage or salary) of employed persons, in Taka, BBS Labour Force Survey. A MEAN over all ages, all education levels and the informal sector, not a median.', area: cols, y2022: y22, y2024: y24 };
fs.writeFileSync(path.join(__dirname, 'lfs-tables.json'), JSON.stringify(out, null, 1));
const f = (a, b, lab) => { const p = a.occupation.find(r => r.label === lab).v.all, q = b.occupation.find(r => r.label === lab).v.all; return lab + ': ' + p + ' -> ' + q + ' (' + ((q / p - 1) * 100).toFixed(1) + ' %)'; };
console.log('written; growth 2022 to 2024 (all Bangladesh):\n ' + ['Professionals', 'Managers', 'Clerical Support Workers', 'Service and Sales Workers', 'Total'].map(l => f(y22, y24, l)).join('\n '));
