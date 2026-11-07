// Checks how stock is spread over the daily pattern:  node test_plan.js
const assert = require('assert'); const { planSlots } = require('./social_plan');
const plan = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'plan.json'), 'utf8'));
const items = (k, n) => Array.from({ length: n }, (_, i) => ({ id: k + i, title: k + ' ' + i }));
const at = (iso) => Date.parse(iso);
const bd = (d) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' }).slice(0, 16);

// the pattern is 16 hourly slots (08:00 to 23:00): 9 text, 5 card, 2 reel
const kinds = Object.values(plan.slots); assert.strictEqual(kinds.length, 16);
assert.deepStrictEqual(['text', 'card', 'reel'].map((k) => kinds.filter((x) => x === k).length), [9, 5, 2]);

// a whole day with enough stock; reels are not enabled yet, so their 3 slots are skipped (not reported as missing)
let r = planSlots({ slots: plan.slots, tz: '+06:00', enabled: ['text', 'card'], now: at('2026-11-08T00:30:00+06:00'), days: 1, from: '2026-11-08', stock: { text: items('t', 20), card: items('c', 10), reel: [] }, occupied: [] });
assert.strictEqual(r.rows.length, 14); assert.deepStrictEqual(r.shortage, {});
assert.strictEqual(bd(r.rows[0].at), '2026-11-08 08:00'); assert.strictEqual(r.rows[0].item.id, 't0'); assert.strictEqual(r.rows[2].item.id, 'c0');   // 10:00 is the first card
assert.deepStrictEqual(r.rows.map((x) => x.item.id).filter((id) => id[0] === 't'), Array.from({ length: 9 }, (_, i) => 't' + i), 'stock is used in order');

// now is 12:30: earlier slots of the day are skipped
r = planSlots({ slots: plan.slots, tz: '+06:00', enabled: ['text', 'card'], now: at('2026-11-08T12:30:00+06:00'), days: 1, from: '2026-11-08', stock: { text: items('t', 20), card: items('c', 10), reel: [] }, occupied: [] });
assert.strictEqual(bd(r.rows[0].at), '2026-11-08 13:00');

// not enough stock: the slot stays empty and is counted
r = planSlots({ slots: plan.slots, tz: '+06:00', enabled: ['text', 'card'], now: at('2026-11-08T00:30:00+06:00'), days: 2, from: '2026-11-08', stock: { text: items('t', 12), card: items('c', 3), reel: [] }, occupied: [] });
assert.strictEqual(r.shortage.text, 6); assert.strictEqual(r.shortage.card, 7);
assert.strictEqual(r.rows.filter((x) => x.item).length, 15);

// a time that already holds a post is left alone
r = planSlots({ slots: plan.slots, tz: '+06:00', enabled: ['text', 'card'], now: at('2026-11-08T00:30:00+06:00'), days: 1, from: '2026-11-08', stock: { text: items('t', 20), card: items('c', 10), reel: [] }, occupied: [at('2026-11-08T08:05:00+06:00')] });
assert.ok(!r.rows.some((x) => bd(x.at) === '2026-11-08 08:00'));

// the university series (12 to 21 Nov): 08:00, 16:00 and 22:00 become "series" slots, in card order; days outside the range stay normal
assert.strictEqual(plan.overrides.length, 1); assert.ok(plan.enabled_kinds.includes('series'));
const all = { text: items('t', 200), card: items('c', 100), reel: items('r', 40), series: items('s', 30) };
r = planSlots({ slots: plan.slots, overrides: plan.overrides, tz: '+06:00', enabled: plan.enabled_kinds, now: at('2026-11-10T00:30:00+06:00'), days: 14, from: '2026-11-10', stock: all, occupied: [] });
const ser = r.rows.filter((x) => x.kind === 'series');
assert.strictEqual(ser.length, 30); assert.deepStrictEqual(r.shortage, {}); assert.strictEqual(ser[0].item.id, 's0'); assert.strictEqual(ser[29].item.id, 's29');
assert.deepStrictEqual(ser.slice(0, 4).map((x) => bd(x.at)), ['2026-11-12 08:00', '2026-11-12 16:00', '2026-11-12 22:00', '2026-11-13 08:00']);
assert.strictEqual(bd(ser[29].at), '2026-11-21 22:00');
assert.ok(!r.rows.some((x) => x.kind === 'series' && (bd(x.at) < '2026-11-12' || bd(x.at) > '2026-11-21 23')), 'nothing before 12 Nov or after 21 Nov');
assert.strictEqual(r.rows.filter((x) => bd(x.at).startsWith('2026-11-11') && x.kind === 'text').length, 9);   // a normal day keeps 9 text slots
assert.strictEqual(r.rows.filter((x) => bd(x.at).startsWith('2026-11-12') && x.kind === 'text').length, 6);   // a series day has 6 (3 were taken)
assert.strictEqual(r.rows.filter((x) => bd(x.at).startsWith('2026-11-22') && x.kind === 'text').length, 9);   // back to normal afterwards
// the series has no stock yet: its slots are reported as empty, the text slots are not touched
r = planSlots({ slots: plan.slots, overrides: plan.overrides, tz: '+06:00', enabled: plan.enabled_kinds, now: at('2026-11-10T00:30:00+06:00'), days: 4, from: '2026-11-10', stock: { text: items('t', 60), card: items('c', 20), reel: items('r', 6), series: [] }, occupied: [] });
assert.strictEqual(r.shortage.series, 6);
console.log('ok: plan checks passed');
