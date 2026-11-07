// shared helpers for the local social scripts (no npm packages needed)
const fs = require('fs'), path = require('path');

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
    async upload(name, buf, type) { const r = await fetch(env.SUPABASE_URL + '/storage/v1/object/cards/' + name, { method: 'POST', headers: { ...h, 'Content-Type': type, 'x-upsert': 'false' }, body: buf }); if (!r.ok) throw new Error('upload ' + r.status + ': ' + (await r.text()).slice(0, 300)); },
    async fn(name, body) { const r = await fetch(env.SUPABASE_URL + '/functions/v1/' + name, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': env.CRON_SECRET || '' }, body: JSON.stringify(body || {}) }); return { status: r.status, text: await r.text() }; },
  };
}

module.exports = { loadEnv, client };
