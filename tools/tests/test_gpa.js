// The GPA and CGPA rules (gpa-calc.js).   node tools/tests/test_gpa.js
const path = require('path');
const G = require(path.join(__dirname, '..', '..', 'gpa-calc.js'));
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };

// ----- marks -> grade and grade point (every border of the table) -----
const m = x => { const r = G.fromMarks(x); return r ? r.g + ' ' + r.p : null; };
eq('100 = A+ 5', m(100), 'A+ 5'); eq('80 = A+ 5', m(80), 'A+ 5'); eq('79.9 = A 4', m(79.9), 'A 4'); eq('79 = A 4', m(79), 'A 4'); eq('70 = A 4', m(70), 'A 4');
eq('69 = A- 3.5', m(69), 'A- 3.5'); eq('60 = A- 3.5', m(60), 'A- 3.5'); eq('59 = B 3', m(59), 'B 3'); eq('50 = B 3', m(50), 'B 3');
eq('49 = C 2', m(49), 'C 2'); eq('40 = C 2', m(40), 'C 2'); eq('39 = D 1', m(39), 'D 1'); eq('33 = D 1', m(33), 'D 1');
eq('32 = F 0', m(32), 'F 0'); eq('0 = F 0', m(0), 'F 0');
eq('a text number works ("85")', m('85'), 'A+ 5');
eq('below 0 is refused', m(-1), null); eq('above 100 is refused', m(101), null); eq('empty is nothing', m(''), null); eq('words are refused', m('abc'), null); eq('null is nothing', m(null), null);
const g = x => { const r = G.fromGrade(x); return r ? r.g + ' ' + r.p : null; };
eq('grade A+', g('A+'), 'A+ 5'); eq('grade a+ (small letter)', g('a+'), 'A+ 5'); eq('grade A- with a typographic minus', g('A−'), 'A- 3.5'); eq('grade B', g('B'), 'B 3'); eq('grade F', g('F'), 'F 0'); eq('grade E does not exist', g('E'), null); eq('an empty grade', g(''), null);

// ----- the GPA -----
const ex = G.gpa([5, 5, 4, 4, 3.5, 3, 5], 5);
eq('the page example: 7 subjects + fourth A+ = 4.64', ex.gpa, 4.64);
eq('  the sum is 29.5, the extra 3, the total 32.5', [ex.sum, ex.extra, ex.total], [29.5, 3, 32.5]);
eq('the same without a fourth subject = 4.21', G.gpa([5, 5, 4, 4, 3.5, 3, 5], null).gpa, 4.21);
eq('a missing fourth subject can be undefined or empty', [G.gpa([5, 4], undefined).gpa, G.gpa([5, 4], '').gpa], [4.5, 4.5]);
eq('fourth subject C (2.00) adds nothing', G.gpa([4, 4, 4], 2).gpa, 4);
eq('fourth subject D (1.00) does not lower the GPA', G.gpa([4, 4, 4], 1).gpa, 4);
eq('fourth subject F (0) does not make a student fail', G.gpa([4, 4, 4], 0), { gpa: 4, fail: false, subjects: 3, sum: 12, extra: 0, total: 12, capped: false });
eq('fourth subject B (3.00) adds 1.00', G.gpa([4, 4, 4], 3).total, 13);
eq('fourth subject A- (3.50) adds 1.50', G.gpa([4, 4, 4], 3.5).extra, 1.5);
eq('the divisor is the compulsory subjects only', G.gpa([4, 4, 4, 4], 5).gpa, 4.75);
eq('all A+ = 5.00', G.gpa([5, 5, 5, 5, 5, 5], null).gpa, 5);
const cap = G.gpa([5, 5, 5, 5, 5, 5, 4], 5);
eq('six A+, one A and a fourth A+: 37 / 7 = 5.28 is held at 5.00 (the FAQ sentence)', [cap.gpa, cap.capped, cap.total], [5, true, 37]);
eq('any F in a compulsory subject = fail, GPA 0', G.gpa([5, 5, 0, 5], 5).gpa, 0);
eq('  and it says fail', G.gpa([5, 5, 0, 5], 5).fail, true);
eq('no subjects = nothing', G.gpa([], null), null); eq('nothing at all = nothing', G.gpa(null, null), null);
eq('a point above 5 is refused', G.gpa([6], null), null); eq('a negative point is refused', G.gpa([-1], null), null); eq('text instead of a point is refused', G.gpa(['x'], null), null);
eq('a fourth subject above 5 is refused', G.gpa([4], 6), null);
eq('one subject only is fine', G.gpa([3.5], null).gpa, 3.5);

// ----- two decimals: cut, not rounded, so 4.996 never shows as 5.00 -----
eq('floor2(4.996) = 4.99', G.floor2(4.996), 4.99); eq('floor2(4.64285) = 4.64', G.floor2(4.64285), 4.64); eq('floor2(5) = 5', G.floor2(5), 5);
eq('floor2(0.29) = 0.29 (no floating point loss)', G.floor2(0.29), 0.29); eq('floor2(4.35) = 4.35', G.floor2(4.35), 4.35); eq('floor2(1.1) = 1.1', G.floor2(1.1), 1.1);
eq('a GPA just below 5 stays below 5', G.gpa([5, 5, 5, 5, 5, 5, 5, 5, 5, 4.99], null).gpa, 4.99);
eq('round2(3.445) = 3.45 (half up)', G.round2(3.445), 3.45); eq('round2(3.444) = 3.44', G.round2(3.444), 3.44);

// ----- the CGPA -----
const c1 = G.cgpa([{ credit: 3, gp: 4 }, { credit: 3, gp: 3.5 }, { credit: 4, gp: 3 }]);
eq('the page example: 34.5 / 10 = 3.45', [c1.cgpa, c1.credits, c1.points, c1.courses], [3.45, 10, 34.5, 3]);
eq('weighted by credit: (3 x 4 + 1 x 2) / 4 = 3.50, not the plain average 3.00', G.cgpa([{ credit: 3, gp: 4 }, { credit: 1, gp: 2 }]).cgpa, 3.5);
eq('text numbers are accepted', G.cgpa([{ credit: '3', gp: '4' }]).cgpa, 4);
eq('a half credit works', G.cgpa([{ credit: 1.5, gp: 4 }, { credit: 3, gp: 3 }]).cgpa, 3.33);
eq('rows with an empty field are ignored', G.cgpa([{ credit: 3, gp: 4 }, { credit: '', gp: 3 }, { credit: 3, gp: '' }]).cgpa, 4);
eq('zero or negative credit is ignored', G.cgpa([{ credit: 0, gp: 4 }, { credit: -3, gp: 4 }, { credit: 3, gp: 3 }]).cgpa, 3);
eq('a credit above 12 is ignored', G.cgpa([{ credit: 13, gp: 4 }, { credit: 3, gp: 3 }]).cgpa, 3);
eq('a grade point above 10 or below 0 is ignored', G.cgpa([{ credit: 3, gp: 11 }, { credit: 3, gp: -1 }, { credit: 3, gp: 3 }]).cgpa, 3);
eq('a failed course with 0 points still counts its credits', G.cgpa([{ credit: 3, gp: 0 }, { credit: 3, gp: 4 }]).cgpa, 2);
eq('nothing valid = nothing', G.cgpa([{ credit: '', gp: '' }]), null); eq('no list = nothing', G.cgpa(null), null);
const cu = G.cumulative(3.4, 60, 3.6, 15);
eq('the page example: 3.40 over 60 credits + 3.60 over 15 = 3.44', [cu.cgpa, cu.credits], [3.44, 75]);
eq('a first semester (0 credits before) gives the semester GPA', G.cumulative(0, 0, 3.5, 15).cgpa, 3.5);
eq('new credits must be above 0', G.cumulative(3.4, 60, 3.6, 0), null); eq('a missing number is refused', G.cumulative('', 60, 3.6, 15), null);
eq('a negative number is refused', G.cumulative(3.4, -5, 3.6, 15), null); eq('a GPA above 10 is refused', G.cumulative(11, 60, 3.6, 15), null);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
