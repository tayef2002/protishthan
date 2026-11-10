// Checks /api/card-count without the internet:  node tools/seo/test_card_count.js
// The database and the edge cache are replaced by small fakes.
const path = require('path'), assert = require('assert');
const imp = p => import('file://' + path.join(__dirname, '..', '..', p).replace(/\\/g, '/'));

const store = new Map();                       // a fake edge cache: key -> {body, expires}
let now = 1000;                                // fake clock in seconds
globalThis.caches = { default: {
  match: async req => { const e = store.get(req.url); return e && e.expires > now ? new Response(e.body) : undefined; },
  put: async (req, res) => { const m = /max-age=(\d+)/.exec(res.headers.get('Cache-Control') || ''); store.set(req.url, { body: await res.text(), expires: now + (m ? Number(m[1]) : 0) }); },
} };
let dbCalls = 0, dbMode = 'ok', dbNumber = 119;
globalThis.fetch = async (url, init = {}) => {
  dbCalls++;
  if (dbMode === 'down') throw new Error('timeout');
  return new Response(JSON.stringify(dbNumber), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const ctx = () => ({ request: new Request('https://protishthan.com/api/card-count'), waitUntil() {} });
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

(async () => {
  const { onRequestGet } = await imp('functions/api/card-count.js');
  const get = async () => (await onRequestGet(ctx())).json();

  let j = await get(); ok(j.n === 119 && !j.stale && dbCalls === 1, 'first call asks the database');
  dbNumber = 125; j = await get(); ok(j.n === 119 && dbCalls === 1, 'within 30 s: the same answer, the database is not asked again');
  for (let i = 0; i < 50; i++) await get(); ok(dbCalls === 1, '51 visitors in a row = still one database question');

  now += 31; j = await get(); ok(j.n === 125 && dbCalls === 2, 'after 30 s: one new question, the new number');

  dbMode = 'down'; now += 31; j = await get();
  ok(j.n === 125 && j.stale === true, 'database down: the last good number, marked stale');
  const callsWhenDown = dbCalls;
  for (let i = 0; i < 30; i++) await get(); ok(dbCalls === callsWhenDown, 'database down: the next 30 visitors do not hit it again (negative cache)');

  now += 21; await get(); ok(dbCalls === callsWhenDown + 1, 'after 20 s: it tries the database once more');
  dbMode = 'ok'; dbNumber = 130; now += 21; j = await get(); ok(j.n === 130 && !j.stale, 'database back: fresh number again');

  store.clear(); dbMode = 'down'; now += 100; j = await get(); ok(j.n === 125 && j.floor === true, 'never saw a number and database down: the known minimum (125), marked as a floor');
  delete globalThis.caches; dbMode = 'ok'; j = await get(); ok(j.n === 130, 'works without any cache too');

  console.log('all ' + n + ' checks passed');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
