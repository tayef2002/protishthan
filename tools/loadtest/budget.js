// Step 6 of the league: the REQUEST BUDGET of a match, worked out from the polling rhythm of challenge.html (the cadences below are pinned to the page by test_challenge_page.js).
//   node tools/loadtest/budget.js [players=100] [matches per day=3] [other function requests per day=?]
// Two different things are counted, because they hit two different limits:
//   edge   = requests to protishthan.com/api/* (Cloudflare Pages Functions): the FREE plan allows 100,000 a day for the whole site, and when it is used up every function route answers 404 until 00:00 UTC.
//   db     = calls straight to the database (Supabase REST): no daily cap, but the small free server has a speed limit (probe.mjs measured it).
const players = Number(process.argv[2]) || 100, perDay = Number(process.argv[3]) || 3, other = Number(process.argv[4]);
const LOBBY = 300, LIVE = 12 * 14, DONE_POLLS = 3;
const poll = { far: 45, lobby: 5.75, last20: 2.75, live: 2.75 };      // seconds between two state reads (the middle of the random spread)
const perPlayer = {
  edge: {
    time: 4 + Math.ceil((LOBBY + LIVE) / 300) * 4 + 0,                      // 4 samples when the page opens, 4 more every 5 minutes
    state: Math.ceil((LOBBY - 20) / poll.lobby) + Math.ceil(20 / poll.last20) + Math.ceil(LIVE / poll.live) + DONE_POLLS
  },
  db: { me: 2, join: 1, questions: 1, answers: 12, result: 1 }
};
const edge = perPlayer.edge.time + perPlayer.edge.state, db = Object.values(perPlayer.db).reduce((a, b) => a + b, 0);
const per = n => n.toLocaleString('en-US');
console.log('one player, one match: ' + edge + ' edge requests (time ' + perPlayer.edge.time + ' + state reads ' + perPlayer.edge.state + '), ' + db + ' database calls');
console.log(players + ' players: ' + per(edge * players) + ' edge requests per match, ' + per(db * players) + ' database calls');
const quota = 100000;
console.log('free daily quota ' + per(quota) + ': about ' + Math.floor(quota / (edge * players)) + ' matches of ' + players + ' players a day if the game were the ONLY user of it');
if (other >= 0) console.log('with ' + per(other) + ' other function requests a day, room for ' + Math.max(0, Math.floor((quota - other) / (edge * players))) + ' matches');
console.log(perDay + ' matches a day would use ' + per(perDay * edge * players) + ' edge requests (' + Math.round(perDay * edge * players / quota * 100) + '% of the free quota)');
// the peaks that matter for the database (calls per second, worst moment)
const answerPeak = Math.round(players / 4), statePeak = Math.ceil(players / poll.live / 1), resultPeak = Math.round(players / 5), questionsPeak = Math.round(players / 1.8);
console.log('\npeaks on the database (calls per second, spread as the page spreads them): questions ' + questionsPeak + ', answers ~' + answerPeak + ' (most answer in the first 4 s of a 12 s window), results ' + resultPeak + (statePeak ? ', direct state reads ' + statePeak + ' (only when the edge is not used)' : ''));
const worst = Math.max(questionsPeak, answerPeak, resultPeak), TESTED = 125;
console.log('measured: the database answered ' + TESTED + ' calls a second with a flat 75 ms (10 parallel workers, probe.mjs). The worst peak here is ~' + worst + ' a second: ' + (worst <= TESTED * 0.6 ? 'well inside what was measured.' : worst <= TESTED ? 'inside what was measured, with little room.' : 'ABOVE what was measured: run probe.mjs with more workers (and ask the owner first) before a match of this size.'));
