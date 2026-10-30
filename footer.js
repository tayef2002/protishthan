/* Protishthan — shared full-width footer.
   HOW TO ADD A LINK: add it to COLS below (one place for every page).
   HOW TO ADD A PAGE: <div id="pfoot" data-art="card"></div>, then footer.css in the head and this script at the end of the body. */
(function(){
  'use strict';
  var el = document.getElementById('pfoot'); if(!el || el.dataset.ready) return;

  var COLS = [
    { t: 'খুঁজুন', l: [['তথ্যভান্ডার', 'index.html'], ['বোর্ড ফলাফল', 'results.html'], ['প্রতিষ্ঠান যোগ করুন', 'list-institution.html']] },
    { t: 'টুলস', l: [['শিক্ষিত কার্ড', 'card.html'], ['স্কিল আইডেন্টিটি', 'skill.html'], ['স্কুল সফটওয়্যার', 'software.html']] },
    { t: 'আরও', l: [['Partner প্রোগ্রাম', 'partner.html'], ['আমার প্রোফাইল', 'member.html'], ['গোপনীয়তা নীতি', 'privacy.html'], ['ব্যবহারের শর্ত', 'terms.html']] }
  ];
  var TAGLINE = { card: 'শিক্ষাজীবনের পথচলা, এক কার্ডে', skill: 'এক লিংকে আপনার সব স্কিল' };

  var R = function(x, y, w, h, fill, ex){ return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"' + (ex || '') + '/>'; };
  var arch = function(x, y, w, h, fill, ex){ return '<path d="M' + x + ' ' + (y + h) + 'V' + (y + w / 2) + 'a' + (w / 2) + ' ' + (w / 2) + ' 0 0 1 ' + w + ' 0V' + (y + h) + 'Z" fill="' + fill + '"' + (ex || '') + '/>'; };
  var SK = ' stroke="#B9C9EE" stroke-width="1.3"';
  var T = function(x, y, txt, size, fill, ex){ return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-family="Hind Siliguri,Inter,sans-serif" font-size="' + size + '" font-weight="700" fill="' + fill + '"' + (ex || '') + '>' + txt + '</text>'; };

  var DEFS = '<defs>' +
    '<g id="pf-kid"><rect x="-3.5" y="-10" width="3" height="10" rx="1" fill="#1E3A8A"/><rect x=".5" y="-10" width="3" height="10" rx="1" fill="#1E3A8A"/><rect x="-5" y="-21" width="10" height="12" rx="3" fill="#fff" stroke="#C7D6F5" stroke-width=".8"/><rect x="-10" y="-20" width="6" height="10" rx="2" fill="#F43F5E"/><circle cy="-25.5" r="4.5" fill="#F2C6A0"/><path d="M-4.6-26.5a4.6 4.6 0 0 1 9.2 0z" fill="#3F2A1D"/></g>' +
    '<g id="pf-girl"><rect x="-3" y="-8" width="2.6" height="8" rx="1" fill="#F2C6A0"/><rect x=".4" y="-8" width="2.6" height="8" rx="1" fill="#F2C6A0"/><path d="M-5.5-8L-3.8-21H3.8L5.5-8Z" fill="#4F46E5"/><rect x="-4" y="-21" width="8" height="6" rx="2" fill="#fff"/><rect x="-10" y="-20" width="6" height="9" rx="2" fill="#F59E0B"/><circle cy="-25.5" r="4.5" fill="#F2C6A0"/><path d="M-4.7-26a4.7 4.7 0 0 1 9.4 0z" fill="#3F2A1D"/><rect x="-5.2" y="-26" width="2" height="9" rx="1" fill="#3F2A1D"/></g>' +
    '<g id="pf-mad"><rect x="-3.2" y="-8" width="2.8" height="8" rx="1" fill="#F2C6A0"/><rect x=".4" y="-8" width="2.8" height="8" rx="1" fill="#F2C6A0"/><rect x="-5.5" y="-22" width="11" height="15" rx="3" fill="#F8FAFC" stroke="#B8C7EA" stroke-width=".8"/><circle cy="-26.5" r="4.5" fill="#F2C6A0"/><path d="M-4.5-27.5a4.5 4.5 0 0 1 9 0z" fill="#fff" stroke="#B8C7EA" stroke-width=".6"/></g>' +
    '<g id="pf-grad"><rect x="-3.5" y="-6" width="3" height="6" fill="#1E1B4B"/><rect x=".5" y="-6" width="3" height="6" fill="#1E1B4B"/><rect x="-6.5" y="-24" width="13" height="19" rx="3" fill="#4F46E5"/><circle cy="-28.5" r="4.5" fill="#F2C6A0"/><rect x="-6.5" y="-35" width="13" height="2.6" fill="#1E1B4B"/><path d="M-4 -37.5H4L6.5 -35H-6.5Z" fill="#1E1B4B"/><path d="M5.5-35v7" stroke="#F5B316" stroke-width="1.2"/></g>' +
    '<g id="pf-cap"><path d="M-9 0L0-4.500 9 0 0 4.500Z" fill="#1E1B4B"/><path d="M-4.500 1.500v4q4.500 2 9 0v-4" fill="#312E81"/><path d="M8 0v6" stroke="#F5B316" stroke-width="1.200"/></g>' +
    '<g id="pf-tree"><rect x="-3" y="-26" width="6" height="26" rx="2" fill="#B7791F"/><circle cx="0" cy="-40" r="17" fill="#34D399"/><circle cx="-12" cy="-30" r="11" fill="#10B981"/><circle cx="12" cy="-30" r="11" fill="#10B981"/></g>' +
    '<g id="pf-card"><rect width="26" height="17" rx="3" fill="#1E3A8A" stroke="#F5B316" stroke-width="1"/><rect x="3.500" y="3.500" width="7" height="5.500" rx="1.200" fill="#F5B316"/><rect x="13" y="5" width="9" height="1.800" rx=".9" fill="#fff" opacity=".8"/><rect x="13" y="9.500" width="6" height="1.800" rx=".9" fill="#fff" opacity=".5"/></g>' +
    '<linearGradient id="pf-cv" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7C3AED"/><stop offset=".55" stop-color="#2563EB"/><stop offset="1" stop-color="#06B6D4"/></linearGradient>' +
    '<linearGradient id="pf-bigcard" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0A1628"/><stop offset="1" stop-color="#1F3F8F"/></linearGradient>' +
    '</defs>';

  /* shared landscape: sun, clouds, hills, ground */
  function land(){
    var cl = function(x, y, c, k){ return '<g class="cloud ' + (k || '') + '"><ellipse cx="' + x + '" cy="' + y + '" rx="52" ry="12" fill="' + c + '"/><ellipse cx="' + (x - 22) + '" cy="' + (y - 8) + '" rx="26" ry="14" fill="' + c + '"/><ellipse cx="' + (x + 24) + '" cy="' + (y - 7) + '" rx="28" ry="16" fill="' + c + '"/></g>'; };
    return '<circle cx="1230" cy="96" r="96" fill="#FFF4D2"/><circle cx="1230" cy="96" r="64" fill="#FFE28F"/><circle cx="1230" cy="96" r="44" fill="#FFC857"/>' +
      cl(210, 74, '#fff') + cl(620, 52, '#fff', 'c2') + cl(930, 92, '#fff') +
      '<path d="M0 238C140 184 270 190 400 228S650 190 800 224 1060 186 1220 226 1380 208 1440 222V300H0Z" fill="#DCE9FB"/>' +
      '<path d="M0 266C170 232 320 244 480 264S780 238 980 262 1300 242 1440 258V300H0Z" fill="#CFE8DA"/>' +
      R(0, 288, 1440, 32, '#D9E3F7') + R(0, 284, 1440, 6, '#E9EFFC') + '<path d="M0 304H1440" stroke="#fff" stroke-width="3" stroke-dasharray="34 30" opacity=".85"/>';
  }
  var tree = function(x, s){ return '<use href="#pf-tree" transform="translate(' + x + ' 288) scale(' + (s || 1) + ')"/>'; };
  var walker = function(cls, x, def, card){ return '<g class="' + cls + '"><g transform="translate(' + x + ' 288)"><g class="bob"><use href="#' + def + '"/>' + (card ? '<g transform="translate(5 -19) scale(.62)"><use href="#pf-card"/></g>' : '') + '</g></g></g>'; };

  /* ---------- art 1: the card page: one card grows with you, step by step, until someone verifies it ---------- */
  function artCard(){
    var s = '';
    var steps = [
      {x: 70,  w: 200, h: 34,  c: '#10B981', t: 'ক্লাস ১',        p: 'pf-kid'},
      {x: 270, w: 200, h: 64,  c: '#1A56DB', t: 'এসএসসি',         p: 'pf-girl'},
      {x: 470, w: 200, h: 94,  c: '#4F46E5', t: 'এইচএসসি',        p: 'pf-mad'},
      {x: 670, w: 200, h: 124, c: '#7C3AED', t: 'বিশ্ববিদ্যালয়', p: 'pf-grad'},
      {x: 870, w: 330, h: 154, c: '#F59E0B', t: 'চাকরি',          p: 'pf-girl'}
    ];
    // steps
    steps.forEach(function(st){
      var top = 288 - st.h;
      s += R(st.x, top, st.w, st.h, st.c) + R(st.x, top, st.w, 6, '#fff', ' opacity=".38"') + T(st.x + 100, top + 26, st.t, 13, '#fff');
    });
    // growth path linking the cards
    var pts = steps.map(function(st, i){ return (st.x + (i === 4 ? 80 : 100)) + ' ' + (288 - st.h - 80); });
    for(var i = 0; i < 4; i++){
      var a = pts[i].split(' '), b = pts[i + 1].split(' ');
      s += '<path class="flow" d="M' + (+a[0] + 24) + ' ' + a[1] + 'Q' + ((+a[0] + +b[0]) / 2) + ' ' + (Math.min(+a[1], +b[1]) - 26) + ' ' + (+b[0] - 24) + ' ' + b[1] + '" fill="none" stroke="#F5B316" stroke-width="2" stroke-dasharray="3 8" stroke-linecap="round"/>';
    }
    // people + their card, which gets one more gold star each step
    steps.forEach(function(st, i){
      var top = 288 - st.h, cx = st.x + (i === 4 ? 80 : 100), p = st.p;
      s += '<g transform="translate(' + cx + ' ' + top + ')"><g class="bob" style="animation-delay:' + (i * -.12) + 's"><use href="#' + p + '"/></g></g>';
      s += '<g class="fl" style="--d:' + (i * .5) + 's"><g transform="translate(' + (cx - 18) + ' ' + (top - 92) + ') scale(1.4)"><use href="#pf-card"/></g>';
      for(var k = 0; k <= i; k++) s += '<path transform="translate(' + (cx - 2 * i * 5 + k * 10 - 0) + ' ' + (top - 52) + ') scale(.9)" d="M0-5L1.600-1.600 5.200-1.200 2.500 1.200 3.200 4.800 0 3 -3.200 4.800 -2.500 1.200 -5.200-1.200 -1.600-1.600Z" fill="#F5B316"/>';
      s += '</g>';
    });
    // the one who checks the card: phone + green tick
    var vx = 1130, vt = 288 - 154;
    s += '<g transform="translate(' + vx + ' ' + vt + ')"><g class="bob"><use href="#pf-mad"/></g><rect x="-17" y="-18" width="7" height="12" rx="1.600" fill="#0F172A"/><rect x="-16" y="-17" width="5" height="9" rx="1" fill="#34D399"/></g>';
    s += '<path class="flow" d="M' + (steps[4].x + 104) + ' ' + (vt - 62) + 'Q' + (vx - 30) + ' ' + (vt - 90) + ' ' + (vx - 6) + ' ' + (vt - 56) + '" fill="none" stroke="#10B981" stroke-width="2" stroke-dasharray="3 7" stroke-linecap="round"/>';
    s += '<g class="fl" style="--d:.9s"><g transform="translate(' + (vx + 6) + ' ' + (vt - 86) + ')"><rect x="-46" y="-18" width="92" height="30" rx="15" fill="#fff" stroke="#BDEBD6" stroke-width="1.400"/><circle cx="-28" cy="-3" r="10" fill="#10B981"/><path d="M-33-3l4 4 7-8" fill="none" stroke="#fff" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/>' + T(10, 1, 'যাচাই হয়েছে', 11.5, '#047857') + '</g></g>';
    // grad caps in the air above the 4th step
    s += '<g class="cap" style="--d:-.6s"><use href="#pf-cap" transform="translate(790 ' + (288 - 124 - 40) + ')"/></g>';
    // trees, book stack, park
    s += tree(36, .8) + tree(1250, 1.2) + tree(1392, .9);
    s += R(1300, 276, 40, 7, '#1A56DB', ' rx="2"') + R(1303, 268, 34, 8, '#F5B316', ' rx="2"') + R(1306, 260, 28, 8, '#10B981', ' rx="2"');
    s += '<g transform="translate(1346 288)"><rect x="-22" y="-14" width="44" height="5" rx="2" fill="#B7791F"/><rect x="-18" y="-9" width="3" height="9" fill="#8A5A14"/><rect x="15" y="-9" width="3" height="9" fill="#8A5A14"/><rect x="-22" y="-26" width="44" height="4" rx="2" fill="#B7791F"/></g>';
    s += walker('w3', 1000 + 40, 'pf-kid', 1).replace('translate(1040 288)', 'translate(1210 288)');
    s += [[40, 120], [520, 40], [880, 60], [1180, 200]].map(function(p, i){ return '<path class="sp" style="--d:' + (i * .7) + 's" transform="translate(' + p[0] + ' ' + p[1] + ')" d="M0-6Q0 0 6 0Q0 0 0 6Q0 0-6 0Q0 0 0-6Z" fill="#F5B316"/>'; }).join('');
    s += '<g class="bird" style="--d:0s"><path d="M0 0q5-6 10 0q5-6 10 0" transform="translate(0 100)" fill="none" stroke="#7C8DB5" stroke-width="1.800" stroke-linecap="round"/></g><g class="bird" style="--d:-7s"><path d="M0 0q5-6 10 0q5-6 10 0" transform="translate(0 140)" fill="none" stroke="#7C8DB5" stroke-width="1.800" stroke-linecap="round"/></g>';
    return s;
  }

  /* ---------- art 2: the skill page: five makers, their skills, one link ---------- */
  function artSkill(){
    var s = '', xs = [150, 430, 710, 990, 1270], cols = ['#EF4444', '#7C3AED', '#1A56DB', '#10B981', '#F59E0B'];
    // hub: one link, in the sky
    s += '<g class="fl" style="--d:.3s"><circle cx="720" cy="62" r="40" fill="#fff" stroke="#C7D6F5" stroke-width="1.500"/><circle cx="720" cy="62" r="32" fill="url(#pf-cv)"/><g transform="translate(704 46)" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M13 19a6 6 0 0 0 8.500 0l3.500-3.500a6 6 0 0 0-8.500-8.500l-2 2"/><path d="M19 13a6 6 0 0 0-8.500 0L7 16.500a6 6 0 0 0 8.500 8.500l2-2"/></g>' + T(720, 118, 'এক লিংক', 12, '#1A56DB') + '</g>';
    xs.forEach(function(x, i){ s += '<path class="flow" d="M' + x + ' 168Q' + ((x + 720) / 2) + ' ' + (110 - (i % 2) * 22) + ' 720 100" fill="none" stroke="' + cols[i] + '" stroke-width="2" stroke-dasharray="3 8" stroke-linecap="round" opacity=".7"/>'; });
    // share bubbles near the hub
    s += '<g class="pulse" style="--d:0s"><circle cx="806" cy="70" r="12" fill="#1877F2"/>' + T(806, 75, 'f', 14, '#fff', ' font-family="Inter,sans-serif" font-weight="800"') + '</g><g class="pulse" style="--d:.8s"><circle cx="840" cy="100" r="12" fill="#25D366"/><path d="M834 101l4 4 7-8" stroke="#fff" stroke-width="2.200" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g><g class="pulse" style="--d:1.6s"><circle cx="634" cy="72" r="12" fill="#0A66C2"/>' + T(634, 76, 'in', 11, '#fff', ' font-family="Inter,sans-serif" font-weight="800"') + '</g>';
    // each maker in an open studio, with the floating skill icon above
    var studio = function(x){ return R(x - 92, 196, 184, 92, '#F7F9FF', SK + ' rx="8"') + R(x - 92, 276, 184, 12, '#EAF0FD'); };
    var head = function(cx, cy, hair){ return '<circle cx="' + cx + '" cy="' + cy + '" r="12" fill="#F2C6A0"/><path d="M' + (cx - 12.500) + ' ' + (cy - 2) + 'a12.500 12.500 0 0 1 25 0q-6-7-12.500-7t-12.500 7Z" fill="' + hair + '"/>'; };
    var body = function(cx, top, c){ return '<rect x="' + (cx - 17) + '" y="' + top + '" width="34" height="38" rx="13" fill="' + c + '"/>'; };
    // 1 video editor
    var x = xs[0];
    s += studio(x) + body(x - 36, 236, '#EF4444') + head(x - 36, 224, '#3F2A1D') + R(x - 4, 252, 64, 36, '#E2E8F7', SK + ' rx="3"') + R(x - 2, 232, 62, 40, '#0B1229', ' rx="3"') + '<path d="M' + (x + 22) + ' 244l14 8-14 8z" fill="#EF4444"/>' + R(x + 2, 264, 54, 3, '#1B2547') + R(x + 2, 264, 30, 3, '#6EA8FF', ' rx="1.500"') + R(x + 14, 288, 40, 0, '#fff');
    s += '<g class="fl" style="--d:0s"><circle cx="' + x + '" cy="170" r="20" fill="#EF4444"/><path d="M' + (x - 5) + ' 160l16 10-16 10z" fill="#fff"/></g>';
    // 2 designer
    x = xs[1];
    s += studio(x) + body(x - 40, 236, '#7C3AED') + head(x - 40, 224, '#1F2937') + R(x - 14, 216, 62, 52, '#fff', SK + ' rx="4"') + '<circle cx="' + (x + 2) + '" cy="236" r="9" fill="#F43F5E"/><rect x="' + (x + 14) + '" y="230" width="16" height="16" rx="3" fill="#1A56DB"/><path d="M' + (x + 6) + ' 258l9-14 9 14z" fill="#F5B316"/><rect x="' + (x + 34) + '" y="222" width="3.500" height="34" rx="1.700" fill="#8B5CF6" transform="rotate(24 ' + (x + 34) + ' 222)"/>' + R(x - 10, 268, 6, 20, '#C7D6F5') + R(x + 38, 268, 6, 20, '#C7D6F5');
    s += '<g class="fl" style="--d:.5s"><circle cx="' + x + '" cy="170" r="20" fill="#7C3AED"/><path d="M' + (x - 8) + ' 178l2-8 12-12 6 6-12 12z" fill="none" stroke="#fff" stroke-width="2.400" stroke-linejoin="round"/></g>';
    // 3 developer
    x = xs[2];
    s += studio(x) + body(x - 36, 236, '#1A56DB') + head(x - 36, 224, '#3F2A1D') + R(x - 6, 258, 66, 8, '#E2E8F7', SK + ' rx="3"') + R(x - 2, 230, 58, 30, '#0B1229', ' rx="3"') + [['#6EA8FF', 34], ['#38E1C6', 22], ['#A78BFA', 30], ['#F59E0B', 16]].map(function(r, i){ return R(x + 4 + (i % 2) * 6, 236 + i * 6, r[1], 3, r[0], ' rx="1.500"'); }).join('') + '<rect x="' + (x + 66) + '" y="248" width="12" height="14" rx="3" fill="#fff" stroke="#B9C9EE"/><path d="M' + (x + 70) + ' 242q-2-4 0-7M' + (x + 75) + ' 242q-2-4 0-7" stroke="#B9C9EE" stroke-width="1.500" fill="none" stroke-linecap="round"/>';
    s += '<g class="fl" style="--d:1s"><circle cx="' + x + '" cy="170" r="20" fill="#1A56DB"/><path d="M' + (x - 6) + ' 164l-7 6 7 6M' + (x + 6) + ' 164l7 6-7 6M' + (x + 2) + ' 162l-4 16" fill="none" stroke="#fff" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/></g>';
    // 4 photographer
    x = xs[3];
    s += studio(x) + [[x - 76, '#BFDBFE'], [x - 52, '#FDE68A'], [x - 28, '#BBF7D0']].map(function(f){ return R(f[0], 208, 20, 24, '#fff', SK) + R(f[0] + 3, 211, 14, 15, f[1]); }).join('') + body(x + 26, 236, '#10B981') + head(x + 26, 224, '#3F2A1D') + '<path d="M' + (x - 26) + ' 288l12-48 12 48M' + (x - 14) + ' 240v48" stroke="#94A3B8" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="' + (x - 32) + '" y="224" width="38" height="24" rx="5" fill="#334155"/><circle cx="' + (x - 13) + '" cy="236" r="8" fill="#0B1229" stroke="#CBD5E1" stroke-width="2"/><circle cx="' + (x - 13) + '" cy="236" r="3" fill="#60A5FA"/><rect x="' + (x - 24) + '" y="220" width="10" height="5" rx="2" fill="#475569"/>';
    s += '<g class="fl" style="--d:1.5s"><circle cx="' + x + '" cy="170" r="20" fill="#10B981"/><rect x="' + (x - 9) + '" y="164" width="18" height="13" rx="3.500" fill="none" stroke="#fff" stroke-width="2.200"/><circle cx="' + x + '" cy="170.500" r="3.500" fill="#fff"/></g>';
    // 5 voice / podcast
    x = xs[4];
    s += studio(x) + body(x + 20, 236, '#F59E0B') + head(x + 20, 224, '#1F2937') + '<path d="M' + (x + 8) + ' 222a12 12 0 0 1 24 0" fill="none" stroke="#334155" stroke-width="3"/><rect x="' + (x + 4) + '" y="220" width="6" height="10" rx="3" fill="#334155"/><rect x="' + (x + 30) + '" y="220" width="6" height="10" rx="3" fill="#334155"/><rect x="' + (x - 34) + '" y="226" width="12" height="22" rx="6" fill="#475569"/><path d="M' + (x - 38) + ' 242a10 10 0 0 0 20 0M' + (x - 28) + ' 252v32M' + (x - 40) + ' 286h24" fill="none" stroke="#94A3B8" stroke-width="2.600" stroke-linecap="round"/>' + [14, 24].map(function(r, i){ return '<circle class="pulse" style="--d:' + (i * .6) + 's" cx="' + (x - 28) + '" cy="237" r="' + (r + 6) + '" fill="none" stroke="#F59E0B" stroke-width="1.600"/>'; }).join('');
    s += '<g class="fl" style="--d:2s"><circle cx="' + x + '" cy="170" r="20" fill="#F59E0B"/><rect x="' + (x - 5) + '" y="160" width="10" height="16" rx="5" fill="#fff"/><path d="M' + (x - 9) + ' 171a9 9 0 0 0 18 0M' + x + ' 180v4" fill="none" stroke="#fff" stroke-width="2.200" stroke-linecap="round"/></g>';
    s += tree(290, .85) + tree(570, .8) + tree(850, .85) + tree(1130, .8) + tree(40, 1) + tree(1410, 1);
    s += [[60, 100], [330, 70], [1020, 56], [1350, 150]].map(function(p, i){ return '<path class="sp" style="--d:' + (i * .7) + 's" transform="translate(' + p[0] + ' ' + p[1] + ')" d="M0-6Q0 0 6 0Q0 0 0 6Q0 0-6 0Q0 0 0-6Z" fill="#F5B316"/>'; }).join('');
    s += '<g class="bird" style="--d:0s"><path d="M0 0q5-6 10 0q5-6 10 0" transform="translate(0 120)" fill="none" stroke="#7C8DB5" stroke-width="1.800" stroke-linecap="round"/></g><g class="bird" style="--d:-8s"><path d="M0 0q5-6 10 0q5-6 10 0" transform="translate(0 84)" fill="none" stroke="#7C8DB5" stroke-width="1.800" stroke-linecap="round"/></g>';
    return s;
  }

  var art = el.dataset.art === 'skill' ? 'skill' : 'card';
  var svg = '<svg viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + DEFS + land() + (art === 'skill' ? artSkill() : artCard()) + '</svg>';
  var cols = COLS.map(function(c){ return '<div><h4>' + c.t + '</h4>' + c.l.map(function(x){ return '<a href="' + x[1] + '">' + x[0] + '</a>'; }).join('') + '</div>'; }).join('');
  el.className = 'pf'; el.dataset.ready = '1';
  el.innerHTML = '<div class="pf-in"><div class="pf-brand"><a class="lg" href="index.html"><i><img src="logo-sm.webp" alt="" width="36" height="36" decoding="async"></i><b>Protisht<span>han</span></b></a><p>বাংলাদেশের সকল শিক্ষা প্রতিষ্ঠানের তথ্যভান্ডার, আর আপনার নিজের শিক্ষা ও স্কিলের পরিচয়, সব এক জায়গায়।</p><span class="tag">' + TAGLINE[art] + '</span></div><nav class="pf-cols" aria-label="ফুটার">' + cols + '</nav></div>' +
    '<div class="pf-bar"><span>© ' + String(new Date().getFullYear()).replace(/[0-9]/g, function(d){ return '০১২৩৪৫৬৭৮৯'[d]; }) + ' Protishthan. সর্বস্বত্ব সংরক্ষিত।</span><span>বাংলাদেশের শিক্ষার জন্য, ভালোবাসা দিয়ে</span></div><div class="pf-art">' + svg + '</div>';
})();
