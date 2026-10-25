const XLSX = require('xlsx');
const fs = require('fs');

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

const cls2Photos = [];
bigLines.slice(1).forEach(line => {
  const f = parseCSVLine(line);
  const cls = f[bigClsIdx] || '';
  if (cls.codePointAt(0) === 0x09E8) {
    const photoField = f.find(v => v && v.includes('.jpg'));
    cls2Photos.push(photoField || '');
  }
});

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

// Step 3: Folder photos in timestamp order
const filemap = JSON.parse(fs.readFileSync('Form/filemap.json','utf8').replace(/^﻿/,''));
const folderPhotos = filemap
  .filter(f => f.Class && f.Class.codePointAt(0) === 0x09E8)
  .sort((a, b) => a.Name.localeCompare(b.Name))
  .map(f => f.Name);

// Step 4: Build photo → scan student mapping
const photoToStudent = {};
scanCls2.forEach((student, i) => {
  const photo = cls2Photos[i];
  if (photo) photoToStudent[photo] = student;
});

// Step 5: Sort by folder position (timestamp order) to get correct serial
const ordered = folderPhotos.map((photo, i) => {
  const scanRow = photoToStudent[photo];
  if (!scanRow) {
    console.warn('No student found for photo:', photo);
    return { photo, student: null };
  }
  return { photo, student: scanRow };
});

// Step 6: Get full data from FINAL_fixed.xlsx
const wb = XLSX.readFile('Form/students_FINAL_fixed.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const allData = XLSX.utils.sheet_to_json(ws);
const finalCls2 = allData.filter(r => {
  const cls = (r['শ্রেণী'] || '');
  return cls.codePointAt(0) === 0x09E8;
});

// Match by name to get full data
const usedFinalIdx = new Set();
const finalRows = ordered.map(({ photo, student }, i) => {
  if (!student) return null;
  const scanName = (student['নাম'] || '').trim();

  let matchIdx = -1;
  for (let j = 0; j < finalCls2.length; j++) {
    if (usedFinalIdx.has(j)) continue;
    if ((finalCls2[j]['নাম'] || '').trim() === scanName) { matchIdx = j; break; }
  }
  if (matchIdx === -1) {
    // Partial match fallback
    for (let j = 0; j < finalCls2.length; j++) {
      if (usedFinalIdx.has(j)) continue;
      const fn = (finalCls2[j]['নাম'] || '').trim();
      if (fn.length > 3 && scanName.length > 3 && (fn.includes(scanName.substring(0,4)) || scanName.includes(fn.substring(0,4)))) {
        matchIdx = j; break;
      }
    }
  }

  let dataRow = student;
  if (matchIdx !== -1) {
    usedFinalIdx.add(matchIdx);
    dataRow = finalCls2[matchIdx];
  } else {
    console.warn('No FINAL match for:', scanName, '(using scan data)');
  }

  return {
    'নাম': dataRow['নাম'] || student['নাম'] || '',
    'শ্রেণী': '২য় শ্রেনী',
    'পিতার নাম': dataRow['পিতার নাম'] || student['পিতার নাম'] || '',
    'পিতার মোবাইল': dataRow['পিতার মোবাইল'] || student['পিতার মোবাইল'] || '',
    'মাতার নাম': dataRow['মাতার নাম'] || student['মাতার নাম'] || '',
    'মাতার মোবাইল': dataRow['মাতার মোবাইল'] || student['মাতার মোবাইল'] || '',
    'লিঙ্গ': dataRow['লিঙ্গ'] || student['লিঙ্গ'] || '',
    'জন্মতারিখ': dataRow['জন্মতারিখ'] || student['জন্মতারিখ'] || '',
    'শিক্ষার্থীর মোবাইল': dataRow['শিক্ষার্থীর মোবাইল'] || '',
    'বর্তমান গ্রাম': dataRow['বর্তমান গ্রাম'] || '',
    'বর্তমান ডাক': dataRow['বর্তমান ডাক'] || '',
    'বর্তমান উপজেলা': dataRow['বর্তমান উপজেলা'] || '',
    'বর্তমান জেলা': dataRow['বর্তমান জেলা'] || '',
    'স্থায়ী গ্রাম': dataRow['স্থায়ী গ্রাম'] || '',
    'স্থায়ী ডাক': dataRow['স্থায়ী ডাক'] || '',
    'স্থায়ী উপজেলা': dataRow['স্থায়ী উপজেলা'] || '',
    'স্থায়ী জেলা': dataRow['স্থায়ী জেলা'] || '',
    'অভিভাবকের নাম': dataRow['অভিভাবকের নাম'] || '',
    'সম্পর্ক': dataRow['সম্পর্ক'] || '',
    'আগের প্রতিষ্ঠান': dataRow['আগের প্রতিষ্ঠান'] || '',
    'আগের শ্রেণী': dataRow['আগের শ্রেণী'] || '',
    'বিভাগ': dataRow['বিভাগ'] || '',
    'মাসিক ফি': dataRow['মাসিক ফি'] || '',
    'দাখিলা নং': dataRow['দাখিলা নং'] || '',
    'ফর্ম নং': dataRow['ফর্ম নং'] || '',
    'নতুন/পুরাতন': dataRow['নতুন/পুরাতন'] || '',
    'শিক্ষাবর্ষ হিজরি': dataRow['শিক্ষাবর্ষ হিজরি'] || '',
    'শিক্ষাবর্ষ ইংরেজি': dataRow['শিক্ষাবর্ষ ইংরেজি'] || '',
    'ছবির ফাইল': photo,
  };
}).filter(Boolean);

// Step 7: Write output Excel
const outWb = XLSX.utils.book_new();
const outWs = XLSX.utils.json_to_sheet(finalRows, {
  header: [
    'নাম','শ্রেণী','পিতার নাম','পিতার মোবাইল','মাতার নাম','মাতার মোবাইল',
    'লিঙ্গ','জন্মতারিখ','শিক্ষার্থীর মোবাইল','বর্তমান গ্রাম','বর্তমান ডাক',
    'বর্তমান উপজেলা','বর্তমান জেলা','স্থায়ী গ্রাম','স্থায়ী ডাক',
    'স্থায়ী উপজেলা','স্থায়ী জেলা','অভিভাবকের নাম','সম্পর্ক',
    'আগের প্রতিষ্ঠান','আগের শ্রেণী','বিভাগ','মাসিক ফি','দাখিলা নং',
    'ফর্ম নং','নতুন/পুরাতন','শিক্ষাবর্ষ হিজরি','শিক্ষাবর্ষ ইংরেজি','ছবির ফাইল'
  ]
});

outWs['!cols'] = [
  {wch:22},{wch:14},{wch:20},{wch:14},{wch:20},{wch:14},
  {wch:8},{wch:14},{wch:14},{wch:18},{wch:16},{wch:16},{wch:12},
  {wch:18},{wch:16},{wch:16},{wch:12},{wch:20},{wch:10},
  {wch:20},{wch:12},{wch:14},{wch:10},{wch:12},{wch:10},{wch:12},
  {wch:14},{wch:14},{wch:28}
];
outWs['!freeze'] = { xSplit: 0, ySplit: 1 };

XLSX.utils.book_append_sheet(outWb, outWs, '২য় শ্রেনী');

const outPath = 'C:/Users/Tayef/Downloads/২য় শ্রেনী - fixed.xlsx';
XLSX.writeFile(outWb, outPath);

console.log('✅ Excel file তৈরি হয়েছে:', outPath);
console.log('📊 মোট rows:', finalRows.length);
console.log('\n📋 First 10 (folder/serial order → photo):');
finalRows.slice(0, 10).forEach((r, i) => {
  console.log(`  ${i+1}. ${r['নাম']} → ${r['ছবির ফাইল']}`);
});
