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

  var CSS = '.iab-ov{position:fixed;inset:0;z-index:9800;display:none;align-items:flex-end;justify-content:center;background:rgba(15,23,42,.55)}.iab-ov.show{display:flex}'
    + '.iab-sheet{width:100%;max-width:420px;background:#fff;border-radius:22px 22px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom));font-family:"Hind Siliguri",sans-serif;color:#0F172A}'
    + '.iab-sheet h3{margin:0 0 8px;font-size:18px}.iab-sheet ol{margin:0 0 14px;padding-left:20px;font-size:14.5px;line-height:1.8;color:#334155;text-align:left}'
    + '.iab-sheet .go{display:block;width:100%;box-sizing:border-box;margin:0 0 8px;padding:13px;border:none;border-radius:12px;background:#1A56DB;color:#fff;font:700 16px "Hind Siliguri",sans-serif;text-align:center;text-decoration:none;cursor:pointer}'
    + '.iab-sheet .alt{display:block;width:100%;padding:11px;border:1.5px solid #D5E0F5;border-radius:12px;background:#fff;color:#1A56DB;font:700 14.5px "Hind Siliguri",sans-serif;cursor:pointer}'
    + '.iab-fade{display:flex;opacity:0;transition:opacity .45s ease}.iab-fade.in{opacity:1}'
    + '.iab-fade .iab-sheet{transform:translateY(22px) scale(.97);transition:transform .5s cubic-bezier(.2,.9,.25,1.05)}.iab-fade.in .iab-sheet{transform:none}'
    + '@media(prefers-reduced-motion:reduce){.iab-fade,.iab-fade .iab-sheet{transition:none}}'
    + '.iab-arrow{position:fixed;z-index:9900;top:8px;right:12px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;color:#fff;font:700 14px "Hind Siliguri",sans-serif;pointer-events:none;animation:iabBob 1s ease-in-out infinite}'
    + '.iab-arrow b{font-size:38px;line-height:1;text-shadow:0 2px 8px rgba(0,0,0,.45)}.iab-arrow span{background:#1A56DB;padding:6px 12px;border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.35)}'
    + '@keyframes iabBob{0%,100%{transform:translate(0,0)}50%{transform:translate(4px,-8px)}}@media(prefers-reduced-motion:reduce){.iab-arrow{animation:none}}'
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
  // the address without Facebook's own tracking tag, for copying
  function cleanHref(){ try { var u = new URL(root.location.href); u.searchParams.delete('fbclid'); return u.href; } catch (e) { return root.location.href; } }
  function stepsHtml(closable){
    // First the button that opens the real browser by itself (Android); if the phone did not allow it, the app's own menu or the copied link
    return '<h3>ব্রাউজারে খুলুন</h3>'
      + (android ? '<button type="button" class="go" id="iabRetry">ব্রাউজারে খুলুন (আবার চেষ্টা)</button><p style="margin:0 0 8px;font-size:13.5px;color:#64748B">খুলে না গেলে নিচের যেকোনো একটা করুন:</p>' : '')
      + '<ol><li>ওপরে ডানদিকের <b>⋮</b> / <b>⋯</b> (তিন ফোঁটা) চাপুন।</li><li><b>' + (ios ? 'Safari-তে খুলুন' : 'ব্রাউজারে খুলুন / Open in browser') + '</b> বেছে নিন।</li><li>সেখানে ডাউনলোড আর শেয়ার ঠিকমতো কাজ করবে।</li></ol>'
      + '<button type="button" class="alt" id="iabCopy">লিংক কপি করুন (Chrome-এর ঠিকানা বারে পেস্ট করুন)</button>'
      + (closable ? '<button type="button" class="x" id="iabClose">বন্ধ করুন</button>' : '');
  }
  function wireSteps(root2, ov){
    var d = root.document, q = function(id){ return d.getElementById(id); };
    if (q('iabCopy')) q('iabCopy').onclick = function(){ var b = this; copy(cleanHref()).then(function(ok){ b.textContent = ok ? 'লিংক কপি হয়েছে ✓' : 'কপি করা যায়নি, ঠিকানা চেপে ধরে কপি করুন'; track('iab_copy_link', { ok: ok ? 1 : 0 }); }); };
    if (q('iabRetry')) q('iabRetry').onclick = function(){ track('iab_retry', { os: 'android' }); openExternal(); };
    if (q('iabClose')) q('iabClose').onclick = function(){ ov.classList.remove('show'); };
  }
  function showSteps(){
    style();
    var d = root.document;
    if (gate) {     // named app browser: the steps replace the notice and cannot be closed
      var m = ensureModal(), sheet = m.querySelector('.iab-sheet');
      sheet.style.textAlign = 'left'; sheet.innerHTML = stepsHtml(false); wireSteps(sheet, m);
      // a bouncing arrow at the top right, where the app's own menu is
      if (!m.querySelector('.iab-arrow')) m.insertAdjacentHTML('beforeend', '<div class="iab-arrow" aria-hidden="true"><b>↗</b><span>এখানে ⋮ চাপুন</span></div>');
      // the link is copied in this same tap (the phone allows it only inside a tap), so "paste it in Chrome" is ready without another step
      var cb = d.getElementById('iabCopy');
      copy(cleanHref()).then(function(ok){ if (ok && cb) cb.textContent = 'লিংক কপি হয়েছে ✓ (Chrome-এর ঠিকানা বারে পেস্ট করুন)'; track('iab_auto_copy', { ok: ok ? 1 : 0 }); });
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
    // Android: hand the page to the phone's default browser (it worked on the owner's own phone from inside the Facebook app). The page cannot tell whether it worked
    // (the app does not report that it went to the background, so the page may look "still visible" even after Chrome opened), so after 1.6 s the steps (with a try-again
    // button) are shown as a safety net: whoever is in Chrome never sees them, whoever stays or comes back has the way out in front of them.
    if (android && !test) { root.location.href = externalHref(url); setTimeout(function(){ if (!root.document.hidden) showSteps(); }, 1600); return; }
    showSteps();     // iPhone (no way to open another browser from a page), and the ?iabtest preview, which must not leave the page
    if (test && android) root.__iabIntent = externalHref(url);     // the preview records the address it would have opened (for tests)
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
        + (ios ? ' ঠিক আছে চাপলে দেখাব কীভাবে খুলবেন।' : ' ঠিক আছে চাপলেই ব্রাউজারে খুলে যাবে।') + '</p>'
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

  // With ?iabauto=1 in the address (for testing inside the real Facebook app) the whole page is sent to the real browser on load instead: closer to "opens directly",
  // but if the app does not allow the intent address it may show an error page, so it stays a test switch until it has been tried on real phones.
  // Without the switch only a quiet hidden-frame attempt is made on Android.
  function autoTry(){
    if (!inApp || !android || test) return;
    var direct = /[?&]iabauto=1\b/.test(search);
    if (gate && !direct) return;     // inside the Facebook app the hand-over is only tried when the visitor taps OK (a tap is what the phone wants); no quiet attempt on page load
    try { if (root.sessionStorage.getItem('iab_auto')) return; root.sessionStorage.setItem('iab_auto', '1'); } catch (e) {}
    track('iab_auto', { mode: direct ? 'direct' : 'frame' });
    setTimeout(function(){
      try {
        if (direct) { root.location.replace(externalHref(root.location.href.replace(/([?&])iabauto=1&?/, '$1').replace(/[?&]$/, ''))); return; }
        var f = root.document.createElement('iframe'); f.style.display = 'none'; f.src = externalHref(root.location.href); root.document.body.appendChild(f);
      } catch (e) {}
    }, direct ? 400 : 700);
  }

  var api = { inApp: inApp, gate: gate, android: android, ios: ios, externalHref: externalHref, openExternal: openExternal, showSteps: showSteps, modal: modal, autoTry: autoTry, copy: copy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Iab = api;
  if (inApp && root.document) {
    var start = function(){ track('iab_seen', { os: ios ? 'ios' : (android ? 'android' : 'other'), gate: gate ? 1 : 0 }); modal(); autoTry(); };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start); else start();
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
