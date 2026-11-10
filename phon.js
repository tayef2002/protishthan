/* Protishthan — the "sound key": the same short key for the Bangla and the English spelling of a name ("ঢাকা কলেজ" and "Dhaka College" both become tkC).
   An exact JavaScript copy of phon_key() in the database (migrations/2026-11-15_sound_search.sql), so the card page can search the saved name index in the browser
   and get the same answer as the server. If the SQL function ever changes, change this file the same way and run tools/card-index/verify_live.mjs.
   PhonKey(text) -> string */
(function(root){
  'use strict';
  var WORDS = [   // words that translate each other become one upper-case token (order matters, same as the SQL)
    [/government|govt\.?|সরকারি|সরকারী/g, 'G'],
    [/primary|প্রাথমিক/g, 'P'],
    [/high|উচ্চ|হাই/g, 'H'],
    [/বিশ্ববিদ্যাল|university/g, 'U'],
    [/school|স্কুল|বিদ্যাল/g, 'S'],
    [/college|কলেজ/g, 'C'],
    [/madrasah|madrasha|madrasa|madrassa|madrassah|মাদ্রাসা|মাদরাসা/g, 'M'],
    [/girls?|বালিকা/g, 'L'],
    [/boys?|বালক/g, 'B'],
    [/model|মডেল/g, 'O'],
    [/ideal|আইডিয়াল/g, 'I'],
    [/academy|একাডেমি|একাডেমী/g, 'A'],
    [/institute|ইনস্টিটিউট/g, 'N'],
    [/technical|কারিগরি/g, 'T'],
    [/dakhil|দাখিল/g, 'D'],
    [/alim|আলিম/g, 'E'],
    [/fazil|ফাজিল/g, 'F'],
    [/kamil|কামিল/g, 'K']
  ];
  var FROM = 'ৃঋকখগঘচছজঝযটঠডঢতথদধৎনণঙঞংপফবভমরলশষস';
  var TO   = 'rrkkkkjjjjjtttttttttnnnnnppbbmrlsss';
  var MAP = {}; for (var i = 0; i < FROM.length; i++) MAP[FROM.charAt(i)] = TO.charAt(i);
  var LATIN_MAP = { c: 'k', q: 'k', g: 'k', z: 'j', d: 't', v: 'b', f: 'p' };

  function PhonKey(t){
    var s = String(t == null ? '' : t);
    try { s = s.normalize('NFC'); } catch (e) {}
    s = s.toLowerCase();
    s = s.replace(/[​-‍]/g, '');                                  // joiners
    s = s.split('ড়').join('র').split('ঢ়').join('র');                 // ড় ঢ় typed as two keys become র
    s = s.split('য়').join('');                                          // য় vanishes
    s = s.split('ে' + 'া').join('ো');                                    // ে+া = ো
    for (var w = 0; w < WORDS.length; w++) s = s.replace(WORDS[w][0], ' ' + WORDS[w][1] + ' ');
    s = s.replace(/\band\b|&/g, ' ');
    // English spelling -> sound classes
    s = s.split('dge').join('j').split('ph').join('p').split('sh').join('s').split('ch').join('j');
    s = s.split('th').join('t').split('dh').join('t').split('bh').join('b').split('kh').join('k');
    s = s.split('gh').join('k').split('ck').join('k').split('qu').join('k').split('x').join('ks');
    s = s.replace(/g(?=[eiy])/g, 'j').replace(/c(?=[eiy])/g, 's');
    s = s.replace(/[cqgzdvf]/g, function(c){ return LATIN_MAP[c]; });
    s = s.replace(/[aeiouyhw]/g, '');
    // Bangla letters -> the same classes; other Bangla signs vanish
    s = s.replace(/[ৃঋকখগঘচছজঝযটঠডঢতথদধৎনণঙঞংপফবভমরলশষস]/g, function(c){ return MAP[c]; });
    s = s.replace(/[ঀ-৿]/g, '');
    s = s.replace(/[^A-Za-z0-9]/g, '');
    return s.replace(/(.)\1+/g, '$1');
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = PhonKey;
  root.PhonKey = PhonKey;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
