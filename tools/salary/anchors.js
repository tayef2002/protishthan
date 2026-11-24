/* স্যালারি কত?: real pay ANCHORS from the Bangladesh market (checked online 2026-11-24), and the market reference lines shown on the page.
   Each anchor is one real, checkable number: a rule, a published figure or the middle of published job advertisements, with its source and year.
   tools/salary/gen-data.js CALIBRATES the model against these: after the build, the model's answer for each anchor profile must sit near the anchor.
   conf: A = a rule or official figure, B = a published number (circular, survey site, job advertisements), C = the middle of scattered postings (my reading).
   value = typical TOTAL monthly pay (taka) for that profile in that year. Update these when the market moves: re-run gen-data and the tests re-check the fit. */
'use strict';

const ANCHORS = [
  // আইটি ও সফটওয়্যার (PayScale BD 2025: entry ~40k/yr avg incl MNC; local-market junior postings 25-35k)
  { family: 'it', role: 'dev', edu: 'hons', exp: 0, city: 'dhaka', employer: 'local', value: 30000, year: 2025.5, conf: 'B', src: 'PayScale BD ও bdjobs জুনিয়র পোস্টিং ২০২৫' },
  { family: 'it', role: 'dev', edu: 'hons', exp: 5, city: 'dhaka', employer: 'local', skills: ['prog', 'web', 'sql', 'en_good'], value: 60000, year: 2025.5, conf: 'C', src: 'PayScale mid-career + বাজারের বিজ্ঞাপন' },
  { family: 'it', role: 'dev', edu: 'hons', exp: 8, city: 'dhaka', employer: 'mnc', skills: ['prog', 'web', 'cloud', 'sql', 'en_fluent'], value: 100000, year: 2025.5, conf: 'C', src: 'PayScale senior ~83k গড় + MNC প্রিমিয়াম' },

  // ব্যাংক (বাংলাদেশ ব্যাংকের নিয়ম: প্রবেশনে ন্যূনতম ২৮,০০০, নিশ্চিতকরণের পরে ৩৯,০০০; শীর্ষ ব্যাংকের MTO ৭০-৯০ হাজার)
  { family: 'bank', role: 'officer', edu: 'hons', exp: 1, city: 'dhaka', employer: 'private', value: 39000, year: 2025.5, conf: 'A', src: 'বাংলাদেশ ব্যাংক সার্কুলার (২০২২, বলবৎ)' },
  { family: 'bank', role: 'officer', edu: 'masters', exp: 0, city: 'dhaka', employer: 'foreign', skills: ['en_fluent'], value: 80000, year: 2025.5, conf: 'B', src: 'MTB/IPDC MTO বিজ্ঞাপন ২০২৫ (৭০-৯০ হাজার)' },

  // হিসাব ও অর্থ (PayScale: accounts assistant শুরুতে ~16k/মাস; অভিজ্ঞ হিসাবরক্ষক ৩৫-৫০)
  { family: 'finance', role: 'asst', edu: 'hons', exp: 0, city: 'dhaka', employer: 'small', value: 16000, year: 2025.5, conf: 'B', src: 'PayScale accounts assistant ২০২৫' },
  { family: 'finance', role: 'acct', edu: 'hons', exp: 5, city: 'dhaka', employer: 'local', skills: ['tally', 'excel', 'taxvat'], value: 40000, year: 2025.5, conf: 'C', src: 'PayScale/Paylab হিসাবরক্ষক ২০২৫' },

  // শিক্ষকতা (এমপিও সহকারী শিক্ষক: মূল ১৩,৭১০ + বাড়ি ১,০০০ + চিকিৎসা ৫০০; প্রভাষক: মূল ২২,০০০ + ভাতা)
  { family: 'teach', role: 'secondary', edu: 'hons', exp: 0, city: 'town', employer: 'mpo', value: 15200, year: 2025.5, conf: 'A', src: 'এমপিও বেতন কাঠামো (bdservicerules, ২০২৫)' },
  { family: 'teach', role: 'college', edu: 'masters', exp: 0, city: 'town', employer: 'mpo', value: 24000, year: 2025.5, conf: 'A', src: 'এমপিও প্রভাষক, ৯ম গ্রেড (২০১৫ স্কেল)' },
  { family: 'teach', role: 'secondary', edu: 'hons', exp: 3, city: 'dhaka', employer: 'english', skills: ['curr', 'en_fluent'], value: 35000, year: 2025.5, conf: 'C', src: 'ঢাকার ইংরেজি মাধ্যমের বিজ্ঞাপন' },

  // স্বাস্থ্য (বেসরকারি নতুন ডাক্তারের প্রস্তাবিত ফ্লোর ৩০,০০০, বাস্তবে ২২-৫৩ হাজার; নার্স ১০.৫-৩৫ হাজার)
  { family: 'health', role: 'mbbs', edu: 'hons', exp: 0, city: 'dhaka', employer: 'private', value: 35000, year: 2025.5, conf: 'B', src: 'সরকারি কমিটির ফ্লোর-প্রস্তাব + Paylab ২০২৫' },
  { family: 'health', role: 'nurse', edu: 'diploma', exp: 0, city: 'dhaka', employer: 'private', value: 18000, year: 2025.5, conf: 'B', src: 'Paylab নার্স সীমা ২০২৫' },

  // এনজিও (ব্র্যাক মাঠকর্মী ২০-২৫ হাজার, প্রোগ্রাম অফিসার ~৩৫ হাজার, আন্তর্জাতিক এনজিও অনেক বেশি)
  { family: 'ngo', role: 'field', edu: 'hons', exp: 0, city: 'town', employer: 'large', value: 22000, year: 2025.5, conf: 'B', src: 'ব্র্যাক/বড় এনজিওর মাঠকর্মীর বিজ্ঞাপন' },
  { family: 'ngo', role: 'prog', edu: 'masters', exp: 4, city: 'dhaka', employer: 'large', value: 35000, year: 2025.5, conf: 'B', src: 'bdjobs এনজিও প্রোগ্রাম অফিসার বিজ্ঞাপন' },
  { family: 'ngo', role: 'prog', edu: 'masters', exp: 6, city: 'dhaka', employer: 'intl', skills: ['en_fluent', 'reportw', 'proposal'], value: 85000, year: 2025.5, conf: 'C', src: 'আন্তর্জাতিক এনজিওর বিজ্ঞাপন' },

  // ডিজাইন ও মিডিয়া
  { family: 'design', role: 'graphic', edu: 'hons', exp: 1, city: 'dhaka', employer: 'agency', value: 20000, year: 2025.5, conf: 'C', src: 'bdjobs গ্রাফিক ডিজাইনার বিজ্ঞাপন' },
  { family: 'design', role: 'ui', edu: 'hons', exp: 4, city: 'dhaka', employer: 'company', skills: ['uiux2', 'photoshop', 'en_good'], value: 55000, year: 2025.5, conf: 'C', src: 'UI/UX বিজ্ঞাপন ২০২৫' },

  // ম্যানেজার ও প্রশাসন
  { family: 'manager', role: 'mgr', edu: 'masters', exp: 10, city: 'dhaka', employer: 'local', skills: ['team', 'en_good'], value: 80000, year: 2025.5, conf: 'C', src: 'Paylab/PayScale ব্যবস্থাপক ২০২৫' },

  // অফিস সহকারী ও প্রশাসন
  { family: 'office', role: 'asst', edu: 'hsc', exp: 2, city: 'dhaka', employer: 'local', value: 18000, year: 2025.5, conf: 'C', src: 'bdjobs অফিস সহকারী বিজ্ঞাপন' },
  { family: 'office', role: 'hr', edu: 'hons', exp: 4, city: 'dhaka', employer: 'local', value: 40000, year: 2025.5, conf: 'C', src: 'bdjobs এইচআর অফিসার বিজ্ঞাপন' },

  // বিক্রয় ও মার্কেটিং (Paylab: SR-দের ৮০% ১০-৪৭ হাজারে; এলাকার ব্যবস্থাপক অনেক বেশি)
  { family: 'sales', role: 'field', edu: 'hsc', exp: 1, city: 'dhaka', employer: 'fmcg', value: 18000, year: 2025.5, conf: 'B', src: 'Paylab SR সীমা ২০২৫' },
  { family: 'sales', role: 'exec', edu: 'hons', exp: 3, city: 'dhaka', employer: 'local', value: 30000, year: 2025.5, conf: 'C', src: 'bdjobs সেলস এক্সিকিউটিভ বিজ্ঞাপন' },
  { family: 'sales', role: 'area', edu: 'hons', exp: 8, city: 'dhaka', employer: 'fmcg', skills: ['lead', 'en_good'], value: 80000, year: 2025.5, conf: 'C', src: 'FMCG এরিয়া ম্যানেজারের বিজ্ঞাপন' },

  // কাস্টমার সার্ভিস (Paylab: কল অপারেটরদের ৮০% ১০-৩০ হাজারে)
  { family: 'service', role: 'agent', edu: 'hons', exp: 0, city: 'dhaka', employer: 'cc', value: 16000, year: 2025.5, conf: 'B', src: 'Paylab কল অপারেটর সীমা ২০২৫' },
  { family: 'service', role: 'english', edu: 'hons', exp: 2, city: 'dhaka', employer: 'cc', skills: ['en_fluent'], value: 30000, year: 2025.5, conf: 'C', src: 'ইংরেজি সাপোর্টের বিজ্ঞাপন' },

  // গার্মেন্টস মার্চেন্ডাইজিং (বিজ্ঞাপন: জুনিয়র ৩০-৪০, সিনিয়র ৬০-৭০ হাজার)
  { family: 'merch', role: 'asst', edu: 'hons', exp: 1, city: 'dhaka', employer: 'medium', value: 32000, year: 2025.5, conf: 'B', src: 'মার্চেন্ডাইজার বিজ্ঞাপন ২০২৫' },
  { family: 'merch', role: 'merch', edu: 'hons', exp: 8, city: 'dhaka', employer: 'large', skills: ['en_fluent'], value: 65000, year: 2025.5, conf: 'B', src: 'সিনিয়র মার্চেন্ডাইজার বিজ্ঞাপন ২০২৫' },

  // কারিগরি সহকারী (Paylab: টেকনিশিয়ানদের ৮০% ১১.৪-৩২ হাজারে)
  { family: 'tech', role: 'maint', edu: 'diploma', exp: 3, city: 'dhaka', employer: 'local', value: 20000, year: 2025.5, conf: 'B', src: 'Paylab টেকনিশিয়ান সীমা ২০২৫' },
  { family: 'tech', role: 'superv', edu: 'diploma', exp: 6, city: 'dhaka', employer: 'local', value: 35000, year: 2025.5, conf: 'C', src: 'সুপারভাইজার বিজ্ঞাপন' },

  // প্রকৌশল (ডিপ্লোমা সাইট ইঞ্জিনিয়ার গড় ~২২.৫ হাজার; বিএসসি ফ্রেশার ২৫-৩৫; ৮ বছরে ৬০-৯০)
  { family: 'engineer', role: 'site', edu: 'hons', exp: 0, city: 'dhaka', employer: 'local', value: 26000, year: 2025.5, conf: 'B', src: 'সাইট ইঞ্জিনিয়ার বিজ্ঞাপন ও Paylab ২০২৫' },
  { family: 'engineer', role: 'civil', edu: 'hons', exp: 8, city: 'dhaka', employer: 'local', skills: ['autocad', 'siteexp', 'en_good'], value: 60000, year: 2025.5, conf: 'B', src: 'বিএসসি সিভিল ইঞ্জিনিয়ারের বিজ্ঞাপন (৬০-৯০ হাজার)' },

  // দক্ষ কারিগর (ইলেকট্রিশিয়ানের সর্বনিম্ন কাঠামো ১৩.৫-১৫ হাজার, অভিজ্ঞরা ২০-৩০)
  { family: 'craft', role: 'elec', edu: 'ssc', exp: 3, city: 'dhaka', employer: 'company', value: 18000, year: 2025.5, conf: 'B', src: 'ওয়েজ বোর্ডের কাঠামো + বিজ্ঞাপন ২০২৫' },
  { family: 'craft', role: 'driver', edu: 'ssc', exp: 5, city: 'dhaka', employer: 'company', value: 22000, year: 2025.5, conf: 'C', src: 'ঢাকার ড্রাইভারের বিজ্ঞাপন' },

  // গার্মেন্টস শ্রমিক (মজুরি বোর্ড ২০২৩: গ্রেড অনুযায়ী ১২,৫০০-১৪,৭৫০; ২ বছরের অপারেটর ওভারটাইম ছাড়া ~১৪ হাজার)
  { family: 'operator', role: 'sew', edu: 'below', exp: 2, city: 'dhaka', employer: 'medium', value: 14000, year: 2025.5, conf: 'A', src: 'ন্যূনতম মজুরি বোর্ড ২০২৩ + ইনক্রিমেন্ট' },

  // সাধারণ শ্রম (নিরাপত্তাকর্মী ~১২-১৫ হাজার; ঢাকার ডেলিভারি রাইডার ১৫-২০ হাজার)
  { family: 'elementary', role: 'guard', edu: 'below', exp: 2, city: 'dhaka', employer: 'agency', value: 13000, year: 2025.5, conf: 'B', src: 'সংবাদ ও বিজ্ঞাপন ২০২৫' },
  { family: 'elementary', role: 'delivery', edu: 'ssc', exp: 1, city: 'dhaka', employer: 'platform', value: 17000, year: 2025.5, conf: 'B', src: 'পাঠাও/ফুডপান্ডা রাইডারের আয়ের খবর ২০২৫' }
];

/* the market lines the page shows under "মনে রাখুন": real, checkable references so a person can compare the estimate with the market by themselves */
const REFS = {
  it: ['বাস্তব বাজার ২০২৫: জুনিয়র ডেভেলপার সাধারণত ২৫-৩৫ হাজারে শুরু (ছোট-মাঝারি ফার্ম), ৫ বছরে ৫০-৭০, সিনিয়র ৮০ হাজারের ওপরে; বিদেশি ক্লায়েন্ট বা MNC হলে অনেকটা বেশি (PayScale, bdjobs)।'],
  bank: ['বাংলাদেশ ব্যাংকের নিয়ম (২০২২-এর সার্কুলার, বলবৎ): বেসরকারি ব্যাংকে শিক্ষানবিশ অফিসারের বেতন প্রবেশনে কমপক্ষে ২৮,০০০, নিশ্চিতকরণের পরে ৩৯,০০০ টাকা।', 'শীর্ষ ব্যাংকের MTO প্রোগ্রাম ২০২৫-এ ৭০-৯০ হাজারে শুরু, তবে আসন খুব কম।'],
  finance: ['বাস্তব বাজার ২০২৫: হিসাব সহকারী ১৫-২০ হাজারে শুরু, ৫-৬ বছরের হিসাবরক্ষক ৩৫-৫০; ACCA/CA ধাপ পাস থাকলে লাফিয়ে বাড়ে (PayScale)।'],
  teach: ['এমপিও স্কুলের সহকারী শিক্ষক: মূল বেতন ১৩,৭১০ + বাড়ি ভাড়া ১,০০০ + চিকিৎসা ৫০০ (২০১৫ স্কেল, নতুন স্কেল এখনো কার্যকর হয়নি); এমপিও প্রভাষক ৯ম গ্রেডে ~২৪ হাজার।', 'ঢাকার ইংরেজি মাধ্যম ও নামি বেসরকারি স্কুলে ৩০-৫০ হাজারও হয় (২০২৫-এর বিজ্ঞাপন); কোচিং-টিউশনির আয় এর বাইরে।'],
  health: ['বেসরকারি হাসপাতালে নতুন এমবিবিএস ডাক্তার: সরকারি কমিটির প্রস্তাবিত ন্যূনতম ৩০,০০০; বাস্তবে ২২-৫৩ হাজারের মধ্যে (২০২৫)।', 'নার্স বেসরকারিতে ১০-৩৫ হাজারের মধ্যে; সরকারি নার্স ১০ম গ্রেডের পে-স্কেলে, অনেক বেশি।'],
  ngo: ['ব্র্যাকসহ বড় এনজিওর মাঠকর্মী ২০-২৫ হাজারে শুরু, প্রোগ্রাম অফিসার ~৩৫ হাজার; আন্তর্জাতিক এনজিওতে একই কাজে ২-৩ গুণ (বিজ্ঞাপন ২০২৫)।'],
  design: ['গ্রাফিক ডিজাইনার ১৮-২৫ হাজারে শুরু, UI/UX ও মোশনে অভিজ্ঞরা ৫০ হাজারের ওপরে; বিদেশি ক্লায়েন্টের কাজ (ফ্রিল্যান্স/রিমোট) থাকলে বেতনের বাইরে বড় আয় সম্ভব (বিজ্ঞাপন ২০২৫)।'],
  manager: ['মাঝারি কোম্পানির ব্যবস্থাপক ৬০ হাজার-১ লাখ, MNC ও বড় গ্রুপে অনেক বেশি; এই স্তরে বেতন দরকষাকষিতেই ঠিক হয় (PayScale/Paylab ২০২৫)।'],
  office: ['অফিস সহকারী ও ডেটা এন্ট্রি ১২-২০ হাজারে, এইচআর/অ্যাডমিন অফিসার (স্নাতকসহ) ২৫-৪৫ হাজারে চলে (bdjobs ২০২৫)।'],
  sales: ['FMCG-র SR: ৮০% মানুষ ১০-৪৭ হাজারের মধ্যে (Paylab ২০২৫); বেতনের সঙ্গে টার্গেট-কমিশন বড় অংশ। এরিয়া ম্যানেজার ৭০ হাজার-১ লাখ।'],
  service: ['কল সেন্টার এজেন্ট: ৮০% মানুষ ১০-৩০ হাজারের মধ্যে (Paylab ২০২৫); ইংরেজিতে বিদেশি গ্রাহক সামলালে ২৫-৪০ হাজার।'],
  merch: ['মার্চেন্ডাইজিং ২০২৫-এর বিজ্ঞাপন: জুনিয়র ৩০-৪০ হাজার, সিনিয়র ৬০-৭০ হাজার, ম্যানেজার ১ লাখের ওপরে।'],
  tech: ['টেকনিশিয়ান: ৮০% মানুষ ১১-৩২ হাজারের মধ্যে (Paylab ২০২৫); ডিপ্লোমা + অভিজ্ঞ সুপারভাইজার ৩০-৪০ হাজার।'],
  operator: ['মজুরি বোর্ড ২০২৩: গার্মেন্টসে গ্রেড অনুযায়ী ন্যূনতম ১২,৫০০-১৪,৭৫০ টাকা + বছরে ৫% ইনক্রিমেন্ট; ওভারটাইমে মোট আয় অনেকের ১৬-২০ হাজারে ওঠে।'],
  craft: ['ইলেকট্রিশিয়ান-টেকনিশিয়ানের সর্বনিম্ন কাঠামো ১৩-১৫ হাজার, অভিজ্ঞ কারিগর ঢাকায় ২০-৩০ হাজার; বিদেশে (মধ্যপ্রাচ্য) একই কাজে অনেক বেশি (২০২৫)।'],
  engineer: ['সাইট ইঞ্জিনিয়ার (ডিপ্লোমা) ~২০-২৫ হাজারে শুরু, বিএসসি সিভিল ফ্রেশার ২৫-৩৫, ৮-১০ বছরে ৬০-৯০ হাজার (বিজ্ঞাপন ও Paylab ২০২৫)।'],
  elementary: ['নিরাপত্তাকর্মী ১২-১৫ হাজার, ঢাকার ডেলিভারি রাইডার মাসে ১৫-২০ হাজার (পাঠাও/ফুডপান্ডার হিসাব, ২০২৫); এসব কাজে ডিউটির ঘণ্টাই আয় ঠিক করে।']
};

module.exports = { ANCHORS, REFS };
