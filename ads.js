/* Protishthan: the ad places. SWITCHED OFF: nothing is shown, and no Google script is loaded, until BOTH are true:
     1) ADS.enabled is true, and 2) the place has its ad unit id (digits, from AdSense > Ads > By ad unit).
   The rules we keep (see also the privacy page): at most 2 ads on a page, each one labelled "বিজ্ঞাপন", never on the pages that hold a person's own data (dashboards, login, profile),
   never next to a download, share or send button, and Google's script loads only when the first place nears the screen. A place that gets no ad collapses (no empty box).
   A place is an empty  <div class="ad-slot" data-slot="guide-mid"></div>  in the page. Pure rules first (tested by tools/tests/test_ads.js), the page part after. */
(function(root){
  'use strict';
  var ADS = {
    enabled: false,
    client: 'ca-pub-2196769322282894',
    slots: { 'card-end': '', 'guide-mid': '', 'guide-end': '' },
    blocked: /^\/(admin|member|dashboard|login|signup|settings|partner|agent|army|teacher|student|guardian|classroom|messages|chat|registration|attendance|finance|fee|voucher|exam|routine|syllabus|calendar|classes|students|teachers|guardians|website|id-card|admit-card|bulk-notice|custom|public-page)/i
  };
  var MAX_PER_PAGE = 2;
  function slotId(cfg, name){ var id = cfg && cfg.slots && cfg.slots[name]; return (typeof id === 'string' && /^\d{6,20}$/.test(id)) ? id : ''; }
  function allowed(cfg, name, path, shown){
    if(!cfg || !cfg.enabled) return false;
    if(!/^ca-pub-\d{10,20}$/.test(cfg.client || '')) return false;
    if(!slotId(cfg, name)) return false;
    if(cfg.blocked && cfg.blocked.test(path || '/')) return false;
    if((shown || 0) >= MAX_PER_PAGE) return false;
    return true;
  }
  function html(cfg, name){
    return '<span class="ad-lab">বিজ্ঞাপন</span><ins class="adsbygoogle" style="display:block" data-ad-client="' + cfg.client + '" data-ad-slot="' + slotId(cfg, name) + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
  }
  var api = { config: ADS, slotId: slotId, allowed: allowed, html: html, MAX_PER_PAGE: MAX_PER_PAGE };
  root.ProtAds = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;

  /* ---- the page part ---- */
  if(typeof document === 'undefined') return;
  var nodes = [].slice.call(document.querySelectorAll('.ad-slot')), shown = 0, loaded = false;
  if(!nodes.length) return;
  function loadScript(){
    if(loaded) return; loaded = true;
    var s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADS.client; document.head.appendChild(s);
  }
  function watch(n){
    var go = function(){ loadScript(); try{ (window.adsbygoogle = window.adsbygoogle || []).push({}); }catch(e){} };
    if('IntersectionObserver' in window){
      var io = new IntersectionObserver(function(es){ if(es[0].isIntersecting){ io.disconnect(); go(); } }, { rootMargin: '300px 0px' }); io.observe(n);
    } else setTimeout(go, 3000);
  }
  var st = null;
  nodes.forEach(function(n){
    var name = n.getAttribute('data-slot');
    if(!allowed(ADS, name, location.pathname, shown)) return;
    if(!st){ st = document.createElement('style'); st.textContent = '.ad-slot.on{display:block;margin:30px 0;text-align:center}.ad-slot .ad-lab{display:block;margin-bottom:6px;font-size:12px;color:#94A3B8;letter-spacing:.3px}.ad-slot ins.adsbygoogle[data-ad-status=unfilled]{display:none!important}'; document.head.appendChild(st); }
    shown++; n.innerHTML = html(ADS, name); n.classList.add('on'); watch(n);
  });
})(typeof window !== 'undefined' ? window : globalThis);
