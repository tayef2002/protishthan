/* আমার স্কিল, আমার আইডেন্টিটি — shared code: page renderer (SkillView) and share-image drawing (SkillCanvas).
   Used by the editor (skill.html) and the public page (s.html). Needs skill.css; avatars.js and qrcode.min.js are optional. */
(function(){
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LEVELS = ['শিখছি', 'মোটামুটি', 'দক্ষ', 'বিশেষজ্ঞ'];
  const BADGES = {
    'self-taught': 'স্ব-শিক্ষিত', 'freelancer': 'ফ্রিল্যান্সার', 'problem-solver': 'সমস্যা সমাধানকারী', 'zero-degree': 'ডিগ্রি ছাড়াই স্কিলে',
    'creator': 'ক্রিয়েটর', 'builder': 'নির্মাতা', 'night-owl': 'রাতজাগা কর্মী', 'mentor': 'মেন্টর', 'learner': 'চিরশিক্ষার্থী', 'open-source': 'ওপেন সোর্স'
  };
  const THEMES = {
    midnight: { name: 'মিডনাইট', bg: '#070B16', bg2: '#0D1530', ink: '#F4F6FF', mut: '#9AA6C4', a1: '#6EA8FF', a2: '#8B7CFF', a3: '#38E1C6', dark: true },
    aurora:   { name: 'অরোরা',   bg: '#04100F', bg2: '#08201D', ink: '#F1FBF8', mut: '#93B5AD', a1: '#34D399', a2: '#22D3EE', a3: '#A3E635', dark: true },
    ocean:    { name: 'ওশান',    bg: '#040F1D', bg2: '#08203A', ink: '#F0F7FF', mut: '#8FA9C7', a1: '#38BDF8', a2: '#3B82F6', a3: '#818CF8', dark: true },
    ember:    { name: 'এম্বার',   bg: '#150A0B', bg2: '#2A1214', ink: '#FFF4F0', mut: '#C2A09A', a1: '#FB923C', a2: '#F43F5E', a3: '#FACC15', dark: true },
    paper:    { name: 'পেপার',   bg: '#F6F3EC', bg2: '#EDE8DC', ink: '#17171C', mut: '#6B6A74', a1: '#2F5BEA', a2: '#7C3AED', a3: '#0EA5A4', dark: false }
  };
  const SITE = 'https://protishthan.com';

  function avatarSrc(a){
    if(!a) return '';
    if(a.indexOf('av:') === 0){
      const m = a.split(':'), L = window.ProtAvatars && window.ProtAvatars.list;
      const it = L && L.find(x => x.id === m[1]);
      return it ? window.ProtAvatars.dataUrl(it.spec, Number(m[2]) || 0) : '';
    }
    return /^https:\/\//.test(a) ? a : '';
  }
  function hostOf(u){ try{ return new URL(u).hostname.replace(/^www\./, ''); }catch(e){ return ''; } }
  function iconText(h){
    const t = { 'github.com': 'GH', 'behance.net': 'Be', 'dribbble.com': 'Dr', 'youtube.com': 'YT', 'youtu.be': 'YT', 'linkedin.com': 'in', 'facebook.com': 'f', 'fb.com': 'f', 'instagram.com': 'IG', 'medium.com': 'M', 'x.com': 'X', 'twitter.com': 'X', 'figma.com': 'Fg', 'notion.site': 'N' };
    for(const k in t) if(h === k || h.endsWith('.' + k)) return t[k];
    return (h[0] || '↗').toUpperCase();
  }
  const SPARK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>';
  const ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9"/></svg>';
  const SHIELD = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>';
  const bn = n => Number(n).toLocaleString('bn-BD');
  function initials(n){ const w = String(n || '').trim().split(/\s+/).filter(Boolean); return ((w[0] || '?')[0] + ((w[1] || '')[0] || '')).toUpperCase(); }

  /* ---------------- the page / preview ---------------- */
  function html(p, opt){
    opt = opt || {};
    p = p || {};
    const skills = Array.isArray(p.skills) ? p.skills : [], links = Array.isArray(p.links) ? p.links : [], badges = Array.isArray(p.badges) ? p.badges : [];
    const av = avatarSrc(p.avatar);
    let i = 0;
    const R = () => ' sk-rise" style="--i:' + (i++);
    let h = '<div class="sk-card">';
    h += '<div class="sk-head">';
    h += '<div class="sk-av' + R() + '">' + (av ? '<img src="' + esc(av) + '" alt="" referrerpolicy="no-referrer">' : '<div class="ini">' + esc(initials(p.display_name)) + '</div>') + '</div>';
    h += '<span class="sk-self' + R() + '">' + SHIELD + 'স্ব-ঘোষিত স্কিল আইডেন্টিটি</span>';
    h += '<h1 class="sk-name' + R() + '">' + (esc(p.display_name) || '<span style="opacity:.4">আপনার নাম</span>') + '</h1>';
    if(p.headline) h += '<p class="sk-hl' + R() + '">' + esc(p.headline) + '</p>';
    else if(opt.embed) h += '<p class="sk-hl' + R() + '" style="opacity:.45">আপনার পদবি বা পরিচয়</p>';
    if(badges.length) h += '<div class="sk-badges' + R() + '">' + badges.filter(b => BADGES[b]).map(b => '<span class="sk-chip">' + SPARK + esc(BADGES[b]) + '</span>').join('') + '</div>';
    h += '</div>';
    if(p.about) h += '<p class="sk-about' + R() + '">' + esc(p.about).replace(/\n/g, '<br>') + '</p>';
    if(skills.length || links.length || p.views != null){
      h += '<div class="sk-stats' + R() + '"><div><b>' + bn(skills.length) + '</b><span>স্কিল</span></div><div><b>' + bn(links.length) + '</b><span>প্রজেক্ট</span></div>' + (p.views != null ? '<div><b>' + bn(p.views) + '</b><span>জন দেখেছেন</span></div>' : '') + '</div>';
    }
    h += '<div class="sk-h' + R() + '">স্কিল</div>';
    if(skills.length){
      h += '<div class="sk-skills">' + skills.map((s, k) => {
        const l = Math.max(1, Math.min(4, Number(s.l) || 2));
        return '<div class="sk-skill sk-rise" style="--i:' + (i + k) + '"><div class="r"><b>' + esc(s.n) + '</b><em>' + LEVELS[l - 1] + '</em></div><div class="sk-bar"><i style="--p:' + (l * 25) + '%;--i:' + k + '"></i></div></div>';
      }).join('') + '</div>';
      i += skills.length;
    } else h += '<div class="sk-empty">এখনো কোনো স্কিল যোগ করা হয়নি</div>';
    if(links.length){
      h += '<div class="sk-h' + R() + '">প্রজেক্ট ও কাজ</div><div class="sk-links">' + links.map((l, k) => {
        const host = hostOf(l.u);
        return '<a class="sk-link sk-rise" style="--i:' + (i + k) + '" href="' + esc(l.u) + '" target="_blank" rel="noopener noreferrer nofollow ugc"><span class="ic">' + esc(iconText(host)) + '</span><span class="t"><b>' + esc(l.t || host) + '</b><em>' + esc(host) + '</em></span>' + ARROW + '</a>';
      }).join('') + '</div>';
      i += links.length;
    } else if(opt.embed) h += '<div class="sk-h' + R() + '">প্রজেক্ট ও কাজ</div><div class="sk-empty">আপনার কাজের লিংক এখানে দেখাবে</div>';
    h += '<p class="sk-note' + R() + '">এই তথ্য ব্যক্তি নিজে দিয়েছেন; Protishthan যাচাই করেনি।</p>';
    h += '</div>';
    return h;
  }
  function mount(el, p, opt){
    opt = opt || {};
    el.className = 'sk' + (opt.embed ? ' sk-embed in' : '');   // the live preview starts in its final state, so typing never replays the entrance
    el.setAttribute('data-theme', THEMES[p && p.theme] ? p.theme : 'midnight');
    el.innerHTML = '<div class="sk-bg" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i><span class="gr"></span></div>' + html(p, opt);
    // entrance: let the first paint happen with everything hidden, then reveal (bars fill after the cards)
    if(!opt.embed) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  }

  /* ---------------- share images (canvas) ---------------- */
  const loadImg = src => new Promise(res => {
    if(!src) return res(null);
    const im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
    im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
  });
  async function fonts(){
    try{ await Promise.all([document.fonts.load('800 48px "Hind Siliguri"'), document.fonts.load('600 28px "Hind Siliguri"'), document.fonts.load('400 24px "Hind Siliguri"'), document.fonts.load('800 48px Inter'), document.fonts.load('500 24px Inter')]); }catch(e){}
  }
  function rr(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function wrap(c, text, maxW, maxLines){
    const words = String(text || '').split(/\s+/).filter(Boolean), lines = []; let cur = '';
    for(const w of words){
      const t = cur ? cur + ' ' + w : w;
      if(c.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
    }
    if(cur) lines.push(cur);
    if(lines.length > maxLines){ const keep = lines.slice(0, maxLines); let last = keep[maxLines - 1]; while(last.length > 1 && c.measureText(last + '…').width > maxW) last = last.slice(0, -1); keep[maxLines - 1] = last + '…'; return keep; }
    return lines;
  }
  function fit(c, text, weight, family, size, min, maxW){
    let s = size; c.font = weight + ' ' + s + 'px ' + family;
    while(s > min && c.measureText(text).width > maxW){ s -= 2; c.font = weight + ' ' + s + 'px ' + family; }
    return s;
  }
  function backdrop(c, W, H, T){
    c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
    const blob = (x, y, r, col, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = a; c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalAlpha = 1; };
    const lg = c.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, T.bg2); lg.addColorStop(1, T.bg); c.fillStyle = lg; c.fillRect(0, 0, W, H);
    blob(W * .12, -H * .05, Math.max(W, H) * .7, T.a2, T.dark ? .34 : .2);
    blob(W * .95, H * .2, Math.max(W, H) * .6, T.a1, T.dark ? .3 : .18);
    blob(W * .5, H * 1.05, Math.max(W, H) * .6, T.a3, T.dark ? .2 : .14);
    c.strokeStyle = T.dark ? 'rgba(255,255,255,.05)' : 'rgba(20,20,30,.05)'; c.lineWidth = 1;
    for(let x = 0; x < W; x += 56){ c.beginPath(); c.moveTo(x + .5, 0); c.lineTo(x + .5, H); c.stroke(); }
    for(let y = 0; y < H; y += 56){ c.beginPath(); c.moveTo(0, y + .5); c.lineTo(W, y + .5); c.stroke(); }
  }
  function avatar(c, img, p, cx, cy, r, T){
    const g = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r); g.addColorStop(0, T.a1); g.addColorStop(.5, T.a2); g.addColorStop(1, T.a3);
    c.save(); c.shadowColor = T.a2; c.shadowBlur = r * .5; c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r + 6, 0, Math.PI * 2); c.fill(); c.restore();
    c.fillStyle = T.bg; c.beginPath(); c.arc(cx, cy, r + 2, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, r - 2, 0, Math.PI * 2); c.clip();
    if(img){ const s = Math.max((r * 2) / img.width, (r * 2) / img.height); c.drawImage(img, cx - img.width * s / 2, cy - img.height * s / 2, img.width * s, img.height * s); }
    else { const gg = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r); gg.addColorStop(0, T.a2); gg.addColorStop(1, T.a1); c.fillStyle = gg; c.fillRect(cx - r, cy - r, r * 2, r * 2); c.fillStyle = '#fff'; c.font = '800 ' + Math.round(r * .8) + 'px Inter,"Hind Siliguri",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(initials(p.display_name), cx, cy + 2); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; }
    c.restore();
  }
  function brand(c, logo, x, y, size, T, label){
    const g = c.createLinearGradient(x, y, x + size, y + size); g.addColorStop(0, '#1A56DB'); g.addColorStop(1, '#4F46E5');
    c.fillStyle = g; rr(c, x, y, size, size, size * .26); c.fill();
    if(logo) c.drawImage(logo, x, y, size, size);
    c.fillStyle = T.ink; c.font = '800 ' + Math.round(size * .62) + 'px Inter,"Hind Siliguri",sans-serif'; c.textBaseline = 'middle'; c.fillText(label || 'Protishthan', x + size + 14, y + size / 2 + 1); c.textBaseline = 'alphabetic';
  }
  function qr(c, x, y, size, text, dark, light){
    if(typeof window.qrcode !== 'function') return false;
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), cell = size / n;
    c.fillStyle = light; rr(c, x - 14, y - 14, size + 28, size + 28, 18); c.fill();
    c.fillStyle = dark;
    for(let r = 0; r < n; r++) for(let k = 0; k < n; k++) if(q.isDark(r, k)) c.fillRect(x + k * cell, y + r * cell, Math.ceil(cell), Math.ceil(cell));
    return true;
  }
  const urlOf = p => SITE.replace('https://', '') + '/s/' + (p.username || 'your-name');
  const BODY = '"Hind Siliguri",Inter,sans-serif', HEAD = '"Hind Siliguri",Inter,sans-serif';

  async function draw(p, kind){
    await fonts();
    const T = THEMES[p.theme] || THEMES.midnight, og = kind === 'og';
    const W = og ? 1200 : 1080, H = og ? 630 : 1350;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const [img, logo] = await Promise.all([loadImg(avatarSrc(p.avatar)), loadImg('/logo-sm.webp')]);
    backdrop(c, W, H, T);
    const skills = (p.skills || []).slice(0, og ? 5 : 6);
    if(og){
      avatar(c, img, p, 220, 315, 128, T);
      const x = 410, mw = 740;
      c.fillStyle = T.mut; c.font = '600 24px ' + BODY; c.fillText('স্ব-ঘোষিত স্কিল আইডেন্টিটি', x, 138);
      c.fillStyle = T.ink; const fs = fit(c, p.display_name || 'আপনার নাম', 800, HEAD, 76, 44, mw); c.fillText(p.display_name || 'আপনার নাম', x, 138 + 24 + fs * .95);
      let y = 138 + 24 + fs * .95 + 22;
      c.fillStyle = T.mut; c.font = '500 33px ' + BODY;
      for(const ln of wrap(c, p.headline || '', mw, 2)){ y += 40; c.fillText(ln, x, y); }
      y += 34; let px = x;
      c.font = '600 24px ' + BODY;
      for(const s of skills){
        const w = c.measureText(s.n).width + 36;
        if(px + w > x + mw){ px = x; y += 54; if(y > 500) break; }
        c.fillStyle = T.dark ? 'rgba(255,255,255,.09)' : 'rgba(20,20,30,.06)'; rr(c, px, y, w, 42, 21); c.fill();
        c.strokeStyle = T.dark ? 'rgba(255,255,255,.16)' : 'rgba(20,20,30,.12)'; c.lineWidth = 1.5; rr(c, px, y, w, 42, 21); c.stroke();
        c.fillStyle = T.ink; c.fillText(s.n, px + 18, y + 29); px += w + 12;
      }
      brand(c, logo, 60, 548, 44, T);
      c.textAlign = 'right'; c.fillStyle = T.a1; c.font = '600 27px Inter,sans-serif'; c.fillText(urlOf(p), W - 60, 580); c.textAlign = 'left';
    } else {
      c.fillStyle = T.dark ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.7)'; rr(c, 54, 54, W - 108, H - 108, 56); c.fill();
      c.strokeStyle = T.dark ? 'rgba(255,255,255,.12)' : 'rgba(20,20,30,.1)'; c.lineWidth = 2; rr(c, 54, 54, W - 108, H - 108, 56); c.stroke();
      avatar(c, img, p, W / 2, 236, 118, T);
      c.textAlign = 'center';
      c.fillStyle = T.mut; c.font = '600 25px ' + BODY; c.fillText('স্ব-ঘোষিত স্কিল আইডেন্টিটি', W / 2, 410);
      c.fillStyle = T.ink; const fs = fit(c, p.display_name || 'আপনার নাম', 800, HEAD, 80, 46, W - 190); c.fillText(p.display_name || 'আপনার নাম', W / 2, 410 + 24 + fs * .9);
      let y = 410 + 24 + fs * .9 + 14;
      c.fillStyle = T.mut; c.font = '500 36px ' + BODY;
      for(const ln of wrap(c, p.headline || '', W - 220, 2)){ y += 46; c.fillText(ln, W / 2, y); }
      c.textAlign = 'left';
      y += 46;
      const lv = ['শিখছি', 'মোটামুটি', 'দক্ষ', 'বিশেষজ্ঞ'];
      const rows = Math.min(skills.length, 6), rowH = rows > 4 ? 64 : rows > 3 ? 74 : 86;
      for(let k = 0; k < rows; k++){
        const s = skills[k], l = Math.max(1, Math.min(4, Number(s.l) || 2)), ry = y + k * rowH;
        c.fillStyle = T.ink; c.font = '700 31px ' + BODY; c.fillText(s.n, 130, ry + 28);
        c.textAlign = 'right'; c.fillStyle = T.a1; c.font = '600 24px ' + BODY; c.fillText(lv[l - 1], W - 130, ry + 28); c.textAlign = 'left';
        c.fillStyle = T.dark ? 'rgba(255,255,255,.1)' : 'rgba(20,20,30,.08)'; rr(c, 130, ry + 40, W - 260, 10, 5); c.fill();
        const g = c.createLinearGradient(130, 0, W - 130, 0); g.addColorStop(0, T.a1); g.addColorStop(1, T.a3);
        c.fillStyle = g; rr(c, 130, ry + 40, (W - 260) * l / 4, 10, 5); c.fill();
      }
      // footer: QR + call to action
      const fy = H - 336;
      const hasQR = qr(c, 130, fy + 20, 170, SITE + '/s/' + (p.username || '') + '?ref=card', T.dark ? '#0B1020' : '#17171C', '#FFFFFF');
      const tx = hasQR ? 362 : 130;
      c.fillStyle = T.ink; c.font = '800 38px ' + HEAD; c.fillText('আপনারটাও বানান', tx, fy + 70);
      c.fillStyle = T.mut; c.font = '500 27px ' + BODY; c.fillText('ডিগ্রির বাইরে আপনার আসল স্কিল, এক লিংকে', tx, fy + 114);
      c.fillStyle = T.a1; c.font = '700 29px Inter,sans-serif'; c.fillText(SITE.replace('https://', '') + '/skill', tx, fy + 160);
      brand(c, logo, 130, H - 124, 42, T);
    }
    return cv;
  }
  const toBlob = (cv, type, q) => new Promise(res => cv.toBlob(res, type, q));
  async function ogBlob(p){
    const cv = await draw(p, 'og');
    return toBlob(cv, 'image/jpeg', .92);      // ~100 KB: well inside the 400 KB limit, and what WhatsApp/Facebook like
  }

  window.SkillView = { html, mount, esc, avatarSrc, hostOf, LEVELS, BADGES, THEMES, bn, initials };
  window.SkillCanvas = { draw, ogBlob, urlOf };
})();
