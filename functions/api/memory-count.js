// /api/memory-count — the number behind "এ পর্যন্ত … টা মেমোরি কার্ড ডাউনলোড হয়েছে" on /memory.
// Same idea as /api/card-count: the page asks this function once when it opens (no polling), the function asks the database at most about six times
// a minute for everybody together, keeps the last good answer for two weeks, and hands it out when the database does not answer.
// Needs migrations/2027-01-01_memory_downloads.sql to have been run; until then the answer is { n: null } and the page shows no number.

import { rest } from '../_lib/seo.js';

const FRESH = 10;                    // seconds a good answer is reused
const LAST_GOOD = 14 * 24 * 3600;    // how long the last good answer is kept as a fallback
const DOWN = 10;                     // after a failure, do not ask the database again for this many seconds
const key = n => new Request('https://protishthan.com/__cache/memory-count-' + n);
const json = (obj, maxAge) => new Response(JSON.stringify(obj), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': maxAge ? 'public, max-age=' + maxAge : 'no-store' } });

export async function onRequestGet(context) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const read = async name => { if (!cache) return null; try { const hit = await cache.match(key(name)); return hit ? await hit.json() : null; } catch (e) { return null; } };
  const write = (name, obj, ttl) => { if (!cache) return; const p = cache.put(key(name), json(obj, ttl)).catch(() => {}); if (context.waitUntil) context.waitUntil(p); };

  const fresh = await read('fresh');
  if (fresh && Number.isFinite(fresh.n)) return json(fresh, 5);

  const down = await read('down');
  if (!down) {
    const r = await rest('rpc/memory_downloads', { rpc: {}, timeout: 2500 });
    const n = r ? Number(r.data) : NaN;
    if (Number.isFinite(n) && n >= 0) {
      write('fresh', { n }, FRESH); write('last', { n, at: Date.now() }, LAST_GOOD);
      return json({ n }, 5);
    }
    write('down', { down: true }, DOWN);
  }
  const last = await read('last');
  if (last && Number.isFinite(last.n)) return json({ n: last.n, stale: true }, 10);
  return json({ n: null }, 10);
}
