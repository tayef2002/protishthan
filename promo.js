/* Protishthan promo popup — shows the one promo an admin has switched on (table site_promos).
   Used by the home page (initHome) and by the admin screen (cardHtml for the live preview, open for a test run).
   Rules: shown at most once per session, then not again for `frequency_days`; never while the visitor is typing;
   sponsored promos are always labelled. No tracking of any kind. */
(function(){
  'use strict';
  const P = window.Protishthan = window.Protishthan || {};
  if(P.promo) return;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const ls = { get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} } };
  const ss = { get(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }, set(k, v){ try{ sessionStorage.setItem(k, v); }catch(e){} } };

  const css = document.createElement('style');
  css.textContent = `
.pp-ov{position:fixed;inset:0;z-index:2300;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(10,22,40,.55);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);opacity:0;transition:opacity .28s ease}
.pp-ov.show{opacity:1}
.pp-card{position:relative;width:100%;max-width:430px;background:#fff;border-radius:26px;overflow:hidden;box-shadow:0 40px 100px rgba(0,0,0,.45);transform:translateY(22px) scale(.97);transition:transform .34s cubic-bezier(.2,.8,.2,1);font-family:'Hind Siliguri','Inter',sans-serif;color:#0F172A;text-align:left}
.pp-ov.show .pp-card{transform:none}
.pp-card.static{max-width:none;transform:none;box-shadow:0 18px 50px rgba(15,32,72,.18);border:1px solid #E2E8F0}
.pp-media{position:relative;height:168px;overflow:hidden;background:linear-gradient(135deg,#0A1628,#1A3570 52%,#7C3AED)}
.pp-media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.pp-art{position:absolute;inset:0}
.pp-art i{position:absolute;border-radius:50%;filter:blur(2px)}
.pp-art .a{width:180px;height:180px;right:-40px;top:-60px;background:radial-gradient(circle,rgba(124,58,237,.75),transparent 70%)}
.pp-art .b{width:150px;height:150px;left:-30px;bottom:-60px;background:radial-gradient(circle,rgba(37,99,235,.8),transparent 70%)}
.pp-art svg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:rgba(255,255,255,.92)}
.pp-x{position:absolute;right:12px;top:12px;z-index:3;width:36px;height:36px;border:none;border-radius:50%;background:rgba(15,23,42,.45);backdrop-filter:blur(6px);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s}
.pp-x:hover{background:rgba(15,23,42,.7)}
.pp-body{padding:20px 24px 22px}
.pp-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.pp-badge{font-size:12px;font-weight:700;color:#1A56DB;background:#EEF3FF;border-radius:100px;padding:2px 11px}
.pp-spons{font-size:11.5px;font-weight:700;color:#92400E;background:#FEF3C7;border-radius:100px;padding:2px 10px}
.pp-body h3{font-size:23px;line-height:1.3;letter-spacing:-.2px;margin:0 0 8px}
.pp-body p{font-size:15px;line-height:1.65;color:#475569;margin:0 0 18px}
.pp-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px 18px;border-radius:14px;background:linear-gradient(135deg,#2563EB,#4F46E5);color:#fff;font:700 15.5px 'Hind Siliguri','Inter',sans-serif;text-decoration:none;box-shadow:0 10px 24px rgba(37,99,235,.35);transition:transform .15s,box-shadow .15s;border:none;cursor:pointer}
.pp-cta:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(37,99,235,.45)}
.pp-later{display:block;width:100%;margin-top:6px;padding:10px;border:none;background:none;font:600 14px 'Hind Siliguri','Inter',sans-serif;color:#64748B;cursor:pointer;border-radius:12px}
.pp-later:hover{background:#F1F5F9;color:#0F172A}
@media(max-width:560px){.pp-ov{align-items:flex-end;padding:0}.pp-card:not(.static){max-width:none;border-radius:26px 26px 0 0;transform:translateY(100%)}.pp-ov.show .pp-card{transform:none}.pp-media{height:140px}.pp-body{padding-bottom:calc(22px + env(safe-area-inset-bottom))}}
@media(prefers-reduced-motion:reduce){.pp-ov,.pp-card{transition:none}}
`;
  document.head.appendChild(css);

  const ART = '<svg width="76" height="76" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M10 21v-5h4v5"/><path d="M19 3v4M17 5h4"/></svg>';
  const CLOSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  /* the card, as plain HTML (also used for the admin's live preview) */
  function cardHtml(p, opts){
    const o = opts || {}, pre = o.preview;
    const ext = p.cta_url && /^https:\/\//.test(p.cta_url) && !/^https:\/\/([a-z0-9-]+\.)?protishthan\.(com|pages\.dev)/i.test(p.cta_url);
    const rel = p.sponsored ? 'noopener sponsored' : 'noopener';
    const media = p.image_url ? `<img src="${esc(p.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<div class="pp-art"><i class="a"></i><i class="b"></i>${ART}</div>`;
    return `<div class="pp-card${pre ? ' static' : ''}" ${pre ? '' : 'role="document"'}>
      ${pre ? '' : `<button type="button" class="pp-x" aria-label="বন্ধ করুন">${CLOSE}</button>`}
      <div class="pp-media">${media}</div>
      <div class="pp-body">
        ${(p.badge || p.sponsored) ? `<div class="pp-meta">${p.badge ? `<span class="pp-badge">${esc(p.badge)}</span>` : ''}${p.sponsored ? `<span class="pp-spons">স্পনসরড${p.sponsor_name ? ' · ' + esc(p.sponsor_name) : ''}</span>` : ''}</div>` : ''}
        <h3 id="ppT">${esc(p.title || 'শিরোনাম')}</h3>
        ${p.body ? `<p>${esc(p.body).replace(/\n/g, '<br>')}</p>` : ''}
        ${p.cta_url && p.cta_label ? `<a class="pp-cta" href="${esc(p.cta_url)}"${ext ? ` target="_blank" rel="${rel}"` : ''}>${esc(p.cta_label)} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>` : ''}
        ${pre ? '' : '<button type="button" class="pp-later">পরে দেখব</button>'}
      </div>
    </div>`;
  }

  let openEl = null;
  function close(){
    if(!openEl) return;
    const el = openEl; openEl = null;
    el.classList.remove('show'); document.body.style.overflow = el._prevOverflow || '';
    document.removeEventListener('keydown', el._esc);
    setTimeout(() => el.remove(), 320);
  }
  function open(p, onDone){
    if(openEl) return;
    const ov = document.createElement('div');
    ov.className = 'pp-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'ppT');
    ov.innerHTML = cardHtml(p);
    ov._prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    ov._esc = e => { if(e.key === 'Escape'){ close(); if(onDone) onDone('esc'); } };
    document.addEventListener('keydown', ov._esc);
    ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('.pp-x, .pp-later')){ close(); if(onDone) onDone('closed'); } else if(e.target.closest('.pp-cta')){ if(onDone) onDone('cta'); } });
    document.body.appendChild(ov); openEl = ov;
    requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('show')));
    const cta = ov.querySelector('.pp-cta'); if(cta) setTimeout(() => cta.focus({ preventScroll: true }), 350);
  }

  /* home page: fetch the live promo (RLS only returns it while it is on and in schedule) and show it politely */
  async function initHome(sb){
    let p = null;
    try{ const { data } = await sb.from('site_promos').select('*').eq('slot', 'home_popup').maybeSingle(); p = data; }catch(e){}
    if(!p || !p.active) return;
    const key = 'prot_promo_' + p.slot;
    if(ss.get(key + '_s')) return;                                         // once per session
    let rec = null; try{ rec = JSON.parse(ls.get(key) || 'null'); }catch(e){}
    if(rec && rec.v === p.updated_at && p.frequency_days > 0 && Date.now() - rec.t < p.frequency_days * 86400000) return;
    if(rec && rec.v === p.updated_at && p.frequency_days === 0 && ss.get(key + '_s')) return;
    // audience: needs the member session to be known
    if(p.audience !== 'all' && P.member){ try{ await P.member.ready(); }catch(e){} const signed = !!(P.member.current && P.member.current()); if(p.audience === 'guests' && signed) return; if(p.audience === 'members' && !signed) return; }
    let tries = 0;
    const attempt = () => {
      const a = document.activeElement;
      if(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && tries++ < 5){ setTimeout(attempt, 4000); return; }    // never interrupt typing
      if(document.querySelector('.filters.open, .pp-ov, .mb-ov.show')) { if(tries++ < 5) setTimeout(attempt, 4000); return; }
      ss.set(key + '_s', '1');
      ls.set(key, JSON.stringify({ v: p.updated_at, t: Date.now() }));
      if(P.nudge && P.nudge.closePanel) P.nudge.closePanel();
      open(p);
    };
    setTimeout(attempt, Math.max(0, p.delay_seconds) * 1000);
  }

  P.promo = { cardHtml, open, close, initHome };
})();
