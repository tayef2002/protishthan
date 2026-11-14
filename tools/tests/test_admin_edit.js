// the admin's edit option in the Listing Submissions detail: fix what the submitter typed wrong, then approve.   node tools/tests/test_admin_edit.js
const fs = require('fs'), path = require('path');
const admin = fs.readFileSync(path.join(__dirname, '..', '..', 'admin.html'), 'utf8');
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);

const block = (admin.match(/\/\* EDIT-START[^]*?\/\* EDIT-END \*\//) || [''])[0];
yes('the edit block is in the admin page', block.length > 800);
const { edBuild, edPhone, edList } = new Function(block + '; return { edBuild, edPhone, edList };')();

const row = { institution_name: 'ঢাকা মডেল স্কুল', institution_type: 'স্কুল', district: 'ঢাকা', upazila: 'সাভার', contact_name: 'রহিম', contact_phone: '01712345678', address_note: 'সাভার বাজার', founding_year: '2001', student_count: '300', teacher_count: '20', class_range: '১-১০', fee_range: null, description: 'ভালো স্কুল', facebook_link: null, medium: ['বাংলা'], facilities: null, achievements: null };
const vals = o => Object.assign({ institution_name: row.institution_name, institution_type: row.institution_type, district: row.district, upazila: row.upazila, contact_name: row.contact_name, contact_phone: row.contact_phone, address_note: row.address_note, founding_year: row.founding_year, student_count: row.student_count, teacher_count: row.teacher_count, class_range: row.class_range, fee_range: '', description: row.description, facebook_link: '', medium: 'বাংলা', facilities: '', achievements: '' }, o);

eq('nothing changed means nothing is sent', edBuild(row, vals({})).patch, {});
eq('a fixed name is sent alone', edBuild(row, vals({ institution_name: '  ঢাকা  মডেল  হাই স্কুল ' })).patch, { institution_name: 'ঢাকা মডেল হাই স্কুল' });
eq('a changed type from the four is sent', edBuild(row, vals({ institution_type: 'কলেজ' })).patch, { institution_type: 'কলেজ' });
eq('a type that is not on the list is ignored', edBuild(row, vals({ institution_type: 'কিছু একটা' })).patch, {});
eq('an emptied optional field becomes null', edBuild(row, vals({ description: '' })).patch, { description: null });
eq('a new optional field is sent', edBuild(row, vals({ fee_range: '৫০০-১০০০' })).patch, { fee_range: '৫০০-১০০০' });
eq('an empty optional field that was already empty is not sent', edBuild(row, vals({ fee_range: '   ' })).patch, {});
eq('a Facebook link gets https in front', edBuild(row, vals({ facebook_link: 'facebook.com/abc' })).patch, { facebook_link: 'https://facebook.com/abc' });
eq('the lists are split on commas, trimmed, without doubles', edBuild(row, vals({ facilities: 'লাইব্রেরি, ল্যাব ,লাইব্রেরি,' })).patch, { facilities: ['লাইব্রেরি', 'ল্যাব'] });
eq('an unchanged list is not sent', edBuild(row, vals({ medium: ' বাংলা ' })).patch, {});
eq('an emptied list becomes null', edBuild(row, vals({ medium: '' })).patch, { medium: null });

eq('Bangla digits and +880 become the 11-digit number', edPhone('+৮৮০ ১৭১২-৩৪৫৬৭৯'), '01712345679');
eq('a fixed number is sent', edBuild(row, vals({ contact_phone: '০১৮১১ ১১১১১১' })).patch, { contact_phone: '01811111111' });
yes('a new number that is not 01 plus 9 digits is refused', !!edBuild(row, vals({ contact_phone: '1234567' })).error);
eq('an old odd number that is left alone is not refused', edBuild({ ...row, contact_phone: '1234567' }, vals({ contact_phone: '1234567' })).error, undefined);
yes('an empty name is refused', !!edBuild(row, vals({ institution_name: ' ' })).error);
yes('an empty district is refused', !!edBuild(row, vals({ district: '' })).error);
yes('a very long description is refused', !!edBuild(row, vals({ description: 'ক'.repeat(1001) })).error);
eq('a list item over 60 characters is dropped', edList('ক'.repeat(61) + ', ভালো'), ['ভালো']);

// the screen
yes('the detail view has the edit button, for every status', /ভুল ঠিক করুন \(সম্পাদনা\)/.test(admin) && /editDetail\(\\''\+s\.id\+'\\'\)/.test(admin));
yes('save asks only for the changed fields and reads the row back (an update that changes no row says so)', /\.update\(r\.patch\)\.eq\('id', id\)\.select\('\*'\)/.test(admin) && /কিছু সেভ হয়নি/.test(admin));
yes('after saving, the detail view opens again so the admin can approve', /renderSubmissionsTable\(\); renderOverview\(\);\s*openDetail\(id\);/.test(admin));
yes('the status, the slug and the PRN are not editable here (approve does those)', !/ED_TEXT[^;]*'(status|desired_slug|prn_number)'/.test(admin));
yes('every edited value is escaped when it is put into the form', (admin.match(/value="'\+escapeHtml\(/g) || []).length >= 2 && /escapeHtml\(v\)\+'<\/textarea>'/.test(admin));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);