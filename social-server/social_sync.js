// Put finished cards from a folder into the STOCK on the server (nothing is posted yet).
//   node social_sync.js --dir=<folder> --kind=text|card [--page=main]
// Per card (same name, other extension):  "<name>.txt" = caption, "<name>.comment.txt" = first comment (optional).
// The cards appear on protishthan.com/content under "স্টক". social_plan.js then gives them times.
const fs = require('fs'), path = require('path');
const { loadEnv, client, addItem, readText } = require('./lib');
const arg = (n, d = '') => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const dir = arg('dir'), kind = arg('kind', 'card'), page = arg('page', 'main');
if (!dir || !['text', 'card', 'reel'].includes(kind)) { console.error('ব্যবহার: node social_sync.js --dir=<ফোল্ডার> --kind=text|card'); process.exit(1); }
if (kind === 'reel') { console.error('রিলস পোস্ট করার অংশ এখনও বানানো হয়নি।'); process.exit(1); }

(async () => {
  const sb = client(loadEnv()), doneFile = path.join(dir, '.synced.json'), done = fs.existsSync(doneFile) ? JSON.parse(fs.readFileSync(doneFile, 'utf8')) : {};
  const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort((a, b) => a.localeCompare(b, 'bn', { numeric: true })).filter((f) => !done[f]);
  if (!files.length) { console.log('নতুন কোনো কার্ড নেই (সবই আগে স্টকে তোলা হয়েছে)।'); return; }
  let n = 0;
  for (const f of files) {
    const stem = f.replace(/\.[^.]+$/, '');
    const id = await addItem(sb, { file: path.join(dir, f), kind, page, title: stem.replace(/^\d+\s*-\s*(\[[^\]]*\]\s*)?/, ''), sortKey: stem, caption: readText(path.join(dir, stem + '.txt')), comment: readText(path.join(dir, stem + '.comment.txt')) });
    done[f] = id; fs.writeFileSync(doneFile, JSON.stringify(done, null, 1)); n++; console.log('স্টকে তুললাম: ' + f);
  }
  console.log('\n' + n + 'টা কার্ড স্টকে। সময় ঠিক করতে: node social_plan.js');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
