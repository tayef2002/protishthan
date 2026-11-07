// Local check of the dashboard function (view + manage) with a fake database:  node test_content_api.js
const assert = require('assert');
const env = { DASH_CODE: 'abcd-1234', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
let handler; globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };

const U = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const min = (m) => new Date(Date.now() + m * 60000).toISOString();
const mk = (n, o) => ({ id: U(n), kind: 'text', title: 't' + n, caption: 'c' + n, status: 'stock', scheduled_at: null, posted_at: null, thumb_path: 'th' + n + '.jpg', image_path: 'im' + n + '.png', error: null, fb_post_id: null, comment_status: null, attempts: 0, sort_key: null, rank: null, page_key: 'main', first_comment: 'hidden', ...o });
let db = [], storageDeleted = [];
const reset = () => { storageDeleted = []; db = [
  mk(1, { status: 'stock' }), mk(2, { status: 'stock' }), mk(3, { status: 'queued', scheduled_at: min(180) }), mk(4, { status: 'queued', scheduled_at: min(300) }),
  mk(5, { status: 'posted', scheduled_at: min(-60), posted_at: min(-59), fb_post_id: '1_2' }), mk(6, { status: 'failed', scheduled_at: min(-30), attempts: 3, error: 'token' }), mk(7, { status: 'publishing', scheduled_at: min(-1) }) ]; };

const match = (row, filter) => filter.split('&').every((seg) => {
  const [k, v] = [seg.slice(0, seg.indexOf('=')), seg.slice(seg.indexOf('=') + 1)];
  if (k === 'id' && v.startsWith('eq.')) return row.id === v.slice(3);
  if (k === 'id' && v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(row.id);
  if (k === 'id' && v.startsWith('neq.')) return row.id !== v.slice(4);
  if (k === 'status' && v.startsWith('eq.')) return row.status === v.slice(3);
  if (k === 'status' && v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(row.status);
  if (k === 'scheduled_at' && v.startsWith('gte.')) return !!row.scheduled_at && Date.parse(row.scheduled_at) >= Date.parse(decodeURIComponent(v.slice(4)));
  if (k === 'scheduled_at' && v.startsWith('lte.')) return !!row.scheduled_at && Date.parse(row.scheduled_at) <= Date.parse(decodeURIComponent(v.slice(4)));
  return true;   // select=, order=, limit= ...
});
globalThis.fetch = async (url, init = {}) => {
  url = String(url); const J = (o, status = 200) => ({ ok: status < 400, status, json: async () => JSON.parse(JSON.stringify(o)), text: async () => JSON.stringify(o) });
  const m = url.match(/\/rest\/v1\/fb_posts\?(.*)$/);
  if (m) {
    const q = m[1], method = init.method || 'GET';
    if (method === 'GET') { if (q.includes('or=(status.eq.stock')) return J(db.filter((r) => r.status === 'stock' || r.scheduled_at)); return J(db.filter((r) => match(r, q.replace(/(^|&)(select|order|limit)=[^&]*/g, '')))); }
    if (method === 'PATCH') { const hit = db.filter((r) => match(r, q)); hit.forEach((r) => Object.assign(r, JSON.parse(init.body))); return J(hit); }
    if (method === 'DELETE') { const hit = db.filter((r) => match(r, q)); db = db.filter((r) => !hit.includes(r)); return J(hit); }
  }
  if (url.includes('/storage/v1/object/') && init.method === 'DELETE') { storageDeleted.push(url.split('/object/')[1]); return J({}); }
  throw new Error('unexpected fetch ' + url);
};
const call = (body, code = 'abcd-1234', method = 'POST') => handler({ method, headers: { get: (k) => (k === 'x-dash-code' ? code : null) }, json: async () => body || {} });
const row = (n) => db.find((r) => r.id === U(n));

(async () => {
  await import('./functions/content-api/index.ts'); reset();

  // --- the lock
  assert.strictEqual((await call({}, undefined, 'OPTIONS')).status, 204);
  assert.strictEqual((await call({}, null)).status, 403, 'no code');
  assert.strictEqual((await call({ action: 'delete', ids: [U(1)] }, 'wrong')).status, 403, 'wrong code cannot change anything'); assert.ok(row(1));

  // --- list: shape, thumbnails, no internal columns
  let res = await call({}); assert.strictEqual(res.status, 200); assert.strictEqual(res.headers.get('Access-Control-Allow-Origin'), '*');
  let d = await res.json(); assert.strictEqual(d.items.length, 7);
  assert.strictEqual(d.items[0].thumb, 'https://x.supabase.co/storage/v1/object/public/thumbs/th1.jpg');
  assert.ok(!('image_path' in d.items[0]) && !('page_key' in d.items[0]), 'internal columns are not handed out');
  assert.strictEqual(d.items[0].image, 'https://x.supabase.co/storage/v1/object/public/cards/im1.png'); assert.strictEqual(d.items.find((i) => i.status === 'posted').image, null, 'no full image link for posted posts');

  // --- update text
  assert.strictEqual((await call({ action: 'update', id: U(1), caption: 'নতুন ক্যাপশন', title: '  নতুন নাম ' })).status, 200);
  assert.strictEqual(row(1).caption, 'নতুন ক্যাপশন'); assert.strictEqual(row(1).title, 'নতুন নাম');
  assert.strictEqual((await call({ action: 'update', id: U(5), caption: 'x' })).status, 409, 'posted is locked'); assert.strictEqual(row(5).caption, 'c5');
  assert.strictEqual((await call({ action: 'update', id: U(7), caption: 'x' })).status, 409, 'publishing is locked');
  assert.strictEqual((await call({ action: 'update', id: 'not-an-id', caption: 'x' })).status, 400);
  assert.strictEqual((await call({ action: 'update', id: U(1) })).status, 400, 'nothing to change');
  assert.strictEqual(d.items[0].first_comment, 'hidden', 'the first comment is visible to the dashboard');
  assert.strictEqual((await call({ action: 'update', id: U(1), first_comment: '  নতুন কমেন্ট  ' })).status, 200); assert.strictEqual(row(1).first_comment, 'নতুন কমেন্ট');
  assert.strictEqual((await call({ action: 'update', id: U(1), first_comment: '   ' })).status, 200); assert.strictEqual(row(1).first_comment, null, 'an empty comment removes it');

  // --- schedule
  const t1 = min(600);
  assert.strictEqual((await call({ action: 'schedule', id: U(1), scheduled_at: t1 })).status, 200);
  assert.strictEqual(row(1).status, 'queued'); assert.strictEqual(new Date(row(1).scheduled_at).toISOString(), new Date(t1).toISOString());
  res = await call({ action: 'schedule', id: U(2), scheduled_at: min(1) }); assert.strictEqual(res.status, 400); assert.strictEqual((await res.json()).error, 'time_too_soon');
  res = await call({ action: 'schedule', id: U(2), scheduled_at: min(610) }); assert.strictEqual(res.status, 409, 'within 20 minutes of another post'); assert.strictEqual((await res.json()).error, 'slot_taken'); assert.strictEqual(row(2).status, 'stock');
  assert.strictEqual((await call({ action: 'schedule', id: U(5), scheduled_at: min(900) })).status, 409, 'posted cannot be rescheduled');
  assert.strictEqual((await call({ action: 'schedule', id: U(6), scheduled_at: min(900) })).status, 200, 'a failed post can be given a new time');
  assert.strictEqual(row(6).status, 'queued'); assert.strictEqual(row(6).attempts, 0); assert.strictEqual(row(6).error, null);
  assert.strictEqual((await call({ action: 'schedule', id: U(2), scheduled_at: 'garbage' })).status, 400);

  // --- swap
  const a = row(3).scheduled_at, b = row(4).scheduled_at;
  assert.strictEqual((await call({ action: 'swap', a: U(3), b: U(4) })).status, 200); assert.strictEqual(row(3).scheduled_at, b); assert.strictEqual(row(4).scheduled_at, a);
  assert.strictEqual((await call({ action: 'swap', a: U(3), b: U(2) })).status, 409, 'stock cannot be swapped'); assert.strictEqual((await call({ action: 'swap', a: U(3), b: U(3) })).status, 400);

  // --- unschedule
  res = await call({ action: 'unschedule', ids: [U(3), U(5)] }); assert.strictEqual((await res.json()).changed, 1);
  assert.strictEqual(row(3).status, 'stock'); assert.strictEqual(row(3).scheduled_at, null); assert.strictEqual(row(5).status, 'posted');

  // --- move to front (only stock)
  res = await call({ action: 'top', ids: [U(2), U(3), U(5)] }); assert.strictEqual((await res.json()).changed, 2);
  assert.ok(row(2).rank < 0 && row(3).rank < 0 && row(3).rank > row(2).rank, 'given order is kept'); assert.strictEqual(row(5).rank, null);

  // --- delete (never a post that is publishing or posted) and clean the storage
  res = await call({ action: 'delete', ids: [U(2), U(4), U(5), U(7)] }); assert.strictEqual((await res.json()).changed, 2);
  assert.ok(!row(2) && !row(4) && row(5) && row(7)); assert.deepStrictEqual(storageDeleted.sort(), ['cards/im2.png', 'cards/im4.png', 'thumbs/th2.jpg', 'thumbs/th4.jpg']);
  assert.strictEqual((await call({ action: 'delete', ids: Array.from({ length: 61 }, (_, i) => U(i + 100)) })).status, 400, 'too many ids');

  assert.strictEqual((await call({ action: 'format-the-disk' })).status, 400);
  delete env.DASH_CODE; assert.strictEqual((await call({})).status, 503, 'refuses when no code is configured');
  console.log('ok: content-api checks passed');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
