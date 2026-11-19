// The game "অঙ্ক স্প্রিন্ট": its questions and points (sprint-data.js) and its page (sprint.html, sprint.css).   node tools/tests/test_sprint_page.js
const R = require('./_release.js');
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
let pass = 0, fail = 0;
const yes = (name, v, extra) => { const ok = !!v; ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  ' + (extra || ''))); };
const S = require('../../sprint-data.js'), html = read('sprint.html'), css = read('sprint.css');

// the answer of every kind, worked out again from the numbers in the question (not from the generator's own answer)
const again = q => { const a = q.args; switch (q.kind) {
  case 'add': return a[0] + a[1]; case 'sub': return a[0] - a[1]; case 'times': case 'mul2': return a[0] * a[1]; case 'div': return a[0] / a[1];
  case 'square': return a[0] * a[0]; case 'percent': return a[0] * a[1] / 100; case 'mixed': return a[0] * a[1] + a[2] * a[3];
  case 'gcd': { let x = a[0], y = a[1]; while (y) { const t = y; y = x % y; x = t; } return x; }
  case 'neg': return a[0] + a[1]; case 'sqrt': return Math.sqrt(a[0]); case 'cube': return a[0] ** 3; case 'linear': return (a[2] - a[1]) / a[0];
  case 'percent2': return a[0] + a[0] * a[1] / 100; case 'diffsq': return a[0] * a[0] - a[1] * a[1]; case 'sq2': return a[0] * a[0] + a[1] * a[1]; } return NaN; };
const all = []; for (const L of S.levelKeys()) for (let seed = 0; seed < 40; seed++) for (let n = 0; n < 60; n++) all.push([L, S.question(L, 'seed' + seed, n)]);
yes('the three levels exist (শ্রেণি ৩-৫, ৬-৮, ৯-১০) and every level has a mix of question kinds that exist', S.levelKeys().join() === 'c3,c6,c9' && Object.keys(S.MIX).every(L => S.MIX[L].every(k => S.KINDS[k])));
yes('the answer of every one of ' + all.length + ' questions is right: worked out again from the numbers of the question', all.every(([L, q]) => again(q) === q.answer && Number.isInteger(q.answer)), JSON.stringify(all.find(([L, q]) => again(q) !== q.answer || !Number.isInteger(q.answer))));
yes('every question has four DIFFERENT options, and the right answer is one of them', all.every(([L, q]) => q.options.length === 4 && new Set(q.options).size === 4 && q.options.includes(q.answer) && q.options.every(Number.isInteger)));
yes('no option is negative unless the answer itself is (no silly "−3" next to 12)', all.every(([L, q]) => q.answer < 0 || q.options.every(o => o >= 0)));
yes('the right answer is not always in the same place', new Set(all.map(([L, q]) => q.options.indexOf(q.answer))).size === 4 && [0, 1, 2, 3].every(i => all.filter(([L, q]) => q.options.indexOf(q.answer) === i).length > all.length * 0.15));
yes('the question is written in Bangla digits and signs, never "undefined" or "NaN"', all.every(([L, q]) => q.text.length >= 2 && !/undefined|NaN|[0-9]/.test(q.text) && !/undefined|NaN/.test(q.options.join())));
yes('every kind of every level is really used (none is dead code)', S.levelKeys().every(L => [...new Set(S.MIX[L])].every(k => all.some(([l, q]) => l === L && q.kind === k))));
const rangeOf = L => { const a = all.filter(([l]) => l === L).map(([l, q]) => Math.abs(q.answer)); return Math.max(...a); };
yes('the levels are different in size: class 3-5 answers stay under 200, class 6-8 under 700, and class 9-10 uses bigger things (squares up to 625, differences of squares)', rangeOf('c3') < 200 && rangeOf('c6') < 700 && S.MIX.c9.includes('sqrt') && S.MIX.c9.includes('linear') && S.MIX.c3.every(k => ['add', 'sub', 'times', 'div'].includes(k)));
yes('the Nth question depends only on (level, seed, N): the same ten again and again, and another seed, another level, another ten', JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => S.question('c6', 'x', n))) === JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => S.question('c6', 'x', n))) && JSON.stringify([0, 1, 2, 3, 4].map(n => S.question('c6', 'x', n).text)) !== JSON.stringify([0, 1, 2, 3, 4].map(n => S.question('c6', 'y', n).text)) && JSON.stringify([0, 1, 2, 3, 4].map(n => S.question('c6', 'x', n).text)) !== JSON.stringify([0, 1, 2, 3, 4].map(n => S.question('c3', 'x', n).text)));
yes('the question 40 can be asked first (no need to walk through the first 39): a daily sprint is the same on every phone even if one is faster', S.question('c9', '2026-11-18', 40).text === (() => { for (let n = 0; n < 40; n++) S.question('c9', '2026-11-18', n); return S.question('c9', '2026-11-18', 40).text; })());
yes('the points: 10 a right answer; every 5 in a row adds 5 more to the next ones, up to +15 (10, 15, 20, 25) and no more', [0, 1, 4].every(s => S.points(s) === 10) && S.points(5) === 15 && S.points(9) === 15 && S.points(10) === 20 && S.points(15) === 25 && S.points(40) === 25);
yes('the Bangladesh day is the seed of the daily sprint: 23:30 in Dhaka is still the 18th, midnight is the 19th', S.dayKey(Date.UTC(2026, 10, 18, 17, 30)) === '2026-11-18' && S.dayKey(Date.UTC(2026, 10, 18, 18, 0)) === '2026-11-19');
yes('the words at the end fit the score (no empty or odd verdict for 0, 7, 15, 25, 35)', [0, 7, 15, 25, 35].every(n => S.verdict(n).length > 10) && new Set([0, 7, 15, 25, 35].map(S.verdict)).size === 5);

// the page
yes('it is a normal page of the site (title, canonical, share tags, nav, footer, analytics, the data file before the script), kept out of search while the league is hidden (indexable once it is public)', /<title>অঙ্ক স্প্রিন্ট/.test(html) && /rel="canonical" href="https:\/\/protishthan\.com\/sprint"/.test(html) && /og:title/.test(html) && R.noindexOk(html) && /nav\.js/.test(html) && /footer\.js/.test(html) && /analytics\.js/.test(html) && html.indexOf('sprint-data.js') < html.indexOf('window.SprintData'));
yes('60 seconds from the clock of the phone (performance.now and a deadline, not a counter that drifts), a 3 second count before it, the buttons lock after an answer, the game ends by itself at the deadline', /performance\.now\(\) \+ S\.SECONDS \* 1000/.test(html) && /let c = 3/.test(html) && /if\(G\.locked \|\| G\.over\) return; G\.locked = true/.test(html) && /if\(left <= 0\) finish\(false\)/.test(html) && /if\(!G\.over\) nextQ\(\)/.test(html));
yes('a right answer goes on after 0.14 s, a wrong one shows the right option for 0.42 s; keys 1 to 4 answer too', /good \? 140 : 420/.test(html) && /'1234'\.indexOf\(e\.key\)/.test(html) && /classList\.add\(good \? 'right' : 'wrong'\)/.test(html));
yes('the points are those of SprintData (10 plus the row), a wrong answer takes nothing away and only breaks the row', /S\.points\(G\.streak\)/.test(html) && /else G\.streak = 0/.test(html) && !/G\.score -=/.test(html) && !/G\.score = Math\.max/.test(html));
yes('two ways to play: the daily sprint (the seed is the day; played once, the result is shown again) and a free one (a new seed every time); the level is remembered', /seed: kind === 'daily' \? TODAY : String\(Date\.now\(\)\)/.test(html) && /r\.today\[G\.level\] = \{ day: TODAY/.test(html) && /ls\.set\('sp_level'/.test(html) && /id="spDaily"/.test(html) && /id="spFree"/.test(html));
yes('the best score per level and the day result are kept in the browser only; a new best is told', /r\.best\[G\.level\] = G\.score/.test(html) && /ls\.set\('sp_rec'/.test(html) && /নতুন সেরা রেকর্ড/.test(html));
yes('it shares a short text (WhatsApp, Facebook, copy) with the level, the right answers and the points, tracks view, start, done and share, and says honestly that the score is not on the league boards', /wa\.me\/\?text=/.test(html) && /facebook\.com\/sharer/.test(html) && ['sprint_view', 'sprint_start', 'sprint_done', 'sprint_share'].every(e => html.includes("'" + e + "'")) && /লিগের বোর্ডে যোগ হয় না/.test(html));
yes('nothing is sent anywhere: no sign-in, no network call (no fetch, no rpc, no supabase)', !/fetch\(|rpc\(|supabase|signIn/.test(html.replace(/<script src[^>]*><\/script>/g, '')));
yes('real buttons, big tap targets, a one-column level list on the phone, no zoom delay on taps, motion reduced when asked', /<button type="button" class="sp-opt"/.test(html) && /min-height:6[48]px/.test(css) && /\.sp-lv\{grid-template-columns:1fr\}/.test(css) && /touch-action:manipulation/.test(css) && /prefers-reduced-motion/.test(css));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
