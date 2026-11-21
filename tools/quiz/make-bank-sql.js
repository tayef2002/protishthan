// Turns a seed JSON (the format of seed-001.json / seed-math-001.json) into SQL that puts the questions into the bank as VERIFIED, one file per class band.
//   node tools/quiz/make-bank-sql.js tools/quiz/seed-math-001.json math
// writes tools/quiz/sql/bank-<name>-<band>.sql. Run those files in the Supabase SQL editor (after 2027-01-10_quiz_bank.sql). Safe to run twice: a question that is already in the bank (same text) is skipped.
// Only questions whose answer is right BY CONSTRUCTION or that were checked against a source (the "source" field says which) may be given to this script: it marks them verified.
const fs = require('fs'), path = require('path');
const [file, name] = [process.argv[2], process.argv[3]];
if (!file || !name) { console.error('usage: node tools/quiz/make-bank-sql.js <seed.json> <name>'); process.exit(2); }
const list = JSON.parse(fs.readFileSync(file, 'utf8')), list2 = Array.isArray(list) ? list : Object.values(list);
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
const rows = list2.map(x => {
  const opts = [x.correct, ...x.wrong]; let ans = 0;
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  ans = opts.indexOf(x.correct);
  return { topic: x.topic, band: x.band || 'any', difficulty: x.difficulty || 2, q: x.q, options: opts, answer_idx: ans, explanation: x.explanation || '', source: x.source || '' };
});
const out = path.join(__dirname, 'sql'); fs.mkdirSync(out, { recursive: true });
const bands = [...new Set(rows.map(r => r.band))];
for (const b of bands) {
  const part = rows.filter(r => r.band === b), json = JSON.stringify(part);
  if (json.includes('$j$')) throw new Error('the text contains $j$');
  const sql = `-- ${part.length} verified questions (${name}, band ${b}). Needs 2027-01-10_quiz_bank.sql. Safe to run twice: a question already in the bank is skipped.\n` +
    `insert into public.quiz_questions (topic, band, difficulty, question, options, answer_idx, explanation, source, status)\n` +
    `select x.topic, x.band, x.difficulty, x.q, x.options, x.answer_idx, x.explanation, x.source, 'verified'\n` +
    `  from jsonb_to_recordset($j$${json}$j$::jsonb) as x(topic text, band text, difficulty smallint, q text, options jsonb, answer_idx smallint, explanation text, source text)\n` +
    ` where not exists (select 1 from public.quiz_questions e where e.question = x.q);\n`;
  const f = path.join(out, `bank-${name}-${b}.sql`); fs.writeFileSync(f, sql);
  console.log(f.replace(path.join(__dirname, '..', '..') + path.sep, ''), part.length, 'questions', Math.round(sql.length / 1024) + ' KB');
}
