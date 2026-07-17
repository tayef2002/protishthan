const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GEMINI_API_KEYS = (process.env.GEMINI_API_KEYS || '').split(',').filter(Boolean);
let geminiKeyIndex = 0;
const geminiKeyBadUntil = {}; // tracks keys with limit:0 or 429

function getGeminiKey() {
  const now = Date.now();
  // Try each key starting from current index, skip bad ones
  for(let i = 0; i < GEMINI_API_KEYS.length; i++){
    const idx = (geminiKeyIndex + i) % GEMINI_API_KEYS.length;
    const key = GEMINI_API_KEYS[idx];
    if(!geminiKeyBadUntil[key] || geminiKeyBadUntil[key] < now){
      geminiKeyIndex = (idx + 1) % GEMINI_API_KEYS.length;
      return key;
    }
  }
  // All keys bad — use first one anyway
  return GEMINI_API_KEYS[0];
}

function markKeyBad(key, minutes = 60){
  geminiKeyBadUntil[key] = Date.now() + minutes * 60 * 1000;
  console.log(`Key ...${key.slice(-8)} marked bad for ${minutes} min`);
}
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];


  // Tashkeel word suggestions endpoint
  if (urlPath === '/api/tashkeel-word') {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const word = params.get('word') || '';
    const context = params.get('context') || '';
    if (!word.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'empty word' })); return;
    }
    const prompt = `أنت خبير في اللغة العربية والتشكيل والنحو. الكلمة المطلوبة هي: "${word}"
السياق الكامل: "${context || word}"

أعطني 5 طرق صحيحة نحوياً وصرفياً لتشكيل هذه الكلمة. كل طريقة يجب أن تكون صحيحة لغوياً وممكنة في السياق العربي. أرجع فقط الكلمات مفصولة بفاصلة (،) بدون أي شرح أو ترقيم.`;
    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'أنت عالم في اللغة العربية والتشكيل والنحو والصرف. تُعطي تشكيلات بديلة صحيحة للكلمات العربية.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 200
    });
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', d => data += d);
      apiRes.on('end', () => {
        try {
          const json = JSON.parse(data);
          let raw = json.choices?.[0]?.message?.content?.trim() || '';
          // Parse comma-separated words
          let suggestions = raw.split(/[,،\n\r]+/).map(s => s.trim()).filter(s => s.length > 0 && /[؀-ۿ]/.test(s));
          // Remove hamza from alif
          suggestions = suggestions.map(s => s.replace(/أ/g,'ا').replace(/إ/g,'ا'));
          // Ensure original word is in list
          if (!suggestions.includes(word)) suggestions.unshift(word);
          suggestions = suggestions.slice(0, 5);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ suggestions }));
        } catch(e) {
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'parse error' }));
        }
      });
    });
    apiReq.on('error', (e) => {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: e.message }));
    });
    apiReq.write(body);
    apiReq.end();
    return;
  }

  // Tashkeel proxy via Gemini API
  if (urlPath === '/api/tashkeel') {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const text = params.get('text') || '';
    if (!text.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'empty text' })); return;
    }
    const prompt = `أنت خبير في التشكيل والتجويد. ضع التشكيل الكامل الدقيق على كل حرف بدون استثناء. تنبيه مهم: الألف في بداية الكلام تأخذ فتحة (اَ)، ولا تنسَ الشدة مع حركتها على الحروف المشددة.

أمثلة صحيحة (لاحظ الفتحة على الألف في أول الكلام):
- اَلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ
- اَلْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ
- بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
- إِنَّ اللَّهَ بِكُلِّ شَيْءٍ عَلِيمٌ

تنبيه إضافي: حروف المد (الواو بعد ضمة والياء بعد كسرة) تأخذ سكوناً:
- الْعَالَمِيْنَ (ياء المد تأخذ سكوناً)
- الرَّحِيْمِ (ياء المد تأخذ سكوناً)
- يَقُوْلُ (واو المد تأخذ سكوناً)

الآن شكّل هذا النص بالكامل وأرجعه فقط بدون أي شرح:\n${text}`;
    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'أنت عالم في اللغة العربية والتشكيل والتجويد. تُضيف الشكل الكامل على كل حرف بدقة عالية. لا تنسى الشدة أبداً على الحروف المشددة مثل: لَّ وبِّ وسَّ ورَّ وغيرها.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 2048
    });
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', d => data += d);
      apiRes.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('Groq response:', JSON.stringify(json).substring(0, 500));
          let result = json.choices?.[0]?.message?.content?.trim() || '';
          // Remove hamza from alif (Hafizi Quran style: no hamza on alif)
          result = result.replace(/أ/g, 'ا');  // alif with hamza above → plain alif
          result = result.replace(/إ/g, 'ا');  // alif with hamza below → plain alif
          // Remove fatha from alif-lam wasla in middle of sentence (after space)
          result = result.replace(/ اَ(ل)/g, ' ا');
          // Normalize: ensure shadda comes before vowel (fixes font rendering of shadda+kasra etc.)
          // Add sukoon on madd ya (kasra+ya) and madd waw (damma+waw) if no mark already
          result = result.replace(/ِي(?![ً-ْٟ])/g, 'ِيْ');
          result = result.replace(/ُو(?![ً-ْٟ])/g, 'ُوْ');
          result = result.replace(/([ً-َُِْ])ّ/g, 'ّ$1');
          // 4) Dagger alif: after normalization lam+shadda+fatha+ha -> dagger alif
          result = result.replace(/لَّ(ه)/g, 'لّٰ$1');
          // 5) Dagger alif: lam+fatha+alif-maqsura (u0639u064eu0644u064eu0649 style) -> dagger alif on lam
          result = result.replace(/لَى/g, 'لٰى');
          // 6) General sukoon: Arabic letter not followed by harakat/shadda/dagger-alif, but followed by another Arabic letter -> add sukoon
          result = result.replace(/[ء-ئب-ه](?![ً-ْٰ])(?=[ء-ي])/g, function(m){ return m + 'ْ'; });
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ result }));
        } catch(e) {
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'parse error' }));
        }
      });
    });
    apiReq.on('error', (e) => {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: e.message }));
    });
    apiReq.write(body);
    apiReq.end();
    return;
  }

  // Scan form endpoint
  if (urlPath === '/api/scan-form' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { image, mimeType } = JSON.parse(body);
        if (!image) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'no image' })); return;
        }
        const prompt = `তুমি একজন অভিজ্ঞ বাংলা হস্তলিপি বিশেষজ্ঞ। এটি একটি বাংলাদেশি মাদ্রাসা বা স্কুলের ছাত্র ভর্তি ফর্ম। প্রতিটি field অত্যন্ত সতর্কতার সাথে পড়ো।

## গুরুত্বপূর্ণ নির্দেশনা:

### ফোন নম্বর (CRITICAL):
- বাংলাদেশের সব মোবাইল নম্বর ০১ দিয়ে শুরু হয় (যেমন ০১৭..., ০১৮..., ০১৯..., ০১৩...)
- বাংলা সংখ্যা মনোযোগ দিয়ে পড়ো: ০=০, ১=১, ২=২, ৩=৩, ৪=৪, ৫=৫, ৬=৬, ৭=৭, ৮=৮, ৯=৯
- ১ এবং ৬ গুলিয়ে ফেলো না — ১ সরু, ৬ গোলাকার
- নম্বরটি ঠিকমতো ১১ সংখ্যার হওয়া উচিত

### নতুন/পুরাতন checkbox:
- ফর্মে দুটি বক্স থাকে: "নতুন" এবং "পুরাতন"
- যেটিতে টিক (✓) বা X বা দাগ আছে সেটি নির্বাচিত
- মনোযোগ দিয়ে কোন বক্সে চিহ্ন আছে তা দেখো

### ঠিকানার field boundary:
- বর্তমান ঠিকানায় আলাদা আলাদা ঘর আছে: গ্রাম/মহল্লা, ডাক, উপজেলা, জেলা
- প্রতিটি ঘরের লেখা শুধু সেই ঘরেই নাও, পাশের ঘরের লেখা মেশাবে না
- "ঐ" বা "উপরের মতো" লেখা থাকলে সেটা আগের ঠিকানার মতোই

### জন্ম তারিখ (CRITICAL - অত্যন্ত গুরুত্বপূর্ণ):
- জন্ম তারিখের ঘরটি অত্যন্ত সতর্কতার সাথে পড়ো
- সাধারণত বাংলাদেশে format হয়: দিন-মাস-বছর (যেমন: ০৭-০১-২০১০ মানে ৭ জানুয়ারি ২০১০)
- প্রতিটি সংখ্যা আলাদাভাবে মনোযোগ দিয়ে পড়ো
- ০ এবং ৬ গুলিয়ে ফেলো না — ০ গোলাকার, ৬ এর উপর বাঁকা অংশ আছে
- ১ এবং ৭ গুলিয়ে ফেলো না — ১ সরু সোজা, ৭ এর উপর আনুভূমিক রেখা আছে
- ০ এবং ৮ গুলিয়ে ফেলো না
- দিন, মাস, বছর আলাদা আলাদা পড়ো এবং সংখ্যাগুলো ভালোভাবে confirm করো
- মাসের সংখ্যা ০১-১২ এর মধ্যে হবে, দিনের সংখ্যা ০১-৩১ এর মধ্যে হবে
- বছর সাধারণত ১৯৯৫-২০১৮ এর মধ্যে হবে
- যদি বছরের পরে "ইং" লেখা থাকে সেটা English year বোঝায়, সেটা বাদ দাও

### নাম পড়ার নিয়ম:
- পুরো নামটি সতর্কতার সাথে পড়ো
- বাংলা অক্ষর গুলিয়ে ফেলো না

### লিঙ্গ (gender):
- ফর্মে "ছাত্র/ছাত্রী" বা "ছেলে/মেয়ে" বা "Male/Female" চেকবক্স থাকতে পারে
- যেটিতে টিক বা চিহ্ন আছে সেটি নাও: "ছেলে" অথবা "মেয়ে"
- না পেলে খালি রাখো

### সম্পর্ক field:
- ছাত্রের সম্পর্ক মানে অভিভাবকের সাথে সম্পর্ক (যেমন: ভাই, চাচা, দাদা, মামা)
- পুরো শব্দটি লেখো, কেটে যাবে না

শুধু নিচের JSON return করো, কোনো ব্যাখ্যা বা markdown নয়:
{
  "form_no": "",
  "shikkha_borsho_hijri": "",
  "shikkha_borsho_english": "",
  "dakhila_no": "",
  "notun_puraton": "",
  "name": "",
  "gender": "",
  "dob": "",
  "father_name": "",
  "mother_name": "",
  "present_address_village": "",
  "present_address_post": "",
  "present_address_upazila": "",
  "present_address_district": "",
  "permanent_address_village": "",
  "permanent_address_post": "",
  "permanent_address_upazila": "",
  "permanent_address_district": "",
  "guardian_name": "",
  "mobile": "",
  "student_relation": "",
  "prev_institution": "",
  "prev_class": "",
  "desired_class": "",
  "dept": "",
  "fee_amount": ""
}

চূড়ান্ত নিয়ম:
- যে field পাওয়া যায়নি সেটা খালি "" রাখো
- "ঐ" বা একই চিহ্ন মানে আগের মতো — সেই মান copy করো
- শুধু JSON, অন্য কিছু নয়`;

        const requestBody = JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image}` } },
              { type: 'text', text: prompt }
            ]
          }],
          temperature: 0.1,
          max_tokens: 1024
        });

        function tryGemini(attemptsLeft) {
          const options = {
            hostname: 'openrouter.ai',
            path: '/api/v1/chat/completions',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'Protishthan Student Scan',
              'Content-Length': Buffer.byteLength(requestBody)
            }
          };
          const apiReq = https.request(options, apiRes => {
            let data = '';
            apiRes.on('data', d => data += d);
            apiRes.on('end', () => {
              fs.writeFileSync('gemini_debug.txt', data.substring(0, 3000));
              console.log('OpenRouter response:', data.substring(0, 300));
              try {
                const json = JSON.parse(data);
                if(json.error) {
                  res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                  res.end(JSON.stringify({ error: json.error.message || 'API error' }));
                  return;
                }
                let raw = json.choices?.[0]?.message?.content?.trim() || '{}';
                raw = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
                // Remove null bytes that cause Supabase error
                raw = raw.replace(/ /g, '');
                const student = JSON.parse(raw);
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ student }));
              } catch(e) {
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'parse error', raw: data.substring(0, 500) }));
              }
            });
          });
          apiReq.on('error', e => {
            res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: e.message }));
          });
          apiReq.write(requestBody);
          apiReq.end();
        }
        tryGemini(GEMINI_API_KEYS.length);
      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'invalid json' }));
      }
    });
    return;
  }

  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);

  // security: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log('Protishthan server running at http://localhost:' + PORT);
  console.log('Press Ctrl+C to stop.');
});
