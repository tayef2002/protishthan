// ONE switch for the league: make everything public together, or hide it again.
//   node tools/league-release.js status     says what state the site is in
//   node tools/league-release.js release    the menu tab "লিগ", the footer links, the home strip, the sitemap, the league card of the batch pages are ON, the noindex of the seven pages is removed
//   node tools/league-release.js hide       puts everything back (the exact opposite)
// After either: the files have new nav.js / footer.js versions on every page (so no browser keeps the old menu); then commit and push.
// The test tools/tests/test_league_page.js ("all hidden or all public") fails if anything is left half-way.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), wr = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);
const PAGES = ['league', 'quiz', 'challenge', 'duel', 'guess', 'sprint', 'cricket'];
const NOINDEX = '<meta name="robots" content="noindex, follow">';
const mode = process.argv[2] || 'status';
const today = new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);

const navRaw = rd('nav.js'), navCode = navRaw.replace(/\/\*[\s\S]*?\*\//g, '');
const isPublic = /\{ k: 'league',\s+t: 'লিগ', menu: LEAGUE/.test(navCode);
if (mode === 'status') {
  console.log('The league is ' + (isPublic ? 'PUBLIC' : 'HIDDEN') + '.');
  console.log(' menu tab: ' + isPublic + ' | footer links: ' + /league\.html/.test(rd('footer.js')) + ' | home strip: ' + /class="lgs"/.test(rd('index.html').replace(/<!--[\s\S]*?-->/g, '')) + ' | sitemap: ' + PAGES.map(p => rd('sitemap-pages.xml').includes('protishthan.com/' + p + '<') ? 1 : 0).join('') + ' | noindex on pages: ' + PAGES.map(p => rd(p + '.html').includes(NOINDEX) ? 1 : 0).join('') + ' | batch card: ' + /const LEAGUE_PUBLIC = true;/.test(rd('batch.html')));
  process.exit(0);
}
if (mode !== 'release' && mode !== 'hide') { console.error('use: status | release | hide'); process.exit(2); }
const on = mode === 'release';
if (on === isPublic) { console.error('The league is already ' + (on ? 'public' : 'hidden') + ': nothing to do.'); process.exit(1); }

// 1) the menu tab (nav.js)
const HEAD = '      /* HIDDEN until the league games are finished and made public (the pages still work by their address). To show the tab again, put this line back after the card tab:\n';
{
  let s = navRaw;
  if (on) {
    const m = s.match(/      \/\* HIDDEN until the league games[^\n]*\n\s+(\{ k: 'league',[^\n]*?)\s*\*\//);
    if (!m) throw new Error('nav.js: the hidden league line was not found');
    s = s.replace(m[0], () => '      ' + m[1]);
  } else {
    const m = s.match(/^      (\{ k: 'league',  t: 'লিগ'[^\n]*)$/m);
    if (!m) throw new Error('nav.js: the league line was not found');
    s = s.replace(m[0], () => HEAD + '         ' + m[1] + ' */');
  }
  wr('nav.js', s);
}
// 2) the footer links
{
  const L = "['প্রতিষ্ঠান লিগ', 'league.html'], ['আজকের কুইজ', 'quiz.html'], ", A = "['মেমোরি কার্ড', 'memory.html'], ";
  let f = rd('footer.js');
  if (on && !f.includes(L)) { if (!f.includes(A)) throw new Error('footer anchor'); f = f.replace(A, () => A + L); }
  if (!on) f = f.split(L).join('');
  wr('footer.js', f);
}
// 3) the home strip
{
  const STRIP = '  <style>.lgs{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:6px 0 22px;padding:16px 20px;border-radius:20px;background:linear-gradient(135deg,#0B1B4D,#4C1D95);color:#fff;text-decoration:none}.lgs b{display:block;font-size:19px;line-height:1.3}.lgs span{display:block;font-size:14px;color:#C7D2FE;line-height:1.5}.lgs div{flex:1;min-width:220px}.lgs i{font-style:normal;font-size:30px}.lgs u{text-decoration:none;font-weight:800;font-size:14.5px;background:#fff;color:#4C1D95;border-radius:100px;padding:8px 18px;white-space:nowrap}</style>\n' +
    '  <a class="lgs" href="league.html" onclick="try{window.track&&window.track(\'home_league\',{})}catch(e){}"><i>🏆</i><div><b>প্রতিষ্ঠান লিগ: আপনার স্কুল আর ব্যাচ কে এগিয়ে?</b><span>প্রতিদিনের কুইজ আর ব্যাচ চ্যালেঞ্জ খেলুন, নিজের প্রতিষ্ঠানের জন্য পয়েন্ট জমান।</span></div><u>লিগ দেখুন →</u></a>\n';
  let h = rd('index.html'); const a = h.search(/  <!-- LEAGUE STRIP[^\n]*\n/), b = h.indexOf('  <!-- INFO CARDS -->');
  if (a < 0 || b < a) throw new Error('index.html: the league strip place was not found');
  const region = on ? '  <!-- LEAGUE STRIP -->\n' + STRIP + '\n' : '  <!-- LEAGUE STRIP: HIDDEN until the league is public. To show it again, move the block below out of this comment.\n  <!-- LEAGUE STRIP --&gt;\n' + STRIP + '  -->\n\n';
  h = h.slice(0, a) + region + h.slice(b); wr('index.html', h);
}
// 4) the sitemap (the seven pages)
{
  let m = rd('sitemap-pages.xml'); const eol = m.includes('\r\n') ? '\r\n' : '\n';
  m = m.replace(new RegExp('[ ]*<url><loc>https://protishthan\\.com/(' + PAGES.join('|') + ')</loc><lastmod>[^<]*</lastmod></url>\\r?\\n', 'g'), '');
  if (on) { const after = '  <url><loc>https://protishthan.com/card</loc>'; const i = m.indexOf(after); if (i < 0) throw new Error('sitemap anchor'); const j = m.indexOf('\n', i) + 1; m = m.slice(0, j) + PAGES.map(p => '  <url><loc>https://protishthan.com/' + p + '</loc><lastmod>' + today + '</lastmod></url>' + eol).join('') + m.slice(j); }
  wr('sitemap-pages.xml', m);
}
// 5) noindex on the seven pages
for (const p of PAGES) {
  let h = rd(p + '.html'); const vp = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
  h = h.replace(new RegExp('\\r?\\n' + NOINDEX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '');
  if (!on) { if (!h.includes(vp)) throw new Error(p + ': viewport meta not found'); h = h.replace(vp, () => vp + '\n' + NOINDEX); }
  wr(p + '.html', h);
}
// 6) the league card on the batch pages
{ let b = rd('batch.html'); b = b.replace(/const LEAGUE_PUBLIC = (true|false);/, () => 'const LEAGUE_PUBLIC = ' + on + ';'); wr('batch.html', b); }
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
console.log('Done: the league is ' + (on ? 'PUBLIC' : 'HIDDEN') + '. Run the tests, then commit and push.');
