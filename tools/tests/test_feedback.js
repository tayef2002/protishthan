// The /feedback page: it must stay the same board as the card page (same block of rules, same database functions), and its status filter / numbers must behave.
//   node tools/tests/test_feedback.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const fb = read('feedback.html'), card = read('card.html'), dir = read('functions/api/dir.js'), sql = read('migrations/2026-12-24_feedback_page.sql');
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);
const blockOf = h => { const a = h.indexOf('/* CM-START'), b = h.indexOf('/* CM-END */'); return a < 0 || b < 0 ? '' : h.slice(a, b); };

// ---- one board, two pages
yes('the rules-and-markup block is in both pages', blockOf(fb).length > 3000 && blockOf(card).length > 3000);
yes('the block is IDENTICAL to the card page\'s (change one, change both: build it from card.html)', blockOf(fb) === blockOf(card));
for (const fn of ['card_comment_add', 'card_comment_vote', 'card_comment_flag']) yes('both pages call ' + fn, fb.includes("'" + fn + "'") && card.includes("'" + fn + "'"));
yes('the posts are read through the same edge question', fb.includes("dirGet('comments'") && card.includes("f=comments"));
yes('the same browser keys, so a draft, a vote and a name carry over from the card page', ['sk_cm_name', 'sk_cm_draft', 'sk_cm_votes', 'sk_cm_rep', 'sk_dev'].every(k => fb.includes(k) && card.includes(k)));
yes('every post is written to the page as escaped text (esc) and the new-post path never uses raw body', /cmItemHtml\(\{ id:/.test(fb) && !/innerHTML = [^;]*\.body/.test(fb));

// ---- the page itself
yes('indexable page with title, description and canonical', /<title>[^<]+<\/title>/.test(fb) && /name="description"/.test(fb) && /rel="canonical" href="https:\/\/protishthan\.com\/feedback"/.test(fb) && !/noindex/.test(fb));
yes('the card page links to /feedback and the footer + sitemap list it', /href="\/feedback"/.test(card) && /feedback/.test(read('footer.js')) && /protishthan\.com\/feedback</.test(read('sitemap-pages.xml')));
yes('no invented numbers: the stats box is filled only from the database', fb.includes('<div class="fb-stats" id="fbStats" hidden></div>') && /card_comment_stats|commentstats/.test(fb));
yes('three kinds, status chips, sort, load more, report reasons, skeleton, empty and error states all exist', ['data-k="opinion"', 'data-k="idea"', 'data-k="problem"', 'fbChips', 'cmSort', 'cmMore', 'cm-sk', 'fbEmpty', 'লোড হচ্ছে না'].every(s => fb.includes(s)));
yes('phone layout: one column, full-width send, single-column kinds', /@media\(max-width:940px\)\{\s*\.fb-grid\{grid-template-columns:minmax\(0,1fr\)\}/.test(read('feedback.css')) && /\.fb-send\{width:100%\}/.test(read('feedback.css')));
yes('reduced motion respected', /prefers-reduced-motion:reduce/.test(read('feedback.css')));
yes('page does not promise a result it cannot keep (no "within N days", no "we will fix")', !/(ঘণ্টার মধ্যে|দিনের মধ্যে|ঠিক করে দেব|নিশ্চিত)/.test(fb.replace(blockOf(fb), '')));

yes('the account name of a signed-in member fills the name box on both pages (never an e-mail address), typing your own name wins, and signing out clears it', ['feedback.html', 'card.html'].every(f => { const h = read(f); return h.includes('window.Protishthan.member') && h.includes("indexOf('@') < 0") && h.includes('dataset.touched') && h.includes('M.onChange(fillName)'); }));

// ---- edge + database
yes('the edge accepts the status filter (open|review|planned|progress|done) and sends it only when used', /\['open', 'review', 'planned', 'progress', 'done'\]/.test(dir) && /if \(label\) rpc\.p_label = label;/.test(dir));
yes('the edge has the stats question', /commentstats: \{ ttl: 60/.test(dir));
yes('the migration keeps the 4-argument call working (p_label has a default) and grants the public key only the read functions', /p_label text default null/.test(sql) && /grant execute on function public\.card_comment_stats\(\) to anon/.test(sql) && /grant execute on function public\.card_comment_feed\(int, int, text, text, text\) to anon/.test(sql));
yes('stats return counts only: no name, body or device', !/c\.(name|body|device)/.test(sql.slice(sql.indexOf('create or replace function public.card_comment_stats'))));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
