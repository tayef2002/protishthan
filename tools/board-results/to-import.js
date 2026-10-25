// Turn parser output into the file the Admin "বোর্ড ফলাফল ইমপোর্ট" screen uploads.
// usage: node to-import.js parsed.json > import.json
// - district names -> the Bangla names the rest of the site uses
// - institution / upazila names -> Title Case (the PDFs print them in capitals)
'use strict';
const fs = require('fs');

const DISTRICT_BN = {
  'DHAKA':'ঢাকা', 'DHAKA MAHANAGARI':'ঢাকা', 'GAZIPUR':'গাজীপুর', 'NARAYANGANJ':'নারায়ণগঞ্জ', 'NARSINGDI':'নরসিংদী', 'MUNSHIGANJ':'মুন্সীগঞ্জ',
  'MANIKGANJ':'মানিকগঞ্জ', 'TANGAIL':'টাঙ্গাইল', 'FARIDPUR':'ফরিদপুর', 'MADARIPUR':'মাদারীপুর', 'SHARIATPUR':'শরীয়তপুর', 'RAJBARI':'রাজবাড়ী',
  'GOPALGANJ':'গোপালগঞ্জ', 'KISHOREGANJ':'কিশোরগঞ্জ', 'MYMENSINGH':'ময়মনসিংহ', 'NETROKONA':'নেত্রকোণা', 'JAMALPUR':'জামালপুর', 'SHERPUR':'শেরপুর',
  'CHATTOGRAM':'চট্টগ্রাম', 'CHITTAGONG':'চট্টগ্রাম', 'COX\'S BAZAR':'কক্সবাজার', 'COXS BAZAR':'কক্সবাজার', 'RANGAMATI':'রাঙ্গামাটি', 'BANDARBAN':'বান্দরবান', 'KHAGRACHHARI':'খাগড়াছড়ি', 'KHAGRACHARI':'খাগড়াছড়ি',
  'CUMILLA':'কুমিল্লা', 'COMILLA':'কুমিল্লা', 'CHANDPUR':'চাঁদপুর', 'BRAHMANBARIA':'ব্রাহ্মণবাড়িয়া', 'NOAKHALI':'নোয়াখালী', 'FENI':'ফেনী', 'LAKSHMIPUR':'লক্ষ্মীপুর', 'LAXMIPUR':'লক্ষ্মীপুর',
  'RAJSHAHI':'রাজশাহী', 'NATORE':'নাটোর', 'NAOGAON':'নওগাঁ', 'CHAPAINAWABGANJ':'চাঁপাইনবাবগঞ্জ', 'CHAPAI NAWABGANJ':'চাঁপাইনবাবগঞ্জ', 'PABNA':'পাবনা', 'SIRAJGANJ':'সিরাজগঞ্জ', 'BOGURA':'বগুড়া', 'BOGRA':'বগুড়া', 'JOYPURHAT':'জয়পুরহাট',
  'KHULNA':'খুলনা', 'JASHORE':'যশোর', 'JESSORE':'যশোর', 'SATKHIRA':'সাতক্ষীরা', 'BAGERHAT':'বাগেরহাট', 'NARAIL':'নড়াইল', 'MAGURA':'মাগুরা', 'JHENAIDAH':'ঝিনাইদহ', 'KUSHTIA':'কুষ্টিয়া', 'CHUADANGA':'চুয়াডাঙ্গা', 'MEHERPUR':'মেহেরপুর',
  'BARISHAL':'বরিশাল', 'BARISAL':'বরিশাল', 'BHOLA':'ভোলা', 'PATUAKHALI':'পটুয়াখালী', 'PIROJPUR':'পিরোজপুর', 'JHALOKATHI':'ঝালকাঠি', 'JHALOKATI':'ঝালকাঠি', 'BARGUNA':'বরগুনা',
  'SYLHET':'সিলেট', 'MOULVIBAZAR':'মৌলভীবাজার', 'HABIGANJ':'হবিগঞ্জ', 'SUNAMGANJ':'সুনামগঞ্জ',
  'RANGPUR':'রংপুর', 'DINAJPUR':'দিনাজপুর', 'THAKURGAON':'ঠাকুরগাঁও', 'PANCHAGARH':'পঞ্চগড়', 'NILPHAMARI':'নীলফামারী', 'LALMONIRHAT':'লালমনিরহাট', 'KURIGRAM':'কুড়িগ্রাম', 'GAIBANDHA':'গাইবান্ধা',
  'FOREIGN CENTRES':'বিদেশ কেন্দ্র'
};
const SMALL = new Set(['and', 'of', 'the', 'at', 'in', '&']);
function title(s){
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
    .replace(/[a-z][a-z'’.-]*/g, (w, i) => (i > 0 && SMALL.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1))
    .replace(/\b(Govt|Ideal|Model)\b\.?/g, m => m)
    .replace(/\(([a-z])/g, (m, c) => '(' + c.toUpperCase());
}

const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const missing = new Set();
const out = rows.map(r => {
  const d = String(r.district || '').toUpperCase().trim();
  if(d && !DISTRICT_BN[d]) missing.add(d);
  return {
    exam: r.exam, year: r.year, board: r.board, eiin: r.eiin,
    institution_name: title(r.institution_name),
    district: DISTRICT_BN[d] || title(d) || null,
    upazila: r.district && d === 'DHAKA MAHANAGARI' ? title(r.upazila) + ' (ঢাকা মহানগর)' : (title(r.upazila) || null),
    grp: r.grp, appeared: r.appeared, passed: r.passed, gpa5: r.gpa5, gpa_bands: r.gpa_bands, source_url: r.source_url
  };
});
if(missing.size) console.error('district names without a Bangla mapping:', [...missing].join(', '));
console.error('rows:', out.length, '· institutions:', out.filter(r => r.grp === 'total').length);
process.stdout.write(JSON.stringify(out));
