// /api/duel — the PUBLIC numbers of a ব্যাচ ডুয়েল (the daily quiz of two batches), answered from the edge.
// A duel page is read by many members all day ("how are the two batches doing?"). Sent straight to the (small) database that would be one question per screen per refresh. Here the first screen in a data centre asks, everybody else gets the saved answer.
//   GET /api/duel?f=state&id=<uuid>      the counts of one duel (duel_state), kept 15 seconds
//   GET /api/duel?f=list                 the hub list (duel_list), kept 30 seconds
// Only these two read-only questions exist; nothing here writes. Counts only (no person): see migrations/2027-01-16_batch_duel.sql. When the database does not answer, the last good answer is given (marked stale).
import { rest } from '../_lib/seo.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LAST_GOOD = 600;       // seconds the last good answer is kept as a fallback

const QUESTIONS = {
  state: { ttl: 15, build: url => { const id = url.searchParams.get('id') || ''; return UUID.test(id) ? { path: 'rpc/duel_state', rpc: { p_id: id.toLowerCase() } } : null; } },
  list:  { ttl: 30, build: () => ({ path: 'rpc/duel_list', rpc: { p_limit: 30 } }) }
};
const json = (body, status, extra = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }, extra) });
const keyOf = (kind, id) => new Request('https://protishthan.com/__cache/duel-' + kind + '/' + encodeURIComponent(id));

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const f = url.searchParams.get('f'), spec = Object.prototype.hasOwnProperty.call(QUESTIONS, f) ? QUESTIONS[f] : null;
  if (!spec) return json({ error: 'unknown question' }, 400);
  const q = spec.build(url);
  if (!q) return json({ error: 'bad arguments' }, 400);
  const id = f + ':' + JSON.stringify(q.rpc);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const read = async kind => { if (!cache) return null; try { const hit = await cache.match(keyOf(kind, id)); return hit ? await hit.text() : null; } catch (e) { return null; } };
  const write = (kind, body, ttl) => { if (!cache) return; const p = cache.put(keyOf(kind, id), new Response(body, { headers: { 'Cache-Control': 'public, max-age=' + ttl } })).catch(() => {}); if (context.waitUntil) context.waitUntil(p); };

  const fresh = await read('fresh');
  if (fresh !== null) return json(fresh, 200, { 'X-Duel': 'edge' });
  const r = await rest(q.path, { rpc: q.rpc, timeout: 3500 });
  if (r && r.data !== undefined && r.data !== null) {
    const body = JSON.stringify(r.data);
    write('fresh', body, spec.ttl); write('last', body, LAST_GOOD);
    return json(body, 200, { 'X-Duel': 'db' });
  }
  const last = await read('last');
  if (last !== null) return json(last, 200, { 'X-Duel': 'stale' });
  return json({ error: 'database busy' }, 503, { 'Retry-After': '2' });
}
