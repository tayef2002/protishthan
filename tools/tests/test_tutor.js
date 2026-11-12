// ভাইয়া-আপু (the tutor service): the shared lists and checks, the pages, the admin tab, the SQL on paper, and the privacy of the data.   node tools/tests/test_tutor.js
// The SQL itself is run in a real Postgres engine by tools/tests/test_tutor_sql.js.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const D = require(path.join(ROOT, 'tutor-data.js'));
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);

// ----- the mobile number -----
eq('01712345678 is fine', D.normalizePhone('01712345678'), '01712345678');
eq('Bangla digits, dashes and spaces are understood', D.normalizePhone('০১৭১১-২২৩ ৩৪৪'), '01711223344');
eq('+880 and 880 prefixes are removed', [D.normalizePhone('+8801712345678'), D.normalizePhone('8801812345678'), D.normalizePhone('+৮৮০১৯১২৩৪৫৬৭৮')], ['01712345678', '01812345678', '01912345678']);
eq('not a Bangladeshi mobile: too short, too long, a landline, 0120 (no such operator digit), letters', ['0171234567', '017123456789', '029876543', '01212345678', 'abc', ''].map(D.normalizePhone), ['', '', '', '', '', '']);
eq('01[3-9] are all accepted', ['013', '014', '015', '016', '017', '018', '019'].map(p => D.normalizePhone(p + '12345678')), ['01312345678', '01412345678', '01512345678', '01612345678', '01712345678', '01812345678', '01912345678']);

// ----- free text: no links, e-mail or phone numbers -----
eq('plain words are fine', D.textProblem('সপ্তাহে ৩ দিন, সন্ধ্যায়'), null);
eq('a link', D.textProblem('দেখুন www.example.com'), 'BAD_LINK');
eq('http', D.textProblem('http://x'), 'BAD_LINK');
eq('an e-mail address', D.textProblem('a@b.com'), 'BAD_LINK');
eq('a .bd address', D.textProblem('example.bd'), 'BAD_LINK');
eq('a mobile number in Bangla digits', D.textProblem('ডাকুন ০১৭১১২২৩৩৪৪ নম্বরে'), 'BAD_PRIVATE');
eq('a mobile number with dashes', D.textProblem('ডাকুন 01711-223344'), 'BAD_PRIVATE');
eq('a long number of any kind', D.textProblem('আইডি 1234567890'), 'BAD_PRIVATE');
eq('a short number is fine ("৩ বছর", "২০২৬")', [D.textProblem('৩ বছরের অভিজ্ঞতা'), D.textProblem('২০২৬ সালে')], [null, null]);

// ----- the guardian's request -----
const REQ = { name: 'রহিমা বেগম', phone: '01712345678', cls: 'c6-8', subjects: ['math', 'english'], mode: 'home', district: 'বরিশাল', upazila: 'বরিশাল সদর', note: '' };
eq('a good request has no errors', D.validateRequest(REQ), {});
eq('a request with nothing: name, phone, class, subjects, area', Object.keys(D.validateRequest({})).sort(), ['area', 'cls', 'name', 'phone', 'subjects']);
eq('online needs no area', D.validateRequest(Object.assign({}, REQ, { mode: 'online', district: '', upazila: '' })), {});
eq('more than 6 subjects is refused', Object.keys(D.validateRequest(Object.assign({}, REQ, { subjects: ['bangla', 'english', 'math', 'science', 'physics', 'chemistry', 'biology'] }))), ['subjects']);
eq('an unknown subject or class is refused', [Object.keys(D.validateRequest(Object.assign({}, REQ, { subjects: ['hacking'] }))), Object.keys(D.validateRequest(Object.assign({}, REQ, { cls: 'c99' })))], [['subjects'], ['cls']]);
eq('a mobile number in the note is refused', D.validateRequest(Object.assign({}, REQ, { note: 'আমার নম্বর ০১৭১১২২৩৩৪৪' })), { note: 'BAD_PRIVATE' });
eq('every error code has a Bangla message', Object.keys(D.MSG).every(k => D.MSG[k] && /[ঀ-৿]/.test(D.MSG[k])), true);
eq('a server refusal becomes its message', [D.errText({ message: 'DAILY_LIMIT' }), D.errText('NOT_SIGNED_IN'), D.errText({ message: 'weird' })].map(x => /[ঀ-৿]/.test(x)), [true, true, true]);

// ----- a tutor's profile -----
const PROF = { full_name: 'মোঃ করিম উদ্দিন', display_name: 'করিম ভাইয়া', phone: '01711223344', institution: 'বরিশাল বিশ্ববিদ্যালয়', department: 'গণিত', edu_level: 'bachelor', subjects: ['math'], classes: ['c9-10'], modes: ['home'], district: 'বরিশাল', upazila: 'বরিশাল সদর', bio: 'আমি গণিত পড়াতে ভালোবাসি। তিন বছরের অভিজ্ঞতা আছে।', age_ok: true, terms_ok: true };
eq('a full profile has no errors', D.validateProfile(PROF, true), {});
eq('an empty draft is fine', D.validateProfile({}, false), {});
eq('an empty submit: everything is asked for', Object.keys(D.validateProfile({}, true)).sort(), ['age_ok', 'area', 'bio', 'classes', 'full_name', 'modes', 'phone', 'study', 'subjects', 'terms_ok']);
eq('home teaching needs the upazila, online only needs the district', [Object.keys(D.validateProfile(Object.assign({}, PROF, { upazila: '' }), true)), Object.keys(D.validateProfile(Object.assign({}, PROF, { upazila: '', modes: ['online'] }), true))], [['area'], []]);
eq('a bio under 20 characters is refused', Object.keys(D.validateProfile(Object.assign({}, PROF, { bio: 'ছোট' }), true)), ['bio']);
eq('a link in the bio is refused even in a draft', D.validateProfile(Object.assign({}, PROF, { bio: 'আমার সাইট www.example.com দেখুন' }), false), { bio: 'BAD_LINK' });
eq('under 18 or no consent is refused', Object.keys(D.validateProfile(Object.assign({}, PROF, { age_ok: false, terms_ok: false }), true)).sort(), ['age_ok', 'terms_ok']);

// ----- the search question -----
eq('the search question has only what was chosen, with a default page', D.searchArgs({ district: 'বরিশাল', cls: 'c6-8' }), { p_limit: 12, p_offset: 0, p_district: 'বরিশাল', p_class: 'c6-8' });
eq('an unknown class, subject or mode is dropped', D.searchArgs({ cls: 'c99', subject: 'x', mode: 'zoom' }), { p_limit: 12, p_offset: 0 });
eq('limit and offset are kept inside their bounds', [D.searchArgs({ limit: 999 }).p_limit, D.searchArgs({ offset: 99999 }).p_offset, D.searchArgs({ limit: 0 }).p_limit], [30, 500, 12]);

// ----- the WhatsApp texts the admin sends -----
const R = { id: 'r1', name: 'রহিমা বেগম', phone: '01712345678', district: 'বরিশাল', upazila: 'বরিশাল সদর', class_band: 'c6-8', subjects: ['english', 'math'], mode: 'home' };
const TU = { full_name: 'মোঃ করিম উদ্দিন', display_name: 'করিম ভাইয়া', phone: '01711223344', institution: 'বরিশাল বিশ্ববিদ্যালয়', department: 'গণিত', edu_level: 'bachelor', subjects: ['math', 'physics'], classes: ['c6-8'], verify: 'verified' };
eq('a wa.me link has the 88 prefix and the text encoded', D.waLink('01712345678', 'হ্যালো'), 'https://wa.me/8801712345678?text=' + encodeURIComponent('হ্যালো'));
eq('a bad number gives no link', D.waLink('123', 'x'), '');
yes('the text to a TUTOR names the request and carries no guardian name or number', (() => { const m = D.msgToTutor(R, TU); return m.includes('করিম ভাইয়া') && m.includes('বরিশাল সদর') && m.includes('গণিত') && !m.includes('রহিমা') && !m.includes('01712345678'); })());
yes('the text to a GUARDIAN carries the tutor identity and the verified line, never the tutor number or the real name', (() => { const m = D.msgToGuardian(R, TU); return m.includes('রহিমা বেগম') && m.includes('করিম ভাইয়া') && m.includes('বরিশাল বিশ্ববিদ্যালয়') && m.includes('NID ও সনদের কপি দেখেছি') && !m.includes('01711223344') && !m.includes('মোঃ করিম উদ্দিন'); })());
yes('an unverified tutor gets no verified line', !D.msgToGuardian(R, Object.assign({}, TU, { verify: 'none' })).includes('NID'));

// ----- one set of lists everywhere: tutor-data.js, the SQL and /api/dir -----
const sql = read('migrations/2026-12-17_tutors.sql'), dir = read('functions/api/dir.js');
const sqlList = fn => ((sql.match(new RegExp('function public\\.' + fn + '\\(\\)[^]*?array\\[([^\\]]+)\\]')) || [])[1] || '').split(',').map(x => x.trim().replace(/'/g, ''));
const dirList = name => ((dir.match(new RegExp('const ' + name + " = \\[([^\\]]+)\\]")) || [])[1] || '').split(',').map(x => x.trim().replace(/'/g, ''));
eq('subjects: the page, the SQL and /api/dir agree', [D.keysOf(D.SUBJECTS), D.keysOf(D.SUBJECTS)], [sqlList('tutor_subject_keys'), dirList('TUTOR_SUBJECTS')]);
eq('classes: the page, the SQL and /api/dir agree', [D.keysOf(D.CLASSES), D.keysOf(D.CLASSES)], [sqlList('tutor_class_keys'), dirList('TUTOR_CLASSES')]);
eq('modes and times agree with the SQL', [D.keysOf(D.MODES), D.keysOf(D.TIMES)], [sqlList('tutor_mode_keys'), sqlList('tutor_time_keys')]);
eq('levels and genders agree with the table checks', [D.keysOf(D.LEVELS), D.keysOf(D.GENDERS)], [(sql.match(/edu_level in \('', ([^)]+)\)/) || [])[1].split(',').map(x => x.trim().replace(/'/g, '')), (sql.match(/gender in \('', ([^)]+)\)/) || [])[1].split(',').map(x => x.trim().replace(/'/g, ''))]);
eq('request classes in the table check agree', (sql.match(/class_band in \(([^)]+)\)/) || [])[1].split(',').map(x => x.trim().replace(/'/g, '')), D.keysOf(D.CLASSES));

// ----- the SQL on paper: what is closed, what is public, what is never returned -----
yes('all four tables have row security and an admin-only policy', ['tutor_settings', 'tutor_profiles', 'tutor_requests', 'tutor_matches'].every(t => new RegExp('alter table public\\.' + t + ' enable row level security').test(sql) && new RegExp('create policy ' + t + '_admin on public\\.' + t + ' for all to authenticated using \\(public\\.is_admin\\(\\)\\) with check \\(public\\.is_admin\\(\\)\\)').test(sql)));
yes('the browser roles have nothing granted on the tables except through the admin policies', /revoke all on public\.tutor_settings, public\.tutor_profiles, public\.tutor_requests, public\.tutor_matches from anon, authenticated/.test(sql) && !/grant [^;]*on public\.tutor_[a-z]+ to anon/.test(sql));
const searchSql = (sql.match(/function public\.tutor_search[^]*?language sql/) || [''])[0];
yes('the public search returns no mobile number, real name, fee, area note, admin note or user id', !/\b(phone|full_name|fee_note|area_note|admin_note|user_id)\b/.test(searchSql.replace(/s\.\*/g, '').split('returns table')[1].split('language sql')[0]));
const searchFull = (sql.match(/function public\.tutor_search[^]*?\$\$;/) || [''])[0];
yes('the public search is off until the admin switches it on, and only shows approved profiles', /public_listing/.test(searchFull) && /t\.status = 'approved'/.test(searchFull));
yes('the public search has a hard limit', /least\(coalesce\(p_limit, 12\), 30\)/.test(sql) && /least\(coalesce\(p_offset, 0\), 500\)/.test(sql));
yes('anon may call only the three public functions; the profile ones are for signed-in members', ['tutor_state()', 'tutor_search(text, text, text, text, text, int, int)', 'tutor_request_add(text, text, text, text, text, text, text[], text, text, text, text)'].every(f => sql.includes('grant execute on function public.' + f + ' to anon, authenticated')) && ['tutor_my_profile()', 'tutor_profile_save(jsonb, boolean)', 'tutor_profile_pause(boolean)'].every(f => sql.includes('grant execute on function public.' + f + ' to authenticated;')));
yes('the verify mark and the status are never set from a tutor-side function (only the admin policy can)', !/tutor_profile_save[^]*?\bverify\s*=/.test((sql.match(/function public\.tutor_profile_save[^]*?end \$\$;/) || [''])[0]));
yes('the SQL can run twice (create if not exists / or replace / drop policy if exists)', !/create table public\./.test(sql) && !/create policy [a-z_]+ on public\.tutor_[a-z]+ for/.test(sql.replace(/drop policy if exists[^;]*;\ncreate policy/g, '')));

// ----- the pages -----
const page = read('tutor.html'), join = read('tutor-join.html'), admin = read('admin.html');
for (const [f, h] of [['tutor.html', page], ['tutor-join.html', join]]) {
  yes(f + ': Bangla page with a title and a description', /<html lang="bn">/.test(h) && (h.match(/<title>([^<]+)<\/title>/) || [])[1].length > 20 && /<meta name="description" content="[^"]{60,}/.test(h));
  eq(f + ': exactly one h1', (h.match(/<h1[ >]/g) || []).length, 1);
  yes(f + ': the nav, the footer, the shared sheet and the data file are there, data before the page code', /id="nav"/.test(h) && /id="pfoot"/.test(h) && /tutor\.css\?v=1/.test(h) && /tutor-data\.js\?v=1/.test(h) && h.indexOf('tutor-data.js') < h.indexOf("const D = window.TutorData"));
  yes(f + ': no ad place and no ad script on a service page', !/ad-slot|ads\.js|googlesyndication/.test(h));
  yes(f + ': never reads a tutor table directly (only the functions, and /api/dir)', !/\.from\(\s*['"]tutor_/.test(h));
  yes(f + ': every outside link carries rel="noopener"', [...h.matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)].filter(m => !/protishthan\.com/.test(m[1])).every(m => /rel="noopener"/.test(m[0])));
  yes(f + ': page code escapes what it shows (an esc helper, and no innerHTML with a raw field)', /const esc = /.test(h));
  yes(f + ': the hidden helper attribute is honoured (CSS has [hidden]{display:none!important})', /\[hidden\]\{display:none!important\}/.test(read('tutor.css')));
}
yes('tutor.html is indexable and has its clean canonical', !/noindex/.test(page) && /rel="canonical" href="https:\/\/protishthan\.com\/tutor"/.test(page));
yes('tutor-join.html is not indexed (a personal flow)', /<meta name="robots" content="noindex">/.test(join));
yes('the public page calls exactly the three public functions', (() => { const names = [...page.matchAll(/rpc\('([a-z_]+)'/g)].map(m => m[1]); return names.length === 1 && names[0] === 'tutor_request_add'; })() && /f=tutorstate/.test(page) && /f=tutors/.test(page));
yes('the join page calls only the member functions', (() => { const names = new Set([...join.matchAll(/rpc\('([a-z_]+)'/g)].map(m => m[1])); return [...names].sort().join() === 'tutor_my_profile,tutor_profile_pause,tutor_profile_save'; })());
// the argument names the pages send are exactly the SQL parameter names
const params = fn => { const m = sql.match(new RegExp('function public\\.' + fn + '\\(([^)]*)\\)')); return m ? m[1].replace(/default [^,]+/g, '').split(',').map(x => x.trim().split(/\s+/)[0]).filter(Boolean) : []; };
const sent = (h, fn) => { const m = h.match(new RegExp("rpc\\('" + fn + "', \\{([^}]*)\\}")); return m ? [...m[1].matchAll(/(p_[a-z_]+):/g)].map(x => x[1]) : []; };
eq('tutor_request_add: the page sends the SQL parameters, no more, no fewer', sent(page, 'tutor_request_add').sort(), params('tutor_request_add').sort());
eq('tutor_profile_save: the page sends p_data and p_submit', sent(join, 'tutor_profile_save').sort(), params('tutor_profile_save').sort());
eq('tutor_profile_pause: the page sends p_pause', sent(join, 'tutor_profile_pause').sort(), params('tutor_profile_pause').sort());
yes('the request form has a hidden trap field that the server checks', /id="rHp"/.test(page) && /p_hp: \$\('rHp'\)\.value/.test(page) && /raise exception 'SPAM'/.test(sql));
yes('the join flow has all four steps and the consent boxes', [1, 2, 3, 4].every(n => new RegExp('data-step="' + n + '"').test(join)) && /id="jAge"/.test(join) && /id="jTerms"/.test(join));
yes('the page says plainly what it cannot do (no background check, no guarantee)', /ব্যাকগ্রাউন্ড চেক নয়/.test(page) && /নিশ্চয়তা/.test(page));
yes('no invented numbers, ratings or testimonials on the public page', !/[★⭐]|\d+\s*\+?\s*(জন|হাজার)\s*(টিউটর|অভিভাবক)\s*(যুক্ত|আছেন)|রিভিউ\s*[০-৯0-9]/.test(page) && !/testimonial|"rating"/i.test(page));

// ----- the admin tab -----
yes('the admin has the menu item, the view, the two switches and the lists', /id="nav-tutors"/.test(admin) && /id="view-tutors"/.test(admin) && /id="ttListing"/.test(admin) && /id="ttOpen"/.test(admin) && /id="ttListReq"/.test(admin) && /id="ttListPro"/.test(admin));
yes('the admin loads the shared data file before its code and reads the tutor tables with the admin session only', admin.indexOf('tutor-data.js') < admin.indexOf('const TD = window.TutorData') && [...admin.matchAll(/\.from\('(tutor_[a-z]+)'\)/g)].length > 5 && [...admin.matchAll(/(\w+)\.from\('tutor_[a-z]+'\)/g)].every(m => m[1] === 'sbAdmin'));
yes('the admin asks before turning the public list on, before verifying, and before deleting', /confirm\('পাবলিক তালিকা চালু করবেন/.test(admin) && /confirm\('আপনি কি ওঁর NID ও সনদের কপি নিজে দেখেছেন/.test(admin) && /confirm\('এই টিউটরের প্রোফাইল চিরতরে/.test(admin) && /confirm\('এই অনুরোধটা চিরতরে/.test(admin));
yes('the admin escapes everything it prints (an escape helper used on the stored fields)', /const ttEsc = /.test(admin) && !/innerHTML\s*=\s*[^;]*\br\.(name|note|phone)\b(?![^;]*ttEsc)/.test((admin.match(/function ttReqCard[^]*?\n\}/) || [''])[0]));

// ----- the legal pages and the sitemap -----
const pv = read('privacy.html'), tm = read('terms.html');
yes('the privacy page has the tutor section and says what is never public and that papers are not kept', /id="tutor"/.test(pv) && /মোবাইল নম্বর, আসল নাম, আনুমানিক ফি আর এলাকার নাম শুধু আমাদের টিম দেখে/.test(pv) && /কাগজ আমরা ওয়েবসাইটের ডাটাবেসে রাখি না/.test(pv) && /বিক্রি করি না/.test(pv) && /১৮ বা তার বেশি/.test(pv));
yes('the terms page has the tutor section: not an employer, teachers\' rule, what "verified" means, no income guarantee', /id="tutor"/.test(tm) && /নিয়োগকারী/.test(tm) && /২০১২ সালের নীতিমালা/.test(tm) && /ব্যাকগ্রাউন্ড চেক নয়/.test(tm) && /আয়েরও কোনো নিশ্চয়তা নেই/.test(tm));
yes('the privacy and terms contents lists agree with their sections', [pv, tm].every(h => JSON.stringify([...h.matchAll(/<a href="#([a-z0-9]+)"><i>([০-৯]+)<\/i>/g)].map(m => [m[1], m[2]])) === JSON.stringify([...h.matchAll(/<section class="lg-sec" id="([a-z0-9]+)"><h2><span class="n">([০-৯]+)<\/span>/g)].map(m => [m[1], m[2]]))));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
