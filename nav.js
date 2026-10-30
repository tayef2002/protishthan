/* Protishthan — shared top bar.
   HOW TO ADD A PAGE: add one line to TOOLS (a free tool: it goes in the "ফ্রি টুলস" menu) or to SETS.main (a top-level link).
   Pages only need:  <div id="nav" class="sn" data-theme="dark|light" data-set="main" data-cta="member"></div>
   followed by <script src="/nav.js"></script>, plus <link rel="stylesheet" href="/nav.css"> in the head. */
(function(){
  'use strict';
  var el = document.getElementById('nav'); if(!el || el.dataset.ready) return;

  var IC = {
    card:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2.2"/><path d="M5.5 16c.6-1.7 2-2.6 3.5-2.6s2.9.9 3.5 2.6M15 10h3.5M15 13h3"/></svg>',
    skill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.5 14.2L7 22l5-3 5 3-1.5-7.8"/></svg>',
    chev:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
  };

  /* free tools: each becomes a card in the dropdown (and a row on phones) */
  var TOOLS = [
    { k: 'card',  t: 'শিক্ষিত কার্ড',    d: '৩০ সেকেন্ডে নিজের শিক্ষিত কার্ড বানান',     href: 'card.html',  ic: 'card',  g: 'linear-gradient(135deg,#047857,#0F766E)' },
    { k: 'skill', t: 'স্কিল আইডেন্টিটি', d: 'নিজের স্কিল পেজ, সনদ আর কভার',              href: 'skill.html', ic: 'skill', g: 'linear-gradient(135deg,#1A56DB,#7C3AED)' }
  ];
  var TOOLS_PAGES = TOOLS.map(function(x){ return x.k; });

  /* While there are only a few pages, every page is a plain link in the bar. When the list grows (about 7+), set GROUP_TOOLS = true
     and the free tools fold into a "ফ্রি টুলস" dropdown (and a section on phones) with no other change. */
  var GROUP_TOOLS = false;

  /* link sets: "main" is the site menu; others are for special pages */
  var SETS = {
    main: [
      { k: 'info',    t: 'তথ্যভান্ডার', href: 'index.html' },
      { k: 'service', t: 'সার্ভিস',      href: 'software.html' }
    ].concat(GROUP_TOOLS ? [{ k: 'tools', t: 'ফ্রি টুলস', menu: TOOLS }] : TOOLS.map(function(x){ return { k: x.k, t: x.t, href: x.href }; })),
    partner: [
      { t: 'কীভাবে কাজ করে', href: '#how' }, { t: 'আয়ের হিসাব', href: '#earn' }, { t: 'সুবিধা', href: '#why' }, { t: 'প্রশ্নোত্তর', href: '#faq' }
    ],
    plogin: [
      { k: 'info', t: 'তথ্যভান্ডার', href: 'index.html' }, { t: 'Partner প্রোগ্রাম', href: 'partner.html' }, { k: 'service', t: 'সার্ভিস', href: 'software.html' }
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
  var inTools = TOOLS_PAGES.indexOf(active) > -1;
  var esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function item(x, cls){
    return '<a class="sn-it' + (x.k === active ? ' on' : '') + '" href="' + esc(x.href) + '"' + (x.k === active ? ' aria-current="page"' : '') + '><i style="--g:' + x.g + '">' + IC[x.ic] + '</i><span><b>' + esc(x.t) + (x.tag ? '<em class="tag">' + esc(x.tag) + '</em>' : '') + '</b><em>' + esc(x.d) + '</em></span></a>';
  }
  var links = set.map(function(l, i){
    if(l.menu){
      var on = inTools;
      return '<li><button type="button" class="sn-l' + (on ? ' on' : '') + '" aria-haspopup="true" aria-expanded="false" aria-controls="snm' + i + '">' + esc(l.t) + IC.chev + '</button><div class="sn-pop" id="snm' + i + '" role="menu">' + l.menu.map(function(x){ return item(x); }).join('') + '<div class="sn-more">আরও টুল শীঘ্রই আসছে</div></div></li>';
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
