// One-off SEO patch for the static pages (safe to run again):
//   1) private pages (logins, dashboards, tools that need an account) get <meta name="robots" content="noindex,nofollow">
//   2) public pages get a canonical address, a description, Open Graph and Twitter tags where they were missing
// Run from the repo root:  node tools/seo/patch_head.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..');
const SITE = 'https://protishthan.com';

const PRIVATE = ['admit-card', 'attendance', 'bulk-notice', 'calendar', 'chat', 'classes', 'classroom', 'custom-document', 'custom-paper',
  'dashboard', 'exam', 'fee-management', 'finance', 'guardian-dashboard', 'guardian-login', 'guardians', 'id-card', 'join', 'login',
  'partner-dashboard', 'partner-login', 'public-page', 'registration-form', 'result_card_design', 'result_card_single', 'routine',
  'settings', 'student-dashboard', 'student-login', 'student', 'students', 'syllabus', 'teacher-checkin', 'teacher-dashboard',
  'teacher-login', 'teacher-tracking', 'teachers', 'vouchers', 'website'];

// public pages: what to add when it is missing. canon = the one address search engines should keep.
const PUBLIC = {
  index: { canon: '/', ogTitle: 'Protishthan — বাংলাদেশের শিক্ষা প্রতিষ্ঠানের তথ্যভান্ডার' },
  'list-institution': {
    canon: '/list-institution',
    desc: 'আপনার স্কুল, মাদ্রাসা, কলেজ বা কোচিং সেন্টার বিনামূল্যে Protishthan তথ্যভান্ডারে যুক্ত করুন। ফর্ম পূরণ করলেই প্রতিষ্ঠানের নিজের পাতা তৈরি হয়।',
    ogTitle: 'প্রতিষ্ঠান বিনামূল্যে তালিকাভুক্ত করুন — Protishthan',
  },
  partner: { canon: '/partner' },
  card: { canon: '/card' },
  terms: { canon: '/terms', ogTitle: 'ব্যবহারের শর্ত | Protishthan', ogDesc: null },
  directory: { canon: '/', robots: 'noindex,follow' },        // this old address only forwards to the home page
};

let touched = [];
function read(n) { return fs.readFileSync(path.join(root, n + '.html'), 'utf8'); }
function write(n, h) { fs.writeFileSync(path.join(root, n + '.html'), h); touched.push(n); }
function addToHead(h, tag) { return h.replace(/<\/head>/i, tag + '\n</head>'); }
const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

for (const n of PRIVATE) {
  const f = path.join(root, n + '.html'); if (!fs.existsSync(f)) { console.log('missing', n); continue; }
  let h = read(n);
  if (/<meta[^>]+name=["']robots["']/i.test(h)) continue;
  h = h.replace(/(<meta[^>]+name=["']viewport["'][^>]*>)/i, '$1\n<meta name="robots" content="noindex,nofollow">');
  if (!/name="robots"/.test(h)) h = h.replace(/<head>/i, '<head>\n<meta name="robots" content="noindex,nofollow">');
  write(n, h);
}

for (const [n, c] of Object.entries(PUBLIC)) {
  let h = read(n), before = h;
  const head = (h.match(/<head>[\s\S]*?<\/head>/i) || [''])[0];
  const title = (head.match(/<title>([^<]*)<\/title>/i) || [])[1] || 'Protishthan';
  const url = SITE + (c.canon === '/' ? '/' : c.canon);
  const has = re => re.test(head);
  const add = [];
  // a relative canonical ("/") is not valid for search engines: replace it with the full address
  if (has(/rel="canonical"/)) h = h.replace(/<link rel="canonical" href="[^"]*">/i, '<link rel="canonical" href="' + url + '">');
  else add.push('<link rel="canonical" href="' + url + '">');
  if (c.desc && !has(/name="description"/)) add.push('<meta name="description" content="' + attr(c.desc) + '">');
  if (c.robots && !has(/name="robots"/)) add.push('<meta name="robots" content="' + c.robots + '">');
  const desc = c.desc || ((head.match(/name="description" content="([^"]*)"/i) || [])[1]) || '';
  if (!has(/og:url/) && !c.robots) add.push('<meta property="og:url" content="' + url + '">');
  if (!has(/og:site_name/) && !c.robots) add.push('<meta property="og:site_name" content="Protishthan">');
  if (!has(/og:locale/) && !c.robots) add.push('<meta property="og:locale" content="bn_BD">');
  if (!has(/og:title/) && !c.robots) add.push('<meta property="og:title" content="' + attr(c.ogTitle || title) + '">');
  if (!has(/og:description/) && desc && !c.robots) add.push('<meta property="og:description" content="' + desc + '">');
  if (!has(/og:image"/) && !c.robots) add.push('<meta property="og:image" content="' + SITE + '/og-image.png">');
  if (!has(/twitter:card/) && !c.robots) add.push('<meta name="twitter:card" content="summary_large_image">');
  if (add.length) h = addToHead(h, add.join('\n'));
  if (h !== before) write(n, h);
}
console.log('patched:', touched.join(', ') || '(nothing to do)');
