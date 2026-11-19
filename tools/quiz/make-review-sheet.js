// Makes the review sheet of the first 66 draft questions (tools/quiz/seed-001.json): one table for the people who check them, with my own doubts written next to each question.
//   node tools/quiz/make-review-sheet.js      -> tools/quiz/review-sheet-001.html (open it in a browser, print it) and review-sheet-001.csv (opens in Excel / Google Sheets)
// The grades are MINE, from what I know, NOT a verification: a person must still check every question against its source. ✅ = a stable textbook fact; 🟡 = the answer is right as far as I know, but the wording, the date or the source deserves a look.
const fs = require('fs'), path = require('path');
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-001.json'), 'utf8')), Q = seed.questions || seed;
const TOPIC = { gk: 'সাধারণ জ্ঞান', history: 'ইতিহাস ও মুক্তিযুদ্ধ', geo: 'ভূগোল ও জেলা', science: 'বিজ্ঞান', ict: 'তথ্য ও যোগাযোগ প্রযুক্তি', math: 'গণিত', puzzle: 'ধাঁধা ও যুক্তি', bangla: 'বাংলা', english: 'ইংরেজি', sports: 'খেলাধুলা', school: 'স্কুলজীবন' };
const BAND = { any: 'সব শ্রেণি', 'c1-5': 'শ্রেণি ১-৫', 'c6-8': 'শ্রেণি ৬-৮', 'c9-10': 'শ্রেণি ৯-১০', 'c11-12': 'একাদশ-দ্বাদশ' };
// 🟡 notes, by question number (1-based, the order of the seed file); everything else is ✅
const NOTE = {
  8: 'উত্তর ঠিক। সংবিধানের অনুচ্ছেদ ৪-এ আছে গানের "প্রথম দশ চরণ" জাতীয় সংগীত। সংবিধান থেকে ভাষাটা মিলিয়ে নিন।',
  10: 'উত্তর ২০২২ ঠিক। ২৫ জুন উদ্বোধন, ২৬ জুন থেকে যান চলাচল শুরু। প্রশ্নে "খুলে দেওয়া" আছে, ব্যাখ্যায় "উদ্বোধন": চাইলে ব্যাখ্যায় দুই তারিখই লিখুন।',
  13: 'দিনটা ২১ ফেব্রুয়ারি ঠিক। ইউনেসকোর ঘোষণা ১৯৯৯ সালের নভেম্বরে, প্রথম পালন ২০০০ সালে। ইউনেসকোর ওয়েবসাইটে মিলিয়ে নিন।',
  15: 'উত্তর ১৯৫২ ঠিক। "চূড়ান্ত আত্মত্যাগ" কথাটা একটু সাহিত্যিক। সহজ করে লেখা যায়: "ভাষা শহীদদের আত্মত্যাগের ঘটনা কত সালে ঘটে?"।',
  16: '"প্রায় ৯ মাস" ঠিক (২৬ মার্চ থেকে ১৬ ডিসেম্বর), ন\'মাসের যুদ্ধ নামেই পরিচিত। পাঠ্যবই থেকে মিলিয়ে নিন।',
  21: 'সুন্দরবনকে সাধারণত "বিশ্বের বৃহত্তম ম্যানগ্রোভ বন" বলা হয়, কিন্তু কোনো কোনো সূত্র লেখে "বৃহত্তম অবিচ্ছিন্ন ম্যানগ্রোভ বন"। ইউনেসকোর পাতায় ভাষাটা দেখে প্রশ্নের শব্দ ঠিক করুন।',
  32: 'পাঠ্যবইয়ে নিরপেক্ষ দ্রবণের pH ৭ (২৫° সেলসিয়াস তাপমাত্রায়)। শ্রেণি ৯-১০-এর জন্য ঠিক, অন্য তাপমাত্রায় মান একটু বদলায়: পাঠ্যবই মিলিয়ে দেখুন।',
  52: 'বাংলা একাডেমি ও পাঠ্যবইয়ে স্বরবর্ণ ১১টি। কোনো কোনো পুরনো ব্যাকরণ বইয়ে বেশি ধরা হতো। পাঠ্যবই বা বাংলা একাডেমির বই মিলিয়ে নিন।',
  62: 'উত্তর ১১ ঠিক, কিন্তু প্রশ্নের ভাষা অস্বাভাবিক। ভালো হয়: "ক্রিকেটে একটা দল মাঠে কতজন খেলোয়াড় নিয়ে নামে?"।',
  63: 'উত্তর ঠিক। ব্যাখ্যার "এখন সব আন্তর্জাতিক ম্যাচে" ঠিক, কারণ অতীতে অস্ট্রেলিয়ায় ৮ বলের ওভার ছিল। চাইলে "এখন" শব্দটা রাখুন।',
  65: 'উত্তর ২০০০ ঠিক। জুন ২০০০-এ আইসিসির পূর্ণ সদস্য (টেস্ট মর্যাদা), প্রথম টেস্ট নভেম্বর ২০০০-এ ভারতের বিপক্ষে। আইসিসি বা বিসিবি সূত্রে মিলিয়ে নিন।',
  66: 'তথ্য ঠিক, কিন্তু প্রশ্নটা খুব সহজ আর খেলার মতো মজার নয়। "স্কুলজীবন" বিষয়ে এটাই একমাত্র প্রশ্ন। রাখা যায়, নতুন স্কুলজীবনের প্রশ্ন লিখলে বাদ দেওয়াই ভালো।'
};
const HOW = (q, i) => {
  const s = q.source || '';
  if (q.topic === 'math' || q.topic === 'puzzle') return 'নিজে কষে দেখুন (আমি এই অঙ্কগুলো আলাদা করে কষে মিলিয়ে দেখেছি, সব ঠিক, তবু আপনিও কষুন)।';
  if (/সংবিধান/.test(s)) return 'bdlaws.minlaw.gov.bd-এ সংবিধান খুলে অনুচ্ছেদটা পড়ুন।';
  if (/বাংলাপিডিয়া/.test(s)) return 'bn.banglapedia.org-এ "জাতীয় প্রতীক" বা সংশ্লিষ্ট নিবন্ধ।';
  if (/ইউনেসকো/.test(s)) return 'whc.unesco.org বা unesco.org।';
  if (/ICC|বিসিবি|FIFA/.test(s)) return 'icc-cricket.com, tigercricket.com.bd বা fifa.com।';
  if (/পাঠ্যবই/.test(s)) return 'এনসিটিবির (nctb.gov.bd) সংশ্লিষ্ট শ্রেণির বই।';
  if (/English|dictionary/i.test(s)) return 'NCTB-র English for Today বা Oxford/Cambridge ডিকশনারি।';
  if (/সেতু বিভাগ|বাংলাদেশ ব্যাংক|স্থানীয় সরকার|বিবিএস/.test(s)) return 'সংশ্লিষ্ট সরকারি ওয়েবসাইট (bb.org.bd, bbs.gov.bd, lgd.gov.bd, bridgesdivision.gov.bd)।';
  return 'সূত্র কলামে যা লেখা আছে।';
};
const QUICK = [1, 2, 3, 9, 11, 12, 17, 18, 24, 26, 28, 34, 35, 38, 41, 50, 53, 57, 58, 64];     // 20 sure ones, ten topics: for a first private test
const rows = Q.map((q, i) => {
  const n = i + 1, opts = [q.correct].concat(q.wrong || []);
  return { n, topic: TOPIC[q.topic] || q.topic, band: BAND[q.band] || q.band, diff: ['', 'সহজ', 'মাঝারি', 'কঠিন'][q.difficulty] || '', q: q.q, correct: q.correct, wrong: q.wrong || [], exp: q.explanation || '', src: q.source || '', grade: NOTE[n] ? '🟡' : '✅', note: NOTE[n] || 'পাঠ্যবই বা সরকারি সূত্রের স্থির তথ্য। উত্তর ঠিক বলেই জানি, তবু সূত্রে মিলিয়ে নিন।', how: HOW(q, i), quick: QUICK.includes(n), opts };
});
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const bn = x => String(x).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const yellow = rows.filter(r => r.grade === '🟡').length, byTopic = {}; rows.forEach(r => { byTopic[r.topic] = (byTopic[r.topic] || 0) + 1; });
const html = `<!DOCTYPE html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>প্রশ্ন যাচাইয়ের তালিকা ০০১ (৬৬টি খসড়া)</title>
<style>
body{font-family:'Hind Siliguri','Nirmala UI','Noto Sans Bengali',sans-serif;margin:0;background:#F4F6FB;color:#0F172A;line-height:1.6}
main{max-width:1100px;margin:0 auto;padding:20px 14px 60px}h1{font-size:26px;margin:8px 0 4px;color:#0B1B4D}p{margin:6px 0}
.box{background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:14px 18px;margin:12px 0}.warn{background:#FEF3C7;border-color:#FCD34D}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.tabs button{border:1.5px solid #CBD5E1;background:#fff;border-radius:100px;padding:5px 14px;font:inherit;font-weight:700;cursor:pointer}.tabs button.on{background:#1A56DB;color:#fff;border-color:#1A56DB}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden}th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid #EEF2F7;font-size:14px}th{background:#F1F5F9;font-size:12.5px;color:#475569}
td.n{font-weight:900;white-space:nowrap}.ok{background:#DCFCE7;color:#166534}.chk{background:#FEF3C7;color:#92400E}.pill{display:inline-block;border-radius:100px;padding:1px 10px;font-weight:800;font-size:12.5px}
.opts{margin:4px 0 0;padding-left:0;list-style:none}.opts li{margin:1px 0}.right{color:#047857;font-weight:800}.sm{font-size:12.5px;color:#64748B}tr.hide{display:none}.q{font-weight:700}
@media print{.tabs,.box.warn{display:none}body{background:#fff}tr{break-inside:avoid}}
</style></head><body><main>
<h1>প্রশ্ন যাচাইয়ের তালিকা ০০১</h1>
<p>৬৬টি খসড়া প্রশ্ন, প্রতিটার পাশে আমার সন্দেহ আর কোথায় মেলাতে হবে লেখা আছে। যাচাইকারীর কাজ সহজ করার জন্য এই তালিকা। আসল যাচাই কিন্তু অ্যাডমিন/ড্যাশবোর্ডের "প্রশ্ন যাচাই" পাতায় হবে।</p>
<div class="box warn"><b>সৎ কথা:</b> ✅ আর 🟡 চিহ্ন আমার নিজের ধারণা, <b>যাচাই নয়</b>। ৬৬টা প্রশ্ন আমি লিখেছি, তাই আমার ভুল মানুষ ধরবে, এটাই নিয়ম। ✅ মানে "স্থির, পাঠ্যবইয়ের তথ্য, আমি ঠিক বলেই জানি"; 🟡 মানে "উত্তর ঠিক বলেই জানি, কিন্তু ভাষা, তারিখ বা সূত্র একবার দেখে নেওয়া ভালো"। কোনো প্রশ্নকে আমি স্পষ্ট ভুল বলে সন্দেহ করিনি।</div>
<div class="box"><b>সারাংশ:</b> মোট ${bn(rows.length)}টি: ✅ ${bn(rows.length - yellow)}টি, 🟡 ${bn(yellow)}টি। বিষয় অনুযায়ী: ${Object.entries(byTopic).map(([k, v]) => esc(k) + ' ' + bn(v)).join(' · ')}।
<p>🧪 <b>প্রথম ব্যক্তিগত পরীক্ষার জন্য ২০টা নিশ্চিত প্রশ্ন</b> (সব ✅, ১০টা বিষয়ে ছড়ানো, যাতে আজকের কুইজ আর ব্যাচ চ্যালেঞ্জ চালিয়ে দেখা যায়): নম্বর ${QUICK.map(bn).join(', ')}। "শুধু ২০টা" বোতাম চাপলে এগুলোই দেখাবে।</p></div>
<div class="tabs" id="tabs"><button data-f="all" class="on">সব ${bn(rows.length)}টি</button><button data-f="quick">🧪 শুধু ২০টা</button><button data-f="chk">🟡 মিলিয়ে নিন (${bn(yellow)})</button><button data-f="ok">✅ নিশ্চিত (${bn(rows.length - yellow)})</button></div>
<table><thead><tr><th>#</th><th>বিষয়, শ্রেণি</th><th>প্রশ্ন ও বিকল্প (সবুজটা সঠিক)</th><th>ব্যাখ্যা ও সূত্র (খসড়ার)</th><th>আমার চিহ্ন ও নোট</th><th>কোথায় মেলাবেন</th></tr></thead><tbody>
${rows.map(r => `<tr data-g="${r.grade === '🟡' ? 'chk' : 'ok'}" data-q="${r.quick ? 1 : 0}"><td class="n">${bn(r.n)}${r.quick ? ' 🧪' : ''}</td><td>${esc(r.topic)}<div class="sm">${esc(r.band)} · ${esc(r.diff)}</div></td><td><div class="q">${esc(r.q)}</div><ul class="opts"><li class="right">✔ ${esc(r.correct)}</li>${r.wrong.map(w => `<li>✘ ${esc(w)}</li>`).join('')}</ul></td><td>${esc(r.exp)}<div class="sm">সূত্র: ${esc(r.src)}</div></td><td><span class="pill ${r.grade === '🟡' ? 'chk' : 'ok'}">${r.grade === '🟡' ? '🟡 দেখে নিন' : '✅ নিশ্চিত'}</span><div>${esc(r.note)}</div></td><td class="sm">${esc(r.how)}</td></tr>`).join('\n')}
</tbody></table>
<script>document.getElementById('tabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));const f=b.dataset.f;document.querySelectorAll('tbody tr').forEach(tr=>{tr.classList.toggle('hide',!(f==='all'||(f==='quick'&&tr.dataset.q==='1')||(f==='chk'&&tr.dataset.g==='chk')||(f==='ok'&&tr.dataset.g==='ok')))});};</script>
</main></body></html>`;
fs.writeFileSync(path.join(__dirname, 'review-sheet-001.html'), html);
const csv = '﻿' + [['নম্বর', 'বিষয়', 'শ্রেণি', 'কঠিনতা', 'প্রশ্ন', 'সঠিক উত্তর', 'ভুল বিকল্প ১', 'ভুল বিকল্প ২', 'ভুল বিকল্প ৩', 'ব্যাখ্যা', 'সূত্র', 'আমার চিহ্ন', 'আমার নোট', 'কোথায় মেলাবেন', 'প্রথম ২০টার একটি?', 'যাচাইকারীর মন্তব্য']].concat(rows.map(r => [r.n, r.topic, r.band, r.diff, r.q, r.correct, r.wrong[0] || '', r.wrong[1] || '', r.wrong[2] || '', r.exp, r.src, r.grade, r.note, r.how, r.quick ? 'হ্যাঁ' : '', ''])).map(a => a.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
fs.writeFileSync(path.join(__dirname, 'review-sheet-001.csv'), csv);
console.log('rows', rows.length, 'yellow', yellow, 'quick', rows.filter(r => r.quick).length, 'quick all green', rows.filter(r => r.quick).every(r => r.grade === '✅'), 'topics in quick', new Set(rows.filter(r => r.quick).map(r => r.topic)).size);
