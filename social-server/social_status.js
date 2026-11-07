// What is queued, what went out, what failed:  node social_status.js
// Check the Facebook tokens and pages:           node social_status.js --check
const { loadEnv, client } = require('./lib');
(async () => {
  const env = loadEnv(), sb = client(env);
  if (process.argv.includes('--check')) { const r = await sb.fn('publish-due', { check: true }); console.log(r.status === 200 ? r.text : 'ফাংশন উত্তর দেয়নি (' + r.status + '): ' + r.text); return; }
  const rows = await sb.rest('fb_posts?select=page_key,status,scheduled_at,posted_at,attempts,comment_status,error,image_path&order=scheduled_at.desc&limit=40');
  const t = (s) => (s ? new Date(s).toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' }).slice(0, 16) : '-');
  const label = { queued: 'অপেক্ষায়', publishing: 'চলছে', posted: 'পোস্ট হয়েছে', failed: 'ব্যর্থ' };
  const count = {}; rows.forEach((r) => (count[r.status] = (count[r.status] || 0) + 1));
  console.log(Object.entries(count).map(([k, v]) => label[k] + ': ' + v).join('   ') + '   (শেষ ৪০টার মধ্যে)\n');
  for (const r of rows.reverse()) console.log(t(r.scheduled_at) + '  ' + r.page_key + '  ' + label[r.status] + (r.comment_status === 'failed' ? ' (কমেন্ট হয়নি)' : '') + (r.error ? '   ⚠ ' + r.error : ''));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
