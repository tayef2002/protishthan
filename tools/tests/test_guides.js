// The guide pages, the calculators' screens and the privacy page: structure, links, anchors.   node tools/tests/test_guides.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);

const PAGES = { guide: 'guide.html', gpa: 'gpa.html', cgpa: 'cgpa.html', eiin: 'eiin.html', 'choose-institution': 'choose-institution.html' };
const ROUTES = new Set(['/', '/area', '/results', '/card', '/skill', '/list-institution', '/about', '/privacy', '/terms', '/partner', '/info', ...Object.keys(PAGES).map(k => '/' + k)]);   // clean addresses the site answers

for (const [slug, file] of Object.entries(PAGES)) {
  const h = read(file);
  eq(file + ': Bangla page', /<html lang="bn">/.test(h), true);
  const t = (h.match(/<title>([^<]+)<\/title>/) || [])[1] || '';
  yes(file + ': a title of a sensible length (' + t.length + ')', t.length >= 25 && t.length <= 110 && /Protishthan/.test(t));
  const d = (h.match(/<meta name="description" content="([^"]+)"/) || [])[1] || '';
  yes(file + ': a description of a sensible length (' + d.length + ')', d.length >= 60 && d.length <= 260);
  eq(file + ': canonical is its own clean address', (h.match(/<link rel="canonical" href="([^"]+)"/) || [])[1], 'https://protishthan.com/' + slug);
  eq(file + ': exactly one h1', (h.match(/<h1[ >]/g) || []).length, 1);
  yes(file + ': not noindex (it is in the sitemap)', !/name="robots"[^>]*noindex/.test(h));
  yes(file + ': nav, footer and the shared stylesheet are there', /id="nav"/.test(h) && /id="pfoot"/.test(h) && /guide\.css/.test(h) && /footer\.js\?v=13/.test(h));
  yes(file + ': the date of the last update is written on the page', /১২ নভেম্বর ২০২৬/.test(h));
  if (slug !== 'guide') yes(file + ': a way to report a mistake', /teamprotishthan@gmail\.com/.test(h));
  // every internal link goes to a page that exists
  const hrefs = [...h.matchAll(/href="(\/[^"#?]*)(?:[#?][^"]*)?"/g)].map(m => m[1]).filter(x => !/\.(css|js|png|webp|ico|svg|woff2?)$/.test(x));
  const bad = [...new Set(hrefs)].filter(x => !ROUTES.has(x.replace(/\/$/, '') || '/'));
  eq(file + ': every internal link goes to a real page', bad, []);
  // external links are marked
  const ext = [...h.matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)].filter(m => !/protishthan\.com/.test(m[1]));
  yes(file + ': external links carry rel="noopener" (' + ext.length + ')', ext.every(m => /rel="noopener"/.test(m[0])));
  // the heading order never skips (h1, h2, h3)
  const order = [...h.matchAll(/<h([1-4])[ >]/g)].map(m => +m[1]); let skip = false; for (let i = 1; i < order.length; i++) if (order[i] > order[i - 1] + 1) skip = true;
  yes(file + ': headings do not skip a level', !skip);
  // collapsible FAQ is real HTML details with a summary
  eq(file + ': every details has a summary', (h.match(/<details/g) || []).length, (h.match(/<summary>/g) || []).length);
}

// ----- the calculators' screens: every id the script looks for is on the page -----
const gpa = read('gpa.html'), cgpa = read('cgpa.html'), ui = read('calc-ui.js');
for (const id of ['ccRows', 'ccOut', 'ccAdd', 'ccReset', 'ccFourthOn', 'ccFourthRow']) yes('gpa.html has #' + id, new RegExp('id="' + id + '"').test(gpa));
yes('gpa.html has the two mode buttons', /data-mode="marks"/.test(gpa) && /data-mode="grade"/.test(gpa));
yes('gpa.html starts in marks mode', /data-mode="marks" aria-pressed="true"/.test(gpa));
yes('gpa.html says data-calc="gpa" and loads the rules before the screen', /data-calc="gpa"/.test(gpa) && gpa.indexOf('gpa-calc.js') < gpa.indexOf('calc-ui.js'));
for (const id of ['ccRows', 'ccOut', 'ccAdd', 'ccReset', 'pc', 'pcr', 'sg', 'scr', 'ccCourses', 'ccCumul']) yes('cgpa.html has #' + id, new RegExp('id="' + id + '"').test(cgpa));
yes('cgpa.html has the two panel buttons', /data-panel="courses"/.test(cgpa) && /data-panel="cumul"/.test(cgpa));
yes('cgpa.html says data-calc="cgpa" and loads the rules before the screen', /data-calc="cgpa"/.test(cgpa) && cgpa.indexOf('gpa-calc.js') < cgpa.indexOf('calc-ui.js'));
yes('the cumulative panel starts hidden', /id="ccCumul" hidden/.test(cgpa));
yes('the screen script never puts typed text into HTML (names are only set as values)', !/innerHTML\s*=[^;]*(name|\.value)/.test(ui.replace(/say\(out[^;]*;/g, '')));
yes('the grade table on the page matches the rules in gpa-calc.js', (() => { const G = require(path.join(ROOT, 'gpa-calc.js')); const rows = [...gpa.matchAll(/<tr><td>([০-৯–]+)<\/td><td>([A-Z+\-]+)[^<]*<\/td><td>([০-৯.]+)<\/td><\/tr>/g)]; const bn = s => s.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)); return rows.length === 7 && rows.every(r => { const lo = Number(bn(r[1]).split('–')[0]); const x = G.fromMarks(lo); return x && x.g === r[2] && x.p === Number(bn(r[3])); }); })());

// ----- the privacy page: numbering and anchors -----
const pv = read('privacy.html');
const toc = [...pv.matchAll(/<a href="#([a-z]+)"><i>([০-৯])<\/i>/g)].map(m => [m[1], m[2]]);
const secs = [...pv.matchAll(/<section class="lg-sec" id="([a-z]+)"><h2><span class="n">([০-৯])<\/span>/g)].map(m => [m[1], m[2]]);
eq('the privacy contents list and the sections agree, in the same order', toc, secs);
eq('the sections are numbered ১ to ৮ in order', secs.map(s => s[1]), ['১', '২', '৩', '৪', '৫', '৬', '৭', '৮']);
yes('there is a section on ads and cookies', secs.some(s => s[0] === 'ads'));
yes('it names Google AdSense and links to the ad settings', /Google AdSense/.test(pv) && /adssettings\.google\.com/.test(pv) && /policies\.google\.com\/technologies\/partner-sites/.test(pv));
yes('it keeps the promises that stay true: no selling, no personal data to advertisers', /বিক্রি করি না, বিজ্ঞাপনদাতাকে দিই না/.test(pv));
yes('the old sentence that would be false with ads ("we do not even track for ads") is gone', !/বিজ্ঞাপনের জন্য ট্র্যাকও করি না/.test(pv));
yes('the date was moved', /হালনাগাদ: ১২ নভেম্বর ২০২৬/.test(pv));

// ----- the sitemap list and the footer -----
const sm = read('tools/seo/build_sitemap.js');
for (const slug of Object.keys(PAGES)) yes('the sitemap list has /' + slug, new RegExp("\\['/" + slug + "', '" + PAGES[slug].replace('.', '\\.') + "'\\]").test(sm));
const ft = read('footer.js');
yes('the footer links the guide and both calculators', /guide\.html/.test(ft) && /gpa\.html/.test(ft) && /cgpa\.html/.test(ft));
const stale = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).filter(f => /footer\.js\?v=12/.test(read(f)));
eq('no page still asks for the old footer.js (the new links would not show for hours)', stale, []);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
