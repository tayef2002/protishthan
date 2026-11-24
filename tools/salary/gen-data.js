// Makes salary-data.js (the tables of the tool ন্যায্য বেতন) from the Labour Force Survey numbers (lfs-tables.json) and the stated parameters below.   node tools/salary/gen-data.js
// STAGE A (first version): the starting point is the OFFICIAL mean wage of an occupation group (BBS Labour Force Survey), moved to a profile with a Mincer-type model whose
// parameters are priors from the research on Bangladesh. Everything that is a prior and not a measurement is marked confidence "C" and is shown as an estimate.
// The survey microdata and the reports of the users will replace the priors (plan: plans/salary-calculator-plan.md, part 12).
const fs = require('fs'), path = require('path');
const L = JSON.parse(fs.readFileSync(path.join(__dirname, 'lfs-tables.json'), 'utf8'));
const occ = {}; L.y2024.occupation.forEach(r => { occ[r.label] = { urban: r.v.urban, rural: r.v.rural, all: r.v.all }; });
const occ22 = {}; L.y2022.occupation.forEach(r => { occ22[r.label] = r.v.all; });
const GROUPS = [
  ['managers', 'Managers', 'ম্যানেজার ও উচ্চপদ', 15], ['professionals', 'Professionals', 'পেশাজীবী (প্রকৌশলী, শিক্ষক, চিকিৎসক, আইটি, হিসাব...)', 16],
  ['technicians', 'Technicians and Associate Professionals', 'কারিগরি ও সহযোগী পেশাজীবী', 14], ['clerical', 'Clerical Support Workers', 'অফিস ও করণিক কাজ', 13],
  ['sales', 'Service and Sales Workers', 'সেবা ও বিক্রয়', 10], ['craft', 'Craft and Related Trades Workers', 'কারিগর (দক্ষ হাতের কাজ)', 8],
  ['operators', 'Plant and Machine Operators, and Assembler', 'যন্ত্র চালক ও অ্যাসেম্বলার (গার্মেন্টস কারখানার অপারেটর...)', 8], ['elementary', 'Elementary Occupations', 'সাধারণ শ্রম', 6]
].map(([id, lfs, name, typicalYears]) => ({ id, lfs, name, typicalYears, urban: occ[lfs].urban, rural: occ[lfs].rural, all: occ[lfs].all, all2022: occ22[lfs] }));
const { FAMILIES, SKILLS } = require('./profiles.js');
const EDU = [['below', 'এসএসসির নিচে', 8], ['ssc', 'এসএসসি বা সমমান', 10], ['hsc', 'এইচএসসি বা সমমান', 12], ['diploma', 'ডিপ্লোমা (পলিটেকনিক)', 14], ['hons', 'স্নাতক (অনার্স, ডিগ্রি, বিএসসি...)', 16], ['masters', 'স্নাতকোত্তর', 18]].map(([id, name, years]) => ({ id, name, years }));
const CITY = [['dhaka', 'ঢাকা', 1.10, 'urban'], ['bigcity', 'চট্টগ্রাম ও অন্য সিটি করপোরেশন', 1.00, 'urban'], ['town', 'জেলা শহর', 0.92, 'urban'], ['village', 'উপজেলা ও গ্রাম', 1.00, 'rural']].map(([id, name, mult, area]) => ({ id, name, mult, area }));
const JOBTYPE = [['full', 'পূর্ণ সময়', 1.0], ['part', 'খণ্ডকালীন', 0.6]].map(([id, name, mult]) => ({ id, name, mult }));
const PARAMS = {
  eduReturn: 0.075, eduReturnBy: { managers: 0.075, professionals: 0.075, technicians: 0.06, clerical: 0.05, sales: 0.04, craft: 0.03, operators: 0.02, elementary: 0.02 },   // a year of schooling pays less in plain work than in a profession (priors)
                                   // per year of schooling, the order found for Bangladesh (Asadullah 2006 and later work), a prior
  expB1: 0.035, expB2: -0.0005, expRef: 12, expMax: 35,   // the curve of pay with experience, normalised to a worker with 12 years
  eduClip: [0.5, 2.0], skillCapFresh: 0.30, skillCapExp: 0.22, freshYears: 3,
  cgpa: { hi: [3.75, 0.03], lo: [2.5, -0.03] },     // only for a fresher
  wageGrowth: 0.06, dataYear: 2024.5,                // the survey is of 2024: older numbers are moved to today with a yearly growth of 6 % (the survey itself shows 13.8 % in two years)
  sigma: 0.42,                                       // the spread of pay between people of the same profile (log points); a prior, to be measured
  garmentFloor: 12500,
  gov: { scale: 'নবম জাতীয় পে-স্কেল (২০২৬)', grade20Basic: 20000, grade9Basic: 44000, grade1Basic: 156000 }
};
const data = { v: 'A2', built: new Date().toISOString().slice(0, 10), survey: { name: 'BBS শ্রমশক্তি জরিপ ২০২৪ (মাসিক মজুরি-বেতন, গড়)', year: 2024, total2022: L.y2022.occupation.find(r => r.label === 'Total').v.all, total2024: L.y2024.occupation.find(r => r.label === 'Total').v.all }, groups: GROUPS, families: FAMILIES, edu: EDU, city: CITY, jobtype: JOBTYPE, skills: SKILLS, params: PARAMS };
const out = '/* made by tools/salary/gen-data.js from tools/salary/lfs-tables.json: do not edit by hand. STAGE A: priors marked as such, see plans/salary-calculator-plan.md */\n(function(root){\n  var DATA = ' + JSON.stringify(data) + ';\n  root.SALARY_DATA = DATA; if(typeof module !== "undefined" && module.exports) module.exports = DATA;\n})(typeof window !== "undefined" ? window : globalThis);\n';
fs.writeFileSync(path.join(__dirname, '..', '..', 'salary-data.js'), out);
console.log('salary-data.js written:', GROUPS.length, 'groups,', FAMILIES.length, 'families,', FAMILIES.reduce((n, f) => n + f.roles.length, 0), 'roles,', SKILLS.length, 'skills,', Math.round(out.length / 1024) + ' KB');
