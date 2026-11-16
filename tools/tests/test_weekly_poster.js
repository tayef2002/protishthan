// the weekly result poster (tools/weekly-results): the week label, the rule that stops a thin poster, the caption and the page.   node tools/tests/test_weekly_poster.js
const path = require('path'), fs = require('fs');
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);

(async () => {
  const lib = await import('file:///' + path.join(__dirname, '..', 'weekly-results', 'lib.mjs').replace(/\\/g, '/'));
  const make = fs.readFileSync(path.join(__dirname, '..', 'weekly-results', 'make.mjs'), 'utf8');

  eq('the week label: seven days ending on the given day, in one month', lib.weekRange(new Date('2026-11-16T12:00:00')), '১০ – ১৬ নভেম্বর ২০২৬');
  eq('the week label across two months', lib.weekRange(new Date('2026-12-03T12:00:00')), '২৭ নভেম্বর – ৩ ডিসেম্বর ২০২৬');
  eq('the week label across two years', lib.weekRange(new Date('2027-01-03T12:00:00')), '২৮ ডিসেম্বর ২০২৬ – ৩ জানুয়ারি ২০২৭');

  const row = (rank, name, n) => ({ key: name, name, rank, n, inst: 3, total: n * 2 });
  const thin = { main: [row(1, 'ক', 5), row(2, 'খ', 4)] };
  yes('a poster with fewer than 3 rows is refused', /only 2 row/.test(lib.thinReason(thin)));
  yes('a poster with too few cards is refused (never padded)', /only 12 card/.test(lib.thinReason({ main: [row(1, 'ক', 5), row(2, 'খ', 4), row(3, 'গ', 3)] })));
  eq('enough real data passes', lib.thinReason({ main: [row(1, 'ক', 20), row(2, 'খ', 10), row(3, 'গ', 5)] }), '');

  const model = { mode: 'country', range: '১০ – ১৬ নভেম্বর ২০২৬', title: 'শিক্ষিত কার্ডে এই সপ্তাহে কে এগিয়ে', mainTitle: 'বিভাগ', unit: 'শিক্ষিত কার্ড', main: [row(1, 'ঢাকা', 522), row(2, 'চট্টগ্রাম', 485), row(3, 'রাজশাহী', 219)], dist: [row(1, 'ঢাকা', 284)], distTitle: 'সেরা ৩ জেলা', inst: [row(1, 'ক স্কুল', 30)], instTitle: 'সেরা ৩ প্রতিষ্ঠান', instMax: 3 };
  const cap = lib.buildCaption(model);
  yes('the caption lists the real rows with Bangla digits, asks the readers to comment, has the link, the honesty line and the tags', /১\. ঢাকা: ৫২২টি কার্ড/.test(cap) && /২\. চট্টগ্রাম: ৪৮৫টি কার্ড/.test(cap) && /কমেন্টে লিখুন/.test(cap) && /protishthan\.com\/card/.test(cap) && /প্রতি ডিভাইস থেকে একবার গোনা/.test(cap) && /#শিক্ষিতকার্ড/.test(cap));
  yes('the caption makes no promise of a prize or money', !/পুরস্কার|টাকা|বিজয়ী|জিতুন/.test(cap));
  const html = lib.renderHtml(model);
  yes('the page is 1080 x 1350, has the link bar, the number footnote, and a compact list only above 6 rows', /width:1080px;height:1350px/.test(html) && /protishthan\.com<em>\/card/.test(html) && /প্রতি ডিভাইস থেকে একবার গোনা/.test(html) && !/class="l c"/.test(html) && /class="l c"/.test(lib.renderHtml(Object.assign({}, model, { main: Array.from({ length: 8 }, (_, i) => row(i + 1, 'বিভাগ' + i, 100 - i)) }))));
  yes('a name with HTML characters is escaped', /&lt;b&gt;/.test(lib.renderHtml(Object.assign({}, model, { main: [row(1, '<b>x</b>', 10), row(2, 'খ', 9), row(3, 'গ', 8)] }))));
  yes('the sample mode is marked on the picture and in the file name and writes no caption', /নমুনা সংখ্যা/.test(make) && /\(sample \? 'নমুনা - ' : ''\)/.test(make) && /if \(!sample\)\s*\{[^}]*buildCaption/.test(make));
  yes('it refuses to make a thin poster unless --force, and reads the database address from member.js (one copy)', /thinReason\(model, minTotal\)/.test(make) && /if \(why && !force\)/.test(make) && /member\.js/.test(fs.readFileSync(path.join(__dirname, '..', 'weekly-results', 'lib.mjs'), 'utf8')));
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
