#!/usr/bin/env node
/* Protishthan — sends a board-results import file (see README) straight into the board_results table, with your own key from the git-ignored .env
 * (SUPABASE_SERVICE_ROLE_KEY): nothing to paste, nothing to upload in the Admin screen.
 *
 *   node tools/board-results/push.mjs data/board-results/comilla-ssc-2025.json            (add --dry first to only count)
 *
 * A row that already exists (same exam / year / board / EIIN / group) is replaced, so running it twice is safe. It sends 500 rows at a time and stops at the
 * first error. Only aggregate numbers are in these files (no student names, rolls or marks). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv.find((a, i) => i > 1 && !a.startsWith('--'));
const DRY = process.argv.includes('--dry');
if(!file){ console.error('Usage: node tools/board-results/push.mjs <file.json> [--dry]'); process.exit(1); }
const URL_BASE = (process.env.SUPABASE_URL || 'https://eoqeeuujvpydhmfteqqj.supabase.co').replace(/\/$/, '');
let KEY = process.env.SUPABASE_SERVICE_KEY || '';
if(!KEY){
  try{
    const env = fs.readFileSync(path.join(HERE, '..', '..', '.env'), 'utf8');
    const line = env.split(String.fromCharCode(10)).find(l => l.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY'));
    if(line) KEY = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
  }catch(e){}
}
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
const sig = new Set(rows.map(r => r.exam + ' ' + r.year + ' ' + r.board));
console.log('Rows:', rows.length, '| institutions:', rows.filter(r => r.grp === 'total').length, '|', [...sig].join(', '));
if(DRY){ console.log('--dry: nothing is sent.'); process.exit(0); }
if(!KEY){ console.error('No key found: put SUPABASE_SERVICE_ROLE_KEY in the project .env file.'); process.exit(1); }
const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' };
const sleep = ms => new Promise(s => setTimeout(s, ms));
let sent = 0;
for(let i = 0; i < rows.length; i += 500){
  const chunk = rows.slice(i, i + 500);
  let ok = false, last = '';
  for(let t = 0; t < 3 && !ok; t++){
    const r = await fetch(URL_BASE + '/rest/v1/board_results?on_conflict=exam,year,board,eiin,grp', { method: 'POST', headers, body: JSON.stringify(chunk) });
    if(r.ok) ok = true; else { last = r.status + ' ' + await r.text(); await sleep(3000 * (t + 1)); }
  }
  if(!ok){ console.error('\nStopped at rows ' + (i + 1) + '-' + (i + chunk.length) + ':', last); process.exit(1); }
  sent += chunk.length; process.stdout.write('\rsent ' + sent + ' / ' + rows.length);
}
console.log('\n\nDone. Check:  select exam, year, board, count(*) from public.board_results where grp = \'total\' group by 1, 2, 3;');
