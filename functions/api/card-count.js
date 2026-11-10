// /api/card-count — the number behind "এ পর্যন্ত … টা শিক্ষিত কার্ড ডাউনলোড হয়েছে".
// Before: every open card page asked the database every 20 seconds. With many visitors at once (a news post, an ad) that is a lot of questions for a small
// free database, and when the database was slow the counter simply vanished.
// Now: this function asks the database at most about six times a minute for everybody together, keeps the last good answer for two weeks, and when the
// database does not answer it hands out that last good answer. The page (card.html) also keeps the last number in the visitor's own browser.
// The "counted downloads" number only; the 2,000 base for the days before the counter existed is added by the page (DL_BEFORE_COUNTER).

import { rest } from '../_lib/seo.js';

const FRESH = 10;                    // seconds a good answer is reused (the page asks once a minute, so the number is at most about 70 s behind; a visitor's own download updates it at once)
const LAST_GOOD = 14 * 24 * 3600;    // how long the last good answer is kept as a fallback
const FLOOR = 373;                  // counted downloads read from the database (card_stats) on 2026-11-10. The number only goes up, so this is a true minimum for the very first answer after a cold start while the database is down
const DOWN = 10;                     // after a failure, do not ask the database again for this many seconds (short, so a recovered database is noticed within seconds)
const key = n => new Request('https://protishthan.com/__cache/card-count-' + n);
const json = (obj, maxAge, extra = {}) => new Response(JSON.stringify(obj), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': maxAge ? 'public, max-age=' + maxAge : 'no-store', ...extra } });

export async function onRequestGet(context) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const read = async name => { if (!cache) return null; try { const hit = await cache.match(key(name)); return hit ? await hit.json() : null; } catch (e) { return null; } };
  const write = (name, obj, ttl) => { if (!cache) return; const p = cache.put(key(name), json(obj, ttl)).catch(() => {}); if (context.waitUntil) context.waitUntil(p); };

  const fresh = await read('fresh');
  if (fresh && Number.isFinite(fresh.n)) return json(fresh, 5);

  const down = await read('down');
  if (!down) {
    const r = await rest('rpc/card_downloads', { rpc: {}, timeout: 2500 });
    const n = r ? Number(r.data) : NaN;
    if (Number.isFinite(n) && n >= 0) {
      write('fresh', { n }, FRESH); write('last', { n, at: Date.now() }, LAST_GOOD);
      return json({ n }, 5);
    }
    write('down', { down: true }, DOWN);
  }
  const last = await read('last');                           // the database is not answering: the last good number, marked as old
  if (last && Number.isFinite(last.n)) return json({ n: last.n, stale: true }, 10);
  return json({ n: FLOOR, stale: true, floor: true }, 10);    // nothing cached yet: the known minimum (the page keeps the bigger of this and its own saved number)
}
