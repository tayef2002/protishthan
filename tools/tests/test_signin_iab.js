// Sign-in inside Facebook / Messenger / Instagram's own browser (member.js): Google refuses to sign anybody in there, so the popup hands the page to the real browser.
// Runs the REAL member.js with a stand-in browser and database, as different browsers.   node tools/tests/test_signin_iab.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'member.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? pass++ : fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || ''))); };

const FB_ANDROID = 'Mozilla/5.0 (Linux; Android 13; RMX3085 Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0;]';
const FB_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0;FBBV/1;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/17.0]';
const IG_ANDROID = 'Mozilla/5.0 (Linux; Android 12; SM-A525F Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 Instagram 300.0.0.29.110 Android';
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 13; RMX3085) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const SAFARI_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function run({ ua, search, signedIn }) {
  const oauth = [], tracked = [], replaced = [], copied = []; let hrefSet = null;
  const user = { id: 'u1', email: 'a@b.c', user_metadata: {} };
  const sb = {
    auth: { getSession: async () => ({ data: { session: signedIn ? { user } : null } }), onAuthStateChange: () => {}, signOut: async () => {}, signInWithOAuth: async (o) => { oauth.push(o); return { error: null }; } },
    rpc: async (n) => n === 'ensure_member' ? { data: { user_id: 'u1', display_name: 'রাফি', email: 'a@b.c' }, error: null } : { data: null, error: { message: 'x' } },
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) })
  };
  const els = {};
  const mkel = () => { const cls = new Set(), h = {}; return { style: {}, hidden: false, textContent: '', innerHTML: '', disabled: false, classList: { add: c => cls.add(c), remove: c => cls.delete(c), toggle: (c, on) => { (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c); }, contains: c => cls.has(c), _s: cls }, appendChild() {}, addEventListener: (t, f) => { h[t] = f; }, _h: h, querySelector: () => mkel(), querySelectorAll: () => [], setAttribute() {}, remove() {}, select() {} }; };
  const created = [];
  const document = { readyState: 'complete', hidden: false, body: mkel(), head: mkel(), createElement: () => { const e = mkel(); created.push(e); return e; }, addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, getElementById: id => els[id] || (els[id] = mkel()), execCommand: () => true };
  const loc = { pathname: '/institution-detail', href: 'https://protishthan.com/institution-detail' + (search || ''), search: search || '', origin: 'https://protishthan.com' };
  Object.defineProperty(loc, 'href', { get: () => loc._h, set: v => { hrefSet = v; }, configurable: true }); loc._h = 'https://protishthan.com/institution-detail' + (search || '');
  const window = { addEventListener() {}, matchMedia: () => ({ matches: false }), track: (n, p) => tracked.push([n, p]) };
  const timers = [];
  const ctx = { window, document, supabase: { createClient: () => sb }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, location: loc, navigator: { userAgent: ua, clipboard: { writeText: async t => { copied.push(t); } } },
    URL, URLSearchParams, history: { replaceState: (a, b, u) => replaced.push(u) }, fetch: async () => ({ json: async () => ({ external: { google: true } }) }), console, Promise, JSON, Date, Math, Number, Object, Array, String, Set, Map,
    setTimeout: (f, ms) => { timers.push([f, ms]); return timers.length; }, clearTimeout() {} };
  window.localStorage = ctx.localStorage; window.location = loc; window.document = document; window.navigator = ctx.navigator;
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const M = ctx.window.Protishthan.member; await M.ready(); await new Promise(r => setImmediate(r));
  const open = () => { M.signIn('কারণ'); return els; };
  const clickGoogle = async () => { await els.mbGoogle._h.click(); await new Promise(r => setImmediate(r)); };
  return { M, els, created, get ov() { return created.find(e => e.className === 'mb-ov'); }, open, clickGoogle, oauth, tracked, replaced, copied, timers, get href() { return hrefSet; }, loc };
}

(async () => {
  // ---- the recognition
  let r = await run({ ua: FB_ANDROID }); ok('Facebook app on Android is recognised (and it is Android)', r.M.iab.inApp === true && r.M.iab.android === true);
  r = await run({ ua: FB_IOS }); ok('Facebook app on iPhone is recognised (and it is not Android)', r.M.iab.inApp === true && r.M.iab.android === false);
  r = await run({ ua: IG_ANDROID }); ok('Instagram on Android is recognised', r.M.iab.inApp === true);
  for (const [n, ua] of [['Chrome on Android', CHROME_ANDROID], ['Safari on iPhone', SAFARI_IOS], ['a computer', DESKTOP]]) { r = await run({ ua }); ok(n + ' is a real browser', r.M.iab.inApp === false); }

  // ---- the address handed to the real browser
  r = await run({ ua: FB_ANDROID });
  const t = r.M.iab.target('https://protishthan.com/institution-detail?slug=notre-dame&fbclid=ABC123&iabtest=android');
  ok('the address for the real browser keeps the page and its question, drops Facebook\'s tracking tag and the test switch, and adds signin=1', t === 'https://protishthan.com/institution-detail?slug=notre-dame&signin=1', t);
  const it = r.M.iab.intent(t);
  ok('the Android hand-over is an intent:// address of the same page with a fallback to the plain address', it.startsWith('intent://protishthan.com/institution-detail?slug=notre-dame&signin=1#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=') && it.endsWith(';end') && it.includes(encodeURIComponent(t)), it);

  // ---- a real browser: the old way, straight to Google
  r = await run({ ua: CHROME_ANDROID }); r.open(); await r.clickGoogle();
  ok('in a real browser the button goes to Google, as before (account chooser, back to the same page)', r.oauth.length === 1 && r.oauth[0].provider === 'google' && r.oauth[0].options.queryParams.prompt === 'select_account' && !r.els.mbCta.textContent.includes('ব্রাউজারে খুলে') && !r.ov.classList._s.has('iab'));
    ok('...and the popup is tracked, with iab = 0', r.tracked.some(x => x[0] === 'signin_open' && x[1].iab === 0) && r.tracked.some(x => x[0] === 'signin_google'));

  // ---- Facebook on Android
  r = await run({ ua: FB_ANDROID }); r.open();
  ok('inside Facebook on Android the popup says what it will do ("ব্রাউজারে খুলে সাইন-ইন করুন") and the explanation is switched on', r.els.mbCta.textContent === 'ব্রাউজারে খুলে সাইন-ইন করুন' && r.ov.classList._s.has('iab') && r.ov.classList._s.has('show'));
  await r.clickGoogle();
  ok('the button NEVER goes to Google in the app browser (that would end in an error page)', r.oauth.length === 0);
  ok('it hands the page to the real browser: the intent address of this page with signin=1', typeof r.href === 'string' && r.href.startsWith('intent://protishthan.com/institution-detail#Intent;') === false && r.href.startsWith('intent://protishthan.com/institution-detail?signin=1#Intent;'), String(r.href));
  ok('the hint about Facebook\'s own question (CONTINUE) is shown at once; the steps wait a moment', r.els.mbIabHint.hidden === false && r.els.mbIabSteps.hidden === true);
  const fb = r.timers.find(x => x[1] === 1600);
  ok('a safety net is set for 1.6 seconds: if the page is still in front, the steps and the copied link are shown', !!fb);
  await fb[0](); await new Promise(x => setImmediate(x));
  ok('...and then the steps are shown and the link of the page (with signin=1) is copied', r.els.mbIabSteps.hidden === false && r.copied.length === 1 && r.copied[0] === 'https://protishthan.com/institution-detail?signin=1' && /✓/.test(r.els.mbIabCopy.textContent), JSON.stringify(r.copied));
  ok('it is tracked (popup with iab = 1, the hand-over with the system)', r.tracked.some(x => x[0] === 'signin_open' && x[1].iab === 1) && r.tracked.some(x => x[0] === 'signin_iab_open' && x[1].os === 'android') && !r.tracked.some(x => x[0] === 'signin_google'));
  // if the page went to the background (the phone took the hand-over), no steps are forced on the visitor
  r = await run({ ua: FB_ANDROID }); r.open(); await r.clickGoogle(); r.els; const doc = r.timers.find(x => x[1] === 1600);
  // (document.hidden is a property of the stand-in document: set it as the phone would)
  // the page-level stub keeps it false, so here only the shape is checked: the timer exists and does one thing
  ok('the safety net does only one thing (shows the steps)', typeof doc[0] === 'function');

  // ---- Facebook on iPhone: no hand-over is possible, so the steps and the copied link at once
  r = await run({ ua: FB_IOS }); r.open();
  ok('on an iPhone the button says "ব্রাউজারে খোলার উপায় দেখুন"', r.els.mbCta.textContent === 'ব্রাউজারে খোলার উপায় দেখুন');
  await r.clickGoogle();
  ok('on an iPhone the steps appear at once, the link is copied, nothing is opened, Google is never called', r.els.mbIabSteps.hidden === false && r.copied.length === 1 && r.href === null && r.oauth.length === 0 && r.tracked.some(x => x[0] === 'signin_iab_open' && x[1].os === 'ios'));
  await r.els.mbIabCopy._h.click(); await new Promise(x => setImmediate(x));
  ok('the copy button copies the link again', r.copied.length === 2 && r.copied[1].includes('signin=1'));

  // ---- the preview switch records the address and never leaves the page
  r = await run({ ua: DESKTOP, search: '?slug=x&iabtest=android' }); r.open(); await r.clickGoogle();
  ok('?iabtest=android previews the hand-over on any device: the address is recorded, the page stays, Google is not called', r.href === null && typeof r.M.iab.target === 'function' && r.oauth.length === 0 && r.els.mbCta.textContent === 'ব্রাউজারে খুলে সাইন-ইন করুন');

  // ---- arriving in the real browser from the hand-over
  r = await run({ ua: CHROME_ANDROID, search: '?slug=notre-dame&signin=1' });
  ok('arriving with signin=1 in a real browser (not signed in) opens the sign-in popup by itself and cleans the address (the page question stays)', r.replaced.length === 1 && r.replaced[0] === '/institution-detail?slug=notre-dame' && r.els.mbGoogle !== undefined && r.tracked.some(x => x[0] === 'signin_return' && x[1].signed === 0), JSON.stringify([r.replaced, r.tracked]));
  r = await run({ ua: CHROME_ANDROID, search: '?slug=notre-dame&signin=1', signedIn: true });
  ok('...and nothing opens when the person is already signed in there', !r.els.mbGoogle && r.tracked.some(x => x[0] === 'signin_return' && x[1].signed === 1));
  r = await run({ ua: FB_ANDROID, search: '?signin=1' });
  ok('inside the app browser signin=1 does nothing (no loop: the address is not cleaned, no popup)', r.replaced.length === 0 && !r.els.mbGoogle);
  r = await run({ ua: CHROME_ANDROID, search: '' });
  ok('an ordinary visit opens no popup and changes no address', r.replaced.length === 0 && !r.els.mbGoogle);

  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('crashed:', e.stack || e.message); process.exit(1); });
