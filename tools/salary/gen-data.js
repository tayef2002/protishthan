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
const FAMILIES = [
  // id, name, group, multiplier on the group mean (a PRIOR, confidence C), a note shown on the method page
  ['it', 'আইটি ও সফটওয়্যার', 'professionals', 1.30, 'আইটিতে পেশাজীবী গড়ের চেয়ে বেশি দেওয়া হয় বলে ধরা হয়েছে (অনুমান, তথ্য জমলে ঠিক হবে)'],
  ['finance', 'হিসাব ও অর্থ', 'professionals', 1.00, ''], ['bank', 'ব্যাংক ও বিমা', 'professionals', 1.15, 'প্রকাশিত জরিপে ব্যাংকের গড় সব খাতের গড়ের ওপরে'],
  ['teach', 'শিক্ষকতা (স্কুল, কোচিং, বিশ্ববিদ্যালয়)', 'professionals', 0.80, 'বেসরকারি শিক্ষকতায় বেতন তুলনামূলক কম ধরা হয়েছে (অনুমান)'],
  ['engineer', 'প্রকৌশল (সিভিল, ইইই, মেকানিক্যাল...)', 'professionals', 1.10, ''], ['health', 'স্বাস্থ্য (চিকিৎসক, ফার্মাসিস্ট)', 'professionals', 1.15, ''],
  ['ngo', 'এনজিও ও উন্নয়ন', 'professionals', 0.95, ''], ['design', 'ডিজাইন ও মিডিয়া', 'professionals', 0.95, ''],
  ['manager', 'ম্যানেজার ও প্রশাসন (উচ্চ পদ)', 'managers', 1.00, ''], ['office', 'অফিস সহকারী ও প্রশাসন', 'clerical', 1.00, ''],
  ['sales', 'বিক্রয় ও মার্কেটিং', 'sales', 1.00, ''], ['service', 'কাস্টমার সার্ভিস ও কল সেন্টার', 'sales', 1.05, ''],
  ['merch', 'গার্মেন্টস মার্চেন্ডাইজিং, কোয়ালিটি ও অফিস', 'technicians', 0.95, ''], ['tech', 'কারিগরি সহকারী (ল্যাব, নার্স, সুপারভাইজার...)', 'technicians', 1.00, ''],
  ['operator', 'কারখানার অপারেটর ও অ্যাসেম্বলার', 'operators', 1.00, 'গার্মেন্টসের সর্বনিম্ন মজুরি ১২,৫০০ টাকা (ডিসেম্বর ২০২৩), এর নিচে দেখানো হয় না'],
  ['craft', 'দক্ষ কারিগর (ইলেকট্রিশিয়ান, মিস্ত্রি, মেকানিক...)', 'craft', 1.00, ''], ['elementary', 'সাধারণ শ্রম', 'elementary', 1.00, '']
].map(([id, name, group, mult, note]) => ({ id, name, group, mult, note }));
const EDU = [['below', 'এসএসসির নিচে', 8], ['ssc', 'এসএসসি বা সমমান', 10], ['hsc', 'এইচএসসি বা সমমান', 12], ['diploma', 'ডিপ্লোমা (পলিটেকনিক)', 14], ['hons', 'স্নাতক (অনার্স, ডিগ্রি, বিএসসি...)', 16], ['masters', 'স্নাতকোত্তর', 18]].map(([id, name, years]) => ({ id, name, years }));
const CITY = [['dhaka', 'ঢাকা', 1.10, 'urban'], ['bigcity', 'চট্টগ্রাম ও অন্য সিটি করপোরেশন', 1.00, 'urban'], ['town', 'জেলা শহর', 0.92, 'urban'], ['village', 'উপজেলা ও গ্রাম', 1.00, 'rural']].map(([id, name, mult, area]) => ({ id, name, mult, area }));
const EMPLOYER = [['small', 'ছোট ব্যবসা বা দোকান', 0.95], ['local', 'মাঝারি বা বড় দেশি প্রতিষ্ঠান', 1.08], ['mnc', 'বহুজাতিক বা বড় গ্রুপ', 1.20], ['ngo', 'এনজিও বা উন্নয়ন সংস্থা', 1.05], ['startup', 'স্টার্টআপ', 1.00], ['school', 'বেসরকারি স্কুল, কলেজ বা কোচিং', 0.92]].map(([id, name, mult]) => ({ id, name, mult }));
const JOBTYPE = [['full', 'পূর্ণ সময়', 1.0], ['part', 'খণ্ডকালীন', 0.6]].map(([id, name, mult]) => ({ id, name, mult }));
// skills: premium in LOG points (0.10 is about +10 %); a prior, not a measurement. English: the research finds 20-30 % for fluent users against none.
const SKILLS = [
  ['en_good', 'ইংরেজি: ভালো (পড়া, লেখা, কাজ চালানো)', 'ইংরেজি', 0.07, 'en'], ['en_fluent', 'ইংরেজি: দক্ষ (সাবলীল বলা ও লেখা)', 'ইংরেজি', 0.15, 'en'], ['ielts', 'IELTS ৬.৫ বা তার বেশি', 'ইংরেজি', 0.05, ''],
  ['excel', 'Excel: উন্নত (সূত্র, পিভট)', 'কম্পিউটার', 0.05, ''], ['accsw', 'হিসাবের সফটওয়্যার (Tally, QuickBooks...)', 'কম্পিউটার', 0.04, ''],
  ['prog', 'প্রোগ্রামিং (কোড লিখতে পারেন)', 'প্রযুক্তি', 0.10, ''], ['sql', 'ডেটাবেস ও SQL', 'প্রযুক্তি', 0.04, ''], ['dataviz', 'ডেটা বিশ্লেষণ ও ড্যাশবোর্ড', 'প্রযুক্তি', 0.05, ''],
  ['designsw', 'ডিজাইন সফটওয়্যার (Photoshop, Figma...)', 'প্রযুক্তি', 0.05, ''], ['digimkt', 'ডিজিটাল মার্কেটিং', 'প্রযুক্তি', 0.05, ''],
  ['cert', 'পেশাদার সার্টিফিকেট (ACCA, CA, PMP, CCNA...)', 'সার্টিফিকেট', 0.10, ''], ['lang2', 'তৃতীয় ভাষা (আরবি, জাপানি, চীনা, জার্মান...)', 'ভাষা', 0.06, ''],
  ['driving', 'ড্রাইভিং লাইসেন্স', 'অন্যান্য', 0.03, ''], ['typing', 'দ্রুত টাইপিং (বাংলা ও ইংরেজি)', 'অন্যান্য', 0.02, ''],
  ['intern', 'ইন্টার্নশিপ বা শিক্ষানবিশির অভিজ্ঞতা', 'প্রমাণ', 0.03, ''], ['portfolio', 'পোর্টফোলিও, GitHub বা দেখানোর মতো কাজ', 'প্রমাণ', 0.04, ''],
  ['freelance', 'ফ্রিল্যান্সিংয়ে আয়ের প্রমাণ', 'প্রমাণ', 0.05, ''], ['lead', 'নেতৃত্বের ভূমিকা (ক্লাব, দল, প্রকল্প)', 'প্রমাণ', 0.03, '']
].map(([id, name, group, premium, excl]) => ({ id, name, group, premium, excl }));
const PARAMS = {
  eduReturn: 0.075,                                  // per year of schooling, the order found for Bangladesh (Asadullah 2006 and later work), a prior
  expB1: 0.035, expB2: -0.0005, expRef: 12, expMax: 35,   // the curve of pay with experience, normalised to a worker with 12 years
  eduClip: [0.5, 2.0], skillCapFresh: 0.30, skillCapExp: 0.22, freshYears: 3,
  cgpa: { hi: [3.75, 0.03], lo: [2.5, -0.03] },     // only for a fresher
  wageGrowth: 0.06, dataYear: 2024.5,                // the survey is of 2024: older numbers are moved to today with a yearly growth of 6 % (the survey itself shows 13.8 % in two years)
  sigma: 0.42,                                       // the spread of pay between people of the same profile (log points); a prior, to be measured
  garmentFloor: 12500,
  gov: { scale: 'নবম জাতীয় পে-স্কেল (২০২৬)', grade20Basic: 20000, grade9Basic: 44000, grade1Basic: 156000 }
};
const data = { v: 'A1', built: new Date().toISOString().slice(0, 10), survey: { name: 'BBS শ্রমশক্তি জরিপ ২০২৪ (মাসিক মজুরি-বেতন, গড়)', year: 2024, total2022: L.y2022.occupation.find(r => r.label === 'Total').v.all, total2024: L.y2024.occupation.find(r => r.label === 'Total').v.all }, groups: GROUPS, families: FAMILIES, edu: EDU, city: CITY, employer: EMPLOYER, jobtype: JOBTYPE, skills: SKILLS, params: PARAMS };
const out = '/* made by tools/salary/gen-data.js from tools/salary/lfs-tables.json: do not edit by hand. STAGE A: priors marked as such, see plans/salary-calculator-plan.md */\n(function(root){\n  var DATA = ' + JSON.stringify(data) + ';\n  root.SALARY_DATA = DATA; if(typeof module !== "undefined" && module.exports) module.exports = DATA;\n})(typeof window !== "undefined" ? window : globalThis);\n';
fs.writeFileSync(path.join(__dirname, '..', '..', 'salary-data.js'), out);
console.log('salary-data.js written:', GROUPS.length, 'groups,', FAMILIES.length, 'families,', SKILLS.length, 'skills,', Math.round(out.length / 1024) + ' KB');
