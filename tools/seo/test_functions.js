// Checks the search-engine pages without touching the real database or the internet:  node tools/seo/test_functions.js
// The database is replaced by a few made-up rows; the static pages are read from this folder.
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..', '..');
const imp = p => import('file://' + path.join(root, p).replace(/\\/g, '/'));

const REC = { id: '05b48345-89bf-41b8-b28b-96cb98e372c2', institution_name: 'নকলা চাঁনপুর সরকারি প্রাথমিক বিদ্যালয়', name_en: 'Nakla Chapur Rps', institution_type: 'স্কুল', district: 'শেরপুর', upazila: 'নকলা',
  address_note: null, founding_year: null, student_count: '82', teacher_count: '6', ownership: 'সরকারি', gender_type: null, medium: null, class_range: null, description: null,
  admission_status: null, source: 'dpe-primary', source_id: '160618', verification: 'unverified', prn_number: 100000, facebook_link: null, is_hidden: false, claimed_at: null };
const NEAR = [{ institution_name: 'পাশের স্কুল ১', desired_slug: 'pri-1' }, { institution_name: 'পাশের <স্কুল> ২', desired_slug: 'pri-2' }];
const AREA = [
  { district: 'শেরপুর', upazila: 'নকলা', type: 'স্কুল', n: 230 }, { district: 'শেরপুর', upazila: 'নকলা', type: 'মাদ্রাসা', n: 9 },
  { district: 'শেরপুর', upazila: 'ঝিনাইগাতী', type: 'স্কুল', n: 12 }, { district: 'ঢাকা', upazila: 'মিরপুর', type: 'কলেজ', n: 40 }, { district: 'ঢাকা', upazila: '', type: 'বিশ্ববিদ্যালয়', n: 3 },
];
let dbDown = false, calls = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url); calls.push(url);
  if (dbDown) throw new Error('database down');
  const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
  if (url.includes('rpc/seo_area_rows')) return json(AREA);
  if (url.includes('rpc/seo_sitemap_pages')) return json(3);
  if (url.includes('rpc/seo_sitemap_slugs')) { const p = JSON.parse(init.body).p_page; return json(p === 1 ? 'pri-1\nsch-2\nসিলেট স্কুল' : ''); }
  if (url.includes('desired_slug=eq.pri-160618')) return json([REC]);
  if (url.includes('desired_slug=eq.hidden-one')) return json([{ ...REC, is_hidden: true }]);
  if (url.includes('desired_slug=eq.')) return json([]);
  if (url.includes('&id=gt.')) return json(NEAR);
  if (url.includes('&id=lt.')) return json([]);
  if (url.includes('institution_type=eq.')) return json(Array.from({ length: /limit=15/.test(url) ? 15 : 100 }, (_, i) => ({ institution_name: 'প্রতিষ্ঠান ' + i, desired_slug: 'x-' + i, ownership: 'সরকারি', upazila: 'নকলা' })));
  return json([]);
};
const env = { ASSETS: { fetch: async req => {
  const p = new URL(req.url).pathname.replace(/^\//, '');
  const f = path.join(root, p.endsWith('.html') ? p : p + '.html');
  return fs.existsSync(f) ? new Response(fs.readFileSync(f, 'utf8'), { headers: { 'Content-Type': 'text/html' } }) : new Response('nope', { status: 404 });
} } };
const ctx = (url, extra = {}) => ({ request: new Request(url, { headers: extra.headers || {} }), env, params: extra.params || {}, waitUntil() {}, next: async () => new Response('next') });
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

(async () => {
  // ---- institution page
  const inst = await imp('functions/institution-detail.js');
  let res = await inst.onRequestGet(ctx('https://protishthan.com/institution-detail?slug=pri-160618'));
  let h = await res.text();
  ok(res.status === 200, 'institution 200');
  ok(/<title>নকলা চাঁনপুর সরকারি প্রাথমিক বিদ্যালয় — স্কুল, নকলা, শেরপুর \| Protishthan<\/title>/.test(h), 'title');
  ok((h.match(/<title>/g) || []).length === 1, 'one title');
  ok((h.match(/property="og:title"/g) || []).length === 1, 'one og:title (the generic one was removed)');
  ok((h.match(/<meta name="description"/g) || []).length === 1, 'one description');
  ok(h.includes('rel="canonical" href="https://protishthan.com/institution-detail?slug=pri-160618"'), 'canonical');
  ok(/name="robots" content="index,follow/.test(h), 'indexable');
  ok(h.includes('data-ssr="1"') && h.includes('<h1>নকলা চাঁনপুর সরকারি প্রাথমিক বিদ্যালয়</h1>'), 'readable summary');
  ok(h.includes('শিক্ষার্থী ৮২ জন') && h.includes('EIIN ১৬০৬১৮'), 'facts shown in Bangla digits');
  ok(h.includes('পাশের &lt;স্কুল&gt; ২') && !h.includes('পাশের <স্কুল>'), 'names are escaped');
  ok(h.includes('href="/area/%E0%A6%B6%E0%A7%87%E0%A6%B0%E0%A6%AA%E0%A7%81%E0%A6%B0"'), 'link to the district page');
  const ld = JSON.parse(h.match(/<script type="application\/ld\+json" id="ld-ssr">([\s\S]*?)<\/script>/)[1]);
  ok(ld['@graph'][0]['@type'] === 'School' && ld['@graph'][0].address.addressRegion === 'শেরপুর' && ld['@graph'][1]['@type'] === 'BreadcrumbList', 'structured data');
  ok(!/telephone|contact_phone|email/i.test(JSON.stringify(ld)), 'no phone or email in structured data');
  ok(!h.includes('<!--ssr-->'), 'marker replaced');
  ok(/#loadingState \.skel-cover/.test(h), 'skeleton hidden while the summary shows');

  res = await inst.onRequestGet(ctx('https://protishthan.com/institution-detail?slug=nope')); h = await res.text();
  ok(res.status === 404 && /noindex/.test(h), 'unknown slug -> 404 + noindex');
  res = await inst.onRequestGet(ctx('https://protishthan.com/institution-detail')); ok(res.status === 404, 'no slug -> 404');
  res = await inst.onRequestGet(ctx('https://protishthan.com/institution-detail?slug=hidden-one')); h = await res.text();
  ok(res.status === 200 && /name="robots" content="noindex/.test(h), 'hidden listing -> noindex');
  dbDown = true;
  res = await inst.onRequestGet(ctx('https://protishthan.com/institution-detail?slug=pri-160618', { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } }));
  ok(res.status === 503 && res.headers.get('Retry-After'), 'database down + crawler -> 503, come back later');
  res = await inst.onRequestGet(ctx('https://protishthan.com/institution-detail?slug=pri-160618', { headers: { 'user-agent': 'Mozilla/5.0 Chrome' } }));
  ok(res.status === 200 && !/noindex/.test(await res.text()), 'database down + person -> normal page');
  dbDown = false;

  // ---- area pages
  const area = await imp('functions/area/[[path]].js');
  const get = async (parts, q = '') => { const r = await area.onRequestGet(ctx('https://protishthan.com/area/' + parts.map(encodeURIComponent).join('/') + q, { params: { path: parts.map(encodeURIComponent) } })); return [r, await r.text()]; };
  [res, h] = await get([]);
  ok(res.status === 200 && h.includes('<h1>জেলা অনুযায়ী শিক্ষা প্রতিষ্ঠান</h1>') && h.includes('২টি জেলার'), 'area index');
  [res, h] = await get(['শেরপুর']);
  ok(res.status === 200 && h.includes('শেরপুর জেলার শিক্ষা প্রতিষ্ঠান') && h.includes('২৫১টি প্রতিষ্ঠানের তথ্য'), 'district page counts add up (230+9+12=251)');
  ok(h.includes('rel="canonical" href="https://protishthan.com/area/%E0%A6%B6%E0%A7%87%E0%A6%B0%E0%A6%AA%E0%A7%81%E0%A6%B0"'), 'district canonical');
  [res, h] = await get(['ঢাকা']);
  ok(res.status === 200 && h.includes('৪৩টি') && h.includes('বিশ্ববিদ্যালয়'), 'university without an upazila still counts for the district');
  [res, h] = await get(['শেরপুর', 'নকলা']);
  ok(res.status === 200 && h.includes('নকলা-এর স্কুল') && h.includes('সব ২৩০টি স্কুল দেখুন') && !h.includes('সব ৯টি মাদ্রাসা দেখুন'), 'upazila page: "see all" only when there is more than the preview');
  [res, h] = await get(['শেরপুর', 'নকলা', 'স্কুল']);
  ok(res.status === 200 && h.includes('rel="next"') && h.includes('?page=2') && h.includes('<span aria-current="page">১</span>'), 'list page 1 with a next link');
  ok((h.match(/<li><a href="\/institution-detail/g) || []).length === 100, '100 per page');
  [res, h] = await get(['শেরপুর', 'নকলা', 'স্কুল'], '?page=3');
  ok(res.status === 200 && h.includes('rel="prev"') && !h.includes('rel="next"') && h.includes('?page=3'), '230 institutions = 3 pages of 100; page 3 is the last');
  ok(h.includes('rel="canonical" href="https://protishthan.com/area/%E0%A6%B6%E0%A7%87%E0%A6%B0%E0%A6%AA%E0%A7%81%E0%A6%B0/%E0%A6%A8%E0%A6%95%E0%A6%B2%E0%A6%BE/%E0%A6%B8%E0%A7%8D%E0%A6%95%E0%A7%81%E0%A6%B2?page=3"'), 'each page has its own canonical');
  [res] = await get(['শেরপুর', 'নকলা', 'স্কুল'], '?page=4'); ok(res.status === 404, 'page 4 does not exist');
  [res] = await get(['শেরপুর', 'নকলা', 'স্কুল'], '?page=0'); ok(res.status === 404, 'page 0 does not exist');
  [res, h] = await get(['শেরপুর', 'নকলা', 'মাদ্রাসা']);
  ok(res.status === 200 && h.includes('rel="canonical" href="https://protishthan.com/area/%E0%A6%B6%E0%A7%87%E0%A6%B0%E0%A6%AA%E0%A7%81%E0%A6%B0/%E0%A6%A8%E0%A6%95%E0%A6%B2%E0%A6%BE"'), 'a short list (9) points to the upazila page as its main address');
  [res, h] = await get(['শেরপুর', 'স্কুল']);
  ok(res.status === 200 && h.includes('শেরপুর-এর স্কুল') && h.includes('<span>নকলা · সরকারি</span>'), 'district-wide list shows the upazila of each school');
  [res, h] = await get(['ঢাকা', 'বিশ্ববিদ্যালয়']); ok(res.status === 200, 'universities have a district list');
  for (const bad of [['নেই'], ['শেরপুর', 'নেই'], ['শেরপুর', 'নকলা', 'নেই'], ['শেরপুর', 'নকলা', 'স্কুল', 'আরও'], ['শেরপুর', 'কলেজ']]) {
    [res, h] = await get(bad); ok(res.status === 404 && /noindex/.test(h), 'unknown area -> 404 + noindex: ' + bad.join('/'));
  }
  [res, h] = await get(['শেরপুর', 'নকলা'].map(x => x.normalize('NFD'))); ok(res.status === 200, 'a differently-typed (decomposed) name still finds the page');
  ok((h.match(/analytics\.js/g) || []).length === 1, 'analytics only once');

  dbDown = true;
  [res, h] = await get([]);
  ok(res.status === 503 && res.headers.get('Retry-After') && /noindex/.test(h) && h.includes('পাতাটি এখন খোলা যাচ্ছে না'), 'database down -> 503 with a short note, kept out of search');
  dbDown = false;

  // ---- sitemaps
  const idx = await imp('functions/sitemap.xml.js');
  h = await (await idx.onRequestGet(ctx('https://protishthan.com/sitemap.xml'))).text();
  ok(h.includes('<sitemapindex') && h.includes('/sitemap-pages.xml') && h.includes('/sitemap-areas.xml') && h.includes('/sitemap-institutions/3') && !h.includes('/sitemap-institutions/4'), 'sitemap index lists 3 institution files');
  const sm = await imp('functions/sitemap-institutions/[page].js');
  res = await sm.onRequestGet(ctx('https://protishthan.com/sitemap-institutions/1', { params: { page: '1' } })); h = await res.text();
  ok(res.headers.get('Content-Type').startsWith('application/xml') && h.includes('<loc>https://protishthan.com/institution-detail?slug=pri-1</loc>') && h.includes('slug=%E0%A6%B8%E0%A6%BF%E0%A6%B2%E0%A7%87%E0%A6%9F'), 'institution sitemap');
  res = await sm.onRequestGet(ctx('https://protishthan.com/sitemap-institutions/2', { params: { page: '2' } })); ok(res.status === 404, 'empty file -> 404');
  res = await sm.onRequestGet(ctx('https://protishthan.com/sitemap-institutions/x', { params: { page: 'x' } })); ok(res.status === 404, 'bad number -> 404');
  const am = await imp('functions/sitemap-areas.xml.js');
  h = await (await am.onRequestGet(ctx('https://protishthan.com/sitemap-areas.xml'))).text();
  ok(h.includes('<loc>https://protishthan.com/area</loc>') && (h.match(/<url>/g) || []).length === 12 && h.includes('%E0%A6%A8%E0%A6%95%E0%A6%B2%E0%A6%BE/%E0%A6%B8%E0%A7%8D%E0%A6%95%E0%A7%81%E0%A6%B2</loc>') && !h.includes('%E0%A6%A8%E0%A6%95%E0%A6%B2%E0%A6%BE/%E0%A6%AE%E0%A6%BE%E0%A6%A6%E0%A7%8D%E0%A6%B0%E0%A6%BE%E0%A6%B8%E0%A6%BE</loc>'), 'area sitemap: list pages only when longer than the preview');

  // ---- not the website
  const mw = await imp('functions/_middleware.js');
  for (const p of ['/PROJECT_CONTEXT.md', '/migrations/2026-11-13_listing_lockdown.sql', '/server.js', '/social-server/plan.json', '/_archive/test-output/rc_output.pdf', '/package.json', '/data/board-results/x.json']) {
    res = await mw.onRequest(ctx('https://protishthan.com' + p)); ok(res.status === 404, 'blocked: ' + p);
  }
  for (const p of ['/', '/card', '/s/someone', '/api/tashkeel', '/institution-detail', '/area/x', '/datasheet', '/tools-and-more']) {
    res = await mw.onRequest(ctx('https://protishthan.com' + p)); ok(await res.text() === 'next', 'passes through: ' + p);
  }

  // ---- the files themselves
  const routes = JSON.parse(fs.readFileSync(path.join(root, '_routes.json'), 'utf8'));
  ok(routes.include.length <= 100, '_routes.json: at most 100 rules');
  for (const p of ['/s/*', '/api/*', '/institution-detail', '/area', '/area/*', '/sitemap.xml', '/sitemap-areas.xml', '/sitemap-institutions/*']) ok(routes.include.includes(p), '_routes.json includes ' + p);
  const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
  ok(robots.includes('Sitemap: https://protishthan.com/sitemap.xml') && !/^Disallow:\s*\/\s*$/m.test(robots), 'robots.txt points to the sitemap and does not block the site');
  const priv = ['admin', 'login', 'dashboard', 'student-login', 'teacher-dashboard', 'settings', 'finance', 'classroom'];
  for (const p of priv) ok(/name="robots"[^>]*noindex/.test(fs.readFileSync(path.join(root, p + '.html'), 'utf8')), p + '.html is noindex');
  const pub = ['index', 'about', 'info', 'card', 'skill', 'partner', 'list-institution', 'privacy', 'terms'];
  for (const p of pub) { const t = fs.readFileSync(path.join(root, p + '.html'), 'utf8'); ok(!/name="robots"[^>]*noindex/.test(t) && t.includes('rel="canonical" href="https://protishthan.com') && /name="description"/.test(t), p + '.html: indexable, absolute canonical, description'); }

  console.log('all ' + n + ' checks passed');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
