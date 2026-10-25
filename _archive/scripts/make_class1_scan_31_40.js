const XLSX = require('xlsx');

const students = [
  {
    name: 'জুরনা বেগম', father: 'সন্দেক মিয়া', father_mobile: '',
    dakhila: '', form_no: '৭৩৫', photo: '31.jpg',
  },
  {
    name: 'জুমাইন আক্তার', father: 'আলেমসার মিয়া', father_mobile: '',
    dakhila: '', form_no: '৬১৬', photo: '32.jpg',
  },
  {
    name: 'মুদ্দাসিব হুসেন ছাইন', father: 'মুতাসিম হুসেন খান', father_mobile: '01763562000',
    dakhila: '২৪৬', form_no: '২৮৬', photo: '33.jpg',
  },
  {
    name: 'দিলকরা হকা আম্বরা', father: 'মুফতি তাজরুল হক কায়মি', father_mobile: '01748722022',
    dakhila: '২৬০', form_no: '১০৫', photo: '34.jpg',
  },
  {
    name: 'মাফুলুল আজাত বান্দলা', father: 'মইন উদ্দিন', father_mobile: '01777310309',
    dakhila: '১৭৬', form_no: '১০৪', photo: '35.jpg',
  },
  {
    name: 'মাহিন মিয়া', father: 'মোঃ মরু মিয়া', father_mobile: '',
    dakhila: '৭১৫', form_no: '২৩', photo: '36.jpg',
  },
  {
    name: 'সাইদ আহমদ রামিম', father: 'মুতাহিদ মিয়া', father_mobile: '01632013630',
    dakhila: '৭৯৭', form_no: '২৮', photo: '37.jpg',
  },
  {
    name: 'হাবির মিয়া', father: 'মুতামুর রহমান', father_mobile: '01756636490',
    dakhila: '৭৫৭', form_no: '২০৬', photo: '38.jpg',
  },
  {
    name: 'নিহাদ মিতা', father: 'রাচা মিয়া', father_mobile: '01790055336',
    dakhila: '৮৬২', form_no: '৯৮', photo: '39.jpg',
  },
  {
    name: 'নুছরত মাসুম নাঈমা', father: 'মোবারকুর মোহাম্মদ', father_mobile: '01963823262',
    dakhila: '৭৮৭', form_no: '২০৬', photo: '40.jpg',
  },
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
const outPath = 'C:\\Users\\Tayef\\Downloads\\1st papre\\protishthan-complete-v211\\Form\\১ম শ্রেনী\\১ম শ্রেণী - scan 31-40.xlsx';
XLSX.writeFile(wb, outPath);
console.log('Done:', outPath);
