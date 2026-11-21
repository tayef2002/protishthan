// Physics and chemistry QUESTIONS WITH NUMBERS, made by a program: the answer is computed from the formula that is printed in the explanation, and a second, different computation must agree
// (a loop, a table, or the inverse formula). The values used (g, c of water, atomic masses) are written INSIDE each question so that the answer does not depend on a book edition.
//   node tools/quiz/gen-science.js   ->  tools/quiz/seed-science-001.json
const fs = require('fs'), path = require('path');
const bn = x => String(x).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]).replace(/-/g, '−');
let seed = 9090;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = a => a[Math.floor(rnd() * a.length)];
const num = v => Number.isInteger(v) ? bn(v) : bn(String(+v.toFixed(2)));
const same = (a, b, what) => { if (Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a))) throw new Error('MISMATCH ' + what + ': ' + a + ' vs ' + b); return a; };
const out = [];
function q(band, diff, text, c, slips, expl, src, o) {
  o = o || {}; c = +(+c).toFixed(6);
  const w = []; const add = v => { v = +(+v).toFixed(2); if (!isFinite(v) || v <= 0 && !o.signed || v === c || w.includes(v)) return; if (Number.isInteger(c) && !Number.isInteger(v)) return; w.push(v); };
  slips.forEach(add); for (const d of [1, -1, 2, -2, 5, -5, 10, -10, 20]) { if (w.length >= 3) break; add(c + d * (o.step || 1)); }
  if (w.length < 3) return false;
  out.push({ topic: 'science', band, difficulty: diff, q: text, correct: num(c), wrong: w.slice(0, 3).map(num), explanation: expl, source: src || 'পদার্থবিজ্ঞান/রসায়নের সূত্র; প্রোগ্রামে দুইভাবে হিসাব করে মেলানো' });
  return true;
}
const PH = 'পদার্থবিজ্ঞানের সূত্র (গতি, বল, শক্তি, বিদ্যুৎ); প্রোগ্রামে দুইভাবে হিসাব করে মেলানো';
const CH = 'রসায়নের হিসাব (মোলার ভর, মোল, pH, গ্যাস সূত্র); প্রোগ্রামে দুইভাবে হিসাব করে মেলানো';
const T = [];

/* ---------- পদার্থবিজ্ঞান ---------- */
T.push(
  () => { const u = ri(0, 10), a = ri(2, 6), t = ri(2, 9), v = same(u + a * t, (() => { let x = u; for (let i = 0; i < t; i++) x += a; return x; })(), 'v'); return q('c9-10', 1, `একটি বস্তু ${bn(u)} মি/সে বেগে চলছে। এর ত্বরণ ${bn(a)} মি/সে² হলে ${bn(t)} সেকেন্ড পরে বেগ কত মি/সে?`, v, [u + a, a * t, u * t, v + a], `v = u + at = ${bn(u)} + ${bn(a)} × ${bn(t)} = ${bn(v)} মি/সে।`, PH); },
  () => { const u = ri(0, 8), a = 2 * ri(1, 4), t = ri(2, 8), s = same(u * t + a * t * t / 2, (() => { let x = 0, v = u; for (let i = 0; i < t; i++) { x += v + a / 2; v += a; } return x; })(), 's'); return q('c9-10', 2, `একটি গাড়ি ${bn(u)} মি/সে বেগে চলা শুরু করে ${bn(a)} মি/সে² সমত্বরণে ${bn(t)} সেকেন্ড চলল। সে কত মিটার গেল?`, s, [u * t + a * t * t, u * t, a * t * t / 2, s + u], `s = ut + ½at² = ${bn(u)}×${bn(t)} + ½×${bn(a)}×${bn(t)}² = ${bn(s)} মিটার।`, PH); },
  () => { const m = ri(2, 20), a = ri(2, 9), F = same(m * a, a * m, 'F'); return q('c9-10', 1, `${bn(m)} কেজি ভরের বস্তুর ওপর কত বল (নিউটন) প্রয়োগ করলে ${bn(a)} মি/সে² ত্বরণ হবে?`, F, [m + a, m / a, F + m, F * 2], `F = ma = ${bn(m)} × ${bn(a)} = ${bn(F)} নিউটন।`, PH); },
  () => { const m = ri(1, 12) * 5, W = same(m * 9.8, m * 98 / 10, 'W'); return q('c9-10', 1, `${bn(m)} কেজি ভরের বস্তুর ওজন কত নিউটন? (g = ৯.৮ মি/সে²)`, W, [m * 10, m / 9.8, m + 9.8, W * 2], `W = mg = ${bn(m)} × ৯.৮ = ${num(W)} নিউটন।`, PH); },
  () => { const I = ri(1, 8), R = ri(2, 15), V = same(I * R, I * R, 'V'); return q('c9-10', 1, `${bn(R)} ওহম রোধের তারের ভেতর দিয়ে ${bn(I)} অ্যাম্পিয়ার তড়িৎ প্রবাহিত হলে দুই প্রান্তের বিভব পার্থক্য কত ভোল্ট?`, V, [R + I, R / I, V + R, V * 2], `ওহমের সূত্র: V = IR = ${bn(I)} × ${bn(R)} = ${bn(V)} ভোল্ট।`, PH); },
  () => { const R = ri(2, 12), I = ri(2, 9), V = R * I, r = same(V / I, R, 'R'); return q('c9-10', 2, `একটি পরিবাহীর দুই প্রান্তে ${bn(V)} ভোল্ট প্রয়োগ করায় ${bn(I)} অ্যাম্পিয়ার তড়িৎ প্রবাহিত হলো। এর রোধ কত ওহম?`, r, [V * I, V - I, I / V * 10, r + 2], `R = V/I = ${bn(V)} ÷ ${bn(I)} = ${bn(r)} ওহম।`, PH); },
  () => { const V = pick([6, 12, 24, 110, 220]), I = ri(1, 9), P = same(V * I, I * V, 'P'); return q('c11-12', 1, `${bn(V)} ভোল্টে ${bn(I)} অ্যাম্পিয়ার তড়িৎ টানলে ক্ষমতা কত ওয়াট?`, P, [V / I, V + I, P * 2, P / 2], `P = VI = ${bn(V)} × ${bn(I)} = ${bn(P)} ওয়াট।`, PH); },
  () => { const m = 2 * ri(1, 10), v = ri(2, 12), E = same(m * v * v / 2, (m / 2) * v * v, 'KE'); return q('c11-12', 2, `${bn(m)} কেজি ভরের বস্তু ${bn(v)} মি/সে বেগে চললে গতিশক্তি কত জুল?`, E, [m * v * v, m * v, m * v / 2, E + m], `গতিশক্তি = ½mv² = ½ × ${bn(m)} × ${bn(v)}² = ${bn(E)} জুল।`, PH); },
  () => { const m = ri(1, 10), h = ri(2, 30), E = same(m * 10 * h, h * 10 * m, 'PE'); return q('c9-10', 2, `${bn(m)} কেজি ভরের বস্তুকে ${bn(h)} মিটার উঁচুতে তুললে বিভবশক্তি কত জুল? (g = ১০ মি/সে²)`, E, [m * h, m * 9.8 * h, E / 2, E + h], `বিভবশক্তি = mgh = ${bn(m)} × ১০ × ${bn(h)} = ${bn(E)} জুল।`, PH); },
  () => { const d = ri(2, 20), V = ri(2, 9), m = d * V, r = same(m / V, d, 'rho'); return q('c9-10', 2, `${bn(m)} গ্রাম ভরের একটি বস্তুর আয়তন ${bn(V)} ঘন সেমি। এর ঘনত্ব কত গ্রাম/ঘন সেমি?`, r, [m * V, m - V, r + 1, V / m], `ঘনত্ব = ভর ÷ আয়তন = ${bn(m)} ÷ ${bn(V)} = ${bn(r)}।`, PH); },
  () => { const A = ri(2, 10), P = ri(3, 20), F = A * P, p = same(F / A, P, 'press'); return q('c9-10', 2, `${bn(F)} নিউটন বল ${bn(A)} বর্গমিটার ক্ষেত্রফলের ওপর সমভাবে কাজ করলে চাপ কত প্যাসকেল?`, p, [F * A, F - A, p + A, A / F], `চাপ = বল ÷ ক্ষেত্রফল = ${bn(F)} ÷ ${bn(A)} = ${bn(p)} প্যাসকেল।`, PH); },
  () => { const f = ri(2, 20) * 5, l = ri(1, 8) * 2, v = same(f * l, l * f, 'wave'); return q('c9-10', 2, `একটি তরঙ্গের কম্পাঙ্ক ${bn(f)} হার্জ ও তরঙ্গদৈর্ঘ্য ${bn(l)} মিটার। তরঙ্গের বেগ কত মি/সে?`, v, [f / l, f + l, v * 2, v / 2], `v = fλ = ${bn(f)} × ${bn(l)} = ${bn(v)} মি/সে।`, PH); },
  () => { const F = ri(2, 20), s = ri(2, 15), Wk = same(F * s, s * F, 'work'); return q('c9-10', 1, `${bn(F)} নিউটন বল প্রয়োগে বস্তুটি বলের দিকে ${bn(s)} মিটার সরলে কৃতকাজ কত জুল?`, Wk, [F + s, F / s, Wk * 2, Wk + F], `কাজ = বল × সরণ = ${bn(F)} × ${bn(s)} = ${bn(Wk)} জুল।`, PH); },
  () => { const d = ri(2, 12) * 30, t = ri(2, 6) * 5, v = same(d / t, d * (1 / t), 'speed'); if (!Number.isInteger(v)) return false; return q('c9-10', 1, `একজন ${bn(d)} মিটার পথ ${bn(t)} সেকেন্ডে গেলে তার গড় বেগ কত মি/সে?`, v, [d * t, d - t, v * 2, v + 2], `গড় বেগ = দূরত্ব ÷ সময় = ${bn(d)} ÷ ${bn(t)} = ${bn(v)} মি/সে।`, PH); },
  () => { const [a, b, r] = pick([[6, 3, 2], [12, 4, 3], [20, 5, 4], [30, 6, 5], [12, 6, 4], [10, 10, 5], [15, 10, 6], [20, 20, 10]]), s = same(a * b / (a + b), r, 'par'); return q('c11-12', 2, `${bn(a)} ওহম ও ${bn(b)} ওহমের দুটি রোধ সমান্তরালে যুক্ত করলে তুল্য রোধ কত ওহম?`, r, [a + b, a * b, r + 1, r * 2], `১/R = ১/${bn(a)} + ১/${bn(b)}, তাই R = ${bn(a)}×${bn(b)}/(${bn(a)}+${bn(b)}) = ${bn(s)} ওহম।`, PH); },
  () => { const a = ri(2, 20), b = ri(2, 20), s = same(a + b, b + a, 'ser'); return q('c9-10', 1, `${bn(a)} ওহম ও ${bn(b)} ওহমের দুটি রোধ শ্রেণিতে যুক্ত করলে তুল্য রোধ কত ওহম?`, s, [a * b, Math.abs(a - b), s * 2, s + 5], `শ্রেণিতে যুক্ত রোধ যোগ হয়: ${bn(a)} + ${bn(b)} = ${bn(s)} ওহম।`, PH); },
  () => { const C = pick([0, 10, 20, 30, 40, 50, 60, 100, 15, 25, 35]), F = same(C * 9 / 5 + 32, (C * 1.8) + 32, 'F'); if (!Number.isInteger(F)) return false; return q('c9-10', 2, `${bn(C)}° সেলসিয়াস কত ডিগ্রি ফারেনহাইট?`, F, [C + 32, C * 9 / 5, F + 10, F - 10], `F = (৯/৫) × C + ৩২ = (৯/৫) × ${bn(C)} + ৩২ = ${bn(F)}°।`, PH, { signed: false }); },
  () => { const C = ri(0, 90), K = same(C + 273, 273 + C, 'K'); return q('c11-12', 1, `${bn(C)}° সেলসিয়াস কত কেলভিন? (০° সে. = ২৭৩ কেলভিন ধরুন)`, K, [C, C + 373, 273 - C, K + 10], `T(K) = t(°C) + ২৭৩ = ${bn(C)} + ২৭৩ = ${bn(K)}।`, PH); },
  () => { const m = ri(1, 5), dT = ri(5, 40), Q = same(m * 4200 * dT, 4200 * dT * m, 'Q'); return q('c11-12', 3, `${bn(m)} কেজি পানির তাপমাত্রা ${bn(dT)}° সে. বাড়াতে কত জুল তাপ লাগবে? (পানির আপেক্ষিক তাপ ৪২০০ জুল/কেজি·°সে.)`, Q, [m * dT, 4200 * dT, Q / 2, Q + 4200], `Q = mcΔT = ${bn(m)} × ৪২০০ × ${bn(dT)} = ${bn(Q)} জুল।`, PH); },
  () => { const P = ri(1, 10) * 100, t = ri(2, 10), E = same(P * t, t * P, 'Et'); return q('c11-12', 2, `${bn(P)} ওয়াটের একটি যন্ত্র ${bn(t)} সেকেন্ড চললে কত জুল শক্তি খরচ হয়?`, E, [P / t, P + t, E * 2, E / 2], `শক্তি = ক্ষমতা × সময় = ${bn(P)} × ${bn(t)} = ${bn(E)} জুল।`, PH); },
  () => { const m = ri(2, 8) * 2, v = ri(2, 10), p = same(m * v, v * m, 'mom'); return q('c11-12', 1, `${bn(m)} কেজি ভরের বস্তু ${bn(v)} মি/সে বেগে চললে এর ভরবেগ কত কেজি·মি/সে?`, p, [m + v, m / v, p * 2, p / 2], `ভরবেগ = mv = ${bn(m)} × ${bn(v)} = ${bn(p)}।`, PH); }
);

/* ---------- রসায়ন ---------- */
const AM = { H: 1, C: 12, N: 14, O: 16, Na: 23, Mg: 24, Al: 27, S: 32, Cl: 35.5, K: 39, Ca: 40, Fe: 56, Cu: 63.5 };
const COMP = [['H₂O', 'H2O', 18], ['CO₂', 'C1O2', 44], ['NaCl', 'Na1Cl1', 58.5], ['CaCO₃', 'Ca1C1O3', 100], ['H₂SO₄', 'H2S1O4', 98], ['NaOH', 'Na1O1H1', 40], ['HCl', 'H1Cl1', 36.5], ['NH₃', 'N1H3', 17], ['CH₄', 'C1H4', 16], ['C₆H₁₂O₆', 'C6H12O6', 180], ['MgO', 'Mg1O1', 40], ['KOH', 'K1O1H1', 56], ['CaO', 'Ca1O1', 56], ['HNO₃', 'H1N1O3', 63], ['Na₂CO₃', 'Na2C1O3', 106], ['CuSO₄', 'Cu1S1O4', 159.5], ['Al₂O₃', 'Al2O3', 102], ['Fe₂O₃', 'Fe2O3', 160], ['KCl', 'K1Cl1', 74.5], ['Ca(OH)₂', 'Ca1O2H2', 74]];
const mass = f => [...f.matchAll(/([A-Z][a-z]?)(\d*)/g)].reduce((s, m) => s + AM[m[1]] * (+m[2] || 1), 0);
COMP.forEach(([, f, k]) => same(mass(f), k, 'mass of ' + f));      // the formula parsed one way, the textbook value written by hand another way
const ATOMS = 'H = ১, C = ১২, N = ১৪, O = ১৬, Na = ২৩, Mg = ২৪, Al = ২৭, S = ৩২, Cl = ৩৫.৫, K = ৩৯, Ca = ৪০, Fe = ৫৬, Cu = ৬৩.৫';
T.push(
  () => { const [n, f, k] = pick(COMP); return q('c9-10', 2, `${n}-এর আণবিক (মোলার) ভর কত? (পারমাণবিক ভর: ${ATOMS})`, k, [k + 2, k - 2, k * 2, k + 16, k - 16, Math.round(k / 2)], `${n}-এর ভর = পরমাণুর ভরের যোগফল = ${num(k)}।`, CH); },
  () => { const [n, f, k] = pick(COMP.filter(c => Number.isInteger(c[2]))), m = k * ri(2, 6), mol = same(m / k, m * (1 / k), 'mol'); return q('c11-12', 2, `${bn(m)} গ্রাম ${n} কত মোল? (মোলার ভর ${bn(k)} গ্রাম/মোল)`, mol, [mol + 1, mol - 1, mol * 2, m / (k * 2), mol + 2], `মোল = ভর ÷ মোলার ভর = ${bn(m)} ÷ ${bn(k)} = ${bn(mol)}।`, CH); },
  () => { const [n, f, k] = pick(COMP.filter(c => Number.isInteger(c[2]))), mol = ri(2, 6), m = same(mol * k, k * mol, 'mass'); return q('c11-12', 2, `${bn(mol)} মোল ${n}-এর ভর কত গ্রাম? (মোলার ভর ${bn(k)} গ্রাম/মোল)`, m, [m / mol, k + mol, m + k, m * 2], `ভর = মোল × মোলার ভর = ${bn(mol)} × ${bn(k)} = ${bn(m)} গ্রাম।`, CH); },
  () => { const n = ri(1, 13), ph = same(n, -Math.round(Math.log10(Math.pow(10, -n))), 'pH'); return q('c11-12', 2, `কোনো দ্রবণে [H⁺] = ১০⁻${bn(n)} মোল/লিটার হলে দ্রবণের pH কত?`.replace('১০⁻' + bn(n), '১০^(−' + bn(n) + ')'), ph, [14 - n, n + 1, n - 1, 14 + n], `pH = −log[H⁺] = −log(১০^(−${bn(n)})) = ${bn(ph)}।`, CH); },
  () => { const ph = ri(1, 13), poh = same(14 - ph, 14 - ph, 'pOH'); return q('c11-12', 2, `কোনো দ্রবণের pH ${bn(ph)} হলে (২৫° সে.-এ) pOH কত?`, poh, [ph, 14 + ph, ph + 1, poh + 2], `pH + pOH = ১৪, তাই pOH = ১৪ − ${bn(ph)} = ${bn(poh)}।`, CH); },
  () => { const E = [['H', 1, 1], ['He', 2, 4], ['Li', 3, 7], ['Be', 4, 9], ['B', 5, 11], ['C', 6, 12], ['N', 7, 14], ['O', 8, 16], ['F', 9, 19], ['Ne', 10, 20], ['Na', 11, 23], ['Mg', 12, 24], ['Al', 13, 27], ['Si', 14, 28], ['P', 15, 31], ['S', 16, 32], ['Cl', 17, 35], ['Ar', 18, 40], ['K', 19, 39], ['Ca', 20, 40]], [s, z, a] = pick(E), nn = same(a - z, a - z, 'n'); if (nn === 0) return false; return q('c9-10', 1, `${s} পরমাণুর পারমাণবিক সংখ্যা ${bn(z)} ও ভর সংখ্যা ${bn(a)}। এতে নিউট্রন কয়টি?`, nn, [z, a, a + z, nn + 1, nn + 2], `নিউট্রন = ভর সংখ্যা − পারমাণবিক সংখ্যা = ${bn(a)} − ${bn(z)} = ${bn(nn)}টি।`, CH); },
  () => { const z = ri(3, 20), sh = [2, 8, 8, 2]; let r = z, cfg = []; for (const c of sh) { const x = Math.min(c, r); cfg.push(x); r -= x; if (r <= 0) break; } const val = cfg[cfg.length - 1], v2 = (() => { let rem = z, last = 0; for (const c of [2, 8, 8, 2]) { if (rem <= 0) break; last = Math.min(c, rem); rem -= last; } return last; })(); same(val, v2, 'valence'); const names = ['', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca']; if (val === 0) return false; return q('c9-10', 2, `${names[z]} (পারমাণবিক সংখ্যা ${bn(z)}) পরমাণুর সর্বশেষ কক্ষপথে ইলেকট্রন কয়টি? (কক্ষপথে ২, ৮, ৮, ২ করে ভরে)`, val, [z, 8 - val, val + 1, val + 2, 8], `ইলেকট্রন বিন্যাস ${cfg.map(bn).join(', ')}; শেষ কক্ষপথে ${bn(val)}টি।`, CH); },
  () => { const P1 = ri(1, 4), V1 = ri(2, 6) * 2, P2 = P1 * ri(2, 4), V2 = same(P1 * V1 / P2, V1 * P1 / P2, 'boyle'); if (!Number.isInteger(V2)) return false; return q('c11-12', 3, `নির্দিষ্ট তাপমাত্রায় একটি গ্যাসের চাপ ${bn(P1)} atm ও আয়তন ${bn(V1)} লিটার। চাপ ${bn(P2)} atm করলে আয়তন কত লিটার?`, V2, [V1 * P2 / P1, V1 + P2, V1 - P1, V2 * 2], `বয়েলের সূত্র: P₁V₁ = P₂V₂, তাই V₂ = ${bn(P1)}×${bn(V1)} ÷ ${bn(P2)} = ${bn(V2)} লিটার।`, CH); },
  () => { const M1 = ri(2, 8), V1 = ri(1, 5) * 10, V2 = V1 * ri(2, 5), M2 = same(M1 * V1 / V2, V1 * M1 / V2, 'dil'); if (!Number.isInteger(M2 * 10)) return false; return q('c11-12', 3, `${bn(M1)} মোলার ${bn(V1)} মিলিলিটার দ্রবণে পানি মিশিয়ে মোট আয়তন ${bn(V2)} মিলিলিটার করা হলো। নতুন দ্রবণের ঘনমাত্রা কত মোলার?`, M2, [M1 * V2 / V1, M1 + V2, M1 - V1 / 10, M2 * 2], `M₁V₁ = M₂V₂, তাই M₂ = ${bn(M1)}×${bn(V1)} ÷ ${bn(V2)} = ${num(M2)}।`, CH); }
);

const COUNT = { 'c9-10': 190, 'c11-12': 190 };
const seen = new Set(); const res = []; let tries = 0, i = 0;
while (tries++ < 20000 && res.length < 380) {
  const before = out.length; let ok = false;
  try { ok = T[i++ % T.length](); } catch (e) { if (/MISMATCH/.test(e.message)) throw e; ok = false; }
  if (!ok) { out.length = before; continue; }
  const x = out[out.length - 1]; if (seen.has(x.q) || (COUNT[x.band] <= 0)) { out.length = before; continue; }
  seen.add(x.q); COUNT[x.band]--; res.push(x);
}
for (const x of res) {
  const all = [x.correct, ...x.wrong];
  if (new Set(all).size !== 4 || x.q.length > 300 || x.explanation.length > 300 || x.source.length > 200 || all.some(o => o.length > 100) || /NaN|undefined|Infinity/.test(JSON.stringify(x))) throw new Error('bad: ' + x.q);
}
fs.writeFileSync(path.join(__dirname, 'seed-science-001.json'), JSON.stringify(res, null, 1));
const by = {}; res.forEach(x => { const k = x.band + ' d' + x.difficulty; by[k] = (by[k] || 0) + 1; }); console.log(res.length, 'questions', by, 'tries', tries);
