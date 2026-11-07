// What is queued, what went out, what failed:  node social_status.js
// Check the Facebook tokens and pages:           node social_status.js --check
const { loadEnv, client } = require('./lib');
(async () => {
  const env = loadEnv(), sb = client(env);
  if (process.argv.includes('--check')) { const r = await sb.fn('publish-due', { check: true }); console.log(r.status === 200 ? r.text : 'ফাংশন উত্তর দেয়নি (' + r.status + '): ' + r.text); return; }
  const rows = await sb.rest('fb_posts?select=page_key,kind,title,status,scheduled_at,posted_at,attempts,comment_status,error&order=scheduled_at.asc.nullslast&limit=1000');
  const t = (s) => (s ? new Date(s).toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' }).slice(5, 16) : '-');
  const label = { queued: 'অপেক্ষায়', publishing: 'যাচ্ছে', posted: 'পোস্ট হয়েছে', failed: 'ব্যর্থ', stock: 'স্টকে' };
  const kind = { text: 'টেক্সট', card: 'কার্ড', reel: 'রিল', series: 'সিরিজ' };
  const count = {}; rows.forEach((r) => (count[r.status] = (count[r.status] || 0) + 1));
  console.log(Object.entries(count).map(([k, v]) => label[k] + ': ' + v).join('   ') + '\n');
  const line = (r) => t(r.scheduled_at) + '  [' + (kind[r.kind] || r.kind) + ']  ' + (r.title || '').slice(0, 38) + (r.comment_status === 'failed' ? '  (কমেন্ট হয়নি)' : '') + (r.error ? '   ⚠ ' + r.error : '');
  const f = rows.filter((r) => r.status === 'failed'), pub = rows.filter((r) => r.status === 'publishing'), posted = rows.filter((r) => r.status === 'posted').slice(-5), next = rows.filter((r) => r.status === 'queued').slice(0, 8);
  if (f.length) { console.log('--- ব্যর্থ'); f.forEach((r) => console.log(line(r))); }
  if (pub.length) { console.log('--- এখন যাচ্ছে'); pub.forEach((r) => console.log(line(r))); }
  if (posted.length) { console.log('--- শেষ পোস্ট হয়েছে'); posted.forEach((r) => console.log(line(r))); }
  if (next.length) { console.log('--- এরপর যা আসছে'); next.forEach((r) => console.log(line(r))); }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
