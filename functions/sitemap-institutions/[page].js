// protishthan.com/sitemap-institutions/<n> — the n-th group of about 4,500 institution pages (only approved, not hidden).
// The list of address names comes from the database function seo_sitemap_slugs (migrations/2026-12-13_seo_sitemaps.sql).

import { SITE, rest } from '../_lib/seo.js';

const SIZE = 40000;   // width of the PRN number range one file covers. PRN numbers are spread out (about 1 in 9 is used), so this is roughly 4,500 pages per file

export async function onRequestGet({ params }) {
  const n = parseInt(Array.isArray(params.page) ? params.page[0] : params.page, 10);
  if (!Number.isInteger(n) || n < 1 || n > 1000) return new Response('Not found', { status: 404 });
  const r = await rest('rpc/seo_sitemap_slugs', { rpc: { p_page: n, p_size: SIZE }, timeout: 9000 });
  if (!r) return new Response('Temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } });
  const slugs = String(r.data || '').split('\n').filter(Boolean);
  if (!slugs.length) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    slugs.map(s => '  <url><loc>' + SITE + '/institution-detail?slug=' + encodeURIComponent(s) + '</loc></url>').join('\n') + '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=21600' } });
}
