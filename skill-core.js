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

  /* ---- সনদ: a certificate-style card. Classic paper, navy and gold. It is plainly marked self-issued. ---- */
  const NAVY = '#1B2A5A', GOLD = '#B8893B', GOLD2 = '#E3C275', PAPER = '#FBF7EC', INKM = '#5B6580';
  const certNo = u => { let h = 7; for(const ch of String(u || 'x')) h = (h * 31 + ch.charCodeAt(0)) % 900000; return 'SK-' + String(h + 100000); };
  const bnDate = d => { try{ return new Date(d || Date.now()).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }); }catch(e){ return ''; } };
  function spaced(c, v){ try{ c.letterSpacing = v; }catch(e){} }
  function diamond(c, x, y, r, col){ c.fillStyle = col; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); c.fill(); }
  function orn(c, cx, y, w){
    const g = c.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); g.addColorStop(0, 'rgba(184,137,59,0)'); g.addColorStop(.5, GOLD); g.addColorStop(1, 'rgba(184,137,59,0)');
    c.fillStyle = g; c.fillRect(cx - w / 2, y - 1, w, 2); diamond(c, cx, y, 7, GOLD);
  }
  function seal(c, x, y, r){
    const n = 30, g = c.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r);
    g.addColorStop(0, '#F3DA9C'); g.addColorStop(.55, GOLD2); g.addColorStop(1, '#9C7430');
    c.save(); c.shadowColor = 'rgba(80,55,10,.35)'; c.shadowBlur = r * .25; c.shadowOffsetY = r * .08;
    c.beginPath();
    for(let i = 0; i < n * 2; i++){ const a = Math.PI * i / n, rad = i % 2 ? r * .93 : r; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    c.closePath(); c.fillStyle = g; c.fill(); c.restore();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = Math.max(1.5, r * .03); c.beginPath(); c.arc(x, y, r * .74, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(110,75,15,.5)'; c.beginPath(); c.arc(x, y, r * .66, 0, Math.PI * 2); c.stroke();
    // four-point star
    c.fillStyle = NAVY; c.beginPath(); const sr = r * .2, sy = y - r * .34;
    c.moveTo(x, sy - sr); c.quadraticCurveTo(x, sy, x + sr, sy); c.quadraticCurveTo(x, sy, x, sy + sr); c.quadraticCurveTo(x, sy, x - sr, sy); c.quadraticCurveTo(x, sy, x, sy - sr); c.fill();
    c.textAlign = 'center'; c.fillStyle = NAVY;
    c.font = '800 ' + Math.round(r * .3) + 'px ' + HEAD; c.fillText('স্ব-ঘোষিত', x, y + r * .16);
    c.font = '700 ' + Math.round(r * .15) + 'px Inter,sans-serif'; spaced(c, Math.round(r * .03) + 'px'); c.fillText('SELF-ISSUED', x, y + r * .42); spaced(c, '0px');
    c.textAlign = 'left';
  }
  function frame(c, W, H, m){
    c.strokeStyle = NAVY; c.lineWidth = Math.round(H * .011); c.strokeRect(m, m, W - m * 2, H - m * 2);
    c.strokeStyle = GOLD; c.lineWidth = Math.max(2, H * .0028); c.strokeRect(m + H * .026, m + H * .026, W - (m + H * .026) * 2, H - (m + H * .026) * 2);
    c.strokeStyle = 'rgba(27,42,90,.55)'; c.lineWidth = 1.2; c.strokeRect(m + H * .036, m + H * .036, W - (m + H * .036) * 2, H - (m + H * .036) * 2);
    const o = m + H * .026, r = H * .034;
    [[o, o, 0], [W - o, o, 1], [W - o, H - o, 2], [o, H - o, 3]].forEach(([x, y, k]) => {
      c.save(); c.translate(x, y); c.rotate(k * Math.PI / 2); c.fillStyle = PAPER; c.beginPath(); c.moveTo(0, 0); c.lineTo(r, 0); c.arc(0, 0, r, 0, Math.PI / 2); c.closePath(); c.fill();
      c.strokeStyle = GOLD; c.lineWidth = Math.max(2, H * .0028); c.beginPath(); c.arc(0, 0, r, 0, Math.PI / 2); c.stroke();
      c.strokeStyle = NAVY; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, r * .6, 0, Math.PI / 2); c.stroke(); c.restore();
    });
  }
  function paper(c, W, H){
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#FDFAF1'); g.addColorStop(.5, PAPER); g.addColorStop(1, '#F4EEDD');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(184,137,59,.07)'; c.lineWidth = 1;                              // fine security-print waves
    for(let k = 0; k < 9; k++){ c.beginPath(); for(let x = 0; x <= W; x += 8){ const y = H * .5 + Math.sin(x / (W * .045) + k * .7) * H * .12 + (k - 4) * H * .035; if(x === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); }
  }
  async function drawCert(p, W, H, logo){
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const big = W >= 1500, S = W / (big ? 1600 : 1200);
    paper(c, W, H);
    c.save(); c.globalAlpha = .035; c.fillStyle = NAVY; c.font = '800 ' + Math.round(H * .42) + 'px ' + HEAD; c.textAlign = 'center'; c.translate(W / 2, H * .66); c.rotate(-.12); c.fillText('স্কিল', 0, 0); c.restore();
    frame(c, W, H, Math.round(H * (big ? .032 : .035)));
    c.textAlign = 'center';
    const skills = (p.skills || []).slice(0, big ? 6 : 4), lv = ['শিখছি', 'মোটামুটি', 'দক্ষ', 'বিশেষজ্ঞ'];
    const cx = W / 2, name = p.display_name || 'আপনার নাম';
    if(big){
      c.fillStyle = NAVY; c.font = '800 80px ' + HEAD; c.fillText('দক্ষতার সনদ', cx, 205);
      c.fillStyle = GOLD; c.font = '700 23px Georgia,serif'; spaced(c, '9px'); c.fillText('CERTIFICATE OF SKILL', cx, 252); spaced(c, '0px');
      orn(c, cx, 290, 560);
      c.fillStyle = INKM; c.font = '500 30px ' + BODY; c.fillText('এই মর্মে ঘোষণা করা যাচ্ছে যে', cx, 352);
      c.fillStyle = NAVY; const fs = fit(c, name, 800, HEAD, 104, 54, 1100); c.fillText(name, cx, 352 + 24 + fs * .86);
      let y = 352 + 24 + fs * .86 + 20; c.fillStyle = GOLD; c.fillRect(cx - 360, y, 720, 2.5); y += 54;
      c.fillStyle = INKM; c.font = '500 33px ' + BODY; for(const ln of wrap(c, p.headline || '', 1000, 1)){ c.fillText(ln, cx, y); }
      y += 56; c.fillStyle = INKM; c.font = '500 27px ' + BODY; c.fillText('নিজের কাজ ও অভিজ্ঞতার মাধ্যমে নিচের দক্ষতাগুলো অর্জন করেছেন', cx, y);
      y += 30; c.textAlign = 'left';
      skills.forEach((s, k) => {
        const col = k % 2, row = Math.floor(k / 2), x = col ? 860 : 270, yy = y + 34 + row * 58;
        diamond(c, x, yy - 10, 6, GOLD); c.fillStyle = NAVY; c.font = '700 29px ' + BODY; c.fillText(s.n.length > 22 ? s.n.slice(0, 21) + '…' : s.n, x + 22, yy);
        const l = Math.max(1, Math.min(4, Number(s.l) || 2));
        for(let d = 0; d < 4; d++){ c.beginPath(); c.arc(x + 410 - d * 24 + 0, yy - 9, 7.5, 0, Math.PI * 2); c.fillStyle = (3 - d) < l ? GOLD : 'rgba(27,42,90,.14)'; c.fill(); }
      });
      // footer: QR | date | seal | signature
      const by = H - 322;
      c.textAlign = 'center';
      const hasQR = qr(c, 128, by + 24, 124, SITE + '/s/' + (p.username || '') + '?ref=cert', NAVY, '#FFFFFF');
      if(hasQR){ c.fillStyle = INKM; c.font = '500 18px ' + BODY; c.fillText('কাজের প্রমাণ দেখুন', 128 + 62, by + 182); }
      c.fillStyle = NAVY; c.font = '700 28px ' + BODY; c.fillText(bnDate(p.published_at), 520, by + 98);
      c.fillStyle = NAVY; c.fillRect(380, by + 114, 280, 1.5); c.fillStyle = INKM; c.font = '500 20px ' + BODY; c.fillText('তারিখ', 520, by + 144);
      seal(c, cx, by + 96, 82);
      c.fillStyle = NAVY; c.font = 'italic 700 48px "Segoe Script","Brush Script MT","Lucida Handwriting",cursive'; const sg = fit(c, name.split(' ')[0] || name, 'italic 700', '"Segoe Script","Brush Script MT","Lucida Handwriting",cursive', 48, 28, 270); c.fillText(name.split(' ')[0] || name, 1090, by + 98);
      c.fillStyle = NAVY; c.fillRect(950, by + 114, 280, 1.5); c.fillStyle = INKM; c.font = '500 20px ' + BODY; c.fillText('ইস্যুকারী: আমি নিজে', 1090, by + 144);
      c.fillStyle = INKM; c.font = '500 19px ' + BODY; c.fillText('এই সনদ ব্যক্তি নিজে দিয়েছেন (স্ব-ঘোষিত); Protishthan যাচাই করেনি', cx, H - 116);
      c.font = '600 17px Inter,sans-serif'; c.fillStyle = GOLD; c.fillText(urlOf(p) + '   ·   ' + certNo(p.username), cx, H - 92);
    } else {
      // compact version, used as the link-preview picture (1200x630)
      c.fillStyle = NAVY; c.font = '800 54px ' + HEAD; c.fillText('দক্ষতার সনদ', cx, 120);
      c.fillStyle = GOLD; c.font = '700 17px Georgia,serif'; spaced(c, '7px'); c.fillText('CERTIFICATE OF SKILL', cx, 152); spaced(c, '0px');
      orn(c, cx, 180, 420);
      c.fillStyle = INKM; c.font = '500 22px ' + BODY; c.fillText('এই মর্মে ঘোষণা করা যাচ্ছে যে', cx, 222);
      c.fillStyle = NAVY; const fs = fit(c, name, 800, HEAD, 76, 44, 860); c.fillText(name, cx, 222 + 14 + fs * .86);
      let y = 222 + 14 + fs * .86 + 14; c.fillStyle = GOLD; c.fillRect(cx - 250, y, 500, 2); y += 38;
      c.fillStyle = INKM; c.font = '500 25px ' + BODY; for(const ln of wrap(c, p.headline || '', 820, 1)){ c.fillText(ln, cx, y); }
      y += 26; c.font = '700 22px ' + BODY;
      const chips = skills.slice(0, 4).map(s => s.n.length > 18 ? s.n.slice(0, 17) + '…' : s.n);
      let tw = 0; const ws = chips.map(t => { const w = c.measureText(t).width + 34; tw += w + 12; return w; }); tw -= 12; let px = cx - tw / 2;
      chips.forEach((t, k) => { c.fillStyle = 'rgba(184,137,59,.14)'; rr(c, px, y, ws[k], 40, 20); c.fill(); c.strokeStyle = GOLD; c.lineWidth = 1.5; rr(c, px, y, ws[k], 40, 20); c.stroke(); c.fillStyle = NAVY; c.fillText(t, px + ws[k] / 2, y + 27); px += ws[k] + 12; });
      seal(c, 1010, 478, 64);
      c.fillStyle = NAVY; c.font = 'italic 700 36px "Segoe Script","Brush Script MT","Lucida Handwriting",cursive'; c.fillText((name.split(' ')[0] || name).slice(0, 14), 190, 470);
      c.fillRect(100, 486, 220, 1.5); c.fillStyle = INKM; c.font = '500 17px ' + BODY; c.fillText('ইস্যুকারী: আমি নিজে', 210, 512);
      c.fillStyle = INKM; c.font = '500 16px ' + BODY; c.fillText('স্ব-ঘোষিত; Protishthan যাচাই করেনি  ·  ' + urlOf(p), cx, H - 62);
    }
    return cv;
  }

  async function draw(p, kind){
    if(kind === 'cert' || kind === 'certog'){ await fonts(); const logo = await loadImg('/logo-sm.webp'); return drawCert(p, kind === 'cert' ? 1600 : 1200, kind === 'cert' ? 1131 : 630, logo); }
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
    return toBlob(cv, 'image/jpeg', .92);      // ~100 KB: well inside the 400 KB limit, and what WhatsApp/Facebook like
  }

  window.SkillView = { html, mount, esc, avatarSrc, hostOf, LEVELS, BADGES, THEMES, bn, initials };
  window.SkillCanvas = { draw, ogBlob, urlOf };
})();
