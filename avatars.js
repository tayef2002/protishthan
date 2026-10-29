/* Protishthan — illustrated avatars for the শিক্ষিত কার্ড (no photo needed).
   Dignified, realistic-proportion flat portraits drawn in code (SVG 290 x 330, the photo-slot ratio):
   nothing to upload, nothing to license, sharp at any size. window.ProtAvatars = { list, svg, dataUrl, SKINS }. */
(function(){
  'use strict';
  const SKINS = ['#F6D7BC', '#E8B890', '#CF9468', '#A9704A', '#74472A'];
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * k)) | 0, g = Math.min(255, Math.max(0, ((n >> 8) & 255) * k)) | 0, b = Math.min(255, Math.max(0, (n & 255) * k)) | 0; return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); };
  const HAIR = { black: '#1B1613', dark: '#2E1E14', brown: '#4B2F1D', grey: '#8B8F98' };

  /* head: an egg shape, narrower at the chin */
  const HEAD = 'M93 132C93 94 117 76 145 76C173 76 197 94 197 132C197 170 182 205 145 215C108 205 93 170 93 132Z';

  /* ---------- hair ---------- */
  const HAIRS = {
    short: c => ({ back: '', front: `<path d="M91 136C86 92 114 70 146 70C180 70 205 92 199 136C196 114 186 100 170 95C150 101 124 100 106 98C97 108 93 122 91 136Z" fill="${c}"/><path d="M112 88C128 80 156 80 176 90" stroke="${shade(c, 1.9)}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".35"/>` }),
    side:  c => ({ back: '', front: `<path d="M90 138C83 90 118 64 158 69C194 74 208 104 199 138C197 116 188 101 170 96C146 104 118 98 104 106C96 114 92 126 90 138Z" fill="${c}"/><path d="M104 100C128 84 160 82 184 98" stroke="${shade(c, 1.9)}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".35"/>` }),
    curly: c => { let s = ''; for(let i = 0; i < 12; i++){ const a = Math.PI * (1.06 + i * 0.077); s += `<circle cx="${145 + Math.cos(a) * 58}" cy="${124 + Math.sin(a) * 56}" r="19" fill="${c}"/>`; } return { back: '', front: s + `<path d="M98 112C118 98 172 98 192 112L192 100C170 88 120 88 98 100Z" fill="${c}"/>` }; },
    long:  c => ({ back: `<path d="M86 136C70 204 78 266 116 286L174 286C212 266 220 204 204 136Z" fill="${c}"/>`, front: `<path d="M91 138C88 92 116 72 146 72C178 72 204 92 199 138C190 114 172 102 148 104C124 104 100 114 91 138Z" fill="${c}"/><path d="M146 74C150 90 156 100 170 106" stroke="${shade(c, 1.8)}" stroke-width="3" fill="none" opacity=".3"/>` }),
    bun:   c => ({ back: `<circle cx="145" cy="60" r="24" fill="${c}"/>`, front: `<path d="M91 138C88 92 116 72 146 72C178 72 204 92 199 138C190 114 172 102 148 104C124 104 100 114 91 138Z" fill="${c}"/><rect x="128" y="76" width="34" height="7" rx="3.5" fill="${shade(c, 2.2)}"/>` }),
    pony:  c => ({ back: `<path d="M194 112C244 124 250 208 224 250C220 212 208 176 196 148Z" fill="${c}"/>`, front: `<path d="M91 138C88 92 116 72 146 72C178 72 204 92 199 138C190 114 172 102 148 104C124 104 100 114 91 138Z" fill="${c}"/>` }),
    bald:  () => ({ back: '', front: '' })
  };
  /* beard: stubble / short / full */
  const BEARD = {
    stubble: c => `<path d="M96 152C96 194 118 212 145 214C172 212 194 194 194 152C190 174 178 186 166 188C156 182 134 182 124 188C112 186 100 174 96 152Z" fill="${c}" opacity=".28"/>`,
    short:   c => `<path d="M95 148C94 196 118 216 145 218C172 216 196 196 195 148C191 172 180 184 168 186C158 180 132 180 122 186C110 184 99 172 95 148Z" fill="${c}"/><path d="M128 178C136 172 154 172 162 178C154 176 136 176 128 178Z" fill="${c}"/>`
  };

  /* ---------- outfits ---------- */
  const BODY = 'M12 330C12 278 56 252 112 246L178 246C234 252 278 278 278 330Z';
  const OUTFITS = {
    shirt:   (c, a) => `<path d="${BODY}" fill="#F8FAFC"/><path d="M120 246L145 286L128 252ZM170 246L145 286L162 252Z" fill="#E8EDF3" stroke="#CBD5E1" stroke-width="1.5"/>` + (a ? `<path d="M139 262H151L149 272H141Z" fill="${a}"/><path d="M141 272H149L154 322L145 330L136 322Z" fill="${a}"/>` : ''),
    blazer:  (c, a) => `<path d="${BODY}" fill="${c}"/><path d="M121 246L145 304L169 246Z" fill="#F8FAFC"/><path d="M110 248L142 308L118 330L74 330ZM180 248L148 308L172 330L216 330Z" fill="${shade(c, .76)}"/>` + (a ? `<path d="M140 266H150L148 276H142Z" fill="${a}"/><path d="M142 276H148L152 324L145 330L138 324Z" fill="${a}"/>` : ''),
    gown:    () => `<path d="${BODY}" fill="#1F1F25"/><path d="M121 246L98 330M169 246L192 330" stroke="#E8B923" stroke-width="12" stroke-linecap="round"/><path d="M121 246L145 288L169 246Z" fill="#F8FAFC"/>`,
    coat:    c => `<path d="${BODY}" fill="#F8FAFC"/><path d="M121 246L145 300L169 246Z" fill="${c}"/><path d="M110 248L142 308L118 330L74 330ZM180 248L148 308L172 330L216 330Z" fill="#E6ECF2"/><path d="M121 252C104 290 134 320 145 304C156 320 186 290 169 252" stroke="#334155" stroke-width="4.5" fill="none" stroke-linecap="round"/><circle cx="145" cy="306" r="7.5" fill="#94A3B8" stroke="#334155" stroke-width="3"/>`,
    hoodie:  c => `<path d="${BODY}" fill="${c}"/><path d="M100 252C112 232 178 232 190 252C174 264 116 264 100 252Z" fill="${shade(c, .8)}"/><path d="M134 262L132 300M156 262L158 300" stroke="#F1F5F9" stroke-width="3.5" stroke-linecap="round"/>`,
    tee:     c => `<path d="${BODY}" fill="${c}"/><path d="M122 246C130 268 160 268 168 246" fill="none" stroke="${shade(c, .72)}" stroke-width="4.5"/>`,
    panjabi: c => `<path d="${BODY}" fill="${c}"/><path d="M126 246L145 264L164 246" fill="none" stroke="${shade(c, .74)}" stroke-width="5"/><path d="M130 248L145 262L160 248" fill="none" stroke="#D4AF37" stroke-width="2.2"/><path d="M145 264L145 330" stroke="${shade(c, .8)}" stroke-width="2.6"/><circle cx="145" cy="280" r="3" fill="#D4AF37"/><circle cx="145" cy="300" r="3" fill="#D4AF37"/><circle cx="145" cy="320" r="3" fill="#D4AF37"/>`,
    saree:   c => `<path d="${BODY}" fill="${shade(c, .85)}"/><path d="M52 330L190 246L222 270L128 330Z" fill="${c}"/><path d="M52 330L190 246L200 254L76 330Z" fill="#E8B923"/><path d="M114 246C130 270 160 270 176 246" fill="none" stroke="${shade(c, .6)}" stroke-width="4.5"/>`,
    kameez:  c => `<path d="${BODY}" fill="${c}"/><path d="M120 246C130 272 160 272 170 246" fill="none" stroke="${shade(c, .7)}" stroke-width="4.5"/><path d="M130 252L145 270L160 252" fill="none" stroke="#E8B923" stroke-width="2"/>`
  };

  /* ---------- accessories ---------- */
  const ACC = {
    glasses:    () => `<g fill="rgba(255,255,255,.18)" stroke="#27272A" stroke-width="3.2"><rect x="103" y="127" width="40" height="29" rx="11"/><rect x="147" y="127" width="40" height="29" rx="11"/></g><path d="M143 138H147M103 134L94 130M187 134L196 130" stroke="#27272A" stroke-width="3.2" stroke-linecap="round"/>`,
    gradCap:    () => `<path d="M104 90V110Q145 128 186 110V90Q145 104 104 90Z" fill="#26262C"/><path d="M145 46L238 80L145 112L52 80Z" fill="#17171C"/><path d="M145 80L222 84V122" stroke="#E8B923" stroke-width="3.2" fill="none" stroke-linecap="round"/><circle cx="222" cy="126" r="5.5" fill="#E8B923"/>`,
    topi:       () => `<path d="M99 104C102 76 188 76 191 104L192 110C176 118 114 118 98 110Z" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/><path d="M118 100L127 93L136 100L127 107ZM154 100L163 93L172 100L163 107Z" fill="none" stroke="#9AA6B6" stroke-width="1.8"/><path d="M104 108Q145 118 186 108" stroke="#E2E8F0" stroke-width="2" fill="none"/>`,
    hardhat:    () => `<path d="M93 108C93 58 197 58 197 108Z" fill="#F5C518"/><rect x="83" y="106" width="124" height="10" rx="5" fill="#DDAA0B"/><rect x="139" y="66" width="12" height="40" fill="#DDAA0B" opacity=".6"/>`,
    headphones: () => `<path d="M93 132C88 66 202 66 197 132" stroke="#3F3F46" stroke-width="7" fill="none" stroke-linecap="round"/><rect x="82" y="124" width="17" height="34" rx="8" fill="#52525B"/><rect x="191" y="124" width="17" height="34" rx="8" fill="#52525B"/>`,
    book:       () => `<rect x="86" y="276" width="118" height="56" rx="5" fill="#1E4DB7"/><rect x="86" y="276" width="13" height="56" rx="4" fill="#173E96"/><rect x="108" y="288" width="78" height="6" rx="3" fill="#BFD2F8"/><rect x="108" y="302" width="52" height="6" rx="3" fill="#BFD2F8"/>`,
    dupatta:    c => `<path d="M64 270C62 200 80 130 100 112L112 118C98 150 92 196 98 262Z" fill="${c}"/><path d="M226 270C228 200 210 130 190 112L178 118C192 150 198 196 192 262Z" fill="${c}"/>`,
    stethoscope: () => ''
  };

  /* ---------- face ---------- */
  const eyes = (fem, lash) => {
    const eye = x => `<path d="M${x - 12} 138Q${x} 127 ${x + 12} 138Q${x} 147 ${x - 12} 138Z" fill="#fff"/><circle cx="${x}" cy="138" r="5.4" fill="#2B1B12"/><circle cx="${x + 1.8}" cy="136" r="1.7" fill="#fff"/><path d="M${x - 13} 137Q${x} 125 ${x + 13} 137" stroke="#1F1612" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    return eye(123) + eye(167) + (lash ? `<path d="M111 137L106 133M179 137L184 133" stroke="#1F1612" stroke-width="2.2" stroke-linecap="round"/>` : '');
  };
  const smile = (fem) => fem
    ? `<path d="M129 184Q145 196 161 184Q145 189 129 184Z" fill="#B8495F"/><path d="M131 184Q145 190 159 184" stroke="#9D3A50" stroke-width="2" fill="none" stroke-linecap="round"/>`
    : `<path d="M130 183Q145 193 160 183" stroke="#9A4A4A" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M137 189Q145 192 153 189" stroke="#C98B8B" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>`;

  /* ---------- builder ---------- */
  function svg(spec, skinIdx){
    const skin = SKINS[skinIdx == null ? 1 : skinIdx], sk2 = shade(skin, .84);
    const hairC = HAIR[spec.hairColor || 'black'];
    const hair = (HAIRS[spec.hair || 'short'] || HAIRS.short)(hairC);
    const hijab = spec.hijab, fem = !!spec.fem;
    const bg = spec.bg || ['#E0ECFF', '#C7DAFB'];
    let o = `<svg xmlns="http://www.w3.org/2000/svg" width="580" height="660" viewBox="0 0 290 330">`;
    o += `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs><rect width="290" height="330" fill="url(#bg)"/>`;
    o += `<circle cx="236" cy="54" r="48" fill="#fff" opacity=".2"/><circle cx="36" cy="226" r="64" fill="#fff" opacity=".12"/>`;
    if(spec.dupatta) o += ACC.dupatta(spec.dupatta);
    if(hijab) o += `<path d="M64 168C56 100 98 54 145 54C192 54 234 100 226 168C228 222 212 258 194 282L96 282C78 258 62 222 64 168Z" fill="${hijab}"/>`;
    else o += hair.back;
    o += (OUTFITS[spec.outfit || 'shirt'] || OUTFITS.shirt)(spec.outfitColor || '#1F3A68', spec.accent);
    if(hijab) o += `<path d="M62 266C80 296 112 306 145 306C178 306 210 296 228 266C206 252 176 248 145 248C114 248 84 252 62 266Z" fill="${shade(hijab, .9)}"/>`;
    o += `<path d="M127 196H163V246C156 258 134 258 127 246Z" fill="${shade(skin, .94)}"/><path d="M127 212Q145 232 163 212V196H127Z" fill="${sk2}" opacity=".7"/>`;
    if(!hijab) o += `<ellipse cx="92" cy="140" rx="7" ry="12" fill="${skin}"/><ellipse cx="198" cy="140" rx="7" ry="12" fill="${skin}"/>`;
    if(hijab) o += `<ellipse cx="145" cy="144" rx="53" ry="66" fill="${shade(hijab, .82)}"/><ellipse cx="145" cy="148" rx="46" ry="58" fill="${skin}"/>`;
    else o += `<path d="${HEAD}" fill="${skin}"/><path d="M197 132C197 170 182 205 145 215C176 200 188 170 188 132Z" fill="${shade(skin, .9)}" opacity=".45"/>`;
    if(!hijab) o += hair.front;
    if(spec.beard) o += BEARD[spec.beard](hairC);
    if(spec.blush) o += `<circle cx="110" cy="160" r="10" fill="#F08A9A" opacity=".22"/><circle cx="180" cy="160" r="10" fill="#F08A9A" opacity=".22"/>`;
    const browC = hijab ? '#3A3340' : shade(hairC, 1.05);
    o += fem
      ? `<path d="M107 125Q122 114 138 122M152 122Q168 114 183 125" stroke="${browC}" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : `<path d="M106 124Q122 114 139 122M151 122Q168 114 184 124" stroke="${browC}" stroke-width="4.4" fill="none" stroke-linecap="round"/>`;
    o += `<path d="M145 140C141 154 140 162 145 166C148 168 152 166 154 163" stroke="${shade(skin, .7)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    o += eyes(fem, fem);
    o += smile(fem);
    (spec.acc || []).forEach(a => { if(ACC[a]) o += ACC[a](); });
    return o + '</svg>';
  }
  const dataUrl = (spec, skinIdx) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(spec, skinIdx));

  /* ---------- the ready-made set ---------- */
  const B = (a, b) => [a, b];
  const list = [
    // professional
    { id: 'grad-m',    group: 'pro',     label: 'স্নাতক',            spec: { hair: 'short', outfit: 'gown', acc: ['gradCap'], bg: B('#E0ECFF', '#C7DAFB') } },
    { id: 'grad-f',    group: 'pro',     label: 'স্নাতক',            spec: { hair: 'long', fem: true, outfit: 'gown', acc: ['gradCap'], bg: B('#FBE4EF', '#F5C8DD') } },
    { id: 'grad-h',    group: 'pro',     label: 'হিজাবি স্নাতক',      spec: { hijab: '#6D4FC2', fem: true, outfit: 'gown', acc: ['gradCap'], bg: B('#ECE7FB', '#D9CFF5') } },
    { id: 'doctor-m',  group: 'pro',     label: 'ডাক্তার',            spec: { hair: 'side', outfit: 'coat', outfitColor: '#2A9D8F', bg: B('#D8F3EE', '#B4E6DE') } },
    { id: 'doctor-f',  group: 'pro',     label: 'ডাক্তার',            spec: { hair: 'bun', fem: true, outfit: 'coat', outfitColor: '#2A9D8F', bg: B('#DDEFFB', '#BADCF3') } },
    { id: 'doctor-h',  group: 'pro',     label: 'ডাক্তার',            spec: { hijab: '#1F6F78', fem: true, outfit: 'coat', outfitColor: '#2A9D8F', bg: B('#DFF3F4', '#BCE3E6') } },
    { id: 'teacher-m', group: 'pro',     label: 'শিক্ষক',             spec: { hair: 'side', hairColor: 'dark', beard: 'stubble', outfit: 'blazer', outfitColor: '#2F3E55', accent: '#9B2C2C', acc: ['glasses'], bg: B('#FBF0D2', '#F3DDA0') } },
    { id: 'teacher-f', group: 'pro',     label: 'শিক্ষিকা',           spec: { hair: 'bun', fem: true, outfit: 'blazer', outfitColor: '#7A2E52', acc: ['glasses'], bg: B('#FBE6EA', '#F4C9D2') } },
    { id: 'engineer',  group: 'pro',     label: 'ইঞ্জিনিয়ার',        spec: { hair: 'short', outfit: 'shirt', accent: '#2563EB', acc: ['hardhat'], bg: B('#FDEBD3', '#F8D3A3') } },
    { id: 'business',  group: 'pro',     label: 'উদ্যোক্তা',          spec: { hair: 'side', hairColor: 'dark', beard: 'short', outfit: 'blazer', outfitColor: '#1B2438', accent: '#2563EB', bg: B('#E3E7F8', '#C9D1F0') } },
    { id: 'scholar',   group: 'pro',     label: 'গবেষক',              spec: { hair: 'pony', fem: true, outfit: 'coat', outfitColor: '#5B63C7', acc: ['glasses'], bg: B('#EDE6F8', '#DCCFF0') } },
    { id: 'professor', group: 'pro',     label: 'অধ্যাপক',            spec: { hair: 'short', hairColor: 'grey', beard: 'short', outfit: 'blazer', outfitColor: '#3B3F4A', accent: '#7A2E2E', acc: ['glasses'], bg: B('#EEE8DC', '#DDD2BC') } },
    // traditional
    { id: 'panjabi',   group: 'trad',    label: 'পাঞ্জাবি',           spec: { hair: 'side', hairColor: 'dark', outfit: 'panjabi', outfitColor: '#EDE7DB', bg: B('#E3F1E6', '#C5E2CC') } },
    { id: 'panjabi-t', group: 'trad',    label: 'পাঞ্জাবি-টুপি',      spec: { hair: 'short', hairColor: 'dark', beard: 'short', outfit: 'panjabi', outfitColor: '#F3F0E8', acc: ['topi'], bg: B('#DDEFE2', '#B9DCC4') } },
    { id: 'panjabi-n', group: 'trad',    label: 'পাঞ্জাবি',           spec: { hair: 'short', outfit: 'panjabi', outfitColor: '#2E4A7D', bg: B('#E6ECF8', '#CBD7EE') } },
    { id: 'saree',     group: 'trad',    label: 'শাড়ি',              spec: { hair: 'bun', fem: true, outfit: 'saree', outfitColor: '#B3202F', blush: true, bg: B('#FBF1D3', '#F2DE9F') } },
    { id: 'kameez',    group: 'trad',    label: 'ওড়না',              spec: { hair: 'long', fem: true, outfit: 'kameez', outfitColor: '#3F8F72', dupatta: '#E8B923', bg: B('#E0F3EA', '#BDE3D0') } },
    { id: 'hijab-g',   group: 'trad',    label: 'হিজাব',              spec: { hijab: '#2F5D8A', fem: true, outfit: 'kameez', outfitColor: '#E8EEF5', bg: B('#E1EAF6', '#C4D5EA') } },
    // student
    { id: 'stu-m',     group: 'student', label: 'শিক্ষার্থী',         spec: { hair: 'short', outfit: 'hoodie', outfitColor: '#3D6FB6', acc: ['book'], bg: B('#E0ECFF', '#C7DAFB') } },
    { id: 'stu-f',     group: 'student', label: 'শিক্ষার্থী',         spec: { hair: 'long', hairColor: 'dark', fem: true, outfit: 'tee', outfitColor: '#E07A9A', acc: ['book'], blush: true, bg: B('#FBE4EF', '#F5C8DD') } },
    { id: 'stu-h',     group: 'student', label: 'শিক্ষার্থী',         spec: { hijab: '#8A5CC2', fem: true, outfit: 'tee', outfitColor: '#F3EAFB', acc: ['book'], bg: B('#EEE6F8', '#DCCCF0') } },
    { id: 'stu-g',     group: 'student', label: 'বইপ্রেমী',           spec: { hair: 'curly', outfit: 'tee', outfitColor: '#2F8F6B', acc: ['glasses', 'book'], bg: B('#DEF3E8', '#BDE5CF') } },
    { id: 'stu-music', group: 'student', label: 'সঙ্গীতপ্রেমী',       spec: { hair: 'side', hairColor: 'dark', outfit: 'hoodie', outfitColor: '#333B48', acc: ['headphones'], bg: B('#E3E7F2', '#C9D0E3') } }
  ];

  window.ProtAvatars = { list, svg, dataUrl, SKINS };
})();
