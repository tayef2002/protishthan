// An INDEPENDENT check of seed-math-001.json: it does not use the generator. It reads each question's TEXT, works the answer out again
// and compares it with the marked answer. Questions whose shape it does not know are counted as "not re-checked" (they rely on the generator's own two-way check).
//   node tools/quiz/verify-math.js [file]
const fs = require('fs'), path = require('path');
const file = process.argv[2] || path.join(__dirname, 'seed-math-001.json');
const list = JSON.parse(fs.readFileSync(file, 'utf8'));
const en = s => String(s).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)).replace(/−/g, '-');
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const fact = n => n <= 1 ? 1 : n * fact(n - 1);
const sup = s => s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, c => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c));
let ok = 0, bad = [], skip = 0;
for (const x of list) {
  const t = en(x.q), c = en(x.correct).replace(/\s/g, ''); let m, want = null;
  const S = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  if ((m = t.match(/^(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]) × (\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]) = .*ঘাত/))) want = S.indexOf(m[2]) + S.indexOf(m[4]);
  else if ((m = t.match(/^(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]) = কত/))) want = Math.pow(+m[1], S.indexOf(m[2]));
  else if ((m = t.match(/^(\d+) \+ (\d+) × (\d+) = /))) want = +m[1] + m[2] * m[3];
  else if ((m = t.match(/^(\d+) ([+\-×÷]) (\d+) = /))) { const a = +m[1], b = +m[3]; want = m[2] === '+' ? a + b : m[2] === '-' ? a - b : m[2] === '×' ? a * b : a / b; }
  else if ((m = t.match(/^(\d+)-এর অর্ধেক/))) want = m[1] / 2;
  else if ((m = t.match(/^(\d+)-এর (এক-\S+) কত/))) want = m[1] / ({ 'এক-তৃতীয়াংশ': 3, 'এক-চতুর্থাংশ': 4, 'এক-পঞ্চমাংশ': 5, 'এক-দশমাংশ': 10 }[m[2]]);
  else if ((m = t.match(/^(\d+)-এর (\d+)% কত/))) want = m[1] * m[2] / 100;
  else if ((m = t.match(/^(\d+) ঘণ্টায় কত মিনিট/))) want = m[1] * 60;
  else if ((m = t.match(/^(\d+) কেজিতে কত গ্রাম/))) want = m[1] * 1000;
  else if ((m = t.match(/^(\d+)-এর বর্গ কত/))) want = m[1] * m[1];
  else if ((m = t.match(/^√(\d+) = /))) want = Math.round(Math.sqrt(+m[1]));
  else if ((m = t.match(/^(\d+) আর (\d+)-এর ল\.সা\.গু\./))) want = m[1] * m[2] / gcd(+m[1], +m[2]);
  else if ((m = t.match(/^(\d+) ও (\d+)-এর গ\.সা\.গু\./))) want = gcd(+m[1], +m[2]);
  else if ((m = t.match(/^(\d+)(\d) = কত/)) && false) want = null;
  else if ((m = t.match(/^x \+ (\d+) = (\d+) হলে/))) want = m[2] - m[1];
  else if ((m = t.match(/^(\d+)x \+ (\d+) = (\d+) হলে/))) want = (m[3] - m[2]) / m[1];
  else if ((m = t.match(/^(\d+) সেমি।? ?$/)) && false) want = null;
  else if ((m = t.match(/^([\d, ]+) — এই সংখ্যাগুলোর গড়/))) { const v = m[1].split(',').map(Number); want = v.reduce((a, b) => a + b, 0) / v.length; }
  else if ((m = t.match(/^(\d+) টাকার (\d+)% সরল হারে (\d+) বছরের মুনাফা/))) want = m[1] * m[2] * m[3] / 100;
  else if ((m = t.match(/^(\d+) টাকায় কেনা জিনিস (\d+)% লাভে/))) want = m[1] * (100 + +m[2]) / 100;
  else if ((m = t.match(/একটা ত্রিভুজের দুইটা কোণ (\d+)° ও (\d+)°/))) want = 180 - m[1] - m[2];
  else if ((m = t.match(/বর্গক্ষেত্রের এক বাহু (\d+) সেমি। এর পরিসীমা/))) want = 4 * m[1];
  else if ((m = t.match(/দৈর্ঘ্য (\d+) মিটার ও প্রস্থ (\d+) মিটার/))) want = m[1] * m[2];
  else if ((m = t.match(/ঘণ্টায় (\d+) কিমি বেগে (\d+) ঘণ্টা/))) want = m[1] * m[2];
  else if ((m = t.match(/ব্যাসার্ধ (\d+) সেমি। ক্ষেত্রফল/))) want = 22 * m[1] * m[1] / 7;
  else if ((m = t.match(/ব্যাসার্ধ (\d+) সেমি ও উচ্চতা (\d+) সেমি। আয়তন/))) want = 22 * m[1] * m[1] * m[2] / 7;
  else if ((m = t.match(/^a = (\d+), b = (\d+) হলে \(a \+ b\)² এর মান/))) want = (+m[1] + +m[2]) ** 2;
  else if ((m = t.match(/^(\d+)² − (\d+)² এর মান/))) want = m[1] * m[1] - m[2] * m[2];
  else if ((m = t.match(/n\(A\) = (\d+), n\(B\) = (\d+), n\(A ∩ B\) = (\d+)/))) want = +m[1] + +m[2] - m[3];
  else if ((m = t.match(/^(\d+)C(\d+) এর মান/))) want = fact(+m[1]) / (fact(+m[2]) * fact(m[1] - m[2]));
  else if ((m = t.match(/^log(\d+) (\d+) = /))) want = Math.round(Math.log(+m[2]) / Math.log(+m[1]));
  else if ((m = t.match(/^i(\d+) এর মান/))) want = ['1', 'i', '-1', '-i'][m[1] % 4];
  else if ((m = t.match(/^(\d+) ধারার (\d+)তম পদ/))) want = null;
  else if ((m = t.match(/^(\d+), (\d+), (\d+), … ধারার (\d+)তম পদ/))) want = +m[1] + (m[4] - 1) * (m[2] - m[1]);
  else if ((m = t.match(/^(\d+), (\d+), (\d+), … ধারার প্রথম (\d+)টি পদের যোগফল/))) { const d = m[2] - m[1], n = +m[4]; want = n * (2 * m[1] + (n - 1) * d) / 2; }
  else if ((m = t.match(/^(\d+)\^?(\d) × (\d+)(\d) = /))) want = null;
  else if ((m = t.match(/\(([-\d]+), ([-\d]+)\) ও \(([-\d]+), ([-\d]+)\) বিন্দুগামী সরলরেখার ঢাল/))) want = (m[4] - m[2]) / (m[3] - m[1]);
  else if ((m = t.match(/\(([-\d]+), ([-\d]+)\) ও \(([-\d]+), ([-\d]+)\) বিন্দু দুটির দূরত্ব/))) want = Math.hypot(m[3] - m[1], m[4] - m[2]);
  else if ((m = t.match(/সমকোণী ত্রিভুজের দুই বাহু (\d+) ও (\d+) সেমি/))) want = Math.hypot(+m[1], +m[2]);
  else if ((m = t.match(/^(\d*)x² ([+-]) (\d+)x ([+-]) (\d+) = ০? ?০? ?সমীকরণের নিরূপক|^(\d*)x² ([+-]) (\d+)x ([+-]) (\d+) = 0 সমীকরণের নিরূপক/))) { const a = +(m[1] || m[6] || 1), b = (m[2] || m[7]) === '-' ? -(m[3] || m[8]) : +(m[3] || m[8]), c = (m[4] || m[9]) === '-' ? -(m[5] || m[10]) : +(m[5] || m[10]); want = b * b - 4 * a * c; }
  else if ((m = t.match(/^x² (?:([+-]) (\d+)x )?(?:([+-]) (\d+))? ?= 0 সমীকরণের মূল দুটির যোগফল/))) { const b = m[1] ? (m[1] === '-' ? -m[2] : +m[2]) : 0; want = -b; }
  else if ((m = t.match(/^f\(x\) = (\d+)x([⁰¹²³⁴⁵⁶⁷⁸⁹]) হলে x = (\d+) বিন্দুতে f′/))) { const a = +m[1], n = S.indexOf(m[2]), x = +m[3]; want = a * n * Math.pow(x, n - 1); }
  else if ((m = t.match(/^∫₀([₀-₉\d]+) (\d+)x([⁰¹²³⁴⁵⁶⁷⁸⁹]) dx/))) { const u = +m[1], a = +m[2], n = S.indexOf(m[3]); want = a * Math.pow(u, n + 1) / (n + 1); }
  else if ((m = t.match(/প্রথম পদ (\d+) ও সাধারণ অনুপাত 2 হলে (\d+)তম পদ/))) want = m[1] * Math.pow(2, m[2] - 1);
  else if ((m = t.match(/(\d+) টাকা বার্ষিক (\d+)% চক্রবৃদ্ধি হারে 2 বছর/))) want = Math.round(m[1] * (1 + m[2] / 100) ** 2);
  else if ((m = t.match(/অনুপাত (\d+) : (\d+)। মোট (\d+) টাকা হলে প্রথমজনের/))) want = m[3] / (+m[1] + +m[2]) * m[1];
  else if ((m = t.match(/একটা খাতার দাম (\d+) টাকা। (\d+)টা খাতা কিনে (\d+) টাকা/))) want = m[3] - m[1] * m[2];
  else if ((m = t.match(/(\d+) সংখ্যাটির (\S+)-এর ঘরের অঙ্কটির স্থানীয় মান/))) { const i = ['হাজার', 'শত', 'দশ', 'একক'].indexOf(m[2]); want = +m[1][i] * [1000, 100, 10, 1][i]; }
  else if ((m = t.match(/^\|(\d+) (\d+); (\d+) (\d+)\|/))) want = m[1] * m[4] - m[2] * m[3];
  else if ((m = t.match(/^(sin|cos|tan) (\d+)° এর মান/))) { const v = { 'sin30': '১/২', 'cos60': '১/২', 'tan45': '১', 'cos30': '√৩/২', 'sin60': '√৩/২', 'tan30': '১/√৩', 'tan60': '√৩', 'cos0': '১', 'sin90': '১' }[m[1] + m[2]]; want = v ? en(v) : null; if (want !== null && want === c) { ok++; continue; } }
  else if ((m = t.match(/ভিত্তি|f\(x\)|∫|সমীকরণ|ঘাত|sin|cos|tan|অনুপাত|চক্রবৃদ্ধি|ধারার|নির্ণায়ক|খাতার|সংখ্যাটির|গুণোত্তর/))) want = null;
  if (want === null || want === undefined) { skip++; continue; }
  if (String(want) === c || Math.abs(Number(want) - Number(c)) < 1e-9) ok++; else bad.push(x.q + '  marked ' + x.correct + '  re-worked ' + want);
}
console.log('questions', list.length, '| re-worked and the same:', ok, '| differ:', bad.length, '| shape not re-checked here:', skip);
bad.slice(0, 20).forEach(b => console.log(' ✘', b));
process.exit(bad.length ? 1 : 0);
