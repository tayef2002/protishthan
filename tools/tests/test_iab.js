// Checks iab.js without a browser:  node tools/tests/test_iab.js
const path = require('path'), assert = require('assert'), vm = require('vm'), fs = require('fs');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'iab.js'), 'utf8');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const load = (ua, search = '') => { const win = { navigator: { userAgent: ua }, location: { search, href: 'https://protishthan.com/card?ref=x' } }; vm.runInNewContext(src, { window: win, URL, encodeURIComponent, Promise, setTimeout, console }); return win.Iab; };

const FB_ANDROID = 'Mozilla/5.0 (Linux; Android 13; RMX3085 Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.38.108;]';
const FB_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0;FBBV/1;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/17.0]';
const MESSENGER = 'Mozilla/5.0 (Linux; Android 11; RMX3261) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/440.0]';
const CHROME = 'Mozilla/5.0 (Linux; Android 13; RMX3085) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let a = load(FB_ANDROID); ok(a.inApp && a.android && !a.ios, 'Facebook app on Android is recognised');
a = load(FB_IOS); ok(a.inApp && a.ios && !a.android, 'Facebook app on iPhone is recognised');
a = load(MESSENGER); ok(a.inApp && a.android, 'Messenger on Android is recognised');
ok(!load(CHROME).inApp, 'Chrome on Android is not an in-app browser');
ok(!load(SAFARI).inApp, 'Safari on iPhone is not an in-app browser');
ok(!load(DESKTOP).inApp, 'a computer is not an in-app browser');
ok(load(FB_ANDROID).gate && load(FB_IOS).gate && load(MESSENGER).gate, 'in the apps that name themselves nothing can be closed (gate)');
const WV_ANDROID = 'Mozilla/5.0 (Linux; Android 12; SM-A525F Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36';
const WK_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1';
const SAMSUNG = 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36';
ok(load(WV_ANDROID).inApp && !load(WV_ANDROID).gate, 'an Android app web view that does not name itself ("wv") is recognised, but its notices stay closable (it may be a real browser wrongly recognised)');
ok(load(WK_IOS).inApp, 'an iPhone app web view without "Safari" is recognised');
ok(!load(CHROME_IOS).inApp && !load(SAMSUNG).inApp, 'Chrome on iPhone and Samsung Internet are real browsers, not in-app');
a = load(DESKTOP, '?iabtest=android'); ok(a.inApp && a.android, '?iabtest=android previews the Android case anywhere');
a = load(DESKTOP, '?iabtest=ios'); ok(a.inApp && a.ios, '?iabtest=ios previews the iPhone case anywhere');

a = load(FB_ANDROID);
const href = a.externalHref('https://protishthan.com/card?ref=x');
ok(href.startsWith('intent://protishthan.com/card?ref=x#Intent;scheme=https;'), 'Android: an intent address for the same page');
ok(href.includes('action=android.intent.action.VIEW') && href.endsWith(';end'), 'Android: opens in the default browser (no app is named)');
ok(href.includes('S.browser_fallback_url=' + encodeURIComponent('https://protishthan.com/card?ref=x')), 'Android: falls back to the normal address');
ok(load(FB_IOS).externalHref('https://protishthan.com/card') === 'https://protishthan.com/card', 'iPhone: the plain address (steps are shown instead)');
// the ?iabauto=1 test switch: the page itself is sent to the real browser, without the switch in the address
const direct = (search, href, agent) => {
  const seen = { replaced: null, frames: 0 }, store = {};
  const win = { navigator: { userAgent: agent || FB_ANDROID }, location: { search, href, replace: u => { seen.replaced = u; } }, sessionStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } }, document: { createElement: () => ({ style: {} }), body: { appendChild: () => { seen.frames++; } }, readyState: 'loading', addEventListener() {} } };   // 'loading': the notice bar waits for the page, only autoTry() runs here
  vm.runInNewContext(src, { window: win, URL, encodeURIComponent, Promise, setTimeout: f => f(), console }); win.Iab.autoTry(); return seen;
};
// (the helper builds the page with the given browser string; default: the Facebook app on Android)
let s = direct('?iabauto=1', 'https://protishthan.com/card?iabauto=1'); ok(s.replaced && s.replaced.startsWith('intent://protishthan.com/card#Intent;') && !/iabauto/.test(decodeURIComponent(s.replaced.split('#Intent;')[0])), 'iabauto=1: the page is sent to the real browser, the switch removed from the address');
s = direct('?ref=a&iabauto=1', 'https://protishthan.com/card?ref=a&iabauto=1'); ok(s.replaced && s.replaced.startsWith('intent://protishthan.com/card?ref=a#Intent;'), 'iabauto=1 keeps the other parts of the address');
s = direct('?ref=a', 'https://protishthan.com/card?ref=a'); ok(s.replaced === null && s.frames === 0, 'inside the Facebook app nothing is tried without the switch (the app blocks it, nobody got through)');
s = direct('?ref=a', 'https://protishthan.com/card?ref=a', WV_ANDROID); ok(s.replaced === null && s.frames === 1, 'in a browser that only looks like an app web view the quiet hidden-frame attempt is still made, and the page is never replaced');
// OK / the open button on Android hands the page to the default browser (this worked on a real phone inside the Facebook app)
const tap = (agent, href) => {
  let assigned = null, base = href;
  const win = { navigator: { userAgent: agent }, location: { search: '', get href(){ return base; }, set href(v){ assigned = v; } }, document: { readyState: 'loading', hidden: false, addEventListener() {}, getElementById: () => null } };
  vm.runInNewContext(src, { window: win, URL, encodeURIComponent, Promise, setTimeout: () => 0, console }); win.Iab.openExternal(); return assigned;
};
let go = tap(FB_ANDROID, 'https://protishthan.com/card?fbclid=ABC&ref=x');
ok(go && go.startsWith('intent://protishthan.com/card?fbclid=ABC&ref=x#Intent;scheme=https;action=android.intent.action.VIEW;') && go.endsWith(';end'), 'Android Facebook app: OK / the open button navigates to the intent address for the same page');
ok(tap(WV_ANDROID, 'https://protishthan.com/card') !== null, 'Android app web view: the hand-over is tried too');
console.log('all ' + n + ' checks passed');
