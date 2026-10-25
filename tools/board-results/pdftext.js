// Minimal PDF text extractor for the education boards' result-statistics PDFs.
// Returns, per page content stream, the text pieces with their x/y position,
// so table columns can be read by position. No dependencies (Node zlib only).
'use strict';
const fs = require('fs');
const zlib = require('zlib');

function decodeString(raw){
  // PDF literal string: handle the common escapes
  return raw.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (m, e) => {
    if(/^[0-7]+$/.test(e)) return String.fromCharCode(parseInt(e, 8));
    return { n:'\n', r:'\r', t:'\t', b:'\b', f:'\f', '(':'(', ')':')', '\\':'\\' }[e];
  });
}

function textItems(stream){
  const items = [];
  let x = 0, y = 0;
  const re = /([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm|([-\d.]+)\s+([-\d.]+)\s+Td|\[((?:\\.|[^\]\\])*)\]\s*TJ|\(((?:\\.|[^)\\])*)\)\s*Tj/g;
  let m;
  while((m = re.exec(stream))){
    if(m[5] !== undefined){ x = +m[5]; y = +m[6]; }
    else if(m[7] !== undefined){ x += +m[7]; y += +m[8]; }
    else {
      const str = m[9] !== undefined
        ? [...m[9].matchAll(/\(((?:\\.|[^)\\])*)\)/g)].map(p => decodeString(p[1])).join('')
        : decodeString(m[10]);
      if(str.trim()) items.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, s: str });
    }
  }
  return items;
}

function pages(file){
  const buf = fs.readFileSync(file);
  const out = [];
  let pos = 0;
  for(;;){
    const at = buf.indexOf('stream', pos, 'latin1');
    if(at < 0) break;
    let st = at + 6;
    if(buf[st] === 0x0d) st++;
    if(buf[st] === 0x0a) st++;
    const en = buf.indexOf('endstream', st, 'latin1');
    if(en < 0) break;
    pos = en + 9;
    // skip "endstream" matches of the word "stream" itself
    if(buf.slice(at - 3, at).toString('latin1') === 'end') continue;
    let data;
    try{ data = zlib.inflateSync(buf.slice(st, en)); }catch(e){ continue; }
    const t = data.toString('latin1');
    if(!/T[jJ]/.test(t)) continue;
    const items = textItems(t);
    if(items.length) out.push(items);
  }
  return out;
}

module.exports = { pages, textItems };

if(require.main === module){
  // usage: node pdftext.js file.pdf [pageIndex]   -> prints items of that page
  const p = pages(process.argv[2]);
  const i = +(process.argv[3] || 0);
  console.log('text pages:', p.length);
  (p[i] || []).sort((a, b) => b.y - a.y || a.x - b.x).forEach(it => console.log(it.y.toFixed(1).padStart(7), it.x.toFixed(1).padStart(7), JSON.stringify(it.s)));
}
