// Makes the puzzles of শব্দ-জোড়া from the word list (lexicon.js) and writes wordcross-data.js.      node tools/wordcross/gen.js
// A puzzle = one word across with one or two EMPTY cells; each empty cell is the crossing with a word down. The player must find the syllable that makes BOTH words right.
// Every puzzle is checked here: the answers make real words of the list, and NO other syllable makes all the crossing words right (the answer is the only one the list knows).
const fs = require('fs'), path = require('path');
const lex = require('./lexicon.js');

// ---- cutting a word into its cells (a consonant with its vowel sign, a conjunct with its sign, or an independent vowel)
const HAS = '্', NUKTA = '়';
const CONS = '[ক-হৎ]';
const CELL = new RegExp('(?:[অ-ঔ]|' + CONS + NUKTA + '?(?:' + HAS + CONS + NUKTA + '?)*[া-ৌ]?)[ঁংঃ]?', 'y');
const cut = w => { const s = w.normalize('NFC'), out = []; CELL.lastIndex = 0; while (CELL.lastIndex < s.length) { const m = CELL.exec(s); if (!m || m.index !== out.join('').length) return null; out.push(m[0]); } return out.join('') === s ? out : null; };

// ---- the list
const SKIP = new Set(['মশামাছি', 'ঘুঘুপাখি', 'বাতাবি']);       // doubtful words are left out
const words = []; const seenW = new Set(), problems = [];
for (const [cat, text] of Object.entries(lex)) for (let raw of text.split(/\s+/).filter(Boolean)) {
  const easy = raw[0] === '*'; if (easy) raw = raw.slice(1); const w = raw.normalize('NFC');
  if (SKIP.has(w) || seenW.has(w)) continue; seenW.add(w);
  const syl = cut(w); if (!syl) { problems.push('cannot cut: ' + w); continue; }
  if (syl.length < 3 || syl.length > 5) continue;       // 3 to 5 cells
  words.push({ w, syl, cat, easy });
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
const valid = new Set(words.map(x => x.w));
const inv = [...new Set(words.flatMap(x => x.syl))];
const sub = (syl, i, x) => syl.map((s, k) => k === i ? x : s).join('');
const subs = (syl, m) => syl.map((s, k) => (k in m) ? m[k] : s).join('');

let seed = 20261124;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const firstCh = s => s[0], tail = s => s.slice(-1);
const similar = (x, pool) => pool.filter(y => y !== x && (firstCh(y) === firstCh(x) || (tail(y) === tail(x) && tail(x).charCodeAt(0) >= 0x09BE)));

const isPlain = x => !x.includes(HAS), hasSign = x => /[\u09BE-\u09CC]/.test(x) || /^[\u0985-\u0994]/.test(x);
const freq = new Map(); words.forEach(x => x.syl.forEach(c => freq.set(c, (freq.get(c) || 0) + 1)));
const commonInv = inv.filter(x => freq.get(x) >= 3 && isPlain(x));      // wrong options look like real cells, not like rare conjuncts
// ---- where each cell text occurs
const at = new Map(); words.forEach((x, wi) => x.syl.forEach((s, p) => { if (!at.has(s)) at.set(s, []); at.get(s).push([wi, p]); }));
const shareTooMuch = (a, b) => { const sa = new Set(a.syl); return b.syl.filter(s => sa.has(s)).length > 1; };

const puzzles = [];
const used = new Map();           // how many times a word is used in the same level
const useOk = (lv, ...ws) => ws.every(w => (used.get(lv + w) || 0) < (lv === 1 ? 6 : 4));
const useIt = (lv, ...ws) => ws.forEach(w => used.set(lv + w, (used.get(lv + w) || 0) + 1));

// ---- level 1 and 2: one crossing
const cand = [];
for (const [s, list] of at) for (const [wa, pa] of list) for (const [wb, pb] of list) if (wa !== wb) cand.push([wa, pa, wb, pb, s]);
const crossings = shuffle(cand);
const counts = { 1: 0, 2: 0, 3: 0 }, WANT = { 1: 260, 2: 220, 3: 120 };
for (const [wa, pa, wb, pb, ans] of crossings) {
  const A = words[wa], B = words[wb];
  if (shareTooMuch(A, B)) continue;
  const lv = (A.easy && B.easy && A.syl.length === 3 && B.syl.length === 3) ? 1 : (A.syl.length <= 4 && B.syl.length <= 4 ? 2 : 0);
  if (!lv || counts[lv] >= WANT[lv] || !useOk(lv, A.w, B.w)) continue;
  if (lv === 1 && !(hasSign(ans) && isPlain(ans))) continue;
  if (lv === 2 && A.easy && B.easy && rnd() < 0.5) continue;      // keep the easy words for level 1
  // the only syllable that makes both words
  let amb = false; const halfA = [], halfB = [];
  for (const x of inv) { if (x === ans) continue; const va = valid.has(sub(A.syl, pa, x)), vb = valid.has(sub(B.syl, pb, x)); if (va && vb) { amb = true; break; } if (va) halfA.push(x); else if (vb) halfB.push(x); }
  if (amb) continue;
  const n = lv === 1 ? 4 : 6, chosen = [];
  const add = x => { if (x && x !== ans && !chosen.includes(x) && chosen.length < n - 1) chosen.push(x); };
  add(shuffle(halfA.filter(x => commonInv.includes(x)))[0]); add(shuffle(halfB.filter(x => commonInv.includes(x)))[0]);          // traps: right for one word, wrong for the other
  for (const x of shuffle(similar(ans, commonInv))) add(x);
  for (const x of shuffle(commonInv)) add(x);
  // none of the wrong options may make both words (checked again, they come from inv)
  if (chosen.some(x => valid.has(sub(A.syl, pa, x)) && valid.has(sub(B.syl, pb, x)))) continue;
  const opts = shuffle([ans, ...chosen]);
  puzzles.push({ l: lv, h: { s: A.syl, b: [pa] }, v: [{ s: B.syl, j: pb, at: pa }], a: [ans], o: opts, k: [A.cat, B.cat] });
  counts[lv]++; useIt(lv, A.w, B.w);
}

// ---- level 3: two crossings on one word across
const bigs = shuffle(words.map((x, i) => i).filter(i => words[i].syl.length >= 4));
outer: for (const wi of bigs) {
  if (counts[3] >= WANT[3]) break;
  const H = words[wi];
  for (let i1 = 0; i1 < H.syl.length; i1++) for (let i2 = i1 + 2; i2 < H.syl.length; i2++) {
    const l1 = shuffle(at.get(H.syl[i1]).filter(([w]) => w !== wi)), l2 = shuffle(at.get(H.syl[i2]).filter(([w]) => w !== wi && true));
    for (const [w1, j1] of l1.slice(0, 6)) for (const [w2, j2] of l2.slice(0, 6)) {
      if (w1 === w2) continue;
      const V1 = words[w1], V2 = words[w2];
      if (shareTooMuch(H, V1) || shareTooMuch(H, V2) || !useOk(3, H.w, V1.w, V2.w)) continue;
      const a1 = H.syl[i1], a2 = H.syl[i2]; if (a1 === a2 || !isPlain(a1) || !isPlain(a2) || !(hasSign(a1) || hasSign(a2))) continue;
      let amb = false;
      for (const x of inv) {
        if (x !== a1 && valid.has(subs(H.syl, { [i1]: x })) && valid.has(sub(V1.syl, j1, x))) { amb = true; break; }
        if (x !== a2 && valid.has(subs(H.syl, { [i2]: x })) && valid.has(sub(V2.syl, j2, x))) { amb = true; break; }
      }
      if (amb) continue;
      const chosen = [], add = x => { if (x && x !== a1 && x !== a2 && !chosen.includes(x) && chosen.length < 4) chosen.push(x); };
      for (const x of shuffle(similar(a1, commonInv)).slice(0, 2)) add(x); for (const x of shuffle(similar(a2, commonInv)).slice(0, 2)) add(x); for (const x of shuffle(commonInv)) add(x);
      const ok = chosen.every(x => !(valid.has(subs(H.syl, { [i1]: x })) && valid.has(sub(V1.syl, j1, x))) && !(valid.has(subs(H.syl, { [i2]: x })) && valid.has(sub(V2.syl, j2, x))));
      if (!ok) continue;
      puzzles.push({ l: 3, h: { s: H.syl, b: [i1, i2] }, v: [{ s: V1.syl, j: j1, at: i1 }, { s: V2.syl, j: j2, at: i2 }], a: [a1, a2], o: shuffle([a1, a2, ...chosen]), k: [H.cat, V1.cat, V2.cat] });
      counts[3]++; useIt(3, H.w, V1.w, V2.w);
      continue outer;
    }
  }
}

// ---- the final check of every puzzle
const bad = [];
puzzles.forEach((p, n) => {
  const H = p.h.s.join(''); if (!valid.has(H)) bad.push(n + ' H not a word');
  p.v.forEach(v => { if (!valid.has(v.s.join(''))) bad.push(n + ' V not a word'); });
  p.h.b.forEach((b, t) => { if (p.h.s[b] !== p.a[t] || p.v[t].s[p.v[t].j] !== p.a[t]) bad.push(n + ' answer is not in both words'); });
  if (new Set(p.o).size !== p.o.length || p.a.some(a => !p.o.includes(a)) || p.o.length !== (p.l === 1 ? 4 : 6)) bad.push(n + ' options');
  p.h.b.forEach((b, t) => { for (const x of p.o) if (x !== p.a[t]) { const vh = valid.has(sub(p.h.s, b, x)), vv = valid.has(sub(p.v[t].s, p.v[t].j, x)); if (vh && vv) bad.push(n + ' second answer ' + x); } });
});
if (bad.length) { console.error(bad.slice(0, 20).join('\n')); process.exit(1); }
const idx = w => words.findIndex(x => x.w === w);
const first = { l: 1, h: { s: words[idx('সোহানা')].syl, b: [1] }, v: [{ s: words[idx('হামিদা')].syl, j: 0, at: 1 }], a: ['হা'], o: shuffle(['হা', 'হি', 'সা', 'মা']), k: ['নাম', 'নাম'] };
for (const x of ['হি', 'সা', 'মা']) if (valid.has(sub(first.h.s, 1, x)) && valid.has(sub(first.v[0].s, 0, x))) { console.error('the first drawing is ambiguous: ' + x); process.exit(1); }
const final = [first].concat(shuffle(puzzles.filter(p => !(p.l === 1 && p.h.s.join('') === 'সোহানা' && p.v[0].s.join('') === 'হামিদা'))));
const out = '/* made by tools/wordcross/gen.js from tools/wordcross/lexicon.js: do not edit by hand */\n(function(root){\n  var DATA = ' + JSON.stringify({ v: (() => { const body = JSON.stringify(final); let ck = 7; for (let i = 0; i < body.length; i++) ck = (ck * 31 + body.charCodeAt(i)) >>> 0; return ck.toString(36); })(), words: words.length, puzzles: final }) + ';\n  root.WC_DATA = DATA; if(typeof module !== "undefined" && module.exports) module.exports = DATA;\n})(typeof window !== "undefined" ? window : globalThis);\n';
fs.writeFileSync(path.join(__dirname, '..', '..', 'wordcross-data.js'), out);
console.log('words', words.length, '| syllables', inv.length, '| puzzles', final.length, counts, '| size', Math.round(out.length / 1024) + ' KB');
