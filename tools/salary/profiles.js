// What is asked for each KIND OF WORK (the form is not only for developers): the posts of the work (roles), the kinds of employer that matter in that work, a question or two that matter only
// there, and the skills that are meant for that work. Every multiplier and premium here is a PRIOR of the first version (confidence "C", shown as an estimate); the survey microdata and the
// reports of the users will correct them. Rule of the tool: nothing here is shown as a fact, and the total of the skills is capped.
const L = (s) => s.split(';').map(x => x.trim()).filter(Boolean).map(x => { const [id, name, m, ...rest] = x.split('|'); const o = { id, name, mult: Number(m) }; rest.forEach(r => { const [k, v] = r.split('='); o[k] = Number(v); }); return o; });

// ---- the skills (id|name|premium in log points|group); one registry, each kind of work picks its own
const SK = {};
const add = (group, text) => text.split(';').map(x => x.trim()).filter(Boolean).forEach(x => { const [id, name, p, excl] = x.split('|'); if (SK[id]) throw new Error('twice: ' + id); SK[id] = { id, name, group, premium: Number(p), excl: excl || '' }; });
add('ইংরেজি', 'en_good|ইংরেজি: ভালো (পড়া, লেখা, কাজ চালানো)|0.07|en;en_fluent|ইংরেজি: দক্ষ (সাবলীল বলা ও লেখা)|0.15|en;ielts|IELTS ৬.৫ বা তার বেশি|0.05');
add('সাধারণ', 'lang2|তৃতীয় ভাষা (আরবি, জাপানি, চীনা, জার্মান...)|0.06;excel|Excel: উন্নত (সূত্র, পিভট)|0.05;typing|দ্রুত টাইপিং (বাংলা ও ইংরেজি)|0.02;driving|ড্রাইভিং লাইসেন্স|0.03;intern|ইন্টার্নশিপ বা শিক্ষানবিশির অভিজ্ঞতা|0.03;lead|নেতৃত্বের ভূমিকা (ক্লাব, দল, প্রকল্প)|0.03;freelance|ফ্রিল্যান্সিংয়ে আয়ের প্রমাণ|0.05;portfolio|দেখানোর মতো কাজ (পোর্টফোলিও)|0.04');
add('আইটি', 'prog|প্রোগ্রামিং (কোড লিখতে পারেন)|0.10;web|ওয়েব ডেভেলপমেন্ট (ফ্রেমওয়ার্কসহ)|0.06;mobile|মোবাইল অ্যাপ (Flutter, Android, iOS)|0.07;cloud|ক্লাউড ও ডেভঅপস (AWS, Azure, Docker)|0.09;aiml|এআই বা মেশিন লার্নিং|0.09;sql|ডেটাবেস ও SQL|0.04;dataviz|ডেটা বিশ্লেষণ ও ড্যাশবোর্ড|0.05;uiux|UI/UX ডিজাইন (Figma)|0.05;qaauto|টেস্ট অটোমেশন|0.05;netcert|নেটওয়ার্ক বা সাইবার সার্টিফিকেট (CCNA, Security+)|0.08;itproj|চটপটে প্রকল্প ব্যবস্থাপনা (Scrum, PMP)|0.06;opensrc|ওপেন সোর্সে অবদান বা GitHub-এ কাজ|0.04');
add('হিসাব ও অর্থ', 'acca|ACCA, CA বা CMA (কয়েক ধাপ পাস)|0.12;tally|হিসাবের সফটওয়্যার (Tally, QuickBooks)|0.04;erp|ERP (SAP, Oracle, Odoo)|0.06;taxvat|আয়কর ও ভ্যাটের কাজ জানা|0.05;ifrs|IFRS ও অডিটের মান জানা|0.05;auditx|অডিট ফার্মে কাজের অভিজ্ঞতা|0.04;finmodel|ফাইন্যান্সিয়াল মডেলিং|0.06');
add('ব্যাংক ও বিমা', 'bankcert|ব্যাংকিং সার্টিফিকেট (JAIBB, DAIBB)|0.06;forex|বৈদেশিক মুদ্রা ও আমদানি-রপ্তানির কাজ|0.06;credit|ক্রেডিট বিশ্লেষণ|0.06;aml|AML ও কমপ্লায়েন্স (CAMS, CAMLCO)|0.06;cbs|ব্যাংকিং সফটওয়্যার (CBS) ব্যবহার|0.03;salesbank|ব্যাংকে বিক্রয় (লোন, কার্ড, বিমা) লক্ষ্য পূরণ|0.04');
add('শিক্ষকতা', 'bed|বিএড বা এমএড|0.05;ntrca|এনটিআরসিএ সনদ বা সরকারি নিবন্ধন|0.05;subjeng|ইংরেজি বিষয় বা স্পোকেন ইংলিশ পড়ানোর দক্ষতা|0.06;subjstem|গণিত, পদার্থ, রসায়ন বা জীববিজ্ঞান বিশেষজ্ঞ|0.06;ictteach|প্রযুক্তি দিয়ে পড়ানো (অনলাইন ক্লাস, স্লাইড)|0.03;tuitionx|কোচিং বা প্রাইভেট পড়ানোর অভিজ্ঞতা|0.04;curr|ইংরেজি মাধ্যম পাঠ্যক্রম (Cambridge, Edexcel)|0.08;research|প্রকাশিত গবেষণা বা পেপার|0.05');
add('প্রকৌশল', 'autocad|AutoCAD বা নকশার সফটওয়্যার|0.04;struct|স্ট্রাকচারাল সফটওয়্যার (ETABS, SAP2000, Revit)|0.06;plc|PLC, SCADA বা অটোমেশন|0.07;pmp|প্রকল্প ব্যবস্থাপনা (PMP, PRINCE2)|0.07;siteexp|সাইট বা মাঠের কাজের অভিজ্ঞতা|0.04;powersys|পাওয়ার সিস্টেম ও সাবস্টেশন|0.05;hse|নিরাপত্তা ও স্বাস্থ্য (HSE, NEBOSH)|0.05;pe|পেশাদার প্রকৌশলী সদস্যপদ (IEB)|0.03');
add('স্বাস্থ্য', 'regd|বিএমডিসি, বিএনএমসি বা ফার্মেসি কাউন্সিলের নিবন্ধন|0.05;postgrad|স্নাতকোত্তর ডিগ্রি (FCPS, MD, MS, M.Pharm)|0.15;clinical|বিশেষায়িত ইউনিটে অভিজ্ঞতা (ICU, OT, ডায়ালাইসিস)|0.06;labx|ল্যাব যন্ত্রপাতি ও পরীক্ষার দক্ষতা|0.04;pharmasales|ওষুধ কোম্পানির বিক্রয় (MPO) অভিজ্ঞতা|0.04;publichealth|জনস্বাস্থ্যে (MPH) প্রশিক্ষণ|0.06');
add('এনজিও ও উন্নয়ন', 'me|পরিবীক্ষণ ও মূল্যায়ন (M&E)|0.06;proposal|প্রস্তাবনা লেখা ও অনুদান জোগাড়|0.07;kobo|ডেটা সংগ্রহের সফটওয়্যার (KoBo, ODK)|0.04;fieldx|মাঠপর্যায়ে কাজের অভিজ্ঞতা|0.04;spss|পরিসংখ্যান সফটওয়্যার (SPSS, Stata, R)|0.06;reportw|রিপোর্ট ও ইংরেজি লেখা|0.04;projmgt|প্রকল্প পরিচালনার সার্টিফিকেট|0.05;locallang|পাহাড়ি বা স্থানীয় ভাষা জানা|0.03');
add('ডিজাইন ও মিডিয়া', 'photoshop|Photoshop, Illustrator বা InDesign|0.05;videoedit|ভিডিও এডিটিং (Premiere, DaVinci)|0.05;motion|মোশন গ্রাফিক্স ও অ্যানিমেশন (After Effects)|0.07;contentw|কনটেন্ট বা কপি লেখা (বাংলা ও ইংরেজি)|0.04;photog|ফটোগ্রাফি বা ভিডিওগ্রাফি|0.04;socialmgmt|সোশ্যাল মিডিয়া ও বিজ্ঞাপন (Meta Ads)|0.05;uiux2|UI/UX (Figma)|0.05;seo|SEO ও ওয়েব বিশ্লেষণ|0.05;threed|থ্রিডি (Blender, Maya)|0.07');
add('ব্যবস্থাপনা', 'mba|এমবিএ বা ব্যবস্থাপনায় স্নাতকোত্তর|0.07;team|১০ জন বা বেশি মানুষের দল চালানো|0.06;pnl|লাভ-ক্ষতির (P&L) দায়িত্ব|0.08;erp2|ERP বা ব্যবসার সফটওয়্যার|0.04;negot|ক্রেতা বা সরবরাহকারীর সঙ্গে দরকষাকষি|0.04;strategy|পরিকল্পনা ও বাজেট তৈরি|0.05');
add('অফিস ও প্রশাসন', 'msoffice|MS Office (Word, Excel, PowerPoint)|0.04;dataentry|দ্রুত ও নির্ভুল ডেটা এন্ট্রি|0.03;acctbasic|হিসাবের প্রাথমিক কাজ (ভাউচার, লেজার)|0.04;hradmin|এইচআর ও প্রশাসনের কাজ (নিয়োগ, বেতনের ফাইল)|0.05;filing|ফাইলিং ও নথিপত্র সামলানো|0.02;bangla|বাংলা ও ইংরেজি চিঠি লেখা|0.03');
add('বিক্রয় ও মার্কেটিং', 'fieldsales|মাঠে বিক্রয়ের অভিজ্ঞতা (দোকান, ডিলার)|0.05;crm|CRM বা বিক্রয়ের সফটওয়্যার|0.04;keyacc|বড় ক্রেতা বা কর্পোরেট ক্রেতা সামলানো|0.07;b2b|প্রতিষ্ঠানে প্রতিষ্ঠানে (B2B) বিক্রয়|0.06;ecom|অনলাইন বিক্রয় (Daraz, Facebook shop)|0.04;bike|মোটরসাইকেল চালানো|0.02;digimkt|ডিজিটাল মার্কেটিং|0.05;brand|ব্র্যান্ড বা মার্কেটিং পরিকল্পনা|0.05');
add('কাস্টমার সার্ভিস', 'spoken|পরিষ্কার বাংলা ও ইংরেজি বলা|0.05;crmtool|টিকেট বা CRM সফটওয়্যার (Zendesk, Freshdesk)|0.04;nightshift|রাতের শিফটে কাজ করতে পারা|0.04;escal|জটিল অভিযোগ সামলানো|0.04;hindi|হিন্দি বা অন্য বিদেশি ভাষায় সেবা|0.07;chatw|চ্যাট ও ইমেইলে দ্রুত লেখা|0.03');
add('গার্মেন্টস অফিস', 'merchsw|ERP বা PLM সফটওয়্যার (SAP, PLM)|0.05;costing|কস্টিং ও দাম নির্ধারণ|0.06;buyercomm|বায়ারের সঙ্গে ইংরেজিতে যোগাযোগ|0.07;compliance|কমপ্লায়েন্স সনদ (BSCI, WRAP, Higg)|0.05;fabric|কাপড় ও সুতার জ্ঞান|0.04;cadpat|CAD ও প্যাটার্ন (Gerber, Lectra)|0.05;sourcing|কাঁচামাল সংগ্রহ ও সরবরাহকারী সামলানো|0.05;lean|লিন ও উৎপাদন দক্ষতা (IE)|0.05');
add('কারিগরি কাজ', 'bteb|ট্রেড সার্টিফিকেট (BTEB, NSDA)|0.05;maint|যন্ত্র সারাই ও রক্ষণাবেক্ষণ|0.05;superv|সুপারভাইজার হিসেবে দল চালানো|0.05;safety|নিরাপত্তা প্রশিক্ষণ|0.03;multi|একাধিক যন্ত্র বা কাজে দক্ষ|0.05;labskill|ল্যাবের পরীক্ষা বা যন্ত্রের কাজ|0.04;english_tech|যন্ত্রের ইংরেজি ম্যানুয়াল পড়তে পারা|0.03');
add('কারখানার কাজ', 'multimach|একাধিক ধরনের মেশিনে দক্ষ (সিঙ্গেল নিডল, ওভারলক, ফ্ল্যাটলক...)|0.06;target|লক্ষ্য ও গতি (দক্ষতার হার) নিয়মিত পূরণ|0.05;qcsense|মানের পরীক্ষা বা সংশোধনের দক্ষতা|0.03;trainer|নতুনদের শেখাতে পারা|0.04;bgmea|সরকারি বা BGMEA প্রশিক্ষণ|0.03;linesup|লাইন চালানোর অভিজ্ঞতা|0.05');
add('দক্ষ কারিগর', 'tradecert|ট্রেড সার্টিফিকেট বা লাইসেন্স|0.05;weld|ওয়েল্ডিং সার্টিফিকেট বা বিশেষ কাজ|0.05;modern|আধুনিক যন্ত্র (এসি, ইনভার্টার, সোলার) জানা|0.07;ownsite|নিজে কাজ জোগাড় করে করতে পারা|0.04;team2|সহকারী নিয়ে দল চালানো|0.04');
add('সাধারণ কাজ', 'firstaid|প্রাথমিক চিকিৎসা বা অগ্নি নিরাপত্তা প্রশিক্ষণ|0.03;security|নিরাপত্তারক্ষীর প্রশিক্ষণ|0.04;smartphone|স্মার্টফোন অ্যাপ ব্যবহার (ডেলিভারি, ম্যাপ)|0.03;bike2|মোটরসাইকেল চালানো|0.04;cook|রান্নার অভিজ্ঞতা|0.03');

// ---- the kinds of work: roles, employers, questions and the skills meant for that work
const COMMON = ['en_good', 'en_fluent', 'ielts', 'lang2', 'intern', 'lead'];
const F = [
  { id: 'it', name: 'আইটি ও সফটওয়্যার', group: 'professionals', mult: 1.15, note: 'আইটিতে পেশাজীবী গড়ের চেয়ে বেশি দেওয়া হয় বলে ধরা হয়েছে (অনুমান, তথ্য জমলে ঠিক হবে)',
    roleLabel: 'কোন পদ বা কাজ?', roles: 'dev|সফটওয়্যার ডেভেলপার (ব্যাকএন্ড, ফুলস্ট্যাক)|1.10;web|ওয়েব বা ফ্রন্টএন্ড ডেভেলপার|1.00;mobile|মোবাইল অ্যাপ ডেভেলপার|1.10;qa|কিউএ বা সফটওয়্যার টেস্টার|0.85;support|আইটি সাপোর্ট বা হেল্পডেস্ক|0.60;network|নেটওয়ার্ক বা সিস্টেম অ্যাডমিন|0.85;data|ডেটা অ্যানালিস্ট বা এআই/এমএল|1.20;uiux|ইউআই/ইউএক্স ডিজাইনার|0.95;pm|প্রজেক্ট বা প্রোডাক্ট ম্যানেজার|1.30',
    employers: 'small|ছোট সফটওয়্যার হাউস বা এজেন্সি|0.90;local|মাঝারি বা বড় দেশি কোম্পানি|1.05;mnc|বহুজাতিক কোম্পানি বা বড় গ্রুপ|1.30;startup|স্টার্টআপ|1.10;govt|সরকারি বা আধা-সরকারি প্রতিষ্ঠান|0.85;bank|ব্যাংক বা ফিনটেক|1.10',
    extras: [{ id: 'client', name: 'কাজ কার জন্য?', options: 'local|দেশের প্রতিষ্ঠান বা ক্লায়েন্টের জন্য|1.00;foreign|বিদেশি ক্লায়েন্টের জন্য (রিমোট, ডলারে)|1.35' }],
    skills: [...COMMON, 'prog', 'web', 'mobile', 'cloud', 'aiml', 'sql', 'dataviz', 'uiux', 'qaauto', 'netcert', 'itproj', 'opensrc', 'portfolio', 'freelance'] },
  { id: 'finance', name: 'হিসাব ও অর্থ', group: 'professionals', mult: 1.00, note: '',
    roleLabel: 'কোন পদ?', roles: 'acct|হিসাবরক্ষক বা অ্যাকাউন্টস অফিসার|1.00;asst|অ্যাকাউন্টস সহকারী|0.70;audit|অডিটর বা অডিট অ্যাসোসিয়েট|1.10;tax|ট্যাক্স ও ভ্যাট অফিসার|1.05;cost|কস্ট বা ম্যানেজমেন্ট অ্যাকাউন্টেন্ট|1.10;fin|ফাইন্যান্স বা বাজেট বিশ্লেষক|1.20;cfo|ফাইন্যান্স ম্যানেজার বা প্রধান|1.55',
    employers: 'small|ছোট ব্যবসা বা দোকান|0.90;local|মাঝারি বা বড় দেশি প্রতিষ্ঠান|1.05;mnc|বহুজাতিক বা বড় গ্রুপ|1.25;firm|অডিট বা সিএ ফার্ম|1.00;ngo|এনজিও বা উন্নয়ন সংস্থা|1.05;govt|সরকারি বা আধা-সরকারি|0.90',
    extras: [], skills: [...COMMON, 'excel', 'acca', 'tally', 'erp', 'taxvat', 'ifrs', 'auditx', 'finmodel', 'typing'] },
  { id: 'bank', name: 'ব্যাংক ও বিমা', group: 'professionals', mult: 1.15, note: 'প্রকাশিত জরিপে ব্যাংকের গড় সব খাতের গড়ের ওপরে',
    roleLabel: 'কোন পদ?', roles: 'officer|অফিসার বা ট্রেইনি অফিসার (MTO)|1.00;teller|ক্যাশ বা টেলার|0.80;credit|ক্রেডিট বা ঋণ বিভাগ|1.10;forex|বৈদেশিক বাণিজ্য বিভাগ|1.10;rm|রিলেশনশিপ ম্যানেজার (গ্রাহক)|1.05;branch|ব্রাঞ্চ ম্যানেজার বা উচ্চ পদ|1.50;insure|বিমা এজেন্ট বা অফিসার|0.85',
    employers: 'state|সরকারি ব্যাংক|0.95;private|বেসরকারি ব্যাংক|1.10;foreign|বিদেশি ব্যাংক|1.40;nbfi|আর্থিক প্রতিষ্ঠান (NBFI)|1.00;mfi|ক্ষুদ্রঋণ প্রতিষ্ঠান (MFI)|0.75;insure|বিমা কোম্পানি|0.95',
    extras: [], skills: [...COMMON, 'excel', 'bankcert', 'forex', 'credit', 'aml', 'cbs', 'salesbank', 'typing'] },
  { id: 'teach', name: 'শিক্ষকতা', group: 'professionals', mult: 0.70, note: 'বেসরকারি শিক্ষকতায় বেতন তুলনামূলক কম ধরা হয়েছে (অনুমান)',
    roleLabel: 'কোন স্তরে পড়ান?', roles: 'primary|প্রাথমিক (১ম থেকে ৫ম)|0.85;secondary|মাধ্যমিক (৬ষ্ঠ থেকে ১০ম)|1.00;college|কলেজ (একাদশ-দ্বাদশ)|1.10;uni|বিশ্ববিদ্যালয় (লেকচারার)|1.30;tutor|কোচিং বা টিউটর|1.00;kg|কিন্ডারগার্টেন বা প্রি-স্কুল|0.75',
    employers: 'mpo|এমপিওভুক্ত (সরকারি অনুদানপ্রাপ্ত) প্রতিষ্ঠান|1.10;bangla|বেসরকারি বাংলা মাধ্যম স্কুল বা কলেজ|0.85;english|ইংরেজি মাধ্যম বা ক্যাডেট স্কুল|1.35;kg|কিন্ডারগার্টেন|0.75;madrasa|মাদ্রাসা|0.85;coaching|কোচিং সেন্টার|1.00;uni|বেসরকারি বিশ্ববিদ্যালয়|1.15',
    extras: [], skills: [...COMMON, 'bed', 'ntrca', 'subjeng', 'subjstem', 'ictteach', 'tuitionx', 'curr', 'research', 'excel'] },
  { id: 'engineer', name: 'প্রকৌশল (সিভিল, ইইই, মেকানিক্যাল...)', group: 'professionals', mult: 1.10, note: '',
    roleLabel: 'কোন বিভাগের প্রকৌশলী?', roles: 'civil|সিভিল|1.00;eee|ইলেকট্রিক্যাল বা ইলেকট্রনিক্স|1.05;mech|মেকানিক্যাল|1.00;textile|টেক্সটাইল বা গার্মেন্টস|0.95;chem|কেমিক্যাল বা পেট্রোলিয়াম|1.05;site|সাইট ইঞ্জিনিয়ার (মাঠ)|0.90;design|ডিজাইন বা পরিকল্পনা প্রকৌশলী|1.10;pm|প্রকল্প ব্যবস্থাপক|1.35',
    employers: 'local|দেশি নির্মাণ বা উৎপাদন প্রতিষ্ঠান|1.05;mnc|বহুজাতিক বা বড় গ্রুপ|1.25;consult|পরামর্শক প্রতিষ্ঠান|1.05;govt|সরকারি বা আধা-সরকারি|0.95;small|ছোট প্রতিষ্ঠান|0.88;power|বিদ্যুৎ বা গ্যাস প্রতিষ্ঠান|1.10',
    extras: [], skills: [...COMMON, 'autocad', 'struct', 'plc', 'pmp', 'siteexp', 'powersys', 'hse', 'pe', 'excel', 'portfolio'] },
  { id: 'health', name: 'স্বাস্থ্য (চিকিৎসক, নার্স, ফার্মাসিস্ট)', group: 'professionals', mult: 1.15, note: '',
    roleLabel: 'কোন পেশা?', roles: 'mbbs|চিকিৎসক (এমবিবিএস)|1.20|gov=1;dental|ডেন্টাল সার্জন (বিডিএস)|1.10|gov=1;special|বিশেষজ্ঞ চিকিৎসক|1.80|gov=1;nurse|নার্স|0.60;pharm|ফার্মাসিস্ট|0.85;medtech|মেডিকেল টেকনোলজিস্ট|0.65;mpo|ওষুধ কোম্পানির প্রতিনিধি (MPO)|0.90',
    employers: 'govt|সরকারি হাসপাতাল বা স্বাস্থ্য প্রতিষ্ঠান|0.95|govt=1;private|বেসরকারি হাসপাতাল|1.15;clinic|ছোট ক্লিনিক বা ডায়াগনস্টিক|0.85;pharma|ওষুধ কোম্পানি|1.15;ngo|এনজিও বা উন্নয়ন সংস্থা|1.00;intl|আন্তর্জাতিক প্রতিষ্ঠান|1.30',
    extras: [], skills: [...COMMON, 'regd', 'postgrad', 'clinical', 'labx', 'pharmasales', 'publichealth'] },
  { id: 'ngo', name: 'এনজিও ও উন্নয়ন', group: 'professionals', mult: 0.95, note: '',
    roleLabel: 'কোন পদ?', roles: 'field|ফিল্ড অফিসার বা কর্মী|0.80;prog|প্রোগ্রাম অফিসার|1.00;me|এমঅ্যান্ডই বা গবেষণা কর্মকর্তা|1.10;fin|ফাইন্যান্স বা অ্যাডমিন অফিসার|1.00;pm|প্রোগ্রাম ম্যানেজার|1.40;hr|এইচআর বা প্রশাসন|0.90',
    employers: 'national|জাতীয় এনজিও|0.95;large|বড় দেশি এনজিও (BRAC ধরনের)|1.10;intl|আন্তর্জাতিক এনজিও বা জাতিসংঘ সংস্থা|1.45;mfi|ক্ষুদ্রঋণভিত্তিক সংস্থা|0.85;small|ছোট স্থানীয় সংস্থা|0.80',
    extras: [], skills: [...COMMON, 'me', 'proposal', 'kobo', 'fieldx', 'spss', 'reportw', 'projmgt', 'locallang', 'excel'] },
  { id: 'design', name: 'ডিজাইন ও মিডিয়া', group: 'professionals', mult: 0.95, note: '',
    roleLabel: 'কোন কাজ?', roles: 'graphic|গ্রাফিক ডিজাইনার|0.90;video|ভিডিও এডিটর বা ভিডিওগ্রাফার|0.95;writer|কনটেন্ট রাইটার|0.85;journalist|সাংবাদিক বা প্রতিবেদক|0.90;photo|ফটোগ্রাফার|0.80;social|সোশ্যাল মিডিয়া ম্যানেজার|0.90;ui|ইউআই/ইউএক্স ডিজাইনার|1.10;motion|মোশন বা থ্রিডি ডিজাইনার|1.10',
    employers: 'agency|এজেন্সি বা ছোট স্টুডিও|0.90;media|টেলিভিশন, পত্রিকা বা অনলাইন মিডিয়া|1.00;company|কোম্পানির নিজস্ব দল (ইন-হাউস)|1.10;intl|বিদেশি ক্লায়েন্ট বা মার্কেটপ্লেস|1.30;ngo|এনজিও|1.00',
    extras: [], skills: [...COMMON, 'photoshop', 'videoedit', 'motion', 'contentw', 'photog', 'socialmgmt', 'uiux2', 'seo', 'threed', 'portfolio', 'freelance'] },
  { id: 'manager', name: 'ম্যানেজার ও প্রশাসন (উচ্চ পদ)', group: 'managers', mult: 1.00, note: '',
    roleLabel: 'কোন স্তর?', roles: 'lead|টিম লিডার বা সুপারভাইজার|0.85;mgr|ম্যানেজার|1.00;senior|সিনিয়র বা জেনারেল ম্যানেজার|1.30;director|পরিচালক বা প্রধান নির্বাহী|1.90',
    employers: 'small|ছোট প্রতিষ্ঠান|0.90;local|মাঝারি বা বড় দেশি প্রতিষ্ঠান|1.05;mnc|বহুজাতিক বা বড় গ্রুপ|1.30;ngo|এনজিও|1.00;govt|সরকারি বা আধা-সরকারি|0.95',
    extras: [], skills: [...COMMON, 'mba', 'team', 'pnl', 'erp2', 'negot', 'strategy', 'excel'] },
  { id: 'office', name: 'অফিস সহকারী ও প্রশাসন', group: 'clerical', mult: 1.00, note: '',
    roleLabel: 'কোন কাজ?', roles: 'asst|অফিস সহকারী|0.90;entry|ডেটা এন্ট্রি অপারেটর|0.80;recept|রিসেপশনিস্ট|0.85;admin|অ্যাডমিন অফিসার|1.05;hr|এইচআর অফিসার|1.10;pa|এক্সিকিউটিভ অ্যাসিস্ট্যান্ট|1.15;store|স্টোরকিপার|0.90',
    employers: 'small|ছোট ব্যবসা বা দোকান|0.92;local|মাঝারি বা বড় দেশি প্রতিষ্ঠান|1.08;mnc|বহুজাতিক বা বড় গ্রুপ|1.20;ngo|এনজিও|1.05;govt|সরকারি বা আধা-সরকারি|0.95',
    extras: [], skills: [...COMMON, 'msoffice', 'dataentry', 'acctbasic', 'hradmin', 'filing', 'bangla', 'typing', 'driving'] },
  { id: 'sales', name: 'বিক্রয় ও মার্কেটিং', group: 'sales', mult: 1.00, note: '',
    roleLabel: 'কোন কাজ?', roles: 'field|মাঠের বিক্রয় প্রতিনিধি|0.90;exec|সেলস এক্সিকিউটিভ|1.00;keyacc|কি-অ্যাকাউন্ট বা কর্পোরেট বিক্রয়|1.25;area|এরিয়া বা রিজিওনাল ম্যানেজার|1.40;ecom|ই-কমার্স বা অনলাইন বিক্রয়|1.00;tele|টেলিসেলস|0.80;retail|দোকান বা শোরুম কর্মী|0.75;mkt|মার্কেটিং এক্সিকিউটিভ|1.05',
    employers: 'small|ছোট ব্যবসা বা দোকান|0.90;local|মাঝারি বা বড় দেশি প্রতিষ্ঠান|1.08;fmcg|এফএমসিজি বা বড় বহুজাতিক|1.30;startup|স্টার্টআপ বা ই-কমার্স|1.05;real|রিয়েল এস্টেট বা বিমা|1.00',
    extras: [{ id: 'commission', name: 'কমিশন বা ইনসেনটিভ আছে?', options: 'no|না, শুধু বেতন|1.00;yes|হ্যাঁ, লক্ষ্য পূরণে বাড়তি আয়|1.20' }],
    skills: [...COMMON, 'fieldsales', 'crm', 'keyacc', 'b2b', 'ecom', 'bike', 'digimkt', 'brand', 'excel'] },
  { id: 'service', name: 'কাস্টমার সার্ভিস ও কল সেন্টার', group: 'sales', mult: 1.05, note: '',
    roleLabel: 'কোন কাজ?', roles: 'agent|কল সেন্টার এজেন্ট|0.90;support|কাস্টমার সাপোর্ট এক্সিকিউটিভ|1.00;chat|চ্যাট বা ইমেইল সাপোর্ট|0.95;english|ইংরেজিভাষী বিদেশি গ্রাহকের সেবা (BPO)|1.20;lead|টিম লিডার|1.30',
    employers: 'local|দেশি কোম্পানির সেবা বিভাগ|1.00;cc|কল সেন্টার বা BPO কোম্পানি|1.05;telco|টেলিকম, ব্যাংক বা বড় প্রতিষ্ঠান|1.15;startup|স্টার্টআপ বা ই-কমার্স|1.00;small|ছোট প্রতিষ্ঠান|0.90',
    extras: [{ id: 'shift', name: 'শিফট', options: 'day|দিনের শিফট|1.00;night|রাতের শিফট|1.10' }],
    skills: [...COMMON, 'spoken', 'crmtool', 'nightshift', 'escal', 'hindi', 'chatw', 'typing'] },
  { id: 'merch', name: 'গার্মেন্টস মার্চেন্ডাইজিং, কোয়ালিটি ও অফিস', group: 'technicians', mult: 0.95, note: '',
    roleLabel: 'কোন কাজ?', roles: 'merch|মার্চেন্ডাইজার|1.10;asst|অ্যাসিস্ট্যান্ট মার্চেন্ডাইজার|0.85;qc|কোয়ালিটি কন্ট্রোল অফিসার|0.85;compl|কমপ্লায়েন্স অফিসার|1.05;source|সোর্সিং বা কস্টিং অফিসার|1.15;cad|প্যাটার্ন বা ক্যাড অফিসার|0.95;prod|প্রোডাকশন অফিসার|0.90;ie|ইন্ডাস্ট্রিয়াল ইঞ্জিনিয়ার (IE)|1.05',
    employers: 'large|বড় রপ্তানিমুখী গ্রুপ|1.15;medium|মাঝারি কারখানা|1.00;small|ছোট কারখানা|0.88;buying|বায়িং হাউস|1.15',
    extras: [], skills: [...COMMON, 'excel', 'merchsw', 'costing', 'buyercomm', 'compliance', 'fabric', 'cadpat', 'sourcing', 'lean'] },
  { id: 'tech', name: 'কারিগরি সহকারী (ল্যাব, ডিপ্লোমা, সুপারভাইজার...)', group: 'technicians', mult: 1.00, note: '',
    roleLabel: 'কোন কাজ?', roles: 'lab|ল্যাব বা টেস্টিং টেকনিশিয়ান|0.90;superv|সুপারভাইজার|1.10;maint|রক্ষণাবেক্ষণ বা মেইনটেন্যান্স টেকনিশিয়ান|1.00;elec|ইলেকট্রিক্যাল বা ইলেকট্রনিক টেকনিশিয়ান|0.95;draft|ড্রাফটসম্যান|0.90;assist|অন্যান্য কারিগরি সহকারী|0.85',
    employers: 'local|দেশি কারখানা বা প্রতিষ্ঠান|1.05;mnc|বহুজাতিক বা বড় গ্রুপ|1.25;small|ছোট প্রতিষ্ঠান|0.90;govt|সরকারি বা আধা-সরকারি|0.95',
    extras: [], skills: [...COMMON, 'bteb', 'maint', 'superv', 'safety', 'multi', 'labskill', 'english_tech', 'excel'] },
  { id: 'operator', name: 'গার্মেন্টস ও কারখানার শ্রমিক (অপারেটর, অ্যাসেম্বলার)', group: 'operators', mult: 1.00, note: 'গার্মেন্টসের সর্বনিম্ন মজুরি গ্রেড অনুযায়ী ১২,৫০০ থেকে ১৪,৭৫০ টাকা (ডিসেম্বর ২০২৩), এর নিচে দেখানো হয় না',
    roleLabel: 'কোন কাজ?', roles: 'sew|সেলাই অপারেটর|1.00;finish|ফিনিশিং বা ইস্ত্রি|0.95;cut|কাটিং|1.00;pack|প্যাকিং|0.90;qc|কোয়ালিটি চেকার|1.00;linesup|লাইন সুপারভাইজার|1.30;other|অন্য মেশিন অপারেটর|1.00',
    employers: 'large|বড় রপ্তানিমুখী কারখানা|1.10;medium|মাঝারি কারখানা|1.00;small|ছোট কারখানা|0.90;other|অন্য শিল্প (প্লাস্টিক, খাদ্য, ওষুধ...)|1.00',
    extras: [{ id: 'grade', name: 'গার্মেন্টসের গ্রেড (জানা থাকলে)', options: 'g5|গ্রেড ৫ (নতুন বা শিক্ষানবিশের পরে)|1.00|floor=12500;g4|গ্রেড ৪|1.04|floor=13025;g3|গ্রেড ৩|1.08|floor=13500;g2|গ্রেড ২|1.13|floor=14150;g1|গ্রেড ১ (সর্বোচ্চ দক্ষ)|1.18|floor=14750' },
      { id: 'ot', name: 'ওভারটাইম ধরে বেতন বলছেন?', options: 'no|না, শুধু মূল মজুরি ও ভাতা|1.00;some|হ্যাঁ, দিনে ২ ঘণ্টার মতো|1.20;lot|হ্যাঁ, অনেক বেশি|1.35' }],
    skills: [...COMMON.filter(x => x === 'intern' || x === 'lead'), 'multimach', 'target', 'qcsense', 'trainer', 'bgmea', 'linesup'] },
  { id: 'craft', name: 'দক্ষ কারিগর (ইলেকট্রিশিয়ান, মিস্ত্রি, মেকানিক...)', group: 'craft', mult: 1.00, note: '',
    roleLabel: 'কোন কাজ?', roles: 'elec|ইলেকট্রিশিয়ান|1.05;mason|রাজমিস্ত্রি|1.00;weld|ওয়েল্ডার|1.00;plumb|প্লাম্বার|0.95;mech|মেকানিক|1.05;carp|কাঠমিস্ত্রি|0.95;ac|এসি বা রেফ্রিজারেটর টেকনিশিয়ান|1.15;driver|ড্রাইভার|0.90;tailor|দর্জি|0.85',
    employers: 'own|নিজের কাজ (দোকান বা ঠিকাদারি)|1.00;company|কোম্পানি বা কারখানায় চাকরি|1.05;contract|ঠিকাদারের অধীনে|0.92;abroad|বিদেশে|1.80',
    extras: [], skills: [...COMMON.filter(x => x === 'intern' || x === 'lang2'), 'tradecert', 'weld', 'modern', 'ownsite', 'team2', 'driving'] },
  { id: 'elementary', name: 'সাধারণ শ্রম (সহকারী, নিরাপত্তা, ডেলিভারি...)', group: 'elementary', mult: 1.00, note: '',
    roleLabel: 'কোন কাজ?', roles: 'helper|সহকারী বা হেল্পার|0.95;clean|পরিচ্ছন্নতাকর্মী|0.85;guard|নিরাপত্তারক্ষী|1.05;delivery|ডেলিভারি রাইডার বা কুরিয়ার|1.00;cook|রাঁধুনি বা খাবারের কাজ|1.00',
    employers: 'small|ছোট দোকান বা বাসা|0.90;company|কোম্পানি বা কারখানা|1.05;agency|সিকিউরিটি বা সেবা এজেন্সি|1.00;platform|অ্যাপ-ভিত্তিক সংস্থা (Pathao, Foodpanda...)|1.05',
    extras: [], skills: ['firstaid', 'security', 'smartphone', 'bike2', 'cook', 'lang2', 'driving'] }
];
const FAMILIES = F.map(f => ({ id: f.id, name: f.name, group: f.group, mult: f.mult, note: f.note, roleLabel: f.roleLabel, roles: L(f.roles), employers: L(f.employers), extras: f.extras.map(q => ({ id: q.id, name: q.name, options: L(q.options) })), skills: f.skills }));
for (const f of FAMILIES) for (const s of f.skills) if (!SK[s]) throw new Error(f.id + ': unknown skill ' + s);
module.exports = { FAMILIES, SKILLS: Object.values(SK) };
