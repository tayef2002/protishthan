// One-time setup helper:  node social_setup.js
// 1) creates social-server/.env (you paste the project URL and the service key into it yourself)
// 2) makes a random cron secret and writes ready-to-run SQL into 02_cron_SECRET.sql (git-ignored; do not share it)
// The secret is never printed on screen.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const envFile = path.join(__dirname, '.env');
let env = '';
if (fs.existsSync(envFile)) env = fs.readFileSync(envFile, 'utf8');
if (!/CRON_SECRET=/.test(env)) env = (env ? env.replace(/\s*$/, '\n') : 'SUPABASE_URL=PASTE_PROJECT_URL_HERE\nSUPABASE_SERVICE_KEY=PASTE_SERVICE_ROLE_KEY_HERE\n') + 'CRON_SECRET=' + crypto.randomBytes(24).toString('hex') + '\n';
if (!/SUPABASE_URL=/.test(env)) env = 'SUPABASE_URL=PASTE_PROJECT_URL_HERE\nSUPABASE_SERVICE_KEY=PASTE_SERVICE_ROLE_KEY_HERE\n' + env;
fs.writeFileSync(envFile, env);

const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1] || '';
const url = get('SUPABASE_URL').trim().replace(/\/+$/, ''), secret = get('CRON_SECRET').trim();
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) { console.log('.env তৈরি হয়েছে: ' + envFile + '\nএবার SUPABASE_URL আর SUPABASE_SERVICE_KEY বসান (নিজে, ফাইল খুলে), তারপর এই কমান্ড আবার চালান।'); process.exit(0); }
const sql = `-- Run this in the SQL Editor of the protishthan-social project (after 01_schema.sql). Contains a secret: do not share.
insert into public.social_config (key, value) values
  ('function_url', '${url}/functions/v1/publish-due'),
  ('cron_secret',  '${secret}')
on conflict (key) do update set value = excluded.value;

select cron.schedule('fb-publisher', '* * * * *', 'select public.run_publisher()');
`;
fs.writeFileSync(path.join(__dirname, '02_cron_SECRET.sql'), sql);
console.log('02_cron_SECRET.sql তৈরি হয়েছে। এটার ভেতরের লেখা কপি করে Supabase SQL Editor-এ Run করুন।');
console.log('Edge Function-এর Secrets-এ CRON_SECRET-এর মান বসাতে .env ফাইল থেকে CRON_SECRET= এর পরের লেখাটা কপি করুন (কাউকে পাঠাবেন না)।');
