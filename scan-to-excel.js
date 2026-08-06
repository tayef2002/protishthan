/**
 * Batch Student Form Scanner
 * Usage: node scan-to-excel.js <folder-path>
 * Example: node scan-to-excel.js "C:\Users\Tayef\Desktop\forms"
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const PROMPT = `তুমি একজন অভিজ্ঞ বাংলা হস্তলিপি বিশেষজ্ঞ। এটি একটি বাংলাদেশি মাদ্রাসা বা স্কুলের ছাত্র ভর্তি ফর্ম। প্রতিটি field অত্যন্ত সতর্কতার সাথে পড়ো।

## গুরুত্বপূর্ণ নির্দেশনা:

### ফোন নম্বর (CRITICAL):
- বাংলাদেশের সব মোবাইল নম্বর ০১ দিয়ে শুরু হয় (যেমন ০১৭..., ০১৮..., ০১৯..., ০১৩...)
- বাংলা সংখ্যা মনোযোগ দিয়ে পড়ো: ০=০, ১=১, ২=২, ৩=৩, ৪=৪, ৫=৫, ৬=৬, ৭=৭, ৮=৮, ৯=৯
- ১ এবং ৬ গুলিয়ে ফেলো না — ১ সরু, ৬ গোলাকার
- নম্বরটি ঠিকমতো ১১ সংখ্যার হওয়া উচিত

### জন্ম তারিখ (CRITICAL):
- format: দিন-মাস-বছর (যেমন: ০৭-০১-২০১০)
- মাস ০১-১২, দিন ০১-৩১, বছর ১৯৯৫-২০১৮

### লিঙ্গ (gender):
- "ছেলে" অথবা "মেয়ে" — না পেলে খালি

### নতুন/পুরাতন checkbox:
- ফর্মে দুটি বক্স থাকে: "নতুন" এবং "পুরাতন"
- যেটিতে টিক (✓) বা X বা দাগ আছে সেটি নির্বাচিত

### ঠিকানার field boundary:
- বর্তমান ঠিকানায় আলাদা আলাদা ঘর আছে: গ্রাম/মহল্লা, ডাক, উপজেলা, জেলা
- প্রতিটি ঘরের লেখা শুধু সেই ঘরেই নাও
- "ঐ" বা "উপরের মতো" লেখা থাকলে সেটা আগের ঠিকানার মতোই

শুধু নিচের JSON return করো, কোনো ব্যাখ্যা বা markdown নয়:
{"form_no":"","shikkha_borsho_hijri":"","shikkha_borsho_english":"","dakhila_no":"","notun_puraton":"","name":"","gender":"","dob":"","father_name":"","mother_name":"","present_address_village":"","present_address_post":"","present_address_upazila":"","present_address_district":"","permanent_address_village":"","permanent_address_post":"","permanent_address_upazila":"","permanent_address_district":"","guardian_name":"","mobile":"","student_relation":"","prev_institution":"","prev_class":"","desired_class":"","dept":"","fee_amount":""}

চূড়ান্ত নিয়ম: যে field পাওয়া যায়নি সেটা খালি "" রাখো। শুধু JSON, অন্য কিছু নয়।`;

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
const CONCURRENCY = 5; // একসাথে কতটা scan হবে
const DELAY_MS = 500;  // প্রতি batch এর মাঝে বিরতি

function getMimeType(ext) {
  const map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' };
  return map[ext.toLowerCase()] || 'image/jpeg';
}

async function scanImage(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = getMimeType(ext);
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString('base64');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://protishthan.pages.dev',
      'X-Title': 'Protishthan Student Scan',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: PROMPT }
        ]
      }],
      temperature: 0.1,
      max_tokens: 1024
    })
  });

  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'API error');

  let raw = json.choices?.[0]?.message?.content?.trim() || '{}';
  raw = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
  raw = raw.replace(/ /g, '');
  return JSON.parse(raw);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runBatch(items, onDone) {
  await Promise.all(items.map(async ({ file, className, index, total }) => {
    try {
      const data = await scanImage(file);
      onDone({ file, className, index, total, data, error: null });
    } catch (e) {
      onDone({ file, className, index, total, data: null, error: e.message });
    }
  }));
}

function toCsv(rows) {
  // Column order matches exactly what students.html imports
  const headers = [
    'নাম',                  // full_name — REQUIRED
    'শ্রেণী',               // class_name — REQUIRED (Classes page এর নামের সাথে মিলতে হবে)
    'পিতার নাম',            // father guardian
    'পিতার মোবাইল',         // father whatsapp
    'মাতার নাম',            // mother guardian
    'মাতার মোবাইল',         // mother whatsapp
    'লিঙ্গ',                // gender: ছেলে / মেয়ে
    'জন্মতারিখ',            // dob: YYYY-MM-DD (e.g. 2012-05-10)
    'শিক্ষার্থীর মোবাইল',   // student phone
    'বর্তমান গ্রাম',
    'বর্তমান ডাক',
    'বর্তমান উপজেলা',
    'বর্তমান জেলা',
    'স্থায়ী গ্রাম',
    'স্থায়ী ডাক',
    'স্থায়ী উপজেলা',
    'স্থায়ী জেলা',
    'অভিভাবকের নাম',
    'সম্পর্ক',
    'আগের প্রতিষ্ঠান',
    'আগের শ্রেণী',
    'বিভাগ',
    'মাসিক ফি',
    'দাখিলা নং',
    'ফর্ম নং',
    'নতুন/পুরাতন',
    'শিক্ষাবর্ষ হিজরি',
    'শিক্ষাবর্ষ ইংরেজি',
    'ছবির ফাইল',
    'error'
  ];

  const lines = [headers.join(',')];
  for (const row of rows) {
    const d = row.data || {};
    const cols = [
      d.name || '',
      row.className || d.desired_class || '',  // folder নাম = শ্রেণী (সবচেয়ে নির্ভরযোগ্য)
      d.father_name || '',
      d.mobile || '',          // পিতার মোবাইল (ফর্মে guardian mobile = father)
      d.mother_name || '',
      '',                      // মাতার মোবাইল (ফর্মে সাধারণত থাকে না)
      d.gender || '',
      d.dob || '',             // AI দেয় DD-MM-YYYY — import এ parseDob() handle করবে
      '',                      // শিক্ষার্থীর মোবাইল (ফর্মে আলাদা থাকলে)
      d.present_address_village || '',
      d.present_address_post || '',
      d.present_address_upazila || '',
      d.present_address_district || '',
      d.permanent_address_village || '',
      d.permanent_address_post || '',
      d.permanent_address_upazila || '',
      d.permanent_address_district || '',
      d.guardian_name || '',
      d.student_relation || '',
      d.prev_institution || '',
      d.prev_class || '',
      d.dept || '',
      d.fee_amount || '',
      d.dakhila_no || '',
      d.form_no || '',
      d.notun_puraton || '',
      d.shikkha_borsho_hijri || '',
      d.shikkha_borsho_english || '',
      path.basename(row.file),
      row.error || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(cols.join(','));
  }
  return lines.join('\n');
}

async function main() {
  const folderArg = process.argv[2];
  if (!folderArg) {
    console.error('❌ ব্যবহার: node scan-to-excel.js "ছবির ফোল্ডার পাথ"');
    console.error('   উদাহরণ: node scan-to-excel.js "C:\\Users\\Tayef\\Desktop\\forms"');
    process.exit(1);
  }

  if (!OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY পাওয়া যায়নি। .env ফাইল চেক করুন।');
    process.exit(1);
  }

  const folder = path.resolve(folderArg);
  if (!fs.existsSync(folder)) {
    console.error(`❌ ফোল্ডার পাওয়া যায়নি: ${folder}`);
    process.exit(1);
  }

  // Sub-folder গুলোও scan করবে, folder নাম = শ্রেণীর নাম
  const files = [];
  function collectImages(dir, className) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        collectImages(full, e.name); // folder নাম = class
      } else if (IMAGE_EXTS.includes(path.extname(e.name).toLowerCase())) {
        files.push({ file: full, className });
      }
    }
  }
  collectImages(folder, '');

  if (files.length === 0) {
    console.error('❌ ফোল্ডারে কোনো ছবি নেই (.jpg/.png/.webp)');
    process.exit(1);
  }

  // শ্রেণী অনুযায়ী summary দেখাও
  const classCounts = {};
  for (const f of files) {
    classCounts[f.className || 'অজানা'] = (classCounts[f.className || 'অজানা'] || 0) + 1;
  }
  console.log(`\n📁 ফোল্ডার: ${folder}`);
  console.log(`🖼️  মোট ছবি: ${files.length} টি`);
  for (const [cls, cnt] of Object.entries(classCounts)) {
    console.log(`   📂 ${cls}: ${cnt} টি`);
  }
  console.log(`⚡ একসাথে: ${CONCURRENCY} টি scan হবে\n`);

  const results = [];
  let done = 0;

  // CONCURRENCY অনুযায়ী batch তৈরি
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY).map((item, j) => ({
      file: item.file, className: item.className, index: i + j + 1, total: files.length
    }));

    await runBatch(batch, (result) => {
      done++;
      const bar = '█'.repeat(Math.floor(done / files.length * 20)).padEnd(20, '░');
      const status = result.error ? '❌' : '✅';
      const name = result.data?.name || '?';
      process.stdout.write(`\r[${bar}] ${done}/${files.length} ${status} ${path.basename(result.file)} → ${name}    `);
      results.push(result);
    });

    if (i + CONCURRENCY < files.length) await sleep(DELAY_MS);
  }

  console.log('\n\n✅ Scan সম্পন্ন!\n');

  const successCount = results.filter(r => !r.error).length;
  const errorCount = results.filter(r => r.error).length;
  console.log(`✅ সফল: ${successCount} টি`);
  if (errorCount > 0) console.log(`❌ ব্যর্থ: ${errorCount} টি`);

  // CSV তৈরি
  const csvContent = '﻿' + toCsv(results); // BOM for Excel Bengali support
  const outFile = path.join(folder, `students_${Date.now()}.csv`);
  fs.writeFileSync(outFile, csvContent, 'utf8');

  console.log(`\n📊 Excel ফাইল তৈরি হয়েছে:`);
  console.log(`   ${outFile}`);
  console.log(`\n💡 Excel এ open করুন → review করুন → ভুল ঠিক করুন`);
  console.log(`   এরপর Protishthan এ import করুন।\n`);
}

main().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });
