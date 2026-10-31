/* Protishthan — institute names are written in Bangla only.
   BnName.norm(s)       one clean spelling of what was typed (what we save)
   BnName.key(s)        forgiving form for searching: ignores ি/ী, ু/ূ, ণ/ন, শ/ষ/স, য়/য, hasanta, spaces (মাদ্রাসা = মাদরাসা)
   BnName.match(a, q)   does name `a` contain the search text `q`?
   BnName.hasLatin(s)   true when English letters are mixed in (not allowed in a name)
   BnName.guard(input, onChange)   shows the "বাংলায় লিখুন" hint under an input while English letters are present */
(function(){
  'use strict';
  var BN_DIGIT = '০১২৩৪৫৬৭৮৯';
  function norm(s){
    s = String(s == null ? '' : s);
    try{ s = s.normalize('NFC'); }catch(e){}
    s = s.replace(/[​-‍⁠﻿]/g, '')                       // zero-width joiners left by some keyboards
         .replace(/ড়/g, 'ড়').replace(/ঢ়/g, 'ঢ়').replace(/য়/g, 'য়')   // ড় ঢ় য় typed as two keys
         .replace(/ো/g, 'ো').replace(/ৌ/g, 'ৌ')                                       // ে+া = ো , ে+ৗ = ৌ
         .replace(/[0-9]/g, function(d){ return BN_DIGIT[+d]; })                                                       // 12 -> ১২
         .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
         .replace(/\s+/g, ' ').trim();
    return s;
  }
  function key(s){
    return norm(s).replace(/[ী]/g, 'ি').replace(/[ূ]/g, 'ু').replace(/[ঈ]/g, 'ই').replace(/[ঊ]/g, 'উ')   // ী ূ ঈ ঊ
      .replace(/[ণ]/g, 'ন').replace(/[ষশ]/g, 'স')           // ণ -> ন ; ষ শ -> স
      .replace(/য়/g, 'য').replace(/ড়/g, 'র').replace(/ঢ়/g, 'র')   // য় -> য ; ড় ঢ় -> র
      .replace(/ৎ/g, 'ত')                                                    // ৎ -> ত
      .replace(/[্ঁংঃ\s.,'"()\-–—\/]/g, '').toLowerCase();   // hasanta, chandrabindu, anusvara, visarga, spaces, punctuation
  }
  function match(name, q){ var k = key(q); return !!k && key(name).indexOf(k) > -1; }
  function hasLatin(s){ return /[A-Za-z]/.test(String(s || '')); }

  function guard(input, onChange){
    if(!input) return;
    var hint = document.createElement('div');
    hint.className = 'bn-hint'; hint.setAttribute('role', 'alert'); hint.hidden = true;
    hint.textContent = 'প্রতিষ্ঠানের নাম বাংলায় লিখুন। ইংরেজি অক্ষর চলবে না।';
    hint.style.cssText = 'margin:6px 2px 0;color:#DC2626;font:600 12.5px/1.5 \'Hind Siliguri\',sans-serif';
    (input.parentNode || document.body).insertBefore(hint, input.nextSibling);
    function check(){ var bad = hasLatin(input.value); hint.hidden = !bad; input.setAttribute('aria-invalid', bad ? 'true' : 'false'); if(onChange) onChange(bad); return bad; }
    input.addEventListener('input', check);
    input.addEventListener('blur', function(){ var n = norm(input.value); if(n !== input.value && !hasLatin(n)) input.value = n; });
    check();
    return { check: check, hint: hint };
  }
  /* one institution, one listing: asks the server whether this name already exists in the district (migrations/2026-11-11).
     Returns [] when the server cannot be reached, so a network problem never blocks a person; the database has its own guard. */
  function dupCheck(sb, name, district, upazila){
    var n = norm(name); if(key(n).length < 2 || !district) return Promise.resolve([]);
    try{ return Promise.resolve(sb.rpc('directory_check', { p_name: n, p_district: district, p_upazila: upazila || null })).then(function(r){ return (r && !r.error && Array.isArray(r.data)) ? r.data : []; }, function(){ return []; }); }catch(e){ return Promise.resolve([]); }
  }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* the box shown to the person: same upazila = blocked, other upazila = a heads-up */
  function dupHtml(rows){
    if(!rows || !rows.length) return '';
    var same = rows.filter(function(r){ return r.match_level === 'same_upazila'; }), other = rows.filter(function(r){ return r.match_level !== 'same_upazila'; });
    var line = function(r){ return '<div class="dup-row"><b>' + esc(r.institution_name) + '</b><span>' + esc([r.institution_type, r.upazila, r.district].filter(Boolean).join(' · ')) + (r.status === 'pending' ? ' · অনুমোদনের অপেক্ষায়' : '') + (r.verification === 'unverified' ? ' · যাচাই হয়নি' : '') + '</span>' + (r.desired_slug ? '<a href="institution-detail.html?slug=' + encodeURIComponent(r.desired_slug) + '" target="_blank" rel="noopener">পাতা দেখুন</a>' : '') + '</div>'; };
    if(same.length) return '<div class="dup dup-stop"><b>এই নামে প্রতিষ্ঠান আগেই তালিকায় আছে</b><p>একই নামের প্রতিষ্ঠান একই উপজেলায় দুইবার তালিকাভুক্ত করা যায় না। এটা আপনার প্রতিষ্ঠান হলে নতুন করে বানানোর দরকার নেই।</p>' + same.map(line).join('') + '</div>';
    return '<div class="dup dup-note"><b>এই নামে আপনার জেলায় আরেকটা প্রতিষ্ঠান আছে</b><p>নিচেরটা অন্য উপজেলার। আপনারটা আলাদা হলে চালিয়ে যান।</p>' + other.map(line).join('') + '</div>';
  }
  var DUP_CSS = '.dup{margin:12px 0 4px;padding:14px 16px;border-radius:14px;font-family:"Hind Siliguri",sans-serif;line-height:1.6}.dup b{display:block;font-size:15px}.dup p{margin:2px 0 8px;font-size:13.5px}.dup-stop{background:#FEF2F2;border:1px solid #FECACA;color:#991B1B}.dup-note{background:#FFFBEB;border:1px solid #FDE68A;color:#92400E}.dup-row{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;padding:8px 10px;border-radius:10px;background:#fff;margin-top:6px;color:#0F172A}.dup-row b{display:inline;font-size:14px}.dup-row span{font-size:12.5px;color:#64748B}.dup-row a{margin-left:auto;color:#1A56DB;font-weight:700;font-size:13px}';
  try{ var st = document.createElement('style'); st.textContent = DUP_CSS; document.head.appendChild(st); }catch(e){}
  window.BnName = { norm: norm, key: key, match: match, hasLatin: hasLatin, guard: guard, dupCheck: dupCheck, dupHtml: dupHtml };
})();
