// protishthan.com/institution-detail?slug=<slug> — one institution's page.
// The page itself is the static /institution-detail.html, filled in by the browser from the database. That is fine for people, but
// search engines, WhatsApp and Facebook previews read the first HTML they get. This function puts the real name, place and facts into that first
// HTML: <title>, description, canonical address, Open Graph tags, structured data (schema.org), a short readable summary,
// and links to neighbouring institutions and to the district / upazila pages. Only public listing columns are read — never a phone or an email.

import { SITE, rest, cached, esc, clip, bn, toInt, TYPE_LD, SOURCE_NAME, htmlResponse, isBot, areaUrl } from './_lib/seo.js';

const COLS = 'id,institution_name,name_en,institution_type,district,upazila,address_note,founding_year,student_count,teacher_count,ownership,gender_type,medium,class_range,description,admission_status,source,source_id,verification,prn_number,facebook_link,is_hidden,claimed_at';

const STYLE = '<style>#loadingState .skel-cover,#loadingState .skel-wrap{display:none}' +
  '.ssr{max-width:860px;margin:0 auto;padding:96px 20px 48px;font-family:"Hind Siliguri","Inter",sans-serif;color:#0F172A;line-height:1.7}' +
  '.ssr .cr{font-size:14px;color:#64748B;margin-bottom:10px}.ssr .cr a{color:#1A56DB;font-weight:600}' +
  '.ssr h1{font-size:clamp(24px,4.4vw,34px);line-height:1.3;font-weight:800;letter-spacing:-.3px}.ssr .en{color:#64748B;font-size:16px;margin-top:2px}' +
  '.ssr p{margin-top:12px;color:#334155;font-size:17px}.ssr ul{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}' +
  '.ssr li{padding:6px 14px;border:1px solid #E2E8F0;border-radius:999px;background:#fff;font-size:15px;font-weight:600}' +
  '.ssr h2{margin-top:28px;font-size:19px;font-weight:800}.ssr .nb{display:grid;gap:8px;margin-top:10px}' +
  '.ssr .nb a{display:block;padding:11px 16px;border:1px solid #E2E8F0;border-radius:12px;background:#fff;font-weight:600;color:#0F172A;text-decoration:none}</style>';

function factsOf(r) {
  const f = [];
  if (r.institution_type) f.push(r.institution_type);
  if (r.ownership) f.push(r.ownership);
  if (r.gender_type) f.push(r.gender_type);
  if (r.medium) f.push(r.medium + ' মাধ্যম');
  if (r.class_range) f.push('শ্রেণি: ' + r.class_range);
  const founded = toInt(r.founding_year); if (founded > 1000) f.push(bn(founded) + ' সালে প্রতিষ্ঠিত');
  const st = toInt(r.student_count), te = toInt(r.teacher_count);
  if (st) f.push('শিক্ষার্থী ' + bn(st) + ' জন'); if (te) f.push('শিক্ষক ' + bn(te) + ' জন');
  if (/^\d{4,}$/.test(r.source_id || '')) f.push('EIIN ' + bn(r.source_id));
  if (r.admission_status === 'খোলা') f.push('ভর্তি চলছে');
  return f;
}

function buildHead(r, slug, near) {
  const canon = SITE + '/institution-detail?slug=' + encodeURIComponent(slug);
  const name = String(r.institution_name || 'শিক্ষা প্রতিষ্ঠান').trim();
  const en = r.name_en && r.name_en.trim().toLowerCase() !== name.toLowerCase() ? r.name_en.trim() : '';
  const loc = [r.upazila, r.district].filter(Boolean).join(', ');
  const type = r.institution_type || 'শিক্ষা প্রতিষ্ঠান';
  const title = name + ' — ' + type + (loc ? ', ' + loc : '') + ' | Protishthan';
  const facts = factsOf(r);
  const descParts = [name + (en ? ' (' + en + ')' : '') + (loc ? ', ' + loc : '') + '।', [r.ownership, type].filter(Boolean).join(' ') + '।'];
  const nums = facts.filter(x => /^(শিক্ষার্থী|শিক্ষক|EIIN|\S+ সালে)/.test(x)); if (nums.length) descParts.push(nums.join(', ') + '।');
  if (r.description) descParts.push(clip(r.description, 90));
  descParts.push('ঠিকানা, ভর্তি ও যোগাযোগের তথ্য Protishthan-এ।');
  const desc = clip(descParts.join(' '), 200);
  const robots = r.is_hidden ? 'noindex,follow' : 'index,follow,max-image-preview:large';

  const crumbs = [{ name: 'তথ্যভান্ডার', url: SITE + '/' }];
  if (r.district) crumbs.push({ name: r.district, url: SITE + areaUrl(r.district) });
  if (r.district && r.upazila) crumbs.push({ name: r.upazila, url: SITE + areaUrl(r.district, r.upazila) });
  crumbs.push({ name, url: canon });
  const org = {
    '@type': TYPE_LD[r.institution_type] || 'EducationalOrganization', '@id': canon + '#org', name, url: canon,
    address: { '@type': 'PostalAddress', addressLocality: r.upazila || undefined, addressRegion: r.district || undefined, addressCountry: 'BD', streetAddress: r.address_note || undefined },
  };
  if (en) org.alternateName = en;
  if (toInt(r.founding_year) > 1000) org.foundingDate = String(toInt(r.founding_year));
  if (r.description) org.description = clip(r.description, 300);
  if (r.prn_number) org.identifier = 'PRN-' + String(r.prn_number).padStart(6, '0');
  if (/^https?:\/\//i.test(r.facebook_link || '')) org.sameAs = [r.facebook_link];
  const ld = { '@context': 'https://schema.org', '@graph': [org, { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url })) }] };

  const head = '<title>' + esc(title) + '</title>\n<meta name="description" content="' + esc(desc) + '">\n<meta name="robots" content="' + robots + '">\n' +
    '<link rel="canonical" href="' + esc(canon) + '">\n<meta property="og:type" content="website"><meta property="og:site_name" content="Protishthan"><meta property="og:locale" content="bn_BD">\n' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '"><meta property="og:url" content="' + esc(canon) + '">\n' +
    '<meta property="og:image" content="' + SITE + '/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">\n' +
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + esc(title) + '"><meta name="twitter:description" content="' + esc(desc) + '">\n' +
    '<script type="application/ld+json" id="ld-ssr">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>\n' + STYLE;

  // the readable summary that stays on screen until the browser has filled in the full page
  const src = r.source ? (SOURCE_NAME[r.source] || r.source) : '';
  const unverified = r.source && r.verification === 'unverified';
  const crumbHtml = '<a href="/">তথ্যভান্ডার</a>' + (r.district ? ' › <a href="' + areaUrl(r.district) + '">' + esc(r.district) + '</a>' : '') +
    (r.district && r.upazila ? ' › <a href="' + areaUrl(r.district, r.upazila) + '">' + esc(r.upazila) + '</a>' : '');
  const nearHtml = near.length ? '<h2>' + esc(r.upazila || r.district || 'এলাকার') + '-এর আরও ' + esc(type) + '</h2><div class="nb">' +
    near.map(x => '<a href="/institution-detail?slug=' + encodeURIComponent(x.desired_slug) + '">' + esc(x.institution_name) + '</a>').join('') + '</div>' : '';
  const more = r.district ? '<p>' + (r.upazila ? '<a href="' + areaUrl(r.district, r.upazila) + '">' + esc(r.upazila) + '-এর সব প্রতিষ্ঠান</a> · ' : '') +
    '<a href="' + areaUrl(r.district, r.institution_type) + '">' + esc(r.district) + ' জেলার সব ' + esc(type) + '</a></p>' : '';
  const body = '<div class="ssr"><div class="cr">' + crumbHtml + '</div><h1>' + esc(name) + '</h1>' + (en ? '<div class="en">' + esc(en) + '</div>' : '') +
    '<p>' + esc(name) + (loc ? ' — ' + esc(loc) + '-এর একটি ' : ' — একটি ') + esc([r.ownership, type].filter(Boolean).join(' ')) + '।' +
    (unverified ? ' এই তথ্য ' + esc(src) + ' থেকে নেওয়া, প্রতিষ্ঠান এখনো নিজে যাচাই করেনি।' : '') + '</p>' +
    (facts.length ? '<ul>' + facts.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') + nearHtml + more + '</div>';
  return { head, body };
}

const stripOld = h => h
  .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
  .replace(/<meta\s+(?:property|name)="(?:og:[^"]*|twitter:[^"]*|description|robots)"[^>]*>\s*/gi, '');

function build(html, parts, status) {
  let out = stripOld(html).replace('</head>', parts.head + '\n</head>').replace(/<html([^>]*)>/i, (m, a) => '<html' + a + ' data-ssr="1">');
  out = out.replace('<!--ssr-->', parts.body);
  return htmlResponse(out, status, status === 200 ? 'public, max-age=300, s-maxage=3600' : 'no-store');
}

// whatever goes wrong here, people still get the normal page (the browser fills it in by itself, as it always did)
export async function onRequestGet(context) {
  try { return await cached(context, () => handle(context)); }
  catch (e) { return context.env.ASSETS.fetch(new Request(new URL('/institution-detail', context.request.url))); }
}

async function handle(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = (url.searchParams.get('slug') || '').trim();
  const asset = await env.ASSETS.fetch(new Request(new URL('/institution-detail', request.url)));
  if (!asset.ok) return asset;
  const html = await asset.text();

  const gone = () => build(html, { head: '<title>প্রতিষ্ঠান পাওয়া যায়নি | Protishthan</title>\n<meta name="robots" content="noindex,nofollow">', body: '' }, 404);
  if (!slug || slug.length > 120 || /[\u0000-\u001f]/.test(slug)) return gone();

  const q = await rest('listing_submissions?desired_slug=eq.' + encodeURIComponent(slug) + '&status=eq.approved&select=' + COLS + '&limit=1');
  if (!q) {                                   // the database did not answer: crawlers should come back later, people get the normal page
    if (isBot(request)) return new Response('Temporarily unavailable', { status: 503, headers: { 'Retry-After': '120', 'Cache-Control': 'no-store' } });
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  const r = q.data && q.data[0];
  if (!r) return gone();

  // neighbours: the next institutions of the same kind in the same upazila. Taking them by position (next ids, wrapping round) means every page both links out and is linked to.
  let near = [];
  if (r.district && r.upazila && r.institution_type) {
    const base = 'listing_submissions?status=eq.approved&is_hidden=not.is.true&district=eq.' + encodeURIComponent(r.district) + '&upazila=eq.' + encodeURIComponent(r.upazila) +
      '&institution_type=eq.' + encodeURIComponent(r.institution_type) + '&select=institution_name,desired_slug&order=id';
    const a = await rest(base + '&id=gt.' + r.id + '&limit=10');
    near = (a && a.data) || [];
    if (near.length < 10) { const b = await rest(base + '&id=lt.' + r.id + '&limit=' + (10 - near.length)); if (b && b.data) near = near.concat(b.data); }
  }
  return build(html, buildHead(r, slug, near), 200);
}
