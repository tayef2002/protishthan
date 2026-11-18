/* Protishthan সদস্য (member) — Google sign-in for ordinary visitors.
   Loaded on every general page (home, card, results, profile, member). Needs supabase-js loaded first.
   It uses its own browser session ('prot-member'), so it never mixes with the institution /
   teacher / guardian / student / partner logins that live on the service pages. */
(function(){
  'use strict';
  if(window.Protishthan && window.Protishthan.member) return;
  const P = window.Protishthan = window.Protishthan || {};
  const SB_URL = 'https://eoqeeuujvpydhmfteqqj.supabase.co', SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvcWVldXVqdnB5ZGhtZnRlcXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTM2NTgsImV4cCI6MjA5NzE4OTY1OH0.xuC-_euxf0DTqTpD5b8_6vgnkjeJjZIFqdKw-Bq3YbU';
  const sb = supabase.createClient(SB_URL, SB_KEY, { auth: { storageKey: 'prot-member' } });

  let ME = null, SAVED = null, resolveReady;
  const READY = new Promise(r => resolveReady = r);
  const listeners = [];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const ls = { get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }, del(k){ try{ localStorage.removeItem(k); }catch(e){} } };

  /* ---------------- styles ---------------- */
  const css = document.createElement('style');
  css.textContent = `
button.btn-ghost-nav,button.btn-primary-nav{border:none;cursor:pointer;font-family:inherit}
button.btn-ghost-nav{background:none}
button.btn-primary-nav{background:linear-gradient(135deg,#1A56DB,#3B6FE0)}
.mb-wrap{position:relative}
.mb-av{width:40px;height:40px;border-radius:50%;border:2px solid rgba(255,255,255,.4);padding:0;background:linear-gradient(135deg,#2563EB,#7C3AED);color:#fff;font:700 16px 'Hind Siliguri','Inter',sans-serif;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center}
.mb-av img{width:100%;height:100%;object-fit:cover;display:block}
.mb-light .mb-av{border-color:#E2E8F0}
.mb-av{text-decoration:none}
.mb-bar{display:inline-flex;align-items:center;gap:8px}
.mb-ic{position:relative;width:42px;height:42px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;color:#fff;text-decoration:none;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);transition:background .15s,transform .15s}
.mb-ic:hover{background:rgba(255,255,255,.2);transform:translateY(-1px)}
.mb-dot{position:absolute;right:9px;top:9px;width:8px;height:8px;border-radius:50%;background:#F59E0B;box-shadow:0 0 0 2px rgba(15,32,72,.9);display:none}
.mb-prof{display:inline-flex;align-items:center;gap:9px;height:42px;padding:4px 16px 4px 4px;border-radius:100px;text-decoration:none;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);font:700 14px 'Hind Siliguri','Inter',sans-serif;white-space:nowrap;transition:background .15s,transform .15s}
.mb-prof:hover{background:rgba(255,255,255,.22);transform:translateY(-1px)}
.mb-prof.on{background:rgba(255,255,255,.95);color:#1A56DB;border-color:#fff}
.mb-pa{width:32px;height:32px;border-radius:50%;flex:none;overflow:hidden;display:flex;align-items:center;justify-content:center;font:800 14px 'Inter','Hind Siliguri',sans-serif;color:#fff;background:linear-gradient(135deg,#3B82F6,#7C3AED)}
.mb-pa img{width:100%;height:100%;object-fit:cover;display:block}
.mb-nw{position:relative}
.mb-pop{position:absolute;right:-6px;top:52px;width:316px;background:#fff;color:#0F172A;border:1px solid #E2E8F0;border-radius:18px;box-shadow:0 20px 50px rgba(15,23,42,.22);padding:14px;display:none;z-index:600;font-family:'Hind Siliguri','Inter',sans-serif;text-align:left}
.mb-pop.open{display:block}
.mb-pop h4{font-size:15px;margin:0 0 10px;display:flex;align-items:center;justify-content:space-between}
.mb-pop h4 i{font-style:normal;font-size:10.5px;font-weight:700;background:#FEF3C7;color:#92400E;border-radius:100px;padding:1px 9px}
.mb-pop .empty{display:flex;gap:12px;align-items:flex-start;padding:12px;border-radius:14px;background:#F8FAFF;border:1px dashed #E2E8F0}
.mb-pop .empty span{width:38px;height:38px;border-radius:12px;background:#fff;border:1px solid #E2E8F0;display:flex;align-items:center;justify-content:center;color:#1A56DB;flex:none}
.mb-pop .empty b{display:block;font-size:13.5px;line-height:1.35}
.mb-pop .empty p{font-size:12.5px;color:#64748B;margin:2px 0 0;line-height:1.5}
@media(max-width:700px){.mb-pt{display:none}.mb-prof{padding:4px;width:42px;justify-content:center}.mb-bar{gap:6px}.mb-ic,.mb-prof{height:38px}.mb-ic{width:38px}.mb-pa{width:30px;height:30px}.mb-pop{position:fixed;left:12px;right:12px;top:78px;width:auto}}
@media(max-width:400px){.mb-bar .mb-partner{display:none}}
.mb-ov{position:fixed;inset:0;z-index:2000;background:rgba(10,22,40,.62);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;padding:18px}
.mb-ov.show{display:flex}
.mb-box{width:100%;max-width:380px;background:#fff;border-radius:24px;padding:30px 26px 22px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.4);position:relative;font-family:'Hind Siliguri','Inter',sans-serif;color:#0F172A;max-height:92vh;overflow:auto}
.mb-x{position:absolute;right:12px;top:12px;width:34px;height:34px;border:none;border-radius:50%;background:#F1F5F9;color:#475569;font-size:18px;cursor:pointer;line-height:1}
.mb-logo{width:52px;height:52px;border-radius:16px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#2563EB,#7C3AED);box-shadow:0 10px 24px rgba(37,99,235,.35)}
.mb-box h2{font-size:22px;line-height:1.25;margin:0 0 6px;font-weight:700;letter-spacing:-.2px}
.mb-box p.sub{font-size:14px;color:#64748B;margin:0 0 18px}
.mb-chip{display:inline-block;max-width:100%;margin:0 0 8px;padding:4px 14px;border-radius:100px;background:#EEF3FF;color:#1A56DB;font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mb-why{font-size:13px;font-weight:600;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:8px 12px;margin-bottom:14px}
.mb-perks{list-style:none;margin:0 0 20px;padding:14px 16px;background:#F8FAFC;border-radius:14px;text-align:left}
.mb-perks li{display:flex;gap:11px;align-items:center;font-size:14px;color:#334155;margin-bottom:10px;line-height:1.4}
.mb-perks li:last-child{margin-bottom:0}
.mb-perks i{flex:none;width:26px;height:26px;border-radius:8px;background:#EEF3FF;color:#1A56DB;display:flex;align-items:center;justify-content:center;font-style:normal}
.mb-google{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:13px;border-radius:14px;border:1.5px solid #CBD5E1;background:#fff;font:700 15px 'Hind Siliguri','Inter',sans-serif;color:#0F172A;cursor:pointer;transition:background .15s,box-shadow .15s}
.mb-google:hover{background:#F8FAFC;box-shadow:0 4px 14px rgba(15,23,42,.1)}
.mb-google:disabled{opacity:.6;cursor:default}
.mb-fine{font-size:12px;color:#94A3B8;text-align:center;margin-top:14px;line-height:1.55}
.mb-fine a{color:#64748B;text-decoration:underline}
.mb-err{display:none;background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;border-radius:10px;padding:8px 12px;font-size:12.5px;margin-top:10px}
.mb-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);background:#0F172A;color:#fff;padding:11px 18px;border-radius:12px;font:600 13.5px 'Hind Siliguri','Inter',sans-serif;opacity:0;pointer-events:none;transition:all .25s;z-index:2100;max-width:92vw;text-align:center}
.mb-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.mb-iab{display:none;text-align:left;margin:0 0 16px}
.mb-ov.iab .mb-iab{display:block}.mb-ov.iab .mb-perks{display:none}.mb-ov.iab .mb-copy{display:block}
.mb-ov.iab .mb-google{background:#1A56DB;border-color:#1A56DB;color:#fff}.mb-ov.iab .mb-google:hover{background:#1647B8}.mb-ov.iab .mb-google svg{display:none}
.mb-wtick{width:60px;height:60px;border-radius:50%;margin:0 auto 12px;display:grid;place-items:center;background:linear-gradient(135deg,#34D399,#059669);color:#fff}
.mb-wok{margin:0 0 12px;padding:9px 12px;border-radius:12px;background:#ECFDF5;border:1px solid #BBF7D0;color:#047857;font-size:13.5px;font-weight:700;line-height:1.5;text-align:left}
.mb-wh{margin:2px 0 10px;font-size:13.5px;color:#64748B}
.mb-wgo{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;margin:0 0 8px;padding:11px 14px;border:1.5px solid #E2E8F0;border-radius:14px;background:#fff;text-align:left;font:700 14.5px 'Hind Siliguri','Inter',sans-serif;color:#0F172A;text-decoration:none;cursor:pointer}
.mb-wgo:hover{border-color:#1A56DB;background:#F7FAFF}
.mb-wgo i{flex:none;width:34px;height:34px;border-radius:10px;background:#EEF3FF;color:#1A56DB;display:grid;place-items:center;font-style:normal}
.mb-wgo small{display:block;font-size:12px;font-weight:500;color:#64748B;line-height:1.4}
.mb-wlater{margin-top:6px;border:0;background:none;color:#64748B;font:700 13.5px 'Hind Siliguri','Inter',sans-serif;cursor:pointer;padding:8px}
.mb-iab p{margin:0 0 10px;font-size:14px;line-height:1.7;color:#334155}
.mb-iab ol{margin:0 0 12px;padding:12px 14px 12px 32px;background:#F8FAFC;border-radius:14px;font-size:14px;line-height:1.8;color:#334155}
.mb-iab ol[hidden]{display:none}
.mb-iab .mb-hint{font-size:13px;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:8px 12px}.mb-iab .mb-hint[hidden]{display:none}
.mb-copy{display:none;width:100%;margin-top:10px;padding:11px;border-radius:12px;border:1.5px solid #D5E0F5;background:#fff;color:#1A56DB;font:700 14px 'Hind Siliguri','Inter',sans-serif;cursor:pointer}
`;
  document.head.appendChild(css);

  /* ---------------- small helpers ---------------- */
  let toastEl, toastT;
  function toast(msg){
    if(!toastEl){ toastEl = document.createElement('div'); toastEl.className = 'mb-toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  /* ---------------- Facebook / Messenger / Instagram's own browser ----------------
     Google refuses its sign-in inside an app's embedded browser (the visitor gets an error page), and most of our visitors arrive from Facebook. So inside such a browser
     the popup does not send anyone to Google: it says so in one line and hands the page to the phone's real browser, with ?signin=1 on the address, so the sign-in popup
     opens by itself there. Android: the intent:// hand-over (the same one iab.js uses on the card page); iPhone: three steps and a copy-link button.
     The same recognition as iab.js (named apps, plus any plain app web view). Preview anywhere: ?iabtest=android or ?iabtest=ios (nothing is left, the address is only recorded). */
  const trk = (n, p) => { try{ if(window.track) window.track(n, p || {}); }catch(e){} };
  const IAB = (() => {
    const ua = navigator.userAgent || '', test = /[?&]iabtest=(android|ios)\b/.exec(location.search);
    const named = /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Instagram|Messenger/i.test(ua);
    const plain = (/Android/i.test(ua) && /;\s*wv\)/.test(ua)) || (/iPhone|iPad|iPod/i.test(ua) && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua));
    const android = test ? test[1] === 'android' : /Android/i.test(ua);
    const inApp = named || plain || !!test;
    // this page's address for the real browser: without Facebook's tracking tag and the test switch, with ?signin=1
    const target = href => { try{ const u = new URL(href || location.href); u.searchParams.delete('fbclid'); u.searchParams.delete('iabtest'); u.searchParams.set('signin', '1'); return u.href; }catch(e){ return href || location.href; } };
    const intent = href => { try{ const u = new URL(href); return 'intent://' + u.host + u.pathname + u.search + '#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=' + encodeURIComponent(u.href) + ';end'; }catch(e){ return href; } };
    return { inApp, android, ios: !android, test: !!test, target, intent };
  })();
  // arriving in the real browser by that hand-over: the popup opens by itself (once), and the address is cleaned
  const ARRIVED = !IAB.inApp && /[?&]signin=1(&|$)/.test(location.search);
  if(ARRIVED){ try{ const u = new URL(location.href); u.searchParams.delete('signin'); history.replaceState(null, '', u.pathname + u.search + u.hash); }catch(e){} }

  /* ---------------- sign-in popup ---------------- */
  const GOOGLE_G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.5 7l7.3 5.7c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.2 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
  /* the benefits list of the sign-in popup: [icon, text]. A page can pass its own list (see openModal) so the popup speaks about what the visitor came to do. */
  const ICON_SVG = {
    bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h4M7 14h7"/>',
    adduser: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M17 8v6M14 11h6"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c0-3.2 2.6-5.5 6-5.5s6 2.3 6 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.2c2.7.1 4.5 1.9 4.5 4.3"/>',
    seat: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-4 3.6-6 7-6s6.2 2 7 6z"/>',
    share: '<circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="6" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8.3 10.8l7.4-3.6M8.3 13.2l7.4 3.6"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M9 12l2.2 2.2L15 10"/>',
    pen: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14 7l3 3"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>'
  };
  const DEFAULT_PERKS = [['bookmark', 'পছন্দের প্রতিষ্ঠান সেভ, সব ডিভাইসে'], ['card', 'শিক্ষিত কার্ড হারাবে না'], ['users', 'নিজের ব্যাচের সহপাঠীদের খুঁজে নিন'], ['bell', 'ভর্তি ও ফলাফলের খবর · শীঘ্রই']];
  const perksHtml = list => list.map(p => '<li><i><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + (ICON_SVG[p[0]] || ICON_SVG.bookmark) + '</svg></i>' + esc(p[1]) + '</li>').join('');
  let ov;
  function buildModal(){
    ov = document.createElement('div'); ov.className = 'mb-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="mb-box">
      <button type="button" class="mb-x" aria-label="বন্ধ করুন">×</button>
      <div class="mb-logo" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v5"/></svg></div>
      <h2 id="mbTitle">Protishthan-এ স্বাগতম</h2>
      <div class="mb-chip" id="mbChip" hidden></div>
      <p class="sub" id="mbSub">৫ সেকেন্ড, পাসওয়ার্ড ছাড়াই।</p>
      <ul class="mb-perks" id="mbPerks">${perksHtml(DEFAULT_PERKS)}</ul>
      <div class="mb-iab" id="mbIab">
        <p>আপনি এখন Facebook-এর নিজস্ব ব্রাউজারে আছেন। এখানে <b>Google দিয়ে সাইন-ইন চলে না</b> (Google এটা বন্ধ রেখেছে)। আপনার ফোনের আসল ব্রাউজারে খুললেই হয়ে যাবে, ঠিক এই পাতাতেই।</p>
        <div class="mb-hint" id="mbIabHint" hidden>Facebook একটা প্রশ্ন করবে (<i>You’re leaving our app</i>), তখন <b>CONTINUE</b> চাপুন।</div>
        <ol id="mbIabSteps" hidden><li>ওপরে ডানদিকের <b>⋮</b> বা <b>⋯</b> (তিন ফোঁটা) চাপুন।</li><li><b>ব্রাউজারে খুলুন</b> (iPhone-এ <b>Safari-তে খুলুন</b>) বেছে নিন।</li><li>সেখানে সাইন-ইনের পপআপ নিজেই খুলবে।</li></ol>
      </div>
      <button type="button" class="mb-google" id="mbGoogle">${GOOGLE_G}<span id="mbCta">Google দিয়ে চালিয়ে যান</span></button>
      <button type="button" class="mb-copy" id="mbIabCopy">লিংক কপি করুন (ব্রাউজারে পেস্ট করুন)</button>
      <div class="mb-err" id="mbErr"></div>
      <div class="mb-fine">চালিয়ে গেলে <a href="privacy.html">গোপনীয়তা নীতি</a> ও <a href="terms.html">শর্ত</a> মানা হয়।</div>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if(e.target === ov) closeModal(); });
    ov.querySelector('.mb-x').addEventListener('click', closeModal);
    document.getElementById('mbGoogle').addEventListener('click', google);
    document.getElementById('mbIabCopy').addEventListener('click', async () => { const ok = await copyLink(); trk('signin_iab_copy', { ok: ok ? 1 : 0 }); document.getElementById('mbIabCopy').textContent = ok ? 'লিংক কপি হয়েছে ✓ (ব্রাউজারে পেস্ট করুন)' : 'কপি হয়নি, ঠিকানা চেপে ধরে কপি করুন'; });
    document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });
  }
  /* the sign-in prompt says what this page is for, so it reads as the step to what you came to do */
  const PAGE_WHY = { card: 'কার্ডটা হারিয়ে যাওয়ার আগে সেভ করুন', results: 'ফলাফল আর প্রতিষ্ঠানের খবর পেতে যোগ দিন' };
  function pageWhy(){ const p = location.pathname.split('/').filter(Boolean).pop() || ''; return PAGE_WHY[p.split('.')[0]]; }
  function openModal(reason, opts){
    if(!ov) buildModal();
    const o = opts && typeof opts === 'object' ? opts : {};
    document.getElementById('mbTitle').textContent = o.title || 'Protishthan-এ স্বাগতম';
    const chip = document.getElementById('mbChip'); chip.textContent = o.chip || ''; chip.hidden = !o.chip;
    document.getElementById('mbPerks').innerHTML = perksHtml(Array.isArray(o.perks) && o.perks.length ? o.perks : DEFAULT_PERKS);
    document.getElementById('mbCta').textContent = o.cta || 'Google দিয়ে চালিয়ে যান';
    document.getElementById('mbSub').textContent = reason || '৫ সেকেন্ড, পাসওয়ার্ড ছাড়াই।';
    document.getElementById('mbErr').style.display = 'none';
    document.getElementById('mbGoogle').disabled = false;
    // inside Facebook's own browser the button does not go to Google (it would fail there): it opens the real browser
    ov.classList.toggle('iab', IAB.inApp);
    if(IAB.inApp){
      document.getElementById('mbCta').textContent = IAB.android ? 'ব্রাউজারে খুলে সাইন-ইন করুন' : 'ব্রাউজারে খোলার উপায় দেখুন';
      document.getElementById('mbIabSteps').hidden = true; document.getElementById('mbIabHint').hidden = true;
      document.getElementById('mbIabCopy').textContent = 'লিংক কপি করুন (ব্রাউজারে পেস্ট করুন)';
    }
    trk('signin_open', { iab: IAB.inApp ? 1 : 0 });
    ov.classList.add('show'); document.body.style.overflow = 'hidden';
  }
  /* ---------------- the welcome, once, for a person who has just become a member ----------------
     Shown only to a NEW member (the member row was made in the last 6 hours) and only once per browser. It says what happened (the account, the member number, the card that came along),
     and offers three OPTIONAL next steps. If the person was in the middle of something that sign-in was for (a save, the batch sheet, the card panel), nothing covers it:
     a one-line toast is shown instead and the action goes on. The member number is an identity number, not a count: it is never said to be "the Nth member". */
  const bnum = x => String(x).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const WK = uid => 'prot_wel_' + uid;
  const isNewMember = me => { if(!me || !me.user_id || ls.get(WK(me.user_id))) return false; const t = Date.parse(me.created_at); return !!t && Date.now() - t < 6 * 3600e3 && t < Date.now() + 5 * 60e3; };
  const hasPending = () => { if(ls.get('prot_pending_save')) return true; try{ const it = JSON.parse(ls.get('mi_intent') || 'null'); return !!(it && Date.now() - it.t < 30 * 60 * 1000); }catch(e){ return false; } };
  const firstName = me => { const n = String((me && me.display_name) || '').trim().split(/\s+/)[0]; return n && !/@/.test(n) ? n : ''; };
  const hasLocalCard = () => { try{ const d = JSON.parse(ls.get('shikkhito_card_v1') || 'null'); return !!(d && (d.name || d.photo || Object.values(d.edu || {}).some(e => e && e.name))); }catch(e){ return false; } };
  function showWelcome(me, o){
    o = o || {};
    if(document.getElementById('mbWelcome')) return;
    const fn = firstName(me), onCard = /\/card(\.html)?$/.test(location.pathname), cardCame = ls.get('el_adopted') === '1' || o.card === true, hasCard = cardCame || hasLocalCard();
    const MI = window.MyInst, no = me && me.member_no ? bnum(me.member_no) : '';
    const w = document.createElement('div'); w.id = 'mbWelcome'; w.className = 'mb-ov show'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-label', 'স্বাগতম');
    const I = d => '<i><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg></i>';
    const items = [];
    items.push('<button type="button" class="mb-wgo" data-k="where">' + I('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>') + '<span>আমি এখন কোথায় পড়ি<small>স্কুল, কলেজ বা ভার্সিটি বেছে রাখুন</small></span></button>');
    if(!onCard) items.push(hasCard
      ? '<a class="mb-wgo" data-k="life" href="member.html#life">' + I(ICON_SVG.card) + '<span>আমার শিক্ষাজীবন সাজাই<small>প্রাথমিক থেকে স্নাতকোত্তর, এক তালিকায়</small></span></a>'
      : '<a class="mb-wgo" data-k="card" href="card.html">' + I(ICON_SVG.card) + '<span>আমার শিক্ষিত কার্ড বানাই<small>৩০ সেকেন্ডে, নিজের পড়াশোনা দিয়ে</small></span></a>');
    items.push('<button type="button" class="mb-wgo" data-k="batch">' + I(ICON_SVG.users) + '<span>ব্যাচের বন্ধুদের খুঁজি<small>SSC কোন স্কুলে, কোন সালে</small></span></button>');
    w.innerHTML = '<div class="mb-box"><button type="button" class="mb-x" aria-label="বন্ধ করুন">×</button>' +
      '<div class="mb-wtick" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
      '<h2>স্বাগতম' + (fn ? ', ' + esc(fn) : '') + '!</h2><p class="sub">আপনার অ্যাকাউন্ট তৈরি হয়ে গেছে।' + (no ? ' আপনার সদস্য নম্বর <b>' + no + '</b>।' : '') + '</p>' +
      (cardCame ? '<div class="mb-wok">✓ আপনার বানানো শিক্ষিত কার্ড অ্যাকাউন্টে সেভ হয়ে গেছে, এখন যেকোনো ফোনে পাবেন।</div>' : '') +
      '<p class="mb-wh">চাইলে এখন এক-দুটো কাজ সেরে নিন। সবটাই ঐচ্ছিক।</p>' + items.join('') +
      '<button type="button" class="mb-wlater" data-k="later">পরে দেখব</button>' +
      '<div class="mb-fine">আমরা শুধু আপনার নাম আর ইমেইল রাখি। আপনার তথ্য শুধু আপনি দেখেন। <a href="privacy.html">গোপনীয়তা নীতি</a></div></div>';
    document.body.appendChild(w); document.body.style.overflow = 'hidden';
    const close = k => { if(w.parentNode) w.parentNode.removeChild(w); document.body.style.overflow = ''; if(k) trk('welcome_go', { k }); };
    w.addEventListener('click', e => { if(e.target === w) close('outside'); });
    w.querySelector('.mb-x').addEventListener('click', () => close('x'));
    document.addEventListener('keydown', function esc2(e){ if(e.key === 'Escape' && w.parentNode){ close('esc'); document.removeEventListener('keydown', esc2); } });
    w.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', e => {
      const k = b.getAttribute('data-k');
      if(k === 'later'){ close('later'); return; }
      if(k === 'where' || k === 'batch'){
        if(MI && MI.open){ e.preventDefault(); close(k); MI.open({ mode: k === 'batch' ? 'batch' : 'current' }); }
        else { close(k); location.href = 'member.html#life'; }
        return;
      }
      trk('welcome_go', { k });                // the two links go on by themselves
    }));
    trk('welcome_shown', { card: cardCame ? 1 : 0, onCard: onCard ? 1 : 0 });
  }
  // called after the sign-in came back; "pending" = the visitor came to do something that goes on by itself
  function maybeWelcome(me, pending){
    if(!isNewMember(me)) return;
    ls.set(WK(me.user_id), '1');                                    // once per browser, whatever happens next
    const go = () => {
      if(pending){ toast('স্বাগতম' + (firstName(me) ? ', ' + firstName(me) : '') + '! আপনি এখন সদস্য ✓'); trk('welcome_toast', {}); return; }
      showWelcome(me);
    };
    setTimeout(() => { if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); }, 900);
  }
  /* the hand-over to the real browser (Android: tries it at once; if the phone did not take it, or on an iPhone, the steps are shown) */
  async function copyLink(){
    const url = IAB.target(); let ok = false;
    try{ await navigator.clipboard.writeText(url); ok = true; }catch(e){ try{ const t = document.createElement('textarea'); t.value = url; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove(); }catch(_){} }
    return ok;
  }
  async function handOver(){
    trk('signin_iab_open', { os: IAB.android ? 'android' : 'ios' });
    const steps = document.getElementById('mbIabSteps'), hint = document.getElementById('mbIabHint'), cp = document.getElementById('mbIabCopy');
    const showSteps = async () => { steps.hidden = false; const ok = await copyLink(); cp.textContent = ok ? 'লিংক কপি হয়েছে ✓ (ব্রাউজারে পেস্ট করুন)' : 'কপি হয়নি, ঠিকানা চেপে ধরে কপি করুন'; };
    if(IAB.android){
      const href = IAB.intent(IAB.target());
      if(IAB.test){ window.__mbHandoff = href; hint.hidden = false; return; }          // the preview records the address, it does not leave
      hint.hidden = false; location.href = href;
      setTimeout(() => { if(!document.hidden) showSteps(); }, 1600);               // the app does not say whether it worked: if this page is still in front, show the other way
    } else { if(IAB.test) window.__mbHandoff = IAB.target(); await showSteps(); }
  }
  function closeModal(){ if(ov){ ov.classList.remove('show'); document.body.style.overflow = ''; } }

  async function google(){
    if(IAB.inApp){ handOver(); return; }                                             // never send an app browser to Google: it ends in an error page
    const btn = document.getElementById('mbGoogle'), err = document.getElementById('mbErr');
    trk('signin_google', {});
    btn.disabled = true; err.style.display = 'none';
    // if the Google provider isn't switched on yet, say so nicely instead of sending the visitor to a raw error page
    try{
      const st = await fetch(SB_URL + '/auth/v1/settings', { headers: { apikey: SB_KEY } }).then(r => r.json());
      if(st && st.external && st.external.google === false){ btn.disabled = false; err.textContent = 'Google দিয়ে যোগ দেওয়া এখনো চালু হয়নি — একটু পরে আবার চেষ্টা করুন।'; err.style.display = 'block'; return; }
    }catch(e){}
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname + location.search, queryParams: { prompt: 'select_account' } } });
    if(error){ btn.disabled = false; err.textContent = 'এখন চালু করা যাচ্ছে না: ' + error.message; err.style.display = 'block'; }
  }

  /* ---------------- session ---------------- */
  async function loadMember(session){
    if(!session){ ME = null; return null; }
    const { data, error } = await sb.rpc('ensure_member');
    if(error){ console.warn('ensure_member:', error.message); ME = { user_id: session.user.id, display_name: (session.user.user_metadata || {}).full_name || session.user.email, avatar_url: null, email: session.user.email, _fallback: true }; }
    else ME = data;
    return ME;
  }
  /* a card made before the sign-up is adopted by the account (the same card the card page keeps for a signed-in member): the dashboard's শিক্ষাজীবন shows it at once.
     Only when the account has no card or an older one, never over a newer one; not on the card page (it syncs by itself). */
  async function adoptLocalCard(){
    try{
      if(!ME || /\/card(\.html)?$/.test(location.pathname)) return;
      const raw = ls.get('shikkhito_card_v1'); if(!raw) return;
      const d = JSON.parse(raw); if(!d || typeof d !== 'object') return;
      if(!d.name && !d.photo && !(d.badges || []).length && !Object.values(d.edu || {}).some(e => e && e.name)) return;     // an empty card: nothing to keep
      const lt = Number(d.savedAt) || 0, seen = ME.user_id + ':' + lt;
      if(ls.get('el_adopt_seen') === seen) return;              // this very card was already looked at for this member: no database call on every page
      const { data: row, error } = await sb.from('member_cards').select('saved_at').maybeSingle(); if(error) return;
      if(row && Number(row.saved_at) >= lt){ ls.set('el_adopt_seen', seen); return; }
      const { error: e2 } = await sb.from('member_cards').upsert({ user_id: ME.user_id, data: d, saved_at: lt || Date.now(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if(!e2){ ls.set('el_adopted', '1'); ls.set('el_adopt_seen', seen); }
    }catch(e){}
  }
  async function refresh(session){
    await loadMember(session);
    SAVED = null;
    render();
    listeners.forEach(cb => { try{ cb(ME); }catch(e){ console.error(e); } });
    if(ME) adoptLocalCard();
    return ME;
  }
  sb.auth.getSession().then(async ({ data: { session } }) => {
    await refresh(session);
    resolveReady(ME);
    const pendingAtReturn = hasPending();                              // read now: the pages' own listeners (the batch sheet, the save) clear their keys a moment later
    maybeWelcome(ME, pendingAtReturn);
    // came here from the Facebook browser's hand-over: the sign-in popup opens by itself (nothing if already signed in)
    if(ARRIVED){ trk('signin_return', { signed: ME ? 1 : 0 }); if(!ME){ const go = () => openModal(pageWhy()); if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); } }
    // finish a "save" the visitor started before being sent to Google
    const pend = ls.get('prot_pending_save');
    if(ME && pend){ ls.del('prot_pending_save'); try{ const p = JSON.parse(pend); if(p.path === location.pathname){ await toggleSaved(p.id, true); toast('সেভ করা হয়েছে ★'); } }catch(e){} }
  });
  sb.auth.onAuthStateChange((evt, session) => {
    if(evt === 'SIGNED_OUT'){ ME = null; SAVED = null; render(); listeners.forEach(cb => cb(null)); }
    else if(evt === 'SIGNED_IN' && !ME){ setTimeout(() => refresh(session).then(() => resolveReady(ME)), 0); }
  });

  /* ---------------- nav slots ---------------- */
  function initial(m){ return String((m && (m.display_name || m.email)) || '?').trim().charAt(0).toUpperCase(); }
  function render(){
    document.querySelectorAll('[data-member-slot]').forEach(slot => {
      const light = slot.dataset.memberSlot === 'light';
      if(!ME){
        slot.innerHTML = light
          ? '<button type="button" class="tbtn mb-join" style="background:#1A56DB;border-color:#1A56DB;color:#fff"><span>যোগ দিন</span></button>'
          : '<button type="button" class="btn-ghost-nav mb-login">লগইন</button><button type="button" class="btn-primary-nav mb-join">সাইন আপ<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>';
        slot.querySelectorAll('.mb-join,.mb-login').forEach(b => b.addEventListener('click', () => openModal(pageWhy())));
        return;
      }
      const face = ME.avatar_url ? `<img src="${esc(ME.avatar_url)}" alt="">` : esc(initial(ME));
      const onProfile = /\/member(\.html)?$/.test(location.pathname);
      if(light){
        slot.innerHTML = `<span class="mb-wrap mb-light"><a class="mb-av" href="member.html" aria-label="আমার প্রোফাইল" title="আমার প্রোফাইল">${face}</a></span>`;
      } else {
        const nm = String(ME.display_name || '').trim(), first = nm.split(/\s+/)[0] || 'প্রোফাইল';
        const I = d => '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
        slot.innerHTML = `<span class="mb-bar">
          <span class="mb-nw"><a class="mb-ic mb-msg" href="messages.html" aria-label="Message" title="Message">${I('<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-5.4A8.4 8.4 0 1 1 21 11.5z"/>')}<i class="mb-dot"></i></a></span>
          <span class="mb-nw"><button type="button" class="mb-ic mb-bell" aria-label="নোটিফিকেশন" aria-haspopup="true" title="নোটিফিকেশন">${I('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>')}</button>
            <div class="mb-pop" role="dialog" aria-label="নোটিফিকেশন"><h4>নোটিফিকেশন <i>শীঘ্রই</i></h4><div class="empty"><span>${I('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>')}</span><div><b>এখনো কোনো নোটিফিকেশন নেই</b><p>সেভ করা প্রতিষ্ঠানের ভর্তি, নোটিস আর ফলাফলের খবর এখানে আসবে।</p></div></div></div></span>
          <span class="mb-aw"><button type="button" class="mb-acc${onProfile ? ' on' : ''}" aria-haspopup="menu" aria-expanded="false" title="${esc(nm || 'আমার প্রোফাইল')}"><span class="mb-pa">${face}</span><span class="mb-pt">${esc(first)}</span><svg class="mb-cv" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
            <div class="mb-menu" role="menu">
              <div class="mb-hd"><span class="mb-pa big">${face}</span><div><b>${esc(nm || 'আমার প্রোফাইল')}</b><small>${esc(ME.email || '')}</small></div></div>
              <a role="menuitem" href="member.html">${I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.2-6 8-6s6.8 2 8 6"/>')}আমার প্রোফাইল</a>
              <a role="menuitem" href="index.html?saved=1">${I('<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>')}সেভ করা প্রতিষ্ঠান</a>
              <a role="menuitem" href="messages.html">${I('<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-5.4A8.4 8.4 0 1 1 21 11.5z"/>')}Message</a>
              <a role="menuitem" href="skill.html">${I('<circle cx="12" cy="9" r="6"/><path d="M8.5 14.2L7 22l5-3 5 3-1.5-7.8"/>')}আমার স্কিল পেজ</a>
              <a role="menuitem" href="card.html">${I('<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2.2"/><path d="M15 10h3.5M15 13h3"/>')}আমার শিক্ষিত কার্ড</a>
              <button type="button" role="menuitem" class="mb-out">${I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>')}লগ আউট</button>
            </div></span>
        </span>`;
        const bell = slot.querySelector('.mb-bell'), pop = slot.querySelector('.mb-pop'), acc = slot.querySelector('.mb-acc'), menu = slot.querySelector('.mb-menu');
        bell.addEventListener('click', e => { e.stopPropagation(); menu.classList.remove('open'); acc.setAttribute('aria-expanded', 'false'); pop.classList.toggle('open'); });
        acc.addEventListener('click', e => { e.stopPropagation(); pop.classList.remove('open'); const on = !menu.classList.contains('open'); menu.classList.toggle('open', on); acc.setAttribute('aria-expanded', on ? 'true' : 'false'); });
        slot.querySelector('.mb-out').addEventListener('click', () => signOut());
        // a tutor with new alerts: a dot on the bell and a line in its pop-up (asked only when this browser knows the member is a tutor: nobody else gets an extra call)
        try{ if(ls.get('prot_is_tutor') === '1') sb.rpc('tutor_alert_unread').then(r => { const n = Number(r && r.data) || 0; if(n < 1) return; const bell = slot.querySelector('.mb-bell'), pop = slot.querySelector('.mb-pop'); if(bell && !bell.querySelector('.mb-dot')){ const d = document.createElement('i'); d.className = 'mb-dot'; d.style.display = 'block'; bell.appendChild(d); } if(pop && !pop.querySelector('.mb-ta')){ const a = document.createElement('a'); a.className = 'mb-ta'; a.href = 'member.html#tutoralert'; a.style.cssText = 'display:flex;gap:10px;align-items:center;text-decoration:none;color:inherit;padding:10px 12px;margin-bottom:8px;border-radius:14px;background:#EEF3FF'; a.innerHTML = '<span style="background:#1A56DB;color:#fff;border-radius:12px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-weight:800">' + n.toLocaleString('bn-BD') + '</span><div><b style="font-size:13.5px">Tutor Alert</b><p style="font-size:12.5px;color:#64748B;margin:0">নতুন অনুরোধ এসেছে, দেখুন</p></div>'; pop.insertBefore(a, pop.querySelector('.empty')); } }, () => {}); }catch(e){}
        // new chat messages: a dot on the bell and a link in its pop-up
        try{ Promise.all([sb.rpc('skill_chat_unread'), sb.rpc('batch_chat_unread')]).then(([r, r2]) => { const n = (Number(r && r.data) || 0) + (Number(r2 && r2.data) || 0); if(n < 1) return; const dot = slot.querySelector('.mb-msg .mb-dot'); if(dot) dot.style.display = 'block'; const e = slot.querySelector('.mb-pop .empty'); if(e) e.innerHTML = '<a href="messages.html" style="display:flex;gap:10px;align-items:center;width:100%;text-decoration:none;color:inherit"><span style="background:#FEF3C7;color:#92400E;border-radius:12px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-weight:800">' + n.toLocaleString('bn-BD') + '</span><div><b>নতুন বার্তা এসেছে</b><p>চ্যাট খুলতে এখানে চাপুন</p></div></a>'; }, () => {}); }catch(e){}
      }
      // on the profile page itself the profile button just scrolls to the top
      const prof = slot.querySelector('.mb-av');
      if(prof) prof.addEventListener('click', e => { if(onProfile){ e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
    });
  }
  document.addEventListener('click', e => { if(!e.target.closest('.mb-nw')) document.querySelectorAll('.mb-pop.open').forEach(p => p.classList.remove('open')); if(!e.target.closest('.mb-aw')) document.querySelectorAll('.mb-menu.open').forEach(m => { m.classList.remove('open'); const b = m.previousElementSibling; if(b) b.setAttribute('aria-expanded', 'false'); }); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape'){ document.querySelectorAll('.mb-pop.open').forEach(p => p.classList.remove('open')); document.querySelectorAll('.mb-menu.open').forEach(m => m.classList.remove('open')); } });
  document.addEventListener('DOMContentLoaded', render);
  if(document.readyState !== 'loading') render();

  async function signOut(){ await sb.auth.signOut(); location.reload(); }

  /* ---------------- saved institutions ---------------- */
  async function loadSaved(){
    if(!ME) return new Set();
    if(SAVED) return SAVED;
    const { data } = await sb.from('saved_institutions').select('listing_id');
    SAVED = new Set((data || []).map(r => r.listing_id));
    return SAVED;
  }
  async function isSaved(id){ return (await loadSaved()).has(id); }
  // returns true if the institution is saved afterwards; null if the visitor had to sign in first
  async function toggleSaved(id, forceOn){
    if(!ME){ ls.set('prot_pending_save', JSON.stringify({ id, path: location.pathname })); openModal('এই প্রতিষ্ঠান সেভ করতে যোগ দিন'); return null; }
    const set = await loadSaved();
    const on = forceOn === true ? true : !set.has(id);
    if(on){ const { error } = await sb.from('saved_institutions').upsert({ user_id: ME.user_id, listing_id: id }, { onConflict: 'user_id,listing_id' }); if(error){ toast('সেভ হয়নি: ' + error.message); return set.has(id); } set.add(id); }
    else { const { error } = await sb.from('saved_institutions').delete().match({ user_id: ME.user_id, listing_id: id }); if(error){ toast('সরানো যায়নি: ' + error.message); return set.has(id); } set.delete(id); }
    return on;
  }

  // change the signed-in member's own name / picture (RLS + column grants allow only these two fields)
  async function updateProfile(patch){
    if(!ME) throw new Error('NOT_SIGNED_IN');
    const upd = {};
    if('display_name' in patch) upd.display_name = patch.display_name;
    if('avatar_url' in patch) upd.avatar_url = patch.avatar_url;
    const { data, error } = await sb.from('members').update(upd).eq('user_id', ME.user_id).select().single();
    if(error) throw error;
    ME = data; render();
    listeners.forEach(cb => { try{ cb(ME); }catch(e){ console.error(e); } });
    return ME;
  }

  P.member = {
    sb, ready: () => READY, current: () => ME,
    onChange(cb){ listeners.push(cb); },
    signIn: openModal, signOut, toast, esc, updateProfile, welcome: showWelcome, iab: { inApp: IAB.inApp, android: IAB.android, target: IAB.target, intent: IAB.intent },
    saved: { has: isSaved, toggle: toggleSaved, list: loadSaved }
  };
})();
