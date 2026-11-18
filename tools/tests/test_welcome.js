// The welcome after sign-up (member.js): shown once to a NEW member, never in front of what the sign-in was for, never claims a rank.
// Runs the REAL member.js with a stand-in browser and database.   node tools/tests/test_welcome.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'member.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); };
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const hoursAgo = h => new Date(Date.now() - h * 3600e3).toISOString();

async function run({ me, store: prev, pathname, myinst, session = true }) {
  const store = Object.assign({}, prev || {}), tracked = [], created = [], opened = []; let href = null;
  const user = { id: 'u1', email: 'a@b.c', user_metadata: {} };
  const sb = {
    auth: { getSession: async () => ({ data: { session: session ? { user } : null } }), onAuthStateChange: () => {}, signOut: async () => {}, signInWithOAuth: async () => ({ error: null }) },
    rpc: async (n) => n === 'ensure_member' ? { data: Object.assign({ user_id: 'u1', display_name: 'রাফি করিম', email: 'a@b.c', member_no: 70484, created_at: hoursAgo(0.01) }, me || {}), error: null } : { data: null, error: { message: 'x' } },
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }), upsert: async () => ({ error: null }) })
  };
  const mkel = () => { const cls = new Set(), h = {}; const e = { style: {}, hidden: false, textContent: '', _html: '', disabled: false, id: '', className: '', parentNode: null,
    classList: { add: c => cls.add(c), remove: c => cls.delete(c), toggle: (c, on) => { (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c); }, contains: c => cls.has(c) },
    appendChild(c){ c.parentNode = e; created.push(c); }, removeChild(c){ c._removed = true; c.parentNode = null; }, addEventListener: (t, f) => { h[t] = f; }, _h: h, setAttribute() {}, remove() {}, select() {},
    querySelector: () => mkel(),
    querySelectorAll(sel){ if(sel !== '[data-k]') return []; if(!e._btns) e._btns = [...String(e._html).matchAll(/data-k="(\w+)"/g)].map(m => { const b = mkel(); b._k = m[1]; b.getAttribute = () => m[1]; return b; }); return e._btns; } };
    Object.defineProperty(e, 'innerHTML', { get: () => e._html, set: v => { e._html = v; } }); return e; };
  const body = mkel(), headEl = mkel();
  const document = { readyState: 'complete', hidden: false, body, head: headEl, createElement: () => { const e = mkel(); created.push(e); return e; }, addEventListener() {}, removeEventListener() {}, querySelectorAll: () => [], querySelector: () => null,
    getElementById: id => id === 'mbWelcome' ? (created.find(e => e.id === 'mbWelcome' && !e._removed) || null) : mkel(), execCommand: () => true };
  const loc = { pathname: pathname || '/', search: '', origin: 'https://protishthan.com' }; Object.defineProperty(loc, 'href', { get: () => 'https://protishthan.com' + loc.pathname, set: v => { href = v; }, configurable: true });
  const timers = [];
  const window = { addEventListener() {}, matchMedia: () => ({ matches: false }), track: (n, p) => tracked.push([n, p || {}]) };
  if(myinst) window.MyInst = { open: o => opened.push(o) };
  const ctx = { window, document, supabase: { createClient: () => sb }, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: loc, navigator: { userAgent: CHROME, clipboard: { writeText: async () => {} } }, URL, URLSearchParams, history: { replaceState() {} }, fetch: async () => ({ json: async () => ({}) }), console, Promise, JSON, Date, Math, Number, Object, Array, String, Set, Map,
    setTimeout: (f, ms) => { timers.push([f, ms]); return timers.length; }, clearTimeout() {} };
  window.localStorage = ctx.localStorage; window.location = loc; window.document = document; window.navigator = ctx.navigator;
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const M = ctx.window.Protishthan.member; await M.ready(); await new Promise(r => setImmediate(r));
  const fire = async () => { for (const t of timers.filter(x => x[1] === 900)) await t[0](); await new Promise(r => setImmediate(r)); };
  const welcome = () => created.find(e => e.id === 'mbWelcome' && !e._removed);
  const toast = () => created.find(e => e.className === 'mb-toast');
  const btn = k => welcome().querySelectorAll('[data-k]').find(b => b._k === k);
  return { M, store, tracked, fire, welcome, toast, opened, btn, get href() { return href; }, created, window };
}

(async () => {
  // ---- a new member, nothing pending
  let r = await run({});
  ok('nothing shows at the moment of the sign-in itself (it waits a short moment so the page can settle)', !r.welcome() && r.created.length >= 0);
  await r.fire();
  const w = r.welcome(); const h = w && w.innerHTML;
  ok('a NEW member sees the welcome: the first name, that the account is made, the member number', !!w && h.includes('স্বাগতম, রাফি!') && h.includes('অ্যাকাউন্ট তৈরি হয়ে গেছে') && h.includes('সদস্য নম্বর <b>৭০৪৮৪</b>'), h);
  ok('the member number is said as an identity number, never as a rank ("Nth member" is not a true statement: the numbers are random and unique)', !/তম সদস্য|নম্বর সদস্য|সদস্য নম্বর [^<]*তম/.test(h) && !/১ম|২য়|৩য়/.test(h));
  ok('three optional steps: where I study now, my card (a person with no card is offered to make one), finding the batchmates, and a "later"; it says everything is optional', ['where', 'card', 'batch', 'later'].every(k => h.includes('data-k="' + k + '"')) && h.includes('সবটাই ঐচ্ছিক') && h.includes('href="card.html"'));
  ok('it says what is kept (name and email only) and links the privacy page', h.includes('শুধু আপনার নাম আর ইমেইল রাখি') && h.includes('privacy.html'));
  ok('no money word anywhere in it', !/আয়|টাকা|কমিশন|income|earn/i.test(h));
  ok('it is remembered for this member in this browser, and tracked', r.store.prot_wel_u1 === '1' && r.tracked.some(x => x[0] === 'welcome_shown'));

  // ---- once only
  const again = await run({ store: r.store }); await again.fire();
  ok('the same member in the same browser is never welcomed twice (a reload, the next page)', !again.welcome() && !again.toast());

  // ---- not for an old member
  r = await run({ me: { created_at: hoursAgo(72) } }); await r.fire();
  ok('a member who signed up days ago (just signing in again) gets no welcome', !r.welcome() && !r.toast() && r.store.prot_wel_u1 === undefined);
  r = await run({ me: { created_at: hoursAgo(-2) } }); await r.fire();
  ok('a member row dated in the future (a wrong clock) is not taken for a new one', !r.welcome());
  r = await run({ me: { created_at: undefined } }); await r.fire();
  ok('a member row without a date gets no welcome', !r.welcome());

  // ---- what the sign-in was for goes on without being covered
  r = await run({ store: { mi_intent: JSON.stringify({ slug: 'x', name: 'X', t: Date.now() - 60e3 }) } }); await r.fire();
  ok('when the batch / institution sheet is coming back, only a one-line toast is shown (the sheet is not covered)', !r.welcome() && !!r.toast() && r.toast().textContent.includes('স্বাগতম, রাফি!') && r.tracked.some(x => x[0] === 'welcome_toast'));
  r = await run({ store: { prot_pending_save: JSON.stringify({ id: 'abc', path: '/' }) } }); await r.fire();
  ok('when a "save this institution" was waiting, only the toast is shown', !r.welcome() && !!r.toast());
  r = await run({ store: { mi_intent: JSON.stringify({ slug: 'x', t: Date.now() - 3 * 3600e3 }) } }); await r.fire();
  ok('an old unfinished intent (hours ago) does not stop the welcome', !!r.welcome());

  // ---- the card that came along
  r = await run({ store: { el_adopted: '1' } }); await r.fire();
  ok('a card made before the sign-up that has come into the account is mentioned, and the card step becomes "আমার শিক্ষাজীবন সাজাই" (the list page)', r.welcome().innerHTML.includes('শিক্ষিত কার্ড অ্যাকাউন্টে সেভ হয়ে গেছে') && r.welcome().innerHTML.includes('href="member.html#life"') && !r.welcome().innerHTML.includes('href="card.html"'));
  r = await run({ pathname: '/card' }); await r.fire();
  ok('on the card page the "make a card" step is left out (the person is there)', !r.welcome().innerHTML.includes('data-k="card"') && r.welcome().innerHTML.includes('data-k="where"'));

  // ---- the steps
  r = await run({ myinst: true }); await r.fire();
  await r.btn('where')._h.click({ preventDefault() {} }); ok('"where I study" opens the institution picker of my-institution (mode current) and closes the welcome', r.opened.length === 1 && r.opened[0].mode === 'current' && !r.welcome());
  r = await run({ myinst: true }); await r.fire(); await r.btn('batch')._h.click({ preventDefault() {} });
  ok('"batchmates" opens the batch picker (mode batch)', r.opened.length === 1 && r.opened[0].mode === 'batch');
  r = await run({}); await r.fire(); await r.btn('where')._h.click({ preventDefault() {} });
  ok('where that sheet is not loaded, the step goes to the list page instead (nothing is lost)', r.href === 'member.html#life' && !r.welcome());
  r = await run({}); await r.fire(); await r.btn('later')._h.click({});
  ok('"পরে দেখব" just closes it, tracked', !r.welcome() && r.tracked.some(x => x[0] === 'welcome_go' && x[1].k === 'later'));
  r = await run({ myinst: true }); await r.fire();
  ok('the welcome never opens twice at once', (() => { r.M.welcome({ display_name: 'X', user_id: 'u1' }); return new Set(r.created.filter(e => e.id === 'mbWelcome' && !e._removed)).size === 1; })());   // (the stand-in lists an element when it is made and again when it is added)

  // ---- the name
  r = await run({ me: { display_name: 'abc@gmail.com' } }); await r.fire();
  ok('an e-mail address is never said as a first name', r.welcome().innerHTML.includes('<h2>স্বাগতম!</h2>'));
  r = await run({ me: { display_name: '<b>ঢুকে</b> পড়ো', member_no: undefined } }); await r.fire();
  ok('a name with markup is shown as plain text, and a missing member number is simply left out', !r.welcome().innerHTML.includes('<b>ঢুকে') && !r.welcome().innerHTML.includes('সদস্য নম্বর'));
  // ---- signed out
  r = await run({ session: false }); await r.fire();
  ok('a visitor who is not signed in gets nothing', !r.welcome() && !r.toast());

  // ---- the invitation of my-institution must not sit on top of the welcome
  const my = fs.readFileSync(path.join(__dirname, '..', '..', 'myinst.js'), 'utf8');
  ok('the "where do you study" invitation of myinst.js does not appear while the welcome is open', /document\.getElementById\('mbWelcome'\)/.test(my));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.stack || e.message); process.exit(1); });
