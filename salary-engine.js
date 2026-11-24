/* ন্যায্য বেতন: the calculation. Pure functions, no network: the same input always gives the same answer, so it can be tested line by line (tools/tests/test_salary_engine.js).
   STAGE A: the starting point is the official mean wage of the occupation group (BBS Labour Force Survey), moved to the profile by a Mincer-type model with PRIORS (salary-data.js).
   Everything that is a prior is an estimate and says so: the tool never shows a precise-looking number without the range and the word "অনুমান". Plan: plans/salary-calculator-plan.md */
(function(root){
  'use strict';
  var D = root.SALARY_DATA || (typeof require === 'function' ? require('./salary-data.js') : null), P = D.params;
  var by = function(list, id){ for(var i = 0; i < list.length; i++) if(list[i].id === id) return list[i]; return null; };
  var clip = function(x, a, b){ return Math.max(a, Math.min(b, x)); };
  function erf(x){ var s = x < 0 ? -1 : 1; x = Math.abs(x); var t = 1 / (1 + 0.3275911 * x), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  var cdf = function(z){ return 0.5 * (1 + erf(z / Math.SQRT2)); };
  var Z = { p10: -1.2816, p25: -0.6745, p75: 0.6745, p90: 1.2816 };
  var expF = function(e){ e = clip(e, 0, P.expMax); return Math.exp(P.expB1 * e + P.expB2 * e * e); };
  var round100 = function(v){ return Math.round(v / 100) * 100; };

  /* the premium of a set of skills in log points: one English level only (the better one), diminishing, capped (smaller for people with experience) */
  function skillLog(ids, exp){
    var list = (ids || []).map(function(id){ return by(D.skills, id); }).filter(Boolean), en = 0, rest = [];
    list.forEach(function(s){ if(s.excl === 'en') en = Math.max(en, s.premium); else rest.push(s.premium); });
    rest.sort(function(a, b){ return b - a; });
    var sum = en, w = 1; rest.forEach(function(p){ sum += p * w; w *= 0.8; });          // the second skill counts 80 %, the third 64 %...
    return Math.min(sum, exp < P.freshYears ? P.skillCapFresh : P.skillCapExp);
  }
  var timeFactor = function(now){ var y = now.getUTCFullYear() + (now.getUTCMonth() + 0.5) / 12; return Math.pow(1 + P.wageGrowth, Math.max(0, y - P.dataYear)); };

  /* profile: { family, edu, exp (years), city, employer, jobtype, skills: [ids], cgpa } -> the estimate with its steps */
  function estimate(p, opts){
    var now = (opts && opts.now) || new Date(), fam = by(D.families, p.family), edu = by(D.edu, p.edu), city = by(D.city, p.city || 'dhaka'), emp = by(D.employer, p.employer || 'local'), job = by(D.jobtype, p.jobtype || 'full');
    if(!fam || !edu) return null;
    var grp = by(D.groups, fam.group), exp = clip(Number(p.exp) || 0, 0, 50), area = city ? city.area : 'urban';
    var steps = [], cur = (area === 'rural' ? Math.min(grp.rural, grp.urban * 0.92) : grp.urban) * fam.mult;     // in the survey the rural mean of the plainest work is a little ABOVE the urban one (who is counted differs): a village is never shown above a district town
    steps.push({ k: 'base', v: cur, label: 'এই ধরনের কাজের সরকারি গড় (BBS ' + D.survey.year + ')' + (fam.mult !== 1 ? ', ক্ষেত্রের হিসাবসহ' : '') });
    var add = function(k, label, factor){ var next = cur * factor; steps.push({ k: k, label: label, v: next, delta: next - cur }); cur = next; };
    add('edu', 'শিক্ষা: ' + edu.name, clip(Math.exp(P.eduReturn * (edu.years - grp.typicalYears)), P.eduClip[0], P.eduClip[1]));
    add('exp', 'অভিজ্ঞতা: ' + exp + ' বছর', expF(exp) / expF(P.expRef));
    if(city) add('city', 'শহর: ' + city.name, city.mult);
    add('emp', 'প্রতিষ্ঠান: ' + emp.name, emp.mult);
    var sl = skillLog(p.skills, exp); add('skills', 'দক্ষতা ও প্রমাণ', Math.exp(sl));
    if(exp < P.freshYears && p.cgpa){ var c = Number(p.cgpa), cg = c >= P.cgpa.hi[0] ? P.cgpa.hi[1] : c < P.cgpa.lo[0] ? P.cgpa.lo[1] : 0; if(cg) add('cgpa', 'ফলাফল (CGPA ' + c + ')', Math.exp(cg)); }
    add('time', 'আজকের দামে (সময়ের সঙ্গে বেতন বাড়ার হিসাব)', timeFactor(now));
    if(job.mult !== 1) add('job', 'কাজের ধরন: ' + job.name, job.mult);
    var mid = cur, s = P.sigma, notes = ['এটা অনুমান। একই যোগ্যতার মানুষের বেতনও প্রতিষ্ঠান আর দরকষাকষিতে আলাদা হয়, তাই সীমা দেখানো হয়েছে।'];
    var r = { p10: mid * Math.exp(Z.p10 * s), p25: mid * Math.exp(Z.p25 * s), mid: mid, p75: mid * Math.exp(Z.p75 * s), p90: mid * Math.exp(Z.p90 * s) };
    var floor = null;
    if(fam.id === 'operator' && job.id === 'full'){ floor = P.garmentFloor; Object.keys(r).forEach(function(k){ if(r[k] < floor) r[k] = floor; }); mid = r.mid; notes.push(fam.note); }
    else if(fam.note) notes.push(fam.note);
    notes.push('সরকারি চাকরির জন্য আলাদা নিয়ম: ' + P.gov.scale + ' অনুযায়ী সর্বনিম্ন (২০তম) গ্রেডে মূল বেতন ' + P.gov.grade20Basic + ' টাকা, বিসিএস ক্যাডারের শুরুর (৯ম) গ্রেডে ' + P.gov.grade9Basic + ' টাকা। এটা মূল বেতন, ভাতা আলাদা।');
    return { family: fam.id, group: grp.id, mid: mid, p10: r.p10, p25: r.p25, p75: r.p75, p90: r.p90, floor: floor, steps: steps, notes: notes, confidence: 'C', sigma: s,
      show: { p25: round100(r.p25), mid: round100(r.mid), p75: round100(r.p75), p10: round100(r.p10), p90: round100(r.p90) } };
  }

  /* the offer: where it lies among people of the same profile (a log-normal around the estimate) */
  function offer(p, amount, opts){
    var e = estimate(p, opts); if(!e || !(amount > 0)) return null;
    var pct = clip(cdf((Math.log(amount) - Math.log(e.mid)) / e.sigma), 0.001, 0.999) * 100, verdict, tone;
    if(e.floor && amount < e.floor){ verdict = 'আইনের সর্বনিম্ন মজুরির নিচে'; tone = 'bad'; }
    else if(pct < 15){ verdict = 'অনেক কম'; tone = 'bad'; } else if(pct < 35){ verdict = 'একটু কম'; tone = 'low'; } else if(pct <= 65){ verdict = 'ন্যায্য'; tone = 'fair'; } else if(pct <= 85){ verdict = 'ভালো'; tone = 'good'; } else { verdict = 'খুব ভালো'; tone = 'good'; }
    return { est: e, pct: pct, verdict: verdict, tone: tone, gap: e.mid - amount, ask: e.p75 };
  }

  /* what each skill not yet chosen would add (in taka a month), biggest first */
  function whatIf(p, opts){
    var base = estimate(p, opts); if(!base) return [];
    return D.skills.filter(function(s){ return (p.skills || []).indexOf(s.id) < 0; }).map(function(s){
      var q = JSON.parse(JSON.stringify(p)); q.skills = (p.skills || []).concat([s.id]); var e = estimate(q, opts); return { id: s.id, name: s.name, add: e.mid - base.mid };
    }).filter(function(x){ return x.add > 1; }).sort(function(a, b){ return b.add - a.add; });
  }
  var API = { estimate: estimate, offer: offer, whatIf: whatIf, skillLog: skillLog, data: D, cdf: cdf };
  root.SalaryEngine = API; if(typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
