/* ভাইয়া-আপু: the lists and the checks shared by the page (tutor.html), the join form (tutor-join.html) and the admin tab.
   The same lists live in migrations/2026-12-17_tutors.sql (the server checks everything again: a page can be bypassed). Tests: tools/tests/test_tutor.js */
(function(root){
  'use strict';
  var SUBJECTS = [['bangla', 'বাংলা'], ['english', 'ইংরেজি'], ['math', 'গণিত'], ['science', 'বিজ্ঞান'], ['physics', 'পদার্থবিজ্ঞান'], ['chemistry', 'রসায়ন'], ['biology', 'জীববিজ্ঞান'], ['hmath', 'উচ্চতর গণিত'], ['ict', 'আইসিটি'],
    ['accounting', 'হিসাববিজ্ঞান'], ['business', 'ব্যবসায় শিক্ষা'], ['economics', 'অর্থনীতি'], ['social', 'ইতিহাস ও সমাজ'], ['religion', 'ধর্ম ও নৈতিক শিক্ষা'], ['arabic', 'আরবি ও কুরআন'], ['handwriting', 'হাতের লেখা'], ['admission', 'ভর্তি প্রস্তুতি'], ['primary_all', 'সব বিষয় (প্রাথমিক)']];
  var CLASSES = [['c1-5', 'শ্রেণি ১-৫'], ['c6-8', 'শ্রেণি ৬-৮'], ['c9-10', 'শ্রেণি ৯-১০'], ['c11-12', 'একাদশ-দ্বাদশ'], ['admission', 'ভর্তি প্রস্তুতি']];
  var MODES = [['home', 'বাসায়'], ['online', 'অনলাইনে']];
  var TIMES = [['morning', 'সকাল'], ['afternoon', 'দুপুর-বিকেল'], ['evening', 'সন্ধ্যা-রাত'], ['weekend', 'সাপ্তাহিক ছুটি']];
  var LEVELS = [['hsc', 'এইচএসসি বা সমমান পাস করেছি'], ['bachelor', 'স্নাতকে পড়ছি'], ['masters', 'স্নাতকোত্তরে পড়ছি'], ['graduate', 'পড়াশোনা শেষ করেছি']];
  var GENDERS = [['female', 'আপু'], ['male', 'ভাইয়া']];
  var STATUS = { draft: 'খসড়া', submitted: 'রিভিউয়ের অপেক্ষায়', approved: 'অনুমোদিত', rejected: 'অনুমোদন হয়নি', paused: 'বিরতিতে' };
  var REQ_STATUS = { 'new': 'নতুন', matching: 'মিলানো চলছে', matched: 'মিলে গেছে', closed: 'বন্ধ', spam: 'স্প্যাম' };

  var MSG = {
    NEED_NAME: 'নাম লিখুন, কমপক্ষে ২ অক্ষর।', NEED_PHONE: 'একটা সঠিক মোবাইল নম্বর দিন, যেমন ০১৭XXXXXXXX।', NEED_STUDY: 'কোথায়, কোন বিভাগে আর কোন ধাপে পড়েন, বলুন।',
    NEED_SUBJECT: 'অন্তত একটা বিষয় বেছে নিন।', NEED_CLASS: 'অন্তত একটা শ্রেণি বেছে নিন।', NEED_MODE: 'বাসায় না অনলাইনে, অন্তত একটা বেছে নিন।', NEED_AREA: 'জেলা আর উপজেলা বেছে নিন।',
    NEED_BIO: 'নিজের কথা কমপক্ষে ২০ অক্ষরে লিখুন।', NEED_AGE: 'টিউটর হতে বয়স ১৮ বা তার বেশি হতে হবে।', NEED_TERMS: 'শর্ত ও গোপনীয়তা নীতিতে সম্মতি দিন।',
    BAD_LINK: 'লিংক বা ইমেইল লেখা যাবে না।', BAD_PRIVATE: 'ফোন নম্বর বা লম্বা সংখ্যা এখানে লেখা যাবে না, নম্বর আলাদা ঘরে দিন।', BAD_TEXT: 'এই লেখায় এমন শব্দ আছে যা এখানে চলে না।',
    BAD_NAME: 'নাম লিখুন, কমপক্ষে ২ অক্ষর।', BAD_PHONE: 'একটা সঠিক মোবাইল নম্বর দিন, যেমন ০১৭XXXXXXXX।', BAD_CLASS: 'শ্রেণি বেছে নিন।', BAD_SUBJECT: 'অন্তত একটা আর সর্বোচ্চ ৬টা বিষয় বেছে নিন।', BAD_MODE: 'বাসায় না অনলাইনে, বেছে নিন।', BAD_AREA: 'জেলা আর উপজেলা বেছে নিন।',
    TOO_FAST: 'একটু পরে আবার চেষ্টা করুন।', DAILY_LIMIT: 'আজকের জন্য সর্বোচ্চ ৩টা অনুরোধ পাঠানো হয়ে গেছে। কাল আবার পাঠাতে পারবেন।', PHONE_LIMIT: 'এই নম্বর থেকে আজ অনেকগুলো অনুরোধ এসেছে। কাল আবার চেষ্টা করুন।',
    DUPLICATE: 'এই একই অনুরোধ আপনি কয়েক দিনের মধ্যে পাঠিয়েছেন। আমরা দেখছি, একটু অপেক্ষা করুন।', BUSY: 'এখন অনেক অনুরোধ আসছে। কয়েক মিনিট পরে চেষ্টা করুন।', CLOSED: 'নতুন অনুরোধ এখন নেওয়া হচ্ছে না। একটু পরে দেখুন।',
    SPAM: 'অনুরোধটা পাঠানো যায়নি।', BAD_DEVICE: 'এই ব্রাউজারে সেভ করার জায়গা বন্ধ। চালু করে আবার চেষ্টা করুন।', NOT_SIGNED_IN: 'আগে সাইন-ইন করুন।'
  };
  function errText(e){ var m = String((e && (e.message || e)) || ''); var k = Object.keys(MSG).filter(function(c){ return m.indexOf(c) > -1; })[0]; return k ? MSG[k] : 'এখন করা যায়নি, একটু পরে আবার চেষ্টা করুন।'; }

  function labelOf(list, key){ for(var i = 0; i < list.length; i++) if(list[i][0] === key) return list[i][1]; return ''; }
  function labels(list, keys){ return (keys || []).map(function(k){ return labelOf(list, k); }).filter(Boolean); }
  function keysOf(list){ return list.map(function(x){ return x[0]; }); }
  function enDigits(s){ return String(s == null ? '' : s).replace(/[০-৯]/g, function(d){ return '০১২৩৪৫৬৭৮৯'.indexOf(d); }); }
  function bn(n){ return String(n).replace(/[0-9]/g, function(d){ return '০১২৩৪৫৬৭৮৯'[d]; }); }
  function cleanText(s, max){ return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max || 200); }
  function cleanBio(s, max){ return String(s == null ? '' : s).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max || 400); }

  /* a Bangladeshi mobile number (01XXXXXXXXX): Bangla digits, spaces, dashes, +88 and 88 are fine; '' when it is not one */
  function normalizePhone(s){
    var n = enDigits(s).replace(/[\s\-\.\(\)\+]/g, '');
    if(/^8801[3-9][0-9]{8}$/.test(n)) return n.slice(2);
    if(/^01[3-9][0-9]{8}$/.test(n)) return n;
    return '';
  }
  /* null when a free text is fine, else BAD_LINK or BAD_PRIVATE (the bad-word list is on the server only) */
  function textProblem(s){
    var plain = enDigits(s), compact = plain.replace(/[\s\-\.\(\)\+]/g, '');
    if(!plain) return null;
    if(/(https?:|www\.|\.(com|net|org|info|xyz|link|bd)($|[^a-z]))/i.test(plain) || /[^\s@]+@[^\s@]+/.test(plain)) return 'BAD_LINK';
    if(/01[3-9][0-9]{8}/.test(compact) || /[0-9]{10,}/.test(plain)) return 'BAD_PRIVATE';
    return null;
  }

  /* the guardian's request: {field: code} for what is wrong; {} when it can be sent */
  function validateRequest(r){
    var e = {}, subs = (r.subjects || []).filter(function(x){ return keysOf(SUBJECTS).indexOf(x) > -1; });
    if(cleanText(r.name, 60).length < 2) e.name = 'BAD_NAME'; else if(textProblem(r.name)) e.name = textProblem(r.name);
    if(!normalizePhone(r.phone)) e.phone = 'BAD_PHONE';
    if(keysOf(CLASSES).indexOf(r.cls) < 0) e.cls = 'BAD_CLASS';
    if(subs.length < 1 || subs.length > 6) e.subjects = 'BAD_SUBJECT';
    if(['home', 'online', 'any'].indexOf(r.mode || 'any') < 0) e.mode = 'BAD_MODE';
    if((r.mode || 'any') !== 'online' && (!cleanText(r.district, 40) || !cleanText(r.upazila, 60))) e.area = 'BAD_AREA';
    if(textProblem(r.note)) e.note = textProblem(r.note);
    return e;
  }
  /* a tutor's profile. submit = false (a draft) only checks free text; true checks everything the server checks for a submit */
  function validateProfile(p, submit){
    var e = {}, bad = function(f, v){ var c = textProblem(v); if(c) e[f] = c; };
    ['full_name', 'display_name', 'institution', 'department', 'area_note', 'fee_note', 'bio'].forEach(function(f){ bad(f, p[f]); });
    if(!submit) return e;
    var pick = function(a, list){ return (a || []).filter(function(x){ return keysOf(list).indexOf(x) > -1; }); };
    if(cleanText(p.full_name, 60).length < 2) e.full_name = 'NEED_NAME';
    if(!normalizePhone(p.phone)) e.phone = 'NEED_PHONE';
    if(cleanText(p.institution, 80).length < 2 || cleanText(p.department, 60).length < 2 || keysOf(LEVELS).indexOf(p.edu_level) < 0) e.study = 'NEED_STUDY';
    if(pick(p.subjects, SUBJECTS).length < 1) e.subjects = 'NEED_SUBJECT';
    if(pick(p.classes, CLASSES).length < 1) e.classes = 'NEED_CLASS';
    var modes = pick(p.modes, MODES); if(modes.length < 1) e.modes = 'NEED_MODE';
    if(!cleanText(p.district, 40) || (modes.indexOf('home') > -1 && !cleanText(p.upazila, 60))) e.area = 'NEED_AREA';
    if(cleanBio(p.bio, 400).length < 20) e.bio = 'NEED_BIO';
    if(!p.age_ok) e.age_ok = 'NEED_AGE';
    if(!p.terms_ok) e.terms_ok = 'NEED_TERMS';
    return e;
  }

  /* the question for /api/dir?f=tutors (empty things are left out) */
  function searchArgs(f){
    var a = { p_limit: Math.max(1, Math.min(30, (f && f.limit) || 12)), p_offset: Math.max(0, Math.min(500, (f && f.offset) || 0)) };
    if(f && f.district) a.p_district = f.district;
    if(f && f.upazila) a.p_upazila = f.upazila;
    if(f && keysOf(CLASSES).indexOf(f.cls) > -1) a.p_class = f.cls;
    if(f && keysOf(SUBJECTS).indexOf(f.subject) > -1) a.p_subject = f.subject;
    if(f && (f.mode === 'home' || f.mode === 'online')) a.p_mode = f.mode;
    return a;
  }

  /* a short, readable line about what a guardian wants (admin tab, WhatsApp messages) */
  function wantLine(r){
    var where = r.mode === 'online' ? 'অনলাইনে' : [r.district, r.upazila].filter(Boolean).join(', ') + (r.mode === 'home' ? ' (বাসায়)' : '');
    return labelOf(CLASSES, r.class_band || r.cls) + ' · ' + labels(SUBJECTS, r.subjects).join(', ') + ' · ' + where;
  }
  function waNumber(phone){ var n = normalizePhone(phone); return n ? '88' + n : ''; }
  function waLink(phone, text){ var n = waNumber(phone); return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(text || '') : ''; }
  /* what the admin sends a tutor about a request (no guardian number yet), and what goes to the guardian about a tutor */
  function msgToTutor(req, tutor){
    return 'আসসালামু আলাইকুম ' + (tutor.display_name || tutor.full_name || '') + '। ভাইয়া-আপু (Protishthan) থেকে বলছি।\n' +
      'একটা টিউশনের অনুরোধ এসেছে: ' + wantLine(req) + '।\nআপনি কি আগ্রহী? আগ্রহী হলে এখানে উত্তর দিন, আমরা অভিভাবকের সাথে যোগাযোগ করিয়ে দেব।';
  }
  function msgToGuardian(req, tutor){
    var lv = labelOf(LEVELS, tutor.edu_level);
    return 'আসসালামু আলাইকুম ' + (req.name || '') + '। ভাইয়া-আপু (Protishthan) থেকে বলছি।\nআপনার অনুরোধ (' + wantLine(req) + ') অনুযায়ী একজনের পরিচয়:\n' +
      (tutor.display_name || tutor.full_name || '') + ', ' + tutor.institution + ', ' + tutor.department + (lv ? ' (' + lv + ')' : '') + '\nপড়ান: ' + labels(SUBJECTS, tutor.subjects).join(', ') + '\nশ্রেণি: ' + labels(CLASSES, tutor.classes).join(', ') +
      (tutor.verify === 'verified' ? '\nআমরা এঁর NID ও সনদের কপি দেখেছি।' : '') +
      '\nআগ্রহী হলে জানান, আমরা নম্বর বিনিময় করিয়ে দেব। প্রথম ক্লাসে আপনি নিজে উপস্থিত থাকুন।';
  }

  var api = { SUBJECTS: SUBJECTS, CLASSES: CLASSES, MODES: MODES, TIMES: TIMES, LEVELS: LEVELS, GENDERS: GENDERS, STATUS: STATUS, REQ_STATUS: REQ_STATUS, MSG: MSG, errText: errText,
    labelOf: labelOf, labels: labels, keysOf: keysOf, enDigits: enDigits, bn: bn, cleanText: cleanText, cleanBio: cleanBio, normalizePhone: normalizePhone, textProblem: textProblem,
    validateRequest: validateRequest, validateProfile: validateProfile, searchArgs: searchArgs, wantLine: wantLine, waNumber: waNumber, waLink: waLink, msgToTutor: msgToTutor, msgToGuardian: msgToGuardian };
  root.TutorData = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
