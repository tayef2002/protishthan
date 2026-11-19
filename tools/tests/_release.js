// Is the league public or hidden right now? Read from the menu (nav.js): the league tab is a comment while it is hidden. The tests of the league pages use this so that they pass in BOTH states
// (tools/league-release.js switches the state, and the test "the league is all hidden or all public" checks that nothing was left half-way).
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const released = /\{ k: 'league',\s+t: 'লিগ', menu: LEAGUE/.test(read('nav.js').replace(/\/\*[\s\S]*?\*\//g, ''));
const NOINDEX = /<meta name="robots" content="noindex, follow">/;
module.exports = { released, read, noindexOk: html => released ? !/name="robots"[^>]*noindex/.test(html) : NOINDEX.test(html), PAGES: ['league', 'quiz', 'challenge', 'duel', 'guess', 'sprint', 'cricket'] };
