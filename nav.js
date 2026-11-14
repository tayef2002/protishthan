/* Protishthan — shared top bar.
   HOW TO ADD A PAGE: add one line to the group it belongs to (CARD, TUTOR, ABOUT), or to SETS.main (a top-level link).
   Pages only need:  <div id="nav" class="sn" data-theme="dark|light" data-set="main" data-cta="member"></div>
   followed by <script src="/nav.js"></script>, plus <link rel="stylesheet" href="/nav.css"> in the head. */
(function(){
  'use strict';
  var el = document.getElementById('nav'); if(!el || el.dataset.ready) return;

  var IC = {
    card:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2.2"/><path d="M5.5 16c.6-1.7 2-2.6 3.5-2.6s2.9.9 3.5 2.6M15 10h3.5M15 13h3"/></svg>',
    batch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><circle cx="5.6" cy="10.2" r="2.3"/><circle cx="18.4" cy="10.2" r="2.3"/><path d="M6.2 20c.5-3.2 2.7-5 5.8-5s5.3 1.8 5.8 5M1.8 18.2c.2-2 1.4-3.3 3.1-3.6M22.2 18.2c-.2-2-1.4-3.3-3.1-3.6"/></svg>',
    skill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.5 14.2L7 22l5-3 5 3-1.5-7.8"/></svg>',
    tutor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c.6-3.4 3.2-5.4 6.5-5.4s5.9 2 6.5 5.4"/><path d="M16 4.6a3.4 3.4 0 0 1 0 6.4M18.5 14.8c1.9.8 3.1 2.6 3.5 5.2"/></svg>',
    info:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6M12 10v.01"/></svg>',
    service:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    feedback: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.1A8.5 8.5 0 1 1 21 12z"/><path d="M8.5 11.5h7M8.5 14.5h4"/></svg>',
    partner: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c.6-3.4 3.2-5.4 6.5-5.4s5.9 2 6.5 5.4"/><path d="M16 4.6a3.4 3.4 0 0 1 0 6.4M18.5 14.8c1.6.8 2.7 2.4 3 5.2"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5s-7.2-4.4-9.2-9C1.4 8.2 3.4 5 6.5 5c1.9 0 3.3 1 4.1 2.3h2.8C14.2 6 15.6 5 17.5 5c3.1 0 5.1 3.2 3.7 6.5-2 4.6-9.2 9-9.2 9z"/></svg>',
    about: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.01"/></svg>',
    chev:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
  };

  /* Every tab of the site menu is one of these groups: it opens its related pages (hover or click on a computer, a small sheet on the phone bottom bar).
     The first entry of a group is the tab's own page. HOW TO ADD A PAGE: one line in the group it belongs to. */
  var CARD = [
    { k: 'card',  t: 'শিক্ষিত কার্ড',    d: '৩০ সেকেন্ডে নিজের শিক্ষিত কার্ড বানান',     href: 'card.html',  ic: 'card',  g: 'linear-gradient(135deg,#047857,#0F766E)' },
    { k: 'skill', t: 'স্কিল আইডেন্টিটি', d: 'নিজের স্কিল পেজ, সনদ আর কভার',              href: 'skill.html', ic: 'skill', g: 'linear-gradient(135deg,#1A56DB,#7C3AED)' },
    { k: 'batch', t: 'আমার ব্যাচ',        d: 'আপনার ব্যাচ খুঁজুন বা খুলুন, সহপাঠীদের ডাকুন', href: 'batch.html', ic: 'batch', g: 'linear-gradient(135deg,#6D28D9,#DB2777)', tag: 'নতুন' }
  ];

  var ABOUT = [
    { k: 'about',    t: 'আমাদের কথা',        d: 'Protishthan কী, কেন বানানো হয়েছে', href: 'about.html', ic: 'info', g: 'linear-gradient(135deg,#1A56DB,#5B8DEF)' },
    { k: 'feedback', t: 'মন্তব্য ও পরামর্শ', d: 'আইডিয়া, মতামত বা সমস্যার কথা জানান', href: 'feedback.html', ic: 'feedback', g: 'linear-gradient(135deg,#7C3AED,#DB2777)', tag: 'নতুন' },
    { k: 'collaborate', t: 'পাশে দাঁড়ান', d: 'ব্র্যান্ড, সংগঠন বা ব্যক্তি, সঙ্গী হোন', href: 'collaborate.html', ic: 'heart', g: 'linear-gradient(135deg,#BE123C,#F97316)' },
    { k: 'partner',  t: 'Partner প্রোগ্রাম',   d: 'এলাকার প্রতিষ্ঠান যাচাইয়ে আমাদের সঙ্গী হোন', href: 'partner.html', ic: 'partner', g: 'linear-gradient(135deg,#B45309,#F59E0B)' }
  ];
  var TUTOR = [
    { k: 'tutor',      t: 'টিউটর খুঁজুন',          d: 'যাচাই করা ভাইয়া-আপু টিউটর খুঁজে নিন', href: 'tutor.html', ic: 'tutor', g: 'linear-gradient(135deg,#0F766E,#1A56DB)' },
    { k: 'tutor-join', t: 'টিউটর হিসেবে যোগ দিন', d: 'নিজের প্রোফাইল বানান, যোগ দেওয়া ফ্রি', href: 'tutor-join.html', ic: 'partner', g: 'linear-gradient(135deg,#047857,#10B981)' }
  ];

  /* link sets: "main" is the site menu; others are for special pages */
  var SETS = {
    main: [
      { k: 'info',    t: 'প্রতিষ্ঠান খুঁজুন', href: 'index.html' },
      { k: 'card',    t: 'শিক্ষিত কার্ড', menu: CARD, promo: { ic: 'card', lab: 'ফ্রি টুলস', t: 'নিজের শিক্ষাজীবন, এক কার্ডে', d: '৩০ সেকেন্ডে শিক্ষিত কার্ড বানান, আর স্কিল পেজে নিজের সব স্কিল সাজান।', btn: 'কার্ড বানান', href: 'card.html' } },
      { k: 'tutor',   t: 'ভাইয়া-আপু', menu: TUTOR, promo: { ic: 'tutor', lab: 'টিউটর', t: 'যাচাই করা ভাইয়া-আপু, আপনার এলাকায়', d: 'নিজের সন্তানের জন্য টিউটর খুঁজুন, অথবা নিজেই টিউটর হয়ে যোগ দিন।', btn: 'টিউটর খুঁজুন', href: 'tutor.html' } },
      { k: 'about',   t: 'আমাদের কথা', menu: ABOUT, promo: { lab: 'আমাদের নিয়ে', t: 'আপনার কথায় এগোয় Protishthan', d: 'আইডিয়া, মতামত বা সমস্যা, যা-ই হোক, লিখুন। আমরা পড়ি আর উত্তর দিই।', btn: 'কথা লিখুন', href: 'feedback.html' } }
    ],
    partner: [
      { t: 'কীভাবে কাজ করে', href: '#how' }, { t: 'আয়ের হিসাব', href: '#earn' }, { t: 'সুবিধা', href: '#why' }, { t: 'প্রশ্নোত্তর', href: '#faq' }
    ],
    plogin: [
      { k: 'info', t: 'প্রতিষ্ঠান খুঁজুন', href: 'index.html' }, { t: 'Partner প্রোগ্রাম', href: 'partner.html' }
    ]
  };

  /* what sits on the right */
  var CTAS = {
    member:  '<div data-member-slot="nav"></div>',
    software:'<a href="login.html" class="btn-ghost-nav">লগইন</a><a href="login.html?tab=signup" class="btn-primary-nav">বিনামূল্যে শুরু করুন</a>',
    partner: '<a class="btn-ghost-nav" href="partner-login.html">লগইন</a><a class="btn-primary-nav" href="#apply">আবেদন করুন</a>',
    plogin:  '<a class="btn-ghost-nav" href="index.html">হোম</a><a class="btn-primary-nav" href="partner.html">আবেদন করুন</a>'
  };

  var set = SETS[el.dataset.set] || SETS.main, cta = CTAS[el.dataset.cta] || CTAS.member;
  var here = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '') || 'index';
  var active = el.dataset.active || (here === 'index' || here === '' ? 'info' : here === 'software' ? 'service' : here);
  var esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function hexOf(g){ var m = String(g).match(/#[0-9A-Fa-f]{6}/); return m ? m[0] : '#1A56DB'; }
  function item(x, cls){
    return '<a class="sn-it' + (x.k === active ? ' on' : '') + '" href="' + esc(x.href) + '"' + (x.k === active ? ' aria-current="page"' : '') + '><i style="--g:' + x.g + ';--c:' + hexOf(x.g) + ';--t:' + hexOf(x.g) + '1F">' + IC[x.ic] + '</i><span><b>' + esc(x.t) + (x.tag ? '<em class="tag">' + esc(x.tag) + '</em>' : '') + '</b><em>' + esc(x.d) + '</em></span></a>';
  }
  var links = set.map(function(l, i){
    if(l.menu){
      var on = l.menu.some(function(x){ return x.k === active; });
      return '<li' + (l.promo ? ' class="sn-has-mega"' : '') + '><button type="button" class="sn-l' + (on ? ' on' : '') + '" aria-haspopup="true" aria-expanded="false" aria-controls="snm' + i + '">' + esc(l.t) + IC.chev + '</button><div class="sn-pop' + (l.promo ? ' sn-mega' : '') + '" id="snm' + i + '" role="menu">' + (l.promo ? '<a class="sn-pr" href="' + esc(l.promo.href) + '"><i aria-hidden="true">' + (IC[l.promo.ic] || IC.feedback) + '</i><b>' + esc(l.promo.t) + '</b><span>' + esc(l.promo.d) + '</span><u>' + esc(l.promo.btn) + ' →</u></a><div class="sn-list"><div class="sn-lab">' + esc(l.promo.lab || l.t) + '</div><div class="sn-tiles">' : '') + l.menu.map(function(x){ return item(x); }).join('') + (l.promo ? '</div></div>' : '') + (l.note ? '<div class="sn-more">' + esc(l.note) + '</div>' : '') + '</div></li>';
    }
    var cur = l.k && l.k === active;
    return '<li><a class="sn-l' + (cur ? ' on' : '') + '" href="' + esc(l.href) + '"' + (cur ? ' aria-current="page"' : '') + '>' + esc(l.t) + '</a></li>';
  }).join('');
  var drawer = set.map(function(l){
    if(l.menu) return '<div class="grp">' + esc(l.t) + '</div>' + l.menu.map(function(x){ return item(x); }).join('');
    return '<a class="row' + (l.k && l.k === active ? ' on' : '') + '" href="' + esc(l.href) + '">' + esc(l.t) + '</a>';
  }).join('');

  el.innerHTML =
    '<div class="sn-bar">' +
      '<a class="sn-logo" href="index.html" aria-label="Protishthan হোম"><i><img src="logo-sm.webp" alt="" width="34" height="34" decoding="async"></i><b>Protisht<span>han</span></b></a>' +
      '<ul class="sn-links">' + links + '</ul>' +
      '<div class="sn-cta">' + cta + '</div>' +
      '<button type="button" class="sn-burger" aria-label="মেনু" aria-expanded="false" aria-controls="snd"><span></span></button>' +
      '<div class="sn-drawer" id="snd">' + drawer + '</div>' +
    '</div>';
  /* phones: opt in with data-tabs="1" to get a bottom tab bar instead of the hamburger */
  if(el.dataset.tabs){
    var tabItems = set.filter(function(l){ return l.k && IC[l.k]; });
    var tabs = tabItems.map(function(l, i){
      var on = l.k === active || (l.menu && l.menu.some(function(x){ return x.k === active; }));
      var lab = '<span' + (/\s/.test(l.t) ? '' : ' class="nw"') + '>' + esc(l.t) + '</span>';
      if(l.menu) return '<button type="button" class="sn-tab' + (on ? ' on' : '') + '" aria-haspopup="true" aria-expanded="false" aria-controls="sns' + i + '">' + IC[l.k] + lab + '</button>';
      return '<a class="sn-tab' + (on ? ' on' : '') + '" href="' + esc(l.href) + '"' + (on ? ' aria-current="page"' : '') + '>' + IC[l.k] + lab + '</a>';
    }).join('');
    var tb = document.createElement('div'); tb.className = 'sn-tabs'; tb.setAttribute('role', 'navigation'); tb.setAttribute('aria-label', 'প্রধান মেনু'); tb.innerHTML = tabs; document.body.appendChild(tb);
    var sh = document.createElement('div'); sh.className = 'sn-sheets'; sh.setAttribute('data-theme', 'light');
    sh.innerHTML = '<div class="sn-back"></div>' + tabItems.map(function(l, i){ return l.menu ? '<div class="sn-sheet" id="sns' + i + '" role="menu">' + l.menu.map(function(x){ return item(x); }).join('') + '</div>' : ''; }).join('');
    document.body.appendChild(sh);
    var sbtns = [].slice.call(tb.querySelectorAll('button.sn-tab')), sheets = [].slice.call(sh.querySelectorAll('.sn-sheet')), back = sh.querySelector('.sn-back');
    var closeSheets = function(){ sheets.forEach(function(p){ p.classList.remove('open'); }); sbtns.forEach(function(b){ b.setAttribute('aria-expanded', 'false'); }); back.classList.remove('open'); };
    sbtns.forEach(function(b){ b.addEventListener('click', function(){
      var p = document.getElementById(b.getAttribute('aria-controls')), was = p.classList.contains('open');
      closeSheets(); if(!was){ p.classList.add('open'); b.setAttribute('aria-expanded', 'true'); back.classList.add('open'); }
    }); });
    back.addEventListener('click', closeSheets);
    sh.addEventListener('click', function(e){ if(e.target.closest('a')) closeSheets(); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeSheets(); });
    el.classList.add('has-tabs'); document.body.classList.add('has-tabs');
  }
  el.dataset.ready = '1'; if(!el.dataset.theme) el.dataset.theme = 'dark';

  /* behaviour: dropdown on click/hover, drawer on phones, Esc and outside click close everything */
  var pops = [].slice.call(el.querySelectorAll('.sn-pop')), burger = el.querySelector('.sn-burger'), dr = el.querySelector('.sn-drawer'), t = null;
  function closeAll(except){ pops.forEach(function(p){ if(p !== except){ p.classList.remove('open'); var b = p.previousElementSibling; if(b) b.setAttribute('aria-expanded', 'false'); } }); }
  function openPop(p, on){ clearTimeout(t); closeAll(on ? p : null); p.classList.toggle('open', on); p.previousElementSibling.setAttribute('aria-expanded', on ? 'true' : 'false'); }
  pops.forEach(function(p){
    var li = p.parentNode, b = p.previousElementSibling;
    b.addEventListener('click', function(){ openPop(p, !p.classList.contains('open')); });
    li.addEventListener('mouseenter', function(){ if(window.matchMedia('(hover:hover)').matches) openPop(p, true); });
    li.addEventListener('mouseleave', function(){ t = setTimeout(function(){ openPop(p, false); }, 140); });
  });
  burger.addEventListener('click', function(){ var on = !dr.classList.contains('open'); dr.classList.toggle('open', on); burger.setAttribute('aria-expanded', on ? 'true' : 'false'); });
  document.addEventListener('click', function(e){ if(!el.contains(e.target)){ closeAll(); dr.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ closeAll(); dr.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } });
  window.addEventListener('resize', function(){ if(window.innerWidth > 900){ dr.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } });
  var tick = function(){ el.classList.toggle('scrolled', window.scrollY > 24); };
  window.addEventListener('scroll', tick, { passive: true }); tick();
})();
