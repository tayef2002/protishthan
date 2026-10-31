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
  window.BnName = { norm: norm, key: key, match: match, hasLatin: hasLatin, guard: guard };
})();
