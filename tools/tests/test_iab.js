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
a = load(DESKTOP, '?iabtest=android'); ok(a.inApp && a.android, '?iabtest=android previews the Android case anywhere');
a = load(DESKTOP, '?iabtest=ios'); ok(a.inApp && a.ios, '?iabtest=ios previews the iPhone case anywhere');

a = load(FB_ANDROID);
const href = a.externalHref('https://protishthan.com/card?ref=x');
ok(href.startsWith('intent://protishthan.com/card?ref=x#Intent;scheme=https;'), 'Android: an intent address for the same page');
ok(href.includes('action=android.intent.action.VIEW') && href.endsWith(';end'), 'Android: opens in the default browser (no app is named)');
ok(href.includes('S.browser_fallback_url=' + encodeURIComponent('https://protishthan.com/card?ref=x')), 'Android: falls back to the normal address');
ok(load(FB_IOS).externalHref('https://protishthan.com/card') === 'https://protishthan.com/card', 'iPhone: the plain address (steps are shown instead)');
console.log('all ' + n + ' checks passed');
