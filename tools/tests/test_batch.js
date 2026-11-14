// /batch (আমার ব্যাচ): the page, its rules and its wiring against the SQL file.   node tools/tests/test_batch.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);

const page = read('batch.html'), css = read('batch.css'), sql = read('migrations/2026-12-26_batches.sql'), nav = read('nav.js'), foot = read('footer.js');

// the page loads on a nested address (/b/<slug>/<level>-<year>), so every file must be found from the site root
yes('the page has <base href="/"> and loads its own files from the root', /<base href="\/">/.test(page) && /src="\/member\.js"/.test(page) && /href="\/batch\.css\?v=\d+"/.test(page) && /href="\/brand\.css/.test(page));
yes('it uses the shared top bar (the active entry is batch) and the shared footer', /id="nav"[^>]*data-active="batch"/.test(page) && /id="pfoot"/.test(page) && /\/footer\.js\?v=\d+/.test(page) && /\/nav\.js\?v=\d+/.test(page));
yes('a batch page is kept out of search (noindex), the home page is not', /setRobots\(true\)/.test(page) && /setRobots\(false\)/.test(page) && !/<meta name="robots"/.test(page) && /rel="canonical" href="https:\/\/protishthan\.com\/batch"/.test(page));

// the six batch functions and the search it calls: names and argument names are the SQL ones
const sigs = {}; for (const m of sql.matchAll(/create or replace function public\.(batch_\w+)\(([^)]*)\)/g)) sigs[m[1]] = m[2].split(',').map(x => x.trim().split(/\s+/)[0]).filter(x => /^p_/.test(x));
const calls = [...page.matchAll(/rpc\('(\w+)'(?:,\s*\{([^}]*)\})?/g)].map(m => [m[1], (m[2] || '').split(',').map(x => x.split(':')[0].trim()).filter(Boolean)]);
const batchCalls = calls.filter(c => /^batch_/.test(c[0]));
eq('the page calls exactly the six batch functions the SQL defines', [...new Set(batchCalls.map(c => c[0]))].sort(), Object.keys(sigs).filter(k => !['batch_first_name', 'batch_year_ok', 'batch_level_ok'].includes(k)).sort());
yes('every call uses the SQL parameter names', batchCalls.every(c => c[1].every(a => sigs[c[0]].includes(a))));
yes('the page may also call directory_search (the institution search), nothing else', calls.every(c => /^batch_/.test(c[0]) || c[0] === 'directory_search'));
yes('the search asks /api/dir first and falls back to the database when /api answers not found, never on a busy answer', /\/api\/dir\?f=search/.test(page) && /if\(r\.status === 404\) DIR_OFF = Date\.now\(\) \+ 600000; else throw new Error\('busy'\)/.test(page));

// levels, themes and error codes agree with the SQL
const sqlLv = (sql.match(/level in \(([^)]*)\)/) || ['', ''])[1].match(/'(\w+)'/g).map(x => x.replace(/'/g, ''));
const pgLv = [...page.matchAll(/\{ k: '(\w+)', t: /g)].map(m => m[1]);
eq('the page offers SSC only (the SSC / Dakhil school batch), and that level is one the table allows', pgLv, ['ssc']);
yes('the SQL accepts SSC only through one small function', /batch_level_ok\(l text\)[^;]*select l = 'ssc'/.test(sql.replace(/\s+/g, ' ')) && sqlLv.includes('ssc') && (sql.match(/public\.batch_level_ok\(p_level\)/g) || []).length === 2);
yes('there is no level picker on the page any more, and the card suggestions come from the card\'s secondary (SSC / Dakhil) row only', !/lvChips/.test(page) && /const map = \{ school: \{ g: 'ssc', a: 'ssc' \} \}/.test(page));
yes('the page says it is the SSC batch (title, headline, search label, year label)', /<title>আমার ব্যাচ: আপনার SSC ব্যাচ/.test(page) && /<h1>আমার ব্যাচ, <span>আমাদের গল্প<\/span><\/h1>/.test(page) && /<\/svg>SSC ব্যাচ<\/span>/.test(page) && /SSC \/ দাখিল দিয়েছেন/.test(page) && /SSC \/ দাখিল/.test(read('privacy.html')));
const sqlTh = (sql.match(/theme in \(([^)]*)\)/) || ['', ''])[1].match(/'(\w+)'/g).map(x => x.replace(/'/g, ''));
const pgTh = [...page.matchAll(/\['(\w+)', '#[0-9A-Fa-f]{6}'\]/g)].map(m => m[1]);
eq('the colours of the page are the SQL ones', pgTh.slice().sort(), sqlTh.slice().sort());
for (const t of sqlTh) yes('css has the colour ' + t, new RegExp('\\.bt-page\\[data-theme=' + t + '\\]').test(css));
const sqlErr = [...new Set([...sql.matchAll(/'error', '(\w+)'/g)].map(m => m[1]))];
const pgErr = [...(page.match(/const ERR = \{([^}]*)\}/) || ['', ''])[1].matchAll(/(\w+):/g)].map(m => m[1]);
yes('every error code the SQL can return has a Bangla message or is handled in the page (EXISTS, TOO_MANY, NOT_MEMBER aside)', sqlErr.filter(c => !pgErr.includes(c)).every(c => ['EXISTS', 'TOO_MANY', 'NOT_MEMBER'].includes(c)), JSON.stringify(sqlErr.filter(c => !pgErr.includes(c))));
yes('a database without the migration shows "coming soon", not a broken page', /MISSING = \/PGRST202/.test(page) && /শীঘ্রই চালু হচ্ছে/.test(page));

// the year is picked in a small panel of our own (no browser drop-down), reachable by keyboard
yes('the batch year is a custom picker: a button with a listbox of years (newest first), arrow keys, Escape gives the focus back, a click outside closes it, no <select> on the page', !/<select/.test(page) && /id="yearBtn"[^>]*aria-haspopup="listbox"/.test(page) && /role="listbox"/.test(page) && /ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4/.test(page) && /closeYears\(true\)/.test(page) && /\.bt-yrbox/.test(page));
yes('no coloured ring on the two fields: the focus rule removes the outline and keeps the border', /\.bt \.bt-inp:focus,\.bt \.bt-inp:focus-visible\{outline:none;border-color:var\(--ln\);box-shadow:none\}/.test(css) && /\.bt-yopt\{[^}]*outline:none\}/.test(css));

// privacy and honesty on the page
yes('the page says names and photos are for members only, the convener first name only, and that a batch is self-declared', /নাম ও ছবি শুধু ব্যাচের সদস্যরা দেখবে/.test(page) && /আহ্বায়কের নামের প্রথম অংশ/.test(page) && /স্ব-ঘোষিত, Protishthan যাচাই করে না/.test(page));
yes('the address carries only the invite code (no name, no e-mail, no phone)', /replace\(\/\[\^a-z0-9\]\/g, ''\)\.slice\(0, 16\)/.test(page) && !/[?&](email|phone|name)=/.test(page));
yes('everything written into the page goes through esc()', /const esc = s =>/.test(page) && !/innerHTML = [^;]*\+ (b\.convener|inst|line|r\.institution_name)[^a-z.(]/.test(page.replace(/esc\([^)]*\)/g, '')));
yes('the saved card is read for suggestions only (shikkhito_card_v1) and nothing is sent from it', /shikkhito_card_v1/.test(page) && !/shikkhito_card_v1[^;]*(rpc|fetch)/.test(page));
yes('after the Google round trip the wish (join or open) is remembered for at most 30 minutes and only for the same batch', /30 \* 60000/.test(page) && /v\.k\.slug === k\.slug && v\.k\.lv === k\.lv && v\.k\.year === k\.year/.test(page));
yes('join and open both need a sign-in: a visitor is sent to the member sign-in, nothing is created for them', /MB\(\)\.signIn\(/.test(page) && /if\(!signedIn\(\)\)\{ setIntent/.test(page));
yes('the invite link carries the member\'s own code and the share buttons are WhatsApp and Facebook only', /\?r=' \+ ref/.test(page) && /wa\.me\/\?text=/.test(page) && /facebook\.com\/sharer/.test(page));

// wiring
yes('the top bar has the tile (CARD group, key batch) with its icon, and the footer links the page', /k: 'batch', t: 'আমার ব্যাচ'/.test(nav) && /batch: '<svg/.test(nav) && /\['আমার ব্যাচ', 'batch\.html'\]/.test(foot));
yes('the sitemap lists /batch', /protishthan\.com\/batch</.test(read('sitemap-pages.xml')));
yes('production rewrites /b/* to the page, and the local server does the same', /\/b\/\*\s+\/batch\s+200/.test(read('_redirects')) && /\/\^\\\/b\\\/\[\^\\\/\]\+\\\/\[a-z\]\+-\\d\{4\}/.test(read('server.js')));
yes('the css follows the theme from one place (.bt-page[data-theme]), is mobile-first friendly and respects reduced motion', /prefers-reduced-motion:reduce/.test(css) && /@media\(max-width:560px\)/.test(css) && /\.bt \[hidden\]\{display:none!important\}/.test(css));

// the SQL file keeps its promises
yes('the SQL closes both tables (RLS on, no grants to anon, only select to authenticated) and every function is security definer with a pinned search_path', /enable row level security/.test(sql) && /revoke all on public\.batches, public\.batch_members from anon, authenticated/.test(sql) && (sql.match(/security definer set search_path = public/g) || []).length === 6);
yes('only batch_lookup is open to anon', /grant execute on function public\.batch_lookup\(text, text, int\) to anon, authenticated/.test(sql) && (sql.match(/to anon/g) || []).length === 1);
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);