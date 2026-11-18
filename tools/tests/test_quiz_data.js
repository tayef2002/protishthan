// The checks of a quiz question (quiz-data.js), the import, the first batch of questions, and how the admin and reviewer pages are wired.   node tools/tests/test_quiz_data.js
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const D = require('../../quiz-data.js');
let pass = 0, fail = 0;
const yes = (name, v) => { const ok = !!v; ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name); };
const good = () => ({ topic: 'gk', band: 'any', difficulty: 2, question: 'বাংলাদেশের রাজধানীর নাম কী?', options: ['ঢাকা', 'চট্টগ্রাম', 'খুলনা', 'রাজশাহী'], answer_idx: 0, explanation: '', source: '' });
const bad = o => D.validateQuestion(Object.assign(good(), o));

// ---- the rules (the same as the SQL)
yes('a good question passes', D.validateQuestion(good()) === '');
yes('an unknown topic, a bad band, a difficulty of 4 or 1.5 are refused', !!bad({ topic: 'x' }) && !!bad({ band: 'c99' }) && !!bad({ difficulty: 4 }) && !!bad({ difficulty: 1.5 }));
yes('a question under 5 letters or over 300 is refused', !!bad({ question: 'কী' }) && !!bad({ question: 'ক'.repeat(301) }) && bad({ question: 'ক'.repeat(300) }) === '');
yes('three, five, a repeated, an empty and a too long option are refused (spaces do not make options different)', !!bad({ options: ['ক', 'খ', 'গ'] }) && !!bad({ options: ['ক', 'খ', 'গ', 'ঘ', 'ঙ'] }) && !!bad({ options: ['ক', 'ক', 'গ', 'ঘ'] }) && !!bad({ options: ['ক', ' ক ', 'গ', 'ঘ'] }) && !!bad({ options: ['ক', '  ', 'গ', 'ঘ'] }) && !!bad({ options: ['ক', 'খ', 'গ', 'ঘ'.repeat(101)] }));
yes('the answer index must be 0 to 3, a whole number', !!bad({ answer_idx: 4 }) && !!bad({ answer_idx: -1 }) && !!bad({ answer_idx: 1.2 }) && !!bad({ answer_idx: NaN }) && bad({ answer_idx: 3 }) === '');
yes('an explanation over 300 and a source over 200 are refused', !!bad({ explanation: 'ক'.repeat(301) }) && !!bad({ source: 'ক'.repeat(201) }));
yes('every problem is told in Bangla words', ['x', 'c99'].every(v => /[ক-হ]/.test(bad({ topic: v === 'x' ? 'x' : 'gk', band: v === 'c99' ? 'c99' : 'any' }))));
yes('the lists are the SQL lists (topics and bands)', JSON.stringify(D.keysOf(D.TOPICS)) === JSON.stringify(['bangla', 'english', 'math', 'science', 'gk', 'history', 'ict', 'geo', 'sports', 'school', 'puzzle']) && JSON.stringify(D.keysOf(D.BANDS)) === JSON.stringify(['any', 'c1-5', 'c6-8', 'c9-10', 'c11-12']));
const sql = read('migrations/2027-01-10_quiz_bank.sql');
yes('the topics, bands and statuses in the SQL are exactly these', D.keysOf(D.TOPICS).every(k => sql.includes("'" + k + "'")) && D.keysOf(D.BANDS).every(k => sql.includes("'" + k + "'")) && Object.keys(D.STATUS).every(k => sql.includes("'" + k + "'")));

// ---- the mix
let seq = 0; const rng = () => (seq = (seq * 7 + 3) % 10) / 10;
const m = D.shuffleOptions('ঢাকা', ['ক', 'খ', 'গ'], rng);
yes('a mixed set has the four options, and answer_idx points at the correct one', m.options.length === 4 && m.options[m.answer_idx] === 'ঢাকা' && new Set(m.options).size === 4);
const spread = {}; for (let i = 0; i < 400; i++){ const s = D.shuffleOptions('ঠিক', ['ক', 'খ', 'গ']); spread[s.answer_idx] = (spread[s.answer_idx] || 0) + 1; }
yes('over many questions the correct answer lands in every position (not always first)', [0, 1, 2, 3].every(i => spread[i] > 50));

// ---- the import
const p = D.parseImport(JSON.stringify([{ topic: 'gk', q: 'বাংলাদেশের রাজধানীর নাম কী?', correct: 'ঢাকা', wrong: ['চট্টগ্রাম', 'খুলনা', 'রাজশাহী'], source: 'সংবিধান' }, { topic: 'math', question: '২ + ২ = ?', options: ['৩', '৪', '৫', '৬'], answer_idx: 1 }]));
yes('both import forms work (correct + wrong, and options + answer_idx), the short key q works, defaults are filled (band any, difficulty 2)', p.items.length === 2 && p.errors.length === 0 && p.items[0].band === 'any' && p.items[0].difficulty === 2 && p.items[0].options[p.items[0].answer_idx] === 'ঢাকা' && p.items[1].options[p.items[1].answer_idx] === '৪');
yes('an object with a "questions" list is accepted', D.parseImport(JSON.stringify({ questions: [{ topic: 'gk', q: 'বাংলাদেশের রাজধানীর নাম কী?', correct: 'ঢাকা', wrong: ['ক', 'খ', 'গ'] }] })).items.length === 1);
yes('text that is not JSON, a non-list, an empty list and more than 500 are refused with a clear line', D.parseImport('hello').errors.length === 1 && D.parseImport('{"a":1}').errors.length === 1 && D.parseImport('[]').errors.length === 1 && D.parseImport(JSON.stringify(new Array(501).fill({}))).errors.length === 1);
const e = D.parseImport(JSON.stringify([{ topic: 'gk', q: 'ঠিক প্রশ্ন এটা?', correct: 'ক', wrong: ['খ', 'গ', 'ঘ'] }, { topic: 'gk', q: 'ভুল আছে এখানে?', correct: 'ক', wrong: ['খ', 'গ'] }, { topic: 'zzz', q: 'বিষয় ভুল এখানে?', correct: 'ক', wrong: ['খ', 'গ', 'ঘ'] }, { topic: 'gk', q: 'ঠিক প্রশ্ন এটা?', correct: 'ক', wrong: ['খ', 'গ', 'ঘ'] }, 5]));
yes('each bad row is named by its number with the reason; a repeated question in the list is caught; the good rows still come through', e.items.length === 1 && e.errors.length === 4 && e.errors[0].startsWith('#২:') && e.errors.some(x => x.startsWith('#৩:') && x.includes('বিষয়')) && e.errors.some(x => x.includes('আগে আছে')) && e.errors.some(x => x.startsWith('#৫:')));
yes('a file with a byte-order mark still reads', D.parseImport('﻿' + JSON.stringify([{ topic: 'gk', q: 'বাংলাদেশের রাজধানীর নাম কী?', correct: 'ঢাকা', wrong: ['ক', 'খ', 'গ'] }])).items.length === 1);

// ---- the review tally
const t = D.tally([{ rev: 2, verdict: 'ok' }, { rev: 2, verdict: 'ok' }, { rev: 1, verdict: 'wrong' }, { rev: 2, verdict: 'unsure' }], 2);
yes('the tally counts only the CURRENT version (an old wrong does not show)', t.ok.length === 2 && t.wrong.length === 0 && t.unsure.length === 1);

// ---- the first batch of questions
const seed = D.parseImport(read('tools/quiz/seed-001.json'));
yes('the first batch (tools/quiz/seed-001.json) has no problem at all and over 60 questions', seed.errors.length === 0 && seed.items.length >= 60);
yes('every question of it has a source to check (a checker must know where to look), and the sources are not empty words', seed.items.every(i => i.source.length >= 6));
yes('it covers most topics, and no topic is only guesses: at least 9 topics', new Set(seed.items.map(i => i.topic)).size >= 9);
const bn = s => String(s).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
const find = t => seed.items.find(i => i.question.includes(t));
const ans = i => i.options[i.answer_idx];
yes('the arithmetic of the first batch is right (recomputed here, not trusted)', bn(ans(find('১২ × ১৩'))) == 12 * 13 && bn(ans(find('৮ × ৯'))) == 72 && bn(ans(find('২০০-এর ১৫%'))) == 30 && bn(ans(find('১৪৪-এর বর্গমূল'))) == 12 && bn(ans(find('২-এর পঞ্চম ঘাত'))) == 32 && bn(ans(find('৫!'))) == 120 && bn(ans(find('১ থেকে ১০ পর্যন্ত'))) == 55 && bn(ans(find('৮ সেমি'))).startsWith('40') && bn(ans(find('৪ ও ৬-এর'))) == 12 && bn(ans(find('৭-এর পরের মৌলিক'))) == 11);
yes('no question of the first batch has the same wrong option as its answer, and no answer is "all of the above" style', seed.items.every(i => !/উপরের সবগুলো|কোনোটিই নয়|none of the above|all of the above/i.test(i.options.join(' '))));
yes('no question of the first batch names a living politician or a party (they are not a school quiz)', !/প্রধানমন্ত্রী|আওয়ামী|বিএনপি|জামায়াত|নির্বাচন/.test(JSON.stringify(seed.items)));

// ---- the pages
const adm = read('admin.html'), aq = read('admin-quiz.js'), qr = read('qreview.js'), mem = read('member.html'), qcss = read('qreview.css');
yes('admin.html has the menu item, the view, the badge and loads quiz-data.js before admin-quiz.js', /id="nav-quiz"/.test(adm) && /id="view-quiz"/.test(adm) && /id="quizBadge"/.test(adm) && /id="quizRoot"/.test(adm) && adm.indexOf('quiz-data.js') > 0 && adm.indexOf('quiz-data.js') < adm.indexOf('admin-quiz.js'));
yes('the admin tab reads and writes the three tables through the admin session only, and a failed load says which SQL to run', /from\('quiz_questions'\)/.test(aq) && /from\('quiz_checks'\)/.test(aq) && /from\('quiz_reviewers'\)/.test(aq) && /2027-01-10_quiz_bank\.sql/.test(aq) && [...aq.matchAll(/\.rpc\('(\w+)'/g)].every(m => ['quiz_plan', 'quiz_reroll'].includes(m[1])));   // the only functions it calls are the two admin ones of the daily quiz
yes('a question is checked with the same rules before it is saved, and going to checking needs a source (both in the form and on the card), the server says it again', /Q\.validateQuestion\(o\)/.test(aq) && /সূত্র লিখুন/.test(aq) && /NEED_SOURCE/.test(aq));
yes('the cards show the answer, the source, and what the checkers said on the CURRENT version (names, notes of the wrong and the unsure)', /Q\.tally\(/.test(aq) && /reviewerName/.test(aq) && /সূত্র: /.test(aq) && /ভুল ' \+ bn\(tl\.wrong\.length\)/.test(aq));
yes('the admin can verify directly only after a question to confirm ("নিজে যাচাই করলাম"), retire, send back to draft, delete with a question; import shows a preview with the problems before anything is written, in chunks of 50, never overwriting', /adminConfirm\('আপনি নিজে যাচাই করছেন/.test(aq) && /adminConfirm\('এই প্রশ্ন বাদ দেবেন/.test(aq) && /doPreview/.test(aq) && /i \+= 50/.test(aq) && /status: 'draft', created_by: ST\.uid/.test(aq) && /have\.has\(/.test(aq));
yes('reviewers are added by e-mail of an existing member (the person must have signed up first), and removed with a question', /ilike\('email', email\)/.test(aq) && /এই ইমেইলে কোনো সদস্য নেই/.test(aq) && /adminConfirm\('এই যাচাইকারীকে সরাবেন/.test(aq));
yes('the dashboard has the reviewer section, the menu item (hidden unless the member is a reviewer, with a count), the view, the styles and both scripts', /id="qreview"/.test(mem) && /id="qrBox"/.test(mem) && /href: '#qreview'/.test(mem) && /qr: true/.test(mem) && /sn-qr/.test(mem) && /cnt-qr/.test(mem) && /qreview: \['qreview'\]/.test(mem) && /qreview\.css/.test(mem) && mem.indexOf('quiz-data.js') < mem.indexOf('qreview.js'));
yes('the reviewer page calls exactly the three functions of the SQL, one question at a time, shows the answer and the source, a "wrong" needs a note of at least 5 letters (page and server), and the answers of other reviewers are never shown', /quiz_review_me/.test(qr) && /quiz_review_queue/.test(qr) && /quiz_review_submit/.test(qr) && /p_limit: 5/.test(qr) && /ST\.queue\[0\]/.test(qr) && /trim\(\)\.length < 5/.test(qr) && /NEED_NOTE/.test(qr) && !/quiz_checks/.test(qr) && /অন্য যাচাইকারী কী বলেছেন, সেটা আপনি দেখেন না/.test(qr));
yes('a person who is not a reviewer is told so and the menu item stays hidden', /আপনি এখনও যাচাইকারী নন/.test(qr) && /\.sn-qr/.test(qr));
yes('the phone layout stacks the buttons, reduced motion is respected', /@media\(max-width:560px\)/.test(qcss) && /prefers-reduced-motion/.test(qcss));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
