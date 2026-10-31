#!/usr/bin/env node
/* Protishthan — sends the rows prepared by import.mjs straight to the database, no copy-paste into the SQL Editor.
 *
 *   1) node tools/import-institutions/import.mjs banbeis-2024.csv --source banbeis-2024 --source-url https://...   (makes out/rows.json)
 *   2) in PowerShell, in YOUR OWN terminal (never paste the key into a chat):
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
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const BATCH = 500;
const file = path.join(HERE, 'out', 'rows.json');
if(!fs.existsSync(file)){ console.error('out/rows.json not found. Run import.mjs first.'); process.exit(1); }
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
const source = rows.length ? rows[0].source : '';
console.log('Rows prepared:', rows.length, '| source:', source);
if(DRY){ console.log('--dry: nothing is sent.'); process.exit(0); }
if(!KEY){ console.error('Set SUPABASE_SERVICE_KEY first (see the top of this file).'); process.exit(1); }

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
console.log('\nDone. Check in the SQL Editor:  select count(*) from public.listing_submissions where source = \'' + source + '\';');
