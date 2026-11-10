/* Protishthan — pages opened from Facebook, Messenger or Instagram land in that app's own small browser ("in-app browser"). There, saving a picture, the phone's
   share sheet, clipboard and new tabs often do not work, and the visitor cannot tell why. This file notices that browser and sends the visitor to the phone's real browser.
   Facebook gives a website no way to force a link out of its browser, so this works in two steps: a notice that cannot be closed, and one tap on OK that hands the page to the
   real browser (Android: an intent:// address; iPhone: Apple allows no such hand-over, so three clear steps and a copy-link button are shown instead).
   Inside the apps that NAME themselves (Facebook, Messenger, Instagram) nothing on the notice or the steps can be closed: the visitor goes to the real browser or leaves.
   Where the browser only LOOKS like an app's web view (not named) the notices can be closed, so a real browser that is wrongly recognised never locks anybody out.
   Iab.inApp / Iab.android / Iab.ios      what this browser is
   Iab.gate                               true when nothing can be closed (named app browser)
   Iab.externalHref(url)                  Android: an intent:// address that opens url in the default browser; otherwise url itself
   Iab.openExternal(url)                  Android: tries it now (the visitor tapped); iPhone: shows the steps
   Iab.showSteps()                        the steps and a "copy link" button
   Iab.bar()                              a notice bar at the top of the page (only inside such a browser)
   Iab.modal(now)                         the notice shown after 4 seconds (now = true: at once); OK opens the real browser
   Preview on any device: ?iabtest=android or ?iabtest=ios.  ?iabdelay=<ms> changes the 4 second wait.  ?iabauto=1 sends the page out on load (test switch). */
(function(root){
  'use strict';
  var ua = (root.navigator && root.navigator.userAgent) || '';
  var search = (root.location && root.location.search) || '';
  var test = /[?&]iabtest=(android|ios)\b/.exec(search);
  // the apps name themselves (Facebook, Messenger, Instagram); some versions do not, but every app's plain web view shows itself: Android adds "wv" to the browser string,
  // and on iPhone a real browser (Safari, Chrome, Firefox, Edge, Opera) always says "Safari" while an app's web view does not
  var named = /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Instagram|Messenger/i.test(ua);
  var plainWebView = (/Android/i.test(ua) && /;\s*wv\)/.test(ua)) || (/iPhone|iPad|iPod/i.test(ua) && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua));
  var inApp = named || plainWebView || !!test;
  var gate = named || !!test;
  var android = test ? test[1] === 'android' : /Android/i.test(ua);
  var ios = test ? test[1] === 'ios' : /iPhone|iPad|iPod/i.test(ua);

  function externalHref(url){
    if (!android) return url;
    try {
      var u = new URL(url, root.location.href);
      return 'intent://' + u.host + u.pathname + u.search + '#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=' + encodeURIComponent(u.href) + ';end';
    } catch (e) { return url; }
  }
  function track(n, p){ try { if (root.track) root.track(n, p || {}); } catch (e) {} }
  function copy(text){
    try { if (root.navigator.clipboard && root.navigator.clipboard.writeText) return root.navigator.clipboard.writeText(text).then(function(){ return true; }, function(){ return false; }); } catch (e) {}
    try { var ta = root.document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; root.document.body.appendChild(ta); ta.select(); var ok = root.document.execCommand('copy'); ta.remove(); return Promise.resolve(!!ok); } catch (e) { return Promise.resolve(false); }
  }

  var CSS = '.iab-bar{position:fixed;top:0;left:0;right:0;z-index:8000;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;padding:9px 14px;background:#FFF4D6;border-bottom:1px solid #F5D78A;color:#7A4B00;font:600 13.5px/1.5 "Hind Siliguri",sans-serif;text-align:center}'
    + 'body.iab-on{padding-top:var(--iab-h,0px)}body.iab-on #nav{top:calc(12px + var(--iab-h,0px))!important}'   // the page's own fixed menu sits under the bar
    + '.iab-bar a,.iab-bar button{border:none;border-radius:999px;padding:7px 14px;background:#1A56DB;color:#fff;font:700 13.5px "Hind Siliguri",sans-serif;text-decoration:none;cursor:pointer}'
    + '.iab-ov{position:fixed;inset:0;z-index:9800;display:none;align-items:flex-end;justify-content:center;background:rgba(15,23,42,.55)}.iab-ov.show{display:flex}'
    + '.iab-sheet{width:100%;max-width:420px;background:#fff;border-radius:22px 22px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom));font-family:"Hind Siliguri",sans-serif;color:#0F172A}'
    + '.iab-sheet h3{margin:0 0 8px;font-size:18px}.iab-sheet ol{margin:0 0 14px;padding-left:20px;font-size:14.5px;line-height:1.8;color:#334155;text-align:left}'
    + '.iab-sheet .go{display:block;width:100%;box-sizing:border-box;margin:0 0 8px;padding:13px;border:none;border-radius:12px;background:#1A56DB;color:#fff;font:700 16px "Hind Siliguri",sans-serif;text-align:center;text-decoration:none;cursor:pointer}'
    + '.iab-sheet .alt{display:block;width:100%;padding:11px;border:1.5px solid #D5E0F5;border-radius:12px;background:#fff;color:#1A56DB;font:700 14.5px "Hind Siliguri",sans-serif;cursor:pointer}'
    + '.iab-fade{display:flex;opacity:0;transition:opacity .45s ease}.iab-fade.in{opacity:1}'
    + '.iab-fade .iab-sheet{transform:translateY(22px) scale(.97);transition:transform .5s cubic-bezier(.2,.9,.25,1.05)}.iab-fade.in .iab-sheet{transform:none}'
    + '@media(prefers-reduced-motion:reduce){.iab-fade,.iab-fade .iab-sheet{transition:none}}'
    + '.iab-sheet .x{display:block;margin:10px auto 0;border:none;background:none;color:#64748B;font:600 13.5px "Hind Siliguri",sans-serif;cursor:pointer}';
  var styled = false;
  function style(){ if (styled || !root.document) return; styled = true; var s = root.document.createElement('style'); s.textContent = CSS; root.document.head.appendChild(s); }

  // the one full-screen notice (it is also what the steps are written into when nothing may be closed)
  function ensureModal(){
    var d = root.document, ov = d.getElementById('iabModal');
    if (ov) return ov;
    ov = d.createElement('div'); ov.className = 'iab-ov iab-fade'; ov.id = 'iabModal'; ov.style.alignItems = 'center'; ov.style.padding = '20px';
    ov.innerHTML = '<div class="iab-sheet" role="alertdialog" aria-modal="true" style="border-radius:20px;text-align:center"></div>';
    d.body.appendChild(ov); d.body.style.overflow = 'hidden';
    var fade = function(){ ov.classList.add('in'); };
    if (root.requestAnimationFrame) root.requestAnimationFrame(function(){ root.requestAnimationFrame(fade); }); else fade();
    return ov;
  }
  function stepsHtml(closable){
    return '<h3>ব্রাউজারে খুলুন</h3>'
      + '<ol><li>ওপরে বা নিচে <b>⋯</b> / <b>⋮</b> (তিন ফোঁটা) চাপুন।</li><li><b>' + (ios ? 'Safari-তে খুলুন' : 'ব্রাউজারে খুলুন / Open in browser') + '</b> বেছে নিন।</li><li>সেখানে ডাউনলোড আর শেয়ার ঠিকমতো কাজ করবে।</li></ol>'
      + (android ? '<button type="button" class="go" id="iabRetry">আবার চেষ্টা করুন</button>' : '')
      + '<button type="button" class="alt" id="iabCopy">লিংক কপি করুন (ব্রাউজারে পেস্ট করবেন)</button>'
      + (closable ? '<button type="button" class="x" id="iabClose">বন্ধ করুন</button>' : '');
  }
  function wireSteps(root2, ov){
    var d = root.document, q = function(id){ return d.getElementById(id); };
    if (q('iabCopy')) q('iabCopy').onclick = function(){ var b = this; copy(root.location.href).then(function(ok){ b.textContent = ok ? 'লিংক কপি হয়েছে ✓' : 'কপি করা যায়নি, ঠিকানা চেপে ধরে কপি করুন'; track('iab_copy_link', { ok: ok ? 1 : 0 }); }); };
    if (q('iabRetry')) q('iabRetry').onclick = function(){ track('iab_retry', { os: 'android' }); openExternal(); };
    if (q('iabClose')) q('iabClose').onclick = function(){ ov.classList.remove('show'); };
  }
  function showSteps(){
    style();
    var d = root.document;
    if (gate) {     // named app browser: the steps replace the notice and cannot be closed
      var m = ensureModal(), sheet = m.querySelector('.iab-sheet');
      sheet.style.textAlign = 'left'; sheet.innerHTML = stepsHtml(false); wireSteps(sheet, m);
      track('iab_steps_open', { os: ios ? 'ios' : 'android', gate: 1 });
      return;
    }
    var ov = d.getElementById('iabOv');
    if (!ov) {
      ov = d.createElement('div'); ov.id = 'iabOv'; ov.className = 'iab-ov';
      ov.innerHTML = '<div class="iab-sheet" role="dialog" aria-modal="true">' + stepsHtml(true) + '</div>';
      d.body.appendChild(ov);
      ov.onclick = function(e){ if (e.target === ov) ov.classList.remove('show'); };
      wireSteps(ov, ov);
    }
    ov.classList.add('show'); track('iab_steps_open', { os: ios ? 'ios' : 'android', gate: 0 });
  }
  function openExternal(url){
    url = url || root.location.href;
    track('iab_open_click', { os: ios ? 'ios' : (android ? 'android' : 'other') });
    if (android && !test) { root.location.href = externalHref(url); setTimeout(function(){ if (!root.document.hidden) showSteps(); }, 1600); return; }   // if nothing opened, show the manual steps
    showSteps();     // iPhone (no way to open another browser from a page), and the ?iabtest preview, which must not leave the page
  }

  // It appears after 4 seconds (a visitor who is shown a popup the moment the page opens is annoyed): time to look at the page and scroll a little, then it fades in softly.
  // It never interrupts typing (it waits a moment), and it stays away when the save popup of the card page is already open.
  var MODAL_DELAY = (function(){ var m = /[?&]iabdelay=(\d+)/.exec(search); return m ? Math.min(Number(m[1]), 20000) : 4000; })();
  function modal(now){
    if (!inApp || !root.document || /[?&]iabauto=1\b/.test(search)) return;
    style();
    var d = root.document, tries = 0;
    var show = function(){
      if (d.getElementById('iabModal') || d.querySelector('.dl-ov.show')) return;
      var a = d.activeElement;
      if (!now && a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && tries++ < 4) { setTimeout(show, 1500); return; }
      var ov = ensureModal(), sheet = ov.querySelector('.iab-sheet');
      sheet.innerHTML = '<h3 id="iabMT">আপনি Facebook-এর ব্রাউজারে আছেন</h3>'
        + '<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155">এখানে কার্ড বানালে <b>ডাউনলোড ও শেয়ার কাজ করে না</b>। তাই কার্ড বানাতে হবে ফোনের ব্রাউজার (Chrome) থেকে।'
        + (ios ? ' ঠিক আছে চাপলে কীভাবে খুলবেন দেখাব।' : ' ঠিক আছে চাপলেই ব্রাউজারে খুলে যাবে।') + '</p>'
        + '<button type="button" class="go" id="iabOk">ঠিক আছে</button>';
      sheet.setAttribute('aria-labelledby', 'iabMT');
      d.getElementById('iabOk').onclick = function(){
        track('iab_modal_ok', { os: ios ? 'ios' : 'android', gate: gate ? 1 : 0 });
        if (!gate) { ov.parentNode && ov.parentNode.removeChild(ov); d.body.style.overflow = ''; }     // a notice that only looks like an app browser can be left behind
        openExternal();
      };
      track('iab_modal_seen', { os: ios ? 'ios' : (android ? 'android' : 'other'), gate: gate ? 1 : 0 });
    };
    if (now) show(); else setTimeout(show, MODAL_DELAY);
  }

  function bar(){
    if (!inApp || !root.document) return null;
    style();
    var d = root.document, b = d.createElement('div'); b.className = 'iab-bar'; b.id = 'iabBar';
    b.innerHTML = '<span>Facebook-এর ভেতরের ব্রাউজারে ছবি ডাউনলোড ও শেয়ার কাজ করে না।</span>' + (android ? '<a href="' + externalHref(root.location.href).replace(/"/g, '&quot;') + '" id="iabGo">ব্রাউজারে খুলুন</a>' : '<button type="button" id="iabGo">ব্রাউজারে খুলুন</button>');
    d.body.insertBefore(b, d.body.firstChild);
    var fit = function(){ d.documentElement.style.setProperty('--iab-h', b.offsetHeight + 'px'); };
    d.body.classList.add('iab-on'); fit(); root.addEventListener('resize', fit); setTimeout(fit, 400);     // 400 ms: after the web font has changed the text height
    var go = d.getElementById('iabGo');
    go.addEventListener('click', function(e){ track('iab_open_click', { os: ios ? 'ios' : 'android', from: 'bar' }); if (!android) { e.preventDefault(); showSteps(); } else { setTimeout(function(){ if (!d.hidden) showSteps(); }, 1600); } });
    track('iab_seen', { os: ios ? 'ios' : (android ? 'android' : 'other'), gate: gate ? 1 : 0 });
    return b;
  }
  // With ?iabauto=1 in the address (for testing inside the real Facebook app) the whole page is sent to the real browser on load instead: closer to "opens directly",
  // but if the app does not allow the intent address it may show an error page, so it stays a test switch until it has been tried on real phones.
  // Without the switch only a quiet hidden-frame attempt is made on Android.
  function autoTry(){
    if (!inApp || !android || test) return;
    try { if (root.sessionStorage.getItem('iab_auto')) return; root.sessionStorage.setItem('iab_auto', '1'); } catch (e) {}
    var direct = /[?&]iabauto=1\b/.test(search);
    track('iab_auto', { mode: direct ? 'direct' : 'frame' });
    setTimeout(function(){
      try {
        if (direct) { root.location.replace(externalHref(root.location.href.replace(/([?&])iabauto=1&?/, '$1').replace(/[?&]$/, ''))); return; }
        var f = root.document.createElement('iframe'); f.style.display = 'none'; f.src = externalHref(root.location.href); root.document.body.appendChild(f);
      } catch (e) {}
    }, direct ? 400 : 700);
  }

  var api = { inApp: inApp, gate: gate, android: android, ios: ios, externalHref: externalHref, openExternal: openExternal, showSteps: showSteps, bar: bar, modal: modal, autoTry: autoTry, copy: copy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Iab = api;
  if (inApp && root.document) {
    var start = function(){ bar(); modal(); autoTry(); };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start); else start();
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
