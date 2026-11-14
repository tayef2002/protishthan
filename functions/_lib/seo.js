// Shared helpers for the pages that are built on the server so search engines (and link previews) can read them:
//   /institution-detail?slug=...   functions/institution-detail.js
//   /area, /area/<district>/...    functions/area/[[path]].js
//   /sitemap.xml and friends       functions/sitemap.xml.js, functions/sitemap-institutions/[page].js, functions/sitemap-areas.xml.js
// Everything read here is already public on the site (the same anon key as the pages). Phone numbers and emails are never put in these pages.

export const SITE = 'https://protishthan.com';
export const SB = 'https://eoqeeuujvpydhmfteqqj.supabase.co';
export const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvcWVldXVqdnB5ZGhtZnRlcXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTM2NTgsImV4cCI6MjA5NzE4OTY1OH0.xuC-_euxf0DTqTpD5b8_6vgnkjeJjZIFqdKw-Bq3YbU';

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const BN = '০১২৩৪৫৬৭৮৯';
export const bn = n => String(n).replace(/\d/g, d => BN[d]);
export const bnNum = n => bn(Number(n).toLocaleString('en-IN'));          // 101938 -> ১,০১,৯৩৮
// Bangla possessive: a name that ends in a vowel takes র (মাদ্রাসা -> মাদ্রাসার), one that ends in a consonant takes ের (স্কুল -> স্কুলের)
export const poss = s => String(s) + (/[অ-ঔা-ৌ]$/.test(String(s)) ? 'র' : 'ের');
export const toInt = v => { const n = parseInt(String(v == null ? '' : v).replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : 0; };

// the six kinds of institution the directory knows, with the schema.org type used for each
export const TYPES = ['স্কুল', 'মাদ্রাসা', 'কলেজ', 'কারিগরি', 'বিশ্ববিদ্যালয়', 'কোচিং সেন্টার'];
export const TYPE_LD = { 'স্কুল': 'School', 'মাদ্রাসা': 'School', 'কলেজ': 'CollegeOrUniversity', 'বিশ্ববিদ্যালয়': 'CollegeOrUniversity', 'কারিগরি': 'EducationalOrganization', 'কোচিং সেন্টার': 'EducationalOrganization' };
export const TYPE_PLURAL = { 'স্কুল': 'স্কুল', 'মাদ্রাসা': 'মাদ্রাসা', 'কলেজ': 'কলেজ', 'কারিগরি': 'কারিগরি প্রতিষ্ঠান', 'বিশ্ববিদ্যালয়': 'বিশ্ববিদ্যালয়', 'কোচিং সেন্টার': 'কোচিং সেন্টার' };
export const SOURCE_NAME = { 'dpe-primary': 'প্রাথমিক ও গণশিক্ষা অধিদপ্তর (DPE)', 'banbeis-2024': 'BANBEIS ২০২৪', 'ugc': 'বিশ্ববিদ্যালয় মঞ্জুরি কমিশন (UGC)' };

// Circuit breaker: when the database times out or answers with a server error, every database call from these server pages stops for 15 seconds
// (the answer is simply "could not read", which the pages already handle). Without it, a crawler walking thousands of pages keeps piling requests
// onto a database that is already struggling, and the database cannot recover.
const BREAKER_KEY = () => new Request('https://protishthan.com/__cache/db-breaker');
const BREAKER_SECONDS = 15;
async function breakerOpen() { try { return typeof caches !== 'undefined' && !!(await caches.default.match(BREAKER_KEY())); } catch (e) { return false; } }
async function tripBreaker() { try { if (typeof caches !== 'undefined') await caches.default.put(BREAKER_KEY(), new Response('1', { headers: { 'Cache-Control': 'public, max-age=' + BREAKER_SECONDS } })); } catch (e) {} }      // awaited: a dropped promise would mean the breaker never closes the door

// read from the database with a short time limit. Returns { data } or null when it could not be read.
export async function rest(path, { range = null, rpc = null, timeout = 3500, force = false } = {}) {
  if (!force && await breakerOpen()) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY, Accept: 'application/json' };
    let url = SB + '/rest/v1/' + path, init = { headers, signal: ctl.signal };
    if (rpc !== null) { init.method = 'POST'; headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(rpc); }
    else if (range) { headers['Range-Unit'] = 'items'; headers.Range = range[0] + '-' + range[1]; }      // no exact count: counting rows is slow on the free database
    const r = await fetch(url, init);
    if (r.status >= 500) { await tripBreaker(); return null; }
    if (!r.ok && r.status !== 206) return null;
    return { data: await r.json() };
  } catch (e) {
    await tripBreaker();                              // timeout or network failure
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// small helper so the page address never contains a raw Bangla letter or space problem
export const seg = s => encodeURIComponent(s);
export const areaUrl = (...parts) => '/area' + parts.filter(Boolean).map(p => '/' + seg(p)).join('');

// keep a finished page on the edge for an hour so a crawler that walks thousands of pages does not hit the database for each one twice
export async function cached(ctx, produce) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(ctx.request.url, { method: 'GET' });
  if (cache) { try { const hit = await cache.match(key); if (hit) return hit; } catch (e) {} }
  const res = await produce();
  if (cache && res.status === 200 && /public/.test(res.headers.get('Cache-Control') || '')) {
    const put = cache.put(key, res.clone()).catch(() => {});
    if (ctx.waitUntil) ctx.waitUntil(put);
  }
  return res;
}

export function isBot(request) {
  return /googlebot|bingbot|duckduckbot|yandex|baiduspider|applebot|facebookexternalhit|twitterbot|linkedinbot|slurp/i.test(request.headers.get('user-agent') || '');
}

// the result of the page being built here: always html, short browser cache, a little longer on the edge
export function htmlResponse(html, status = 200, cache = 'public, max-age=300, s-maxage=3600') {
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache } });
}

// one shared page shell for the area pages (same menu and footer as the other pages, no big script of its own)
export function shell({ title, desc, canonical, robots = 'index,follow,max-image-preview:large', ld = [], body, active = '' }) {
  const ldTags = ld.map(o => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>').join('\n');
  return '<!DOCTYPE html>\n<html lang="bn">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<base href="/">\n<title>' + esc(title) + '</title>\n<meta name="description" content="' + esc(desc) + '">\n<meta name="robots" content="' + robots + '">\n' +
    (canonical ? '<link rel="canonical" href="' + esc(canonical) + '">\n' : '') +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="Protishthan"><meta property="og:locale" content="bn_BD">\n' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">' +
    (canonical ? '<meta property="og:url" content="' + esc(canonical) + '">' : '') + '\n' +
    '<meta property="og:image" content="' + SITE + '/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">\n' +
    '<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#F4F6FB">\n' +
    '<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">\n' +
    '<link rel="stylesheet" href="/nav.css?v=19"><link rel="stylesheet" href="/footer.css?v=6">\n' +
    '<style>' + AREA_CSS + '</style>\n' +
    '<link rel="preload" href="/Font/SolaimanLipi-sub.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/lipi.css?v=2">\n' +
    ldTags + '\n<script src="/analytics.js?v=3" defer></script>\n</head>\n<body>\n' +
    '<div id="nav" class="ptn" data-theme="light" data-set="main" data-cta="member"' + (active ? ' data-active="' + active + '"' : '') + '></div>\n<script src="/nav.js?v=18"></script>\n' +
    body + '\n<div id="pfoot"></div>\n<script src="/footer.js?v=18"></script>\n</body>\n</html>';
}

const AREA_CSS = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--blue:#1A56DB;--text:#0B1B4D;--text-2:#475569;--text-3:#64748B;--border:#E2E8F0;--bg:#F4F6FB}
body{font-family:'Hind Siliguri','Inter',sans-serif;color:var(--text);background:var(--bg);line-height:1.65;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.wrap{max-width:1000px;margin:0 auto;padding:0 20px}
.top{margin:92px auto 0;max-width:1000px;padding:38px 32px 34px;border-radius:28px;background:linear-gradient(135deg,#D9EBFF,#E6E4FF)}
.crumb{font-size:14px;color:var(--text-3);margin-bottom:10px}
.crumb a{color:var(--blue);font-weight:600}
.crumb a:hover{text-decoration:underline}
h1{font:800 clamp(26px,4.4vw,38px)/1.28 'Hind Siliguri','Inter',sans-serif;letter-spacing:-.4px}
.lead{color:var(--text-2);font-size:17px;margin-top:10px;max-width:42em}
section{margin-top:34px}
h2{font:800 21px/1.35 'Hind Siliguri','Inter',sans-serif;margin-bottom:12px}
h2 small{color:var(--text-3);font:500 15px 'Hind Siliguri',sans-serif;margin-left:6px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{display:inline-flex;align-items:baseline;gap:6px;padding:8px 15px;border:1px solid var(--border);border-radius:999px;background:#fff;font-weight:600;font-size:15px}
.chip b{color:var(--blue);font-weight:800}
.chip:hover{border-color:var(--blue)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.grid a{display:block;padding:13px 16px;background:#fff;border:1px solid var(--border);border-radius:14px;font-weight:600}
.grid a:hover{border-color:var(--blue);color:var(--blue)}
.grid a small{display:block;color:var(--text-3);font-weight:500;font-size:13px;margin-top:2px}
ul.list{list-style:none;background:#fff;border:1px solid var(--border);border-radius:18px;overflow:hidden}
ul.list li a{display:flex;justify-content:space-between;gap:12px;align-items:baseline;padding:12px 18px;border-top:1px solid var(--border)}
ul.list li:first-child a{border-top:0}
ul.list li a:hover{background:#F8FAFF;color:var(--blue)}
ul.list li a span{color:var(--text-3);font-size:13.5px;white-space:nowrap}
.more{display:inline-block;margin-top:12px;color:var(--blue);font-weight:700}
.pager{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
.pager a,.pager span{padding:8px 14px;border-radius:10px;border:1px solid var(--border);background:#fff;font-weight:600;font-size:15px}
.pager span{background:var(--blue);border-color:var(--blue);color:#fff}
.note{margin-top:34px;padding:16px 20px;border-radius:16px;background:#fff;border:1px solid var(--border);color:var(--text-2);font-size:15px}
.note a{color:var(--blue);font-weight:700}
@media(max-width:900px){.top{margin:84px 12px 0;padding:28px 20px;border-radius:22px}.wrap{padding:0 14px}}
main{padding-bottom:56px}`;

// ---- the area numbers: one grouped read of the whole directory, kept for a few hours on the edge ----
// rows: [{ district, upazila, type, n }]. null when the database function has not been created yet (the area pages then answer 503, never wrong numbers)
export async function areaRows(ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(SITE + '/__cache/area-rows-v1');
  if (cache) { try { const hit = await cache.match(key); if (hit) return await hit.json(); } catch (e) {} }
  const r = await rest('rpc/seo_area_rows', { rpc: {}, timeout: 9000 });
  if (!r || !Array.isArray(r.data)) return null;
  if (cache) {
    const put = cache.put(key, new Response(JSON.stringify(r.data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=21600' } })).catch(() => {});
    if (ctx && ctx.waitUntil) ctx.waitUntil(put);
  }
  return r.data;
}

// "ঢাকা" -> { n: 2408, types: { স্কুল: .. }, upazilas: Map }
export function summarize(rows) {
  const districts = new Map();
  for (const r of rows) {
    if (!r.district) continue;
    let d = districts.get(r.district); if (!d) districts.set(r.district, d = { name: r.district, n: 0, types: {}, upazilas: new Map() });
    d.n += r.n; d.types[r.type] = (d.types[r.type] || 0) + r.n;
    if (!r.upazila) continue;
    let u = d.upazilas.get(r.upazila); if (!u) d.upazilas.set(r.upazila, u = { name: r.upazila, n: 0, types: {} });
    u.n += r.n; u.types[r.type] = (u.types[r.type] || 0) + r.n;
  }
  return districts;
}
export const byBn = (a, b) => String(a).localeCompare(String(b), 'bn');
