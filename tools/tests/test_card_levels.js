// the education levels of the card page (card.html): the diploma row and the years between levels.   node tools/tests/test_card_levels.js
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);
const card = read('card.html'), member = read('member.html');

// the levels, in the order of the form
const lv = card.slice(card.indexOf('const LEVELS = ['), card.indexOf('const TRACKS'));
const keys = [...lv.matchAll(/\{ key:'(\w+)'/g)].map(m => m[1]);
eq('the diploma row sits right after HSC and before the degree', keys, ['hifz', 'psc', 'jsc', 'school', 'college', 'diploma', 'bachelor', 'masters', 'ifta']);
yes('the diploma is hidden on the Qawmi track like HSC (it is for the general and the Aliya track), nothing else is switched off by it (no row disables another)', /key:'diploma'[^\n]*except:'q'/.test(lv) && !/disabled/.test(lv));
yes('its small label on the card is not the same word twice (কারিগরি · ডিপ্লোমা)', /key:'diploma'[^\n]*cardTitle:'কারিগরি'/.test(lv) && /names:\{ g:'ডিপ্লোমা', a:'ডিপ্লোমা' \}/.test(lv));

// the years between levels: run the real lines
const gap = card.match(/const YEAR_GAP = (\{[^}]*\});/)[1];
const offSrc = card.slice(card.indexOf('const YEAR_OFF'), card.indexOf('function syncYearUI'));
const ALLK = keys.filter(k => k !== 'hifz');
const { yg, OFF } = new Function('ALLK', 'return (function(){ const YEAR_GAP = ' + gap + ';' + offSrc + ' return { yg, OFF: YEAR_OFF }; })()')(ALLK);
eq('SSC to the diploma is 4 years (the usual course), the diploma to the degree 2 (lateral entry)', [yg('school', 'diploma'), yg('diploma', 'bachelor')], [4, 2]);
eq('HSC to the degree is still 4 years (the diploma does not sit between them)', yg('college', 'bachelor'), 4);
eq('the old gaps are unchanged: PSC to JSC 3, JSC to SSC 2, SSC to HSC 2, degree to masters 1, Dawra to Ifta 2', [yg('psc', 'jsc'), yg('jsc', 'school'), yg('school', 'college'), yg('bachelor', 'masters'), yg('masters', 'ifta')], [3, 2, 2, 1, 2]);
yes('years of schooling: the diploma counts 14, between HSC (12) and the degree (16)', /LEVEL_YEARS = \{[^}]*college: 12, diploma: 14, bachelor: 16/.test(card));

// the member page's own short list of levels shows it too
yes('the dashboard card preview lists the diploma and does not rank it below HSC in the auto title', /\['college', 'উচ্চ মাধ্যমিক'\], \['diploma', 'ডিপ্লোমা'\], \['bachelor'/.test(member) && member.indexOf("has('diploma')") < member.indexOf("has('college')"));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
