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
eq('it is a plain display ad that keeps to its box (not full-bleed)', /<ins class="adsbygoogle"[^>]*data-ad-format="auto"[^>]*data-full-width-responsive="false"/.test(html), true);

// ----- where on a page an ad may go (the real page measures; these are the numbers it uses) -----
const R = A.rules, VH = 800;
const place = (name, top, over) => Object.assign({ name, top, h: 300, clear: true }, over || {});
const ctx = (over) => Object.assign({ vh: VH, docH: 6000, path: '/gpa' }, over || {});
eq('the rules in force', [R.maxPerPage, R.minTopScreens, R.minGapScreens, R.shortPageScreens, R.clearPx], [2, 1.25, 1.25, 3, 48]);
eq('a place in the first screens is refused', A.plan(on(), [place('guide-mid', 700)], ctx()), []);
eq('just below 1.25 screens is allowed', A.plan(on(), [place('guide-mid', 1000)], ctx()), ['guide-mid']);
eq('a place with a tappable thing within 48 px is refused', A.plan(on(), [place('guide-mid', 1500, { clear: false })], ctx()), []);
eq('two places closer than 1.25 screens apart: only the first', A.plan(on(), [place('guide-mid', 1500), place('guide-end', 1500 + 300 + 900)], ctx()), ['guide-mid']);
eq('two places far enough apart: both', A.plan(on(), [place('guide-mid', 1500), place('guide-end', 1500 + 300 + 1000)], ctx()), ['guide-mid', 'guide-end']);
eq('a short page (under 3 screens) carries one ad only', A.plan(on(), [place('guide-mid', 1100), place('guide-end', 2300)], ctx({ docH: 2300 })), ['guide-mid']);
eq('never more than 2, whatever the page', A.plan(on(), [place('guide-mid', 1500), place('guide-end', 3000), place('card-end', 4500)], ctx({ docH: 9000 })), ['guide-mid', 'guide-end']);
eq('places are taken in page order, not in the order given', A.plan(on(), [place('guide-end', 3000), place('guide-mid', 1500)], ctx({ docH: 6000 })), ['guide-mid', 'guide-end']);
eq('a page that holds personal data gets none even if the places are fine', A.plan(on(), [place('guide-mid', 1500)], ctx({ path: '/dashboard' })), []);
eq('switched off gets none', A.plan(on({ enabled: false }), [place('guide-mid', 1500)], ctx()), []);

// ----- what we never use: the annoying kinds of ads -----
const src = fs.readFileSync(path.join(ROOT, 'ads.js'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
eq('no page-level (auto) ads asked for in the code', /enable_page_level_ads|data-ad-format="(autorelaxed|fluid)"|anchor|vignette|interstitial|overlay/i.test(code), false);
eq('the ad box is never fixed, sticky or floating over the page', /position\s*:\s*(fixed|sticky|absolute)/i.test(code), false);
eq('the ads are hidden when printing', /@media print\{\.ad-slot\{display:none!important\}\}/.test(code), true);
eq('a place that gets no ad is removed with its label', /data-ad-status/.test(code) && /classList\.remove\('on'\)/.test(code), true);
eq('the preview shows grey boxes and returns before the Google script is ever asked for', /if\(preview\)\{[^}]*return;\s*\}\s*\n\s*n\.innerHTML = html\(cfg/.test(code) && code.indexOf('if(preview){ n.innerHTML') < code.indexOf('watch(n);'), true);
eq('switched off and no preview asked: the page part does nothing at all', /if\(!preview && !ADS\.enabled\) return;/.test(code), true);

// ----- the pages: the order of things around each place -----
const guidePages = ['result-check', 'xi-admission', 'education-streams', 'verify-university', 'certificate-guide', 'eiin', 'choose-institution', 'gpa', 'cgpa'];
guidePages.forEach(slug => {
  const h = fs.readFileSync(path.join(ROOT, slug + '.html'), 'utf8');
  const m0 = h.indexOf('<main'), m1 = h.indexOf('</main>'), mid = h.indexOf('data-slot="guide-mid"'), end = h.indexOf('data-slot="guide-end"'), faq = h.indexOf('id="faq"'), cta = h.indexOf('class="gd-cta"');
  const f = x => (x - m0) / (m1 - m0);
  eq(slug + ': the first place is in the body, between a fifth and two thirds of the way down (' + f(mid).toFixed(2) + ')', f(mid) > 0.2 && f(mid) < 0.67, true);
  eq(slug + ': the second place is later, and sits right before the questions, not next to the buttons (' + f(end).toFixed(2) + ')', end > mid && end < faq && faq - end < 120 && end < cta, true);
  eq(slug + ': nothing is placed between the question list and the call-to-action', !/data-slot[^]*(?=<section class="gd-cta")/.test(h.slice(faq, cta)), true);
  eq(slug + ': each place sits between two sections, never inside one', /<\/(section|header)>\s*<div class="ad-slot" data-slot="guide-(mid|end)"><\/div>\s*<section/.test(h) && (h.match(/<\/(section|header)>\s*<div class="ad-slot"/g) || []).length === 2, true);
  eq(slug + ': loads the current ads.js', /<script src="\/ads\.js\?v=2" defer><\/script>/.test(h), true);
});
const calcs = ['gpa', 'cgpa'].map(s => fs.readFileSync(path.join(ROOT, s + '.html'), 'utf8'));
calcs.forEach((h, i) => eq((i ? 'cgpa' : 'gpa') + ': the places are after the calculator, never inside it', h.indexOf('data-slot="guide-mid"') > h.indexOf('</section>', h.indexOf('class="cc"')), true));
const hubHtml = fs.readFileSync(path.join(ROOT, 'guide.html'), 'utf8');
eq('the guide hub (a list of links) carries no ad place', /data-slot=/.test(hubHtml), false);

// ----- the pages: ad places are away from the tools -----
const card = fs.readFileSync(path.join(ROOT, 'card.html'), 'utf8');
const ai = card.indexOf('data-slot="card-end"');
eq('the card page has its place', ai > 0, true);
eq('the card place comes after the opinion board and just before the end of the main part', card.indexOf('id="feedback"') < ai && card.indexOf('</main>') > ai && card.indexOf('</main>') - ai < 80, true);
eq('the card place is not inside the download popup or the preview', !/id="dlOv"[^]*data-slot="card-end"[^]*id="toast"/.test(card) || card.indexOf('id="dlOv"') > ai, true);
eq('the card page loads ads.js (deferred)', /<script src="\/ads\.js\?v=2" defer><\/script>/.test(card), true);
eq('no page puts a place inside a button, a form or a label', pages.every(([f, h]) => !/<(button|form|label)[^>]*>(?:(?!<\/\1>)[^])*data-slot=/.test(h)), true);
eq('no page loads Google\'s ad script by itself', pages.every(([f, h]) => !/pagead2\.googlesyndication\.com/.test(h)), true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
