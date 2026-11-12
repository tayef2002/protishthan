/* Protishthan: the ad places. SWITCHED OFF: nothing is shown, and no Google script is loaded, until BOTH are true:
     1) ADS.enabled is true, and 2) the place has its ad unit id (digits, from AdSense > Ads > By ad unit).
   How we keep ads from disturbing anyone (the numbers are in RULES, and tools/tests/test_ads.js checks them):
     - only plain, still display ads inside the page, each in a framed box labelled "বিজ্ঞাপন". Never an overlay, a sticky bar at the screen edge, a pop-up, a full-screen ad or sound.
     - never in the first screens of a page: a place must start at least 1.25 screens below the top, and 1.25 screens below the ad before it.
     - at most 2 on a page, and only 1 on a short page.
     - never within 48 px of anything you tap (button, link-button, field, menu row): measured in the real page, so a later edit cannot slip one in beside a button.
     - never on the pages that hold a person's own data (dashboards, login, profile), and never in a calculator or a form.
     - Google's script loads only when the first place nears the screen; a place that gets no ad disappears with its label; nothing prints.
   Look at the places without any ad: open a page with  ?adpreview=1  at the end of its address (grey boxes, no Google script, no data sent).
   A place is an empty  <div class="ad-slot" data-slot="guide-mid"></div>  in the page. Pure rules first (tested), the page part after. */
(function(root){
  'use strict';
  var ADS = {
    enabled: false,
    client: 'ca-pub-2196769322282894',
    slots: { 'card-end': '', 'guide-mid': '', 'guide-end': '' },
    blocked: /^\/(admin|member|dashboard|login|signup|settings|partner|agent|army|teacher|student|guardian|classroom|messages|chat|registration|attendance|finance|fee|voucher|exam|routine|syllabus|calendar|classes|students|teachers|guardians|website|id-card|admit-card|bulk-notice|custom|public-page)/i
  };
  var RULES = {
    maxPerPage: 2,
    shortPageScreens: 3,     // a page shorter than this many screens carries one ad only
    minTopScreens: 1.25,     // a place starts at least this many screens below the top of the page
    minGapScreens: 1.25,     // and this many screens below the bottom of the ad before it
    clearPx: 48              // nothing you tap closer than this to the ad box
  };
  var MAX_PER_PAGE = RULES.maxPerPage;
  function slotId(cfg, name){ var id = cfg && cfg.slots && cfg.slots[name]; return (typeof id === 'string' && /^\d{6,20}$/.test(id)) ? id : ''; }
  function allowed(cfg, name, path, shown){
    if(!cfg || !cfg.enabled) return false;
    if(!/^ca-pub-\d{10,20}$/.test(cfg.client || '')) return false;
    if(!slotId(cfg, name)) return false;
    if(cfg.blocked && cfg.blocked.test(path || '/')) return false;
    if((shown || 0) >= RULES.maxPerPage) return false;
    return true;
  }
  function html(cfg, name){
    return '<span class="ad-lab">বিজ্ঞাপন</span><ins class="adsbygoogle" style="display:block" data-ad-client="' + cfg.client + '" data-ad-slot="' + slotId(cfg, name) + '" data-ad-format="auto" data-full-width-responsive="false"></ins>';
  }
  /* Which of the places on a page may show an ad. cands = [{name, top, h, clear}] (top in px from the top of the page, clear = nothing tappable near),
     ctx = {vh: screen height, docH: page height, path}. Returns the names, in page order. */
  function plan(cfg, cands, ctx){
    var vh = (ctx && ctx.vh) || 800, docH = (ctx && ctx.docH) || 0, out = [], lastBottom = null;
    var max = RULES.maxPerPage; if(docH && docH < RULES.shortPageScreens * vh) max = 1;
    (cands || []).slice().sort(function(a, b){ return a.top - b.top; }).forEach(function(c){
      if(out.length >= max) return;
      if(!allowed(cfg, c.name, ctx && ctx.path, out.length)) return;
      if(c.top < RULES.minTopScreens * vh) return;
      if(!c.clear) return;
      if(lastBottom !== null && c.top - lastBottom < RULES.minGapScreens * vh) return;
      out.push(c.name); lastBottom = c.top + (c.h || 0);
    });
    return out;
  }
  var api = { config: ADS, rules: RULES, slotId: slotId, allowed: allowed, html: html, plan: plan, MAX_PER_PAGE: MAX_PER_PAGE };
  root.ProtAds = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;

  /* ---- the page part ---- */
  if(typeof document === 'undefined') return;
  var preview = /[?&]adpreview=1(&|$)/.test(location.search);
  if(!preview && !ADS.enabled) return;                       // switched off: do nothing at all
  var CSS = '.ad-slot{display:none}'
    + '.ad-slot.on,.ad-slot.measure{display:block;box-sizing:border-box;width:100%;max-width:740px;margin:56px auto;padding:12px 14px 16px;background:#fff;border:1px solid #E2E8F0;border-radius:18px;text-align:center}'
    + '.ad-slot.measure{visibility:hidden;height:300px;overflow:hidden}'
    + '.ad-slot .ad-lab{display:block;margin:0 0 8px;text-align:left;font-size:11.5px;font-weight:600;letter-spacing:.4px;color:#94A3B8}'
    + '.ad-slot ins.adsbygoogle{display:block;width:100%;min-height:120px}'
    + '.ad-slot ins.adsbygoogle[data-ad-status=filled]{min-height:0}'
    + '.ad-slot ins.adsbygoogle[data-ad-status=unfilled]{display:none!important}'
    + '.ad-slot .ad-ph{display:flex;align-items:center;justify-content:center;min-height:250px;padding:12px;border-radius:12px;background:repeating-linear-gradient(135deg,#F8FAFD,#F8FAFD 10px,#F1F5FB 10px,#F1F5FB 20px);color:#64748B;font-size:14px;line-height:1.6}'
    + '@media print{.ad-slot{display:none!important}}';
  var TAP = 'button,input,select,textarea,summary,[role=button],a.gd-btn,a.gd-tile,a.btn,.btn';
  var loaded = false;
  function loadScript(){
    if(loaded) return; loaded = true;
    var s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADS.client; document.head.appendChild(s);
  }
  function fixed(el){ for(var p = el; p && p !== document.body; p = p.parentElement){ var pos = getComputedStyle(p).position; if(pos === 'fixed' || pos === 'sticky') return true; } return false; }
  function clearOfControls(n){
    var r = n.getBoundingClientRect(), top = r.top + root.pageYOffset - RULES.clearPx, bot = r.bottom + root.pageYOffset + RULES.clearPx;
    var els = document.querySelectorAll(TAP);
    for(var i = 0; i < els.length; i++){
      var el = els[i]; if(n.contains(el)) continue;
      var b = el.getBoundingClientRect(); if(!b.width && !b.height) continue;
      if(fixed(el)) continue;
      var t = b.top + root.pageYOffset, e = b.bottom + root.pageYOffset;
      if(e > top && t < bot) return false;
    }
    return true;
  }
  function watch(n){
    var go = function(){ loadScript(); try{ (root.adsbygoogle = root.adsbygoogle || []).push({}); }catch(e){} };
    if('IntersectionObserver' in root){
      var io = new IntersectionObserver(function(es){ if(es[0].isIntersecting){ io.disconnect(); go(); } }, { rootMargin: '300px 0px' }); io.observe(n);
    } else setTimeout(go, 3000);
  }
  function dropWhenEmpty(n){
    var ins = n.querySelector('ins'); if(!ins || !root.MutationObserver) return;
    new MutationObserver(function(){ if(ins.getAttribute('data-ad-status') === 'unfilled'){ n.classList.remove('on'); n.style.display = 'none'; } }).observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
  }
  function run(){
    var nodes = [].slice.call(document.querySelectorAll('.ad-slot')); if(!nodes.length) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var cfg = ADS;
    if(preview){ cfg = {}; for(var k in ADS) cfg[k] = ADS[k]; cfg.enabled = true; cfg.slots = { 'card-end': '000000', 'guide-mid': '000000', 'guide-end': '000000' }; }
    var vh = root.innerHeight || 800, docH = document.documentElement.scrollHeight;
    nodes.forEach(function(n){ n.classList.add('measure'); });
    var cands = nodes.map(function(n){ var r = n.getBoundingClientRect(); return { el: n, name: n.getAttribute('data-slot'), top: r.top + root.pageYOffset, h: r.height, clear: clearOfControls(n) }; });
    nodes.forEach(function(n){ n.classList.remove('measure'); });
    var ok = plan(cfg, cands, { vh: vh, docH: docH, path: location.pathname });
    if(preview) root.__adPlan = { vh: vh, docH: docH, ok: ok, cands: cands.map(function(c){ return { name: c.name, top: Math.round(c.top), clear: c.clear }; }) };
    cands.forEach(function(c){
      if(ok.indexOf(c.name) < 0) return;
      var n = c.el; n.setAttribute('role', 'complementary'); n.setAttribute('aria-label', 'বিজ্ঞাপন');
      if(preview){ n.innerHTML = '<span class="ad-lab">বিজ্ঞাপন</span><div class="ad-ph">বিজ্ঞাপনের জায়গা (প্রিভিউ)<br>এখানে Google-এর একটা সাধারণ বিজ্ঞাপন আসবে, উচ্চতা বদলাতে পারে</div>'; n.classList.add('on'); return; }
      n.innerHTML = html(cfg, c.name); n.classList.add('on'); dropWhenEmpty(n); watch(n);
    });
  }
  // decide after fonts and images are in, so the places are measured where they will really be
  function ready(){ (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function(){ setTimeout(run, 250); }); }
  if(document.readyState === 'complete') ready(); else root.addEventListener('load', ready);
})(typeof window !== 'undefined' ? window : globalThis);
