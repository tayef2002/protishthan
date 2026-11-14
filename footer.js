/* Protishthan — shared full-width footer.
   HOW TO ADD A LINK: add it to COLS below (one place for every page).
   HOW TO ADD A PAGE: <div id="pfoot" data-art="card"></div> (data-art only picks the tagline), then footer.css in the head and this script at the end of the body. */
(function(){
  'use strict';
  var el = document.getElementById('pfoot'); if(!el || el.dataset.ready) return;

  var COLS = [
    { t: 'খুঁজুন', l: [['প্রতিষ্ঠান খুঁজুন', 'index.html'], ['দরকারি তথ্য', 'info.html'], ['শিক্ষা গাইড', 'guide.html'], ['জেলা অনুযায়ী', 'area'], ['প্রতিষ্ঠান যোগ করুন', 'list-institution.html']] },
    { t: 'টুলস', l: [['শিক্ষিত কার্ড', 'card.html'], ['স্কিল কার্ড', 'skill.html'], ['মেমোরি কার্ড', 'memory.html'], ['ভাইয়া-আপু (টিউটর)', 'tutor.html'], ['জিপিএ ক্যালকুলেটর', 'gpa.html'], ['সিজিপিএ ক্যালকুলেটর', 'cgpa.html']] },
    { t: 'আরও', l: [['আমাদের কথা', 'about.html'], ['মন্তব্য ও পরামর্শ', 'feedback.html'], ['পাশে দাঁড়ান', 'collaborate.html'], ['Partner প্রোগ্রাম', 'partner.html'], ['আমার প্রোফাইল', 'member.html'], ['গোপনীয়তা নীতি', 'privacy.html'], ['ব্যবহারের শর্ত', 'terms.html']] }
  ];
  var TAGLINE = { card: 'শিক্ষাজীবনের পথচলা, এক কার্ডে', skill: 'এক লিংকে আপনার সব স্কিল', info: 'দরকারি তথ্য, এক জায়গায়' };

  var art = el.dataset.art === 'skill' ? 'skill' : el.dataset.art === 'info' ? 'info' : 'card';   // only picks the tagline now: the footer has no picture
  var cols = COLS.map(function(c){ return '<div><h4>' + c.t + '</h4>' + c.l.map(function(x){ return '<a href="' + x[1] + '">' + x[0] + '</a>'; }).join('') + '</div>'; }).join('');
  el.className = 'pf'; el.dataset.ready = '1';
  el.innerHTML = '<div class="pf-in"><div class="pf-brand"><a class="lg" href="index.html"><i><img src="logo-sm.webp" alt="" width="36" height="36" decoding="async"></i><b>Protisht<span>han</span></b></a><p>বাংলাদেশের সকল শিক্ষা প্রতিষ্ঠানের তথ্যভান্ডার, আর আপনার নিজের শিক্ষা ও স্কিলের পরিচয়, সব এক জায়গায়।</p><span class="tag">' + TAGLINE[art] + '</span></div><nav class="pf-cols" aria-label="ফুটার">' + cols + '</nav></div>' +
    '<div class="pf-bar"><span>© ' + String(new Date().getFullYear()).replace(/[0-9]/g, function(d){ return '০১২৩৪৫৬৭৮৯'[d]; }) + ' Protishthan. সর্বস্বত্ব সংরক্ষিত।</span><span>বাংলাদেশের শিক্ষার জন্য, ভালোবাসা দিয়ে</span></div>';
})();
