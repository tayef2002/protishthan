const XLSX = require('xlsx');

const students = [
  { name: 'আমেছার আবদুসুম',       father: 'বশির আহমদ',          father_mobile: '01748779795', dakhila: '৭৯২', form_no: '২০১', photo: '41.jpg' },
  { name: 'নাবিনা আক্তার নাচুয়া', father: 'আরতু মিয়া',          father_mobile: '01923622561', dakhila: '২৮০', form_no: '৩০',  photo: '42.jpg' },
  { name: 'মাহাদী চৌধুরী',         father: 'হুমন উদ্দিন',         father_mobile: '01743219860', dakhila: '৭০৫', form_no: '২২৯', photo: '43.jpg' },
  { name: 'আমিনা ইবনাত ভান্দেসান', father: 'কিছু মিয়া',          father_mobile: '01932260619', dakhila: '২০৭', form_no: '১৯৮', photo: '44.jpg' },
  { name: 'মেহদী হাসান হুমন',       father: 'নরম আমিন',           father_mobile: '01976386218', dakhila: '২১৬', form_no: '২২৬', photo: '45.jpg' },
  { name: 'নুছবত জায়ান ফারিয়া',   father: 'কামিম আহমদ',         father_mobile: '',            dakhila: '২৮৭', form_no: '২১৮', photo: '46.jpg' },
  { name: 'আমানি আক্তার বর্শমা',   father: 'নূরতু',              father_mobile: '01903011356', dakhila: '২১৭', form_no: '২২৮', photo: '47.jpg' },
  { name: 'অনাকরব আন্তাব',         father: 'আলখাচু মিয়া',       father_mobile: '01742670034', dakhila: '২১৫', form_no: '২২২', photo: '48.jpg' },
  { name: 'আনিছা আক্তার',          father: 'আলমাছ মিয়া',        father_mobile: '01966726840', dakhila: '২৬২', form_no: '২৩৬', photo: '49.jpg' },
  { name: 'মইনুল ইসনাব',           father: 'আহমুকুল ইসলাম',      father_mobile: '',            dakhila: '৭৬১', form_no: '২৬৯', photo: '50.jpg' },
  { name: 'মো: সুনান আন রিনন',     father: 'মো: ইমরান আন',       father_mobile: '01916519267', dakhila: '২৮০', form_no: '২৪৩', photo: '51.jpg' },
  { name: 'রনুব ইসলাম',            father: 'মো: আফজুল মিয়া',    father_mobile: '01635573847', dakhila: '৭০',  form_no: '৮৪',  photo: '52.jpg' },
  { name: 'হুমাইব আহমদ',           father: 'মো: আজিজুল হক',      father_mobile: '01836360079', dakhila: '২৮৯', form_no: '২৪২', photo: '53.jpg' },
];

const rows = students.map(s => ({
  'নাম': s.name,
  'শ্রেণী': '১ম শ্রেণী',
  'পিতার নাম': s.father,
  'পিতার মোবাইল': s.father_mobile,
  'মাতার নাম': '',
  'মাতার মোবাইল': '',
  'লিঙ্গ': '',
  'জন্মতারিখ': '',
  'শিক্ষার্থীর মোবাইল': '',
  'বর্তমান গ্রাম': '',
  'বর্তমান ডাক': '',
  'বর্তমান উপজেলা': '',
  'বর্তমান জেলা': '',
  'স্থায়ী গ্রাম': '',
  'স্থায়ী ডাক': '',
  'স্থায়ী উপজেলা': '',
  'স্থায়ী জেলা': '',
  'অভিভাবকের নাম': '',
  'সম্পর্ক': '',
  'আগের প্রতিষ্ঠান': '',
  'আগের শ্রেণী': '',
  'বিভাগ': '',
  'মাসিক ফি': '',
  'দাখিলা নং': s.dakhila,
  'ফর্ম নং': s.form_no,
  'নতুন/পুরাতন': '',
  'শিক্ষাবর্ষ হিজরি': '১৪৪৭/৪৮',
  'শিক্ষাবর্ষ ইংরেজি': '২০২৬/২৭',
  'ছবির ফাইল': s.photo,
}));

const ws = XLSX.utils.json_to_sheet(rows);
ws['!cols'] = Array(29).fill({wch: 18});
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, '১ম শ্রেণী scan');
const outPath = 'C:\\Users\\Tayef\\Downloads\\1st papre\\protishthan-complete-v211\\Form\\১ম শ্রেনী\\১ম শ্রেণী - scan 41-53.xlsx';
XLSX.writeFile(wb, outPath);
console.log('Done:', outPath);
