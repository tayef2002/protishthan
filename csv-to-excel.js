const XLSX = require('xlsx');
const fs = require('fs');

const csvPath = 'Form\\students_FINAL.csv';
const outPath = 'Form\\students_FINAL.xlsx';

const csvContent = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
const wb = XLSX.read(csvContent, { type: 'string', codepage: 65001 });

// Style: header row bold + color
const ws = wb.Sheets[wb.SheetNames[0]];
const range = XLSX.utils.decode_range(ws['!ref']);

// Set column widths
const cols = [
  {wch:20},{wch:12},{wch:20},{wch:16},{wch:20},{wch:16},
  {wch:8},{wch:14},{wch:16},{wch:16},{wch:14},{wch:14},{wch:12},
  {wch:16},{wch:14},{wch:14},{wch:12},{wch:18},{wch:10},
  {wch:20},{wch:12},{wch:10},{wch:10},{wch:12},{wch:10},
  {wch:12},{wch:14},{wch:14},{wch:22},{wch:30}
];
ws['!cols'] = cols;

// Freeze top row
ws['!freeze'] = { xSplit: 0, ySplit: 1 };

XLSX.writeFile(wb, outPath);
console.log('✅ Excel file তৈরি হয়েছে:', outPath);
console.log('📊 মোট rows:', range.e.r);
