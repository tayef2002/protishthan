/* Protishthan — measuring what happens after an announcement. Nothing is sent until you paste an id below.
   Google Analytics 4:   Admin → Data streams → Web → "Measurement ID" (looks like G-XXXXXXXXXX)
   Microsoft Clarity:    clarity.microsoft.com → New project → "Project ID" (about 10 letters and digits)
   Pages call window.track('event_name') at the important moments (card_start, card_download ...); with no ids it does nothing.
   Visitors who switch on "Do Not Track" in their browser are not measured. Private data (names, photos, institutes) is never sent. */
(function(){
  'use strict';
  var CFG = { ga: '', clarity: '' };

  var dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1';
  window.track = function(name, params){
    if(dnt) return;
    try{ if(window.gtag && CFG.ga) window.gtag('event', name, params || {}); }catch(e){}
    try{ if(window.clarity && CFG.clarity) window.clarity('event', name); }catch(e){}
  };
  if(dnt) return;

  if(CFG.ga){
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CFG.ga); document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', CFG.ga, { anonymize_ip: true, send_page_view: true });
  }
  if(CFG.clarity){
    (function(c, l, a, r, i, t, y){ c[a] = c[a] || function(){ (c[a].q = c[a].q || []).push(arguments); }; t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i; y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y); })(window, document, 'clarity', 'script', CFG.clarity);
  }
})();
