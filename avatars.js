/* Protishthan — illustrated avatars for the শিক্ষিত কার্ড (no photo needed).
   Everything is drawn here as flat SVG (290 x 330, the same ratio as the photo slot), so there is nothing to upload,
   nothing to license, and it stays sharp at any size. Window.ProtAvatars = { list, svg, dataUrl, SKINS }. */
(function(){
  'use strict';
  const SKINS = ['#F7D9BE', '#EBBC93', '#D39A6C', '#B27A4E', '#7C4D2D'];
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const r = Math.max(0, ((n >> 16) & 255) * k) | 0, g = Math.max(0, ((n >> 8) & 255) * k) | 0, b = Math.max(0, (n & 255) * k) | 0; return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); };
  const HAIR = { black: '#1C1917', brown: '#4A2C17', chest: '#6B4226', grey: '#9CA3AF' };

  /* ---------- hair ---------- */
  const HAIRS = {
    short:  c => ({ back: '', front: `<path d="M89 148C85 98 112 80 145 80C178 80 205 98 201 148C195 124 176 108 145 108C114 108 95 124 89 148Z" fill="${c}"/>` }),
    side:   c => ({ back: '', front: `<path d="M89 150C83 96 116 76 152 79C186 82 207 102 201 150C199 126 184 106 160 103C130 104 104 112 89 150Z" fill="${c}"/><path d="M118 104C140 96 168 98 186 112" stroke="${shade(c, 1.5)}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/>` }),
    curly:  c => { let s = ''; for(let i = 0; i < 11; i++){ const a = Math.PI * (1.08 + i * 0.084); s += `<circle cx="${145 + Math.cos(a) * 60}" cy="${126 + Math.sin(a) * 58}" r="21" fill="${c}"/>`; } return { back: '', front: s }; },
    long:   c => ({ back: `<path d="M82 150C66 236 82 290 118 298L172 298C208 290 224 236 208 150Z" fill="${c}"/>`, front: `<path d="M88 150C85 100 112 82 145 82C178 82 205 100 202 150C192 122 172 112 145 112C118 112 98 122 88 150Z" fill="${c}"/>` }),
    bun:    c => ({ back: `<circle cx="145" cy="62" r="25" fill="${c}"/>`, front: `<path d="M89 148C85 98 112 80 145 80C178 80 205 98 201 148C195 124 176 108 145 108C114 108 95 124 89 148Z" fill="${c}"/><rect x="127" y="82" width="36" height="8" rx="4" fill="#F43F5E"/>` }),
    pony:   c => ({ back: `<path d="M196 118C246 126 252 214 226 252C220 214 206 176 196 150Z" fill="${c}"/>`, front: `<path d="M89 148C85 98 112 80 145 80C178 80 205 98 201 148C195 124 176 108 145 108C114 108 95 124 89 148Z" fill="${c}"/>` }),
    bald:   () => ({ back: '', front: '' })
  };

  /* ---------- outfits (drawn on the body) ---------- */
  const BODY = 'M26 330C26 266 78 244 145 244C212 244 264 266 264 330Z';
  const OUTFITS = {
    shirt:  (c, a) => `<path d="${BODY}" fill="#F8FAFC"/><path d="M118 246L145 284L126 252ZM172 246L145 284L164 252Z" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="2"/>` + (a ? `<path d="M145 272L135 284L145 326L155 284Z" fill="${a}"/>` : ''),
    blazer: (c, a) => `<path d="${BODY}" fill="${c}"/><path d="M121 246L145 300L169 246Z" fill="#F8FAFC"/><path d="M112 248L142 306L120 330L82 330ZM178 248L148 306L170 330L208 330Z" fill="${shade(c, .78)}"/>` + (a ? `<path d="M145 276L137 288L145 322L153 288Z" fill="${a}"/>` : ''),
    gown:   c => `<path d="${BODY}" fill="#18181B"/><path d="M121 246L99 330M169 246L191 330" stroke="#FBBF24" stroke-width="13" stroke-linecap="round"/><path d="M121 246L145 286L169 246Z" fill="#F8FAFC"/>`,
    coat:   c => `<path d="${BODY}" fill="#F8FAFC"/><path d="M121 246L145 298L169 246Z" fill="${c}"/><path d="M112 248L142 306L120 330L84 330ZM178 248L148 306L170 330L206 330Z" fill="#E2E8F0"/><path d="M121 252C102 292 136 322 145 304C154 322 188 292 169 252" stroke="#334155" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="145" cy="306" r="8" fill="#94A3B8" stroke="#334155" stroke-width="3"/>`,
    hoodie: c => `<path d="${BODY}" fill="${c}"/><path d="M96 252C110 230 180 230 194 252C176 262 114 262 96 252Z" fill="${shade(c, .8)}"/><path d="M132 262L130 300M158 262L160 300" stroke="#F8FAFC" stroke-width="4" stroke-linecap="round"/>`,
    panjabi: c => `<path d="${BODY}" fill="${c}"/><path d="M127 246L145 262L163 246" fill="none" stroke="${shade(c, .8)}" stroke-width="5"/><path d="M145 262L145 330" stroke="${shade(c, .82)}" stroke-width="3"/><circle cx="145" cy="278" r="3.4" fill="${shade(c, .6)}"/><circle cx="145" cy="298" r="3.4" fill="${shade(c, .6)}"/><circle cx="145" cy="318" r="3.4" fill="${shade(c, .6)}"/>`,
    saree:  c => `<path d="${BODY}" fill="${c}"/><path d="M58 330L196 246L218 268L130 330Z" fill="#16A34A"/><path d="M58 330L196 246L204 254L82 330Z" fill="#FBBF24"/><path d="M112 246C130 272 160 272 178 246" fill="none" stroke="${shade(c, .7)}" stroke-width="5"/>`,
    tee:    c => `<path d="${BODY}" fill="${c}"/><path d="M118 246C128 270 162 270 172 246" fill="none" stroke="${shade(c, .75)}" stroke-width="5"/>`
  };

  /* ---------- accessories ---------- */
  const ACC = {
    glasses:    () => `<g fill="rgba(255,255,255,.25)" stroke="#1F2937" stroke-width="4"><circle cx="122" cy="152" r="17"/><circle cx="168" cy="152" r="17"/></g><path d="M139 152H151" stroke="#1F2937" stroke-width="4"/>`,
    bigGlasses: () => `<g fill="rgba(255,255,255,.3)" stroke="#111827" stroke-width="6"><circle cx="120" cy="152" r="24"/><circle cx="170" cy="152" r="24"/></g><path d="M144 152H146" stroke="#111827" stroke-width="6"/>`,
    sunglasses: () => `<path d="M94 140H140Q140 172 117 172Q94 172 94 140ZM150 140H196Q196 172 173 172Q150 172 150 140Z" fill="#0F172A"/><path d="M140 144H150" stroke="#0F172A" stroke-width="5"/><path d="M102 146L112 146M158 146L168 146" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".45"/>`,
    gradCap:    () => `<path d="M104 96V118Q145 138 186 118V96Q145 112 104 96Z" fill="#27272A"/><path d="M145 50L236 84L145 116L54 84Z" fill="#18181B"/><path d="M145 84L222 88V128" stroke="#FBBF24" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="222" cy="132" r="6" fill="#FBBF24"/>`,
    topi:       () => `<path d="M98 108C100 76 190 76 192 108C176 118 114 118 98 108Z" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/><path d="M114 100L124 92L134 100L124 108ZM156 100L166 92L176 100L166 108Z" fill="none" stroke="#94A3B8" stroke-width="2"/>`,
    hardhat:    () => `<path d="M92 112C92 60 198 60 198 112Z" fill="#FACC15"/><rect x="82" y="110" width="126" height="11" rx="5" fill="#EAB308"/><rect x="138" y="68" width="14" height="42" fill="#EAB308" opacity=".7"/>`,
    headphones: () => `<path d="M92 142C86 72 204 72 198 142" stroke="#1F2937" stroke-width="9" fill="none" stroke-linecap="round"/><rect x="80" y="134" width="20" height="38" rx="9" fill="#EF4444"/><rect x="190" y="134" width="20" height="38" rx="9" fill="#EF4444"/>`,
    partyHat:   () => `<path d="M145 16L106 100H184Z" fill="#EC4899"/><path d="M124 62H166M114 82H176" stroke="#FDE047" stroke-width="6" stroke-linecap="round"/><circle cx="145" cy="16" r="9" fill="#FDE047"/>`,
    crown:      () => `<path d="M102 102L108 62L128 86L145 54L162 86L182 62L188 102Z" fill="#FACC15" stroke="#CA8A04" stroke-width="3" stroke-linejoin="round"/><circle cx="145" cy="72" r="6" fill="#EF4444"/><circle cx="116" cy="84" r="4.5" fill="#3B82F6"/><circle cx="174" cy="84" r="4.5" fill="#22C55E"/>`,
    catEars:    () => `<path d="M94 98L98 54L130 84Z" fill="#1F2937"/><path d="M196 98L192 54L160 84Z" fill="#1F2937"/><path d="M101 88L103 66L120 83Z" fill="#F9A8D4"/><path d="M189 88L187 66L170 83Z" fill="#F9A8D4"/>`,
    whiskers:   () => `<path d="M104 176L78 170M104 184L78 190M186 176L212 170M186 184L212 190" stroke="#374151" stroke-width="2.5" stroke-linecap="round"/><path d="M140 168Q145 174 150 168Z" fill="#F472B6"/>`,
    mustache:   () => `<path d="M110 180C122 166 141 172 145 180C149 172 168 166 180 180C170 196 151 188 145 184C139 188 120 196 110 180Z" fill="#1F2937"/>`,
    mask:       () => `<path d="M96 142C110 130 132 136 145 146C158 136 180 130 194 142C190 168 168 170 156 158C150 154 140 154 134 158C122 170 100 168 96 142Z" fill="#1D4ED8"/>`,
    nightcap:   () => `<path d="M94 112C98 66 168 56 204 108L228 170C196 138 166 122 94 112Z" fill="#6366F1"/><rect x="92" y="104" width="112" height="14" rx="7" fill="#E0E7FF"/><circle cx="230" cy="172" r="10" fill="#E0E7FF"/>`,
    cape:       () => '',   /* handled behind the body */
    flower:     () => `<g transform="translate(204 108)"><circle r="6" fill="#FDE047"/><circle cx="0" cy="-11" r="7" fill="#FB7185"/><circle cx="10" cy="-4" r="7" fill="#FB7185"/><circle cx="6" cy="9" r="7" fill="#FB7185"/><circle cx="-7" cy="9" r="7" fill="#FB7185"/><circle cx="-10" cy="-4" r="7" fill="#FB7185"/><circle r="5" fill="#FDE047"/></g>`,
    zzz:        () => `<g fill="#6366F1" font-family="Inter,Arial,sans-serif" font-weight="800"><text x="206" y="104" font-size="30">Z</text><text x="228" y="78" font-size="22">z</text><text x="244" y="58" font-size="16">z</text></g>`,
    book:       () => `<rect x="96" y="274" width="98" height="58" rx="6" fill="#2563EB"/><rect x="96" y="274" width="14" height="58" rx="4" fill="#1D4ED8"/><rect x="116" y="284" width="66" height="8" rx="3" fill="#BFDBFE"/><rect x="116" y="300" width="46" height="8" rx="3" fill="#BFDBFE"/>`
  };

  /* ---------- face ---------- */
  const EYES = {
    dot:   () => `<circle cx="123" cy="152" r="6.5" fill="#1F2937"/><circle cx="167" cy="152" r="6.5" fill="#1F2937"/><circle cx="125" cy="150" r="2" fill="#fff"/><circle cx="169" cy="150" r="2" fill="#fff"/>`,
    happy: () => `<path d="M112 156Q123 143 134 156M156 156Q167 143 178 156" stroke="#1F2937" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    sleep: () => `<path d="M112 154H134M156 154H178" stroke="#1F2937" stroke-width="5" stroke-linecap="round"/>`,
    wink:  () => `<circle cx="123" cy="152" r="6.5" fill="#1F2937"/><path d="M156 156Q167 143 178 156" stroke="#1F2937" stroke-width="5" fill="none" stroke-linecap="round"/>`
  };
  const MOUTHS = {
    smile: () => `<path d="M124 184Q145 204 166 184" stroke="#7F1D1D" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    grin:  () => `<path d="M118 180Q145 218 172 180Z" fill="#7F1D1D"/><path d="M124 181H166Q145 192 124 181Z" fill="#fff"/>`,
    smirk: () => `<path d="M126 190Q148 198 168 180" stroke="#7F1D1D" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    open:  () => `<ellipse cx="145" cy="192" rx="9" ry="11" fill="#7F1D1D"/>`,
    tongue:() => `<path d="M118 180Q145 218 172 180Z" fill="#7F1D1D"/><path d="M134 196Q145 214 156 196Z" fill="#F87171"/>`
  };

  /* ---------- builder ---------- */
  function svg(spec, skinIdx){
    const skin = SKINS[skinIdx == null ? 1 : skinIdx], sk2 = shade(skin, .86);
    const hairC = HAIR[spec.hairColor || 'black'];
    const hair = (HAIRS[spec.hair || 'short'] || HAIRS.short)(hairC);
    const hijab = spec.hijab;
    const bg = spec.bg || ['#DBEAFE', '#BFDBFE'];
    let o = `<svg xmlns="http://www.w3.org/2000/svg" width="580" height="660" viewBox="0 0 290 330">`;
    o += `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs><rect width="290" height="330" fill="url(#bg)"/>`;
    o += `<circle cx="232" cy="52" r="46" fill="#fff" opacity=".22"/><circle cx="40" cy="214" r="60" fill="#fff" opacity=".14"/>`;
    if((spec.acc || []).includes('cape')) o += `<path d="M10 330L52 252L238 252L280 330Z" fill="#DC2626"/>`;
    if(hijab) o += `<path d="M58 176C52 118 96 52 145 52C194 52 238 118 232 176C234 236 214 276 196 300L94 300C76 276 56 236 58 176Z" fill="${hijab}"/>`;
    else o += hair.back;
    o += (OUTFITS[spec.outfit || 'shirt'] || OUTFITS.shirt)(spec.outfitColor || '#1E3A8A', spec.accent);
    if(hijab) o += `<path d="M70 262C86 292 110 306 145 306C180 306 204 292 220 262C200 252 170 248 145 248C120 248 90 252 70 262Z" fill="${shade(hijab, .92)}"/>`;
    o += `<path d="M122 200H168V250Q145 266 122 250Z" fill="${sk2}"/>`;
    if(!hijab) o += `<ellipse cx="89" cy="154" rx="9" ry="13" fill="${skin}"/><ellipse cx="201" cy="154" rx="9" ry="13" fill="${skin}"/>`;
    o += hijab ? `<ellipse cx="145" cy="154" rx="49" ry="58" fill="${skin}"/><path d="M96 132C100 96 190 96 194 132C176 112 114 112 96 132Z" fill="${shade(hijab, .88)}"/>` : `<ellipse cx="145" cy="148" rx="56" ry="64" fill="${skin}"/>`;
    if(!hijab) o += hair.front;
    if(spec.blush) o += `<circle cx="106" cy="174" r="10" fill="#F472B6" opacity=".32"/><circle cx="184" cy="174" r="10" fill="#F472B6" opacity=".32"/>`;
    const bx = spec.brows === false ? '' : `<path d="M110 132Q123 124 136 131M154 131Q167 124 180 132" stroke="${hijab ? '#3F3F46' : shade(hairC, 1)}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    o += bx;
    o += `<path d="M145 156Q139 172 147 176" stroke="${shade(skin, .72)}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    o += (EYES[spec.eyes || 'dot'] || EYES.dot)();
    o += (MOUTHS[spec.mouth || 'smile'] || MOUTHS.smile)();
    (spec.acc || []).forEach(a => { if(ACC[a]) o += ACC[a](); });
    return o + '</svg>';
  }
  const dataUrl = (spec, skinIdx) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(spec, skinIdx));

  /* ---------- the ready-made set ---------- */
  const B = (a, b) => [a, b];
  const list = [
    // professional
    { id: 'grad-boy',   group: 'pro', label: 'স্নাতক',          spec: { hair: 'short', outfit: 'gown', acc: ['gradCap'], bg: B('#DBEAFE', '#BFDBFE'), eyes: 'dot', mouth: 'smile' } },
    { id: 'grad-girl',  group: 'pro', label: 'স্নাতক',          spec: { hair: 'long', outfit: 'gown', acc: ['gradCap'], bg: B('#FCE7F3', '#FBCFE8'), eyes: 'happy', mouth: 'smile', blush: true } },
    { id: 'grad-hijab', group: 'pro', label: 'হিজাবি স্নাতক',    spec: { hijab: '#7C3AED', outfit: 'gown', acc: ['gradCap'], bg: B('#EDE9FE', '#DDD6FE'), eyes: 'happy', mouth: 'smile', blush: true } },
    { id: 'panjabi',    group: 'pro', label: 'পাঞ্জাবি-টুপি',    spec: { hair: 'bald', outfit: 'panjabi', outfitColor: '#F1F5F9', acc: ['topi'], bg: B('#D1FAE5', '#A7F3D0'), eyes: 'dot', mouth: 'smile' } },
    { id: 'doctor',     group: 'pro', label: 'ডাক্তার',          spec: { hair: 'side', outfit: 'coat', outfitColor: '#14B8A6', bg: B('#CCFBF1', '#99F6E4'), eyes: 'dot', mouth: 'smile' } },
    { id: 'doctor-f',   group: 'pro', label: 'ডাক্তার',          spec: { hijab: '#0F766E', outfit: 'coat', outfitColor: '#14B8A6', bg: B('#E0F2FE', '#BAE6FD'), eyes: 'happy', mouth: 'smile', blush: true } },
    { id: 'teacher',    group: 'pro', label: 'শিক্ষক',           spec: { hair: 'side', hairColor: 'brown', outfit: 'blazer', outfitColor: '#334155', accent: '#DC2626', acc: ['glasses'], bg: B('#FEF3C7', '#FDE68A'), eyes: 'dot', mouth: 'smile' } },
    { id: 'teacher-f',  group: 'pro', label: 'শিক্ষিকা',         spec: { hair: 'bun', outfit: 'blazer', outfitColor: '#9D174D', acc: ['glasses'], bg: B('#FFE4E6', '#FECDD3'), eyes: 'dot', mouth: 'smile', blush: true } },
    { id: 'engineer',   group: 'pro', label: 'ইঞ্জিনিয়ার',      spec: { hair: 'short', outfit: 'shirt', accent: '#F59E0B', acc: ['hardhat'], bg: B('#FFEDD5', '#FED7AA'), eyes: 'dot', mouth: 'smirk' } },
    { id: 'saree',      group: 'pro', label: 'শাড়ি',            spec: { hair: 'bun', outfit: 'saree', outfitColor: '#DC2626', acc: ['flower'], bg: B('#FEF9C3', '#FEF08A'), eyes: 'happy', mouth: 'smile', blush: true } },
    { id: 'founder',    group: 'pro', label: 'উদ্যোক্তা',        spec: { hair: 'curly', outfit: 'blazer', outfitColor: '#0F172A', accent: '#2563EB', bg: B('#E0E7FF', '#C7D2FE'), eyes: 'dot', mouth: 'smirk' } },
    { id: 'scholar-f',  group: 'pro', label: 'গবেষক',            spec: { hair: 'pony', outfit: 'coat', outfitColor: '#6366F1', acc: ['glasses'], bg: B('#F3E8FF', '#E9D5FF'), eyes: 'dot', mouth: 'smile', blush: true } },
    // fun
    { id: 'cool',       group: 'fun', label: 'কুল',              spec: { hair: 'short', outfit: 'hoodie', outfitColor: '#EF4444', acc: ['sunglasses'], bg: B('#FEE2E2', '#FECACA'), eyes: 'dot', mouth: 'smirk', brows: false } },
    { id: 'bookworm',   group: 'fun', label: 'বইপোকা',           spec: { hair: 'curly', outfit: 'tee', outfitColor: '#16A34A', acc: ['bigGlasses', 'book'], bg: B('#DCFCE7', '#BBF7D0'), eyes: 'dot', mouth: 'grin' } },
    { id: 'sleepy',     group: 'fun', label: 'ঘুমকাতুরে',        spec: { hair: 'bald', outfit: 'tee', outfitColor: '#818CF8', acc: ['nightcap', 'zzz'], bg: B('#E0E7FF', '#C7D2FE'), eyes: 'sleep', mouth: 'open' } },
    { id: 'hero',       group: 'fun', label: 'সুপারহিরো',        spec: { hair: 'short', outfit: 'tee', outfitColor: '#1D4ED8', acc: ['cape', 'mask'], bg: B('#FEF3C7', '#FCD34D'), eyes: 'dot', mouth: 'grin' } },
    { id: 'party',      group: 'fun', label: 'পার্টি',           spec: { hair: 'curly', outfit: 'tee', outfitColor: '#F97316', acc: ['partyHat'], bg: B('#FCE7F3', '#F9A8D4'), eyes: 'happy', mouth: 'tongue', blush: true } },
    { id: 'king',       group: 'fun', label: 'রাজা',             spec: { hair: 'side', outfit: 'blazer', outfitColor: '#7F1D1D', accent: '#FACC15', acc: ['crown', 'mustache'], bg: B('#FEF3C7', '#FDE68A'), eyes: 'dot', mouth: 'smile' } },
    { id: 'cat',        group: 'fun', label: 'বিড়ালছানা',       spec: { hair: 'long', hairColor: 'brown', outfit: 'hoodie', outfitColor: '#EC4899', acc: ['catEars', 'whiskers'], bg: B('#FDF2F8', '#FBCFE8'), eyes: 'happy', mouth: 'smile', blush: true } },
    { id: 'uncle',      group: 'fun', label: 'গোঁফওয়ালা চাচা',  spec: { hair: 'bald', outfit: 'panjabi', outfitColor: '#E2E8F0', acc: ['topi', 'mustache'], bg: B('#ECFCCB', '#D9F99D'), eyes: 'dot', mouth: 'smile' } },
    { id: 'gamer',      group: 'fun', label: 'গেমার',            spec: { hair: 'side', outfit: 'hoodie', outfitColor: '#0F172A', acc: ['headphones'], bg: B('#DBEAFE', '#93C5FD'), eyes: 'wink', mouth: 'grin' } }
  ];

  window.ProtAvatars = { list, svg, dataUrl, SKINS };
})();
