// ONE switch for the league: make it public together, in two steps, or hide it again.
//   node tools/league-release.js status         says what state the site is in
//   node tools/league-release.js release        STEP 1: the menu tab "লিগ", the league page, the daily quiz, "কোন জেলায়?", "অঙ্ক স্প্রিন্ট" and "ক্রিকেট কুইজ" are public
//                                               (footer links, a strip on the home page, the sitemap, no noindex). The games of a BATCH (ব্যাচ চ্যালেঞ্জ, রশি টানাটানি, ব্যাচ ডুয়েল) stay hidden:
//                                               they need batches of 5 or more members, and there are none yet to play them.
//   node tools/league-release.js release --all  STEP 2 (or both at once): the batch games are public too (menu, league page, sitemap, the league card on every batch page)
//   node tools/league-release.js hide           puts everything back (the exact opposite)
// After any of them: new nav.js / footer.js versions on every page (so no browser keeps the old menu); run the tests; commit and push.
// The test tools/tests/test_league_page.js ("all hidden or all public") fails if anything is left half-way.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), wr = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);
const ALL = ['league', 'quiz', 'challenge', 'duel', 'guess', 'sprint', 'cricket', 'wordcross'], SOLO = ['league', 'quiz', 'guess', 'sprint', 'cricket', 'wordcross'];
const NOINDEX = '<meta name="robots" content="noindex, follow">';
const mode = process.argv[2] || 'status', withBatch = process.argv.includes('--all');
const today = new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);

const navNow = rd('nav.js'), navCode = navNow.replace(/\/\*[\s\S]*?\*\//g, '');
const tabNow = /\{ k: 'league',\s+t: 'লিগ', menu: LEAGUE/.test(navCode), chalNow = /var CHALLENGES_LIVE = true;/.test(navNow);
if (mode === 'status') {
  const state = !tabNow ? 'HIDDEN' : chalNow ? 'PUBLIC, STEP 2 (with the batch games)' : 'PUBLIC, STEP 1 (the batch games are still hidden)';
  console.log('The league is ' + state + '.');
  console.log(' menu tab: ' + tabNow + ' | batch games on: ' + chalNow + ' | footer links: ' + /league\.html/.test(rd('footer.js')) + ' | home strip: ' + /class="lgs"/.test(rd('index.html').replace(/<!--[\s\S]*?-->/g, '')) + ' | in sitemap: ' + ALL.map(p => rd('sitemap-pages.xml').includes('protishthan.com/' + p + '<') ? p[0] : '-').join('') + ' | noindex still on: ' + ALL.filter(p => rd(p + '.html').includes(NOINDEX)).join(',') + ' | batch card: ' + /const LEAGUE_PUBLIC = true;/.test(rd('batch.html')));
  process.exit(0);
}
if (!['release', 'hide'].includes(mode)) { console.error('use: status | release [--all] | hide'); process.exit(2); }
const on = mode === 'release', chal = on && withBatch, pub = on ? (chal ? ALL : SOLO) : [];

// 1) the menu tab and the switch of the batch games (nav.js)
{
  const HEAD = '      /* HIDDEN until the league games are finished and made public (the pages still work by their address). To show the tab again, put this line back after the card tab:\n';
  let s = navNow;
  if (on && !tabNow) {
    const m = s.match(/      \/\* HIDDEN until the league games[^\n]*\n\s+(\{ k: 'league',[^\n]*?)\s*\*\//);
    if (!m) throw new Error('nav.js: the hidden league line was not found');
    s = s.replace(m[0], () => '      ' + m[1]);
  } else if (!on && tabNow) {
    const m = s.match(/^      (\{ k: 'league',  t: 'লিগ'[^\n]*)$/m);
    if (!m) throw new Error('nav.js: the league line was not found');
    s = s.replace(m[0], () => HEAD + '         ' + m[1] + ' */');
  }
  if (!/var CHALLENGES_LIVE = (true|false);/.test(s)) throw new Error('nav.js: CHALLENGES_LIVE not found');
  s = s.replace(/var CHALLENGES_LIVE = (true|false);/, () => 'var CHALLENGES_LIVE = ' + chal + ';');
  wr('nav.js', s);
  let l = rd('league.html'); if (!/const CHALLENGES_LIVE = (true|false);/.test(l)) throw new Error('league.html: CHALLENGES_LIVE not found');
  wr('league.html', l.replace(/const CHALLENGES_LIVE = (true|false);/, () => 'const CHALLENGES_LIVE = ' + chal + ';'));
}
// 2) the footer links
{
  const L = "['প্রতিষ্ঠান লিগ', 'league.html'], ['আজকের কুইজ', 'quiz.html'], ", A = "['মেমোরি কার্ড', 'memory.html'], ";
  let f = rd('footer.js');
  if (on && !f.includes(L)) { if (!f.includes(A)) throw new Error('footer anchor'); f = f.replace(A, () => A + L); }
  if (!on) f = f.split(L).join('');
  wr('footer.js', f);
}
// 3) the home strip (its words depend on the step)
{
  const words = chal ? 'প্রতিদিনের কুইজ আর ব্যাচ চ্যালেঞ্জ খেলুন, নিজের প্রতিষ্ঠানের জন্য পয়েন্ট জমান।' : 'প্রতিদিনের কুইজ, কোন জেলায়?, অঙ্ক স্প্রিন্ট আর ক্রিকেট কুইজ খেলুন, নিজের প্রতিষ্ঠানের জন্য পয়েন্ট জমান।';
  const STRIP = '  <style>.lgs{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:6px 0 22px;padding:16px 20px;border-radius:20px;background:linear-gradient(135deg,#0B1B4D,#4C1D95);color:#fff;text-decoration:none}.lgs b{display:block;font-size:19px;line-height:1.3}.lgs span{display:block;font-size:14px;color:#C7D2FE;line-height:1.5}.lgs div{flex:1;min-width:220px}.lgs i{font-style:normal;font-size:30px}.lgs u{text-decoration:none;font-weight:800;font-size:14.5px;background:#fff;color:#4C1D95;border-radius:100px;padding:8px 18px;white-space:nowrap}</style>\n' +
    '  <a class="lgs" href="league.html" onclick="try{window.track&&window.track(\'home_league\',{})}catch(e){}"><i>🏆</i><div><b>প্রতিষ্ঠান লিগ: আপনার স্কুল আর ব্যাচ কে এগিয়ে?</b><span>' + words + '</span></div><u>লিগ দেখুন →</u></a>\n';
  let h = rd('index.html'); const a = h.search(/  <!-- LEAGUE STRIP[^\n]*\n/), b = h.indexOf('  <!-- INFO CARDS -->');
  if (a < 0 || b < a) throw new Error('index.html: the league strip place was not found');
  const region = on ? '  <!-- LEAGUE STRIP -->\n' + STRIP + '\n' : '  <!-- LEAGUE STRIP: HIDDEN until the league is public. To show it again, move the block below out of this comment.\n  <!-- LEAGUE STRIP --&gt;\n' + STRIP + '\n  -->\n\n';
  h = h.slice(0, a) + region + h.slice(b); wr('index.html', h);
}
// 4) the sitemap
{
  let m = rd('sitemap-pages.xml'); const eol = m.includes('\r\n') ? '\r\n' : '\n';
  m = m.replace(new RegExp('[ ]*<url><loc>https://protishthan\\.com/(' + ALL.join('|') + ')</loc><lastmod>[^<]*</lastmod></url>\\r?\\n', 'g'), '');
  if (pub.length) { const after = '  <url><loc>https://protishthan.com/card</loc>'; const i = m.indexOf(after); if (i < 0) throw new Error('sitemap anchor'); const j = m.indexOf('\n', i) + 1; m = m.slice(0, j) + pub.map(p => '  <url><loc>https://protishthan.com/' + p + '</loc><lastmod>' + today + '</lastmod></url>' + eol).join('') + m.slice(j); }
  wr('sitemap-pages.xml', m);
}
// 5) noindex: only on the pages that are not public
for (const p of ALL) {
  let h = rd(p + '.html'); const vp = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
  h = h.replace(new RegExp('\\r?\\n' + NOINDEX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '');
  if (!pub.includes(p)) { if (!h.includes(vp)) throw new Error(p + ': viewport meta not found'); h = h.replace(vp, () => vp + '\n' + NOINDEX); }
  wr(p + '.html', h);
}
// 6) the league card on the batch pages: only with the batch games
{ let b = rd('batch.html'); b = b.replace(/const LEAGUE_PUBLIC = (true|false);/, () => 'const LEAGUE_PUBLIC = ' + chal + ';'); wr('batch.html', b); }
// 7) new versions of nav.js and footer.js on every page (and in the server-made pages), so that no browser keeps the old menu
{
  const cur = Math.max(...fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).flatMap(f => (rd(f).match(/\/nav\.js\?v=(\d+)/g) || []).map(x => +x.split('=')[1])));
  const next = cur + 1; let n = 0;
  for (const f of fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).concat(['functions/_lib/seo.js'])) {
    const s = rd(f), t = s.replace(/\/nav\.js\?v=\d+/g, '/nav.js?v=' + next).replace(/\/footer\.js\?v=\d+/g, '/footer.js?v=' + next);
    if (t !== s) { wr(f, t); n++; }
  }
  console.log('nav.js / footer.js are version ' + next + ' now (' + n + ' files).');
}
console.log('Done: ' + (!on ? 'the league is HIDDEN' : chal ? 'the league is PUBLIC, step 2 (with the batch games)' : 'the league is PUBLIC, step 1 (the batch games stay hidden)') + '. Run the tests, then commit and push.');
