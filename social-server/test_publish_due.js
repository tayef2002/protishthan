// Local test of the Edge Function with fake Supabase + fake Facebook (nothing real is called):  node test_publish_due.js
const assert = require('assert');
const env = { CRON_SECRET: 's3cret', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc', FB_PAGES: JSON.stringify({ main: { page_id: '111', token: 'TOK' } }) };
let handler; globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };

const rows = [
  { id: 'a', page_key: 'main', image_path: 'one.png', caption: 'ক্যাপশন ১', first_comment: null, attempts: 1 },
  { id: 'b', page_key: 'main', image_path: 'two.png', caption: 'ক্যাপশন ২', first_comment: 'লিংক এখানে', attempts: 1 },
  { id: 'c', page_key: 'nope', image_path: 'three.png', caption: '', first_comment: null, attempts: 1 },
  { id: 'd', page_key: 'main', image_path: 'four.png', caption: 'fails', first_comment: null, attempts: 1 },
  { id: 'e', page_key: 'main', image_path: 'five.png', caption: 'photo ok comment fails', first_comment: 'x', attempts: 1 },
];
const patches = {}, graphCalls = [], deleted = [], ruploads = []; let reelNo = 0; const waiting = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url); const J = (o, status = 200) => ({ ok: status < 400, status, json: async () => o, text: async () => JSON.stringify(o) });
  if (url.endsWith('/rpc/claim_due_posts')) return J(rows);
  if (url.includes('/rest/v1/fb_posts?select=id,page_key,fb_post_id,first_comment')) { assert.match(url, /comment_status=is.null/); return J(waiting); }
  if (url.includes('/rest/v1/fb_posts?select=id,image_path')) { assert.match(url, /image_deleted=eq\.false/); return J([{ id: 'old1', image_path: 'old.png' }]); }
  if (init.method === 'DELETE' && url.endsWith('/storage/v1/object/cards/old.png')) { deleted.push(url); return J({}); }
  if (url.includes('/rest/v1/fb_posts?id=eq.')) { patches[url.split('eq.')[1]] = JSON.parse(init.body); return J({}); }
  if (url.startsWith('https://graph.facebook.com/')) {
    const p = Object.fromEntries(new URLSearchParams(init.body)); graphCalls.push({ url, p });
    if (url.endsWith('/111/photos')) { if (p.caption === 'fails') return J({ error: { message: 'boom', code: 1 } }, 400); return J({ id: 'ph' + p.caption.length, post_id: '111_' + p.caption.length }); }
    if (url.endsWith('/comments')) { if (p.message === 'x') return J({ error: { message: 'no comment', code: 10 } }, 400); return J({ id: 'cm1' }); }
  }
  // --- reels: Graph start/finish, the hosted-file upload on rupload, and the processing status
  if (url.endsWith('/111/video_reels')) { const p = Object.fromEntries(new URLSearchParams(init.body)); graphCalls.push({ url, p }); if (p.upload_phase === 'start') { const n = ++reelNo; return J({ video_id: 'vid' + n, upload_url: 'https://rupload.facebook.com/video-upload/v27.0/vid' + n }); } return J({ success: true, post_id: '111_' + p.video_id }); }
  if (url.startsWith('https://rupload.facebook.com/')) { ruploads.push({ url, headers: init.headers }); return init.headers.file_url.endsWith('bad.mp4') ? J({ error: { message: 'file not reachable' } }, 400) : J({ success: true }); }
  if (/^https:\/\/graph\.facebook\.com\/v27\.0\/vid\d+\?fields=status/.test(url)) return J({ status: { video_status: url.includes('/vid3?') ? 'error' : 'ready' } });
  throw new Error('unexpected fetch ' + url);
};

(async () => {
  await import('./functions/publish-due/index.ts');
  const call = (headers, body) => handler({ headers: { get: (k) => headers[k] }, json: async () => body || {} });
  assert.strictEqual((await call({})).status, 403, 'no secret must be refused');
  assert.strictEqual((await call({ 'x-cron-secret': 'wrong' })).status, 403);

  const r = await (await call({ 'x-cron-secret': 's3cret' })).json();
  assert.strictEqual(r.claimed, 5);
  assert.strictEqual(patches.a.status, 'posted'); assert.strictEqual(patches.a.fb_post_id, '111_' + 'ক্যাপশন ১'.length); assert.ok(!('comment_status' in patches.a));
  assert.strictEqual(patches.b.status, 'posted'); assert.strictEqual(patches.b.comment_status, 'posted');
  assert.strictEqual(patches.c.status, 'failed'); assert.match(patches.c.error, /not in FB_PAGES/);
  assert.strictEqual(patches.d.status, 'queued', 'first failure is retried later'); assert.ok(new Date(patches.d.scheduled_at) > new Date());
  assert.strictEqual(patches.e.status, 'posted', 'photo is live, so never re-queued'); assert.strictEqual(patches.e.comment_status, 'failed');
  const photo = graphCalls.find((g) => g.url.endsWith('/111/photos')).p;
  assert.strictEqual(photo.url, 'https://x.supabase.co/storage/v1/object/public/cards/one.png'); assert.strictEqual(photo.published, 'true'); assert.strictEqual(photo.access_token, 'TOK');
  assert.ok(!JSON.stringify(patches).includes('TOK'), 'the token must never be stored');
  assert.strictEqual(deleted.length, 1, 'old image copy is removed'); assert.deepStrictEqual(patches.old1, { image_deleted: true });

  rows[3].attempts = 3; patches.d = null; rows.length = 4; rows.splice(0, 3);   // only 'd' left, already on its 3rd try
  await call({ 'x-cron-secret': 's3cret' });
  assert.strictEqual(patches.d.status, 'failed', 'third failure is final');
  // --- reels (three of them: fine / upload refused / processing error)
  rows.length = 0; rows.push(
    { id: 'r1', kind: 'reel', page_key: 'main', image_path: 'reel1.mp4', caption: 'রিলের ক্যাপশন', first_comment: null, attempts: 1 },
    { id: 'r2', kind: 'reel', page_key: 'main', image_path: 'bad.mp4', caption: 'x', first_comment: null, attempts: 1 },
    { id: 'r3', kind: 'reel', page_key: 'main', image_path: 'broken.mp4', caption: 'y', first_comment: null, attempts: 1 });
  for (const k of Object.keys(patches)) delete patches[k]; graphCalls.length = 0;
  const rr = await (await call({ 'x-cron-secret': 's3cret' })).json(); assert.strictEqual(rr.claimed, 3);
  assert.strictEqual(patches.r1.status, 'posted'); assert.strictEqual(patches.r1.fb_post_id, '111_vid1');
  const fin = graphCalls.find((g) => g.p.upload_phase === 'finish'); assert.strictEqual(fin.p.video_state, 'PUBLISHED'); assert.strictEqual(fin.p.description, 'রিলের ক্যাপশন'); assert.strictEqual(fin.p.video_id, 'vid1');
  assert.strictEqual(ruploads[0].headers.Authorization, 'OAuth TOK'); assert.strictEqual(ruploads[0].headers.file_url, 'https://x.supabase.co/storage/v1/object/public/cards/reel1.mp4'); assert.ok(ruploads[0].url.endsWith('/vid1'));
  assert.strictEqual(patches.r2.status, 'queued'); assert.match(patches.r2.error, /file not reachable/); assert.ok(!graphCalls.some((g) => g.p.upload_phase === 'finish' && g.p.video_id === 'vid2'), 'a refused upload is never published');
  assert.strictEqual(patches.r3.status, 'queued'); assert.match(patches.r3.error, /could not process/);
  assert.ok(!JSON.stringify(patches).includes('TOK'), 'the token must never be stored');
  assert.ok(!graphCalls.some((g) => g.url.endsWith('/comments') && g.p.message === 'রিলের কমেন্ট'), 'a reel is not commented inline');

  // --- a posted reel whose comment is waiting gets it in the next run
  rows.length = 0; waiting.push({ id: 'w1', page_key: 'main', fb_post_id: '111_vid1', first_comment: 'রিলের কমেন্ট' }, { id: 'w2', page_key: 'gone', fb_post_id: '9_9', first_comment: 'x' }, { id: 'w3', page_key: 'main', fb_post_id: '111_bad', first_comment: 'x' });
  for (const k of Object.keys(patches)) delete patches[k]; graphCalls.length = 0;
  await call({ 'x-cron-secret': 's3cret' });
  const cm = graphCalls.find((g) => g.url.endsWith('/111_vid1/comments')); assert.strictEqual(cm.p.message, 'রিলের কমেন্ট'); assert.strictEqual(patches.w1.comment_status, 'posted');
  assert.strictEqual(patches.w2.comment_status, 'failed'); assert.strictEqual(patches.w3.comment_status, 'failed'); assert.match(patches.w3.error, /comment failed/);
  console.log('ok: all checks passed');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
