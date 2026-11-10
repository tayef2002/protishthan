/* Protishthan — pages opened from Facebook, Messenger or Instagram land in that app's own small browser ("in-app browser"). There, saving a picture, the phone's
   share sheet, clipboard and new tabs often do not work, and the visitor cannot tell why. This file notices that browser and offers the way out: open the same page in
   the phone's real browser.
   Facebook gives a website no way to force a link out of its browser, and no way to block it, so this only makes the way out one tap (Android) or three clear steps (iPhone).
   Iab.inApp / Iab.android / Iab.ios      what this browser is
   Iab.externalHref(url)                  Android: an intent:// address that opens url in the default browser; otherwise url itself
   Iab.openExternal(url)                  Android: tries it now (the visitor tapped); iPhone: shows the steps
   Iab.showSteps()                        the sheet with the steps and a "copy link" button
   Iab.bar()                              puts a notice bar at the top of the page (only inside such a browser)
   Iab.modal()                            the notice shown first, closable only with its OK button (OK opens the real browser)
   Preview on any device: add ?iabtest=android or ?iabtest=ios to the address. */
(function(root){
  'use strict';
  var ua = (root.navigator && root.navigator.userAgent) || '';
  var search = (root.location && root.location.search) || '';
  var test = /[?&]iabtest=(android|ios)\b/.exec(search);
  // the apps name themselves (Facebook, Messenger, Instagram); and some versions do not, but every app's plain web view shows itself: Android adds "wv" to the browser
  // string, and on iPhone a real browser (Safari, Chrome, Firefox, Edge, Opera) always says "Safari" while an app's web view does not
  var named = /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Instagram|Messenger/i.test(ua);
  var plainWebView = (/Android/i.test(ua) && /;\s*wv\)/.test(ua)) || (/iPhone|iPad|iPod/i.test(ua) && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua));
  var inApp = named || plainWebView || !!test;
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
    + '.iab-sheet h3{margin:0 0 8px;font-size:18px}.iab-sheet ol{margin:0 0 14px;padding-left:20px;font-size:14.5px;line-height:1.8;color:#334155}'
    + '.iab-sheet .go{display:block;width:100%;box-sizing:border-box;margin:0 0 8px;padding:13px;border:none;border-radius:12px;background:#1A56DB;color:#fff;font:700 16px "Hind Siliguri",sans-serif;text-align:center;text-decoration:none;cursor:pointer}'
    + '.iab-sheet .alt{display:block;width:100%;padding:11px;border:1.5px solid #D5E0F5;border-radius:12px;background:#fff;color:#1A56DB;font:700 14.5px "Hind Siliguri",sans-serif;cursor:pointer}'
    + '.iab-sheet .x{display:block;margin:10px auto 0;border:none;background:none;color:#64748B;font:600 13.5px "Hind Siliguri",sans-serif;cursor:pointer}';
  var styled = false;
  function style(){ if (styled || !root.document) return; styled = true; var s = root.document.createElement('style'); s.textContent = CSS; root.document.head.appendChild(s); }

  function showSteps(){
    style();
    var d = root.document, ov = d.getElementById('iabOv');
    if (!ov) {
      ov = d.createElement('div'); ov.id = 'iabOv'; ov.className = 'iab-ov';
      ov.innerHTML = '<div class="iab-sheet" role="dialog" aria-modal="true"><h3>ব্রাউজারে খুলুন</h3>'
        + '<ol><li>ওপরে বা নিচে <b>⋯</b> / <b>⋮</b> (তিন ফোঁটা) চাপুন।</li><li><b>' + (ios ? 'Safari-তে খুলুন' : 'ব্রাউজারে খুলুন / Open in browser') + '</b> বেছে নিন।</li><li>সেখানে ডাউনলোড আর শেয়ার ঠিকমতো কাজ করবে।</li></ol>'
        + '<button type="button" class="alt" id="iabCopy">লিংক কপি করুন (ব্রাউজারে পেস্ট করবেন)</button><button type="button" class="x" id="iabClose">বন্ধ করুন</button></div>';
      d.body.appendChild(ov);
      d.getElementById('iabClose').onclick = function(){ ov.classList.remove('show'); };
      ov.onclick = function(e){ if (e.target === ov) ov.classList.remove('show'); };
      d.getElementById('iabCopy').onclick = function(){ var b = this; copy(root.location.href).then(function(ok){ b.textContent = ok ? 'লিংক কপি হয়েছে ✓' : 'কপি করা যায়নি, ঠিকানা চেপে ধরে কপি করুন'; track('iab_copy_link', { ok: ok ? 1 : 0 }); }); };
    }
    ov.classList.add('show'); track('iab_steps_open', { os: ios ? 'ios' : 'android' });
  }
  function openExternal(url){
    url = url || root.location.href;
    track('iab_open_click', { os: ios ? 'ios' : (android ? 'android' : 'other') });
    if (android && !test) { root.location.href = externalHref(url); setTimeout(function(){ if (!root.document.hidden) showSteps(); }, 1600); return; }   // if nothing opened, show the manual steps
    showSteps();     // iPhone (no way to open another browser from a page), and the ?iabtest preview, which must not leave the page
  }
  // The first thing seen inside such a browser: a notice that cannot be closed except by its OK button. OK (a real tap, which is what the phone requires) opens the page in the
  // real browser on Android; on iPhone it shows how to do it by hand. After OK the notice is gone for good, so nobody is ever stuck behind it.
  function modal(){
    if (!inApp || !root.document || /[?&]iabauto=1\b/.test(search)) return null;
    style();
    var d = root.document, ov = d.createElement('div'); ov.className = 'iab-ov show'; ov.id = 'iabModal'; ov.style.alignItems = 'center'; ov.style.padding = '20px';
    ov.innerHTML = '<div class="iab-sheet" role="alertdialog" aria-modal="true" aria-labelledby="iabMT" style="border-radius:20px;text-align:center">'
      + '<h3 id="iabMT">আপনি Facebook-এর ব্রাউজারে আছেন</h3>'
      + '<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#334155">এখানে কার্ড বানালে <b>ডাউনলোড ও শেয়ার কাজ করে না</b>। তাই কার্ড বানাতে হবে ফোনের ব্রাউজার (Chrome) থেকে।'
      + (ios ? ' ঠিক আছে চাপলে কীভাবে খুলবেন দেখাব।' : ' ঠিক আছে চাপলেই ব্রাউজারে খুলে যাবে।') + '</p>'
      + '<button type="button" class="go" id="iabOk">ঠিক আছে</button></div>';
    d.body.appendChild(ov); d.body.style.overflow = 'hidden';
    d.getElementById('iabOk').onclick = function(){ ov.parentNode && ov.parentNode.removeChild(ov); d.body.style.overflow = ''; track('iab_modal_ok', { os: ios ? 'ios' : 'android' }); openExternal(); };
    track('iab_modal_seen', { os: ios ? 'ios' : (android ? 'android' : 'other') });
    return ov;
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
    track('iab_seen', { os: ios ? 'ios' : (android ? 'android' : 'other') });
    return b;
  }
  // best effort on Android: try to hand the page to the real browser once, without a tap, through a hidden frame (a wrong scheme then fails silently instead of replacing the page)
  // With ?iabauto=1 in the address (for testing inside the real Facebook app) the whole page is sent to the real browser on load instead: closer to "opens directly",
  // but if the app does not allow the intent address it may show an error page, so it stays a test switch until it has been tried on real phones.
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

  var api = { inApp: inApp, android: android, ios: ios, externalHref: externalHref, openExternal: openExternal, showSteps: showSteps, bar: bar, modal: modal, autoTry: autoTry, copy: copy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Iab = api;
  if (inApp && root.document) {
    var start = function(){ bar(); modal(); autoTry(); };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start); else start();
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
