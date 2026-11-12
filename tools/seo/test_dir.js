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

  // comments: the public opinion board, one answer per page for everybody for a minute
  r = await call('f=comments&' + A({ p_limit: 99 })); ok(r.status === 400, 'comments: limit above 30 is refused');
  r = await call('f=comments&' + A({ p_limit: 10, p_offset: 5000 })); ok(r.status === 400, 'comments: an offset above 1000 is refused');
  r = await call('f=comments&' + A({ p_limit: '10' })); ok(r.status === 400, 'comments: a text instead of a number is refused');
  dbCalls = 0; r = await call('f=comments'); ok(r.status === 200 && dbCalls === 1 && /rpc\/card_comment_list/.test(lastUrl), 'comments: no arguments = the first page of 10');
  ok(JSON.stringify(JSON.parse(lastBody)) === JSON.stringify({ p_limit: 10, p_offset: 0 }), 'comments: the defaults are sent in a fixed order');
  for (let i = 0; i < 30; i++) await call('f=comments&' + A({ p_limit: 10, p_offset: 0 })); ok(dbCalls === 1, 'comments: 30 more visitors = still one database question');
  await call('f=comments&' + A({ p_limit: 10, p_offset: 10 })); ok(dbCalls === 2, 'comments: the next page is its own question');
  now += 61; await call('f=comments'); ok(dbCalls === 3, 'comments: after a minute one new question');
  // comments, step 2: a kind and a sort go to the feed function; without them the first function is still used, so an old page keeps working
  r = await call('f=comments&' + A({ p_limit: 10, p_offset: 0, p_kind: 'hack', p_sort: 'new' })); ok(r.status === 400, 'comments: an unknown kind is refused');
  r = await call('f=comments&' + A({ p_limit: 10, p_offset: 0, p_kind: null, p_sort: 'random' })); ok(r.status === 400, 'comments: an unknown sort is refused');
  r = await call('f=comments&' + A({ p_limit: 10, p_offset: 0, p_kind: 7, p_sort: 'new' })); ok(r.status === 400, 'comments: a kind that is not text is refused');
  dbCalls = 0; r = await call('f=comments&' + A({ p_limit: 10, p_offset: 0, p_kind: 'idea', p_sort: 'top' })); ok(r.status === 200 && /rpc\/card_comment_feed/.test(lastUrl), 'comments: a kind and a sort go to the feed function');
  ok(JSON.stringify(JSON.parse(lastBody)) === JSON.stringify({ p_limit: 10, p_offset: 0, p_kind: 'idea', p_sort: 'top' }), 'comments: the feed arguments are sent in a fixed order');
  await call('f=comments&' + A({ p_limit: 10, p_offset: 0, p_kind: '', p_sort: 'new' })); ok(JSON.parse(lastBody).p_kind === null && /card_comment_feed/.test(lastUrl), 'comments: an empty kind means all kinds');
  await call('f=comments&' + A({ p_limit: 10, p_offset: 0, p_sort: 'top' })); ok(/card_comment_feed/.test(lastUrl) && JSON.parse(lastBody).p_kind === null, 'comments: a sort alone is enough for the feed');
  now += 61; await call('f=comments&' + A({ p_limit: 10, p_offset: 0 })); ok(/rpc\/card_comment_list/.test(lastUrl) && JSON.stringify(JSON.parse(lastBody)) === JSON.stringify({ p_limit: 10, p_offset: 0 }), 'comments: no kind and no sort = the first function with its two arguments only');
  dbCalls = 0; await call('f=comments&' + A({ p_limit: 10, p_offset: 0, p_kind: 'idea', p_sort: 'top' })); await call('f=comments&' + A({ p_limit: 10, p_offset: 0, p_kind: 'idea', p_sort: 'top' })); ok(dbCalls === 1, 'comments: the same filtered page twice = one database question');
  await call('f=comments&' + A({ p_limit: 10, p_offset: 0, p_kind: 'problem', p_sort: 'top' })); ok(dbCalls === 2, 'comments: another kind is its own question');
  // tutors (/tutor): the search arguments are checked, the same search shares one answer for a minute, and nothing private is asked for
  r = await call('f=tutors&' + A({ p_class: 'c99' })); ok(r.status === 400, 'tutors: an unknown class is refused');
  r = await call('f=tutors&' + A({ p_subject: 'hacking' })); ok(r.status === 400, 'tutors: an unknown subject is refused');
  r = await call('f=tutors&' + A({ p_mode: 'zoom' })); ok(r.status === 400, 'tutors: an unknown mode is refused');
  r = await call('f=tutors&' + A({ p_limit: 31 })); ok(r.status === 400, 'tutors: a limit above 30 is refused');
  r = await call('f=tutors&' + A({ p_offset: 501 })); ok(r.status === 400, 'tutors: an offset above 500 is refused');
  r = await call('f=tutors&' + A({ p_district: 'ঢ'.repeat(41) })); ok(r.status === 400, 'tutors: a district over 40 characters is refused');
  r = await call('f=tutors&' + A({ p_district: 7 })); ok(r.status === 400, 'tutors: a district that is not text is refused');
  dbCalls = 0; r = await call('f=tutors'); ok(r.status === 200 && dbCalls === 1 && /rpc\/tutor_search/.test(lastUrl), 'tutors: no arguments = the first 12, right function');
  ok(JSON.stringify(JSON.parse(lastBody)) === JSON.stringify({ p_district: null, p_upazila: null, p_class: null, p_subject: null, p_mode: null, p_limit: 12, p_offset: 0 }), 'tutors: the defaults are sent in a fixed order');
  dbCalls = 0; const TQ = { p_district: 'বরিশাল', p_upazila: 'বরিশাল সদর', p_class: 'c6-8', p_subject: 'math', p_mode: 'home', p_limit: 12, p_offset: 0 };
  await call('f=tutors&' + A(TQ)); await call('f=tutors&' + A(Object.assign({}, TQ, { p_district: ' বরিশাল ' }))); ok(dbCalls === 1 && JSON.stringify(JSON.parse(lastBody)) === JSON.stringify(TQ), 'tutors: the same search twice (extra spaces) = one database question, arguments in a fixed order');
  r = await call('f=tutors&' + A(Object.assign({}, TQ, { p_extra: 'x', p_phone: '01711223344' }))); ok(r.status === 200 && !('p_extra' in JSON.parse(lastBody)) && !('p_phone' in JSON.parse(lastBody)), 'tutors: unknown arguments are dropped, never forwarded');
  // the results system: filters and sorts are checked from a fixed list, sent on only when used, and shared like any other search
  for (const [k, v] of [['p_gender', 'alien'], ['p_medium', 'x'], ['p_exam', 'x'], ['p_sort', 'cheapest'], ['p_trial', 'yes'], ['p_verified', 1], ['p_pledge', 'true']]) { r = await call('f=tutors&' + A({ [k]: v })); ok(r.status === 400, 'tutors: ' + k + ' = ' + JSON.stringify(v) + ' is refused'); }
  dbCalls = 0; r = await call('f=tutors&' + A({ p_gender: 'female', p_medium: 'english_version', p_exam: 'hsc', p_trial: true, p_verified: true, p_pledge: true, p_sort: 'new', p_limit: 12, p_offset: 12 }));
  ok(r.status === 200 && JSON.stringify(JSON.parse(lastBody)) === JSON.stringify({ p_district: null, p_upazila: null, p_class: null, p_subject: null, p_mode: null, p_limit: 12, p_offset: 12, p_gender: 'female', p_medium: 'english_version', p_exam: 'hsc', p_trial: true, p_verified: true, p_pledge: true, p_sort: 'new' }), 'tutors: every filter and the sort reach the database, in a fixed order');
  await new Promise(res => setTimeout(res, 5)); now += 61;      // the plain search above is still saved: let it expire so this call reaches the database
  dbCalls = 0; await call('f=tutors&' + A({ p_trial: false, p_verified: null, p_pledge: false, p_sort: 'best', p_gender: '', p_limit: 12 }));
  ok(JSON.stringify(JSON.parse(lastBody)) === JSON.stringify({ p_district: null, p_upazila: null, p_class: null, p_subject: null, p_mode: null, p_limit: 12, p_offset: 0 }), 'tutors: a switched-off filter and the default sort are not sent at all (a database that has not had the 2026-12-20 update still answers the plain search)');
  dbCalls = 0; await call('f=tutors&' + A({ p_trial: true, p_limit: 12 })); await call('f=tutors&' + A({ p_limit: 12, p_trial: true, p_sort: 'best' })); ok(dbCalls === 1, 'tutors: the same filtered search twice = one database question');
  await call('f=tutors&' + A({ p_trial: true, p_sort: 'verified', p_limit: 12 })); ok(dbCalls === 2, 'tutors: another sort is its own question');
  r = await call('f=tutorfacets&' + A({ p_mode: 'zoom' })); ok(r.status === 400, 'tutorfacets: an unknown mode is refused');
  r = await call('f=tutorfacets&' + A({ p_district: 'ঢ'.repeat(41) })); ok(r.status === 400, 'tutorfacets: a district over 40 characters is refused');
  r = await call('f=tutorfacets&' + A({ p_upazila: 5 })); ok(r.status === 400, 'tutorfacets: an upazila that is not text is refused');
  dbCalls = 0; r = await call('f=tutorfacets'); ok(r.status === 200 && dbCalls === 1 && /rpc\/tutor_facets/.test(lastUrl) && JSON.stringify(JSON.parse(lastBody)) === JSON.stringify({ p_district: null, p_upazila: null, p_mode: null }), 'tutorfacets: no arguments = the counts for everywhere, its own function, three arguments in a fixed order');
  dbCalls = 0; await call('f=tutorfacets&' + A({ p_district: 'বরিশাল', p_upazila: 'বরিশাল সদর', p_mode: 'home' })); await call('f=tutorfacets&' + A({ p_mode: 'home', p_upazila: ' বরিশাল সদর ', p_district: 'বরিশাল' })); ok(dbCalls === 1 && JSON.stringify(JSON.parse(lastBody)) === JSON.stringify({ p_district: 'বরিশাল', p_upazila: 'বরিশাল সদর', p_mode: 'home' }), 'tutorfacets: the same area twice = one database question, and nothing else is forwarded');
  r = await call('f=tutorfacets&' + A({ p_district: 'বরিশাল', p_phone: '01711223344', p_gender: 'female' })); ok(r.status === 200 && !('p_phone' in JSON.parse(lastBody)) && !('p_gender' in JSON.parse(lastBody)), 'tutorfacets: unknown arguments are dropped, never forwarded');
  dbCalls = 0; r = await call('f=tutorstate'); ok(r.status === 200 && dbCalls === 1 && /rpc\/tutor_state/.test(lastUrl), 'tutorstate: its own function');
  await new Promise(res => setTimeout(res, 5)); now += 61; await call('f=tutorstate'); ok(dbCalls === 2, 'tutorstate: after a minute one new question');

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
