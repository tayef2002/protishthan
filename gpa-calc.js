/* Protishthan: the GPA and CGPA rules, as plain functions (no page code), so the calculators and the tests use the same thing.
   Secondary and higher secondary (SSC, HSC) grade table: Banglapedia, "Public Examination System". The rule for the fourth (optional) subject is the board's usual rule:
   only the part of its grade point ABOVE 2.00 is added to the total, the divisor stays the number of compulsory subjects. The marksheet printed by the board is always the final word.
   API: ProtGpa.fromMarks(m), fromGrade(g), gpa(mainPoints, fourthPoint), cgpa(courses), cumulative(prevCgpa, prevCredits, sgpa, credits), floor2(x), round2(x) */
(function(root){
  'use strict';
  var SCALE = [
    { min: 80, g: 'A+', p: 5 }, { min: 70, g: 'A', p: 4 }, { min: 60, g: 'A-', p: 3.5 },
    { min: 50, g: 'B', p: 3 }, { min: 40, g: 'C', p: 2 }, { min: 33, g: 'D', p: 1 }, { min: 0, g: 'F', p: 0 }
  ];
  // marks (0 to 100) -> { g, p }, or null when it is not a number in range
  function fromMarks(m){
    if(m === '' || m === null || m === undefined) return null;
    var n = Number(m); if(!isFinite(n) || n < 0 || n > 100) return null;
    for(var i = 0; i < SCALE.length; i++) if(n >= SCALE[i].min) return { g: SCALE[i].g, p: SCALE[i].p };
    return null;
  }
  function fromGrade(g){
    var s = String(g == null ? '' : g).trim().toUpperCase().replace('−', '-').replace('–', '-');
    for(var i = 0; i < SCALE.length; i++) if(SCALE[i].g === s) return { g: SCALE[i].g, p: SCALE[i].p };
    return null;
  }
  // two decimals, cut (not rounded): a GPA of 4.996 must not be shown as 5.00
  function floor2(x){ return Math.floor(x * 100 + 1e-9) / 100; }
  function round2(x){ return Math.round(x * 100 + 1e-9) / 100; }
  // main: grade points of the compulsory subjects; fourth: grade point of the fourth subject or null.
  // Any F (0) in a compulsory subject = fail, GPA 0. The result can never be above 5.00.
  function gpa(main, fourth){
    if(!main || !main.length) return null;
    var n = main.length, sum = 0, fail = false;
    for(var i = 0; i < n; i++){ var p = Number(main[i]); if(!isFinite(p) || p < 0 || p > 5) return null; if(p === 0) fail = true; sum += p; }
    var f = (fourth === null || fourth === undefined || fourth === '') ? null : Number(fourth);
    if(f !== null && (!isFinite(f) || f < 0 || f > 5)) return null;
    var extra = f === null ? 0 : Math.max(0, f - 2);
    if(fail) return { gpa: 0, fail: true, subjects: n, sum: sum, extra: extra, total: sum + extra, capped: false };
    var raw = (sum + extra) / n;
    return { gpa: floor2(Math.min(5, raw)), fail: false, subjects: n, sum: sum, extra: extra, total: sum + extra, capped: raw > 5 };
  }
  // courses: [{ credit, gp }]; CGPA = sum(credit x grade point) / sum(credit), rounded to two decimals
  function cgpa(courses){
    var cr = 0, pts = 0, used = 0;
    (courses || []).forEach(function(c){
      var credit = Number(c.credit), gp = Number(c.gp);
      if(c.credit === '' || c.gp === '' || c.credit == null || c.gp == null || !isFinite(credit) || !isFinite(gp) || credit <= 0 || credit > 12 || gp < 0 || gp > 10) return;
      cr += credit; pts += credit * gp; used++;
    });
    if(!cr) return null;
    return { cgpa: round2(pts / cr), credits: cr, points: pts, courses: used };
  }
  // the old CGPA over its credits plus a new semester: the new cumulative CGPA
  function cumulative(prevCgpa, prevCredits, sgpa, credits){
    var raw = [prevCgpa, prevCredits, sgpa, credits];
    for(var i = 0; i < 4; i++) if(raw[i] === '' || raw[i] === null || raw[i] === undefined) return null;      // an empty box is not a zero
    var a = Number(prevCgpa), b = Number(prevCredits), c = Number(sgpa), d = Number(credits);
    if(![a, b, c, d].every(isFinite) || a < 0 || c < 0 || a > 10 || c > 10 || b < 0 || d <= 0 || b + d <= 0) return null;
    return { cgpa: round2((a * b + c * d) / (b + d)), credits: b + d };
  }
  root.ProtGpa = { SCALE: SCALE, fromMarks: fromMarks, fromGrade: fromGrade, gpa: gpa, cgpa: cgpa, cumulative: cumulative, floor2: floor2, round2: round2 };
  if(typeof module !== 'undefined' && module.exports) module.exports = root.ProtGpa;
})(typeof window !== 'undefined' ? window : globalThis);
