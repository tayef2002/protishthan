// The words of the sign-up popup and the sign-up gate must never hint at income or money (the owner's honesty rule: sign-up copy never promises income or tuition).
//   node tools/tests/test_signup_copy.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let pass = 0, fail = 0;
const yes = (name, v) => { const ok = !!v; ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name); };
const MONEY = /আয়|ইনকাম|টাকা|উপার্জন|কমিশন|income|earn|salary|বেতন/i;

const mjs = read('member.js'), mem = read('member.html');
const def = (mjs.match(/const DEFAULT_PERKS = (\[\[[^\n]*\]\]);/) || [])[1] || '';
yes('the default list of the sign-up popup is found and has four lines', def.split("', '").length >= 4 && /\['bookmark'/.test(def));
yes('the default list of the sign-up popup says nothing about income or money', !MONEY.test(def));
yes('the default list names only things that exist today (saving institutions, the card kept in the account, finding batchmates); the one line that is not built yet says "শীঘ্রই"', /পছন্দের প্রতিষ্ঠান সেভ/.test(def) && /শিক্ষিত কার্ড হারাবে না/.test(def) && /নিজের ব্যাচের সহপাঠীদের খুঁজে নিন/.test(def) && /ভর্তি ও ফলাফলের খবর · শীঘ্রই/.test(def));
const gate = (mem.match(/<ul class="perks">([\s\S]*?)<\/ul>/) || [])[1] || '';
yes('the sign-up gate of the profile page lists three lines and says nothing about income or money', (gate.match(/<li>/g) || []).length === 3 && !MONEY.test(gate.replace(/<[^>]+>/g, ' ')));
yes('the gate speaks of the batch in the third line', /নিজের ব্যাচের সহপাঠীদের খুঁজে নিন/.test(gate));

// every page that passes its own list to the sign-up popup (perks: [[icon, text], ...]) is held to the same rule
const files = ['batch.html', 'card.html', 'skill.html', 'memory.html', 'index.html', 'institution-detail.html', 'messages.html', 's.html', 'tutor-join.html', 'myinst.js', 'member.js'];
const found = [];
for (const f of files) for (const m of read(f).matchAll(/perks:\s*(\[\[[^\n]*?\]\])\s*[,}]/g)) found.push([f, m[1]]);
yes('the pages that pass their own list were found (batch, my institution, the card panel)', found.length >= 3);
yes('none of them says anything about income or money', found.every(([, t]) => !MONEY.test(t)));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
