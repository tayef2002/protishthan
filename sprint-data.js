/* অঙ্ক স্প্রিন্ট: the questions and the points of the game, pure (no page, no network), checked by tools/tests/test_sprint_page.js.
   A sprint is 60 seconds of mental arithmetic. The Nth question of a sprint depends only on (level, seed, N), so a "daily sprint" (the seed is the Bangladesh day) is the same for everybody and
   a free sprint (a random seed) is new every time. Every answer is a whole number; the four options are the answer and three wrong ones that look like real mistakes (off by one, off by ten, the
   neighbouring table, digits swapped). No fractions, no decimals, nothing that needs paper. */
(function(root){
  'use strict';
  var SECONDS = 60;
  var LEVELS = [['c3', 'শ্রেণি ৩-৫', 'যোগ, বিয়োগ, নামতা, ভাগ'], ['c6', 'শ্রেণি ৬-৮', 'বর্গ, শতকরা, মিশ্র হিসাব, ভাগ'], ['c9', 'শ্রেণি ৯-১০', 'বর্গমূল, ঘন, সমীকরণ, শতকরা']];
  function hash(s){ var h = 2166136261; s = String(s); for(var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed){ var a = hash(seed); return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function bn(x){ return String(x).replace(/[0-9]/g, function(d){ return '০১২৩৪৫৬৭৮৯'[d]; }).replace(/-/g, '−'); }
  function dayKey(ms){ var d = new Date((ms == null ? Date.now() : ms) + 6 * 3600e3); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  function pick(r, lo, hi){ return lo + Math.floor(r() * (hi - lo + 1)); }
  function shuffle(arr, r){ var a = arr.slice(); for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* the kinds of question: each gives { kind, text, answer, args } and the "mistakes" that a hurried person makes */
  var KINDS = {
    add:    function(r){ var a = pick(r, 12, 89), b = pick(r, 12, 89); return { text: bn(a) + ' + ' + bn(b), answer: a + b, args: [a, b], near: [10, -10, 1, -1, 100] }; },
    sub:    function(r){ var a = pick(r, 31, 99), b = pick(r, 11, a - 6); return { text: bn(a) + ' − ' + bn(b), answer: a - b, args: [a, b], near: [10, -10, 1, -1, 2] }; },
    times:  function(r){ var a = pick(r, 3, 12), b = pick(r, 3, 12); return { text: bn(a) + ' × ' + bn(b), answer: a * b, args: [a, b], near: [a, -a, b, -b, 1, -1] }; },
    div:    function(r){ var b = pick(r, 3, 12), q = pick(r, 3, 12); return { text: bn(b * q) + ' ÷ ' + bn(b), answer: q, args: [b * q, b], near: [1, -1, 2, -2, b] }; },
    square: function(r){ var a = pick(r, 11, 25); return { text: bn(a) + '²', answer: a * a, args: [a], near: [a, -a, 10, -10, 2 * a] }; },
    percent:function(r){ var p = [10, 20, 25, 50, 75][pick(r, 0, 4)], base = p === 25 || p === 75 ? pick(r, 2, 25) * 4 : pick(r, 2, 20) * 10; return { text: bn(base) + '-এর ' + bn(p) + '%', answer: base * p / 100, args: [base, p], near: [10, -10, 5, -5, 1, -1] }; },
    mixed:  function(r){ var a = pick(r, 3, 12), b = pick(r, 3, 12), plus = r() < .5, c = plus ? pick(r, 2, 30) : pick(r, 2, Math.min(30, a * b - 1)); return { text: bn(a) + ' × ' + bn(b) + (plus ? ' + ' : ' − ') + bn(c), answer: a * b + (plus ? c : -c), args: [a, b, c, plus ? 1 : -1], near: [c, -c, 2 * c, 10, -10, 1, -1] }; },
    mul2:   function(r){ var a = pick(r, 12, 29), b = pick(r, 3, 9); return { text: bn(a) + ' × ' + bn(b), answer: a * b, args: [a, b], near: [10, -10, a, -a, 1, -1] }; },
    gcd:    function(r){ var g = pick(r, 2, 9), x = pick(r, 2, 6), y = pick(r, 2, 6); while(y === x || (function(p, q){ while(q){ var t = q; q = p % q; p = t; } return p; })(x, y) !== 1) y = pick(r, 2, 9); return { text: 'গসাগু (' + bn(g * x) + ', ' + bn(g * y) + ')', answer: g, args: [g * x, g * y], near: [1, -1, 2, -2, g] }; },
    neg:    function(r){ var a = -pick(r, 3, 25), b = pick(r, 5, 40); return { text: bn(a) + ' + ' + bn(b), answer: a + b, args: [a, b], near: [2 * Math.abs(a), -2 * Math.abs(a), 10, -10, 1, -1] }; },
    sqrt:   function(r){ var a = pick(r, 6, 25); return { text: '√' + bn(a * a), answer: a, args: [a * a], near: [1, -1, 2, -2, 10, -10] }; },
    cube:   function(r){ var a = pick(r, 2, 9); return { text: bn(a) + '³', answer: a * a * a, args: [a], near: [a, -a, a * a, -a * a, 10, -10] }; },
    linear: function(r){ var x = pick(r, 2, 15), a = pick(r, 2, 9), b = pick(r, 1, 20); return { text: bn(a) + 'x + ' + bn(b) + ' = ' + bn(a * x + b) + ', x = ?', answer: x, args: [a, b, a * x + b], near: [1, -1, 2, -2, 3, -3] }; },
    percent2:function(r){ var base = pick(r, 1, 15) * 20, p = [10, 20, 25, 50][pick(r, 0, 3)]; return { text: bn(base) + ' টাকা ' + bn(p) + '% বাড়লে হয়', answer: base + base * p / 100, args: [base, p], near: [base * p / 100, -(base * p / 100), 10, -10, 5, -5] }; },
    diffsq: function(r){ var a = pick(r, 12, 40), b = pick(r, 2, 9); return { text: bn(a + b) + '² − ' + bn(a) + '²', answer: (a + b) * (a + b) - a * a, args: [a + b, a], near: [10, -10, 2 * a, -2 * a, b * b, -b * b] }; },
    sq2:    function(r){ var a = pick(r, 3, 15), b = pick(r, 3, 15); return { text: bn(a) + '² + ' + bn(b) + '²', answer: a * a + b * b, args: [a, b], near: [2 * a * b, -2 * a * b, 10, -10, 2, -2] }; }
  };
  var MIX = {
    c3: ['add', 'add', 'sub', 'sub', 'times', 'times', 'times', 'div', 'div'],
    c6: ['square', 'percent', 'mixed', 'mixed', 'mul2', 'div', 'gcd', 'neg', 'times', 'percent'],
    c9: ['sqrt', 'cube', 'linear', 'linear', 'percent2', 'diffsq', 'sq2', 'square', 'sqrt', 'mixed']
  };
  function levelKeys(){ return LEVELS.map(function(l){ return l[0]; }); }

  // the Nth question of a sprint: depends on nothing but (level, seed, n)
  function question(level, seed, n){
    var mix = MIX[level]; if(!mix) throw new Error('level');
    var r = rng('sprint|' + level + '|' + seed + '|' + n), kind = mix[Math.floor(r() * mix.length)], q = KINDS[kind](r);
    var cand = shuffle(q.near, r), opts = [q.answer], k = 0;
    while(opts.length < 4 && k < cand.length){ var v = q.answer + cand[k++]; if(opts.indexOf(v) < 0 && (q.answer < 0 || v >= 0)) opts.push(v); }
    var d = 1; while(opts.length < 4){ var w = q.answer + d * (d % 2 ? 1 : -1) * Math.ceil(d / 2) * 3; if(opts.indexOf(w) < 0 && (q.answer < 0 || w >= 0)) opts.push(w); d++; }
    return { n: n, kind: kind, text: q.text, answer: q.answer, args: q.args, options: shuffle(opts, r) };
  }
  // 10 points a right answer; every full 5 in a row adds 5 to the next right answers, up to +15; a wrong answer scores nothing and breaks the row (nothing is taken away)
  function points(streakBefore){ return 10 + Math.min(15, Math.floor(streakBefore / 5) * 5); }
  function verdict(right){ return right >= 30 ? 'অবিশ্বাস্য! আপনার মাথা ক্যালকুলেটরের চেয়েও দ্রুত 🚀' : right >= 20 ? 'দারুণ গতি! 🔥' : right >= 12 ? 'খুব ভালো। আরেকবার খেলে নিজেকে হারান' : right >= 6 ? 'ভালো শুরু। আরেকবারে আরও বেশি পারবেন' : 'অনুশীলন করলেই বাড়বে, আরেকবার চেষ্টা করুন'; }
  var api = { SECONDS: SECONDS, LEVELS: LEVELS, KINDS: KINDS, MIX: MIX, levelKeys: levelKeys, hash: hash, rng: rng, bn: bn, dayKey: dayKey, question: question, points: points, verdict: verdict };
  root.SprintData = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
