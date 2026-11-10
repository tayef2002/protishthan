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
  dbNumber = 125; j = await get(); ok(j.n === 119 && dbCalls === 1, 'within 10 s: the same answer, the database is not asked again');
  for (let i = 0; i < 50; i++) await get(); ok(dbCalls === 1, '51 visitors in a row = still one database question');

  now += 11; j = await get(); ok(j.n === 125 && dbCalls === 2, 'after 10 s: one new question, the new number');

  dbMode = 'down'; now += 31; j = await get();
  ok(j.n === 125 && j.stale === true, 'database down: the last good number, marked stale');
  const callsWhenDown = dbCalls;
  for (let i = 0; i < 30; i++) await get(); ok(dbCalls === callsWhenDown, 'database down: the next 30 visitors do not hit it again (negative cache)');

  now += 16; await get(); ok(dbCalls === callsWhenDown + 1, 'after 16 s: it tries the database once more');
  dbMode = 'ok'; dbNumber = 130; now += 16; j = await get(); ok(j.n === 130 && !j.stale, 'database back: fresh number again');


  // the shared circuit breaker used by every server page
  { const keepFetch = globalThis.fetch; const { rest } = await imp('functions/_lib/seo.js'); store.clear(); dbMode = 'down'; now += 1000; dbCalls = 0;
    ok((await rest('listing_submissions?x=1')) === null && dbCalls === 1, 'breaker: a failing database call returns null (one attempt)');
    for (let i = 0; i < 40; i++) await rest('listing_submissions?x=' + i); ok(dbCalls === 1, 'breaker: the next 40 calls do not touch the database');
    now += 16; await rest('listing_submissions?x=again'); ok(dbCalls === 2, 'breaker: after 15 s one new attempt');
    dbMode = 'ok'; now += 16; const r = await rest('listing_submissions?x=ok'); ok(r && r.data === 130 && dbCalls === 3, 'breaker: database back -> normal answers again');
    globalThis.fetch = async () => new Response('missing', { status: 404 }); now += 100; dbCalls = 0;
    ok((await rest('nope')) === null, 'a 404 is not a failure of the database: it answers null without opening the breaker');
    let touched = 0; globalThis.fetch = async () => { touched++; return new Response('[]', { status: 200 }); }; await rest('x'); await rest('y'); ok(touched === 2, 'a 404 does not open the breaker');
    globalThis.fetch = keepFetch; store.clear();
  }

  store.clear(); dbMode = 'down'; now += 100; j = await get(); ok(j.n === 228 && j.floor === true, 'never saw a number and database down: the known minimum (228), marked as a floor');
  delete globalThis.caches; dbMode = 'ok'; j = await get(); ok(j.n === 130, 'works without any cache too');

  console.log('all ' + n + ' checks passed');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
