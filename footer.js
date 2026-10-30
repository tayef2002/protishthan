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

  /* ---------- art 1: the card page: a campus street, a card for every step ---------- */
  function artCard(){
    var s = '';
    // bunting of little cards
    var pts = [], cards = '';
    for(var i = 0; i < 11; i++){ var x = 150 + i * 112, y = 52 + Math.round(Math.sin(i * .62) * 20 + 18); pts.push(x + ' ' + (y - 6)); cards += '<g transform="translate(' + (x - 13) + ' ' + (y - 6) + ')"><g class="sway" style="--d:' + (i * .3) + 's"><use href="#pf-card"/></g></g>'; }
    s += '<path d="M60 40L' + pts.join('L') + 'L1380 40" fill="none" stroke="#9FB0DC" stroke-width="1.6"/>' + R(56, 30, 4, 260, '#C7D6F5') + R(1378, 30, 4, 260, '#C7D6F5') + cards;
    // SCHOOL
    s += '<g transform="translate(90 288)"><polygon points="-12,-70 85,-112 182,-70" fill="#1A56DB"/>' + R(0, -70, 170, 70, '#fff', SK) + R(0, -70, 170, 7, '#E9F0FF') + [14, 48, 106, 140].map(function(wx){ return R(wx, -52, 18, 26, '#DCEAFF', ' stroke="#1A56DB" stroke-width="1.6" rx="2"'); }).join('') + arch(70, -42, 30, 42, '#4F46E5') + R(46, -96, 78, 18, '#1A56DB', ' rx="5"') + T(85, -83, 'বিদ্যালয়', 12, '#fff') +
      '<line x1="176" y1="-112" x2="176" y2="-70" stroke="#94A3B8" stroke-width="2"/><g class="flag"><rect x="176" y="-112" width="28" height="17" fill="#10B981"/><circle cx="190" cy="-103.500" r="5" fill="#EF4444"/></g></g>';
    s += tree(296, .9);
    // MADRASA
    s += '<g transform="translate(332 288)">' + R(0, -78, 150, 78, '#FFF7E0', ' stroke="#E7D9AE" stroke-width="1.5"') + R(-4, -86, 158, 11, '#10B981', ' rx="2"') + '<path d="M0 -86a9 9 0 0 1 18 0z" fill="#059669"/><path d="M132 -86a9 9 0 0 1 18 0z" fill="#059669"/><path d="M52 -86a23 23 0 0 1 46 0z" fill="#10B981"/><circle cx="75" cy="-112" r="2.800" fill="#F5B316"/>' + R(34, -70, 82, 17, '#059669', ' rx="5"') + T(75, -58, 'মাদ্রাসা', 12, '#fff') +
      [10, 34, 98, 122].map(function(wx){ return arch(wx, -46, 16, 26, '#E6F0FF', ' stroke="#059669" stroke-width="1.6"'); }).join('') + arch(57, -40, 36, 40, '#059669') + '</g>';
    s += tree(504, .85);
    // COLLEGE
    s += '<g transform="translate(540 288)">' + R(0, -62, 64, 62, '#F6C3A6', ' rx="2"') + R(128, -62, 64, 62, '#F6C3A6', ' rx="2"') + R(62, -92, 68, 92, '#F3B393') + '<path d="M58 -92L96 -116 134 -92Z" fill="#E9A284"/>' + R(78, -138, 36, 48, '#F3B393') + '<polygon points="72,-138 96,-164 120,-138" fill="#4F46E5"/><circle cx="96" cy="-118" r="11" fill="#fff" stroke="#1A56DB" stroke-width="2.200"/><path d="M96 -124v6l5 3" stroke="#1A56DB" stroke-width="1.800" fill="none" stroke-linecap="round"/>' + R(72, -86, 48, 16, '#1A56DB', ' rx="5"') + T(96, -74, 'কলেজ', 12, '#fff') + [70, 82, 106, 118].map(function(cx){ return R(cx - 3, -64, 6, 64, '#fff'); }).join('') + arch(88, -42, 16, 42, '#1A56DB') + [14, 40, 138, 164].map(function(wx){ return arch(wx, -44, 16, 30, '#E6F0FF', ' stroke="#1A56DB" stroke-width="1.6"'); }).join('') + '</g>';
    s += tree(760, .9);
    // UNIVERSITY
    s += '<g transform="translate(796 288)">' + R(0, -78, 230, 78, '#fff', SK) + R(0, -78, 230, 7, '#E9F0FF') + '<path d="M80 -78a35 35 0 0 1 70 0z" fill="#fff" stroke="#B9C9EE" stroke-width="1.300"/>' + R(98, -122, 34, 46, '#fff', SK) + '<path d="M92 -122a23 23 0 0 1 46 0z" fill="#4F46E5"/><circle cx="115" cy="-150" r="3" fill="#F5B316"/>' + '<polygon points="70,-78 115,-102 160,-78" fill="#E9F0FF" stroke="#B9C9EE" stroke-width="1.300"/>' + [76, 92, 108, 124, 140].map(function(cx){ return R(cx - 3, -76, 6, 76, '#fff', ' stroke="#CBD7F2" stroke-width=".8"'); }).join('') + R(66, -4, 98, 4, '#E9F0FF') + R(60, 0, 110, 0, '#fff') + R(72, -96, 86, 14, '#1A56DB', ' rx="5"') + T(115, -85, 'বিশ্ববিদ্যালয়', 11, '#fff') + [14, 36, 172, 194].map(function(wx){ return arch(wx, -58, 16, 34, '#E6F0FF', ' stroke="#1A56DB" stroke-width="1.6"'); }).join('') + '<line x1="140" y1="-150" x2="140" y2="-120" stroke="none"/></g>';
    // graduates + caps
    [1052, 1074, 1096].forEach(function(gx, i){ s += '<use href="#pf-grad" transform="translate(' + gx + ' 288)"/><g class="cap" style="--d:' + (i * -.9) + 's"><use href="#pf-cap" transform="translate(' + gx + ' 240)"/></g>'; });
    s += tree(1140, .95);
    // book stack + park
    s += R(1186, 276, 40, 7, '#1A56DB', ' rx="2"') + R(1189, 268, 34, 8, '#F5B316', ' rx="2"') + R(1192, 260, 28, 8, '#10B981', ' rx="2"') + R(1195, 252, 22, 8, '#7C3AED', ' rx="2"');
    s += tree(1300, 1.3) + '<g transform="translate(1348 288)"><rect x="-22" y="-14" width="44" height="5" rx="2" fill="#B7791F"/><rect x="-18" y="-9" width="3" height="9" fill="#8A5A14"/><rect x="15" y="-9" width="3" height="9" fill="#8A5A14"/><rect x="-22" y="-26" width="44" height="4" rx="2" fill="#B7791F"/></g>';
    // a big card floating over the campus
    s += '<g class="fl"><g transform="translate(640 66) rotate(-7)"><rect width="118" height="74" rx="11" fill="url(#pf-bigcard)" stroke="#F5B316" stroke-width="1.600"/><rect width="118" height="5" rx="2" fill="#F5B316"/>' + T(12, 22, 'শিক্ষিত কার্ড', 13, '#fff', ' text-anchor="start" font-weight="800"').replace('text-anchor="middle"', '') + R(12, 32, 26, 30, '#C7D2FE', ' rx="5"') + '<circle cx="25" cy="42" r="5.500" fill="#6366F1"/>' + R(16, 50, 18, 10, '#6366F1', ' rx="5"') + R(46, 36, 52, 5, '#fff', ' rx="2.500" opacity=".85"') + R(46, 46, 36, 4, '#fff', ' rx="2" opacity=".5"') + '<circle cx="102" cy="58" r="8" fill="none" stroke="#F5B316" stroke-width="1.400" stroke-dasharray="2 2.400"/></g></g>';
    // students with cards, walking the road
    s += walker('w1', 40, 'pf-kid', 1) + walker('w1', 70, 'pf-girl', 1) + walker('w2', 500, 'pf-mad', 1) + walker('w2', 530, 'pf-kid', 1) + walker('w3', 1000, 'pf-girl', 1);
    s += [[120, 120], [480, 70], [900, 40], [1340, 130]].map(function(p, i){ return '<path class="sp" style="--d:' + (i * .7) + 's" transform="translate(' + p[0] + ' ' + p[1] + ')" d="M0-6Q0 0 6 0Q0 0 0 6Q0 0-6 0Q0 0 0-6Z" fill="#F5B316"/>'; }).join('');
    s += '<g class="bird" style="--d:0s"><path d="M0 0q5-6 10 0q5-6 10 0" transform="translate(0 110)" fill="none" stroke="#7C8DB5" stroke-width="1.800" stroke-linecap="round"/></g><g class="bird" style="--d:-7s"><path d="M0 0q5-6 10 0q5-6 10 0" transform="translate(0 150)" fill="none" stroke="#7C8DB5" stroke-width="1.800" stroke-linecap="round"/></g>';
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
