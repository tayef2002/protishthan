// Checks how stock is spread over the daily pattern:  node test_plan.js
const assert = require('assert'); const { planSlots } = require('./social_plan');
const plan = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'plan.json'), 'utf8'));
const items = (k, n) => Array.from({ length: n }, (_, i) => ({ id: k + i, title: k + ' ' + i }));
const at = (iso) => Date.parse(iso);
const bd = (d) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' }).slice(0, 16);

// the pattern is 17 hourly slots: 10 text, 4 card, 3 reel
const kinds = Object.values(plan.slots); assert.strictEqual(kinds.length, 17);
assert.deepStrictEqual(['text', 'card', 'reel'].map((k) => kinds.filter((x) => x === k).length), [10, 4, 3]);

// a whole day with enough stock; reels are not enabled yet, so their 3 slots are skipped (not reported as missing)
let r = planSlots({ slots: plan.slots, tz: '+06:00', enabled: ['text', 'card'], now: at('2026-11-08T00:30:00+06:00'), days: 1, from: '2026-11-08', stock: { text: items('t', 20), card: items('c', 10), reel: [] }, occupied: [] });
assert.strictEqual(r.rows.length, 14); assert.deepStrictEqual(r.shortage, {});
assert.strictEqual(bd(r.rows[0].at), '2026-11-08 06:00'); assert.strictEqual(r.rows[0].item.id, 't0'); assert.strictEqual(r.rows[2].item.id, 'c0');   // 08:00 is the first card
assert.deepStrictEqual(r.rows.map((x) => x.item.id).filter((id) => id[0] === 't'), Array.from({ length: 10 }, (_, i) => 't' + i), 'stock is used in order');

// now is 12:30: earlier slots of the day are skipped
r = planSlots({ slots: plan.slots, tz: '+06:00', enabled: ['text', 'card'], now: at('2026-11-08T12:30:00+06:00'), days: 1, from: '2026-11-08', stock: { text: items('t', 20), card: items('c', 10), reel: [] }, occupied: [] });
assert.strictEqual(bd(r.rows[0].at), '2026-11-08 13:00');

// not enough stock: the slot stays empty and is counted
r = planSlots({ slots: plan.slots, tz: '+06:00', enabled: ['text', 'card'], now: at('2026-11-08T00:30:00+06:00'), days: 2, from: '2026-11-08', stock: { text: items('t', 12), card: items('c', 3), reel: [] }, occupied: [] });
assert.strictEqual(r.shortage.text, 8); assert.strictEqual(r.shortage.card, 5);
assert.strictEqual(r.rows.filter((x) => x.item).length, 15);

// a time that already holds a post is left alone
r = planSlots({ slots: plan.slots, tz: '+06:00', enabled: ['text', 'card'], now: at('2026-11-08T00:30:00+06:00'), days: 1, from: '2026-11-08', stock: { text: items('t', 20), card: items('c', 10), reel: [] }, occupied: [at('2026-11-08T06:05:00+06:00')] });
assert.ok(!r.rows.some((x) => bd(x.at) === '2026-11-08 06:00'));
console.log('ok: plan checks passed');
