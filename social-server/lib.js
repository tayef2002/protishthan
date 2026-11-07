// shared helpers for the local social scripts (no npm packages needed)
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process'), os = require('os');

function loadEnv() {
  const f = path.join(__dirname, '.env'); const env = {};
  if (!fs.existsSync(f)) throw new Error('social-server/.env নেই। আগে `node social_setup.js` চালান।');
  for (const l of fs.readFileSync(f, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2]; }
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) if (!env[k] || /^PASTE/i.test(env[k])) throw new Error('.env ফাইলে ' + k + ' বসানো হয়নি।');
  env.SUPABASE_URL = env.SUPABASE_URL.replace(/\/+$/, '');
  return env;
}

function client(env) {
  // new-style secret keys (sb_secret_...) go in the apikey header only; the older service_role key is a JWT and also goes in Authorization
  const k = env.SUPABASE_SERVICE_KEY, h = k.startsWith('sb_') ? { apikey: k } : { apikey: k, Authorization: 'Bearer ' + k };
  return {
    async rest(p, init = {}) { const r = await fetch(env.SUPABASE_URL + '/rest/v1/' + p, { ...init, headers: { ...h, 'Content-Type': 'application/json', ...(init.headers || {}) } }); const t = await r.text(); if (!r.ok) throw new Error('REST ' + r.status + ': ' + t.slice(0, 300)); return t ? JSON.parse(t) : null; },
    async upload(name, buf, type, bucket = 'cards') { const r = await fetch(env.SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + name, { method: 'POST', headers: { ...h, 'Content-Type': type, 'x-upsert': 'false' }, body: buf }); if (!r.ok) throw new Error('upload ' + r.status + ': ' + (await r.text()).slice(0, 300)); },
    async fn(name, body) { const r = await fetch(env.SUPABASE_URL + '/functions/v1/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': env.CRON_SECRET || '' }, body: JSON.stringify(body || {}) }); return { status: r.status, text: await r.text() }; },
  };
}

// small JPEG preview (360 px wide) of an image file, as a Buffer
function makeThumb(file) {
  const tmp = path.join(os.tmpdir(), 'thumb_' + crypto.randomUUID() + '.jpg');
  const r = cp.spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-vf', 'scale=360:-2', '-q:v', '5', tmp]);
  if (r.status !== 0) throw new Error('thumbnail failed: ' + String(r.stderr).slice(0, 200));
  const buf = fs.readFileSync(tmp); fs.unlinkSync(tmp); return buf;
}

const readText = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/^﻿/, '').trim() : '');

// upload one card (full image + preview) and add it to the table; status 'stock' (no time yet) or 'queued' (with a time)
async function addItem(sb, o) {
  const ext = path.extname(o.file).toLowerCase(), id = crypto.randomUUID(), name = id + (ext === '.png' ? '.png' : '.jpg');
  await sb.upload(name, fs.readFileSync(o.file), ext === '.png' ? 'image/png' : 'image/jpeg');
  const thumb = id + '.jpg'; await sb.upload(thumb, makeThumb(o.file), 'image/jpeg', 'thumbs');
  await sb.rest('fb_posts', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
    id, page_key: o.page || 'main', kind: o.kind || 'card', title: o.title || null, sort_key: o.sortKey || null, image_path: name, thumb_path: thumb,
    caption: o.caption || '', first_comment: o.comment || null, status: o.scheduledAt ? 'queued' : 'stock', scheduled_at: o.scheduledAt || null }) });
  return id;
}

module.exports = { loadEnv, client, makeThumb, addItem, readText };
