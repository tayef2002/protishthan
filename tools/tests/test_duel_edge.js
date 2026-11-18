// The edge function of the batch duel: /api/duel (the cached public numbers), run with a stand-in database and cache.   node tools/tests/test_duel_edge.js
const fs = require('fs'), path = require('path'), os = require('os');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); };
const root = path.join(__dirname, '..', '..', 'functions');
(async () => {
  // the functions are ES modules inside a folder that is not marked as one: they are copied to a temp folder as .mjs to be run
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chedge-'));
  fs.mkdirSync(path.join(dir, '_lib')); fs.mkdirSync(path.join(dir, 'api'));
  fs.writeFileSync(path.join(dir, '_lib', 'seo.mjs'), fs.readFileSync(path.join(root, '_lib', 'seo.js'), 'utf8'));
  fs.writeFileSync(path.join(dir, 'api', 'duel.mjs'), fs.readFileSync(path.join(root, 'api', 'duel.js'), 'utf8').replace("'../_lib/seo.js'", "'../_lib/seo.mjs'"));
  const url = p => 'file:///' + p.replace(/\\/g, '/');
  const chal = await import(url(path.join(dir, 'api', 'duel.mjs')));

  // a stand-in cache (the edge cache keeps what is put, until its time is up) and database
  let dbCalls = [], dbMode = 'ok', t = 0; const store = new Map();
  globalThis.caches = { default: {
    match: async req => { const e = store.get(req.url); return e && e.until > t ? new Response(e.body) : undefined; },
    put: async (req, res) => { const ma = /max-age=(\d+)/.exec(res.headers.get('Cache-Control') || ''); store.set(req.url, { body: await res.text(), until: t + (ma ? +ma[1] * 1000 : 0) }); } } };
  globalThis.fetch = async (u, init) => { dbCalls.push({ u: String(u), body: init && init.body, method: init && init.method }); if (dbMode === 'down') return new Response('x', { status: 503 }); const id = JSON.parse(init.body).p_id; return new Response(JSON.stringify(String(u).includes('duel_list') ? [{ id: 'a' }] : { found: true, id, players: dbCalls.length, correct: 7 }), { status: 200 }); };
  const get = async (q) => chal.onRequestGet({ request: new Request('https://protishthan.com/api/duel' + q), waitUntil: p => p });
  const ID = '11111111-2222-3333-4444-555555555555';

  let r = await get('?f=state&id=' + ID);
  const first = await r.json();
  ok('a valid question asks the database once, with the lowercase id, and answers with the counts', r.status === 200 && dbCalls.length === 1 && /duel_state/.test(dbCalls[0].u) && JSON.parse(dbCalls[0].body).p_id === ID && first.found === true && first.correct === 7 && r.headers.get('X-Duel') === 'db');
  ok('the answer is never kept by a browser or a proxy (no-store): only the edge keeps it', r.headers.get('Cache-Control') === 'no-store');
  for (let i = 0; i < 9; i++) await get('?f=state&id=' + ID.toUpperCase());
  ok('nine more screens in the same moment: served from the edge, the database was asked only once in all (uppercase ids share the answer)', dbCalls.length === 1);
  t += 16000; r = await get('?f=state&id=' + ID);
  ok('sixteen seconds later (the state is kept 15) the saved answer is old: the database is asked again (the numbers of the day move)', dbCalls.length === 2 && r.headers.get('X-Duel') === 'db');
  dbMode = 'down'; t += 16000; r = await get('?f=state&id=' + ID);
  ok('when the database does not answer, the last good answer is given (marked stale), not an empty screen', r.status === 200 && r.headers.get('X-Duel') === 'stale' && (await r.json()).found === true);
  r = await get('?f=state&id=22222222-2222-3333-4444-555555555555');
  ok('a duel never seen before while the database is down: 503 with a retry hint (never a made-up answer)', r.status === 503 && r.headers.get('Retry-After') === '2');
  dbMode = 'ok';
  ok('bad questions are refused without touching the database: an unknown f, no id, a bad id, an id with extra text, an sql-looking id', await (async () => { const n = dbCalls.length; const res = await Promise.all([get('?f=nope'), get('?f=state'), get('?f=state&id=abc'), get('?f=state&id=' + ID + 'x'), get("?f=state&id=1';drop table x;--"), get('')]); return res.every(x => x.status === 400) && dbCalls.length === n; })());
  t += 30000; dbCalls = []; r = await get('?f=list'); const l1 = await r.json(); await get('?f=list'); t += 10000; await get('?f=list');
  ok('the hub list is kept 30 seconds: two quick asks and one after 10 s cost one database question; the list question is fixed (no argument of the visitor reaches the database)', dbCalls.length === 1 && /duel_list/.test(dbCalls[0].u) && JSON.parse(dbCalls[0].body).p_limit === 30 && Array.isArray(l1));
  const src = fs.readFileSync(path.join(root, 'api', 'duel.js'), 'utf8').replace(/\/\/.*$/gm, '');
  ok('only the two read-only functions are reachable (no write, nothing else)', ['duel_state', 'duel_list'].every(n => src.includes(n)) && !/duel_(create|accept|cancel|me|mine|side|busy|rows)/.test(src));
  ok('the state is kept 15 seconds and the list 30 (the numbers of a day change slowly, so a duel page costs the free quota little)', /state: \{ ttl: 15/.test(src) && /list:\s+\{ ttl: 30/.test(src));
  ok('the function is inside the routes that Cloudflare runs (/api/*) and are not blocked by the middleware', /"\/api\/\*"/.test(fs.readFileSync(path.join(__dirname, '..', '..', '_routes.json'), 'utf8')) && !/api/.test((fs.readFileSync(path.join(root, '_middleware.js'), 'utf8').match(/const NOT_THE_WEBSITE = [^\n]+/) || [''])[0]));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.stack || e.message); process.exit(1); });
