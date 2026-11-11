// Tests the opinion board rules of card.html (between CM-START and CM-END), run exactly as they are on the page.
//   node tools/tests/test_card_comments.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'card.html'), 'utf8');
const a = html.indexOf('/* CM-START'), b = html.indexOf('/* CM-END */');
if (a < 0 || b < 0) { console.error('markers not found in card.html'); process.exit(1); }
const code = html.slice(a, b);

let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);

// the page's own helpers, copied from the top of card.html's script
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const bn = x => String(x).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const sandbox = { esc, bn, Date, Number, String, Array, JSON, Math };
vm.createContext(sandbox);
vm.runInContext(code + ';this.api = { cmCheck, cmErr, cmWhen, cmHue, cmInitial, cmItemHtml, CM_KINDS };', sandbox);
const { cmCheck, cmErr, cmWhen, cmHue, cmInitial, cmItemHtml } = sandbox.api;

// ----- what may be written -----
eq('a normal Bangla opinion is fine', cmCheck('কার্ডটা অনেক সুন্দর হয়েছে, ধন্যবাদ', ''), '');
eq('a normal English idea is fine', cmCheck('Please add a dark theme for the card', 'Rafi'), '');
yes('too short is refused', cmCheck('ভালো', ''));
yes('7 letters is still too short', cmCheck('1234567', '') !== '');
eq('exactly 8 letters is fine', cmCheck('আটটা অক্ষর', ''), '');
yes('more than 600 characters is refused', cmCheck('ক'.repeat(601), ''));
eq('exactly 600 characters is fine', cmCheck('ক'.repeat(600), ''), '');
yes('http link is refused', /লিংক/.test(cmCheck('দেখুন https://example.com ভালো', '')));
yes('www link is refused', /লিংক/.test(cmCheck('দেখুন www.example.org এখানে', '')));
yes('a bare .com is refused', /লিংক/.test(cmCheck('আমার সাইট facebook.com/xyz দেখুন', '')));
yes('a .bd address is refused', /লিংক/.test(cmCheck('ওয়েব: protishthan.bd এ যান', '')));
yes('an e-mail address is refused', /লিংক|ইমেইল/.test(cmCheck('আমাকে লিখুন rafi@mail.test ঠিকানায়', '')));
yes('a link hidden in the name is refused too', /লিংক/.test(cmCheck('কার্ডটা দারুণ হয়েছে', 'www.spam.com')));
eq('a sentence ending in a dot before bd text is not a link', cmCheck('আমি কার্ড বানিয়েছি। তারপর শেয়ার করেছি।', ''), '');
yes('an 11-digit phone number is refused', /ফোন/.test(cmCheck('ফোন করুন 01712345678 এ', '')));
yes('a Bangla-digit phone number is refused', /ফোন/.test(cmCheck('ফোন করুন ০১৭১২৩৪৫৬৭৮ এ', '')));
yes('a phone number split by spaces and dashes is refused', /ফোন/.test(cmCheck('নম্বর: 01712 - 345 678 দিন', '')));
yes('+88 phone is refused', /ফোন/.test(cmCheck('আমার নম্বর +8801712345678 এটা', '')));
yes('a long run of digits is refused', /ফোন/.test(cmCheck('আমার আইডি 1234567890123 লিখলাম', '')));
eq('years and small numbers are fine', cmCheck('২০২৪ সালে ১২ বছর পড়েছি, ৩টা কার্ড বানালাম', ''), '');
eq('two years in a row are fine', cmCheck('২০২০ ২০২১ ২০২২ সালের কথা বলছি', ''), '');

// ----- the messages for what the database says back -----
eq('TOO_FAST', cmErr({ message: 'TOO_FAST' }), 'একটু পরে আবার লিখুন।');
eq('DAILY_LIMIT', /কাল আবার/.test(cmErr({ message: 'DAILY_LIMIT' })), true);
eq('DUPLICATE', /আগেই পাঠিয়েছেন/.test(cmErr({ message: 'DUPLICATE' })), true);
eq('BAD_TEXT', /ভদ্রভাবে/.test(cmErr({ message: 'BAD_TEXT' })), true);
eq('BAD_LINK', /লিংক/.test(cmErr({ message: 'BAD_LINK' })), true);
eq('BAD_PRIVATE', /ফোন/.test(cmErr({ message: 'BAD_PRIVATE' })), true);
eq('BUSY (flood guard)', /অনেকে লিখছেন/.test(cmErr({ message: 'BUSY' })), true);
eq('a busy database says the text is kept', /সেভ আছে/.test(cmErr({ message: 'Could not query the database for the schema cache. Retrying.', code: 'PGRST002' })), true);
eq('a network failure says the text is kept', /সেভ আছে/.test(cmErr(new TypeError('Failed to fetch'))), true);
eq('anything else is a plain message', cmErr({ message: 'something odd' }), 'পাঠানো যায়নি, একটু পরে আবার চেষ্টা করুন।');
eq('an error that is not an object does not crash', typeof cmErr(undefined), 'string');

// ----- how long ago -----
const now = Date.parse('2026-11-12T10:00:00Z');
eq('just now', cmWhen('2026-11-12T09:59:40Z', now), 'এইমাত্র');
eq('minutes', cmWhen('2026-11-12T09:55:00Z', now), '৫ মিনিট আগে');
eq('hours', cmWhen('2026-11-12T07:00:00Z', now), '৩ ঘণ্টা আগে');
eq('days', cmWhen('2026-11-09T10:00:00Z', now), '৩ দিন আগে');
yes('older than a month is a date', /২০২৬/.test(cmWhen('2026-08-01T10:00:00Z', now)));
eq('a time in the future is just now, not negative', cmWhen('2026-11-12T10:05:00Z', now), 'এইমাত্র');
eq('a bad date gives nothing', cmWhen('not a date', now), '');

// ----- the avatar -----
eq('the same name always gets the same colour', cmHue('রাফি'), cmHue('রাফি'));
yes('the colour is a hue between 0 and 359', cmHue('রাফি হাসান') >= 0 && cmHue('রাফি হাসান') < 360);
eq('initial of a Bangla name', cmInitial('  রাফি'), 'র');
eq('initial of an empty name', cmInitial(''), '?');

// ----- one comment as HTML: whatever a visitor types must never become markup -----
const evil = { id: 'a"b', name: '<img src=x onerror=alert(1)>', kind: 'idea', body: '<script>alert(1)</script> & "quotes"', created_at: '2026-11-12T09:00:00Z', reply: '<b>x</b>' };
const h = cmItemHtml(evil, false);
yes('the name is escaped', h.indexOf('<img') < 0 && h.indexOf('&lt;img') >= 0);
yes('the text is escaped', h.indexOf('<script>') < 0 && h.indexOf('&lt;script&gt;') >= 0);
yes('the reply is escaped', h.indexOf('<b>x</b>') < 0 && h.indexOf('&lt;b&gt;x&lt;/b&gt;') >= 0);
yes('a quote in the id cannot leave the attribute', /data-id="a&quot;b"/.test(h));
yes('the kind label is shown', h.indexOf('আইডিয়া') >= 0 && h.indexOf('cm-k idea') >= 0);
yes('the reply block says who answered', h.indexOf('Protishthan টিমের উত্তর') >= 0);
yes('a comment without a reply has no reply block', cmItemHtml({ id: '1', name: 'র', kind: 'opinion', body: 'আটটা অক্ষর', created_at: '2026-11-12T09:00:00Z' }, false).indexOf('cm-reply') < 0);
yes('a report button is offered', h.indexOf('রিপোর্ট করুন') >= 0 && h.indexOf('disabled') < 0);
yes('a reported comment shows it and is disabled', /disabled>রিপোর্ট হয়েছে/.test(cmItemHtml(evil, true)));
yes('the writer\'s own fresh comment has no report button', cmItemHtml(Object.assign({}, evil, { mine: true }), false).indexOf('class="cm-rep"') < 0);
eq('an unknown kind falls back to opinion', /cm-k opinion/.test(cmItemHtml({ id: '1', name: 'র', kind: 'hack', body: 'আটটা অক্ষর', created_at: '2026-11-12T09:00:00Z' }, false)), true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
