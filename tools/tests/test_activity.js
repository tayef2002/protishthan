// the competition base: district -> division map and the member action log (migrations/2027-01-03_member_actions.sql) and its hooks on the card, memory and skill pages.   node tools/tests/test_activity.js
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);

global.window = {}; new Function('window', read('bd-locations.js'))(global.window);
const BD = window.BD_LOCATIONS.map(d => d.n), MAP = window.BD_DIVISIONS;
const sql = read('migrations/2027-01-03_member_actions.sql');
const sqlMap = {}; for (const m of sql.matchAll(/^\s+\('([^']+)', '([^']+)'\),?$/gm)) sqlMap[m[1]] = m[2];

eq('every one of the 64 districts has a division in the browser list, and nothing else is in it', [BD.every(d => MAP[d]), Object.keys(MAP).length], [true, 64]);
const cnt = {}; Object.values(MAP).forEach(v => { cnt[v] = (cnt[v] || 0) + 1; });
eq('the 8 divisions have the usual number of districts (Dhaka 13, Chattogram 11, Rajshahi 8, Khulna 10, Barishal 6, Sylhet 4, Rangpur 8, Mymensingh 4)', cnt, { 'ঢাকা': 13, 'চট্টগ্রাম': 11, 'রাজশাহী': 8, 'খুলনা': 10, 'বরিশাল': 6, 'সিলেট': 4, 'রংপুর': 8, 'ময়মনসিংহ': 4 });
eq('the database list is the same as the browser list', sqlMap, MAP);
eq('a few known ones', [window.bdDivision('হবিগঞ্জ'), window.bdDivision('কক্সবাজার'), window.bdDivision('গাজীপুর'), window.bdDivision('নেত্রকোণা'), window.bdDivision('অজানা')], ['সিলেট', 'চট্টগ্রাম', 'ঢাকা', 'ময়মনসিংহ', '']);

yes('the district table is readable by everyone but only through select (no write grants), and bd_division is security definer with a pinned search_path', /grant select on public\.bd_districts to anon, authenticated/.test(sql) && /revoke all on public\.bd_districts from anon, authenticated/.test(sql) && /bd_division[\s\S]{0,200}security definer set search_path = public/.test(sql));
yes('member_actions: only card / memory / skill, one row per member + action + institution, RLS on, a member reads only their own rows, no insert or update grant to the browser', /check \(action in \('card', 'memory', 'skill'\)\)/.test(sql) && /primary key \(user_id, action, institution_slug\)/.test(sql) && /member_actions enable row level security/.test(sql) && /for select to authenticated using \(user_id = auth\.uid\(\)\)/.test(sql) && /revoke all on public\.member_actions from anon, authenticated/.test(sql) && /grant select on public\.member_actions to authenticated;/.test(sql) && !/grant (insert|update|delete)[^;]*member_actions/.test(sql));
yes('log_member_action works only for a signed-in member (not anon), takes at most 6 institutions, only listed and visible ones, and falls back to the saved card or to the plain action', /auth\.uid\(\)/.test(sql) && /if uid is null/.test(sql) && /limit 6/.test(sql) && /l\.status = 'approved' and coalesce\(l\.is_hidden, false\) = false/.test(sql) && /from public\.member_cards mc/.test(sql) && /grant execute on function public\.log_member_action\(text, text\[\]\) to authenticated;/.test(sql) && !/log_member_action[^;]*to anon/.test(sql));

const card = read('card.html'), mem = read('memory.html'), skill = read('skill.html');
yes('the card page logs a signed-in member once per page load, with the institutions on the card, and still counts anonymous people per device as before', /async function logMemberCard\(slugs\)/.test(card) && /log_member_action', \{ p_action: 'card'/.test(card) && /logMemberCard\(cardSlugs\(\)\);\n  const slugs = cardSlugs\(\)/.test(card) && /count_card_institutes/.test(card));
yes('the memory card logs a signed-in member once per page load (the institutions come from the saved card on the server)', /p_action: 'memory'/.test(mem) && /logMember\(\);/.test(mem));
yes('the skill card logs the member when the page is published', /p_action: 'skill'/.test(skill) && skill.indexOf("p_action: 'skill'") > skill.indexOf('await save({ published: true'));
yes('the pages that read the location list ask for the new version', /bd-locations\.js\?v=3/.test(read('member.html')) && /bd-locations\.js\?v=2/.test(read('tutor.html')) && /bd-locations\.js\?v=2/.test(read('tutor-join.html')));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
