// Checks /api/dir without the internet:  node tools/seo/test_dir.js
// The database and the edge cache are replaced by small fakes.
const path = require('path'), assert = require('assert');
const imp = p => import('file://' + path.join(__dirname, '..', '..', p).replace(/\\/g, '/'));

const store = new Map();                       // a fake edge cache: key -> {body, expires}
let now = 1000;                                // fake clock in seconds
globalThis.caches = { default: {
  match: async req => { const e = store.get(req.url); return e && e.expires > now ? new Response(e.body) : undefined; },
  put: async (req, res) => { const m = /max-age=(\d+)/.exec(res.headers.get('Cache-Control') || ''); store.set(req.url, { body: await res.text(), expires: now + (m ? Number(m[1]) : 0) }); },
} };
let dbCalls = 0, dbMode = 'ok', lastUrl = '', lastBody = null;
globalThis.fetch = async (url, init = {}) => {
  dbCalls++; lastUrl = String(url); lastBody = init.body || null;
  if (dbMode === 'down') throw new Error('timeout');
  return new Response(JSON.stringify([{ answer: dbCalls, url: lastUrl }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const call = async (qs) => { const res = await (await import('file://' + path.join(__dirname, '..', '..', 'functions/api/dir.js').replace(/\\/g, '/'))).onRequestGet({ request: new Request('https://protishthan.com/api/dir?' + qs), waitUntil() {} }); return res; };
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const A = o => 'a=' + encodeURIComponent(JSON.stringify(o));

(async () => {
  let r = await call('f=nope'); ok(r.status === 400, 'unknown question is refused');
  r = await call('f=counts&a=%7Bbroken'); ok(r.status === 400, 'broken arguments are refused');

  // counts: one database question for many visitors
  dbCalls = 0; r = await call('f=counts'); ok(r.status === 200 && dbCalls === 1 && r.headers.get('X-Dir') === 'db', 'counts: the first visitor asks the database');
  ok(/rpc\/directory_counts/.test(lastUrl), 'counts: the right function is called');
  for (let i = 0; i < 50; i++) await call('f=counts'); ok(dbCalls === 1, 'counts: 50 more visitors = still one database question');
  r = await call('f=counts'); ok(r.headers.get('X-Dir') === 'edge', 'counts: later answers come from the edge');
  now += 601; await call('f=counts'); ok(dbCalls === 2, 'counts: after 10 minutes one new question');

  // verified list and promo: the same filters as the page used before
  dbCalls = 0; await call('f=verified'); ok(dbCalls === 1 && /listing_submissions/.test(lastUrl) && /status=eq\.approved/.test(lastUrl) && /verification=eq\.verified/.test(lastUrl) && /is_hidden/.test(lastUrl) && /order=created_at\.desc/.test(lastUrl), 'verified: same filters as the page');
  await call('f=promo'); ok(/site_promos/.test(lastUrl) && /slot=eq\.home_popup/.test(lastUrl), 'promo: home popup row');
  dbCalls = 0; await call('f=verifiedlite'); ok(dbCalls === 1 && /select=institution_name,institution_type,district,upazila,desired_slug/.test(lastUrl) && /limit=2000/.test(lastUrl) && /verification=eq\.verified/.test(lastUrl) && /is_hidden/.test(lastUrl), 'verifiedlite: the card page list, five columns, limit 2000');
  r = await call('f=members&' + A({ p_q: 'a', p_limit: 5 })); ok(r.status === 400, 'members: one letter is refused');
  r = await call('f=members&' + A({ p_q: 'স্কুল', p_limit: 99 })); ok(r.status === 400, 'members: limit above 8 is refused');
  dbCalls = 0; await call('f=members&' + A({ p_q: 'স্কুল ', p_limit: 5 })); await call('f=members&' + A({ p_q: 'স্কুল', p_limit: 5 })); ok(dbCalls === 1 && /rpc\/member_name_suggestions/.test(lastUrl) && JSON.parse(lastBody).p_q === 'স্কুল', 'members: same word = one database question, right function');

  // search + browse: arguments are checked and cleaned, the same question shares one answer
  r = await call('f=search&' + A({ p_q: '   ', p_limit: 8 })); ok(r.status === 400, 'search: an empty word is refused');
  r = await call('f=search&' + A({ p_q: 'x'.repeat(101), p_limit: 8 })); ok(r.status === 400, 'search: a 101-letter word is refused');
  r = await call('f=search&' + A({ p_q: 'bani', p_limit: 999 })); ok(r.status === 400, 'search: limit above 20 is refused');
  r = await call('f=search&' + A({ p_q: 123, p_limit: 8 })); ok(r.status === 400, 'search: a number instead of text is refused');
  dbCalls = 0; await call('f=search&' + A({ p_q: 'bani  school', p_limit: 8 })); await call('f=search&' + A({ p_q: ' bani school ', p_limit: 8 })); ok(dbCalls === 1, 'search: extra spaces do not make a new question');
  ok(JSON.parse(lastBody).p_q === 'bani school', 'search: the cleaned word is what the database gets');
  await call('f=search&' + A({ p_q: 'other', p_limit: 8 })); ok(dbCalls === 2, 'search: a different word is a different question');

  r = await call('f=browse&' + A({ p_q: null, p_districts: null, p_upazila: null, p_type: null, p_limit: 30, p_offset: 0 })); ok(r.status === 200, 'browse: the default view');
  ok(JSON.stringify(JSON.parse(lastBody)) === JSON.stringify({ p_q: null, p_districts: null, p_upazila: null, p_type: null, p_limit: 30, p_offset: 0 }), 'browse: all six arguments sent in a fixed order');
  r = await call('f=browse&' + A({ p_limit: 500 })); ok(r.status === 400, 'browse: limit above 50 is refused');
  r = await call('f=browse&' + A({ p_districts: 'Dhaka' })); ok(r.status === 400, 'browse: districts must be a list');
  r = await call('f=browse&' + A({ p_districts: Array(71).fill('x') })); ok(r.status === 400, 'browse: more than 70 districts is refused');
  r = await call('f=browse&' + A({ p_offset: -1 })); ok(r.status === 400, 'browse: negative offset is refused');
  r = await call('f=browse&' + A({ p_q: 'bani', p_extra: 'ignored', p_districts: ['ঢাকা'] })); ok(r.status === 200 && !('p_extra' in JSON.parse(lastBody)), 'browse: unknown arguments are dropped, never forwarded');

  // the database goes down
  dbMode = 'ok'; await call('f=counts'); now += 601; dbMode = 'down';
  r = await call('f=counts'); ok(r.status === 200 && r.headers.get('X-Dir') === 'stale', 'database down: the last good answer is served');
  const callsWhenDown = dbCalls; for (let i = 0; i < 30; i++) await call('f=counts'); ok(dbCalls === callsWhenDown, 'database down: the circuit breaker keeps the next 30 visitors off the database');
  r = await call('f=search&' + A({ p_q: 'never seen before', p_limit: 8 })); ok(r.status === 503, 'database down and nothing saved: a clear "busy" answer (503), not an empty list');
  dbMode = 'ok'; now += 16; r = await call('f=counts'); ok(r.status === 200, 'database back: answers again');

  delete globalThis.caches; dbMode = 'ok'; r = await call('f=promo'); ok(r.status === 200, 'works without any cache too');

  console.log('all ' + n + ' checks passed');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
