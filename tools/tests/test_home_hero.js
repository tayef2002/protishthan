// The home page's top headline (the hook): what it says, that it promises only what the site really has, and that search engines still see the old keyword line.   node tools/tests/test_home_hero.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);

const page = read('index.html');
const hero = (/<div class="search-hero-content">[^]*?<div class="search-panel">/.exec(page) || [''])[0];
const h1 = (/<h1>([^]*?)<\/h1>/.exec(hero) || [])[1] || '';
const sub = (/<p>([^]*?)<\/p>/.exec(hero) || [])[1] || '';
const [l1, l2] = h1.split('<br>');

yes('the home headline is a hook that fits a student looking for themselves and a guardian looking for a child: the worry as a question (admission), then, in the gradient line, the answer: find the right institution right here', l1 === 'ভর্তি নিয়ে দুশ্চিন্তা?' && l2 === '<span>সঠিক প্রতিষ্ঠান খুঁজে নিন এখানেই</span>');
// the finder card right under the hero and the first step of its dialog speak to both, so they agree with the headline (no "child" only)
const card = (/<button type="button" class="gw-cta"[^]*?<\/button>/.exec(page) || [''])[0];
const step1 = (/<h3 id="gwT">কোন ধরনের প্রতিষ্ঠান খুঁজছেন\?<\/h3><p class="gw-sub">([^<]*)<\/p>/.exec(page) || [])[1] || '';
yes('the headline, the finder card and the first step of the finder dialog all speak to both ("নিজের বা সন্তানের"): no place says "child" only', !/সন্তান/.test(h1) && /<b>নিজের বা সন্তানের জন্য প্রতিষ্ঠান খুঁজে দিন<\/b>/.test(card) && step1 === 'নিজের বা সন্তানের পড়ার স্তর অনুযায়ী বাছুন।');
yes('the long card title does not leave one word alone on a phone (balanced lines, a slightly smaller title below 640px)', /\.gw-tx b\{[^}]*text-wrap:balance\}/.test(page) && /@media\(max-width:640px\)\{[^]*?\.gw-tx b\{font-size:14\.5px\}/.test(page) && /\.gw-tx small\{[^}]*text-wrap:balance\}/.test(page));
const h1Rule = (/\.search-hero h1\{font-size:clamp\(30px,4\.4vw,54px\)[^}]*\}/.exec(page) || [''])[0];
const lineHeight = parseFloat((/line-height:([0-9.]+)/.exec(h1Rule) || [])[1]);
yes('the two headline lines have room between them: a line height of 1.2 to 1.4 (at 1.12 the matras and conjuncts of the first line touched the second line)', lineHeight >= 1.2 && lineHeight <= 1.4);
yes('there is one headline and one line under it', (page.match(/<h1>/g) || []).length === 1 && sub.length > 20);
yes('the line under it says what is inside and that it is free: the four kinds of institution, their address, admission and contact information, found by area, at no cost', /স্কুল, মাদ্রাসা, কলেজ ও কোচিং সেন্টার/.test(sub) && /ঠিকানা, ভর্তি ও যোগাযোগের তথ্য/.test(sub) && /এলাকা ধরে/.test(sub) && /বিনা খরচে/.test(sub));
yes('the hero promises only what the site has: no "best", no ranks, no guarantees, no invented numbers', !/সেরা|এক নম্বর|১ নম্বর|নম্বর ১|গ্যারান্টি|নিশ্চিত|নিশ্চয়তা|র‍্যাংক|[০-৯0-9]+\s*(জন|হাজার|লাখ|টি)/.test(h1 + ' ' + sub));
yes('the hook points at things that are really on the page: the two-question finder right below, and the search box', /onclick="gwOpen\(\)"/.test(hero + page.slice(page.indexOf('<div class="search-panel">'), page.indexOf('<div class="search-panel">') + 3000)) && /২টা প্রশ্নের উত্তর দিন, বাকিটা আমরা সাজিয়ে দেব/.test(page) && /id="mainSearch"/.test(page));
yes('the old keyword line moved out of the headline but stays in the title, the share title, the description and the footer, so search engines still see it', /<title>[^<]*বাংলাদেশের সকল শিক্ষা প্রতিষ্ঠানের তথ্যভান্ডার/.test(page) && /og:title" content="[^"]*বাংলাদেশের সকল শিক্ষা প্রতিষ্ঠানের তথ্যভান্ডার/.test(page) && /name="description" content="বাংলাদেশের মাদ্রাসা, স্কুল, কলেজ ও কোচিং সেন্টারের তথ্যভান্ডার/.test(page) && /বাংলাদেশের সকল শিক্ষা প্রতিষ্ঠানের তথ্যভান্ডার/.test(read('footer.js')));
yes('on small screens the line under the headline is hidden, so the headline alone must carry the hook and the answer (it does: worry + "এখানেই"); its two lines are balanced', /@media\(max-width:768px\)\{[^]*?\.search-hero p\{display:none\}/.test(page) && /\.search-hero h1\{[^}]*text-wrap:balance\}/.test(page) && /ভর্তি/.test(l1) && /এখানেই/.test(l2));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
