// The /collaborate page: honest (no invented numbers, no payment details that do not exist), reachable (menu, footer, sitemap) and complete.
//   node tools/tests/test_collaborate.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const co = read('collaborate.html'), css = read('collaborate.css'), nav = read('nav.js'), foot = read('footer.js'), sitemap = read('sitemap-pages.xml'), about = read('about.html');
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);
const body = co.slice(co.indexOf('<main'), co.indexOf('</main>'));
const text = body.replace(/<script[^]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');

// ---- reachable
yes('indexable, canonical, in the sitemap, the footer and the "আমাদের কথা" menu', !/noindex/.test(co) && /rel="canonical" href="https:\/\/protishthan\.com\/collaborate"/.test(co) && /protishthan\.com\/collaborate</.test(sitemap) && /'collaborate\.html'/.test(foot) && /k: 'collaborate'[^}]*href: 'collaborate\.html'/.test(nav));
yes('the page highlights its own menu entry and loads the current nav, footer and styles', /data-active="collaborate"/.test(co) && /nav\.js\?v=\d+/.test(co) && /collaborate\.css\?v=\d+/.test(co));

// ---- honest: the only numbers in the visible text are the four services; the directory count is read live
const digits = (text.match(/[০-৯0-9]+/g) || []);
eq('the only figures written in the page are "৪টি" (the four services) and the numbering of steps and ways (১ to ৫)', digits.filter(d => !/^[১-৫]$/.test(d) && d !== '৪').length, 0);
yes('the directory count is not typed in: it is filled from the live question and hidden when that fails', /id="coCount" hidden/.test(co) && /\/api\/dir\?f=counts/.test(co));
yes('no payment account, phone number or amount is invented: the only contact is the e-mail already on the About page, plus the Facebook Messenger link', about.includes('teamprotishthan@gmail.com') && co.includes('teamprotishthan@gmail.com') && !/01[3-9][0-9]{8}/.test(co) && !/(বিকাশ|bKash|নগদ|Nagad|রকেট|account|অ্যাকাউন্ট নম্বর)/i.test(text));
yes('no promised result: it says outright that no outcome is guaranteed', /ফলাফলের কোনো বাড়তি প্রতিশ্রুতি আমরা দিই না/.test(co) && !/(নিশ্চিত|গ্যারান্টি দিচ্ছি|হাজার হাজার ভিজিটর)/.test(text));
yes('the promises are on the page: no selling of the verified badge or list position, sponsors always marked, no sale of phone numbers, nothing untrue, open about spending', ['তালিকার অবস্থান বিক্রি করব না', 'স্পষ্টভাবে চিহ্নিত', 'বিক্রি বা হস্তান্তর করব না', 'যা সত্য নয়, তা বলব না', 'খোলাখুলি জানাব'].every(s => text.includes(s)));

// ---- complete
yes('every section is there: opening, why, honest cost, two doors, brands (five ways), people (three ways), promises, steps, questions, last word', ['class="co-hero"', 'id="why"', 'id="cost"', 'id="ways"', 'id="brands"', 'id="people"', 'id="promise"', 'id="how"', 'id="faq"', 'id="contact"'].every(s => co.includes(s)) && (co.match(/class="co-way rv"/g) || []).length === 5 && (co.match(/class="co-p rv"/g) || []).length === 3);
yes('every in-page link has a target', [...co.matchAll(/href="#([a-z]+)"/g)].every(m => co.includes('id="' + m[1] + '"')));
yes('the mail buttons carry ready-written messages (brand, support, general) and the address can be copied', /MAILS = \{[^]*brand:[^]*support:[^]*general:/.test(co) && /data-mail="brand"/.test(co) && /data-mail="support"/.test(co) && /id="coCopy"/.test(co));
yes('links to the real pages: partner, feedback (write box), Messenger', /href="\/partner"/.test(co) && /href="\/feedback#write"/.test(co) && /m\.me\/Protishthan/.test(co));
yes('phone layout: columns collapse, buttons go full width; motion is skipped when the visitor asks for less', /@media\(max-width:940px\)/.test(css) && /@media\(max-width:640px\)/.test(css) && /\.co-hero-act \.co-btn\{width:100%\}/.test(css) && /prefers-reduced-motion:reduce/.test(css));
yes('the page is readable without JavaScript: the reveal effect only starts hidden when JS has added its class', /\.co-js \.rv\{opacity:0/.test(css) && !/^\.rv\{opacity:0/m.test(css));

// ---- the site menu: four tabs, each opening its related pages (a computer: hover or click; a phone: a sheet above the bottom bar)
yes('the main menu is four tabs in this order: প্রতিষ্ঠান খুঁজুন (a plain link), শিক্ষিত কার্ড, ভাইয়া-আপু, আমাদের কথা; the skill page lives inside the card tab', /main: \[\s*\{ k: 'info',[^}]*\},\s*\{ k: 'card',\s+t: 'শিক্ষিত কার্ড', menu: CARD \},\s*\{ k: 'tutor',\s+t: 'ভাইয়া-আপু', menu: TUTOR \},\s*\{ k: 'about',\s+t: 'আমাদের কথা', menu: ABOUT/.test(nav) && /var CARD = \[\s*\{ k: 'card'[^\n]*\n\s*\{ k: 'skill'/.test(nav) && !/\{ k: 'skill', t: 'স্কিল আইডেন্টিটি', href/.test(nav));
yes('the phone bottom bar opens a sheet from each group tab (button with aria-expanded), closes on the backdrop, a link or Escape, and the sheet is styled with the light menu colours', /class="sn-tab' \+ \(on/.test(nav) && /aria-haspopup="true" aria-expanded="false" aria-controls="sns/.test(nav) && /back\.addEventListener\('click', closeSheets\)/.test(nav) && /e\.key === 'Escape'\) closeSheets/.test(nav) && /\.sn-sheets\[data-theme=light\]/.test(read('nav.css')) && /\.sn-sheet\.open\{/.test(read('nav.css')));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
