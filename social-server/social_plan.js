// Give the cards in STOCK their posting times, following the daily pattern in plan.json (17 posts a day by default).
//   node social_plan.js [--days=3] [--from=YYYY-MM-DD] [--go]
// Without --go it only shows the plan. A slot whose kind has no stock left stays empty and is reported.
const fs = require('fs'), path = require('path');
const { loadEnv, client } = require('./lib');

// pure planner (tested in test_plan.js)
function planSlots({ slots, tz, enabled, now, days, from, stock, occupied }) {
  const sign = tz[0] === '-' ? -1 : 1, offMs = sign * ((+tz.slice(1, 3)) * 60 + (+tz.slice(4, 6))) * 60000;
  const day0 = from || new Date(now + offMs).toISOString().slice(0, 10);
  const pool = {}; for (const k of Object.keys(stock)) pool[k] = stock[k].slice();
  const rows = [], shortage = {};
  for (let d = 0; d < days; d++) for (const hhmm of Object.keys(slots).sort()) {
    const t = Date.parse(day0 + 'T' + hhmm + ':00' + tz) + d * 86400000, kind = slots[hhmm];
    if (t < now + 10 * 60000) continue;                                   // too close or already past
    if (occupied.some((o) => Math.abs(o - t) < 30 * 60000)) continue;     // something is already there
    if (!enabled.includes(kind)) continue;                                // e.g. reels until reel posting exists
    const item = (pool[kind] || []).shift();
    if (!item) { shortage[kind] = (shortage[kind] || 0) + 1; rows.push({ at: new Date(t), kind, item: null }); continue; }
    rows.push({ at: new Date(t), kind, item });
  }
  return { rows, shortage };
}
module.exports = { planSlots };
if (require.main !== module) return;

const arg = (n, d = '') => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const go = process.argv.includes('--go'), days = +arg('days', '3'), from = arg('from');
const label = { text: 'টেক্সট', card: 'কার্ড', reel: 'রিল' };
(async () => {
  const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'plan.json'), 'utf8')), sb = client(loadEnv());
  const stockRows = await sb.rest('fb_posts?select=id,kind,title,sort_key&status=eq.stock&page_key=eq.' + encodeURIComponent(plan.page) + '&order=rank.asc.nullslast,sort_key.asc.nullslast,created_at.asc&limit=1000');
  const stock = { text: [], card: [], reel: [] }; for (const r of stockRows) (stock[r.kind] || (stock[r.kind] = [])).push(r);
  const occ = await sb.rest('fb_posts?select=scheduled_at&status=in.(queued,publishing,posted)&scheduled_at=gte.' + encodeURIComponent(new Date(Date.now() - 86400000).toISOString()) + '&limit=1000');
  const { rows, shortage } = planSlots({ slots: plan.slots, tz: plan.tz, enabled: plan.enabled_kinds, now: Date.now(), days, from, stock, occupied: occ.map((o) => Date.parse(o.scheduled_at)) });

  let lastDay = '';
  for (const r of rows) {
    const s = r.at.toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' }), day = s.slice(0, 10); if (day !== lastDay) { console.log('\n' + day); lastDay = day; }
    console.log('  ' + s.slice(11, 16) + '  ' + (label[r.kind] || r.kind).padEnd(6) + (r.item ? r.item.title : '—— খালি (এই ধরনের স্টক শেষ)'));
  }
  const planned = rows.filter((r) => r.item).length;
  console.log('\nমোট ' + planned + 'টা পোস্টের সময় ঠিক হবে।' + Object.entries(shortage).map(([k, n]) => '  ' + (label[k] || k) + ' স্টক কম: ' + n + 'টা জায়গা খালি').join(''));
  if (!planned) return;
  if (!go) { console.log('এটা শুধু নমুনা। সত্যিই লাইনে দিতে শেষে --go যোগ করুন।'); return; }
  for (const r of rows.filter((x) => x.item)) await sb.rest('fb_posts?id=eq.' + r.item.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'queued', scheduled_at: r.at.toISOString() }) });
  console.log(planned + 'টা পোস্ট লাইনে দেওয়া হয়েছে। দেখতে: protishthan.com/content');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
