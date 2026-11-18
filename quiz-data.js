/* প্রতিষ্ঠান লিগ: the lists and the checks of a quiz question, shared by the admin tab (admin-quiz.js), the reviewer page (qreview.js) and the tests.
   The same rules live in migrations/2027-01-10_quiz_bank.sql (the server checks everything again: a page can be bypassed). Tests: tools/tests/test_quiz_data.js */
(function(root){
  'use strict';
  var TOPICS = [['bangla', 'বাংলা'], ['english', 'ইংরেজি'], ['math', 'গণিত'], ['science', 'বিজ্ঞান'], ['gk', 'সাধারণ জ্ঞান'], ['history', 'ইতিহাস ও মুক্তিযুদ্ধ'], ['ict', 'তথ্য ও যোগাযোগ প্রযুক্তি'], ['geo', 'ভূগোল ও জেলা'], ['sports', 'খেলাধুলা'], ['school', 'স্কুলজীবন'], ['puzzle', 'ধাঁধা ও যুক্তি']];
  var BANDS = [['any', 'সব শ্রেণি'], ['c1-5', 'শ্রেণি ১-৫'], ['c6-8', 'শ্রেণি ৬-৮'], ['c9-10', 'শ্রেণি ৯-১০'], ['c11-12', 'একাদশ-দ্বাদশ']];
  var DIFFS = [[1, 'সহজ'], [2, 'মাঝারি'], [3, 'কঠিন']];
  var STATUS = { draft: 'খসড়া', review: 'যাচাইয়ে', flagged: 'ভুল ধরা পড়েছে', verified: 'যাচাই হয়েছে', retired: 'বাদ' };
  var VERDICT = { ok: 'সঠিক', wrong: 'ভুল', unsure: 'নিশ্চিত নই' };
  var NEED_OK = 2;                                    // two different reviewers say ok (the server decides; this is only for the words on the screen)

  function keysOf(list){ return list.map(function(x){ return x[0]; }); }
  function labelOf(list, k){ for(var i = 0; i < list.length; i++) if(String(list[i][0]) === String(k)) return list[i][1]; return ''; }
  function clean(s){ return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function bnDigits(n){ return String(n).replace(/[0-9]/g, function(d){ return '০১২৩৪৫৬৭৮৯'[d]; }); }

  /* one question as the form or the import holds it: { topic, band, difficulty, question, options[4], answer_idx, explanation, source }  ->  '' or the first problem, in words */
  function validateQuestion(o){
    if(!o || typeof o !== 'object') return 'প্রশ্নটা পড়া যায়নি।';
    if(keysOf(TOPICS).indexOf(o.topic) < 0) return 'বিষয় বেছে নিন।';
    if(keysOf(BANDS).indexOf(o.band || 'any') < 0) return 'শ্রেণি ঠিক নেই।';
    var d = Number(o.difficulty == null ? 2 : o.difficulty); if(!(d >= 1 && d <= 3 && d === Math.floor(d))) return 'কঠিনতা ১, ২ বা ৩ হতে হবে।';
    var q = clean(o.question); if(q.length < 5) return 'প্রশ্ন কমপক্ষে ৫ অক্ষরের লিখুন।'; if(q.length > 300) return 'প্রশ্ন ৩০০ অক্ষরের বেশি হবে না।';
    if(!Array.isArray(o.options) || o.options.length !== 4) return 'ঠিক চারটা উত্তর লাগবে।';
    var opts = o.options.map(clean);
    for(var i = 0; i < 4; i++){ if(!opts[i]) return 'চারটা উত্তরই লিখুন।'; if(opts[i].length > 100) return 'উত্তর ১০০ অক্ষরের বেশি হবে না।'; }
    if(new Set(opts).size !== 4) return 'চারটা উত্তর আলাদা হতে হবে।';
    var a = Number(o.answer_idx); if(!(a >= 0 && a <= 3 && a === Math.floor(a))) return 'সঠিক উত্তরটা বেছে নিন।';
    if(clean(o.explanation).length > 300) return 'ব্যাখ্যা ৩০০ অক্ষরের বেশি হবে না।';
    if(clean(o.source).length > 200) return 'সূত্র ২০০ অক্ষরের বেশি হবে না।';
    return '';
  }
  function normalize(o){
    return { topic: o.topic, band: o.band || 'any', difficulty: Number(o.difficulty == null ? 2 : o.difficulty), question: clean(o.question), options: (o.options || []).map(clean), answer_idx: Number(o.answer_idx), explanation: clean(o.explanation), source: clean(o.source) };
  }
  /* the correct answer and three wrong ones, mixed, so the correct one is not always first; rng() gives a number in [0, 1) */
  function shuffleOptions(correct, wrongs, rng){
    rng = rng || Math.random;
    var all = [{ t: clean(correct), c: true }].concat((wrongs || []).map(function(w){ return { t: clean(w), c: false }; }));
    for(var i = all.length - 1; i > 0; i--){ var j = Math.floor(rng() * (i + 1)), x = all[i]; all[i] = all[j]; all[j] = x; }
    return { options: all.map(function(x){ return x.t; }), answer_idx: all.findIndex(function(x){ return x.c; }) };
  }
  /* the import text (a JSON list): { topic, band?, difficulty?, q | question, correct + wrong[3]  OR  options[4] + answer_idx, explanation?, source? }  ->  { items: [normalized], errors: ["#3: ..."] } */
  function parseImport(text, rng){
    var out = { items: [], errors: [] }, data;
    try{ data = JSON.parse(String(text || '').replace(/^﻿/, '')); }catch(e){ out.errors.push('লেখাটা JSON নয় (' + e.message + ')। [ { ... }, { ... } ] আকারে দিন।'); return out; }
    if(data && !Array.isArray(data) && Array.isArray(data.questions)) data = data.questions;
    if(!Array.isArray(data)){ out.errors.push('একটা তালিকা ( [ ... ] ) দিতে হবে।'); return out; }
    if(!data.length){ out.errors.push('তালিকা ফাঁকা।'); return out; }
    if(data.length > 500){ out.errors.push('একবারে সর্বোচ্চ ৫০০টা প্রশ্ন।'); return out; }
    var seen = {};
    data.forEach(function(r, i){
      var n = '#' + bnDigits(i + 1) + ': ';
      if(!r || typeof r !== 'object'){ out.errors.push(n + 'প্রশ্নটা পড়া যায়নি।'); return; }
      var o = { topic: r.topic, band: r.band, difficulty: r.difficulty, question: r.question != null ? r.question : r.q, explanation: r.explanation, source: r.source };
      if(r.correct != null || Array.isArray(r.wrong)){
        if(!Array.isArray(r.wrong) || r.wrong.length !== 3){ out.errors.push(n + 'ঠিক তিনটা ভুল উত্তর (wrong) লাগবে।'); return; }
        var m = shuffleOptions(r.correct, r.wrong, rng); o.options = m.options; o.answer_idx = m.answer_idx;
      } else { o.options = r.options; o.answer_idx = r.answer_idx; }
      var bad = validateQuestion(o); if(bad){ out.errors.push(n + bad); return; }
      var norm = normalize(o), key = norm.question; if(seen[key]){ out.errors.push(n + 'একই প্রশ্ন এই তালিকাতেই আগে আছে।'); return; } seen[key] = 1;
      out.items.push(norm);
    });
    return out;
  }
  /* the review of one question for the admin's screen: how many reviewers said what on the CURRENT version */
  function tally(checks, rev){
    var t = { ok: [], wrong: [], unsure: [] };
    (checks || []).forEach(function(c){ if(c.rev === rev && t[c.verdict]) t[c.verdict].push(c); });
    return t;
  }

  var api = { TOPICS: TOPICS, BANDS: BANDS, DIFFS: DIFFS, STATUS: STATUS, VERDICT: VERDICT, NEED_OK: NEED_OK, keysOf: keysOf, labelOf: labelOf, clean: clean, bn: bnDigits,
    validateQuestion: validateQuestion, normalize: normalize, shuffleOptions: shuffleOptions, parseImport: parseImport, tally: tally };
  root.QuizData = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
