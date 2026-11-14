// /memory (মেমোরি কার্ড): a page with no server part.   node tools/tests/test_memory.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
const yes = (name, v) => { v ? pass++ : fail++; console.log((v ? 'ok   ' : 'FAIL ') + name); };
const page = read('memory.html'), css = read('memory.css');
yes('the page works for anybody: no sign-in is needed to make a card, and the page asks the database nothing', !/\.rpc\(|\.from\(|fetch\(|XMLHttpRequest/.test(page.replace(/<script src="https:\/\/cdn[^>]*><\/script>/g, '')) && !/signIn\(/.test(page));
yes('it is called the Memory Card (মেমোরি কার্ড) and the card is drawn like a memory card: a cut corner, a lock notch and gold contacts', /<title>মেমোরি কার্ড/.test(page) && /MEMORY CARD/.test(page) && /c\.lineTo\(cx \+ cw - cut, cy\); c\.lineTo\(cx \+ cw, cy \+ cut\)/.test(page) && /lock notch/.test(page) && /gold contacts/.test(page));
yes('a person can make as many as they like on any memory: eight kinds of memory with starter words, a title (40), the words (160), a year, a place or person, a name, five colours; "make another" empties the form', (page.match(/\{ k: '[a-z]+', t: '[^']+', ph:/g) || []).length === 8 && /maxlength="40"/.test(page) && /maxlength="160"/.test(page) && /id="again"/.test(page) && /const THEMES = \{ blue:[^}]*violet:[^}]*teal:[^}]*amber:[^}]*rose:/.test(page));
yes('a photo is optional and stays in the browser: it is read, drawn on a canvas, never uploaded', /createImageBitmap\(f/.test(page) && /ছবি আপনার ফোনেই থাকে, আমরা সার্ভারে নিই না/.test(page) && !/upload|storage\.from/.test(page));
yes('the text never runs into the gold contacts: the body shrinks line by line and long words are cut with an ellipsis, the picture takes what the words leave', /while\(textOf\(bl\) > avail/.test(page) && /Math\.max\(150, Math\.min\(380, avail - textH - 34\)\)/.test(page));
yes('download, share (as a file, only where the device can) and a caption copy; the numbers of cards made is kept in this browser only', /a\.download = 'memory-card\.png'/.test(page) && /navigator\.share\(\{ files: \[f\]/.test(page) && /navigator\.canShare/.test(page) && /localStorage\.setItem\('mem_n'/.test(page) && /প্রতিষ্ঠান|protishthan\.com\/memory/.test(page));
yes('it is in the sitemap and linked from the batch page', /protishthan\.com\/memory</.test(read('sitemap-pages.xml')) && /href="\/memory">মেমোরি কার্ড বানান/.test(read('batch.html')));
yes('the style is mobile-first friendly (one column under 900 px) and respects reduced motion', /@media\(max-width:900px\)\{\.mc-grid\{grid-template-columns:minmax\(0,1fr\)\}/.test(css) && /prefers-reduced-motion/.test(css));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
