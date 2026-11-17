// আমার শিক্ষাজীবন (edulife.js, edulife.css) on the member dashboard, and how it is wired.   node tools/tests/test_edulife.js
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
let pass = 0, fail = 0;
const yes = (name, v) => { const ok = !!v; ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name); };
const js = read('edulife.js'), css = read('edulife.css'), mem = read('member.html'), mjs = read('member.js'), card = read('card.html'), my = read('myinst.js');

// the levels are the card's levels, with the card's own keys, so one list is both
const cardKeys = [...card.matchAll(/\{ key:'(\w+)'/g)].map(m => m[1]);
const lifeKeys = [...js.matchAll(/\{ k: '(\w+)', t: '/g)].map(m => m[1]);
yes('the list runs from primary to masters and every key is a key of the card (psc, jsc, school, college, diploma, bachelor, masters)', JSON.stringify(lifeKeys) === JSON.stringify(['psc', 'jsc', 'school', 'college', 'diploma', 'bachelor', 'masters']) && lifeKeys.every(k => cardKeys.includes(k)));
yes('the list reads and writes the SAME row the card keeps: member_cards.data.edu[key], with the fields the card restores (name, district, year, current, slug, yAuto, track, tManual)', /from\('member_cards'\)/.test(js) && /d\.edu\[k\]/.test(js) && /\{ name: '', district: '', year: '', current: false, slug: '', yAuto: false, track: 'g', tManual: false \}/.test(js));
yes('a save reads the newest copy first and keeps everything else on the card (name, photo, theme, the other levels), and stamps the card newer so the card page takes it', /select\('data,saved_at'\)\.maybeSingle\(\)/.test(js) && /d\.savedAt = Date\.now\(\)/.test(js) && /saved_at: d\.savedAt/.test(js) && /Object\.assign\(emptyRow\(\), d\.edu\[k\] \|\| \{\}, row\)/.test(js));
yes('a person who has no card yet can still add levels (a card is started from the list)', /\{ badges: \[\], theme: 'night', format: 'post', name: '' \}/.test(js));
yes('the institution is picked from the directory (listed, with a tick) or typed (kept as typed, at least 3 letters); the Bangla spelling normaliser of the card is used when it is there', /rpc\('directory_search'/.test(js) && /BnName\.norm/.test(js) && /name\.length < 3/.test(js) && /তালিকা থেকে না বেছে নিলে নিজের লেখাই থাকবে/.test(js));
yes('the year goes up to now + 6 like the card, "still studying" is a tick, a level can be removed (with a question)', /for\(let y = NOW \+ 6; y >= 1950; y--\)/.test(js) && /এখনও পড়ছি/.test(js) && /confirm\(/.test(js) && /async function remove\(\)/.test(js));
yes('the two top blocks: the current institution (set from the list with one tap, change, remove) and the SSC batch (from the list, one tap to find it, or the batch the person is already in); an optional, private choice, nothing is overwritten', /member_set_institution/.test(js) && /member_clear_institution/.test(js) && /MyInst\.open\(\{ mode: 'current' \}\)/.test(js) && /MyInst\.joinSsc\(s\)/.test(js) && /শুধু আপনি দেখেন/.test(js) && /এখনও বেছে নেননি/.test(js));
yes('a failed read of the current institution says so and does not offer a wrong "not chosen yet"', /ST\.curKnown/.test(js) && /এখন পড়া যাচ্ছে না/.test(js));
yes('a card that came in at the sign-up is announced once', /el_adopted/.test(js) && /আপনার শিক্ষিত কার্ডের তথ্য এখানে বসে গেছে/.test(js));
yes('a change is told to the dashboard (the card tab) and the page reloads itself when the sheet of myinst changes the membership', /edulife:saved/.test(js) && /edulife:saved/.test(mem) && /myinst:change/.test(js) && /myinst:change/.test(my) && /joinSsc: b => quickJoin\(b\)/.test(my));
yes('the dashboard has the section, the menu item, the view, the styles and the script', /id="life"/.test(mem) && /id="lifeBox"/.test(mem) && /href: '#life'/.test(mem) && /life: \['life'\]/.test(mem) && /edulife\.css/.test(mem) && /edulife\.js/.test(mem));
yes('the phone layout stacks the row (no sideways scroll) and the page honours reduced motion', /@media\(max-width:640px\)/.test(css) && /prefers-reduced-motion/.test(css));
// the card made before the sign-up
yes('member.js takes the card of the browser into the account at sign-up: only a card with something on it, only over an older (or no) card of the account, never on the card page, once per card (no database call on every page)', /async function adoptLocalCard\(\)/.test(mjs) && /Number\(row\.saved_at\) >= lt/.test(mjs) && /\\\/card\(\\\.html\)\?\$/.test(mjs) && /el_adopt_seen/.test(mjs) && /if\(ME\) adoptLocalCard\(\)/.test(mjs));
yes('the key of the card in the browser is the card page key', /const SAVE_KEY = 'shikkhito_card_v1'/.test(card) && /'shikkhito_card_v1'/.test(mjs));
yes('no name of another person is shown anywhere in the list (it is only the member own data)', !/display_name|avatar_url/.test(js));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
