// Is the league public or hidden right now, and with or without the batch games? Read from the menu (nav.js): the league tab is a comment while it is hidden, and CHALLENGES_LIVE says whether the
// games of a batch (challenge, rope, duel) are on. The tests of the league pages use this so that they pass in EVERY state (tools/league-release.js switches the state, and the test
// "the league is all hidden or all public" checks that nothing was left half-way).
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const nav = read('nav.js'), released = /\{ k: 'league',\s+t: 'লিগ', menu: LEAGUE/.test(nav.replace(/\/\*[\s\S]*?\*\//g, '')), chal = /var CHALLENGES_LIVE = true;/.test(nav);
const ALL = ['league', 'quiz', 'challenge', 'duel', 'guess', 'sprint', 'cricket', 'wordcross'], SOLO = ['league', 'quiz', 'guess', 'sprint', 'cricket', 'wordcross'];
const publicPages = released ? (chal ? ALL : SOLO) : [];
const NOINDEX = /<meta name="robots" content="noindex, follow">/;
module.exports = { released, chal, read, PAGES: ALL, publicPages, isPublic: p => publicPages.includes(p), noindexOk: (html, page) => publicPages.includes(page) ? !/name="robots"[^>]*noindex/.test(html) : NOINDEX.test(html) };
