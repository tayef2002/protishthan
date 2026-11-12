/* Protishthan: the screens of the GPA and CGPA calculators (gpa.html, cgpa.html). The rules live in gpa-calc.js (ProtGpa). Nothing typed here leaves the phone. */
(function(){
  'use strict';
  var G = window.ProtGpa; if(!G) return;
  var bn = function(s){ return String(s).replace(/[0-9]/g, function(d){ return '০১২৩৪৫৬৭৮৯'[d]; }); };
  var n2 = function(x){ return bn(Number(x).toFixed(2)); };
  var $ = function(id){ return document.getElementById(id); };
  function el(tag, cls, attrs){ var e = document.createElement(tag); if(cls) e.className = cls; if(attrs) for(var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function say(out, cls, html){ out.className = 'cc-out' + (cls ? ' ' + cls : ''); out.innerHTML = html; }

  /* ---------------- SSC / HSC GPA ---------------- */
  function initGpa(root){
    var mode = 'marks', rowsBox = $('ccRows'), out = $('ccOut'), fourthOn = $('ccFourthOn'), fourthBox = $('ccFourthRow'), rows = [], fourth = null;
    var GRADES = ['A+', 'A', 'A-', 'B', 'C', 'D', 'F'];
    function makeRow(prefillName, removable){
      var row = el('div', 'cc-row'), name = el('input', '', { type: 'text', maxlength: '30', placeholder: 'বিষয় (ঐচ্ছিক)', 'aria-label': 'বিষয়ের নাম' }), val, tag = el('span', 'cc-tag'), x = el('button', 'cc-x', { type: 'button', 'aria-label': 'বিষয়টা সরান' });
      if(prefillName) name.value = prefillName;
      if(mode === 'marks'){ val = el('input', '', { type: 'number', min: '0', max: '100', step: 'any', inputmode: 'decimal', placeholder: 'নম্বর (০–১০০)', 'aria-label': 'এই বিষয়ে পাওয়া নম্বর' }); }
      else { val = el('select', '', { 'aria-label': 'এই বিষয়ের গ্রেড' }); var o0 = el('option', '', { value: '' }); o0.textContent = 'গ্রেড বাছুন'; val.appendChild(o0); GRADES.forEach(function(g){ var o = el('option', '', { value: g }); o.textContent = g; val.appendChild(o); }); }
      tag.textContent = '–'; x.textContent = '×'; if(removable === false) x.style.visibility = 'hidden';
      row.appendChild(name); row.appendChild(val); row.appendChild(tag); row.appendChild(x);
      var r = { row: row, name: name, val: val, tag: tag, x: x };
      val.addEventListener('input', paint); val.addEventListener('change', paint);
      x.addEventListener('click', function(){ if(r === fourth) return; rows.splice(rows.indexOf(r), 1); row.remove(); paint(); });
      return r;
    }
    function read(r){   // -> { p, g } | null (empty) | false (not valid)
      var v = r.val.value; if(v === '') return null;
      var g = mode === 'marks' ? G.fromMarks(v) : G.fromGrade(v);
      return g || false;
    }
    function tagOf(r, g){
      if(g === null){ r.tag.textContent = '–'; r.tag.className = 'cc-tag'; }
      else if(g === false){ r.tag.textContent = 'ভুল'; r.tag.className = 'cc-tag f'; }
      else { r.tag.textContent = (mode === 'marks' ? g.g + ' · ' : '') + n2(g.p); r.tag.className = 'cc-tag ' + (g.p === 0 ? 'f' : 'ok'); }
    }
    function paint(){
      var pts = [], bad = 0;
      rows.forEach(function(r){ var g = read(r); tagOf(r, g); if(g === false) bad++; else if(g) pts.push(g.p); });
      var f = null;
      if(fourthOn.checked && fourth){ var fg = read(fourth); tagOf(fourth, fg); if(fg === false) bad++; else if(fg) f = fg.p; }
      if(bad){ say(out, 'bad', '<p><b>কোথাও ভুল বসেছে।</b> নম্বর ০ থেকে ১০০-র মধ্যে হতে হবে। ‘ভুল’ লেখা ঘরগুলো ঠিক করুন।</p>'); return; }
      var res = pts.length ? G.gpa(pts, f) : null;
      if(!res){ say(out, '', '<p>নম্বর বা গ্রেড বসালেই জিপিএ এখানে হিসাব হয়ে দেখা যাবে।</p>'); return; }
      if(res.fail){ say(out, 'bad', '<div class="cc-big"><small>আপনার জিপিএ</small><b>' + n2(0) + '</b><em>আনুমানিক</em></div><p>কোনো আবশ্যিক বিষয়ে F (০.০০ পয়েন্ট) থাকলে সাধারণ নিয়মে ফলাফল অকৃতকার্য, জিপিএ হয় না।</p>'); return; }
      var line = bn(res.subjects) + 'টি আবশ্যিক বিষয়ের গ্রেড পয়েন্টের যোগফল ' + n2(res.sum) + '।';
      if(f !== null) line += res.extra > 0 ? ' ৪র্থ বিষয় থেকে যোগ হলো ' + n2(res.extra) + ' (' + n2(f) + ' − ২.০০)।' : ' ৪র্থ বিষয়ের পয়েন্ট ২.০০-এর বেশি না, তাই কিছু যোগ হয়নি।';
      line += ' মোট ' + n2(res.total) + ' ÷ ' + bn(res.subjects) + ' = ' + n2(res.total / res.subjects) + (res.capped ? ', সর্বোচ্চ ৫.০০-এর বেশি হয় না।' : '।');
      say(out, '', '<div class="cc-big"><small>আপনার জিপিএ</small><b>' + n2(res.gpa) + '</b><em>আনুমানিক</em></div><p>' + line + '</p><p>দুই দশমিক পর্যন্ত কেটে দেখানো হয়, মার্কশিটের সাথে শেষ অঙ্কে ০.০১ পার্থক্য হতে পারে। চূড়ান্ত জিপিএ আপনার মার্কশিটের।</p>');
    }
    function build(keepNames){
      var names = keepNames ? rows.map(function(r){ return r.name.value; }) : [];
      rowsBox.innerHTML = ''; rows = [];
      var count = keepNames ? Math.max(names.length, 1) : 6;
      for(var i = 0; i < count; i++){ var r = makeRow(names[i] || '', true); rows.push(r); rowsBox.appendChild(r.row); }
      fourthBox.innerHTML = ''; fourth = makeRow('৪র্থ বিষয়', false); fourth.x.style.visibility = 'hidden'; fourthBox.appendChild(fourth.row);
      paint();
    }
    $('ccAdd').addEventListener('click', function(){ if(rows.length >= 14){ return; } var r = makeRow('', true); rows.push(r); rowsBox.appendChild(r.row); r.name.focus(); paint(); });
    fourthOn.addEventListener('change', function(){ fourthBox.hidden = !fourthOn.checked; paint(); });
    $('ccReset').addEventListener('click', function(){ fourthOn.checked = false; fourthBox.hidden = true; build(false); });
    root.querySelectorAll('[data-mode]').forEach(function(b){ b.addEventListener('click', function(){
      if(b.dataset.mode === mode) return; mode = b.dataset.mode;
      root.querySelectorAll('[data-mode]').forEach(function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      build(true);
    }); });
    build(false);
  }

  /* ---------------- university CGPA ---------------- */
  function initCgpa(root){
    var rowsBox = $('ccRows'), out = $('ccOut'), rows = [], panel = 'courses';
    function makeRow(){
      var row = el('div', 'cc-row c3'), name = el('input', '', { type: 'text', maxlength: '30', placeholder: 'কোর্স (ঐচ্ছিক)', 'aria-label': 'কোর্সের নাম' }),
          cr = el('input', '', { type: 'number', min: '0', max: '12', step: 'any', inputmode: 'decimal', placeholder: 'ক্রেডিট', 'aria-label': 'কোর্সের ক্রেডিট' }),
          gp = el('input', '', { type: 'number', min: '0', max: '10', step: 'any', inputmode: 'decimal', placeholder: 'গ্রেড পয়েন্ট', 'aria-label': 'এই কোর্সের গ্রেড পয়েন্ট' }),
          x = el('button', 'cc-x', { type: 'button', 'aria-label': 'কোর্সটা সরান' });
      x.textContent = '×'; [name, cr, gp, x].forEach(function(e){ row.appendChild(e); });
      var r = { row: row, cr: cr, gp: gp };
      cr.addEventListener('input', paint); gp.addEventListener('input', paint);
      x.addEventListener('click', function(){ rows.splice(rows.indexOf(r), 1); row.remove(); paint(); });
      return r;
    }
    function paint(){
      if(panel === 'courses'){
        var any = rows.some(function(r){ return r.cr.value !== '' || r.gp.value !== ''; });
        var res = G.cgpa(rows.map(function(r){ return { credit: r.cr.value, gp: r.gp.value }; }));
        if(!res){ say(out, '', '<p>' + (any ? 'প্রতিটা কোর্সে ক্রেডিট (০–১২) আর গ্রেড পয়েন্ট (০–১০) দুটোই বসান।' : 'ক্রেডিট আর গ্রেড পয়েন্ট বসালেই সিজিপিএ এখানে হিসাব হয়ে দেখা যাবে।') + '</p>'); return; }
        say(out, '', '<div class="cc-big"><small>আপনার সিজিপিএ</small><b>' + n2(res.cgpa) + '</b><em>আনুমানিক</em></div><p>' + bn(res.courses) + 'টি কোর্স, মোট ক্রেডিট ' + bn(Number(res.credits.toFixed(2))) + ', ক্রেডিট × গ্রেড পয়েন্টের যোগফল ' + n2(res.points) + '। ' + n2(res.points) + ' ÷ ' + bn(Number(res.credits.toFixed(2))) + ' = ' + n2(res.cgpa) + '।</p><p>দুই দশমিকে রাউন্ড করে দেখানো হয়। বিশ্ববিদ্যালয়ের চূড়ান্ত সিজিপিএ আপনার ট্রান্সক্রিপ্টের।</p>');
      } else {
        var v = ['pc', 'pcr', 'sg', 'scr'].map(function(k){ return $(k).value; });
        var any2 = v.some(function(x){ return x !== ''; });
        var res2 = v.every(function(x){ return x !== ''; }) ? G.cumulative(v[0], v[1], v[2], v[3]) : null;
        if(!res2){ say(out, '', '<p>' + (any2 ? 'চারটা ঘরই পূরণ করুন (ক্রেডিট ০-র বেশি হতে হবে, জিপিএ ০–১০)।' : 'চারটা ঘর পূরণ করলেই নতুন সিজিপিএ দেখা যাবে।') + '</p>'); return; }
        say(out, '', '<div class="cc-big"><small>নতুন সিজিপিএ</small><b>' + n2(res2.cgpa) + '</b><em>আনুমানিক</em></div><p>(' + n2(v[0]) + ' × ' + bn(Number(v[1])) + ' + ' + n2(v[2]) + ' × ' + bn(Number(v[3])) + ') ÷ ' + bn(Number(res2.credits.toFixed(2))) + ' = ' + n2(res2.cgpa) + '। মোট ক্রেডিট এখন ' + bn(Number(res2.credits.toFixed(2))) + '।</p><p>রিটেক বা গ্রেড উন্নয়নের নিয়ম বিশ্ববিদ্যালয়ভেদে আলাদা, তাই সেটা এখানে ধরা হয়নি।</p>');
      }
    }
    function build(){ rowsBox.innerHTML = ''; rows = []; for(var i = 0; i < 5; i++){ var r = makeRow(); rows.push(r); rowsBox.appendChild(r.row); } paint(); }
    $('ccAdd').addEventListener('click', function(){ if(rows.length >= 20) return; var r = makeRow(); rows.push(r); rowsBox.appendChild(r.row); r.row.firstChild.focus(); paint(); });
    $('ccReset').addEventListener('click', function(){ ['pc', 'pcr', 'sg', 'scr'].forEach(function(k){ $(k).value = ''; }); build(); });
    ['pc', 'pcr', 'sg', 'scr'].forEach(function(k){ $(k).addEventListener('input', paint); });
    root.querySelectorAll('[data-panel]').forEach(function(b){ b.addEventListener('click', function(){
      if(b.dataset.panel === panel) return; panel = b.dataset.panel;
      root.querySelectorAll('[data-panel]').forEach(function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      $('ccCourses').hidden = panel !== 'courses'; $('ccCumul').hidden = panel !== 'cumul'; paint();
    }); });
    build();
  }

  var root = document.querySelector('[data-calc]'); if(!root) return;
  if(root.dataset.calc === 'gpa') initGpa(root); else initCgpa(root);
})();
