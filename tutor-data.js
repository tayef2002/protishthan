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
  /* the optional extras (migrations/2026-12-19_tutor_profile_more.sql): how a tutor teaches, experience, promises; and what a guardian prefers */
  var MEDIUMS = [['bangla', 'বাংলা মাধ্যম'], ['english_version', 'ইংরেজি ভার্সন'], ['english_medium', 'ইংরেজি মাধ্যম'], ['madrasa', 'মাদ্রাসা']];
  var EXAMS = [['scholarship', 'বৃত্তি পরীক্ষা'], ['ssc', 'এসএসসি'], ['hsc', 'এইচএসসি'], ['admission_med', 'মেডিকেল ভর্তি'], ['admission_eng', 'প্রকৌশল ভর্তি'], ['admission_uni', 'বিশ্ববিদ্যালয় ভর্তি'], ['ielts', 'IELTS'], ['olevel', 'ও-লেভেল / এ-লেভেল']];
  var STYLES = [['concept', 'আগে ধারণা পরিষ্কার করি'], ['practice', 'অনুশীলন আর নিয়মিত পরীক্ষা'], ['homework', 'হোমওয়ার্কে সাহায্য'], ['patient', 'দুর্বল শিক্ষার্থীকে ধৈর্য নিয়ে'], ['fun', 'মজা করে, গল্পে গল্পে']];
  var BATCHES = [['one', 'শুধু একজনকে'], ['small', 'ছোট গ্রুপে'], ['both', 'একজন বা ছোট গ্রুপ, দুটোই']];
  var DAYS = [['2', '২ দিন'], ['3', '৩ দিন'], ['4', '৪ দিন'], ['5', '৫ দিন'], ['6', '৬ দিন'], ['7', 'প্রতিদিন']];
  var SESSIONS = [['45', '৪৫ মিনিট'], ['60', '১ ঘণ্টা'], ['90', 'দেড় ঘণ্টা'], ['120', '২ ঘণ্টা']];
  var EXPS = [['new', 'নতুন শুরু করছি'], ['lt1', '১ বছরের কম'], ['y1_2', '১-২ বছর'], ['y3_5', '৩-৫ বছর'], ['y5p', '৫ বছরের বেশি']];
  var TAUGHTS = [['none', 'এখনো কাউকে না'], ['n1_5', '১-৫ জন'], ['n6_20', '৬-২০ জন'], ['n20p', '২০ জনের বেশি']];
  var PLEDGES = [['guardian_first', 'প্রথম ক্লাসে অভিভাবক উপস্থিত থাকলে আমি রাজি'], ['open_place', 'পড়ানো হবে খোলামেলা জায়গায়, যেখানে বাড়ির কেউ কাছাকাছি থাকেন'], ['hours', 'নির্ধারিত সময়ের বাইরে শিক্ষার্থীর সাথে ব্যক্তিগত যোগাযোগ করব না']];
  var PREFS = [['', 'যেকোনো'], ['female', 'আপু'], ['male', 'ভাইয়া']];
  var STUDENT_LEVELS = [['weak', 'পড়ায় দুর্বল'], ['mid', 'মাঝারি'], ['good', 'ভালো, আরও এগোতে চায়']];
  var GOALS = [['exam', 'পরীক্ষার ভালো প্রস্তুতি'], ['concept', 'ভিত শক্ত করা'], ['homework', 'হোমওয়ার্ক আর স্কুলের পড়ায় সাহায্য']];
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
    BAD_GPA: 'জিপিএ ১.০০ থেকে ৫.০০-এর মধ্যে লিখুন, যেমন ৪.৮৩।', BAD_PREF: 'পছন্দটা বেছে নিন।', BAD_LEVEL: 'পছন্দটা বেছে নিন।', BAD_GOAL: 'পছন্দটা বেছে নিন।',
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
    if((r.pref || '') !== '' && keysOf(GENDERS).indexOf(r.pref) < 0) e.pref = 'BAD_PREF';
    if((r.level || '') !== '' && keysOf(STUDENT_LEVELS).indexOf(r.level) < 0) e.level = 'BAD_LEVEL';
    if((r.goal || '') !== '' && keysOf(GOALS).indexOf(r.goal) < 0) e.goal = 'BAD_GOAL';
    return e;
  }
  /* a GPA typed by a person ("৪.৮৩", "4.83", "5"): the clean text "4.83", '' when empty, null when it is not a GPA between 1.00 and 5.00 */
  function normalizeGpa(s){
    var t = enDigits(s).replace(/\s+/g, '').replace(/[।,]/g, '.');
    if(t === '') return '';
    if(!/^[1-5](\.[0-9]{1,2})?$/.test(t)) return null;
    var n = Number(t); return n >= 1 && n <= 5 ? t : null;
  }
  /* a tutor's profile. submit = false (a draft) only checks free text; true checks everything the server checks for a submit */
  function validateProfile(p, submit){
    var e = {}, bad = function(f, v){ var c = textProblem(v); if(c) e[f] = c; };
    ['full_name', 'display_name', 'institution', 'department', 'area_note', 'fee_note', 'achv', 'bio'].forEach(function(f){ bad(f, p[f]); });
    ['ssc_gpa', 'hsc_gpa'].forEach(function(f){ if(normalizeGpa(p[f]) === null) e[f] = 'BAD_GPA'; });
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
  /* a guardian's optional wishes, as one line ('' when there are none). Works on a stored request (pref_gender, student_level, goal, want_trial) and on the form (pref, level, goal, trial) */
  function prefLine(r){
    var g = r.pref_gender != null ? r.pref_gender : r.pref, lv = r.student_level != null ? r.student_level : r.level, go = r.goal, tr = r.want_trial != null ? r.want_trial : r.trial, out = [];
    if(g) out.push('চান: ' + labelOf(GENDERS, g));
    if(lv) out.push('সন্তান: ' + labelOf(STUDENT_LEVELS, lv));
    if(go) out.push('লক্ষ্য: ' + labelOf(GOALS, go));
    if(tr) out.push('প্রথমে ট্রায়াল ক্লাস চান');
    return out.join(' · ');
  }
  /* what to show a guardian about a tutor beyond the basics: {badges, chips, lines}, plain text (the page escapes it). Everything a tutor typed or ticked is labelled as theirs; only the admin's "verified" is a check */
  function extrasOf(t){
    var out = { badges: [], chips: [], lines: [] }, has = function(a){ return a && a.length; }, pledged = t.pledge_all === true || (has(t.pledge) && t.pledge.length >= 3);
    if(t.trial) out.badges.push({ k: 'trial', text: 'প্রথম ক্লাস ফ্রি ট্রায়াল' });
    if(pledged) out.badges.push({ k: 'pledge', text: 'প্রতিশ্রুতি দিয়েছেন' });
    labels(MEDIUMS, t.medium).forEach(function(x){ out.chips.push(x); });
    labels(EXAMS, t.exams).forEach(function(x){ out.chips.push(x); });
    if(has(t.style)) out.lines.push('পড়ানোর ধরন: ' + labels(STYLES, t.style).join(', '));
    var b = labelOf(BATCHES, t.batch), d = Number(t.days_max) > 0 ? labelOf(DAYS, String(t.days_max)) : '', s = Number(t.session_mins) > 0 ? labelOf(SESSIONS, String(t.session_mins)) : '';
    if(b || d || s) out.lines.push('ব্যাচ: ' + [b, d && 'সপ্তাহে সর্বোচ্চ ' + d, s && 'প্রতি ক্লাস ' + s].filter(Boolean).join(' · '));
    var ex = labelOf(EXPS, t.exp), tg = labelOf(TAUGHTS, t.taught);
    if(ex || tg) out.lines.push('অভিজ্ঞতা: ' + [ex, tg && 'পড়িয়েছেন ' + tg].filter(Boolean).join(' · ') + ' (নিজে দিয়েছেন)');
    var rs = [t.ssc_gpa ? 'এসএসসি জিপিএ ' + bn(t.ssc_gpa) : '', t.hsc_gpa ? 'এইচএসসি জিপিএ ' + bn(t.hsc_gpa) : ''].filter(Boolean);
    if(rs.length) out.lines.push(rs.join(', ') + ' (নিজে দিয়েছেন)');
    if(t.achv) out.lines.push('অর্জন: ' + t.achv + ' (নিজে দিয়েছেন)');
    var fee = t.fee != null ? t.fee : (t.fee_show ? t.fee_note : '');
    if(fee) out.lines.push('ফি: ' + fee + ' (টিউটরের নিজের দেওয়া, আপনি আর টিউটর ঠিক করবেন)');
    return out;
  }
  /* the same extras as ready-to-place HTML pieces {badges, chips, lines} for the card, the preview and the admin; esc is the page's own escape function.
     "(নিজে দিয়েছেন)" / "(টিউটরের নিজের দেওয়া…)" are shown small and grey: they are the tutor's words, not a check */
  function extrasHtml(t, esc){
    var x = extrasOf(t);
    return {
      badges: x.badges.map(function(b){ return '<span class="tt-b ' + (b.k === 'trial' ? 'ok' : 'vio') + '">✓ ' + esc(b.text) + '</span>'; }).join(''),
      chips: x.chips.map(function(c){ return '<span class="tt-c alt">' + esc(c) + '</span>'; }).join(''),
      lines: x.lines.map(function(l){ return '<div>' + esc(l).replace(/\((নিজে দিয়েছেন|টিউটরের নিজের দেওয়া[^)]*)\)/, '<span class="tt-self">($1)</span>') + '</div>'; }).join('')
    };
  }
  function waNumber(phone){ var n = normalizePhone(phone); return n ? '88' + n : ''; }
  function waLink(phone, text){ var n = waNumber(phone); return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(text || '') : ''; }
  /* what the admin sends a tutor about a request (no guardian number yet), and what goes to the guardian about a tutor */
  function msgToTutor(req, tutor){
    return 'আসসালামু আলাইকুম ' + (tutor.display_name || tutor.full_name || '') + '। ভাইয়া-আপু (Protishthan) থেকে বলছি।\n' +
      'একটা টিউশনের অনুরোধ এসেছে: ' + wantLine(req) + '।' + (prefLine(req) ? '\nঅভিভাবকের পছন্দ: ' + prefLine(req) + '।' : '') + '\nআপনি কি আগ্রহী? আগ্রহী হলে এখানে উত্তর দিন, আমরা অভিভাবকের সাথে যোগাযোগ করিয়ে দেব।';
  }
  function msgToGuardian(req, tutor){
    var lv = labelOf(LEVELS, tutor.edu_level);
    return 'আসসালামু আলাইকুম ' + (req.name || '') + '। ভাইয়া-আপু (Protishthan) থেকে বলছি।\nআপনার অনুরোধ (' + wantLine(req) + ') অনুযায়ী একজনের পরিচয়:\n' +
      (tutor.display_name || tutor.full_name || '') + ', ' + tutor.institution + ', ' + tutor.department + (lv ? ' (' + lv + ')' : '') + '\nপড়ান: ' + labels(SUBJECTS, tutor.subjects).join(', ') + '\nশ্রেণি: ' + labels(CLASSES, tutor.classes).join(', ') +
      (tutor.trial ? '\nপ্রথম ক্লাস ফ্রি ট্রায়াল দিতে রাজি (টিউটরের কথা)।' : '') +
      (tutor.verify === 'verified' ? '\nআমরা এঁর NID ও সনদের কপি দেখেছি।' : '') +
      '\nআগ্রহী হলে জানান, আমরা নম্বর বিনিময় করিয়ে দেব। প্রথম ক্লাসে আপনি নিজে উপস্থিত থাকুন।';
  }

  /* how complete a tutor's profile is (0 to 100) and what to add next; the weights add up to 100 */
  function profileStrength(p){
    var pts = 0, tips = [], add = function(ok, w, tip){ if(ok) pts += w; else if(tip) tips.push(tip); };
    var has = function(a, k){ return (a || []).indexOf(k) > -1; };
    /* the four required steps are worth 70, the optional extras 30 (ticking the first-class promise and a free trial matter most) */
    add(cleanText(p.full_name, 60).length >= 2, 6, 'পুরো নাম লিখুন');
    add(!!normalizePhone(p.phone), 7, 'হোয়াটসঅ্যাপ নম্বর দিন');
    add(cleanText(p.institution, 80).length >= 2 && cleanText(p.department, 60).length >= 2 && !!p.edu_level, 11, 'প্রতিষ্ঠান, বিভাগ আর ধাপ লিখুন');
    var s = (p.subjects || []).length; add(s >= 1, 8, 'অন্তত একটা বিষয় বেছে নিন'); add(s >= 3, 4, 'আরও কয়েকটা বিষয় বাছলে বেশি অনুরোধের সাথে মিলবে');
    add((p.classes || []).length >= 1, 8, 'কোন শ্রেণি পড়াবেন বেছে নিন');
    add((p.modes || []).length >= 1, 4, 'বাসায় না অনলাইনে, বেছে নিন');
    add(!!p.district && (!has(p.modes, 'home') || !!p.upazila), 8, 'জেলা আর উপজেলা বেছে নিন');
    add((p.times || []).length >= 1, 2, 'কখন সময় হবে, বলুন');
    var b = cleanBio(p.bio, 400).length; add(b >= 20, 7, 'নিজের কথা কয়েক লাইনে লিখুন'); add(b >= 120, 3, 'নিজের কথা আরেকটু বিস্তারিত লিখলে অভিভাবকের আস্থা বাড়ে');
    add(!!p.gender, 2, 'আপু না ভাইয়া, কোনটা বলে ডাকা হবে তা বেছে নিন');
    add(!!p.trial, 4, 'প্রথম ক্লাস ফ্রি ট্রায়ালে রাজি হলে অভিভাবক সহজে ভরসা করেন');
    add((p.medium || []).length >= 1, 3, 'কোন মাধ্যমে পড়ান, বলুন');
    add((p.exams || []).length >= 1, 3, 'কোন পরীক্ষার প্রস্তুতি করান, বলুন');
    add((p.style || []).length >= 1, 3, 'আপনার পড়ানোর ধরন বেছে নিন');
    add(!!p.batch, 1, 'একজনকে না ছোট গ্রুপে পড়ান, বলুন'); add(Number(p.days_max) > 0, 1, 'সপ্তাহে কয়দিন পারেন, বলুন'); add(Number(p.session_mins) > 0, 1, 'প্রতি ক্লাস কতক্ষণ, বলুন');
    add(!!p.exp, 4, 'পড়ানোর অভিজ্ঞতা কতদিনের, বলুন');
    add(!!p.taught, 2, 'এ পর্যন্ত কতজনকে পড়িয়েছেন, বলুন');
    add(!!normalizeGpa(p.ssc_gpa) || !!normalizeGpa(p.hsc_gpa), 3, 'নিজের এসএসসি বা এইচএসসি ফল লিখুন');
    add((p.pledge || []).length >= 3, 5, 'তিনটা প্রতিশ্রুতিতেই টিক দিন, অভিভাবক এটা দেখে নিশ্চিন্ত হন');
    return { pct: Math.min(100, pts), tips: tips };
  }
  /* what a guardian reads about their own request */
  function requestLine(st){
    var s = st && st.status, n = Number(st && st.sent) || 0;
    if(s === 'matching') return n > 0 ? 'আপনার জন্য টিউটর মিলানো হচ্ছে। ' + bn(n) + ' জনের কাছে জানানো হয়েছে।' : 'আপনার জন্য টিউটর খুঁজছি।';
    if(s === 'matched') return 'টিউটর মিলে গেছে ✓';
    if(s === 'closed') return 'অনুরোধটা বন্ধ করা হয়েছে।';
    return 'আমরা আপনার অনুরোধ দেখছি।';
  }

  var api = { profileStrength: profileStrength, requestLine: requestLine, prefLine: prefLine, extrasOf: extrasOf, extrasHtml: extrasHtml, normalizeGpa: normalizeGpa,
    MEDIUMS: MEDIUMS, EXAMS: EXAMS, STYLES: STYLES, BATCHES: BATCHES, DAYS: DAYS, SESSIONS: SESSIONS, EXPS: EXPS, TAUGHTS: TAUGHTS, PLEDGES: PLEDGES, PREFS: PREFS, STUDENT_LEVELS: STUDENT_LEVELS, GOALS: GOALS,
    SUBJECTS: SUBJECTS, CLASSES: CLASSES, MODES: MODES, TIMES: TIMES, LEVELS: LEVELS, GENDERS: GENDERS, STATUS: STATUS, REQ_STATUS: REQ_STATUS, MSG: MSG, errText: errText,
    labelOf: labelOf, labels: labels, keysOf: keysOf, enDigits: enDigits, bn: bn, cleanText: cleanText, cleanBio: cleanBio, normalizePhone: normalizePhone, textProblem: textProblem,
    validateRequest: validateRequest, validateProfile: validateProfile, searchArgs: searchArgs, wantLine: wantLine, waNumber: waNumber, waLink: waLink, msgToTutor: msgToTutor, msgToGuardian: msgToGuardian };
  root.TutorData = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
