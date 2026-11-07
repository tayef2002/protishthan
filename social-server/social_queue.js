// Queue a folder of cards for Facebook.
//   node social_queue.js --dir=<folder> --page=main --start=2026-11-10 --slots=08:00,13:00,18:00,22:00 [--tz=+06:00] [--go]
// Without --go it only prints the plan. Images are taken in file-name order.
// Per card (same name, other extension):  "<name>.txt" = caption, "<name>.comment.txt" = first comment (both optional).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { loadEnv, client } = require('./lib');
const arg = (n, d = '') => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const dir = arg('dir'), page = arg('page', 'main'), start = arg('start'), slots = arg('slots', '08:00,13:00,18:00,22:00').split(','), tz = arg('tz', '+06:00'), go = process.argv.includes('--go');
if (!dir || !/^\d{4}-\d{2}-\d{2}$/.test(start)) { console.error('ব্যবহার: node social_queue.js --dir=<ফোল্ডার> --page=main --start=YYYY-MM-DD --slots=08:00,13:00 [--go]'); process.exit(1); }
for (const s of slots) if (!/^\d{2}:\d{2}$/.test(s)) { console.error('slot ভুল: ' + s); process.exit(1); }

const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/^﻿/, '').trim() : '');
const doneFile = path.join(dir, '.queued.json'); const done = fs.existsSync(doneFile) ? JSON.parse(fs.readFileSync(doneFile, 'utf8')) : {};
const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort((a, b) => a.localeCompare(b, 'bn', { numeric: true })).filter((f) => !done[f]);
if (!files.length) { console.log('নতুন কোনো ছবি নেই (সবগুলো আগেই লাইনে দেওয়া আছে)।'); process.exit(0); }

const plan = files.map((f, i) => {
  const d0 = new Date(start + 'T' + slots[i % slots.length] + ':00' + tz); d0.setUTCDate(d0.getUTCDate() + Math.floor(i / slots.length));
  const stem = f.replace(/\.[^.]+$/, '');
  return { file: f, at: d0, caption: read(path.join(dir, stem + '.txt')), comment: read(path.join(dir, stem + '.comment.txt')) };
});
const now = Date.now(); const past = plan.filter((p) => p.at.getTime() < now + 10 * 60000);
console.log('পেজ: ' + page + '   মোট ' + plan.length + 'টা\n');
for (const p of plan) console.log(p.at.toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' }).slice(0, 16) + '  ' + p.file + (p.caption ? '' : '   (ক্যাপশন নেই)') + (p.comment ? '   +কমেন্ট' : ''));
if (past.length) { console.error('\nসতর্কতা: ' + past.length + 'টার সময় এখনই বা পেরিয়ে গেছে। --start আরও পরে দিন।'); process.exit(1); }
if (!go) { console.log('\nএটা শুধু নমুনা। সত্যিই লাইনে দিতে শেষে --go যোগ করুন।'); process.exit(0); }

(async () => {
  const sb = client(loadEnv());
  for (const p of plan) {
    const ext = path.extname(p.file).toLowerCase(), name = crypto.randomUUID() + (ext === '.png' ? '.png' : '.jpg');
    await sb.upload(name, fs.readFileSync(path.join(dir, p.file)), ext === '.png' ? 'image/png' : 'image/jpeg');
    await sb.rest('fb_posts', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ page_key: page, image_path: name, caption: p.caption, first_comment: p.comment || null, scheduled_at: p.at.toISOString() }) });
    done[p.file] = p.at.toISOString(); fs.writeFileSync(doneFile, JSON.stringify(done, null, 1));
    console.log('লাইনে দিলাম: ' + p.file);
  }
  console.log('\nশেষ। অবস্থা দেখতে: node social_status.js');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
