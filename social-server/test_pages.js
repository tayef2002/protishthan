// Local check of social_pages.js with a fake Facebook:  node test_pages.js
const assert = require('assert'); const { buildPages } = require('./social_pages');
const pages = [{ id: '1', name: 'A', access_token: 'TA' }, { id: '2', name: 'B', access_token: 'TB' }, { id: '3', name: 'C', access_token: 'TC' }];
let calls = 0;
const f = async (url) => { calls++; assert.ok(url.includes('access_token=USERTOK')); return { json: async () => (calls === 1 ? { data: pages.slice(0, 2), paging: { next: 'https://graph.facebook.com/next?access_token=USERTOK' } } : { data: pages.slice(2) }) }; };
(async () => {
  const r = await buildPages(f, 'USERTOK', { main: '2', alt: '3' });
  assert.deepStrictEqual(r.out, { main: { page_id: '2', token: 'TB' }, alt: { page_id: '3', token: 'TC' } });
  assert.deepStrictEqual(r.names, ['main = B', 'alt = C']); assert.strictEqual(calls, 2, 'follows paging');
  await assert.rejects(() => buildPages(f, 'USERTOK', { x: '9' }), /তালিকায় নেই/);
  console.log('ok: social_pages checks passed');
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
