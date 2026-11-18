// Step 6 of the league: a GENTLE probe of the real API. It only calls read-only public functions (challenge_list, challenge_state of an id that does not exist) and the edge
// endpoints /api/time and /api/challenge, with a few workers at a time for a few seconds each, and reports requests per second and the latency.
// It never writes, never signs in, and never goes above the highest level you give it (default 10 workers). Every request to protishthan.com counts against the Cloudflare daily quota of the free plan.
//   node tools/loadtest/probe.mjs [--levels 1,4,10] [--seconds 4] [--site https://protishthan.com] [--skip-edge] [--skip-db]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const levels = String(arg('levels', '1,4,10')).split(',').map(Number).filter(n => n > 0 && n <= 60), secs = Math.min(10, Number(arg('seconds', 4))), site = arg('site', 'https://protishthan.com');
const mem = fs.readFileSync(path.join(root, 'member.js'), 'utf8');
const SB = (mem.match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [])[0], KEY = (mem.match(/eyJ[A-Za-z0-9_.-]+/) || [])[0];
const NOPE = '00000000-0000-0000-0000-0000000000aa';
const pct = (a, p) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
async function level(name, workers, call) {
  const lat = []; let bad = 0; const end = Date.now() + secs * 1000;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: workers }, async () => { while (Date.now() < end) { const t = Date.now(); try { const r = await call(); if (!r.ok) bad++; await r.arrayBuffer(); lat.push(Date.now() - t); } catch (e) { bad++; } } }));
  const el = (Date.now() - t0) / 1000;
  console.log(name.padEnd(34) + String(workers).padEnd(9) + String(lat.length).padEnd(9) + (lat.length / el).toFixed(1).padEnd(9) + String(pct(lat, .5)).padEnd(8) + String(pct(lat, .95)).padEnd(8) + String(Math.max(0, ...lat)).padEnd(8) + bad);
  return { name, workers, n: lat.length, rps: lat.length / el, p50: pct(lat, .5), p95: pct(lat, .95), bad };
}
console.log('name'.padEnd(34) + 'workers  requests rps      p50 ms  p95 ms  max ms  errors');
const rpc = (fn, body) => () => fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
if (!process.argv.includes('--skip-db')) for (const w of levels) { await level('database: challenge_list', w, rpc('challenge_list', { p_limit: 30 })); await new Promise(r => setTimeout(r, 1500)); }
if (!process.argv.includes('--skip-db')) for (const w of levels) { await level('database: challenge_state (none)', w, rpc('challenge_state', { p_id: NOPE })); await new Promise(r => setTimeout(r, 1500)); }
if (!process.argv.includes('--skip-edge')) for (const w of levels.filter(w => w <= 4)) { await level('edge: /api/time', w, () => fetch(site + '/api/time', { cache: 'no-store' })); await new Promise(r => setTimeout(r, 1000)); }
if (!process.argv.includes('--skip-edge')) for (const w of levels.filter(w => w <= 4)) { await level('edge: /api/challenge state (cached)', w, () => fetch(site + '/api/challenge?f=state&id=' + NOPE, { cache: 'no-store' })); await new Promise(r => setTimeout(r, 1000)); }
await new Promise(r => setTimeout(r, 300));
