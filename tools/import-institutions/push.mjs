#!/usr/bin/env node
/* Protishthan — sends the rows prepared by import.mjs straight to the database, no copy-paste into the SQL Editor.
 *
 *   1) node tools/import-institutions/import.mjs banbeis-2024.csv --source banbeis-2024 --source-url https://...   (makes out/rows.json)
 *   2) the key is read from SUPABASE_SERVICE_ROLE_KEY in the project's .env file (git-ignored), or else set it yourself in YOUR OWN terminal (never paste it into a chat):
 *        $env:SUPABASE_SERVICE_KEY = "<the service_role key from Supabase > Project Settings > API>"
 *        node tools/import-institutions/push.mjs            (add --dry first to only count, nothing is sent)
 *
 * The key stays in that terminal window. It is a master key: close the window afterwards. Rows already in the table
 * (same source + source_id) are skipped, so running it twice is safe. It stops at the first error and tells you where. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry');
const URL_BASE = (process.env.SUPABASE_URL || 'https://eoqeeuujvpydhmfteqqj.supabase.co').replace(/\/$/, '');
// the key: from the SUPABASE_SERVICE_KEY variable, or else from SUPABASE_SERVICE_ROLE_KEY in the project's own (git-ignored) .env file
let KEY = process.env.SUPABASE_SERVICE_KEY || '';
let KEY_FROM = KEY ? 'the terminal variable' : '';
if(!KEY){
  try{
    const env = fs.readFileSync(path.join(HERE, '..', '..', '.env'), 'utf8');
    const line = env.split(String.fromCharCode(10)).find(l => l.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY'));
    if(line){ KEY = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, ''); KEY_FROM = 'the .env file'; }
  }catch(e){}
}
const BATCH = 500;
const file = path.join(HERE, 'out', 'rows.json');
if(!fs.existsSync(file)){ console.error('out/rows.json not found. Run import.mjs first.'); process.exit(1); }
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
const source = rows.length ? rows[0].source : '';
console.log('Rows prepared:', rows.length, '| source:', source);
if(DRY){ console.log('--dry: nothing is sent.'); process.exit(0); }
if(!KEY){ console.error('No key found: put SUPABASE_SERVICE_ROLE_KEY in the project .env file, or set SUPABASE_SERVICE_KEY (see the top of this file).'); process.exit(1); }
console.log('Using the key from ' + KEY_FROM + ' (not shown).');

const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
// what is already there from this source
const have = new Set();
for(let from = 0; ; from += 1000){
  const r = await fetch(URL_BASE + '/rest/v1/listing_submissions?select=source_id&source=eq.' + encodeURIComponent(source) + '&limit=1000&offset=' + from, { headers });
  if(!r.ok){ console.error('Could not read existing rows:', r.status, await r.text()); process.exit(1); }
  const part = await r.json(); part.forEach(x => have.add(String(x.source_id))); if(part.length < 1000) break;
}
const todo = rows.filter(x => !have.has(String(x.source_id)));
console.log('Already in the database:', have.size, '| to send:', todo.length);

let sent = 0;
for(let i = 0; i < todo.length; i += BATCH){
  const chunk = todo.slice(i, i + BATCH);
  const r = await fetch(URL_BASE + '/rest/v1/listing_submissions', { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(chunk) });
  if(!r.ok){ console.error('\nStopped at rows ' + (i + 1) + '-' + (i + chunk.length) + ':', r.status, await r.text()); console.error('Nothing after this point was sent. Fix the cause and run again: finished rows are skipped.'); process.exit(1); }
  sent += chunk.length; process.stdout.write('\rsent ' + sent + ' / ' + todo.length);
}

// e-mails: the full address goes into the closed table listing_private_contacts (the public row only has the masked hint)
const contactsFile = path.join(HERE, 'out', 'contacts.json');
if(fs.existsSync(contactsFile)){
  const contacts = JSON.parse(fs.readFileSync(contactsFile, 'utf8'));
  const ids = new Map();
  for(let from = 0; ; from += 1000){
    const r = await fetch(URL_BASE + '/rest/v1/listing_submissions?select=id,source_id&source=eq.' + encodeURIComponent(source) + '&limit=1000&offset=' + from, { headers });
    if(!r.ok){ console.error('Could not read ids:', r.status, await r.text()); process.exit(1); }
    const part = await r.json(); part.forEach(x => ids.set(String(x.source_id), x.id)); if(part.length < 1000) break;
  }
  const haveMail = new Set();
  for(let from = 0; ; from += 1000){
    const r = await fetch(URL_BASE + '/rest/v1/listing_private_contacts?select=listing_id&source=eq.' + encodeURIComponent(source) + '&limit=1000&offset=' + from, { headers });
    if(!r.ok){ console.error('Could not read the contacts table (did you run migrations/2026-11-16?):', r.status, await r.text()); process.exit(1); }
    const part = await r.json(); part.forEach(x => haveMail.add(x.listing_id)); if(part.length < 1000) break;
  }
  const mail = contacts.map(c => ({ listing_id: ids.get(String(c.source_id)), email: c.email, source: c.source })).filter(c => c.listing_id && !haveMail.has(c.listing_id));
  console.log('\nE-mails to store privately:', mail.length);
  let m = 0;
  for(let i = 0; i < mail.length; i += BATCH){
    const chunk = mail.slice(i, i + BATCH);
    const r = await fetch(URL_BASE + '/rest/v1/listing_private_contacts', { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(chunk) });
    if(!r.ok){ console.error('\nStopped storing e-mails at ' + (i + 1) + ':', r.status, await r.text()); process.exit(1); }
    m += chunk.length; process.stdout.write('\rstored ' + m + ' / ' + mail.length);
  }
  console.log('');
}
console.log('\nDone. Check in the SQL Editor:  select count(*) from public.listing_submissions where source = \'' + source + '\';');
