// protishthan.com/area                       every district
// protishthan.com/area/<district>            its upazilas and the kinds of institutions
// protishthan.com/area/<district>/<upazila>  that upazila, grouped by kind
// protishthan.com/area/<district>/<kind>     or  /area/<district>/<upazila>/<kind>   the full (paged) list, e.g. all madrasas of one upazila
// These pages exist so search engines (and people) can reach every one of the ~100,000 institutions through ordinary links, and so that searches like
// "নকলা উপজেলার স্কুল" have a page that answers them. The numbers come from the database; nothing here is typed in by hand.

import { SITE, rest, cached, poss, esc, clip, bn, bnNum, TYPES, TYPE_PLURAL, htmlResponse, shell, areaUrl, areaRows, summarize, byBn } from '../_lib/seo.js';

const PER_PAGE = 100, PREVIEW = 15;
const norm = s => String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim();
const typeChips = (types, link) => TYPES.filter(t => types[t]).map(t => '<a class="chip" href="' + link(t) + '">' + esc(TYPE_PLURAL[t]) + ' <b>' + bnNum(types[t]) + '</b></a>').join('');
const typeSentence = types => TYPES.filter(t => types[t]).map(t => bnNum(types[t]) + 'টি ' + TYPE_PLURAL[t]).join(', ');
const NOTE = '<p class="note">এই তালিকার বেশিরভাগ তথ্য সরকারি উৎস (প্রাথমিক ও গণশিক্ষা অধিদপ্তর, BANBEIS) থেকে নেওয়া, আর অনেক প্রতিষ্ঠানের তথ্য এখনো যাচাই বাকি। ' +
  'আপনার প্রতিষ্ঠান তালিকায় না থাকলে বা তথ্য ভুল থাকলে <a href="/list-institution">বিনামূল্যে যুক্ত বা সংশোধন করুন</a>।</p>';

const crumbLd = list => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + c.url })) });
const crumbHtml = list => '<div class="crumb">' + list.map((c, i) => i === list.length - 1 ? esc(c.name) : '<a href="' + c.url + '">' + esc(c.name) + '</a>').join(' › ') + '</div>';
const page = ({ path, canon, title, desc, h1, lead, crumbs, body, ld = [], robots }) =>
  shell({ title, desc, canonical: SITE + (canon || path), robots, ld: [crumbLd(crumbs), ...ld], active: 'directory',
    body: '<header class="top">' + crumbHtml(crumbs) + '<h1>' + esc(h1) + '</h1><p class="lead">' + lead + '</p></header><main class="wrap">' + body + NOTE + '</main>' });

function notFound() {
  return htmlResponse(shell({ title: 'পাতাটি পাওয়া যায়নি | Protishthan', desc: 'এই এলাকার পাতাটি পাওয়া যায়নি।', robots: 'noindex,nofollow',
    body: '<header class="top"><h1>এই এলাকার পাতাটি পাওয়া যায়নি</h1><p class="lead">নামটি ভুল হতে পারে। <a href="/area" style="color:#1A56DB;font-weight:700">সব জেলার তালিকা দেখুন</a>।</p></header>' }), 404, 'no-store');
}
// the database could not answer (or the area numbers are not set up yet): crawlers are told to come back, people get a short note
function unavailable() {
  const body = shell({ title: 'পাতাটি এখন খোলা যাচ্ছে না | Protishthan', desc: 'এলাকার পাতাটি কিছুক্ষণের জন্য খোলা যাচ্ছে না।', robots: 'noindex,nofollow',
    body: '<header class="top"><h1>পাতাটি এখন খোলা যাচ্ছে না</h1><p class="lead">একটু পরে আবার চেষ্টা করুন। এর মধ্যে <a href="/" style="color:#1A56DB;font-weight:700">তথ্যভান্ডারে</a> নাম লিখে খুঁজতে পারেন।</p></header>' });
  return new Response(body, { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store', 'Content-Type': 'text/html; charset=utf-8' } });
}

function renderIndex(D) {
  const ds = [...D.values()].sort((a, b) => byBn(a.name, b.name));
  const total = ds.reduce((s, d) => s + d.n, 0), types = {};
  ds.forEach(d => Object.entries(d.types).forEach(([t, n]) => { types[t] = (types[t] || 0) + n; }));
  const crumbs = [{ name: 'তথ্যভান্ডার', url: '/' }, { name: 'এলাকা অনুযায়ী', url: '/area' }];
  return htmlResponse(page({
    path: '/area', crumbs,
    title: 'জেলা অনুযায়ী স্কুল, মাদ্রাসা ও কলেজের তালিকা | Protishthan',
    desc: clip('বাংলাদেশের ' + bn(ds.length) + 'টি জেলার ' + bnNum(total) + 'টি শিক্ষা প্রতিষ্ঠানের তথ্য: ' + typeSentence(types) + '। জেলা ও উপজেলা বেছে খুঁজে নিন।', 200),
    h1: 'জেলা অনুযায়ী শিক্ষা প্রতিষ্ঠান',
    lead: 'Protishthan-এ ' + bn(ds.length) + 'টি জেলার ' + bnNum(total) + 'টি প্রতিষ্ঠানের তথ্য আছে: ' + esc(typeSentence(types)) + '। আপনার জেলা বেছে নিন।',
    body: '<section><h2>সব জেলা <small>' + bn(ds.length) + 'টি</small></h2><div class="grid">' +
      ds.map(d => '<a href="' + areaUrl(d.name) + '">' + esc(d.name) + '<small>' + bnNum(d.n) + 'টি প্রতিষ্ঠান</small></a>').join('') + '</div></section>',
  }));
}

function renderDistrict(d) {
  const us = [...d.upazilas.values()].sort((a, b) => byBn(a.name, b.name));
  const crumbs = [{ name: 'তথ্যভান্ডার', url: '/' }, { name: 'এলাকা অনুযায়ী', url: '/area' }, { name: d.name, url: areaUrl(d.name) }];
  return htmlResponse(page({
    path: areaUrl(d.name), crumbs,
    title: d.name + ' জেলার স্কুল, মাদ্রাসা ও কলেজ — উপজেলা অনুযায়ী তালিকা | Protishthan',
    desc: clip(d.name + ' জেলার ' + bn(us.length) + 'টি উপজেলার ' + bnNum(d.n) + 'টি প্রতিষ্ঠানের তথ্য: ' + typeSentence(d.types) + '। উপজেলা বেছে সব প্রতিষ্ঠান দেখুন।', 200),
    h1: d.name + ' জেলার শিক্ষা প্রতিষ্ঠান',
    lead: esc(d.name) + ' জেলার ' + bn(us.length) + 'টি উপজেলায় Protishthan-এ ' + bnNum(d.n) + 'টি প্রতিষ্ঠানের তথ্য আছে: ' + esc(typeSentence(d.types)) + '।',
    body: '<section><h2>ধরন অনুযায়ী</h2><div class="chips">' + typeChips(d.types, t => areaUrl(d.name, t)) + '</div></section>' +
      '<section><h2>উপজেলা অনুযায়ী <small>' + bn(us.length) + 'টি</small></h2><div class="grid">' +
      us.map(u => '<a href="' + areaUrl(d.name, u.name) + '">' + esc(u.name) + '<small>' + bnNum(u.n) + 'টি প্রতিষ্ঠান</small></a>').join('') + '</div></section>',
  }));
}

function itemList(rows, withPlace) {
  return '<ul class="list">' + rows.map(r => '<li><a href="/institution-detail?slug=' + encodeURIComponent(r.desired_slug) + '">' + esc(r.institution_name) +
    '<span>' + esc(withPlace && r.upazila ? [r.upazila, r.ownership].filter(Boolean).join(' · ') : (r.ownership || '')) + '</span></a></li>').join('') + '</ul>';
}

async function renderUpazila(d, u) {
  const crumbs = [{ name: 'তথ্যভান্ডার', url: '/' }, { name: 'এলাকা অনুযায়ী', url: '/area' }, { name: d.name, url: areaUrl(d.name) }, { name: u.name, url: areaUrl(d.name, u.name) }];
  const kinds = TYPES.filter(t => u.types[t]);
  const lists = await Promise.all(kinds.map(t => rest('listing_submissions?status=eq.approved&is_hidden=not.is.true&district=eq.' + encodeURIComponent(d.name) + '&upazila=eq.' + encodeURIComponent(u.name) +
    '&institution_type=eq.' + encodeURIComponent(t) + '&select=institution_name,desired_slug,ownership&order=institution_name,desired_slug&limit=' + PREVIEW)));
  if (lists.some(x => !x)) return null;
  const sections = kinds.map((t, i) => '<section><h2>' + esc(u.name) + ' উপজেলার ' + esc(TYPE_PLURAL[t]) + ' <small>' + bnNum(u.types[t]) + 'টি</small></h2>' + itemList(lists[i].data) +
    (u.types[t] > PREVIEW ? '<a class="more" href="' + areaUrl(d.name, u.name, t) + '">সব ' + bnNum(u.types[t]) + 'টি ' + esc(TYPE_PLURAL[t]) + ' দেখুন →</a>' : '') + '</section>').join('');
  return htmlResponse(page({
    path: areaUrl(d.name, u.name), crumbs,
    title: u.name + ', ' + d.name + ' — স্কুল, মাদ্রাসা ও কলেজের তালিকা | Protishthan',
    desc: clip(d.name + ' জেলার ' + u.name + ' উপজেলায় ' + bnNum(u.n) + 'টি শিক্ষা প্রতিষ্ঠান: ' + typeSentence(u.types) + '। নাম, ধরন ও তথ্য দেখুন।', 200),
    h1: u.name + ' উপজেলার শিক্ষা প্রতিষ্ঠান (' + d.name + ')',
    lead: esc(d.name) + ' জেলার ' + esc(u.name) + ' উপজেলায় Protishthan-এ ' + bnNum(u.n) + 'টি প্রতিষ্ঠানের তথ্য আছে: ' + esc(typeSentence(u.types)) + '।',
    body: '<section><div class="chips">' + typeChips(u.types, t => areaUrl(d.name, u.name, t)) + '</div></section>' + sections,
  }));
}

async function renderList(d, u, type, pageNo) {
  const total = (u ? u.types : d.types)[type] || 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (!total || pageNo < 1 || pageNo > pages) return notFound();
  const q = await rest('listing_submissions?status=eq.approved&is_hidden=not.is.true&district=eq.' + encodeURIComponent(d.name) + (u ? '&upazila=eq.' + encodeURIComponent(u.name) : '') +
    '&institution_type=eq.' + encodeURIComponent(type) + '&select=institution_name,desired_slug,ownership,upazila&order=institution_name,desired_slug',
    { range: [(pageNo - 1) * PER_PAGE, pageNo * PER_PAGE - 1], timeout: 8000 });
  if (!q) return null;
  const inPlace = u ? d.name + ' জেলার ' + u.name + ' উপজেলায়' : d.name + ' জেলায়', plural = TYPE_PLURAL[type];
  const base = u ? areaUrl(d.name, u.name, type) : areaUrl(d.name, type);
  const path = pageNo > 1 ? base + '?page=' + pageNo : base;
  const crumbs = [{ name: 'তথ্যভান্ডার', url: '/' }, { name: 'এলাকা অনুযায়ী', url: '/area' }, { name: d.name, url: areaUrl(d.name) }];
  if (u) crumbs.push({ name: u.name, url: areaUrl(d.name, u.name) });
  crumbs.push({ name: plural, url: base });
  const win = []; for (let p = Math.max(1, pageNo - 3); p <= Math.min(pages, pageNo + 3); p++) win.push(p);
  const pager = pages > 1 ? '<nav class="pager" aria-label="পাতা">' + (pageNo > 1 ? '<a href="' + (pageNo === 2 ? base : base + '?page=' + (pageNo - 1)) + '" rel="prev">← আগের</a>' : '') +
    win.map(p => p === pageNo ? '<span aria-current="page">' + bn(p) + '</span>' : '<a href="' + (p === 1 ? base : base + '?page=' + p) + '">' + bn(p) + '</a>').join('') +
    (pageNo < pages ? '<a href="' + base + '?page=' + (pageNo + 1) + '" rel="next">পরের →</a>' : '') + '</nav>' : '';
  const itemLd = { '@context': 'https://schema.org', '@type': 'ItemList', numberOfItems: total,
    itemListElement: q.data.map((r, i) => ({ '@type': 'ListItem', position: (pageNo - 1) * PER_PAGE + i + 1, name: r.institution_name, url: SITE + '/institution-detail?slug=' + encodeURIComponent(r.desired_slug) })) };
  const from = (pageNo - 1) * PER_PAGE + 1, to = from + q.data.length - 1;
  return htmlResponse(page({
    path, crumbs, ld: [itemLd], canon: u && total <= PREVIEW ? areaUrl(d.name, u.name) : null,
    title: (u ? u.name + ' উপজেলার ' + plural + ', ' + d.name : d.name + ' জেলার ' + plural) + ' — তালিকা' + (pageNo > 1 ? ' (পাতা ' + bn(pageNo) + ')' : '') + ' | Protishthan',
    desc: clip(inPlace + ' ' + bnNum(total) + 'টি ' + poss(plural) + ' নাম ও তথ্য' + (pageNo > 1 ? ' (পাতা ' + bn(pageNo) + '/' + bn(pages) + ')' : '') + '। প্রতিষ্ঠানের নামে চাপ দিয়ে বিস্তারিত দেখুন।', 200),
    h1: u ? u.name + ' উপজেলার ' + plural + ' (' + d.name + ')' : d.name + ' জেলার ' + plural,
    lead: esc(inPlace) + ' Protishthan-এ ' + bnNum(total) + 'টি ' + esc(poss(plural)) + ' তথ্য আছে' + (pages > 1 ? ' (এখন ' + bn(from) + ' থেকে ' + bn(to) + ' নম্বর দেখছেন)' : '') + '।',
    body: '<section>' + itemList(q.data, !u) + pager + '</section>',
  }));
}

export async function onRequestGet(context) { return cached(context, () => handle(context)); }

async function handle(context) {
  const raw = context.params.path;
  const parts = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(p => { try { return norm(decodeURIComponent(p)); } catch (e) { return norm(p); } }).filter(Boolean);
  if (parts.length > 3) return notFound();
  const rows = await areaRows(context);
  if (!rows) return unavailable();
  const D = summarize(rows);
  if (!parts.length) return renderIndex(D);

  const find = (map, name) => { for (const v of map.values()) if (norm(v.name) === name) return v; return null; };
  const d = find(D, parts[0]); if (!d) return notFound();
  const asked = parseInt(new URL(context.request.url).searchParams.get('page') || '1', 10), pageNo = Number.isFinite(asked) ? asked : 1;
  let res;
  if (parts.length === 1) res = renderDistrict(d);
  else if (parts.length === 2 && TYPES.includes(parts[1])) res = await renderList(d, null, parts[1], pageNo);
  else {
    const u = find(d.upazilas, parts[1]); if (!u) return notFound();
    if (parts.length === 2) res = await renderUpazila(d, u);
    else if (TYPES.includes(parts[2])) res = await renderList(d, u, parts[2], pageNo);
    else return notFound();
  }
  return res || unavailable();
}
