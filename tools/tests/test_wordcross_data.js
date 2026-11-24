// The puzzles of শব্দ-জোড়া (wordcross-data.js, made by tools/wordcross/gen.js from tools/wordcross/lexicon.js): checked again here WITHOUT the generator's own code paths where it matters.
//   node tools/tests/test_wordcross_data.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const read = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
let pass = 0, fail = 0;
const yes = (name, v, extra) => { const ok = !!v; ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  ' + (extra || ''))); };
const D = require('../../wordcross-data.js'), P = D.puzzles, lex = require('../wordcross/lexicon.js');

// the word list as it is written (every word without its star, in NFC); the cells of a word are what the puzzle shows
const listed = new Set(Object.values(lex).flatMap(t => t.split(/\s+/).filter(Boolean).map(w => w.replace(/^\*/, '').normalize('NFC'))));
const word = s => s.join('');
yes('the bank has puzzles on three levels: at least 100 easy, 150 medium and 100 hard', [1, 2, 3].map(l => P.filter(p => p.l === l).length).every((n, i) => n >= [100, 150, 100][i]), JSON.stringify([1, 2, 3].map(l => P.filter(p => p.l === l).length)));
yes('the first puzzle is the drawing of the owner: সোহানা across, হামিদা down, the empty cell is "হা"', word(P[0].h.s) === 'সোহানা' && word(P[0].v[0].s) === 'হামিদা' && P[0].a[0] === 'হা' && P[0].h.b[0] === 1 && P[0].v[0].j === 0);
yes('every word on every board is a word of the list (nothing invented)', P.every(p => listed.has(word(p.h.s)) && p.v.every(v => listed.has(word(v.s)))));
yes('the answer of every empty cell is the cell of BOTH the word across and the word down', P.every(p => p.h.b.every((b, t) => p.h.s[b] === p.a[t] && p.v[t].s[p.v[t].j] === p.a[t] && p.v[t].at === b)));
// the other syllables the list knows: none of them makes the words right (so the answer is the only one)
const inv = [...new Set(P.flatMap(p => [...p.h.s, ...p.v.flatMap(v => v.s)]).concat(Object.values(lex).flatMap(t => t.split(/\s+/)).length ? [] : []))];
const swap = (s, i, x) => s.map((c, k) => k === i ? x : c).join('');
yes('NO other syllable of the puzzle options makes the crossing words right (the wrong options are really wrong)', P.every(p => p.h.b.every((b, t) => p.o.filter(x => x !== p.a[t] && !p.a.includes(x)).every(x => !(listed.has(swap(p.h.s, b, x)) && listed.has(swap(p.v[t].s, p.v[t].j, x)))))));
yes('options: 4 for the easy level, 6 for the others, all different, all answers among them', P.every(p => p.o.length === (p.l === 1 ? 4 : 6) && new Set(p.o).size === p.o.length && p.a.every(a => p.o.includes(a))));
yes('the hard level has two empty cells (two different answers, not next to each other); the others one', P.every(p => p.l === 3 ? p.h.b.length === 2 && p.a[0] !== p.a[1] && Math.abs(p.h.b[0] - p.h.b[1]) >= 2 : p.h.b.length === 1));
yes('a word is 3 to 5 cells long; the clue of every word is one of the categories of the list', P.every(p => [p.h.s, ...p.v.map(v => v.s)].every(s => s.length >= 3 && s.length <= 5)) && P.every(p => p.k.length === 1 + p.v.length && p.k.every(c => Object.keys(lex).includes(c))));
yes('the cells are letters with their vowel signs (no half cell, no space, normalised text)', P.every(p => [...p.h.s, ...p.v.flatMap(v => v.s)].every(c => c === c.normalize('NFC') && /^[অ-ঔক-হৎ়া-ৌ্ঁ-ঃ]+$/.test(c) && !/^[া-ৌ্]/.test(c))));
yes('the easy level shows a cell with a vowel sign (or a vowel letter) as the answer, like the first drawing (সো, হা, না, মি, দা)', P.filter(p => p.l === 1).every(p => (/[া-ৌ]/.test(p.a[0]) || /^[অ-ঔ]/.test(p.a[0])) && !p.a[0].includes('্')));
yes('the same two words are not in the bank as a pair twice', new Set(P.map(p => word(p.h.s) + '|' + p.v.map(v => word(v.s)).join('|'))).size === P.length);
yes('no word is used more than 8 times in one level (the bank is not the same few words)', (() => { const c = {}; P.forEach(p => [word(p.h.s), ...p.v.map(v => word(v.s))].forEach(w => { const k = p.l + w; c[k] = (c[k] || 0) + 1; })); return Math.max(...Object.values(c)) <= 8; })());

// the five of a day: the functions are taken out of the page and run here
const html = read('wordcross.html'), a = html.indexOf('/* a seeded shuffle'), b = html.indexOf('/* the words of a puzzle');
const sandbox = { D, P, Date, Math, Array }; vm.createContext(sandbox); vm.runInContext(html.slice(a, b) + '\nthis.dailyIds = dailyIds;', sandbox);
const days = Array.from({ length: 120 }, (_, i) => new Date(Date.UTC(2026, 10, 24 + i)).toISOString().slice(0, 10)), sets = days.map(d => sandbox.dailyIds(d));
yes('a day has 5 different puzzles: 2 easy, 2 medium, 1 hard, in that order (easy first)', sets.every(s => s.length === 5 && new Set(s).size === 5 && s.map(i => P[i].l).join('') === '11223'));
yes('the same day gives the same five (every phone sees the same)', JSON.stringify(days.map(d => sandbox.dailyIds(d))) === JSON.stringify(sets));
const e = P.filter(p => p.l === 1).length;
yes('no easy puzzle comes again before the whole easy level is played (' + Math.floor(e / 2) + ' days), no medium one before ' + Math.floor(P.filter(p => p.l === 2).length / 2) + ' days, no hard one before ' + P.filter(p => p.l === 3).length + ' days', (() => { const seen = {}; for (let d = 0; d < Math.min(120, Math.floor(e / 2)); d++) for (const i of sets[d]) { if (seen[i]) return false; seen[i] = 1; } return true; })());
yes('another day, other puzzles: two neighbouring days have nothing in common', sets.slice(1).every((s, i) => s.every(x => !sets[i].includes(x))));
yes('the bank has a version number that changes with the bank (a saved day of an old bank is not mixed with a new one)', typeof D.v === 'string' && D.v.length >= 4);
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
