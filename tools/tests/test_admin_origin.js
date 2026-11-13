// the admin's "Listing Submissions" queue: which door a hand-submitted row came from, and the hints worth a second look before approving.   node tools/tests/test_admin_origin.js
const fs = require('fs'), path = require('path');
const admin = fs.readFileSync(path.join(__dirname, '..', '..', 'admin.html'), 'utf8');
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);

const block = (admin.match(/\/\* ORIGIN-START[^]*?\/\* ORIGIN-END \*\//) || [''])[0];
yes('the origin block is in the admin page', block.length > 500);
const { subOrigin, subFlags } = new Function(block + '; return { subOrigin, subFlags };')();

// the two doors, by the placeholder slug each one writes (list-institution.html: "pending-" + Date.now(); publish_member_institution: "pending-<ms>-<4 hex>")
eq('the public form (pending-<13 digits>)', subOrigin({ desired_slug: 'pending-1794507408492', status: 'pending' }).k, 'form');
eq('a member\'s own institution (pending-<13 digits>-<4 hex>)', subOrigin({ desired_slug: 'pending-1794507408492-a3f9', status: 'pending' }).k, 'member');
eq('an approved row no longer shows its door', subOrigin({ desired_slug: 'dhaka-model-school', status: 'approved' }).t, 'আগেই অনুমোদিত');
eq('a row with no slug is "unknown"', subOrigin({ desired_slug: null, status: 'pending' }).t, 'উৎস অজানা');
yes('the form label says anyone can send it without signing in and that nothing was checked', /সাইন-ইন লাগে না/.test(subOrigin({ desired_slug: 'pending-1794507408492' }).d) && /যাচাই করিনি/.test(subOrigin({ desired_slug: 'pending-1794507408492' }).d));

// hints
const row = o => Object.assign({ institution_name: 'ঢাকা মডেল স্কুল', institution_type: 'স্কুল', contact_name: 'রহিম', contact_phone: '01712345678' }, o);
eq('a normal row has no hint', subFlags(row({}), [row({})]), []);
eq('"University" typed as a school is flagged', subFlags(row({ institution_name: 'জাতীয় বিশ্ববিদ্যালয়', institution_type: 'স্কুল' }), []).length, 1);
eq('"school and college" typed as college is fine', subFlags(row({ institution_name: 'ঢাকা স্কুল এন্ড কলেজ', institution_type: 'কলেজ' }), []), []);
eq('"school and college" typed as school is fine too', subFlags(row({ institution_name: 'ঢাকা স্কুল এন্ড কলেজ', institution_type: 'স্কুল' }), []), []);
eq('a madrasa typed as a school is flagged', subFlags(row({ institution_name: 'দারুল উলুম মাদ্রাসা', institution_type: 'স্কুল' }), []).length, 1);
eq('a primary school typed as a school is fine', subFlags(row({ institution_name: '৯৬ নং লেবুতলা সরকারি প্রাথমিক বিদ্যালয়', institution_type: 'স্কুল' }), []), []);
const all = [row({ contact_phone: '01792511647' }), row({ institution_name: 'অন্য স্কুল', contact_phone: '01792511647' }), row({ institution_name: 'তৃতীয় স্কুল', contact_phone: '01700000000' })];
eq('the same number twice is counted', subFlags(all[0], all), ['এই নম্বর থেকে মোট ২টি জমা পড়েছে']);
eq('a number in the name box is flagged', subFlags(row({ contact_name: '01793596334', contact_phone: '01793596334' }), []).join('|'), 'যোগাযোগের নামের জায়গায় নম্বর লেখা');
eq('a number that is not 01 + 9 digits is flagged', subFlags(row({ contact_phone: '1234567' }), []), ['নম্বরটা ০১ দিয়ে ১১ সংখ্যার নয়']);
yes('hints block nothing: no function in the block changes a status or calls the database', !/update\(|insert\(|rpc\(|\.from\(/.test(block));

// the page uses them: a label and the hints under the name in every row, and a box at the top of the detail
yes('every row shows its door and its hints under the name', /const org = subOrigin\(s\), flags = subFlags\(s, allSubmissions\);\s*return '<tr><td style="font-weight:600">'\+escapeHtml\(s\.institution_name\)\+'<div class="sub-meta"><span class="sub-src '\+org\.k/.test(admin));
yes('the detail starts with "where it came from" and the hints', /<b>কোথা থেকে এসেছে: '\+escapeHtml\(org\.t\)/.test(admin) && /class="sub-origin '\+org\.k/.test(admin));
yes('the queue still reads only hand-submitted rows (source is null), so imported rows never fill it', /from\('listing_submissions'\)\.select\('\*'\)\.is\('source', null\)/.test(admin));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
