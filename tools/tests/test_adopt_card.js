// The card made before the sign-up goes into the account (member.js adoptLocalCard), run on the REAL member.js with a stand-in browser and database.
//   node tools/tests/test_adopt_card.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'member.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); };

async function run({ local, server, pathname, store: prev, ua, search }) {
  const store = Object.assign({}, prev || {}); if (local !== undefined) store.shikkhito_card_v1 = JSON.stringify(local);
  const upserts = []; let selects = 0;
  const q = {
    select: () => ({ maybeSingle: async () => { selects++; return { data: server === undefined ? null : server, error: null }; } }),
    upsert: async (row) => { upserts.push(row); return { error: null }; }
  };
  const sb = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'a@b.c', user_metadata: {} } } } }), onAuthStateChange: () => {}, signOut: async () => {} },
    rpc: async (n) => n === 'ensure_member' ? { data: { user_id: 'u1', display_name: 'রাফি', email: 'a@b.c' }, error: null } : { data: null, error: { message: 'x' } },
    from: (t) => t === 'member_cards' ? q : { select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }
  };
  const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, appendChild() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, remove() {} });
  const document = { readyState: 'complete', createElement: el, head: el(), body: el(), addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, getElementById: () => null };
  const window = { Protishthan: undefined, addEventListener() {}, matchMedia: () => ({ matches: false }) };
  const ctx = { window, document, supabase: { createClient: () => sb }, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, location: { pathname: pathname || '/', href: 'http://x/', search: '' }, navigator: { userAgent: ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }, URL, history: { replaceState() {} }, console, setTimeout, clearTimeout, URLSearchParams, Promise, JSON, Date, Math, Number, Object, Array, String, Set, Map };
  ctx.window.localStorage = ctx.localStorage; ctx.window.location = ctx.location; ctx.window.document = document;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  await ctx.window.Protishthan.member.ready();
  await new Promise(r => setTimeout(r, 60));          // adoptLocalCard is not awaited by the sign-in
  return { upserts, selects, store };
}

(async () => {
  const card = { name: 'রাফি', badges: [], theme: 'night', edu: { school: { name: 'নটর ডেম স্কুল', slug: 'nd', year: '২০১৬' } }, savedAt: 5000 };

  let r = await run({ local: card });
  ok('a card made before the sign-up goes into the account when the account has none, with its own time, and the dashboard is told once', r.upserts.length === 1 && r.upserts[0].user_id === 'u1' && r.upserts[0].saved_at === 5000 && r.upserts[0].data.edu.school.name === 'নটর ডেম স্কুল' && r.store.el_adopted === '1');

  r = await run({ local: card, server: { saved_at: 9000 } });
  ok('never over a newer card of the account', r.upserts.length === 0 && r.store.el_adopted === undefined);

  r = await run({ local: card, server: { saved_at: 5000 } });
  ok('not when the account card is the same age (nothing to bring)', r.upserts.length === 0);

  r = await run({ local: card, server: { saved_at: 100 } });
  ok('over an older card of the account', r.upserts.length === 1 && r.upserts[0].saved_at === 5000);

  r = await run({ local: { name: '', badges: [], edu: { school: { name: '' } }, savedAt: 7 } });
  ok('an empty card is not kept, and the database is not even asked', r.upserts.length === 0 && r.selects === 0);

  r = await run({});
  ok('no card in the browser: nothing happens', r.upserts.length === 0 && r.selects === 0);

  r = await run({ local: card, pathname: '/card' });
  ok('on the card page it does nothing (that page syncs by itself)', r.upserts.length === 0 && r.selects === 0);

  r = await run({ local: card, pathname: '/card.html' });
  ok('same for /card.html', r.upserts.length === 0);

  r = await run({ local: 'not json' });
  ok('a broken saved card does not break the sign-in', r.upserts.length === 0);

  // one look per card: the second page of the same session asks nothing
  {
    const first = await run({ local: card, server: { saved_at: 9000 } });
    ok('a card already looked at is not looked at again on the next page (the database is asked once per card, not once per page)', first.selects === 1 && first.store.el_adopt_seen === 'u1:5000');
    const again = await run({ local: card, server: { saved_at: 9000 }, store: first.store });
    ok('...the second run, with the memory of the first, asks nothing', again.selects === 0 && again.upserts.length === 0);
    const edited = await run({ local: Object.assign({}, card, { savedAt: 6000 }), server: { saved_at: 9000 }, store: first.store });
    ok('...and a changed card is looked at again', edited.selects === 1);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.message); process.exit(1); });
