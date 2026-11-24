/* স্যালারি কত?: the calculation. Pure functions, no network: the same input always gives the same answer, so it can be tested line by line (tools/tests/test_salary_engine.js).
   STAGE A: the starting point is the official mean wage of the occupation group (BBS Labour Force Survey), moved to the profile by a Mincer-type model with PRIORS (salary-data.js).
   Each kind of work has its own posts, employers, questions and skills (tools/salary/profiles.js); only what belongs to the chosen work counts.
   Everything that is a prior is an estimate and says so: the tool never shows a precise-looking number without the range and the word "অনুমান". Plan: plans/salary-calculator-plan.md */
(function(root){
  'use strict';
  var D = root.SALARY_DATA || (typeof require === 'function' ? require('./salary-data.js') : null), P = D.params;
  var by = function(list, id){ for(var i = 0; i < (list || []).length; i++) if(list[i].id === id) return list[i]; return null; };
  var clip = function(x, a, b){ return Math.max(a, Math.min(b, x)); };
  function erf(x){ var s = x < 0 ? -1 : 1; x = Math.abs(x); var t = 1 / (1 + 0.3275911 * x), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  var cdf = function(z){ return 0.5 * (1 + erf(z / Math.SQRT2)); };
  var Z = { p10: -1.2816, p25: -0.6745, p75: 0.6745, p90: 1.2816 };
  /* the curve of pay with experience: each group has its own slope (the formal market climbs faster in a profession than in plain work),
     and the curve goes FLAT at its own peak (b1 / 2|b2|), it never turns down */
  var expF = function(e, b1){ b1 = b1 || P.expB1; e = clip(e, 0, Math.min(P.expMax, b1 / (2 * -P.expB2))); return Math.exp(b1 * e + P.expB2 * e * e); };
  var round100 = function(v){ return Math.round(v / 100) * 100; };
  var fam = function(id){ return by(D.families, id); };

  /* the premium of a set of skills in log points: only the skills that belong to the chosen kind of work (all of them when no kind is given), one English level (the better one),
     diminishing, capped (smaller for people with experience) */
  function skillLog(ids, exp, familyId){
    var f = familyId ? fam(familyId) : null, list = (ids || []).filter(function(id){ return !f || f.skills.indexOf(id) >= 0; }).map(function(id){ return by(D.skills, id); }).filter(Boolean), en = 0, rest = [];
    list.forEach(function(s){ if(s.excl === 'en') en = Math.max(en, s.premium); else rest.push(s.premium); });
    rest.sort(function(a, b){ return b - a; });
    var sum = en, w = 1; rest.forEach(function(p){ sum += p * w; w *= 0.8; });          // the second skill counts 80 %, the third 64 %...
    return Math.min(sum, exp < P.freshYears ? P.skillCapFresh : P.skillCapExp);
  }
  var timeFactor = function(now){ var y = now.getUTCFullYear() + (now.getUTCMonth() + 0.5) / 12; return Math.pow(1 + P.wageGrowth, Math.max(0, y - P.dataYear)); };

  /* profile: { family, role, edu, exp (years), city, employer, jobtype, skills: [ids], cgpa, extras: { questionId: optionId } } -> the estimate with its steps */
  function estimate(p, opts){
    var now = (opts && opts.now) || new Date(), f = fam(p.family), edu = by(D.edu, p.edu), city = by(D.city, p.city || 'dhaka'), job = by(D.jobtype, p.jobtype || 'full');
    if(!f || !edu) return null;
    var emp = by(f.employers, p.employer), role = by(f.roles, p.role), grp = by(D.groups, f.group), exp = clip(Number(p.exp) || 0, 0, 50), area = city ? city.area : 'urban';
    var steps = [], cur = (area === 'rural' ? Math.min(grp.rural, grp.urban * 0.92) : grp.urban) * f.mult;     // in the survey the rural mean of the plainest work is a little ABOVE the urban one (who is counted differs): a village is never shown above a district town
    steps.push({ k: 'base', v: cur, label: 'এই ধরনের কাজের সরকারি গড় (BBS ' + D.survey.year + ')' + (f.mult !== 1 ? ', ক্ষেত্রের হিসাবসহ' : '') });
    var add = function(k, label, factor){ var next = cur * factor; steps.push({ k: k, label: label, v: next, delta: next - cur }); cur = next; };
    if(role) add('role', 'পদ: ' + role.name, role.mult);
    add('edu', 'শিক্ষা: ' + edu.name, clip(Math.exp((P.eduReturnBy[grp.id] || P.eduReturn) * (edu.years - grp.typicalYears)), P.eduClip[0], P.eduClip[1]));
    var eb1 = (P.expB1By || {})[grp.id] || P.expB1, ef = expF(exp, eb1) / expF(P.expRef, eb1);
    if(emp && emp.flat) ef = Math.pow(ef, emp.flat);     // in a scale-bound house (government, MPO) experience moves the pay by the rule book, far more slowly than the open market
    add('exp', 'অভিজ্ঞতা: ' + exp + ' বছর', ef);
    if(city) add('city', 'শহর: ' + city.name, city.mult);
    if(emp) add('emp', 'প্রতিষ্ঠান: ' + emp.name, emp.mult);
    var floorFromGrade = null;
    (f.extras || []).forEach(function(q){ var o = by(q.options, (p.extras || {})[q.id]); if(o && o.mult !== 1) add('x_' + q.id, q.name + ': ' + o.name, o.mult); if(o && o.floor) floorFromGrade = o.floor; });
    var sl = skillLog(p.skills, exp, f.id); add('skills', 'দক্ষতা ও প্রমাণ', Math.exp(sl));
    if(exp < P.freshYears && p.cgpa){ var c = Number(p.cgpa), cg = c >= P.cgpa.hi[0] ? P.cgpa.hi[1] : c < P.cgpa.lo[0] ? P.cgpa.lo[1] : 0; if(cg) add('cgpa', 'ফলাফল (CGPA ' + c + ')', Math.exp(cg)); }
    add('time', 'আজকের দামে (সময়ের সঙ্গে স্যালারি বাড়ার হিসাব)', timeFactor(now));
    if(job.mult !== 1) add('job', 'কাজের ধরন: ' + job.name, job.mult);
    var mid = cur, s = P.sigma, notes = ['এটা অনুমান। একই যোগ্যতার মানুষের স্যালারিও প্রতিষ্ঠান আর দরকষাকষিতে আলাদা হয়, তাই সীমা দেখানো হয়েছে।'];
    var r = { p10: mid * Math.exp(Z.p10 * s), p25: mid * Math.exp(Z.p25 * s), mid: mid, p75: mid * Math.exp(Z.p75 * s), p90: mid * Math.exp(Z.p90 * s) };
    var floor = null, floorKind = null;
    if(f.id === 'operator' && job.id === 'full'){ floor = floorFromGrade || P.garmentFloor; floorKind = 'garment'; notes.push(f.note); }
    else if(f.note) notes.push(f.note);
    if(role && role.gov && emp && emp.govt && job.id === 'full'){ floor = P.gov.grade9Basic; floorKind = 'gov'; notes.push('সরকারি হাসপাতালে প্রথম শ্রেণির চাকরি ৯ম গ্রেডে শুরু: মূল বেতন কমপক্ষে ' + P.gov.grade9Basic + ' টাকা, এর ওপর ভাতা যোগ হয়। তাই এর নিচে দেখানো হয় না।'); }
    /* Bangladesh Bank's rule (circular of 2022, in force): the pay of an entry officer of a private bank may not sit under 28,000 on probation, 39,000 once confirmed */
    if(!floor && f.id === 'bank' && job.id === 'full' && emp && (emp.id === 'private' || emp.id === 'foreign') && role && ['officer', 'credit', 'forex', 'rm', 'branch'].indexOf(role.id) >= 0){ floor = exp < 1 ? P.bankFloorProb : P.bankFloor; floorKind = 'bank'; notes.push('বাংলাদেশ ব্যাংকের নিয়মে বেসরকারি ব্যাংকের অফিসারের বেতন প্রবেশনে কমপক্ষে ' + P.bankFloorProb + ', নিশ্চিতকরণের পরে ' + P.bankFloor + ' টাকা। তাই এর নিচে দেখানো হয় না।'); }
    (f.refs || []).forEach(function(t){ notes.push(t); });
    if(floor) Object.keys(r).forEach(function(k){ if(r[k] < floor) r[k] = floor; }); mid = r.mid;
    notes.push('সরকারি চাকরির জন্য আলাদা নিয়ম: ' + P.gov.scale + ' অনুযায়ী সর্বনিম্ন (২০তম) গ্রেডে মূল বেতন ' + P.gov.grade20Basic + ' টাকা, বিসিএস ক্যাডারের শুরুর (৯ম) গ্রেডে ' + P.gov.grade9Basic + ' টাকা। এটা মূল বেতন, ভাতা আলাদা।');
    var fixed = floorKind === 'gov' && exp < 2;        // only the entry post is a rule; later the grade and the years decide
    return { family: f.id, group: grp.id, fixed: fixed, mid: mid, p10: r.p10, p25: r.p25, p75: r.p75, p90: r.p90, floor: floor, floorKind: floorKind, steps: steps, notes: notes, confidence: fixed ? 'A' : 'C', sigma: s,
      show: { p25: round100(r.p25), mid: round100(r.mid), p75: round100(r.p75), p10: round100(r.p10), p90: round100(r.p90) } };
  }

  /* the offer: where it lies among people of the same profile (a log-normal around the estimate) */
  function offer(p, amount, opts){
    var e = estimate(p, opts); if(!e || !(amount > 0)) return null;
    var pct = clip(cdf((Math.log(amount) - Math.log(e.mid)) / e.sigma), 0.001, 0.999) * 100, verdict, tone;
    if(e.fixed && amount >= e.floor) return { est: e, pct: 50, verdict: 'পে-স্কেলের সমান বা বেশি', tone: 'fair', gap: e.mid - amount, ask: e.p75 };
    if(e.floor && amount < e.floor){ verdict = e.floorKind === 'gov' ? 'সরকারি পে-স্কেলের মূল বেতনের নিচে' : e.floorKind === 'bank' ? 'বাংলাদেশ ব্যাংকের বেঁধে দেওয়া ন্যূনতমের নিচে' : 'আইনের সর্বনিম্ন মজুরির নিচে'; tone = 'bad'; }
    else if(pct < 15){ verdict = 'অনেক কম'; tone = 'bad'; } else if(pct < 35){ verdict = 'একটু কম'; tone = 'low'; } else if(pct <= 65){ verdict = 'ন্যায্য'; tone = 'fair'; } else if(pct <= 85){ verdict = 'ভালো'; tone = 'good'; } else { verdict = 'খুব ভালো'; tone = 'good'; }
    return { est: e, pct: pct, verdict: verdict, tone: tone, gap: e.mid - amount, ask: e.p75 };
  }

  /* what each skill of THIS kind of work, not yet chosen, would add (in taka a month), biggest first */
  function whatIf(p, opts){
    var base = estimate(p, opts), f = fam(p.family); if(!base) return [];
    return f.skills.map(function(id){ return by(D.skills, id); }).filter(function(s){ return s && (p.skills || []).indexOf(s.id) < 0; }).map(function(s){
      var q = JSON.parse(JSON.stringify(p)); q.skills = (p.skills || []).concat([s.id]); var e = estimate(q, opts); return { id: s.id, name: s.name, add: e.mid - base.mid };
    }).filter(function(x){ return x.add > 1; }).sort(function(a, b){ return b.add - a.add; });
  }
  var API = { estimate: estimate, offer: offer, whatIf: whatIf, skillLog: skillLog, data: D, cdf: cdf };
  root.SalaryEngine = API; if(typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
