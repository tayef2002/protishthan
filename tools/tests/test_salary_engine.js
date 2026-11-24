// The calculation of ন্যায্য বেতন (salary-engine.js with the tables of salary-data.js, made by tools/salary/gen-data.js from the Labour Force Survey numbers).   node tools/tests/test_salary_engine.js
const fs = require('fs'), path = require('path');
const E = require('../../salary-engine.js'), D = E.data, P = D.params, L = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'salary', 'lfs-tables.json'), 'utf8'));
let pass = 0, fail = 0;
const yes = (name, v, extra) => { const ok = !!v; ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  ' + (extra || ''))); };
const now = new Date('2026-11-24T00:00:00Z'), opt = { now };
const base = { family: 'finance', edu: 'hons', exp: 0, city: 'dhaka', employer: 'local', skills: [] };
const mid = p => E.estimate(p, opt).mid;

// ---- the tables
yes('the numbers of the group means in salary-data.js are the published ones (BBS Labour Force Survey 2024, urban, rural, all): checked against the extracted tables', D.groups.every(g => { const r = L.y2024.occupation.find(x => x.label === g.lfs); return r && r.v.urban === g.urban && r.v.rural === g.rural && r.v.all === g.all; }));
yes('the survey tables read well: eight groups and the total, every mean positive, and the 2024 total above the 2022 total', D.groups.length === 8 && D.groups.every(g => g.urban > 0 && g.rural > 0) && L.y2024.occupation.find(r => r.label === 'Total').v.all > L.y2022.occupation.find(r => r.label === 'Total').v.all);
yes('every family belongs to a group of the survey, has a name, and a multiplier between 0.5 and 1.6 (it is only a prior)', D.families.every(f => D.groups.some(g => g.id === f.group) && f.name && f.mult >= 0.5 && f.mult <= 1.6));
yes('every skill has a positive premium below 0.2 (log points) and a group name; exactly two English levels are exclusive', D.skills.every(s => s.premium > 0 && s.premium < 0.2 && s.group) && D.skills.filter(s => s.excl === 'en').length === 2);
yes('education levels have increasing years; the cities and employers have a multiplier near 1', D.edu.every((e, i) => i === 0 || e.years > D.edu[i - 1].years) && D.city.concat(D.employer).every(x => x.mult > 0.8 && x.mult < 1.3));

// ---- the rules the answer must obey
yes('the answer is repeatable: the same profile and the same day give the same number', JSON.stringify(E.estimate(base, opt)) === JSON.stringify(E.estimate(base, opt)));
yes('a higher education level never gives a lower number, in any family', D.families.every(f => D.edu.every((e, i) => i === 0 || mid({ ...base, family: f.id, edu: e.id }) >= mid({ ...base, family: f.id, edu: D.edu[i - 1].id }))));
yes('more years of experience never give a lower number, from 0 to 35 years, in any family', D.families.every(f => { let prev = 0; for (let y = 0; y <= 35; y++) { const m = mid({ ...base, family: f.id, exp: y }); if (m < prev - 1e-6) return false; prev = m; } return true; }));
yes('after 35 years the number does not rise any more (the curve is flat there)', Math.abs(mid({ ...base, exp: 35 }) - mid({ ...base, exp: 50 })) < 1e-6);
yes('adding a skill never lowers the number, for any skill', D.skills.every(s => mid({ ...base, skills: [s.id] }) >= mid(base)));
yes('the total of the skills never passes the cap: +35 % at most for a fresher, +25 % at most with experience (all skills ticked)', Math.exp(E.skillLog(D.skills.map(s => s.id), 0)) <= Math.exp(P.skillCapFresh) + 1e-9 && Math.exp(E.skillLog(D.skills.map(s => s.id), 8)) <= Math.exp(P.skillCapExp) + 1e-9 && mid({ ...base, skills: D.skills.map(s => s.id) }) / mid(base) <= 1.36);
yes('two English levels count once (the better one), not both', Math.abs(E.skillLog(['en_good', 'en_fluent'], 0) - E.skillLog(['en_fluent'], 0)) < 1e-9);
yes('a bigger city never gives less: Dhaka, other cities, district town, village, in that order', D.families.every(f => mid({ ...base, family: f.id, city: 'dhaka' }) >= mid({ ...base, family: f.id, city: 'bigcity' }) && mid({ ...base, family: f.id, city: 'bigcity' }) >= mid({ ...base, family: f.id, city: 'town' }) && mid({ ...base, family: f.id, city: 'town' }) + 1e-6 >= mid({ ...base, family: f.id, city: 'village' })));
yes('the range is in order: low < 25th < middle < 75th < high, always, and the middle is positive', D.families.every(f => D.edu.every(e => { const r = E.estimate({ ...base, family: f.id, edu: e.id, exp: 4 }, opt); return r.mid > 0 && r.p10 <= r.p25 + 1e-9 && r.p25 <= r.mid && r.mid <= r.p75 && r.p75 <= r.p90 + 1e-9; })));
yes('a later day gives a higher or equal number (pay grows 6 % a year from the survey year), never lower', mid(base) <= E.estimate(base, { now: new Date('2027-11-24T00:00:00Z') }).mid && E.estimate(base, { now: new Date('2020-01-01T00:00:00Z') }).mid <= mid(base) + 1e-6);
yes('part time is below full time', mid({ ...base, jobtype: 'part' }) < mid(base));

// ---- golden cases, worked out in the test from the table (not from the engine code)
(() => {
  const g = D.groups.find(x => x.id === 'managers'), fam = D.families.find(x => x.id === 'manager'), f = e => Math.exp(P.expB1 * e + P.expB2 * e * e);
  const exp = 12, expect = g.urban * fam.mult * Math.exp(P.eduReturn * (16 - g.typicalYears)) * (f(exp) / f(P.expRef)) * 1.10 * 1.08 * Math.pow(1 + P.wageGrowth, 2026 + 10.5 / 12 - P.dataYear);
  const got = mid({ family: 'manager', edu: 'hons', exp, city: 'dhaka', employer: 'local', skills: [] });
  yes('golden: a manager, honours, 12 years, Dhaka, a local firm = the survey mean x education x experience x Dhaka x employer x time, worked out again in the test', Math.abs(got - expect) < 1e-6, got + ' vs ' + expect);
})();
yes('golden: a person with the typical schooling of the group and 12 years of experience (the reference), in a cell where every factor is 1, gets exactly the survey mean times the time factor (the model is anchored to the published number)', (() => { const g = D.groups.find(x => x.id === 'professionals'), t = Math.pow(1 + P.wageGrowth, 2026 + 10.5 / 12 - P.dataYear); const e = E.estimate({ family: 'finance', edu: 'hons', exp: 12, city: 'bigcity', employer: 'startup', skills: [] }, opt); return Math.abs(e.mid - g.urban * 1.0 * t) < 1e-6; })());
yes('the steps add up: each step is the one before times a factor, the last step is the middle, the first is the survey mean of the group', (() => { const e = E.estimate({ ...base, skills: ['excel', 'en_good'] }, opt); return e.steps[0].k === 'base' && Math.abs(e.steps[e.steps.length - 1].v - e.mid) < 1e-6 && e.steps.slice(1).every((s, i) => Math.abs(s.v - (e.steps[i].v + s.delta)) < 1e-6); })());
yes('the garment factory worker is never shown below the legal minimum wage of 12,500 taka for full time (not in any number of the range), and a part-time worker is not forced to it', (() => { const r = E.estimate({ family: 'operator', edu: 'below', exp: 0, city: 'village', employer: 'small', skills: [] }, opt); const rp = E.estimate({ family: 'operator', edu: 'below', exp: 0, city: 'village', employer: 'small', skills: [], jobtype: 'part' }, opt); return r.p10 >= 12500 && r.mid >= 12500 && rp.floor === null; })());
yes('every result carries the honest label: confidence "C" (an estimate), a note that it is an estimate, and the government pay scale note with the known grades', D.families.every(f => { const r = E.estimate({ ...base, family: f.id }, opt); return r.confidence === 'C' && /অনুমান/.test(r.notes[0]) && r.notes.some(n => /20000/.test(n)) && r.notes.some(n => /44000/.test(n)); }));
yes('an unknown family or education gives nothing (no number out of thin air)', E.estimate({ ...base, family: 'nope' }, opt) === null && E.estimate({ ...base, edu: 'nope' }, opt) === null);

// ---- the offer
yes('an offer equal to the middle lies at the 50th percentile; a higher offer is always at a higher percentile', Math.abs(E.offer(base, mid(base), opt).pct - 50) < 0.5 && [10000, 20000, 30000, 40000, 60000].every((a, i, arr) => i === 0 || E.offer(base, a, opt).pct > E.offer(base, arr[i - 1], opt).pct));
yes('the verdict follows the percentile: very low, a little low, fair (35 to 65), good, very good', (() => { const m = mid(base), v = x => E.offer(base, m * x, opt).verdict; return v(0.4) === 'অনেক কম' && v(0.75) === 'একটু কম' && v(1.0) === 'ন্যায্য' && v(1.3) === 'ভালো' && v(2.0) === 'খুব ভালো'; })());
yes('the ask (a good price to aim at) is the 75th percentile, above the middle', (() => { const o = E.offer(base, 10000, opt); return o.ask > o.est.mid && Math.abs(o.ask - o.est.p75) < 1e-9; })());
yes('an offer under the legal minimum of a garment worker is told so', E.offer({ family: 'operator', edu: 'below', exp: 0, city: 'village', employer: 'small' }, 9000, opt).verdict === 'আইনের সর্বনিম্ন মজুরির নিচে');
yes('what-if: every skill not chosen is listed with what it adds, the biggest first, none below zero; a chosen skill is not listed', (() => { const w = E.whatIf({ ...base, skills: ['excel'] }, opt); return w.length > 5 && w.every((x, i) => x.add > 0 && (i === 0 || w[i - 1].add >= x.add)) && !w.some(x => x.id === 'excel'); })());
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
