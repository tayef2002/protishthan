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

yes('the home headline is a hook: the guardian\'s worry as a question (the child\'s admission), then, in the gradient line, the answer: the institutions of their area are here', l1 === 'সন্তানের ভর্তি নিয়ে দুশ্চিন্তা?' && l2 === '<span>আপনার এলাকার প্রতিষ্ঠান এখানেই</span>');
yes('there is one headline and one line under it', (page.match(/<h1>/g) || []).length === 1 && sub.length > 20);
yes('the line under it says what is inside and that it is free: the four kinds of institution, their address, admission and contact information, found by area, at no cost', /স্কুল, মাদ্রাসা, কলেজ ও কোচিং সেন্টার/.test(sub) && /ঠিকানা, ভর্তি ও যোগাযোগের তথ্য/.test(sub) && /এলাকা ধরে/.test(sub) && /বিনা খরচে/.test(sub));
yes('the hero promises only what the site has: no "best", no ranks, no guarantees, no invented numbers', !/সেরা|এক নম্বর|১ নম্বর|নম্বর ১|গ্যারান্টি|নিশ্চিত|নিশ্চয়তা|র‍্যাংক|[০-৯0-9]+\s*(জন|হাজার|লাখ|টি)/.test(h1 + ' ' + sub));
yes('the hook points at things that are really on the page: the two-question finder right below, and the search box', /onclick="gwOpen\(\)"/.test(hero + page.slice(page.indexOf('<div class="search-panel">'), page.indexOf('<div class="search-panel">') + 3000)) && /২টা প্রশ্নের উত্তর দিন, বাকিটা আমরা সাজিয়ে দেব/.test(page) && /id="mainSearch"/.test(page));
yes('the old keyword line moved out of the headline but stays in the title, the share title, the description and the footer, so search engines still see it', /<title>[^<]*বাংলাদেশের সকল শিক্ষা প্রতিষ্ঠানের তথ্যভান্ডার/.test(page) && /og:title" content="[^"]*বাংলাদেশের সকল শিক্ষা প্রতিষ্ঠানের তথ্যভান্ডার/.test(page) && /name="description" content="বাংলাদেশের মাদ্রাসা, স্কুল, কলেজ ও কোচিং সেন্টারের তথ্যভান্ডার/.test(page) && /বাংলাদেশের সকল শিক্ষা প্রতিষ্ঠানের তথ্যভান্ডার/.test(read('footer.js')));
yes('on small screens the line under the headline is hidden, so the headline alone must carry the hook and the answer (it does: worry + "এখানেই"); its two lines are balanced', /@media\(max-width:768px\)\{[^]*?\.search-hero p\{display:none\}/.test(page) && /\.search-hero h1\{[^}]*text-wrap:balance\}/.test(page) && /ভর্তি/.test(l1) && /এখানেই/.test(l2));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
