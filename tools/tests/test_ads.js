// The ad places (ads.js): switched off by default, and when they are switched on, only where and how the rules say.   node tools/tests/test_ads.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const A = require(path.join(ROOT, 'ads.js'));
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const on = (over) => Object.assign({}, A.config, { enabled: true, slots: { 'card-end': '1234567890', 'guide-mid': '2234567890', 'guide-end': '3234567890' } }, over || {});

// ----- the shipped state -----
const cfg = A.config;
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
const used = new Set(); pages.forEach(([f, h]) => (h.match(/data-slot="([^"]+)"/g) || []).forEach(x => used.add(x.slice(11, -1))));
if (cfg.enabled) {
  // switched on: then every place used in a page needs its id, the publisher id must be well formed, and the privacy page must already tell people about AdSense
  eq('ENABLED: every place used in a page has an ad unit id', [...used].every(s => A.slotId(cfg, s) !== ''), true);
  eq('ENABLED: the publisher id is well formed', /^ca-pub-\d{10,20}$/.test(cfg.client), true);
  eq('ENABLED: the privacy page names Google AdSense and the ad settings', /Google AdSense/.test(fs.readFileSync(path.join(ROOT, 'privacy.html'), 'utf8')) && /adssettings\.google\.com/.test(fs.readFileSync(path.join(ROOT, 'privacy.html'), 'utf8')), true);
} else {
  eq('the ads are switched off in the shipped file', cfg.enabled, false);
  eq('no ad unit id is filled in yet', Object.values(cfg.slots).every(v => v === ''), true);
  eq('so no place shows an ad', [...used].every(s => !A.allowed(cfg, s, '/gpa', 0)), true);
}
eq('the publisher id is the one from the AdSense account', cfg.client, 'ca-pub-2196769322282894');
eq('every place used in a page is one that ads.js knows', [...used].every(s => s in cfg.slots), true);
eq('the places in use are exactly card-end, guide-mid, guide-end', [...used].sort(), ['card-end', 'guide-end', 'guide-mid']);

// ----- the rules, with the switch turned on in the test only -----
eq('on + id + a normal page = allowed', A.allowed(on(), 'guide-mid', '/gpa', 0), true);
eq('a switched-off config shows nothing', A.allowed(on({ enabled: false }), 'guide-mid', '/gpa', 0), false);
eq('a place without an id shows nothing', A.allowed(on({ slots: { 'guide-mid': '' } }), 'guide-mid', '/gpa', 0), false);
eq('an id that is not digits is refused (nothing odd ends up in the page)', A.allowed(on({ slots: { 'guide-mid': '12"><script>' } }), 'guide-mid', '/gpa', 0), false);
eq('an unknown place shows nothing', A.allowed(on(), 'sidebar', '/gpa', 0), false);
eq('a malformed publisher id shows nothing', A.allowed(on({ client: 'pub-1' }), 'guide-mid', '/gpa', 0), false);
eq('at most 2 on a page: the third is refused', [A.allowed(on(), 'guide-mid', '/gpa', 0), A.allowed(on(), 'guide-end', '/gpa', 1), A.allowed(on(), 'card-end', '/gpa', 2)], [true, true, false]);
['/admin', '/member', '/dashboard', '/login', '/settings', '/partner-dashboard', '/agent-login', '/teacher-dashboard', '/student-dashboard', '/guardian-dashboard', '/classroom', '/messages', '/attendance', '/fee-management', '/id-card', '/admit-card']
  .forEach(p => eq('never on ' + p, A.allowed(on(), 'guide-mid', p, 0), false));
['/', '/gpa', '/cgpa', '/eiin', '/choose-institution', '/guide', '/card', '/about'].forEach(p => eq('allowed on ' + p, A.allowed(on(), 'guide-mid', p, 0), true));
const html = A.html(on(), 'guide-mid');
eq('the place is labelled in Bangla', /<span class="ad-lab">বিজ্ঞাপন<\/span>/.test(html), true);
eq('it carries the publisher id and only the unit id of its own place', /data-ad-client="ca-pub-2196769322282894"/.test(html) && /data-ad-slot="2234567890"/.test(html) && !/1234567890|3234567890/.test(html), true);
eq('it is an ins.adsbygoogle with a responsive format', /<ins class="adsbygoogle"[^>]*data-ad-format="auto"[^>]*data-full-width-responsive="true"/.test(html), true);

// ----- the pages: ad places are away from the tools -----
const card = fs.readFileSync(path.join(ROOT, 'card.html'), 'utf8');
const ai = card.indexOf('data-slot="card-end"');
eq('the card page has its place', ai > 0, true);
eq('the card place comes after the opinion board and just before the end of the main part', card.indexOf('id="feedback"') < ai && card.indexOf('</main>') > ai && card.indexOf('</main>') - ai < 80, true);
eq('the card place is not inside the download popup or the preview', !/id="dlOv"[^]*data-slot="card-end"[^]*id="toast"/.test(card) || card.indexOf('id="dlOv"') > ai, true);
eq('the card page loads ads.js (deferred)', /<script src="\/ads\.js\?v=1" defer><\/script>/.test(card), true);
eq('no page puts a place inside a button, a form or a label', pages.every(([f, h]) => !/<(button|form|label)[^>]*>(?:(?!<\/\1>)[^])*data-slot=/.test(h)), true);
eq('no page loads Google\'s ad script by itself', pages.every(([f, h]) => !/pagead2\.googlesyndication\.com/.test(h)), true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
