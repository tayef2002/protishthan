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
const sandbox = { esc, bn, Date, Number, String, Array, JSON, Math, Object };
vm.createContext(sandbox);
vm.runInContext(code + ';this.api = { cmCheck, cmErr, cmWhen, cmFull, cmHue, cmInitial, cmCounter, cmLong, cmItemHtml, cmSkeleton, cmEmptyHtml, cmIcon, CM_KINDS, CM_LABELS, CM_REASONS };', sandbox);
const { cmCheck, cmErr, cmWhen, cmFull, cmHue, cmInitial, cmCounter, cmLong, cmItemHtml, cmSkeleton, cmEmptyHtml, cmIcon, CM_KINDS, CM_LABELS, CM_REASONS } = sandbox.api;

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
eq('TOO_FAST', cmErr({ message: 'TOO_FAST' }), 'একটু পরে আবার চেষ্টা করুন।');
eq('DAILY_LIMIT', /কাল আবার/.test(cmErr({ message: 'DAILY_LIMIT' })), true);
eq('DUPLICATE', /আগেই পাঠিয়েছেন/.test(cmErr({ message: 'DUPLICATE' })), true);
eq('BAD_TEXT', /ভদ্রভাবে/.test(cmErr({ message: 'BAD_TEXT' })), true);
eq('BAD_LINK', /লিংক/.test(cmErr({ message: 'BAD_LINK' })), true);
eq('BAD_PRIVATE', /ফোন/.test(cmErr({ message: 'BAD_PRIVATE' })), true);
eq('BUSY (flood guard)', /অনেকে লিখছেন/.test(cmErr({ message: 'BUSY' })), true);
eq('NOT_FOUND (a vote on a comment that is gone)', /আর নেই/.test(cmErr({ message: 'NOT_FOUND' })), true);
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
yes('the full date for the tooltip has the year', /২০২৬/.test(cmFull('2026-11-12T09:00:00Z')));
eq('a bad full date gives nothing', cmFull('x'), '');

// ----- the avatar, the counter, long texts -----
eq('the same name always gets the same colour', cmHue('রাফি'), cmHue('রাফি'));
yes('the colour is a hue between 0 and 359', cmHue('রাফি হাসান') >= 0 && cmHue('রাফি হাসান') < 360);
eq('initial of a Bangla name', cmInitial('  রাফি'), 'র');
eq('initial of an empty name', cmInitial(''), '?');
eq('the counter is calm at 100', cmCounter(100), '');
eq('the counter warns from 520', cmCounter(520), 'warn');
eq('the counter turns red from 590', cmCounter(590), 'max');
eq('a short text is not shortened', cmLong('একটা ছোট মতামত'), false);
eq('300 characters are still shown in full', cmLong('ক'.repeat(300)), false);
eq('301 characters are shortened', cmLong('ক'.repeat(301)), true);
eq('more than 5 lines are shortened', cmLong('এক\nদুই\nতিন\nচার\nপাঁচ\nছয়'), true);
eq('5 lines are shown in full', cmLong('এক\nদুই\nতিন\nচার\nপাঁচ'), false);

// ----- one comment as HTML: whatever a visitor types must never become markup -----
const evil = { id: 'a"b', name: '<img src=x onerror=alert(1)>', kind: 'idea', body: '<script>alert(1)</script> & "quotes"', created_at: '2026-11-12T09:00:00Z', reply: '<b>x</b>', replied_at: '2026-11-12T09:30:00Z', votes: 4, label: 'planned', pinned: true };
const h = cmItemHtml(evil, { v2: true });
yes('the name is escaped', h.indexOf('<img src=x') < 0 && h.indexOf('onerror') >= 0 && h.indexOf('&lt;img src=x onerror=alert(1)&gt;') >= 0);
yes('the only img in a comment is the team logo', (h.match(/<img /g) || []).length === 1 && /<img src="logo-sm\.webp"/.test(h));
yes('the text is escaped', h.indexOf('<script>') < 0 && h.indexOf('&lt;script&gt;') >= 0);
yes('the reply is escaped', h.indexOf('<b>x</b>') < 0 && h.indexOf('&lt;b&gt;x&lt;/b&gt;') >= 0);
yes('a quote in the id cannot leave the attribute', /data-id="a&quot;b"/.test(h) && h.indexOf('a"b') < 0);
yes('the kind label is shown', h.indexOf('আইডিয়া') >= 0 && h.indexOf('cm-chip idea') >= 0);
yes('the status tag is shown', h.indexOf('cm-chip st-planned') >= 0 && h.indexOf('পরিকল্পনায়') >= 0);
yes('a pinned comment says so', h.indexOf('cm-item pin') >= 0 && h.indexOf('পিন করা') >= 0);
yes('the reply block says who answered, with the logo and the tick', h.indexOf('Protishthan টিম') >= 0 && h.indexOf('logo-sm.webp') >= 0 && h.indexOf('cm-reply-h') >= 0);
yes('the reply carries its own time', /cm-reply-h[^]*<time datetime="2026-11-12T09:30:00Z"/.test(h));
const plain = { id: '1', name: 'র', kind: 'opinion', body: 'আটটা অক্ষর', created_at: '2026-11-12T09:00:00Z' };
yes('a comment without a reply has no reply block', cmItemHtml(plain, { v2: true }).indexOf('cm-reply') < 0);
yes('a comment without a status or a pin has neither', cmItemHtml(plain, { v2: true }).indexOf('st-') < 0 && cmItemHtml(plain, { v2: true }).indexOf('pinc') < 0);
yes('an unknown status label is ignored', cmItemHtml(Object.assign({}, plain, { label: 'hack"' }), { v2: true }).indexOf('hack') < 0);
eq('an unknown kind falls back to opinion', /cm-chip opinion/.test(cmItemHtml(Object.assign({}, plain, { kind: 'hack' }), { v2: true })), true);

// the vote button
yes('v2: the vote button shows the number in Bangla digits', /class="cm-vote"[^>]*data-n="4"[^>]*aria-pressed="false"[^]*<span>৪<\/span>/.test(h));
yes('the vote button is named for what it does (idea = সমর্থন)', /aria-label="সমর্থন: এখন ৪ জন"/.test(h));
yes('a problem is voted with "আমারও এই সমস্যা"', /aria-label="আমারও এই সমস্যা: এখন/.test(cmItemHtml(Object.assign({}, plain, { kind: 'problem' }), { v2: true })));
yes('an opinion is voted with "সহমত"', /aria-label="সহমত: এখন/.test(cmItemHtml(plain, { v2: true })));
yes('voted by this browser: pressed, and at least 1', /aria-pressed="true"[^>]*>|aria-pressed="true"/.test(cmItemHtml(Object.assign({}, plain, { votes: 0 }), { v2: true, voted: true })) && /data-n="1"/.test(cmItemHtml(Object.assign({}, plain, { votes: 0 }), { v2: true, voted: true })));
yes('v1 (the plain board): no vote button at all', cmItemHtml(plain, { v2: false }).indexOf('cm-vote') < 0);
yes('a fresh comment is marked so it can glide in', cmItemHtml(plain, { v2: true, fresh: true }).indexOf('cm-item fresh') >= 0);

// the report menu
yes('a report button and the four reasons are offered', h.indexOf('data-act="report"') >= 0 && Object.keys(CM_REASONS).every(k => h.indexOf('data-r="' + k + '"') >= 0) && h.indexOf('data-r=""') >= 0);
yes('a reported comment shows it and is disabled', /data-act="report" disabled>[^]*রিপোর্ট হয়েছে/.test(cmItemHtml(plain, { v2: true, reported: true })));
yes('the writer\'s own fresh comment has no report button or menu', cmItemHtml(Object.assign({}, plain, { mine: true }), { v2: true }).indexOf('data-act="report"') < 0 && cmItemHtml(Object.assign({}, plain, { mine: true }), { v2: true }).indexOf('cm-rp') < 0);

// long texts
const longBody = 'অনেক লম্বা মতামত। '.repeat(40);
yes('a long text is shortened and has a read more button', /cm-body clamp/.test(cmItemHtml(Object.assign({}, plain, { body: longBody }), { v2: true })) && /class="cm-readmore" aria-expanded="false">আরও পড়ুন/.test(cmItemHtml(Object.assign({}, plain, { body: longBody }), { v2: true })));
yes('a short text has no read more button', cmItemHtml(plain, { v2: true }).indexOf('cm-readmore') < 0);

// skeleton, empty state, icons
eq('three skeleton rows', (cmSkeleton(3).match(/class="cm-sk"/g) || []).length, 3);
yes('the empty state invites the first writer', /প্রথম মতামতটা আপনার হোক/.test(cmEmptyHtml('')));
yes('an empty filter says so and points to "সব"', /এই ধরনের কোনো লেখা এখনও নেই/.test(cmEmptyHtml('idea')) && /সব/.test(cmEmptyHtml('idea')));
yes('every kind has an icon, a vote word, a hint and a placeholder', Object.keys(CM_KINDS).every(k => CM_KINDS[k].ic && CM_KINDS[k].vote && CM_KINDS[k].hint && CM_KINDS[k].ph));
yes('the four status labels exist', ['review', 'planned', 'progress', 'done'].every(k => CM_LABELS[k]));
yes('an icon is an aria-hidden svg', /^<svg [^>]*aria-hidden="true"/.test(cmIcon('up', 18)));
eq('an unknown icon is an empty svg, not a crash', /<svg[^>]*><\/svg>/.test(cmIcon('nope', 10)), true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
