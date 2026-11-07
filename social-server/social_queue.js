// Queue a folder of cards for Facebook. The images go from the folder straight to the Supabase server.
//   node social_queue.js --dir=<folder> --page=main [--slots=08:00,13:00,18:00,22:00] [--start=2026-11-10] [--tz=+06:00] [--go]
// Without --go it only prints the plan. Images are taken in file-name order, one per slot.
// Without --start the cards continue right after the last post already in the queue (or from the next free slot).
// Per card (same name, other extension):  "<name>.txt" = caption, "<name>.comment.txt" = first comment (both optional).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { loadEnv, client, addItem } = require('./lib');
const arg = (n, d = '') => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const kind = arg('kind', 'card'), dir = arg('dir'), page = arg('page', 'main'), start = arg('start'), slots = arg('slots', '08:00,13:00,18:00,22:00').split(','), tz = arg('tz', '+06:00'), go = process.argv.includes('--go');

// the next `count` slot instants strictly after `afterMs`, in the local time zone `tz`
function slotTimes(count, afterMs) {
  const sign = tz[0] === '-' ? -1 : 1, offMs = sign * ((+tz.slice(1, 3)) * 60 + (+tz.slice(4, 6))) * 60000;
  const baseDay = new Date(afterMs + offMs).toISOString().slice(0, 10), out = [];
  for (let d = 0; out.length < count; d++) for (const s of slots) { const t = Date.parse(baseDay + 'T' + s + ':00' + tz) + d * 86400000; if (t > afterMs && out.length < count) out.push(new Date(t)); }
  return out;
}
module.exports = { slotTimes };
if (require.main !== module) return;
if (!dir || (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) || !/^[+-]\d{2}:\d{2}$/.test(tz)) { console.error('ব্যবহার: node social_queue.js --dir=<ফোল্ডার> --page=main [--slots=08:00,13:00] [--start=YYYY-MM-DD] [--go]'); process.exit(1); }
for (const s of slots) if (!/^\d{2}:\d{2}$/.test(s)) { console.error('slot ভুল: ' + s); process.exit(1); }

const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/^﻿/, '').trim() : '');
const doneFile = path.join(dir, '.queued.json'); const done = fs.existsSync(doneFile) ? JSON.parse(fs.readFileSync(doneFile, 'utf8')) : {};
const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort((a, b) => a.localeCompare(b, 'bn', { numeric: true })).filter((f) => !done[f]);
if (!files.length) { console.log('নতুন কোনো ছবি নেই (সবগুলো আগেই লাইনে দেওয়া আছে)।'); process.exit(0); }

(async () => {
  let sb = null, afterMs = Date.now() + 10 * 60000, note = '';
  try { sb = client(loadEnv()); } catch (e) { if (go) throw e; note = '(সার্ভারের সাথে এখনও যোগ নেই, তাই এটা শুধু নমুনা: ' + e.message + ')'; }
  if (start) afterMs = Date.parse(start + 'T00:00:00' + tz) - 1;
  else if (sb) { const last = await sb.rest('fb_posts?select=scheduled_at&page_key=eq.' + encodeURIComponent(page) + '&order=scheduled_at.desc&limit=1'); if (last.length) afterMs = Math.max(afterMs, Date.parse(last[0].scheduled_at)); }
  const times = slotTimes(files.length, afterMs);
  const plan = files.map((f, i) => { const stem = f.replace(/\.[^.]+$/, ''); return { file: f, at: times[i], caption: read(path.join(dir, stem + '.txt')), comment: read(path.join(dir, stem + '.comment.txt')) }; });

  console.log('পেজ: ' + page + '   মোট ' + plan.length + 'টা ' + note + '\n');
  for (const p of plan) console.log(p.at.toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' }).slice(0, 16) + '  ' + p.file + (p.caption ? '' : '   (ক্যাপশন নেই)') + (p.comment ? '   +কমেন্ট' : ''));
  if (plan.some((p) => p.at.getTime() < Date.now() + 10 * 60000)) { console.error('\nসতর্কতা: কিছুর সময় এখনই বা পেরিয়ে গেছে। --start আরও পরে দিন।'); process.exit(1); }
  if (!go) { console.log('\nএটা শুধু নমুনা। সত্যিই লাইনে দিতে শেষে --go যোগ করুন।'); return; }

  for (const p of plan) {
    const stem = p.file.replace(/.[^.]+$/, '');
    await addItem(sb, { file: path.join(dir, p.file), kind, page, title: stem.replace(/^d+s*-s*([[^]]*]s*)?/, ''), sortKey: stem, caption: p.caption, comment: p.comment, scheduledAt: p.at.toISOString() });
    done[p.file] = p.at.toISOString(); fs.writeFileSync(doneFile, JSON.stringify(done, null, 1));
    console.log('লাইনে দিলাম: ' + p.file);
  }
  console.log('\nশেষ। অবস্থা দেখতে: node social_status.js');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
