// Turns your long-lived Facebook USER token into the FB_PAGES secret (page tokens), without showing any token on screen.
//   1) put   FB_USER_TOKEN=<long-lived user token>   in social-server/.env
//   2) node social_pages.js --pages=main:1172341049296109[,second:PAGE_ID]
// It writes fb_pages_SECRET.json (git-ignored): paste its whole content into the Supabase secret FB_PAGES.
// Afterwards delete the FB_USER_TOKEN line from .env.
const fs = require('fs'), path = require('path');

async function buildPages(fetchImpl, userToken, wanted, version = 'v27.0') {
  const found = {}; let url = 'https://graph.facebook.com/' + version + '/me/accounts?fields=id,name,access_token&limit=100&access_token=' + encodeURIComponent(userToken);
  for (let i = 0; url && i < 10; i++) {
    const r = await fetchImpl(url); const d = await r.json();
    if (d.error) throw new Error('Facebook: ' + d.error.message);
    for (const p of d.data || []) found[p.id] = p;
    url = d.paging && d.paging.next;
  }
  const out = {}, names = [];
  for (const [key, id] of Object.entries(wanted)) {
    const p = found[id]; if (!p) throw new Error('পেজ ' + id + ' তালিকায় নেই (এই টোকেন সেই পেজে অ্যাক্সেস পায়নি)');
    out[key] = { page_id: p.id, token: p.access_token }; names.push(key + ' = ' + p.name);
  }
  return { out, names };
}
module.exports = { buildPages };
if (require.main !== module) return;

(async () => {
  const a = process.argv.find((x) => x.startsWith('--pages=')); if (!a) { console.error('ব্যবহার: node social_pages.js --pages=main:পেজ_id[,নাম:পেজ_id]'); process.exit(1); }
  const wanted = {}; for (const part of a.slice(8).split(',')) { const [k, id] = part.split(':'); if (!k || !/^\d+$/.test(id || '')) { console.error('ভুল: ' + part); process.exit(1); } wanted[k] = id; }
  const envFile = path.join(__dirname, '.env'); if (!fs.existsSync(envFile)) { console.error('.env নেই। আগে `node social_setup.js` চালান।'); process.exit(1); }
  const m = fs.readFileSync(envFile, 'utf8').match(/^\s*FB_USER_TOKEN\s*=\s*(\S+)\s*$/m); if (!m) { console.error('.env ফাইলে FB_USER_TOKEN= লাইনটা নেই।'); process.exit(1); }
  const { out, names } = await buildPages(fetch, m[1], wanted);
  fs.writeFileSync(path.join(__dirname, 'fb_pages_SECRET.json'), JSON.stringify(out));
  console.log('ঠিক আছে:\n  ' + names.join('\n  ') + '\n\nfb_pages_SECRET.json তৈরি হয়েছে। এর ভেতরের পুরো লেখা Supabase-এ FB_PAGES নামের Secret-এ বসান।\nতারপর .env থেকে FB_USER_TOKEN লাইনটা মুছে দিন।');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
