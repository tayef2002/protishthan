// আমার প্রতিষ্ঠান: the join sheet and the directory counts (myinst.js, myinst.css) against the SQL they call (migrations/2027-01-06_my_institution.sql).   node tools/tests/test_myinst.js
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);
const js = read('myinst.js'), css = read('myinst.css'), sql = read('migrations/2027-01-06_my_institution.sql'), idx = read('index.html'), det = read('institution-detail.html'), batch = read('batch.html');

// the calls and their argument names are the SQL ones
const sigs = {}; for (const m of sql.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)) sigs[m[1]] = m[2].split(',').map(x => x.trim().split(/\s+/)[0]).filter(x => /^p_/.test(x));
const calls = [...js.matchAll(/rpc\('(\w+)'(?:,\s*\{([^}]*)\})?/g)].map(m => [m[1], (m[2] || '').split(',').map(x => x.split(':')[0].trim()).filter(Boolean)]);
const named = calls.filter(c => ['institution_members', 'institution_batches', 'member_join_batch'].includes(c[0]));
yes('the page calls institution_members, institution_batches, member_join_batch and batch_me, with the SQL argument names', named.length >= 3 && named.every(c => c[1].every(a => (sigs[c[0]] || []).includes(a))) && /rpc\('batch_me'\)/.test(js));
eq('the three new calls are exactly what the SQL defines for the public and the member', ['institution_batches', 'institution_members', 'member_join_batch'].map(n => !!sigs[n]), [true, true, true]);
yes('the join sends the level, the year, the private status and the invite code, and the answer errors are all shown in words (ONE_PER_LEVEL names the batch the person is already in)', /p_level: c\.level, p_year: c\.year, p_status: status, p_ref: refCode\(\)/.test(js) && /ONE_PER_LEVEL/.test(js) && /RATE:/.test(js) && /TOO_MANY:/.test(js) && /একটা স্তরে একটাই ব্যাচ/.test(js));

// what the person sees
yes('only the SSC (Dakhil) batch is offered: opening a batch asks one thing (the year the classmates sat SSC), no level is chosen; the three private statuses (পড়েছি, এখনও পড়ছি, শেষ করতে পারিনি) are offered and said to be private', /level: 'ssc'/.test(js) && /SSC \(বা দাখিল\) দিয়েছে বা দেবে/.test(js) && !/id="miLv"/.test(js) && /\['studied', 'পড়েছি'\], \['studying', 'এখনও পড়ছি'\], \['left_early', 'শেষ করতে পারিনি'\]/.test(js) && /এটা শুধু আপনি দেখবেন/.test(js));
yes('the sheet lists the batches already opened (year, level, name, members, the convener first name, "you are here") and offers a new batch of one\'s own', /আপনার ব্যাচের লোকজন কি আগে থেকেই এখানে/.test(js) && /নতুন ব্যাচ খুলি/.test(js) && /আহ্বায়ক: /.test(js) && /আপনি আছেন/.test(js));
yes('a dropout is told to give the year his classmates finished (so everybody lands in one batch)', /ঝরে পড়লেও আপনার বন্ধুদের সালটাই দিন/.test(js));
yes('zero members reads "প্রথম সদস্য হোন", never "০ জন"; the count says "জন যুক্ত"', /এখনও কেউ নেই, প্রথম হোন/.test(js) && /জন যুক্ত/.test(js) && !/০ জন/.test(js));
yes('no name of a person is shown: only counts and the convener first name that comes from the SQL', !/display_name|\.email|avatar/.test(js));

// the doors
yes('a signed-out visitor is sent to the Google sign-in with the institution named, and comes back to the same place (the intent is kept for 30 minutes)', /m\.signIn\(/.test(js) && /localStorage\.setItem\(INTENT/.test(js) && /30 \* 60 \* 1000/.test(js) && /async function resume\(\)/.test(js));
yes('the directory cards get the count and the button without changing the card renderers (found by the card links, new cards seen by a watcher), one call per 40 institutions, a failed call is asked again later', /MutationObserver/.test(js) && /a\.inst-card\[href\*="institution-detail"\]/.test(js) && /i \+= 40/.test(js) && /asked\.delete\(s\)/.test(js));
yes('the join pill stops the card link from opening (click and Enter), and is a role=button for screen readers', /e\.preventDefault\(\); e\.stopPropagation\(\)/.test(js) && /role="button" tabindex="0"/.test(js));
yes('an institution page gets the same block under its badges', /box\.id = 'miHero'/.test(js) && /getElementById\('heroBadges'\)/.test(js));
yes('the home page and the institution page load the script and the styles (after member.js)', /\/myinst\.js\?v=4/.test(idx) && /\/myinst\.css\?v=4/.test(idx) && /\/myinst\.js\?v=4/.test(det) && /\/myinst\.css\?v=4/.test(det) && idx.indexOf('member.js') < idx.indexOf('myinst.js') && det.indexOf('member.js') < det.indexOf('myinst.js'));
yes('the sheet is a bottom sheet on a phone and a centred card on a computer, closes with the cross, the dark area and Escape, and respects reduced motion', /@media\(min-width:640px\)\{\.mi-ov\{align-items:center\}/.test(css) && /Escape/.test(js) && /e\.target === ov/.test(js) && /prefers-reduced-motion/.test(css));
yes('the batch page names every level (primary, JSC, SSC, HSC, degree, masters) so a batch of any level opens', /const LV = \[\{ k: 'psc'/.test(batch) && /k: 'masters'/.test(batch));

// joining is never mandatory: the pick step and the invitation
const member = read('member.html');
yes('the pick step finds the institution by name with the directory search (a name of at least 2 letters, 8 results), says what to do when nothing is found, and can be skipped', /rpc\('directory_search', \{ p_q: v, p_limit: 8 \}\)/.test(js) && /v\.length < 2/.test(js) && /প্রতিষ্ঠানটা তালিকায় যোগ করুন/.test(js) && /আপনার ব্যাচ খুঁজে নিন/.test(js) && /এখন নয়, পরে করব/.test(js) && /এটা না করলেও সাইটের সবকিছু আগের মতোই ব্যবহার করতে পারবেন/.test(js));
yes('the invitation after a sign-in is not a wall: it backs off after a skip (7 days, then 30 days, then it stops after three), shows only when the answer of batch_me is real and empty, and never in front of the sheet', /s\.n < 3 && \(s\.n === 0 \|\| Date\.now\(\) - s\.t > \(s\.n === 1 \? 7 : 30\) \* 864e5\)/.test(js) && /if\(!r\.error && Array\.isArray\(r\.data\)\) nudge\(\)/.test(js) && /ov\.classList\.contains\('show'\)/.test(js) && /noteSkip\(\)/.test(js));
yes('the invitation has a cross and a button, and no part of the site waits for the choice (nothing in the script blocks a page: no redirect to the pick step)', /class="mi-nx"/.test(js) && /class="mi-nb"/.test(js) && !/location\.href = '\/(?!member)/.test(js.replace(/location\.href = '\/member'/, '')));
yes('after a sign-in the person comes back to the pick step when that is what they asked for', /pick: !ST\.slug/.test(js) && /\(it\.slug \|\| it\.pick\)/.test(js));
yes('the member page loads the script and the styles too (not the card page: its fixed bottom bar and a person who is editing are not interrupted)', /\/myinst\.js\?v=4/.test(member) && /\/myinst\.css\?v=4/.test(member) && !/myinst/.test(read('card.html')));
yes('the words that ask for an action are about the BATCH (the classmates): "ব্যাচ খুঁজুন" on the cards, "আমার ব্যাচ খুঁজুন" on the page, "আপনার ব্যাচের বন্ধুরা কি আগে থেকেই আছে?" in the invitation, the sign-in popup and the pick step say "আপনার ব্যাচ খুঁজে নিন"; the institution is only the place that holds the batches', /ব্যাচ খুঁজুন'/.test(js) && /আমার ব্যাচ খুঁজুন/.test(js) && /আপনার ব্যাচের বন্ধুরা কি আগে থেকেই আছে/.test(js) && /title: 'আপনার ব্যাচ খুঁজে নিন'/.test(js) && !/data-mi-join="' \+ esc\(slug\) \+ '">যুক্ত হোন</.test(js));   // the last button of the sheet still says যুক্ত হোন: that is the confirm
yes('when nobody has opened a batch there, the open-a-batch button is the main button ("আমার ব্যাচ খুলি") and the list says the classmates will find you', /আমার ব্যাচ খুলি/.test(js) && /সহপাঠীরা আপনাকে খুঁজে পাবে/.test(js) && /\.mi-new\.first/.test(css));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
