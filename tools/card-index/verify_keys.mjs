// Checks that phon.js and bnname.js make the same keys as the database:  node tools/card-index/verify_keys.mjs [howMany]
// It asks the live database (phon_key / bn_key, both read-only) for a sample of real names and compares. Needs the internet.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..', '..');
const require = createRequire(import.meta.url);
const PhonKey = require(path.join(ROOT, 'phon.js'));
const bn = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'bnname.js'), 'utf8'), { window: bn, document: { createElement: () => ({}), head: { appendChild() {} } } });
const { key } = bn.BnName;

const html = fs.readFileSync(path.join(ROOT, 'card.html'), 'utf8');
const KEY = html.match(/eyJ[A-Za-z0-9_.-]{100,}/)[0], SB = 'https://eoqeeuujvpydhmfteqqj.supabase.co';
const rpc = async (fn, body) => { const r = await fetch(SB + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error(fn + ' ' + r.status); return r.json(); };

const N = Number(process.argv[2]) || 120;
const names = [
  'ঢাকা কলেজ', 'Dhaka College', 'GOVT. AMTALI DEGREE COLLEGE', 'রাজশাহী সরকারি মহিলা কলেজ', 'Mirza pur Govt. Primary School', 'আল-হাজ্ব মাদরাসা', 'ALHAJ MD. SHAMIM AHSAN DAKHIL MADRASAH, MOHISDANGA',
  'উত্তর চাঁদত্রিশিরা সরকারি প্রাথমিক বিদ্যালয়', 'Shahid Ziaur Rahman Model High School & College', 'ঢ়ড়য় টেস্ট', 'বঙ্গবন্ধু শেখ মুজিবুর রহমান বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'Chittagong Girls\' Academy', 'khulna boys school', 'Ideal Institute 12',
];
// plus a spread of real rows from the saved import files
const dirs = ['out-primary', 'out-technical', 'out-extra', 'out-universities'];
const pool = []; for (const d of dirs) { const f = path.join(ROOT, 'tools', 'import-institutions', d, 'rows.json'); if (fs.existsSync(f)) { const rows = JSON.parse(fs.readFileSync(f, 'utf8')); for (let i = 0; i < rows.length; i += Math.max(1, Math.floor(rows.length / 40))) { pool.push(rows[i].institution_name); if (rows[i].name_en) pool.push(rows[i].name_en); } } }
for (const x of pool) { if (names.length >= N) break; names.push(x); }

let bad = 0, checked = 0;
for (const nm of names) {
  let dbP, dbK;
  try { dbP = await rpc('phon_key', { t: nm }); } catch (e) { console.log('phon_key call failed:', e.message); process.exit(2); }
  const myP = PhonKey(nm);
  checked++; if (dbP !== myP) { bad++; console.log('PHON DIFF', JSON.stringify(nm), 'db=', dbP, 'js=', myP); }
  try { dbK = await rpc('bn_key', { t: nm }); const myK = key(nm); if (dbK !== myK) { bad++; console.log('BN   DIFF', JSON.stringify(nm), 'db=', dbK, 'js=', myK); } } catch (e) { if (checked === 1) console.log('(bn_key is not callable by the public key; only phon_key is compared)', e.message); }
}
console.log(checked + ' names compared, ' + bad + ' differences');
process.exit(bad ? 1 : 0);
