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
    try{ await Promise.all([document.fonts.load('400 48px "Tiro Bangla"'), document.fonts.load('400 48px "Great Vibes"'), document.fonts.load('700 48px Cinzel'), document.fonts.load('400 48px "Mrs Saint Delafield"'), document.fonts.load('italic 600 28px "Cormorant Garamond"'), document.fonts.load('700 24px "Cormorant Garamond"'), document.fonts.load('800 48px "Hind Siliguri"'), document.fonts.load('600 28px "Hind Siliguri"'), document.fonts.load('400 24px "Hind Siliguri"'), document.fonts.load('800 48px Inter'), document.fonts.load('500 24px Inter')]); }catch(e){}
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

  /* ---- সনদ: a certificate in the style of a real one: paper grain, guilloche border and rosettes, embossed seal
     with ribbons, serif Bangla type, a hand signature. It is plainly marked self-issued, not an official document. ---- */
  const NAVY = '#1B2A5A', GOLD = '#B8893B', GOLD2 = '#E3C275', PAPER = '#FBF7EC', INKM = '#59627E', INK = '#1F2F6B';
  const SERIF = '"Tiro Bangla","Hind Siliguri",serif', LSERIF = '"Cormorant Garamond",Georgia,serif', SIGN = '"Great Vibes","Snell Roundhand","Segoe Script","Brush Script MT",cursive';
  const certNo = u => { let h = 7; for(const ch of String(u || 'x')) h = (h * 31 + ch.charCodeAt(0)) % 900000; return 'SK-' + String(h + 100000); };
  const bnDate = d => { try{ return new Date(d || Date.now()).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }); }catch(e){ return ''; } };
  const spaced = (c, v) => { try{ c.letterSpacing = v; }catch(e){} };
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  let NOISE = null;
  function noisePattern(c){
    if(!NOISE){
      const n = document.createElement('canvas'); n.width = n.height = 256; const x = n.getContext('2d'), im = x.createImageData(256, 256), d = im.data;
      for(let i = 0; i < d.length; i += 4){ const v = Math.random(); d[i] = 120; d[i + 1] = 92; d[i + 2] = 48; d[i + 3] = v > .8 ? Math.floor((v - .8) * 95) : 0; }
      x.putImageData(im, 0, 0); NOISE = n;
    }
    return c.createPattern(NOISE, 'repeat');
  }
  function diamond(c, x, y, r, col){ c.fillStyle = col; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); c.fill(); }
  function orn(c, cx, y, w){
    const g = c.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); g.addColorStop(0, 'rgba(184,137,59,0)'); g.addColorStop(.5, GOLD); g.addColorStop(1, 'rgba(184,137,59,0)');
    c.fillStyle = g; c.fillRect(cx - w / 2, y - 1, w, 2); diamond(c, cx, y, 7, GOLD); diamond(c, cx - 26, y, 3.5, GOLD); diamond(c, cx + 26, y, 3.5, GOLD);
  }
  // a rosette (hypotrochoid): the engraved wheel pattern seen on banknotes and degree certificates
  function rosette(c, cx, cy, size, R, r, d, col, lw){
    const turns = r / gcd(R, r), sc = size / (R - r + d), steps = 1600;
    c.beginPath();
    for(let i = 0; i <= steps; i++){ const t = i / steps * Math.PI * 2 * turns, x = (R - r) * Math.cos(t) + d * Math.cos((R - r) / r * t), y = (R - r) * Math.sin(t) - d * Math.sin((R - r) / r * t); if(i) c.lineTo(cx + x * sc, cy + y * sc); else c.moveTo(cx + x * sc, cy + y * sc); }
    c.strokeStyle = col; c.lineWidth = lw; c.stroke();
  }
  function strands(c, len, w, n, A, f, a, b, lw){
    for(let s = 0; s < n; s++){
      c.beginPath();
      for(let x = 0; x <= len; x += 3){ const y = w / 2 + Math.sin(x * f + s * Math.PI * 2 / n) * A; if(x) c.lineTo(x, y); else c.moveTo(x, y); }
      c.strokeStyle = s % 2 ? b : a; c.lineWidth = lw; c.stroke();
    }
  }
  function band(c, len, w){
    c.fillStyle = 'rgba(27,42,90,.04)'; c.fillRect(0, 0, len, w);
    strands(c, len, w, 8, w * .36, .052, 'rgba(27,42,90,.55)', 'rgba(184,137,59,.8)', 1.1);
    strands(c, len, w, 8, w * .2, -.105, 'rgba(27,42,90,.28)', 'rgba(184,137,59,.45)', .8);
  }
  function certFrame(c, W, H){
    const m = 34, th = 12, bw = 44, b0 = m + th;
    c.strokeStyle = NAVY; c.lineWidth = th; c.strokeRect(m + th / 2, m + th / 2, W - m * 2 - th, H - m * 2 - th);
    c.save(); c.translate(b0, b0); band(c, W - b0 * 2, bw); c.restore();
    c.save(); c.translate(b0, H - b0 - bw); band(c, W - b0 * 2, bw); c.restore();
    c.save(); c.translate(b0, H - b0); c.rotate(-Math.PI / 2); band(c, H - b0 * 2, bw); c.restore();
    c.save(); c.translate(W - b0, b0); c.rotate(Math.PI / 2); band(c, H - b0 * 2, bw); c.restore();
    [[b0, b0], [W - b0 - bw, b0], [b0, H - b0 - bw], [W - b0 - bw, H - b0 - bw]].forEach(([x, y]) => {
      c.fillStyle = PAPER; c.fillRect(x, y, bw, bw);
      c.strokeStyle = GOLD; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, bw - 2, bw - 2);
      rosette(c, x + bw / 2, y + bw / 2, bw * .44, 11, 4, 6, 'rgba(27,42,90,.75)', 1); rosette(c, x + bw / 2, y + bw / 2, bw * .3, 9, 5, 4, 'rgba(184,137,59,.9)', 1);
    });
    const i1 = b0 + bw + 6;
    c.strokeStyle = GOLD; c.lineWidth = 2.5; c.strokeRect(i1, i1, W - i1 * 2, H - i1 * 2);
    c.strokeStyle = 'rgba(27,42,90,.6)'; c.lineWidth = 1.2; c.strokeRect(i1 + 7, i1 + 7, W - (i1 + 7) * 2, H - (i1 + 7) * 2);
  }
  function certPaper(c, W, H){
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#FEFBF2'); g.addColorStop(.5, PAPER); g.addColorStop(1, '#F3ECD8');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = noisePattern(c); c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(120,92,48,.05)'; c.lineWidth = 1;                                  // paper fibres
    for(let i = 0; i < 260; i++){ const x = Math.random() * W, y = Math.random() * H, a = Math.random() * Math.PI, l = 8 + Math.random() * 26; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * .5, y + Math.sin(a) * l * .8, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
    const v = c.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .95); v.addColorStop(0, 'rgba(120,90,40,0)'); v.addColorStop(1, 'rgba(120,90,40,.16)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  }
  function seal(c, x, y, r){
    // ribbon tails
    [-1, 1].forEach(dir => {
      const g = c.createLinearGradient(x, y, x + dir * r, y + r * 1.5); g.addColorStop(0, '#2E4290'); g.addColorStop(1, '#16224F');
      c.save(); c.shadowColor = 'rgba(20,20,50,.35)'; c.shadowBlur = r * .15; c.shadowOffsetY = r * .05;
      c.fillStyle = g; c.beginPath(); c.moveTo(x + dir * r * .08, y + r * .5); c.lineTo(x + dir * r * .62, y + r * .46); c.lineTo(x + dir * r * .84, y + r * 1.28); c.lineTo(x + dir * r * .62, y + r * 1.12); c.lineTo(x + dir * r * .38, y + r * 1.34); c.closePath(); c.fill(); c.restore();
      c.strokeStyle = 'rgba(227,194,117,.9)'; c.lineWidth = Math.max(1.5, r * .025); c.beginPath(); c.moveTo(x + dir * r * .62, y + r * .46); c.lineTo(x + dir * r * .84, y + r * 1.28); c.stroke();
    });
    const n = 38, g = c.createRadialGradient(x - r * .35, y - r * .35, r * .1, x, y, r * 1.02);
    g.addColorStop(0, '#FBEBB8'); g.addColorStop(.45, '#E0BC6A'); g.addColorStop(1, '#9C7430');
    c.save(); c.shadowColor = 'rgba(70,48,8,.45)'; c.shadowBlur = r * .3; c.shadowOffsetY = r * .1;
    c.beginPath(); for(let i = 0; i < n * 2; i++){ const a = Math.PI * i / n, rad = i % 2 ? r * .94 : r; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } c.closePath(); c.fillStyle = g; c.fill(); c.restore();
    c.strokeStyle = 'rgba(110,75,15,.55)'; c.lineWidth = Math.max(1, r * .02);
    for(let i = 0; i < 72; i++){ const a = Math.PI * 2 * i / 72; c.beginPath(); c.moveTo(x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8); c.lineTo(x + Math.cos(a) * r * .86, y + Math.sin(a) * r * .86); c.stroke(); }
    const g2 = c.createRadialGradient(x - r * .25, y - r * .3, r * .05, x, y, r * .72); g2.addColorStop(0, '#F6E2A2'); g2.addColorStop(1, '#CFA64F');
    c.fillStyle = g2; c.beginPath(); c.arc(x, y, r * .72, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = Math.max(1.5, r * .03); c.beginPath(); c.arc(x, y, r * .72, Math.PI * 1.05, Math.PI * 1.6); c.stroke();
    c.strokeStyle = 'rgba(110,75,15,.5)'; c.lineWidth = Math.max(1, r * .02); c.beginPath(); c.arc(x, y, r * .72, Math.PI * .05, Math.PI * .6); c.stroke();
    // text round the rim (Latin only: Bangla conjuncts must not be split letter by letter)
    const t = 'CERTIFICATE OF SKILL  ✦  SELF-ISSUED  ✦  CERTIFICATE OF SKILL  ✦  SELF-ISSUED  ✦  ', rad = r * .6; c.fillStyle = 'rgba(27,42,90,.92)'; c.font = '700 ' + Math.max(8, Math.round(r * .125)) + 'px Inter,sans-serif'; c.textAlign = 'center';
    const step = Math.PI * 2 / t.length; for(let i = 0; i < t.length; i++){ c.save(); c.translate(x, y); c.rotate(i * step - Math.PI / 2); c.fillText(t[i], 0, -rad); c.restore(); }
    c.fillStyle = NAVY; c.beginPath(); const sr = r * .15, sy = y - r * .26; c.moveTo(x, sy - sr); c.quadraticCurveTo(x, sy, x + sr, sy); c.quadraticCurveTo(x, sy, x, sy + sr); c.quadraticCurveTo(x, sy, x - sr, sy); c.quadraticCurveTo(x, sy, x, sy - sr); c.fill();
    c.font = '700 ' + Math.round(r * .21) + 'px ' + LSERIF; spaced(c, '1px'); c.fillText('SELF-ISSUED', x, y + r * .16); spaced(c, '0px');
    c.font = '600 ' + Math.round(r * .11) + 'px Inter,sans-serif'; spaced(c, '2px'); c.fillText('SKILL', x, y + r * .38); spaced(c, '0px');
    c.textAlign = 'left';
  }
  const isLatin = s => /^[\x00-\x7F\s]+$/.test(s);
  function signature(c, name, x, y, maxW){
    const first = (name.split(' ')[0] || name).slice(0, 16);
    c.fillStyle = INK;
    if(isLatin(first)){ const s = fit(c, first, '400', HAND, 74, 34, maxW); c.fillText(first, x, y); }
    else { c.save(); c.translate(x, y); c.transform(1, 0, -.22, 1, 0, 0); const s = fit(c, first, '700', BODY, 46, 26, maxW); c.fillText(first, 0, 0); c.restore(); }
  }
  const SCRIPT = '"Great Vibes","Snell Roundhand","Segoe Script","Brush Script MT",cursive';
  const CAPS = '"Cinzel","Cormorant Garamond",Georgia,serif';
  const HAND = '"Mrs Saint Delafield","Great Vibes","Segoe Script","Brush Script MT",cursive';
  const enDate = d => { try{ return new Date(d || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }catch(e){ return ''; } };
  function foil(c, x0, x1){
    const g = c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, '#8A6420'); g.addColorStop(.22, '#EBD08A'); g.addColorStop(.5, '#B8893B'); g.addColorStop(.78, '#F2DCA2'); g.addColorStop(1, '#8A6420');
    return g;
  }
  function flourish(c, cx, y, w){
    c.save(); c.strokeStyle = GOLD; c.lineWidth = 2; c.lineCap = 'round';
    [-1, 1].forEach(d => {
      c.beginPath(); c.moveTo(cx + d * 20, y); c.bezierCurveTo(cx + d * w * .18, y - 16, cx + d * w * .34, y + 16, cx + d * w * .5, y); c.stroke();
      c.beginPath(); c.arc(cx + d * (w * .5 + 12), y, 5.5, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(cx + d * w * .5 + d * 22, y); c.lineTo(cx + d * w * .5 + d * 90, y); c.stroke();
    });
    c.restore(); diamond(c, cx, y, 8, GOLD);
  }
  // gold ribbon banner with folded ends (y is its top edge)
  function banner(c, cx, y, w, h){
    const tail = 44, fold = 16, ty = y + 14;
    [-1, 1].forEach(d => {
      const x0 = cx + d * w / 2;
      c.fillStyle = '#A07A2A'; c.beginPath(); c.moveTo(x0, ty); c.lineTo(x0 + d * (tail + 18), ty); c.lineTo(x0 + d * tail, ty + h / 2); c.lineTo(x0 + d * (tail + 18), ty + h); c.lineTo(x0, ty + h); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(80,55,10,.45)'; c.lineWidth = 1.2; c.stroke();
      c.fillStyle = '#6E5016'; c.beginPath(); c.moveTo(x0, y + h); c.lineTo(x0, ty + h); c.lineTo(x0 - d * fold, y + h); c.closePath(); c.fill();
    });
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#F1DA9E'); g.addColorStop(.5, '#D5AC55'); g.addColorStop(1, '#B8893B');
    c.save(); c.shadowColor = 'rgba(80,55,10,.35)'; c.shadowBlur = 8; c.shadowOffsetY = 3; c.fillStyle = g; c.fillRect(cx - w / 2, y, w, h); c.restore();
    c.strokeStyle = 'rgba(27,42,90,.55)'; c.lineWidth = 1.5; c.strokeRect(cx - w / 2 + 5, y + 5, w - 10, h - 10);
  }
  async function drawCert(p, W, H, logo){
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    certPaper(c, W, H);
    c.save(); c.globalAlpha = .085; rosette(c, W / 2, H / 2 + 30, 360, 17, 6, 9, NAVY, 1); c.globalAlpha = .06; rosette(c, W / 2, H / 2 + 30, 250, 13, 5, 8, GOLD, 1.2); c.restore();
    certFrame(c, W, H);
    const cx = W / 2, name = (p.display_name || 'Your Name').trim(), skills = (p.skills || []).slice(0, 6);
    c.textAlign = 'center';
    // title: engraved capitals (Cinzel) over a gold ribbon banner; the name below is script, so the two never look alike
    c.save(); c.shadowColor = 'rgba(184,137,59,.55)'; c.shadowOffsetX = 2.5; c.shadowOffsetY = 3; c.shadowBlur = 0;
    c.fillStyle = NAVY; c.font = '700 98px ' + CAPS; spaced(c, '16px'); c.fillText('CERTIFICATE', cx + 8, 232); spaced(c, '0px'); c.restore();
    banner(c, cx, 262, 400, 50);
    c.fillStyle = NAVY; c.font = '700 27px ' + CAPS; spaced(c, '15px'); c.fillText('OF SKILL', cx + 7, 297); spaced(c, '0px');
    c.fillStyle = INKM; c.font = '500 21px ' + CAPS; spaced(c, '5px'); c.fillText('THIS CERTIFICATE IS PROUDLY PRESENTED TO', cx + 2, 378); spaced(c, '0px');
    c.fillStyle = NAVY; const fs = fit(c, name, '400', SCRIPT, 126, 62, 1040); c.fillText(name, cx, 378 + 22 + fs * .74);
    let y = 378 + 22 + fs * .74 + 24; const g = c.createLinearGradient(cx - 360, 0, cx + 360, 0); g.addColorStop(0, 'rgba(184,137,59,0)'); g.addColorStop(.5, GOLD); g.addColorStop(1, 'rgba(184,137,59,0)'); c.fillStyle = g; c.fillRect(cx - 360, y, 720, 2.5);
    y += 46; c.fillStyle = INKM; c.font = 'italic 600 34px ' + LSERIF; for(const ln of wrap(c, p.headline || '', 960, 1)) c.fillText(ln, cx, y);
    y += 48; c.fillStyle = INKM; c.font = 'italic 500 27px ' + LSERIF; c.fillText('in recognition of real, hands-on skill in', cx, y);
    y += 18; c.textAlign = 'left';
    skills.forEach((s, k) => {
      const col = k % 2, row = Math.floor(k / 2), x = col ? 850 : 290, yy = y + 36 + row * 46;
      diamond(c, x, yy - 10, 6, GOLD); c.fillStyle = NAVY; c.font = '700 31px ' + LSERIF; c.fillText(s.n.length > 24 ? s.n.slice(0, 23) + '…' : s.n, x + 22, yy);
      const l = Math.max(1, Math.min(4, Number(s.l) || 2));
      for(let d = 0; d < 4; d++){ c.beginPath(); c.arc(x + 400 - d * 24, yy - 9, 7.5, 0, Math.PI * 2); c.fillStyle = (3 - d) < l ? GOLD : 'rgba(27,42,90,.14)'; c.fill(); if((3 - d) < l){ c.strokeStyle = 'rgba(120,80,10,.5)'; c.lineWidth = 1; c.stroke(); } }
    });
    // footer: QR | date | seal | signature
    const by = H - 318; c.textAlign = 'center';
    const hasQR = qr(c, 150, by + 28, 120, SITE + '/s/' + (p.username || '') + '?ref=cert', NAVY, '#FFFFFF');
    if(hasQR){ c.fillStyle = INKM; c.font = '600 17px ' + LSERIF; spaced(c, '1px'); c.fillText('SCAN TO VIEW WORK', 150 + 60, by + 180); spaced(c, '0px'); }
    c.fillStyle = NAVY; c.font = '700 28px ' + LSERIF; c.fillText(enDate(p.published_at), 530, by + 92);
    c.fillStyle = 'rgba(27,42,90,.7)'; c.fillRect(400, by + 108, 260, 1.5); c.fillStyle = INKM; c.font = '600 18px ' + LSERIF; spaced(c, '4px'); c.fillText('DATE', 530, by + 136); spaced(c, '0px');
    seal(c, cx, by + 62, 78);
    c.textAlign = 'center'; signature(c, name, 1070, by + 82, 250);
    c.fillStyle = 'rgba(27,42,90,.7)'; c.fillRect(940, by + 108, 260, 1.5); c.fillStyle = INKM; c.font = '600 18px ' + LSERIF; spaced(c, '4px'); c.fillText('ISSUED BY  ·  SELF', 1070, by + 136); spaced(c, '0px');
    c.fillStyle = INKM; c.font = 'italic 500 21px ' + LSERIF; c.fillText('Self-issued by the holder  ·  not verified by Protishthan', cx, H - 130);
    c.font = '600 16px Inter,sans-serif'; c.fillStyle = GOLD; spaced(c, '1px'); c.fillText(urlOf(p) + '   ·   ' + certNo(p.username), cx, H - 106); spaced(c, '0px');
    return cv;
  }
  // the link-preview picture: the certificate shown slightly tilted on a dark backdrop, with a line that makes people want one
  async function drawCertOg(p, logo){
    const W = 1200, H = 630, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0A1230'); bg.addColorStop(1, '#1B2A66'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const gl = c.createRadialGradient(820, 300, 20, 820, 300, 520); gl.addColorStop(0, 'rgba(227,194,117,.35)'); gl.addColorStop(1, 'rgba(227,194,117,0)'); c.fillStyle = gl; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,.04)'; c.lineWidth = 1; for(let x = 0; x < W; x += 56){ c.beginPath(); c.moveTo(x + .5, 0); c.lineTo(x + .5, H); c.stroke(); } for(let y = 0; y < H; y += 56){ c.beginPath(); c.moveTo(0, y + .5); c.lineTo(W, y + .5); c.stroke(); }
    const cert = await drawCert(p, 1600, 1131, logo);
    c.save(); c.translate(805, 318); c.rotate(-.04); c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 46; c.shadowOffsetY = 22; c.drawImage(cert, -380, -269, 760, 538); c.restore();
    brand(c, logo, 56, 50, 40, { ink: '#FFFFFF' });
    const name = p.display_name || 'আপনার নাম';
    c.fillStyle = GOLD2; c.font = '700 17px ' + LSERIF; spaced(c, '3px'); c.fillText('SELF-ISSUED SKILL CERTIFICATE', 56, 200); spaced(c, '0px');
    c.fillStyle = '#FFFFFF'; const fs = fit(c, name, '400', SCRIPT, 74, 40, 350); let yy = 200 + 16 + fs * .8; c.fillText(name, 56, yy);
    c.fillStyle = '#B7C4EE'; c.font = 'italic 600 28px ' + LSERIF; yy += 14; for(const ln of wrap(c, p.headline || '', 340, 3)){ yy += 36; c.fillText(ln, 56, yy); }
    const px = 56, py = H - 124, ph = 52, label = 'আপনারটাও বানান', pw = 250;
    const pg = c.createLinearGradient(px, 0, px + pw, 0); pg.addColorStop(0, '#E3C275'); pg.addColorStop(1, '#C99A3F'); c.fillStyle = pg; rr(c, px, py, pw, ph, 26); c.fill();
    c.fillStyle = '#1B2A5A'; c.font = '800 21px ' + BODY; c.textAlign = 'center'; c.fillText(label + '  →', px + pw / 2, py + 34); c.textAlign = 'left';
    c.fillStyle = '#93A3D6'; c.font = '600 19px Inter,sans-serif'; c.fillText('protishthan.com/skill', 56, H - 40);
    return cv;
  }

  // a 4:5 post picture for Facebook / Instagram: brand on top, the whole certificate in the middle, the person's own lines above and below
  async function drawPost(p, logo){
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0A1230'); bg.addColorStop(1, '#1B2A66'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const gl = c.createRadialGradient(W / 2, 640, 30, W / 2, 640, 760); gl.addColorStop(0, 'rgba(227,194,117,.30)'); gl.addColorStop(1, 'rgba(227,194,117,0)'); c.fillStyle = gl; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,.04)'; c.lineWidth = 1; for(let x = 0; x < W; x += 54){ c.beginPath(); c.moveTo(x + .5, 0); c.lineTo(x + .5, H); c.stroke(); } for(let y = 0; y < H; y += 54){ c.beginPath(); c.moveTo(0, y + .5); c.lineTo(W, y + .5); c.stroke(); }
    brand(c, logo, 64, 50, 56, { ink: '#FFFFFF' });
    const n = (p.skills || []).length, label = bn(n) + 'টি স্কিল'; c.font = '700 27px ' + BODY; const pw = c.measureText(label).width + 48;
    const pg = c.createLinearGradient(W - 64 - pw, 0, W - 64, 0); pg.addColorStop(0, '#E3C275'); pg.addColorStop(1, '#C99A3F'); c.fillStyle = pg; rr(c, W - 64 - pw, 56, pw, 50, 25); c.fill();
    c.fillStyle = NAVY; c.textAlign = 'center'; c.fillText(label, W - 64 - pw / 2, 90);
    const top = (p.post_top || 'আমার স্কিলই আমার সনদ').trim();
    c.fillStyle = '#FFFFFF'; c.strokeStyle = '#FFFFFF'; c.lineWidth = 1.4; const ts = fit(c, top, '400', SERIF, 66, 34, W - 140); c.strokeText(top, W / 2, 218); c.fillText(top, W / 2, 218);
    orn(c, W / 2, 252, 420);
    const cert = await drawCert(p, 1600, 1131, logo), cw = 968, ch = Math.round(cw * 1131 / 1600), cx = (W - cw) / 2, cy = 296;
    c.save(); c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 50; c.shadowOffsetY = 24; c.drawImage(cert, cx, cy, cw, ch); c.restore();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.strokeRect(cx, cy, cw, ch);
    const bot = (p.post_bottom || 'কাগজের সনদ নয়, কাজের সনদ').trim(), by = cy + ch + 84;
    c.fillStyle = GOLD2; c.strokeStyle = GOLD2; c.lineWidth = 1; fit(c, bot, '400', SERIF, 50, 28, W - 140); c.fillText(bot, W / 2, by);
    const url = urlOf(p); c.font = '700 33px Inter,sans-serif'; const uw = c.measureText(url).width + 84, ux = (W - uw) / 2, uy = by + 40;
    c.fillStyle = 'rgba(255,255,255,.1)'; rr(c, ux, uy, uw, 74, 37); c.fill(); c.strokeStyle = 'rgba(227,194,117,.8)'; c.lineWidth = 2; rr(c, ux, uy, uw, 74, 37); c.stroke();
    c.fillStyle = '#FFFFFF'; c.fillText(url, W / 2, uy + 49);
    c.fillStyle = '#93A3D6'; c.font = '500 25px ' + BODY; c.fillText('আপনারটাও বানান: protishthan.com/skill (ফ্রি, ৩ মিনিটে)', W / 2, H - 44);
    c.textAlign = 'left';
    return cv;
  }

  async function draw(p, kind){
    if(kind === 'post'){ await fonts(); const logo = await loadImg('/logo-sm.webp'); return drawPost(p, logo); }
    if(kind === 'cert' || kind === 'certog'){ await fonts(); const logo = await loadImg('/logo-sm.webp'); return kind === 'cert' ? drawCert(p, 1600, 1131, logo) : drawCertOg(p, logo); }
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
    const cv = await draw(p, 'certog');       // the link preview is the certificate
    let b = await toBlob(cv, 'image/jpeg', .9);
    if(b && b.size > 380000) b = await toBlob(cv, 'image/jpeg', .78);   // keep it well inside the 400 KB limit
    return b;
  }

  window.SkillView = { html, mount, esc, avatarSrc, hostOf, LEVELS, BADGES, THEMES, bn, initials };
  window.SkillCanvas = { draw, ogBlob, urlOf };
})();
