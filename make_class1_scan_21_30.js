const XLSX = require('xlsx');

const students = [
  {
    name: 'নাবিল আহমদ হাদি', class: '১ম শ্রেণী', father: 'বাসেল মিয়া', father_mobile: '01763306769',
    mother: 'ফার্জানা খাতুন', mother_mobile: '', gender: 'ছেলে', dob: '২৯-১০-২০১৮', student_mobile: '',
    village: 'ইনাতখালী', post: 'বানিয়াচং', upazila: 'বানিয়াচং', district: 'হবিগঞ্জ',
    perm_village: 'ঐ', perm_post: 'ঐ', perm_upazila: 'ঐ', perm_district: 'ঐ',
    guardian: 'বাসেল মিয়া', relation: 'বাবা', prev_inst: 'অত্র জামেয়া', prev_class: '২য়',
    dept: 'নূরানী', fee: '১০০০', dakhila: '৭৭', form_no: '২২২', notun_puraton: 'পুরাতন',
    hijri: '১৪৪৭/৪৮', english: '২০২৬/২৭', photo: '21.jpg',
  },
  {
    name: 'তাহমীদ আরতৌয়া আক্তার', class: '১ম শ্রেণী', father: 'মোঃ হাম্মাদুর রহমান আক্তার', father_mobile: '01739205584',
    mother: 'মোছাঃ হাদিরা বেগম', mother_mobile: '', gender: 'মেয়ে', dob: '০২-০৭-২০১৯', student_mobile: '',
    village: 'নন্দীপাড়া', post: 'বানিয়াচং', upazila: 'বানিয়াচং', district: 'হবিগঞ্জ',
    perm_village: 'ঐ', perm_post: 'ঐ', perm_upazila: 'ঐ', perm_district: 'ঐ',
    guardian: 'মোঃ হাম্মাদুর রহমান আক্তার', relation: 'বাবা', prev_inst: 'অত্র জামেয়া', prev_class: 'শিশু ক',
    dept: 'নূরানী', fee: '২০০০', dakhila: '১২৪৬', form_no: '২৬৪', notun_puraton: 'পুরাতন',
    hijri: '১৪৪৭/৪৮', english: '২০২৬/২৭', photo: '22.jpg',
  },
  {
    name: 'আলমা বেগম', class: '১ম শ্রেণী', father: 'আলমাস মিয়া', father_mobile: '01760442263',
    mother: '', mother_mobile: '', gender: 'মেয়ে', dob: '১৮-০৩-২০২০', student_mobile: '',
    village: 'দরগামহল্লা', post: 'বানিয়াচং', upazila: 'বানিয়াচং', district: 'হবিগঞ্জ',
    perm_village: 'ঐ', perm_post: 'ঐ', perm_upazila: 'ঐ', perm_district: 'ঐ',
    guardian: 'আলমাস মিয়া', relation: 'বাবা', prev_inst: 'অত্র জামেয়া', prev_class: 'শিশু ক',
    dept: 'নূরানী', fee: '১০০০', dakhila: '৭৩', form_no: '৯', notun_puraton: 'পুরাতন',
    hijri: '১৪৪৭/৪৮', english: '২০২৬/২৭', photo: '23.jpg',
  },
  {
    name: 'ইলহামুদ আক্তার', class: '১ম শ্রেণী', father: 'মোঃ ইলহাম মিয়া', father_mobile: '01735256785',
    mother: 'রহিমা বেগম', mother_mobile: '', gender: 'মেয়ে', dob: '০৭-০৫-২০১৯', student_mobile: '',
    village: 'বক্তারামহল্লা', post: 'বানিয়াচং', upazila: 'বানিয়াচং', district: 'হবিগঞ্জ',
    perm_village: 'ঐ', perm_post: 'ঐ', perm_upazila: 'ঐ', perm_district: 'ঐ',
    guardian: 'মোঃ ইলহাম মিয়া', relation: 'বাবা', prev_inst: 'অত্র জামেয়া', prev_class: 'শিশু ক',
    dept: 'নূরানী', fee: '১০০০', dakhila: '৬৭', form_no: '২৫', notun_puraton: 'পুরাতন',
    hijri: '১৪৪৭/৪৮', english: '২০২৬/২৭', photo: '24.jpg',
  },
  {
    name: 'ওসেফ আহমদ', class: '১ম শ্রেণী', father: 'কোহেব আহমার', father_mobile: '01635050384',
    mother: '', mother_mobile: '', gender: 'ছেলে', dob: '', student_mobile: '',
    village: 'নন্দীপাড়া', post: 'বানিয়াচং', upazila: 'বানিয়াচং', district: 'হবিগঞ্জ',
    perm_village: 'ঐ', perm_post: 'ঐ', perm_upazila: 'ঐ', perm_district: 'ঐ',
    guardian: 'কোহেব আহমার', relation: 'বাবা', prev_inst: 'অত্র জামেয়া', prev_class: 'শিশু ক',
    dept: 'নূরানী', fee: '১০০০', dakhila: '৩৩', form_no: '১৯৪', notun_puraton: 'পুরাতন',
    hijri: '১৪৪৭/৪৮', english: '২০২৬/২৭', photo: '25.jpg',
  },
  {
    name: 'আক্তার মিয়া', class: '১ম শ্রেণী', father: 'আলিম মিয়া', father_mobile: '01768462325',
    mother: '', mother_mobile: '', gender: 'ছেলে', dob: '', student_mobile: '',
    village: 'নন্দীপাড়া', post: 'বানিয়াচং', upazila: 'বানিয়াচং', district: 'হবিগঞ্জ',
    perm_village: 'ঐ', perm_post: 'ঐ', perm_upazila: 'ঐ', perm_district: 'ঐ',
    guardian: 'আলিম মিয়া', relation: 'বাবা', prev_inst: 'অত্র জামেয়া', prev_class: 'শিশু ক',
    dept: 'নূরানী', fee: '১০০০', dakhila: '২৮', form_no: '৪২', notun_puraton: 'পুরাতন',
    hijri: '১৪৪৭/৪৮', english: '২০২৬/২৭', photo: '26.jpg',
  },
  {
    name: 'নাজিব', class: '১ম শ্রেণী', father: 'আলাউদ্দিন মিয়া', father_mobile: '01704629080',
    mother: '', mother_mobile: '', gender: 'ছেলে', dob: '', student_mobile: '',
    village: 'বানিয়াচং', post: 'বানিয়াচং', upazila: 'বানিয়াচং', district: 'হবিগঞ্জ',
    perm_village: 'ঐ', perm_post: 'ঐ', perm_upazila: 'ঐ', perm_district: 'ঐ',
    guardian: 'আলাউদ্দিন মিয়া', relation: 'বাবা', prev_inst: 'অত্র জামেয়া', prev_class: 'শিশু ক',
    dept: 'নূরানী', fee: '১০০০', dakhila: '', form_no: '৯', notun_puraton: 'নতুন',
    hijri: '১৪৪৭/৪৮', english: '২০২৬/২৭', photo: '27.jpg',
  },
  {
    name: 'মুনতাহিদ', class: '১ম শ্রেণী', father: '', father_mobile: '',
    mother: '', mother_mobile: '', gender: 'ছেলে', dob: '', student_mobile: '',
    village: 'বানিয়াচং', post: 'বানিয়াচং', upazila: 'বানিয়াচং', district: 'হবিগঞ্জ',
    perm_village: 'ঐ', perm_post: 'ঐ', perm_upazila: 'ঐ', perm_district: 'ঐ',
    guardian: '', relation: 'বাবা', prev_inst: 'অত্র জামেয়া', prev_class: 'শিশু ক',
    dept: 'নূরানী', fee: '১০০০', dakhila: '', form_no: '৫৭', notun_puraton: 'পুরাতন',
    hijri: '১৪৪৭/৪৮', english: '২০২৬/২৭', photo: '28.jpg',
  },
  {
    name: 'আনাস মিয়া', class: '১ম শ্রেণী', father: 'সুলতান মিয়া', father_mobile: '',
    mother: '', mother_mobile: '', gender: 'ছেলে', dob: '', student_mobile: '',
    village: 'বানিয়াচং', post: 'বানিয়াচং', upazila: 'বানিয়াচং', district: 'হবিগঞ্জ',
    perm_village: 'ঐ', perm_post: 'ঐ', perm_upazila: 'ঐ', perm_district: 'ঐ',
    guardian: 'সুলতান মিয়া', relation: 'বাবা', prev_inst: 'অত্র জামেয়া', prev_class: 'শিশু ক',
    dept: 'নূরানী', fee: '১০০০', dakhila: '', form_no: '', notun_puraton: 'পুরাতন',
    hijri: '১৪৪৭/৪৮', english: '২০২৬/২৭', photo: '29.jpg',
  },
  {
    name: 'ইব্রাহিম ইসলাম', class: '১ম শ্রেণী', father: 'আবদুল ইসলাম', father_mobile: '01700630645',
    mother: 'নাজমা বেগম', mother_mobile: '', gender: 'ছেলে', dob: '', student_mobile: '',
    village: 'দরগামহল্লা', post: 'বানিয়াচং', upazila: 'বানিয়াচং', district: 'হবিগঞ্জ',
    perm_village: 'ঐ', perm_post: 'ঐ', perm_upazila: 'ঐ', perm_district: 'ঐ',
    guardian: 'আবদুল ইসলাম', relation: 'বাবা', prev_inst: 'অত্র জামেয়া', prev_class: 'শিশু ক',
    dept: 'নূরানী', fee: '১০০০', dakhila: '', form_no: '৯', notun_puraton: 'পুরাতন',
    hijri: '১৪৪৭/৪৮', english: '২০২৬/২৭', photo: '30.jpg',
  },
];

const rows = students.map(s => ({
  'নাম': s.name, 'শ্রেণী': s.class, 'পিতার নাম': s.father, 'পিতার মোবাইল': s.father_mobile,
  'মাতার নাম': s.mother, 'মাতার মোবাইল': s.mother_mobile, 'লিঙ্গ': s.gender, 'জন্মতারিখ': s.dob,
  'শিক্ষার্থীর মোবাইল': s.student_mobile, 'বর্তমান গ্রাম': s.village, 'বর্তমান ডাক': s.post,
  'বর্তমান উপজেলা': s.upazila, 'বর্তমান জেলা': s.district, 'স্থায়ী গ্রাম': s.perm_village,
  'স্থায়ী ডাক': s.perm_post, 'স্থায়ী উপজেলা': s.perm_upazila, 'স্থায়ী জেলা': s.perm_district,
  'অভিভাবকের নাম': s.guardian, 'সম্পর্ক': s.relation, 'আগের প্রতিষ্ঠান': s.prev_inst,
  'আগের শ্রেণী': s.prev_class, 'বিভাগ': s.dept, 'মাসিক ফি': s.fee,
  'দাখিলা নং': s.dakhila, 'ফর্ম নং': s.form_no, 'নতুন/পুরাতন': s.notun_puraton,
  'শিক্ষাবর্ষ হিজরি': s.hijri, 'শিক্ষাবর্ষ ইংরেজি': s.english, 'ছবির ফাইল': s.photo,
}));

const ws = XLSX.utils.json_to_sheet(rows);
ws['!cols'] = Array(29).fill({wch: 18});
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, '১ম শ্রেণী scan');
const outPath = 'C:\\Users\\Tayef\\Downloads\\1st papre\\protishthan-complete-v211\\Form\\১ম শ্রেনী\\১ম শ্রেণী - scan 21-30.xlsx';
XLSX.writeFile(wb, outPath);
console.log('Done:', outPath);
