// Local check of the dashboard function with a fake database:  node test_content_api.js
const assert = require('assert');
const env = { DASH_CODE: 'abcd-1234', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
let handler; globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
const rows = [
  { id: 'a', kind: 'text', title: 'টেস্ট', caption: 'ক্যাপশন', status: 'posted', scheduled_at: '2026-11-07T18:05:00+00:00', posted_at: '2026-11-07T18:05:13+00:00', thumb_path: 'a.jpg', error: null, fb_post_id: '1_2', comment_status: null, attempts: 1, image_path: 'SECRET.png', page_key: 'main', first_comment: 'hidden' },
  { id: 'b', kind: 'card', title: 'স্টক কার্ড', caption: '', status: 'stock', scheduled_at: null, posted_at: null, thumb_path: null, error: null, fb_post_id: null, comment_status: null, attempts: 0 },
];
let seenUrl = '';
globalThis.fetch = async (url) => { seenUrl = String(url); return { ok: true, status: 200, json: async () => rows, text: async () => '' }; };
const call = (method, code) => handler({ method, headers: { get: (k) => (k === 'x-dash-code' ? code : null) } });

(async () => {
  await import('./functions/content-api/index.ts');
  assert.strictEqual((await call('OPTIONS')).status, 204);
  assert.strictEqual((await call('POST', undefined)).status, 403, 'no code');
  assert.strictEqual((await call('POST', 'wrong-code')).status, 403);
  const res = await call('POST', 'abcd-1234'); assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), '*');
  const d = await res.json(); assert.strictEqual(d.items.length, 2);
  assert.strictEqual(d.items[0].thumb, 'https://x.supabase.co/storage/v1/object/public/thumbs/a.jpg'); assert.strictEqual(d.items[1].thumb, null);
  assert.ok(!('image_path' in d.items[0]) && !('first_comment' in d.items[0]) && !('page_key' in d.items[0]), 'internal columns are not handed out');
  assert.match(seenUrl, /status\.eq\.stock/); assert.match(seenUrl, /scheduled_at\.gte\./);
  delete env.DASH_CODE; assert.strictEqual((await call('POST', 'abcd-1234')).status, 503, 'refuses when no code is configured');
  console.log('ok: content-api checks passed');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
