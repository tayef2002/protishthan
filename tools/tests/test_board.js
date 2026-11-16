// the boards on the card page: competition_board (migrations/2027-01-04_competition_board.sql) and its controls on card.html.   node tools/tests/test_board.js
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);
const sql = read('migrations/2027-01-04_competition_board.sql'), card = read('card.html');

yes('one read function for every board: metric card / memory / skill, period all / week, scope institution / district / division, filters division / district / type, a limit capped at 50', /competition_board\(/.test(sql) && /'card', 'memory', 'skill'/.test(sql) && /'all', 'week'/.test(sql) && /'institution', 'district', 'division'/.test(sql) && /least\(coalesce\(p_limit, 10\), 50\)/.test(sql));
yes('it answers with public numbers only: security definer, pinned search_path, granted to everyone only after revoking from public, and no person (user_id, device) comes out', /security definer set search_path = public/.test(sql) && /revoke all on function public\.competition_board/.test(sql) && /grant execute on function public\.competition_board\([^)]*\) to anon, authenticated/.test(sql) && !/returns table[^;]*(user_id|device)/.test(sql));
yes('only approved, visible listings are shown, the week is the last 7 days, and memory / skill count distinct members', /l\.status = 'approved' and coalesce\(l\.is_hidden, false\) = false/.test(sql) && /interval '7 days'/.test(sql) && /count\(distinct a\.user_id\)/.test(sql));
yes('a bad metric, period or scope returns nothing (no guessing)', /not in \('card', 'memory', 'skill'\)[\s\S]{0,200}return;/.test(sql));

yes('the card page asks competition_board first and, if the function is not run yet, hides the new controls and keeps the old board (card_leaderboard)', /sb\.rpc\('competition_board'/.test(card) && /LB_MISSING/.test(card) && /LB_NEW = false/.test(card) && /sb\.rpc\('card_leaderboard'/.test(card));
yes('the controls: scope (institution / district / division), period (all / week), division and district filters; the district list follows the division; the type buttons show only for institutions', /id="lbScope"/.test(card) && /id="lbPeriod"/.test(card) && /id="lbDivision"/.test(card) && /bdDivision\(d\) === lbDivision/.test(card) && /\.hidden = lbScope !== 'institution'/.test(card));
yes('the memory and skill boards show as a tab only when at least 3 institutions are on them, and say that only signed-in members are counted', /length >= 3\) have\.push/.test(card) && /শুধু লগইন করা সদস্যদের গোনা হয়/.test(card));
yes('the page loads the district to division list', /<script src="bd-locations\.js\?v=3"><\/script>/.test(card));
yes('a slow or failed answer cannot spoil the board: the newest request wins, a failed one is asked again twice, a good list already on screen is kept, otherwise a message with a retry button shows, and the old rows are never left under a new heading', /const my = \+\+LB_REQ/.test(card) && /if\(my !== LB_REQ\) return;/.test(card) && /lbTry < 2/.test(card) && /LB_SHOWN === viewKey && list\.querySelector\('\.lb-row'\)/.test(card) && /id="lbRetry"/.test(card) && /viewKey !== LB_SHOWN\) list\.innerHTML = /.test(card));
yes('the type buttons really hide for the district and division lists (the hidden attribute is not overridden by the button style)', /\.lb-seg\[hidden\]\{display:none\}/.test(card));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
