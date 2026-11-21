// Math questions made by a program, so that the answer is right BY CONSTRUCTION: every template computes the answer in one way
// and a second, different way (alt) must give the same number, or the question is thrown away.
//   node tools/quiz/gen-math.js            writes tools/quiz/seed-math-001.json and prints the counts
// Import it in the admin quiz tab (the same JSON import as seed-001.json).
const fs = require('fs'), path = require('path');
const bn = x => String(x).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]).replace(/-/g, '−');
let seed = 20261121;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = a => a[Math.floor(rnd() * a.length)];
const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a), lcm = (a, b) => a / gcd(a, b) * b;
const fmt = v => Number.isInteger(v) ? bn(v) : bn(String(+v.toFixed(2)));
const SRC = 'গণিতের হিসাব; প্রোগ্রামে দুই আলাদা পদ্ধতিতে মিলিয়ে নেওয়া';

// four distinct options: the right one and the likely slips (near misses are the usual mistakes of students)
function opts(c, slips, step, positive) {
  const w = [];
  const add = v => { if (typeof v === 'number') { if (!isFinite(v) || (positive && v <= 0)) return; v = +v.toFixed(2); if (Number.isInteger(c) && !Number.isInteger(v)) return; } if (v !== c && !w.includes(v)) w.push(v); };
  slips.forEach(add);
  for (const d of [1, -1, 2, -2, 3, -3, 5, -5, 10, -10]) { if (w.length >= 3) break; if (typeof c === 'number') add(c + d * step); }
  return w.slice(0, 3);
}
const out = [];
function q(band, difficulty, topic, text, c, slips, expl, o) {
  o = o || {};
  const w = typeof c === 'number' ? opts(c, slips, o.step || 1, o.positive !== false) : slips.filter(x => x !== c).slice(0, 3);
  if (w.length < 3) return false;
  const f = o.text || fmt;
  out.push({ topic, band, difficulty, q: text, correct: typeof c === 'number' ? f(c) : c, wrong: w.map(x => typeof x === 'number' ? f(x) : x), explanation: expl, source: SRC });
  return true;
}
const same = (a, b, what) => { if (Math.abs(a - b) > 1e-9) throw new Error('MISMATCH ' + what + ': ' + a + ' vs ' + b); return a; };

const T = { 'c1-5': [], 'c6-8': [], 'c9-10': [], 'c11-12': [] };

/* ---------- শ্রেণি ১-৫ ---------- */
T['c1-5'].push(
  () => { const a = ri(120, 899), b = ri(110, 799), s = same(a + b, [...String(a)].reverse().join('') * 1 + b - ([...String(a)].reverse().join('') * 1 - a), 'add'); return q('c1-5', 1, 'math', `${bn(a)} + ${bn(b)} = কত?`, s, [s + 10, s - 10, s + 100, s - 100], `${bn(a)} + ${bn(b)} = ${bn(s)}।`); },
  () => { const a = ri(500, 999), b = ri(120, 499), s = same(a - b, -(b - a), 'sub'); return q('c1-5', 1, 'math', `${bn(a)} − ${bn(b)} = কত?`, s, [s + 10, s - 10, s + 100, s - 100], `${bn(a)} − ${bn(b)} = ${bn(s)}।`); },
  () => { const a = ri(6, 19), b = ri(6, 14), s = same(a * b, Array.from({ length: b }, () => a).reduce((x, y) => x + y, 0), 'mul'); return q('c1-5', 1, 'math', `${bn(a)} × ${bn(b)} = কত?`, s, [s + a, s - a, s + b, s - b, s + 10], `${bn(a)} × ${bn(b)} = ${bn(s)}।`); },
  () => { const b = ri(3, 12), k = ri(4, 15), a = b * k, s = same(a / b, (() => { let n = 0, r = a; while (r >= b) { r -= b; n++; } return n; })(), 'div'); return q('c1-5', 1, 'math', `${bn(a)} ÷ ${bn(b)} = কত?`, s, [s + 1, s - 1, s + b, s * 2], `${bn(b)} × ${bn(s)} = ${bn(a)}, তাই ${bn(a)} ÷ ${bn(b)} = ${bn(s)}।`); },
  () => { const a = ri(8, 40), s = same(a * 4, a + a + a + a, 'perim'); return q('c1-5', 2, 'math', `একটা বর্গক্ষেত্রের এক বাহু ${bn(a)} সেমি। এর পরিসীমা কত সেমি?`, s, [a * 2, a * a, a * 3, a + 4], `বর্গের চার বাহু সমান, পরিসীমা = ৪ × ${bn(a)} = ${bn(s)} সেমি।`); },
  () => { const l = ri(6, 25), w = ri(3, l - 1), s = same(l * w, Array.from({ length: w }, () => l).reduce((x, y) => x + y, 0), 'area'); return q('c1-5', 2, 'math', `একটা আয়তক্ষেত্রের দৈর্ঘ্য ${bn(l)} মিটার ও প্রস্থ ${bn(w)} মিটার। ক্ষেত্রফল কত বর্গমিটার?`, s, [2 * (l + w), l + w, s + l, s - w], `ক্ষেত্রফল = দৈর্ঘ্য × প্রস্থ = ${bn(l)} × ${bn(w)} = ${bn(s)} বর্গমিটার।`); },
  () => { const h = ri(2, 9), s = same(h * 60, Array.from({ length: h }, () => 60).reduce((x, y) => x + y, 0), 'time'); return q('c1-5', 1, 'math', `${bn(h)} ঘণ্টায় কত মিনিট?`, s, [h * 100, h * 24, h * 30, h * 12], `১ ঘণ্টা = ৬০ মিনিট, তাই ${bn(h)} × ৬০ = ${bn(s)} মিনিট।`); },
  () => { const p = ri(2, 9) * 5, n = ri(3, 12), pay = Math.ceil(p * n / 50) * 50 + (rnd() < .5 ? 0 : 50), s = same(pay - p * n, -(p * n - pay), 'change'); if (s <= 0) return false; return q('c1-5', 2, 'math', `একটা খাতার দাম ${bn(p)} টাকা। ${bn(n)}টা খাতা কিনে ${bn(pay)} টাকা দিলে ফেরত পাবেন কত টাকা?`, s, [p * n, s + 10, s + p, pay - p], `${bn(n)}টা খাতার দাম = ${bn(p)} × ${bn(n)} = ${bn(p * n)} টাকা। ফেরত = ${bn(pay)} − ${bn(p * n)} = ${bn(s)} টাকা।`); },
  () => { const a = ri(2, 9) * 2, n = a * ri(3, 9), s = same(n / 2, n * 5 / 10, 'half'); return q('c1-5', 1, 'math', `${bn(n)}-এর অর্ধেক কত?`, s, [n * 2, n / 4, s + 1, s - 2], `অর্ধেক মানে ২ দিয়ে ভাগ: ${bn(n)} ÷ ২ = ${bn(s)}।`); },
  () => { const a = ri(2, 9), b = ri(2, 9), n = ri(2, 5), s = same(a + b * n, a + Array.from({ length: n }, () => b).reduce((x, y) => x + y, 0), 'prec'); return q('c1-5', 2, 'math', `${bn(a)} + ${bn(b)} × ${bn(n)} = কত?`, s, [(a + b) * n, s + b, s - a, a * b + n], `আগে গুণ: ${bn(b)} × ${bn(n)} = ${bn(b * n)}, তারপর যোগ: ${bn(a)} + ${bn(b * n)} = ${bn(s)}।`); },
  () => { const d = pick([2, 3, 4, 5, 10]), k = ri(2, 12), n = d * k, s = same(n / d, n * (1 / d), 'frac'); const fr = { 2: 'অর্ধেক', 3: 'এক-তৃতীয়াংশ', 4: 'এক-চতুর্থাংশ', 5: 'এক-পঞ্চমাংশ', 10: 'এক-দশমাংশ' }[d]; return q('c1-5', 2, 'math', `${bn(n)}-এর ${fr} কত?`, s, [s + 1, s * 2, n - s, s - 1], `${bn(n)} ÷ ${bn(d)} = ${bn(s)}।`); },
  () => { const kg = ri(2, 9), s = same(kg * 1000, Array.from({ length: kg }, () => 1000).reduce((x, y) => x + y, 0), 'kg'); return q('c1-5', 1, 'math', `${bn(kg)} কেজিতে কত গ্রাম?`, s, [kg * 100, kg * 10, kg * 500, kg * 10000], `১ কেজি = ১০০০ গ্রাম, তাই ${bn(kg)} × ১০০০ = ${bn(s)} গ্রাম।`); },
  () => { const a = pick([4, 6, 8, 9, 10, 12]), b = pick([6, 8, 9, 10, 12, 15]), s = same(lcm(a, b), (() => { for (let m = Math.max(a, b); ; m++) if (m % a === 0 && m % b === 0) return m; })(), 'lcm'); if (a === b) return false; return q('c1-5', 3, 'math', `${bn(a)} আর ${bn(b)}-এর ল.সা.গু. কত?`, s, [a * b, s + a, s - b, gcd(a, b)], `${bn(a)} ও ${bn(b)} দুটোরই গুণিতক হয় এমন ক্ষুদ্রতম সংখ্যা ${bn(s)}।`, { positive: true }); },
  () => { const n = ri(1000, 9999), pv = ri(0, 3), dg = String(n)[pv], place = ['হাজার', 'শত', 'দশ', 'একক'][pv], s = same(Number(dg) * [1000, 100, 10, 1][pv], Number(dg) * Math.pow(10, 3 - pv), 'place'); return q('c1-5', 2, 'math', `${bn(n)} সংখ্যাটির ${place}-এর ঘরের অঙ্কটির স্থানীয় মান কত?`, s, [Number(dg), Number(dg) * 10, Number(dg) * 100, Number(dg) * 1000], `${place}-এর ঘরে আছে ${bn(dg)}, তার স্থানীয় মান ${bn(s)}।`); }
);

/* ---------- শ্রেণি ৬-৮ ---------- */
T['c6-8'].push(
  () => { const p = pick([5, 10, 12, 15, 20, 25, 30, 40]), n = pick([40, 60, 80, 120, 150, 200, 240, 300, 400]), s = same(n * p / 100, n / 100 * p, 'pct'); return q('c6-8', 1, 'math', `${bn(n)}-এর ${bn(p)}% কত?`, s, [n / p, n * p / 10, s + 10, s * 2], `${bn(n)} × ${bn(p)} ÷ ১০০ = ${fmt(s)}।`); },
  () => { const a = ri(2, 15), s = same(a * a, Array.from({ length: a }, () => a).reduce((x, y) => x + y, 0), 'sq'); return q('c6-8', 1, 'math', `${bn(a)}-এর বর্গ কত?`, s, [a * 2, a * (a + 1), s + a, s - a], `${bn(a)}² = ${bn(a)} × ${bn(a)} = ${bn(s)}।`); },
  () => { const r = ri(4, 30), s = same(Math.sqrt(r * r), r, 'sqrt'); return q('c6-8', 1, 'math', `√${bn(r * r)} = কত?`, s, [r * 2, r + 1, r - 1, r * r / 4], `${bn(r)} × ${bn(r)} = ${bn(r * r)}, তাই বর্গমূল ${bn(r)}।`); },
  () => { const x = ri(3, 30), a = ri(2, 20), b = x + a, s = same(b - a, x, 'eq1'); return q('c6-8', 1, 'math', `x + ${bn(a)} = ${bn(b)} হলে x = কত?`, s, [b + a, a - b, s + 1, s - 1], `x = ${bn(b)} − ${bn(a)} = ${bn(s)}।`); },
  () => { const x = ri(2, 15), a = ri(2, 9), b = ri(1, 20), c = a * x + b, s = same((c - b) / a, x, 'eq2'); return q('c6-8', 2, 'math', `${bn(a)}x + ${bn(b)} = ${bn(c)} হলে x = কত?`, s, [(c + b) / a, c - b, s + 1, s - 1], `${bn(a)}x = ${bn(c)} − ${bn(b)} = ${bn(c - b)}, তাই x = ${bn(c - b)} ÷ ${bn(a)} = ${bn(s)}।`); },
  () => { const n = ri(4, 7), v = Array.from({ length: n }, () => ri(10, 90)), sum = v.reduce((x, y) => x + y, 0); if (sum % n) { v[0] += n - (sum % n); } const t = v.reduce((x, y) => x + y, 0), s = same(t / n, v.map(x => x / n).reduce((x, y) => x + y, 0), 'avg'); return q('c6-8', 2, 'math', `${v.map(bn).join(', ')} — এই সংখ্যাগুলোর গড় কত?`, s, [t, s + 2, s - 2, Math.max(...v)], `যোগফল = ${bn(t)}, সংখ্যা ${bn(n)}টা, গড় = ${bn(t)} ÷ ${bn(n)} = ${bn(s)}।`); },
  () => { const a = ri(1, 4) * 2, b = pick([3, 4, 5, 6]), c = pick([7, 8, 9]), s = same(a * 100 / (a + b) * (a + b) / 100 * (b / a), b, 'ratio'); const tot = (a + b) * ri(3, 9), x = tot / (a + b) * a; return q('c6-8', 2, 'math', `দুইজনের টাকার অনুপাত ${bn(a)} : ${bn(b)}। মোট ${bn(tot)} টাকা হলে প্রথমজনের অংশ কত টাকা?`, x, [tot / (a + b) * b, tot / a, tot - a, x + a], `মোট ভাগ = ${bn(a)} + ${bn(b)} = ${bn(a + b)}। এক ভাগ = ${bn(tot)} ÷ ${bn(a + b)} = ${bn(tot / (a + b))}। প্রথমজন = ${bn(tot / (a + b))} × ${bn(a)} = ${bn(x)} টাকা।`) && s > 0; },
  () => { const P = ri(2, 20) * 1000, r = pick([4, 5, 6, 8, 10]), t = ri(2, 5), s = same(P * r * t / 100, P / 100 * r * t, 'si'); return q('c6-8', 2, 'math', `${bn(P)} টাকার ${bn(r)}% সরল হারে ${bn(t)} বছরের মুনাফা কত টাকা?`, s, [P * r / 100, P * r * t / 10, s + P / 100, s * 2], `মুনাফা = (${bn(P)} × ${bn(r)} × ${bn(t)}) ÷ ১০০ = ${bn(s)} টাকা।`); },
  () => { const a = ri(30, 80), b = ri(30, 80 - 0), s = same(180 - a - b, 180 - (a + b), 'tri'); if (s <= 10) return false; return q('c6-8', 1, 'math', `একটা ত্রিভুজের দুইটা কোণ ${bn(a)}° ও ${bn(b)}°। তৃতীয় কোণটি কত ডিগ্রি?`, s, [90 - a, 360 - a - b, a + b, s + 10], `ত্রিভুজের তিন কোণের সমষ্টি ১৮০°। তৃতীয় কোণ = ১৮০ − (${bn(a)} + ${bn(b)}) = ${bn(s)}°।`); },
  () => { const r = pick([7, 14, 21, 28]), s = same(22 * r * r / 7, Math.PI * r * r > 0 ? (22 / 7) * r * r : 0, 'circ'); return q('c6-8', 2, 'math', `একটা বৃত্তের ব্যাসার্ধ ${bn(r)} সেমি। ক্ষেত্রফল কত বর্গসেমি? (π = ২২/৭)`, s, [2 * 22 * r / 7, 22 * r / 7, s / 2, s + r], `ক্ষেত্রফল = π r² = (২২/৭) × ${bn(r)} × ${bn(r)} = ${bn(s)} বর্গসেমি।`); },
  () => { const cp = ri(4, 30) * 50, pr = pick([10, 20, 25]), sp = cp * (100 + pr) / 100, s = same(sp - cp, cp * pr / 100, 'profit'); if (!Number.isInteger(sp)) return false; return q('c6-8', 2, 'math', `${bn(cp)} টাকায় কেনা জিনিস ${bn(pr)}% লাভে বিক্রি করলে বিক্রয়মূল্য কত টাকা?`, sp, [cp - s, s, cp + pr, sp + 50], `লাভ = ${bn(cp)} × ${bn(pr)} ÷ ১০০ = ${bn(s)} টাকা। বিক্রয়মূল্য = ${bn(cp)} + ${bn(s)} = ${bn(sp)} টাকা।`); },
  () => { const a = pick([12, 18, 24, 30, 36, 42, 48, 60]), b = pick([16, 20, 24, 28, 30, 36, 40, 54]), s = same(gcd(a, b), (() => { let g = 1; for (let i = 1; i <= Math.min(a, b); i++) if (a % i === 0 && b % i === 0) g = i; return g; })(), 'hcf'); if (a === b || s === 1) return false; return q('c6-8', 2, 'math', `${bn(a)} ও ${bn(b)}-এর গ.সা.গু. কত?`, s, [lcm(a, b), s * 2, a - b > 0 ? a - b : b - a, Math.min(a, b)], `দুটো সংখ্যাকেই নিঃশেষে ভাগ করে এমন বৃহত্তম সংখ্যা ${bn(s)}।`); },
  () => { const a = ri(2, 6), n = ri(2, 5), s = same(Math.pow(a, n), Array.from({ length: n }, () => a).reduce((x, y) => x * y, 1), 'pow'); return q('c6-8', 1, 'math', `${bn(a)}${'⁰¹²³⁴⁵⁶⁷⁸⁹'[n]} = কত?`, s, [a * n, Math.pow(a, n - 1), Math.pow(a, n + 1), s + a], `${bn(a)} কে ${bn(n)} বার গুণ করলে ${bn(s)}।`); },
  () => { const d = ri(3, 12), t = ri(2, 6), s = same(d * t, d * t, 'speed'); const v = pick([20, 30, 40, 45, 50, 60, 80]); return q('c6-8', 1, 'math', `একটা গাড়ি ঘণ্টায় ${bn(v)} কিমি বেগে ${bn(t)} ঘণ্টা চললে কত কিমি যায়?`, v * t, [v + t, v * t * 2, v / t, v * t + v], `দূরত্ব = বেগ × সময় = ${bn(v)} × ${bn(t)} = ${bn(v * t)} কিমি।`) && s > 0; }
);

/* ---------- শ্রেণি ৯-১০ ---------- */
T['c9-10'].push(
  () => { const a = ri(2, 12), b = ri(1, 9), s = same((a + b) * (a + b), a * a + 2 * a * b + b * b, 'id1'); return q('c9-10', 1, 'math', `a = ${bn(a)}, b = ${bn(b)} হলে (a + b)² এর মান কত?`, s, [a * a + b * b, a * a + b * b + a * b, (a + b) * 2, s + a * b], `(a + b)² = (${bn(a)} + ${bn(b)})² = ${bn(a + b)}² = ${bn(s)}।`); },
  () => { const a = ri(5, 20), b = ri(1, a - 1), s = same((a + b) * (a - b), a * a - b * b, 'id2'); return q('c9-10', 1, 'math', `${bn(a)}² − ${bn(b)}² এর মান কত?`, s, [(a - b) * (a - b), a * a + b * b, a * 2 - b * 2, s + 2 * a * b], `a² − b² = (a + b)(a − b) = ${bn(a + b)} × ${bn(a - b)} = ${bn(s)}।`); },
  () => { const r1 = ri(1, 9), r2 = ri(1, 9) * (rnd() < .5 ? 1 : -1), B = -(r1 + r2), C = r1 * r2, ok = same(r1 + r2, -B, 'vieta'); const sgn = (v) => v < 0 ? `− ${bn(-v)}` : `+ ${bn(v)}`; const eq = `x² ${B === 0 ? '' : sgn(B) + 'x '}${C === 0 ? '' : sgn(C)} = ০`.replace(/\s+/g, ' ').trim(); return q('c9-10', 2, 'math', `${eq} সমীকরণের মূল দুটির যোগফল কত?`, r1 + r2, [-(r1 + r2), r1 * r2, r1 - r2, B], `x² + bx + c = ০ এর মূলদ্বয়ের যোগফল −b। এখানে −(${bn(B)}) = ${bn(r1 + r2)}।`, { positive: false }) && ok === r1 + r2; },
  () => { const a1 = ri(1, 9), d = ri(2, 7), n = ri(8, 25), t = same(a1 + (n - 1) * d, (() => { let v = a1; for (let i = 1; i < n; i++) v += d; return v; })(), 'ap'); return q('c9-10', 2, 'math', `${bn(a1)}, ${bn(a1 + d)}, ${bn(a1 + 2 * d)}, … ধারার ${bn(n)}তম পদ কত?`, t, [a1 + n * d, a1 + (n - 2) * d, n * d, t + d], `সাধারণ অন্তর = ${bn(d)}। n-তম পদ = a + (n−১)d = ${bn(a1)} + ${bn(n - 1)} × ${bn(d)} = ${bn(t)}।`); },
  () => { const a1 = ri(1, 6), d = ri(1, 5), n = ri(8, 20), t = same(n * (2 * a1 + (n - 1) * d) / 2, (() => { let s = 0, v = a1; for (let i = 0; i < n; i++) { s += v; v += d; } return s; })(), 'aps'); return q('c9-10', 3, 'math', `${bn(a1)}, ${bn(a1 + d)}, ${bn(a1 + 2 * d)}, … ধারার প্রথম ${bn(n)}টি পদের যোগফল কত?`, t, [t + n, t - n, n * (a1 + (n - 1) * d), t * 2], `যোগফল = n/২ × {২a + (n−১)d} = ${bn(n)}/২ × {${bn(2 * a1)} + ${bn((n - 1) * d)}} = ${bn(t)}।`); },
  () => { const [a, b, c] = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]]), k = ri(1, 3), s = same(Math.sqrt((a * k) ** 2 + (b * k) ** 2), c * k, 'pyth'); return q('c9-10', 1, 'math', `একটা সমকোণী ত্রিভুজের দুই বাহু ${bn(a * k)} ও ${bn(b * k)} সেমি। অতিভুজ কত সেমি?`, c * k, [a * k + b * k, c * k + 1, c * k - 1, Math.abs(b - a) * k], `অতিভুজ² = ${bn(a * k)}² + ${bn(b * k)}² = ${bn((a * k) ** 2 + (b * k) ** 2)}, তাই অতিভুজ = ${bn(c * k)} সেমি।`) && s > 0; },
  () => { const r = pick([7, 14, 21]), h = ri(2, 12), s = same(22 * r * r * h / 7, (22 / 7) * r * r * h, 'cyl'); return q('c9-10', 2, 'math', `একটা সিলিন্ডারের ব্যাসার্ধ ${bn(r)} সেমি ও উচ্চতা ${bn(h)} সেমি। আয়তন কত ঘনসেমি? (π = ২২/৭)`, s, [2 * 22 * r * h / 7, 22 * r * r / 7, s / 3, s + 22], `আয়তন = π r² h = (২২/৭) × ${bn(r)}² × ${bn(h)} = ${bn(s)} ঘনসেমি।`); },
  () => { const A = ri(20, 60), B = ri(15, 50), both = ri(3, Math.min(A, B) - 3), s = same(A + B - both, A + B - both, 'set'); return q('c9-10', 2, 'math', `n(A) = ${bn(A)}, n(B) = ${bn(B)}, n(A ∩ B) = ${bn(both)} হলে n(A ∪ B) কত?`, s, [A + B, A + B + both, A - both + B + both, s - both], `n(A ∪ B) = n(A) + n(B) − n(A ∩ B) = ${bn(A)} + ${bn(B)} − ${bn(both)} = ${bn(s)}।`); },
  () => { const P = ri(2, 10) * 1000, r = pick([5, 10]), s = same(P * (1 + r / 100) ** 2, P * (1 + r / 100) * (1 + r / 100), 'ci'); if (!Number.isInteger(+s.toFixed(6))) return false; return q('c9-10', 3, 'math', `${bn(P)} টাকা বার্ষিক ${bn(r)}% চক্রবৃদ্ধি হারে ২ বছরের জন্য রাখলে মোট কত টাকা হবে?`, Math.round(s), [P * (1 + 2 * r / 100), P * (1 + r / 100), Math.round(s) + P * r / 100, Math.round(s) - 50], `চক্রবৃদ্ধি = ${bn(P)} × (১ + ${bn(r)}/১০০)² = ${bn(Math.round(s))} টাকা।`); },
  () => { const k = pick([[30, 'sin', '১/২'], [60, 'cos', '১/২'], [45, 'tan', '১'], [30, 'cos', '√৩/২'], [60, 'sin', '√৩/২'], [30, 'tan', '১/√৩'], [60, 'tan', '√৩'], [0, 'cos', '১'], [90, 'sin', '১']]), pool = ['১/২', '√৩/২', '১', '১/√৩', '√৩', '০', '১/√২']; const w = pool.filter(x => x !== k[2]).sort(() => rnd() - .5).slice(0, 3); return q('c9-10', 2, 'math', `${k[1]} ${bn(k[0])}° এর মান কত?`, k[2], w, `ত্রিকোণমিতির নির্দিষ্ট কোণের মান: ${k[1]} ${bn(k[0])}° = ${k[2]}।`); },
  () => { const a = ri(2, 5), n = ri(3, 6), m = ri(2, 5), s = same(Math.pow(a, n) * Math.pow(a, m), Math.pow(a, n + m), 'idx'); return q('c9-10', 2, 'math', `${bn(a)}${'⁰¹²³⁴⁵⁶⁷⁸⁹'[n]} × ${bn(a)}${'⁰¹²³⁴⁵⁶⁷⁸⁹'[m]} = ${bn(a)} এর কত ঘাত?`, n + m, [n * m, n - m + 1, n + m + 1, n + m - 1], `একই ভিত্তির গুণে ঘাত যোগ হয়: ${bn(n)} + ${bn(m)} = ${bn(n + m)}।`); },
  () => { const x1 = ri(0, 6), y1 = ri(0, 6), dx = pick([3, 6, 5, 8]), dy = { 3: 4, 6: 8, 5: 12, 8: 15 }[dx], s = same(Math.hypot(dx, dy), Math.sqrt(dx * dx + dy * dy), 'dist'); return q('c9-10', 2, 'math', `(${bn(x1)}, ${bn(y1)}) ও (${bn(x1 + dx)}, ${bn(y1 + dy)}) বিন্দু দুটির দূরত্ব কত একক?`, s, [dx + dy, s + 1, s - 1, Math.abs(dy - dx)], `দূরত্ব = √(${bn(dx)}² + ${bn(dy)}²) = √${bn(dx * dx + dy * dy)} = ${bn(s)}।`); }
);

/* ---------- একাদশ-দ্বাদশ ---------- */
T['c11-12'].push(
  () => { const a = ri(1, 6), n = ri(2, 5), x = ri(1, 4), s = same(a * n * Math.pow(x, n - 1), (a * Math.pow(x + 1e-6, n) - a * Math.pow(x, n)) / 1e-6 > 0 ? Math.round((a * Math.pow(x + 1e-6, n) - a * Math.pow(x, n)) / 1e-6 * 1) : 0, 'der'); void s; const d = a * n * Math.pow(x, n - 1), approx = (a * Math.pow(x + 1e-5, n) - a * Math.pow(x - 1e-5, n)) / 2e-5; if (Math.abs(approx - d) > 1e-3 * d) return false; return q('c11-12', 2, 'math', `f(x) = ${bn(a)}x${'⁰¹²³⁴⁵⁶⁷⁸⁹'[n]} হলে x = ${bn(x)} বিন্দুতে f′(x) এর মান কত?`, d, [a * Math.pow(x, n), a * n * Math.pow(x, n), a * (n - 1) * Math.pow(x, n - 1), d + a], `f′(x) = ${bn(a * n)}x${'⁰¹²³⁴⁵⁶⁷⁸⁹'[n - 1]}। x = ${bn(x)} বসালে ${bn(d)}।`); },
  () => { const a = ri(1, 4), n = ri(1, 3), u = ri(1, 3), val = a * (Math.pow(u, n + 1)) / (n + 1); if (!Number.isInteger(val)) return false; let num = 0, N = 20000; for (let i = 0; i < N; i++) num += a * Math.pow((i + .5) * u / N, n) * u / N; if (Math.abs(num - val) > 1e-3) return false; return q('c11-12', 3, 'math', `∫₀${bn(u)} ${bn(a)}x${'⁰¹²³⁴⁵⁶⁷⁸⁹'[n]} dx এর মান কত?`, val, [a * Math.pow(u, n), a * Math.pow(u, n + 1), val + a, val * 2], `∫ ${bn(a)}x${'⁰¹²³⁴⁵⁶⁷⁸⁹'[n]} dx = ${bn(a)}x${'⁰¹²³⁴⁵⁶⁷⁸⁹'[n + 1]}/${bn(n + 1)}। ০ থেকে ${bn(u)} সীমায় = ${bn(val)}।`); },
  () => { const n = ri(5, 10), r = ri(2, 4), f = k => { let v = 1; for (let i = 2; i <= k; i++) v *= i; return v; }, c = same(f(n) / (f(r) * f(n - r)), (() => { let t = 1; for (let i = 1; i <= r; i++) t = t * (n - r + i) / i; return Math.round(t); })(), 'ncr'); return q('c11-12', 2, 'math', `${bn(n)}C${bn(r)} এর মান কত?`, c, [f(n) / f(n - r), c + n, c - n, c * 2], `nCr = n!/{r!(n−r)!} = ${bn(c)}।`); },
  () => { const a = ri(1, 6), b = ri(1, 6), c = ri(1, 6), d = ri(1, 6), det = same(a * d - b * c, -(b * c - a * d), 'det'); return q('c11-12', 2, 'math', `|${bn(a)} ${bn(b)}; ${bn(c)} ${bn(d)}| (২×২ নির্ণায়ক, প্রথম সারি ${bn(a)}, ${bn(b)} ও দ্বিতীয় সারি ${bn(c)}, ${bn(d)}) এর মান কত?`, det, [a * d + b * c, b * c - a * d, a * c - b * d, det + a], `নির্ণায়ক = ad − bc = ${bn(a)} × ${bn(d)} − ${bn(b)} × ${bn(c)} = ${bn(det)}।`, { positive: false }); },
  () => { const n = ri(5, 90), r = n % 4, v = ['১', 'i', '−১', '−i'][r], pool = ['১', 'i', '−১', '−i']; same(r, n % 4, 'ipow'); return q('c11-12', 3, 'math', `i${bn(n)} এর মান কত? (i = √−১)`, v, pool.filter(x => x !== v), `i-এর ঘাত চার চার করে ঘোরে: i⁴ = ১। ${bn(n)} ÷ ৪ এর ভাগশেষ ${bn(r)}, তাই i${bn(n)} = ${v}।`); },
  () => { const b = pick([2, 3, 5, 10]), n = ri(2, 5), v = same(Math.round(Math.log(Math.pow(b, n)) / Math.log(b)), n, 'log'); return q('c11-12', 1, 'math', `log${bn(b)} ${bn(Math.pow(b, n))} = কত?`, n, [Math.pow(b, n) / b, n + 1, n - 1, b * n], `${bn(b)}${'⁰¹²³⁴⁵⁶⁷⁸⁹'[n]} = ${bn(Math.pow(b, n))}, তাই log${bn(b)} ${bn(Math.pow(b, n))} = ${bn(v)}।`); },
  () => { const a = ri(1, 4), b = ri(-8, 8), c = ri(-6, 6), D = same(b * b - 4 * a * c, b * b - 4 * (a * c), 'disc'); const t = `${a === 1 ? '' : bn(a)}x² ${b < 0 ? '− ' + bn(-b) : '+ ' + bn(b)}x ${c < 0 ? '− ' + bn(-c) : '+ ' + bn(c)} = ০`; return q('c11-12', 2, 'math', `${t} সমীকরণের নিরূপক (ডিসক্রিমিন্যান্ট) এর মান কত?`, D, [b * b + 4 * a * c, b * b - 2 * a * c, D + 4, -D], `নিরূপক = b² − ৪ac = ${bn(b * b)} − ${bn(4 * a * c)} = ${bn(D)}।`, { positive: false }); },
  () => { const x1 = ri(-3, 3), y1 = ri(-3, 3), m = ri(1, 4), dx = ri(1, 4), x2 = x1 + dx, y2 = y1 + m * dx, s = same((y2 - y1) / (x2 - x1), m, 'slope'); return q('c11-12', 1, 'math', `(${bn(x1)}, ${bn(y1)}) ও (${bn(x2)}, ${bn(y2)}) বিন্দুগামী সরলরেখার ঢাল কত?`, m, [-m, m + 1, (x2 - x1) / (y2 - y1) > 0 ? Math.round(1 / m * 100) / 100 : m + 2, m - 1], `ঢাল = (y₂ − y₁)/(x₂ − x₁) = ${bn(y2 - y1)}/${bn(dx)} = ${bn(s)}।`, { positive: false }); },
  () => { const a = ri(1, 6), n = ri(2, 4), s = same(a * Math.pow(2, n), a * Array.from({ length: n }, () => 2).reduce((x, y) => x * y, 1), 'gp'); return q('c11-12', 2, 'math', `একটা গুণোত্তর ধারার প্রথম পদ ${bn(a)} ও সাধারণ অনুপাত ২ হলে ${bn(n + 1)}তম পদ কত?`, s, [a * 2 * n, a * (n + 1) * 2, s * 2, s - a], `n-তম পদ = ar^(n−১)। ${bn(n + 1)}তম পদ = ${bn(a)} × ২^${bn(n)} = ${bn(s)}।`); }
);

const COUNT = { 'c1-5': 220, 'c6-8': 220, 'c9-10': 200, 'c11-12': 140 };
const seen = new Set(); const result = [];
for (const band of Object.keys(T)) {
  let made = 0, tries = 0, perT = T[band].length, i = 0;
  while (made < COUNT[band] && tries < 60000) {
    tries++;
    const before = out.length;
    let ok = false;
    try { ok = T[band][i++ % perT](); } catch (e) { if (/MISMATCH/.test(e.message)) throw e; ok = false; }
    if (!ok) { out.length = before; continue; }
    const last = out[out.length - 1];
    const key = last.q;
    if (seen.has(key) || out.length === before) { out.length = before; continue; }
    seen.add(key); made++;
  }
  console.log(band, 'made', made, 'of', COUNT[band], 'in', tries, 'tries');
}
// the final guard: four different options, the right one is not among the wrong ones, lengths fit the database
for (const x of out) {
  const all = [x.correct, ...x.wrong];
  if (new Set(all).size !== 4 || x.wrong.length !== 3) throw new Error('options: ' + x.q);
  if (x.q.length > 300 || x.explanation.length > 300 || all.some(o => o.length > 100)) throw new Error('length: ' + x.q);
  if (/NaN|undefined|Infinity/.test(JSON.stringify(x))) throw new Error('bad text: ' + x.q);
}
fs.writeFileSync(path.join(__dirname, 'seed-math-001.json'), JSON.stringify(out, null, 1));
const by = {}; out.forEach(x => { const k = x.band + ' d' + x.difficulty; by[k] = (by[k] || 0) + 1; }); console.log(out.length, 'questions', by);
