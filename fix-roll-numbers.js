const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'Form', 'students_FINAL.csv');
const outCsv = path.join(__dirname, 'Form', 'students_FINAL_fixed.csv');

const raw = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
const lines = raw.split('\n').filter(l => l.trim());
let headers = lines[0].split(',');

const classIdx = headers.indexOf('শ্রেণী');
const fileIdx = headers.indexOf('ছবির ফাইল');

// Add রোল column at position 1 (after নাম) if not present
let rollIdx = headers.indexOf('রোল');
if (rollIdx === -1) {
  headers.splice(1, 0, 'রোল');
  rollIdx = 1;
  // Shift fileIdx since we inserted a column before it
}
const newFileIdx = headers.indexOf('ছবির ফাইল');

console.log('Headers:', headers.join(' | '));

function parseRow(line) {
  const cols = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ; }
    else if (line[i] === ',' && !inQ) { cols.push(cur); cur = ''; }
    else cur += line[i];
  }
  cols.push(cur);
  return cols;
}

const rows = lines.slice(1).map(line => {
  const cols = parseRow(line);
  // Insert empty রোল slot at position 1 (matching header)
  cols.splice(1, 0, '');
  return cols;
});

// Group by class (classIdx is now shifted by 1 too)
const newClassIdx = headers.indexOf('শ্রেণী');
const groups = {};
const classOrder = [];
for (const row of rows) {
  const cls = row[newClassIdx] || '';
  if (!groups[cls]) { groups[cls] = []; classOrder.push(cls); }
  groups[cls].push(row);
}

// Sort by filename ascending, assign roll 1,2,3...
const result = [];
for (const cls of classOrder) {
  const sorted = groups[cls].sort((a, b) => (a[newFileIdx]||'').localeCompare(b[newFileIdx]||''));
  sorted.forEach((row, i) => { row[rollIdx] = String(i + 1); });
  console.log(`${cls}: ${sorted.length} students (Roll 1=${sorted[0][0]}, Last=${sorted[sorted.length-1][0]})`);
  result.push(...sorted);
}

const csvOut = [headers.join(','), ...result.map(r => r.join(','))].join('\n');
fs.writeFileSync(outCsv, '﻿' + csvOut, 'utf8');
console.log(`\n✅ Saved: ${outCsv} (${result.length} students)`);
