// protishthan.com/sitemap-areas.xml — the district, upazila and "all schools of this upazila" pages, built from the same numbers as the pages themselves.

import { SITE, TYPES, areaUrl, areaRows, summarize } from './_lib/seo.js';

const PREVIEW = 15;      // an upazila page already lists this many of each kind; a separate list page is only worth indexing when it has more

export async function onRequestGet(context) {
  const rows = await areaRows(context);
  if (!rows) return new Response('Temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } });
  const urls = ['/area'];
  for (const d of summarize(rows).values()) {
    urls.push(areaUrl(d.name));
    TYPES.filter(t => d.types[t]).forEach(t => urls.push(areaUrl(d.name, t)));
    for (const u of d.upazilas.values()) {
      urls.push(areaUrl(d.name, u.name));
      TYPES.filter(t => u.types[t] > PREVIEW).forEach(t => urls.push(areaUrl(d.name, u.name, t)));
    }
  }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => '  <url><loc>' + SITE + u + '</loc></url>').join('\n') + '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=21600' } });
}
