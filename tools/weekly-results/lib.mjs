// Weekly "who is ahead" poster: the data, the rules and the picture. Everything here is plain functions so tools/tests/test_weekly_poster.js can run them.
// The numbers come from the public board function competition_board (migrations/2027-01-04_competition_board.sql), the same one the card page shows.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const bn = x => String(x).replace(/[0-9]/g, d => BN_DIGITS[d]);
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

/** "১০ – ১৬ নভেম্বর ২০২৬" for the 7 days that end on `end` (a Date). Across two months or years both are named. */
export function weekRange(end) {
  const e = new Date(end), s = new Date(end); s.setDate(s.getDate() - 6);
  const same = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (same) return bn(s.getDate()) + ' – ' + bn(e.getDate()) + ' ' + MONTHS[e.getMonth()] + ' ' + bn(e.getFullYear());
  const y = s.getFullYear() === e.getFullYear() ? '' : ' ' + bn(s.getFullYear());
  return bn(s.getDate()) + ' ' + MONTHS[s.getMonth()] + y + ' – ' + bn(e.getDate()) + ' ' + MONTHS[e.getMonth()] + ' ' + bn(e.getFullYear());
}

/** the public url and anon key are read from member.js, so there is one copy of them in the project */
export function loadConfig() {
  const src = fs.readFileSync(path.join(ROOT, 'member.js'), 'utf8');
  const url = (src.match(/SB_URL = '([^']+)'/) || [])[1], key = (src.match(/SB_KEY = '([^']+)'/) || [])[1];
  if (!url || !key) throw new Error('could not read the database address from member.js');
  return { url, key };
}

export async function board(cfg, args) {
  const body = Object.assign({ p_metric: 'card', p_period: 'week', p_scope: 'institution', p_division: null, p_district: null, p_type: null, p_limit: 10 }, args);
  const r = await fetch(cfg.url + '/rest/v1/rpc/competition_board', { method: 'POST', headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('competition_board ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return (await r.json()).map(x => ({ key: x.key, name: x.name, district: x.district, division: x.division, upazila: x.upazila, itype: x.itype, n: Number(x.n), rank: Number(x.rank), inst: Number(x.inst_count) }));
}

/** the poster is only made when there is enough real data behind it (never pad it) */
export function thinReason(model, minTotal = 30, minRows = 3) {
  const main = model.main || [];
  if (main.length < minRows) return 'only ' + main.length + ' row(s) have a count this week (need ' + minRows + ')';
  const total = main.reduce((a, r) => a + r.n, 0);
  if (total < minTotal) return 'only ' + total + ' card(s) this week in these rows (need ' + minTotal + ')';
  return '';
}

/** what the poster and the caption are about, from the three boards */
export async function buildModel(cfg, mode, value, end) {
  const range = weekRange(end);
  if (mode === 'division') {
    const [main, mainAll, inst] = await Promise.all([
      board(cfg, { p_scope: 'district', p_division: value, p_limit: 8 }), board(cfg, { p_scope: 'district', p_division: value, p_period: 'all', p_limit: 50 }), board(cfg, { p_scope: 'institution', p_division: value, p_limit: 3 })]);
    return { mode, value, range, title: value + ' বিভাগে এই সপ্তাহে এগিয়ে', mainTitle: 'জেলা', unit: 'শিক্ষিত কার্ড', main: withTotals(main, mainAll), instTitle: 'সেরা ৩ প্রতিষ্ঠান', inst, instMax: 3 };
  }
  if (mode === 'district') {
    const [main, mainAll] = await Promise.all([board(cfg, { p_scope: 'institution', p_district: value, p_limit: 8 }), board(cfg, { p_scope: 'institution', p_district: value, p_period: 'all', p_limit: 50 })]);
    return { mode, value, range, title: value + ' জেলায় এই সপ্তাহে এগিয়ে', mainTitle: 'প্রতিষ্ঠান', unit: 'শিক্ষিত কার্ড', main: withTotals(main, mainAll), inst: [], instMax: 0 };
  }
  const [main, mainAll, dist, inst] = await Promise.all([
    board(cfg, { p_scope: 'division', p_limit: 8 }), board(cfg, { p_scope: 'division', p_period: 'all', p_limit: 8 }),
    board(cfg, { p_scope: 'district', p_limit: 3 }), board(cfg, { p_scope: 'institution', p_limit: 3 })]);
  return { mode: 'country', value: '', range, title: 'শিক্ষিত কার্ডে এই সপ্তাহে কে এগিয়ে', mainTitle: 'বিভাগ', unit: 'শিক্ষিত কার্ড', main: withTotals(main, mainAll), dist, distTitle: 'সেরা ৩ জেলা', inst, instTitle: 'সেরা ৩ প্রতিষ্ঠান', instMax: 3 };
}
function withTotals(week, all) { const t = new Map(all.map(r => [r.key, r.n])); return week.map(r => Object.assign({}, r, { total: t.get(r.key) || r.n })); }

const TAGS = '#শিক্ষিতকার্ড #sikkhitocard #protishthan';
export function buildCaption(model) {
  const lines = [];
  const where = model.mode === 'division' ? model.value + ' বিভাগে' : model.mode === 'district' ? model.value + ' জেলায়' : 'সারা দেশে';
  lines.push('এই সপ্তাহে (' + model.range + ') ' + where + ' শিক্ষিত কার্ডে এগিয়ে কারা? 🏆');
  lines.push('');
  model.main.slice(0, 5).forEach(r => lines.push(bn(r.rank) + '. ' + r.name + ': ' + bn(r.n) + 'টি কার্ড'));
  lines.push('');
  lines.push(model.mode === 'district' ? 'আপনার প্রতিষ্ঠান কত নম্বরে? কমেন্টে লিখুন, আর নিজের কার্ড বানিয়ে ওকে এগিয়ে নিন।' : 'আপনার ' + (model.mode === 'division' ? 'জেলা' : 'জেলা বা বিভাগ') + ' কত নম্বরে? কমেন্টে লিখুন, আর নিজের কার্ড বানিয়ে ওকে এগিয়ে নিন।');
  lines.push('');
  lines.push('👉 কার্ড বানাতে ভিজিট করুন: protishthan.com/card');
  lines.push('সংখ্যাগুলো তথ্যভান্ডারে থাকা প্রতিষ্ঠানের, প্রতি ডিভাইস থেকে একবার গোনা। এটি একটি স্মারক কার্ড, সরকারি পরিচয়পত্র নয়।');
  lines.push('');
  lines.push(TAGS);
  return lines.join('\n') + '\n';
}

const MEDAL = { 1: ['#FDE68A', '#F59E0B', '#78350F'], 2: ['#F1F5F9', '#CBD5E1', '#334155'], 3: ['#FED7AA', '#EA8A3C', '#7C2D12'] };
function rows(list, unit, cap, showTotal) {
  const max = Math.max(1, ...list.map(r => r.n));
  return list.slice(0, cap).map(r => {
    const m = MEDAL[r.rank] || ['#EEF3FF', '#D6E3FB', '#1A56DB'];
    const w = Math.max(r.n ? 5 : 0, Math.round(r.n / max * 100));
    const meta = [r.itype, r.upazila, r.inst > 1 ? bn(r.inst) + 'টি প্রতিষ্ঠান' : '', r.district && r.itype ? r.district : ''].filter(Boolean).join(' · ');
    return '<li><span class="rk" style="background:linear-gradient(135deg,' + m[0] + ',' + m[1] + ');color:' + m[2] + '">' + bn(r.rank) + '</span><div class="nm"><b>' + esc(r.name) + '</b>' + (meta ? '<small>' + esc(meta) + '</small>' : '') + '<i class="bar"><u style="width:' + w + '%"></u></i></div><div class="n">' + bn(r.n) + '<small>' + (showTotal && r.total ? 'মোট ' + bn(r.total) : unit) + '</small></div></li>';
  }).join('');
}
function mini(title, list, cap) {
  if (!list || !list.length) return '';
  return '<div class="box"><h3>' + esc(title) + '</h3><ol class="mini">' + list.slice(0, cap).map(r => '<li><span class="r2">' + bn(r.rank) + '</span><b>' + esc(r.name) + '</b><em>' + bn(r.n) + '</em></li>').join('') + '</ol></div>';
}

/** one self-contained page (1080 x 1350). Fonts and the logo are read from the project folder by file address. */
export function renderHtml(model) {
  const f = p => 'file:///' + path.join(ROOT, p).replace(/\\/g, '/');
  const one = model.mode === 'country' || model.title.length <= 34, subTop = one ? 214 : 292, panelTop = one ? 282 : 356;
  const cap = 8, main = rows(model.main, model.unit, cap, true);
  const lower = model.mode === 'country' ? '<div class="two">' + mini(model.distTitle, model.dist, 3) + mini(model.instTitle, model.inst, 3) + '</div>' : (model.mode === 'division' ? '<div class="one">' + mini(model.instTitle, model.inst, 3) + '</div>' : '');
  const total = model.main.reduce((a, r) => a + r.n, 0);
  return `<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>weekly result poster</title><style>
@font-face{font-family:HS;src:url('${f('Font/HindSiliguri-Bold.ttf')}');font-weight:700}
@font-face{font-family:HS;src:url('${f('Font/HindSiliguri-Regular.ttf')}');font-weight:400}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden;background:#EAF1FF}
#p{position:absolute;inset:0;font-family:HS,sans-serif;color:#0B1B4D;background:radial-gradient(760px 480px at 100% 0,rgba(124,92,255,.22),transparent 64%),radial-gradient(760px 480px at 0 0,rgba(59,130,246,.24),transparent 62%),linear-gradient(170deg,#E4EEFF 0%,#EFEFFF 100%);overflow:hidden}
#dots{position:absolute;inset:0;opacity:.6}
#top{position:absolute;left:64px;right:64px;top:48px;display:flex;align-items:center;justify-content:space-between}
.logo{display:flex;align-items:center;gap:14px}.tile{width:58px;height:58px;border-radius:17px;overflow:hidden;background:linear-gradient(135deg,#1A56DB,#4F46E5)}.tile img{width:100%;height:100%;display:block}
.word{font:700 40px HS,sans-serif;letter-spacing:-.6px}.word i{font-style:normal;opacity:.5}
.chip{height:46px;padding:0 20px;border-radius:23px;background:#fff;border:1.5px solid #D6E3FB;font-size:24px;font-weight:700;color:#1A56DB;display:flex;align-items:center}
h1{position:absolute;left:64px;right:64px;top:132px;font-size:66px;line-height:1.16;font-weight:700;letter-spacing:-.8px}
h1 span{background:linear-gradient(120deg,#1A56DB,#7C3AED 58%,#0891B2);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{position:absolute;left:64px;right:64px;top:${subTop}px;font-size:30px;color:#52607F;font-weight:400}.sub b{color:#0B1B4D}
.panel{position:absolute;left:64px;right:64px;top:${panelTop}px;bottom:${lower ? 372 : 214}px;background:#fff;border:1.5px solid #E1EAFB;border-radius:34px;padding:20px 28px 14px;box-shadow:0 30px 50px -34px rgba(26,86,219,.45)}
.panel h2{font-size:25px;font-weight:700;color:#64748B;margin-bottom:8px;display:flex;justify-content:space-between}
ol.l{list-style:none;display:flex;flex-direction:column;justify-content:space-around;height:calc(100% - 40px)}
ol.l li{display:grid;grid-template-columns:62px minmax(0,1fr) auto;gap:18px;align-items:center}
ol.l.c .nm b{font-size:30px}ol.l.c .nm small{font-size:17px;line-height:1.2}ol.l.c .bar{height:9px;margin-top:3px}ol.l.c .n{font-size:36px}ol.l.c .n small{font-size:15px}ol.l.c .rk{width:48px;height:48px;font-size:26px}ol.l.c li{grid-template-columns:54px minmax(0,1fr) auto}
.rk{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700}
.nm b{display:block;font-size:34px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nm small{display:block;font-size:20px;color:#64748B;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar{display:block;height:11px;border-radius:8px;background:#E3EBFB;margin-top:6px;overflow:hidden}.bar u{display:block;height:100%;border-radius:8px;background:linear-gradient(90deg,#1A56DB,#7C3AED);text-decoration:none}
.n{text-align:right;font-size:42px;font-weight:700;line-height:1;letter-spacing:-.6px;font-variant-numeric:tabular-nums}.n small{display:block;font-size:17px;font-weight:400;color:#64748B;letter-spacing:0;margin-top:2px}
.two,.one{position:absolute;left:64px;right:64px;bottom:214px;height:138px;display:grid;gap:18px;grid-template-columns:1fr 1fr}.one{grid-template-columns:1fr;height:138px}
.box{background:#fff;border:1.5px solid #E1EAFB;border-radius:26px;padding:12px 20px;overflow:hidden}.box h3{font-size:20px;color:#64748B;font-weight:700;margin-bottom:2px}
ol.mini{list-style:none}ol.mini li{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:8px;align-items:baseline;font-size:21px;line-height:1.32}
.r2{font-weight:700;color:#1A56DB}.mini b{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mini em{font-style:normal;font-weight:700}
#bar{position:absolute;left:64px;right:64px;bottom:94px;height:90px;border-radius:26px;display:flex;align-items:center;background:linear-gradient(100deg,#1A56DB 0%,#3B5BEB 55%,#6D4DF5 100%);box-shadow:0 22px 34px -18px rgba(26,86,219,.7),inset 0 1px 0 rgba(255,255,255,.35)}
#bar .lb{display:flex;align-items:center;gap:12px;height:100%;padding:0 26px 0 28px;color:#fff;font-size:28px;font-weight:700;border-right:2px solid rgba(255,255,255,.28);white-space:nowrap}
#bar .lk{flex:1;padding:0 0 3px 28px;font-size:42px;font-weight:700;color:#fff;white-space:nowrap}#bar .lk em{font-style:normal;color:#FDE68A}
#bar .go{width:60px;height:60px;margin-right:16px;border-radius:50%;background:#FBBF24;display:flex;align-items:center;justify-content:center}
#note{position:absolute;left:64px;right:64px;bottom:36px;text-align:center;font-size:21px;color:#6B7794;font-weight:400}
</style></head><body><div id="p">
<svg id="dots" width="1080" height="1350"><defs><pattern id="pt" width="54" height="54" patternUnits="userSpaceOnUse"><circle cx="27" cy="27" r="1.7" fill="rgba(26,86,219,.12)"/></pattern></defs><rect width="1080" height="1350" fill="url(#pt)"/></svg>
<div id="top"><div class="logo"><div class="tile"><img src="${f('logo-sm.webp')}"></div><div class="word">Protisht<i>han</i></div></div><div class="chip">সাপ্তাহিক ফল</div></div>
<h1>${model.mode === 'country' ? 'শিক্ষিত কার্ডে এই সপ্তাহে <span>কে এগিয়ে?</span>' : esc(model.title)}</h1>
<div class="sub"><b>${esc(model.range)}</b> · এই সপ্তাহে মোট <b>${bn(total)}</b>টি কার্ড</div>
<div class="panel"><h2><span>${esc(model.mainTitle)} অনুযায়ী</span><span>এই সপ্তাহের কার্ড</span></h2><ol class="l${model.main.length > 6 ? ' c' : ''}">${main}</ol></div>
${lower}
<div id="bar"><div class="lb"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/></svg>সার্চ করুন</div><div class="lk">protishthan.com<em>/card</em></div><div class="go"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0B1B4D" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div></div>
<div id="note">সংখ্যা: তথ্যভান্ডারে থাকা প্রতিষ্ঠান, প্রতি ডিভাইস থেকে একবার গোনা · স্মারক কার্ড, সরকারি পরিচয়পত্র নয়</div>
</div></body></html>`;
}
