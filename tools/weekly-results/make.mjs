// Makes the weekly "who is ahead" poster (1080x1350 and HD 2160x2700) and its Facebook caption from the LIVE boards of the card page.
//
//   node tools/weekly-results/make.mjs                       the whole country: divisions, the best districts and institutions
//   node tools/weekly-results/make.mjs --division ঢাকা       one division: its districts and best institutions
//   node tools/weekly-results/make.mjs --district হবিগঞ্জ    one district: its institutions
//   options: --date 2026-11-16 (the last day of the week, default today)  --min-total 30  --force  --sample
//
// The poster is made only when there is enough REAL data behind it (default: at least 3 rows and 30 cards in the week); --force overrides that.
// --sample draws invented numbers to check the design; such a file is marked "নমুনা" on the picture and in its name and must never be posted.
// Needs the competition_board SQL (migrations/2027-01-04_competition_board.sql) and Chrome. Output: "post card/" (pictures) and "ক্যাপশন/" (captions), both kept out of git.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { ROOT, loadConfig, buildModel, buildCaption, renderHtml, thinReason, weekRange, bn } from './lib.mjs';

const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null; };
const mode = opt('division') ? 'division' : opt('district') ? 'district' : 'country', value = mode === 'country' ? '' : String(opt(mode));
const end = opt('date') ? new Date(String(opt('date')) + 'T12:00:00') : new Date();
const minTotal = Number(opt('min-total')) || 30, force = !!opt('force'), sample = !!opt('sample');
const stamp = end.toISOString().slice(0, 10);

function sampleModel() {
  const mk = (names, ns, extra = {}) => names.map((nm, i) => Object.assign({ key: nm, name: nm, rank: i + 1, n: ns[i], total: ns[i] * 4, inst: 10 + i * 3 }, extra));
  const range = weekRange(end);
  if (mode === 'division') return { mode, value, range, title: value + ' বিভাগে এই সপ্তাহে এগিয়ে', mainTitle: 'জেলা', unit: 'শিক্ষিত কার্ড', main: mk(['জেলা ক', 'জেলা খ', 'জেলা গ', 'জেলা ঘ', 'জেলা ঙ'], [120, 90, 70, 40, 22]), instTitle: 'সেরা প্রতিষ্ঠান', inst: mk(['নমুনা স্কুল ১', 'নমুনা কলেজ ২', 'নমুনা মাদ্রাসা ৩'], [30, 22, 15], { inst: 1 }), instMax: 5 };
  if (mode === 'district') return { mode, value, range, title: value + ' জেলায় এই সপ্তাহে এগিয়ে', mainTitle: 'প্রতিষ্ঠান', unit: 'শিক্ষিত কার্ড', main: mk(['নমুনা স্কুল ১', 'নমুনা কলেজ ২', 'নমুনা মাদ্রাসা ৩', 'নমুনা স্কুল ৪'], [44, 31, 20, 12], { inst: 1, itype: 'স্কুল' }), inst: [], instMax: 0 };
  return { mode: 'country', value: '', range, title: 'শিক্ষিত কার্ডে এই সপ্তাহে কে এগিয়ে', mainTitle: 'বিভাগ', unit: 'শিক্ষিত কার্ড', main: mk(['ঢাকা (নমুনা)', 'চট্টগ্রাম (নমুনা)', 'সিলেট (নমুনা)', 'রাজশাহী (নমুনা)', 'খুলনা (নমুনা)', 'রংপুর (নমুনা)'], [310, 220, 140, 110, 90, 60]), dist: mk(['জেলা ক', 'জেলা খ', 'জেলা গ'], [140, 90, 60]), distTitle: 'সেরা ৫ জেলা', inst: mk(['নমুনা স্কুল ১', 'নমুনা কলেজ ২', 'নমুনা মাদ্রাসা ৩'], [30, 22, 15], { inst: 1 }), instTitle: 'সেরা ৩ প্রতিষ্ঠান', instMax: 3 };
}

// leave a moment before exiting: on Windows an immediate exit right after a network call prints a harmless but ugly libuv assertion
const quit = async code => { process.exitCode = code; await new Promise(r => setTimeout(r, 300)); process.exit(code); };

const model = sample ? sampleModel() : await buildModel(loadConfig(), mode, value, end);
const why = sample ? '' : thinReason(model, minTotal);
if (why && !force) { console.error('Not enough real data yet: ' + why + '. Nothing was made (use --force to make it anyway).'); await quit(2); }

let html = renderHtml(model);
if (sample) html = html.replace('</div></body>', '<div style="position:absolute;left:0;right:0;top:620px;text-align:center;font:700 120px HS,sans-serif;color:rgba(220,38,38,.34);transform:rotate(-14deg);pointer-events:none">নমুনা সংখ্যা</div></div></body>');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-'));
const page = path.join(tmp, 'poster.html'); fs.writeFileSync(page, html);
const chrome = process.env.CHROME || ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
if (!chrome) { console.error('Chrome not found (set the CHROME environment variable to its path).'); await quit(3); }

const label = (sample ? 'নমুনা - ' : '') + 'সাপ্তাহিক ফল - ' + (mode === 'country' ? 'সারা দেশ' : value) + ' - ' + stamp;
const outDir = path.join(ROOT, 'post card'), capDir = path.join(ROOT, 'ক্যাপশন');
fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(capDir, { recursive: true });
for (const [scale, suffix] of [[1, ''], [2, ' (HD 2160x2700)']]) {
  const file = path.join(outDir, label + suffix + '.png');
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--user-data-dir=' + path.join(tmp, 'prof'), '--window-size=1080,1350', '--force-device-scale-factor=' + scale, '--virtual-time-budget=8000', '--screenshot=' + file, 'file:///' + page.replace(/\\/g, '/')], { stdio: 'ignore' });
  console.log('wrote', file);
}
if (!sample) { const cap = path.join(capDir, label + '.txt'); fs.writeFileSync(cap, buildCaption(model)); console.log('wrote', cap); }
console.log((sample ? 'SAMPLE (invented numbers, do not post): ' : '') + model.main.length + ' rows, ' + bn(model.main.reduce((a, r) => a + r.n, 0)) + ' cards this week, ' + model.range);
fs.rmSync(tmp, { recursive: true, force: true });
