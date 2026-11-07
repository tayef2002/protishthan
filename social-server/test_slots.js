// Checks how cards are spread over the daily slots (Bangladesh time, +06:00):  node test_slots.js
const assert = require('assert'); const { slotTimes } = require('./social_queue');
const bd = (d) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' }).slice(0, 16);
const at = (iso) => Date.parse(iso);

// first run: now is 2026-11-07 09:30 (BD) -> the 08:00 slot is gone, start with 13:00
let r = slotTimes(6, at('2026-11-07T09:30:00+06:00')).map(bd);
assert.deepStrictEqual(r, ['2026-11-07 13:00', '2026-11-07 18:00', '2026-11-07 22:00', '2026-11-08 08:00', '2026-11-08 13:00', '2026-11-08 18:00']);

// continuing after the last queued post (2026-11-08 13:00): next card takes the 18:00 slot, nothing is skipped or doubled
r = slotTimes(3, at('2026-11-08T13:00:00+06:00')).map(bd);
assert.deepStrictEqual(r, ['2026-11-08 18:00', '2026-11-08 22:00', '2026-11-09 08:00']);

// late evening: after 22:00 the next slot is tomorrow morning (also when UTC date differs from BD date)
r = slotTimes(2, at('2026-11-07T23:30:00+06:00')).map(bd);
assert.deepStrictEqual(r, ['2026-11-08 08:00', '2026-11-08 13:00']);
r = slotTimes(1, at('2026-11-07T01:00:00+06:00')).map(bd);   // 2026-11-06 19:00 UTC, but 07 Nov in Dhaka
assert.deepStrictEqual(r, ['2026-11-07 08:00']);
console.log('ok: slot checks passed');
