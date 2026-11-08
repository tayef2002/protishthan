// protishthan.com/sitemap.xml — the one address given to Google Search Console and Bing Webmaster Tools.
// It points to: the fixed pages (sitemap-pages.xml, a file in the repo), the area pages (sitemap-areas.xml) and the
// institution pages, 5,000 per file (sitemap-institutions/1, /2, ...). The number of institution files follows the database by itself.

import { SITE, rest } from './_lib/seo.js';

const SIZE = 5000;

export async function onRequestGet() {
  const r = await rest('rpc/seo_sitemap_pages', { rpc: { p_size: SIZE }, timeout: 6000 });
  const n = r && Number.isFinite(Number(r.data)) ? Number(r.data) : 0;
  const locs = [SITE + '/sitemap-pages.xml', SITE + '/sitemap-areas.xml'];
  for (let i = 1; i <= n; i++) locs.push(SITE + '/sitemap-institutions/' + i);
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    locs.map(l => '  <sitemap><loc>' + l + '</loc></sitemap>').join('\n') + '\n</sitemapindex>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } });
}
