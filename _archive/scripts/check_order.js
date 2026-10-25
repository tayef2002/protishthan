const fs = require('fs');
const XLSX = require('xlsx');

function parseCSVLine(line) {
  const result = []; let field = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; }
    else if (line[i] === ',' && !inQuotes) { result.push(field); field = ''; }
    else field += line[i];
  }
  result.push(field); return result;
}

// Step 1: Get ২য় শ্রেনী photos from big CSV in scan-processing order
const bigContent = fs.readFileSync('Form/students_1784355974140.csv','utf8').replace(/^﻿/,'');
const bigLines = bigContent.split('\n').filter(l => l.trim());
const bigHeaders = parseCSVLine(bigLines[0]);
const bigClsIdx = bigHeaders.findIndex(h => h.includes('শ্রেণী'));
// Photo filename is usually the last non-empty col - find it
console.log('Big CSV headers count:', bigHeaders.length);
console.log('Last 5 headers:', bigHeaders.slice(-5).join(' | '));

const cls2Photos = []; // photos in scan-processing order
bigLines.slice(1).forEach(line => {
  const f = parseCSVLine(line);
  const cls = f[bigClsIdx] || '';
  if (cls.codePointAt(0) === 0x09E8) { // ২
    // Find photo filename (look for .jpg in fields)
    const photoField = f.find(v => v && v.includes('.jpg'));
    cls2Photos.push(photoField || '');
  }
});

console.log('\n২য় শ্রেনী photos in SCAN order (big CSV):');
cls2Photos.forEach((p, i) => console.log((i+1) + '. ' + p));

// Step 2: Get ২য় শ্রেনী students from scan CSV in scan order
const scanContent = fs.readFileSync('Form/students_claude_scan.csv','utf8').replace(/^﻿/,'');
const scanLines = scanContent.split('\n').filter(l => l.trim());
const scanHeaders = parseCSVLine(scanLines[0]).map(h => h.replace(/^﻿/,'').trim());
const scanClsIdx = scanHeaders.findIndex(h => h.includes('শ্রেণী'));

const scanCls2 = [];
scanLines.slice(1).forEach(line => {
  const f = parseCSVLine(line);
  const cls = f[scanClsIdx] || '';
  if (cls.codePointAt(0) === 0x09E8) {
    const row = {};
    scanHeaders.forEach((h, idx) => { if (f[idx]) row[h] = f[idx]; });
    scanCls2.push(row);
  }
});

console.log('\n\nSCAN student order vs PHOTO order mapping:');
console.log('(scan student → scan-processing photo → timestamp position)');

// Folder photos sorted by timestamp
const filemap = JSON.parse(fs.readFileSync('Form/filemap.json','utf8').replace(/^﻿/,''));
const folderPhotos = filemap.filter(f => f.Class && f.Class.codePointAt(0) === 0x09E8)
  .sort((a,b) => a.Name.localeCompare(b.Name))
  .map(f => f.Name);

scanCls2.forEach((s, i) => {
  const photo = cls2Photos[i] || '?';
  const folderPos = folderPhotos.indexOf(photo) + 1;
  console.log(`Scan #${i+1}: ${s['নাম'] || '?'} → ${photo} → folder pos ${folderPos}`);
});
