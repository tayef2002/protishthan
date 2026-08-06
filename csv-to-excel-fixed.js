const XLSX = require('xlsx');
const fs = require('fs');

const csvPath = 'Form\\students_FINAL_fixed.csv';
const outPath = 'Form\\students_FINAL_fixed.xlsx';

const csvContent = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
const wb = XLSX.read(csvContent, { type: 'string', codepage: 65001 });

const ws = wb.Sheets[wb.SheetNames[0]];
const range = XLSX.utils.decode_range(ws['!ref']);

const cols = [
  {wch:20},{wch:6},{wch:12},{wch:20},{wch:16},{wch:20},{wch:16},
  {wch:8},{wch:14},{wch:16},{wch:16},{wch:14},{wch:14},{wch:14},
  {wch:14},{wch:14},{wch:14},{wch:16},{wch:12},{wch:18},
  {wch:14},{wch:14},{wch:12},{wch:10},{wch:18},{wch:10},
  {wch:20},{wch:14},{wch:14},{wch:22},{wch:30}
];
ws['!cols'] = cols;
ws['!freeze'] = { xSplit: 0, ySplit: 1 };

XLSX.writeFile(wb, outPath);
console.log('✅ Excel file তৈরি হয়েছে:', outPath);
console.log('📊 মোট rows:', range.e.r);
