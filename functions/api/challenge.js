// /api/challenge — the PUBLIC live numbers of a ব্যাচ চ্যালেঞ্জ, answered from the edge.
// A live room has many screens that all ask the same thing every second or two ("how many are here, how many right answers so far"). Sent straight to the (small) database that would be
// players x screens questions per second. Here the first screen in a data centre asks the database, everybody else in that second gets the saved answer.
//   GET /api/challenge?f=state&id=<uuid>      the counts of one challenge (the same function as the browser's fallback: challenge_state), kept 1 second
//   GET /api/challenge?f=list                 the hub list (challenge_list), kept 15 seconds
// Only these two read-only questions exist. Nothing here writes. The answers carry counts only (no person, no answer of a question): see migrations/2027-01-12_batch_challenge.sql.
// When the database does not answer, the last good answer is handed out (marked stale) for a short while instead of an empty screen.
import { rest } from '../_lib/seo.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LAST_GOOD = 600;       // seconds the last good answer is kept as a fallback

const QUESTIONS = {
  state: { ttl: 1, build: url => { const id = url.searchParams.get('id') || ''; return UUID.test(id) ? { path: 'rpc/challenge_state', rpc: { p_id: id.toLowerCase() } } : null; } },
  list:  { ttl: 15, build: () => ({ path: 'rpc/challenge_list', rpc: { p_limit: 30 } }) }
};
const json = (body, status, extra = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }, extra) });
const keyOf = (kind, id) => new Request('https://protishthan.com/__cache/challenge-' + kind + '/' + encodeURIComponent(id));

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
  if (fresh !== null) return json(fresh, 200, { 'X-Chal': 'edge' });
  const r = await rest(q.path, { rpc: q.rpc, timeout: 3500 });
  if (r && r.data !== undefined && r.data !== null) {
    const body = JSON.stringify(r.data);
    write('fresh', body, spec.ttl); write('last', body, LAST_GOOD);
    return json(body, 200, { 'X-Chal': 'db' });
  }
  const last = await read('last');
  if (last !== null) return json(last, 200, { 'X-Chal': 'stale' });
  return json({ error: 'database busy' }, 503, { 'Retry-After': '2' });
}
