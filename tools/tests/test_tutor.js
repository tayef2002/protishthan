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

// ----- how complete a profile is, and what a guardian reads about their request -----
const FULL = Object.assign({}, PROF, { gender: 'male', times: ['evening'], subjects: ['math', 'physics', 'ict'], bio: 'আমি গণিত পড়াতে ভালোবাসি। তিন বছরের অভিজ্ঞতা আছে। প্রতিটা বিষয় ধাপে ধাপে বুঝিয়ে পড়াই, আর প্রতি সপ্তাহে ছোট একটা পরীক্ষা নিই, যাতে পড়া মনে থাকে।', trial: true, medium: ['bangla'], exams: ['ssc'], style: ['concept'], batch: 'one', days_max: 3, session_mins: 60, exp: 'y1_2', taught: 'n1_5', ssc_gpa: '5.00', hsc_gpa: '', pledge: ['guardian_first', 'open_place', 'hours'] });
eq('a full profile (the four steps and every extra) is 100 and has nothing left to add', [D.profileStrength(FULL).pct, D.profileStrength(FULL).tips.length], [100, 0]);
eq('the four required steps alone are worth 70, the extras the other 30', [D.profileStrength(Object.assign({}, FULL, { trial: false, medium: [], exams: [], style: [], batch: '', days_max: 0, session_mins: 0, exp: '', taught: '', ssc_gpa: '', pledge: [] })).pct, D.profileStrength(FULL).pct - D.profileStrength(Object.assign({}, FULL, { trial: false, medium: [], exams: [], style: [], batch: '', days_max: 0, session_mins: 0, exp: '', taught: '', ssc_gpa: '', pledge: [] })).pct], [70, 30]);
eq('an empty draft is 0 with tips to follow', [D.profileStrength({}).pct, D.profileStrength({}).tips.length > 3], [0, true]);
yes('the strength only grows when something is added (a name, then a phone)', (() => { const a = D.profileStrength({ full_name: 'করিম উদ্দিন' }).pct, b = D.profileStrength({ full_name: 'করিম উদ্দিন', phone: '01711223344' }).pct; return a > 0 && b > a && b <= 100; })());
yes('the strength never passes 100 and every tip is Bangla', (() => { const s = D.profileStrength(PROF); return s.pct <= 100 && s.tips.every(t => /[ঀ-৿]/.test(t)); })());
eq('the request line by status', [D.requestLine({ status: 'new' }), D.requestLine({ status: 'matching', sent: 0 }), D.requestLine({ status: 'matching', sent: 2 }), D.requestLine({ status: 'matched' }), D.requestLine({ status: 'closed' }), D.requestLine(null)].map(x => /[ঀ-৿]/.test(x)), [true, true, true, true, true, true]);
yes('the request line says how many were told, in Bangla digits, and never promises a time', D.requestLine({ status: 'matching', sent: 2 }).includes('২ জনের') && !/ঘণ্টা|মিনিট|দিনের মধ্যে/.test(['new', 'matching', 'matched', 'closed'].map(s => D.requestLine({ status: s, sent: 3 })).join(' ')));

// ----- the request-status function: what a guardian may learn about their own request -----
const stSql = read('migrations/2026-12-18_tutor_request_status.sql');
const stBody = (stSql.match(/create or replace function public\.tutor_request_status[^]*?as \$\$[^]*?\$\$/) || [''])[0].replace(/--[^\n]*/g, '');
yes('the status function answers only the status, the time and a count (never a name, number, note or tutor)', /jsonb_build_object\('status'[^)]*'created_at'[^)]*'sent'/.test(stBody) && !/\b(phone|name|note|tutor_id|tutor_pid|device|user_id|admin_note)\b/.test(stBody.replace(/'(status|created_at|sent)'/g, '')));
yes('the status function answers nothing for spam and is guarded by the unguessable id', /r\.id = p_id/.test(stBody) && /r\.status <> 'spam'/.test(stBody));
yes('the status function is a security-definer function with a fixed search path, open to anon and signed-in members', /security definer set search_path = public/.test(stBody) && /revoke all on function public\.tutor_request_status\(uuid\) from public;/.test(stSql) && /grant execute on function public\.tutor_request_status\(uuid\) to anon, authenticated;/.test(stSql));
yes('the status migration can run twice', /create or replace function/.test(stSql) && !/create table|create policy/.test(stSql));

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
yes('the member functions are explicitly taken away from anon (Supabase gives new functions to anon by default)', ['tutor_my_profile()', 'tutor_profile_save(jsonb, boolean)', 'tutor_profile_pause(boolean)'].every(f => sql.includes('revoke execute on function public.' + f + ' from anon;')));
yes('the verify mark and the status are never set from a tutor-side function (only the admin policy can)', !/tutor_profile_save[^]*?\bverify\s*=/.test((sql.match(/function public\.tutor_profile_save[^]*?end \$\$;/) || [''])[0]));
yes('the SQL can run twice (create if not exists / or replace / drop policy if exists)', !/create table public\./.test(sql) && !/create policy [a-z_]+ on public\.tutor_[a-z]+ for/.test(sql.replace(/drop policy if exists[^;]*;\ncreate policy/g, '')));

// ----- the pages -----
const page = read('tutor.html'), join = read('tutor-join.html'), admin = read('admin.html');
for (const [f, h] of [['tutor.html', page], ['tutor-join.html', join]]) {
  yes(f + ': Bangla page with a title and a description', /<html lang="bn">/.test(h) && (h.match(/<title>([^<]+)<\/title>/) || [])[1].length > 20 && /<meta name="description" content="[^"]{60,}/.test(h));
  eq(f + ': exactly one h1', (h.match(/<h1[ >]/g) || []).length, 1);
  yes(f + ': the nav, the footer, the shared sheet and the data file are there, data before the page code', /id="nav"/.test(h) && /id="pfoot"/.test(h) && /tutor\.css\?v=15/.test(h) && /tutor-data\.js\?v=4/.test(h) && h.indexOf('tutor-data.js') < h.indexOf("const D = window.TutorData"));
  yes(f + ': no ad place and no ad script on a service page', !/ad-slot|ads\.js|googlesyndication/.test(h));
  yes(f + ': never reads a tutor table directly (only the functions, and /api/dir)', !/\.from\(\s*['"]tutor_/.test(h));
  yes(f + ': every outside link carries rel="noopener"', [...h.matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)].filter(m => !/protishthan\.com/.test(m[1])).every(m => /rel="noopener"/.test(m[0])));
  yes(f + ': page code escapes what it shows (an esc helper, and no innerHTML with a raw field)', /const esc = /.test(h));
  yes(f + ': the hidden helper attribute is honoured (CSS has [hidden]{display:none!important})', /\[hidden\]\{display:none!important\}/.test(read('tutor.css')));
}
yes('tutor.html is indexable and has its clean canonical', !/noindex/.test(page) && /rel="canonical" href="https:\/\/protishthan\.com\/tutor"/.test(page));
yes('tutor-join.html is not indexed (a personal flow)', /<meta name="robots" content="noindex">/.test(join));
yes('the public page calls only the request function and the status function, and reads the list through /api/dir', (() => { const names = [...page.matchAll(/rpc\('([a-z_]+)'/g)].map(m => m[1]).sort(); return [...new Set(names)].join() === 'tutor_request_add,tutor_request_status'; })() && /f=tutorstate/.test(page) && /f=tutors/.test(page));yes('the join page calls only the member functions', (() => { const names = new Set([...join.matchAll(/rpc\('([a-z_]+)'/g)].map(m => m[1])); return [...names].sort().join() === 'tutor_my_profile,tutor_profile_pause,tutor_profile_save'; })());
// the argument names the pages send are exactly the SQL parameter names
const sql3 = read('migrations/2026-12-19_tutor_profile_more.sql');
const params = fn => { const m = (/function public\.tutor_request_add\(/.test(sql3) && fn === 'tutor_request_add' ? sql3 : sql).match(new RegExp('function public\\.' + fn + '\\(([^)]*)\\)')); return m ? m[1].replace(/default [^,]+/g, '').split(',').map(x => x.trim().split(/\s+/)[0]).filter(Boolean) : []; };
const sent = (h, fn) => { const m = h.match(new RegExp("rpc\\('" + fn + "', \\{([^}]*)\\}")) || h.match(new RegExp("const args = \\{([^}]*)\\}[^]*?rpc\\('" + fn + "', args")); return m ? [...m[1].matchAll(/(p_[a-z_]+):/g)].map(x => x[1]) : []; };
eq('tutor_request_add: the page sends the SQL parameters, no more, no fewer', sent(page, 'tutor_request_add').sort(), params('tutor_request_add').sort());
eq('tutor_request_status: the page sends only the request id', sent(page, 'tutor_request_status'), ['p_id']);
eq('tutor_profile_save: the page sends p_data and p_submit', sent(join, 'tutor_profile_save').sort(), params('tutor_profile_save').sort());
eq('tutor_profile_pause: the page sends p_pause', sent(join, 'tutor_profile_pause').sort(), params('tutor_profile_pause').sort());
yes('the request form has a hidden trap field that the server checks', /id="rHp"/.test(page) && /p_hp: \$\('rHp'\)\.value/.test(page) && /raise exception 'SPAM'/.test(sql));
yes('the join flow has all six steps (the middle two optional) and the consent boxes', [1, 2, 3, 4, 5, 6].every(n => new RegExp('data-step="' + n + '"').test(join)) && /id="jAge"/.test(join) && /id="jTerms"/.test(join));
yes('the page says plainly what it cannot do (no background check, no guarantee)', /ব্যাকগ্রাউন্ড চেক নয়/.test(page) && /নিশ্চয়তা/.test(page));
yes('no invented numbers, ratings or testimonials on the public page', !/[★⭐]|\d+\s*\+?\s*(জন|হাজার)\s*(টিউটর|অভিভাবক)\s*(যুক্ত|আছেন)|রিভিউ\s*[০-৯0-9]/.test(page) && !/testimonial|"rating"/i.test(page));

const css = read('tutor.css');
yes('the redesigned landing: who-are-you switch, pill search, problem cards, verification ladder, checklist, tutor call-to-action, FAQ', /class="tt-seg2"/.test(page) && /class="tt-pill"/.test(page) && (page.match(/class="tt-bc"/g) || []).length === 6 && (page.match(/class="tt-lv/g) || []).length === 3 && /id="ttClList"/.test(page) && /class="tt-join2"/.test(page) && (page.match(/<details>/g) || []).length === 6);
yes('the hero picture is decoration only (hidden from screen readers, no text a reader needs) and moves only when motion is allowed', /<div class="tt-art" aria-hidden="true">/.test(page) && /prefers-reduced-motion:reduce\)\{\.tt-fl/.test(css));
yes('the sample tutor card is labelled as a sample and holds no real person', /class="tt-sample">নমুনা/.test(page) && /নমুনা নাম/.test(page));
yes('the public landing keeps the honest lines: free for guardians, the number is shown only to a tutor who agrees, not a background check, the fee is theirs to agree', /অভিভাবকের জন্য ফ্রি/.test(page) && /ব্যাকগ্রাউন্ড চেক নয়/.test(page) && /ফি আপনি আর টিউটর নিজেরা ঠিক করেন/.test(page));
yes('the join page has the meter and the three-step road, and shows the guardian-side switch', /id="jMeter"/.test(join) && /class="tt-road"/.test(join) && /<a href="\/tutor">আমি টিউটর খুঁজছি<\/a>/.test(join));

// ----- the extras (2026-12-19): the lists, the checks, what a guardian reads, and the SQL on paper -----
const listOf = (re) => ((sql3.match(re) || [])[1] || '').split(',').map(x => x.trim().replace(/'/g, ''));
eq('mediums, exams, styles and promises: tutor-data.js and the SQL agree', [D.keysOf(D.MEDIUMS), D.keysOf(D.EXAMS), D.keysOf(D.STYLES), D.keysOf(D.PLEDGES)],
  [listOf(/tutor_medium_keys\(\)[^]*?array\[([^\]]+)\]/), listOf(/tutor_exam_keys\(\)[^]*?array\[([^\]]+)\]/), listOf(/tutor_style_keys\(\)[^]*?array\[([^\]]+)\]/), listOf(/tutor_pledge_keys\(\)[^]*?array\[([^\]]+)\]/)]);
const colIn = (col) => ((sql3.match(new RegExp('add column if not exists ' + col + ' text[^\\n]*check \\(' + col + ' in \\(([^)]+)\\)')) || [])[1] || '').split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean);
eq('batch, experience, number taught: the same keys in the table checks and the page lists', [colIn('batch'), colIn('exp'), colIn('taught')], [D.keysOf(D.BATCHES), D.keysOf(D.EXPS), D.keysOf(D.TAUGHTS)]);
eq('days and class lengths: the page lists agree with the table checks', [D.keysOf(D.SESSIONS), D.keysOf(D.DAYS)], [((sql3.match(/session_mins in \(0, ([^)]+)\)/) || [])[1] || '').split(',').map(x => x.trim()), ['2', '3', '4', '5', '6', '7']]);
eq('the wishes of a guardian: the same keys in the SQL checks and the page lists', [D.keysOf(D.GENDERS), D.keysOf(D.STUDENT_LEVELS), D.keysOf(D.GOALS)], [['female', 'male'], ((sql3.match(/student_level in \('', ([^)]+)\)/) || [])[1] || '').split(',').map(x => x.trim().replace(/'/g, '')), ((sql3.match(/goal in \('', ([^)]+)\)/) || [])[1] || '').split(',').map(x => x.trim().replace(/'/g, ''))]);
eq('a GPA typed by a person: Bangla digits and a danda are understood; out-of-range or text is refused', [D.normalizeGpa('৪.৮৩'), D.normalizeGpa('5'), D.normalizeGpa('৪।৫'), D.normalizeGpa(' '), D.normalizeGpa('5.5'), D.normalizeGpa('0.9'), D.normalizeGpa('abc'), D.normalizeGpa('4.123')], ['4.83', '5', '4.5', '', null, null, null, null]);
eq('a bad GPA is refused even in a draft, and a link in the achievement line too', [D.validateProfile({ ssc_gpa: '7' }, false), D.validateProfile({ achv: 'দেখুন www.example.com' }, false), D.validateProfile({ ssc_gpa: '', hsc_gpa: '' }, false)], [{ ssc_gpa: 'BAD_GPA' }, { achv: 'BAD_LINK' }, {}]);
eq('the extras never become a required field', Object.keys(D.validateProfile(PROF, true)), []);
eq('a guardian\'s wishes: a wrong key is refused, blank is fine', [D.validateRequest(Object.assign({}, REQ, { pref: 'alien', level: 'x', goal: 'y' })), D.validateRequest(Object.assign({}, REQ, { pref: '', level: '', goal: '', trial: false })), D.validateRequest(Object.assign({}, REQ, { pref: 'female', level: 'weak', goal: 'exam', trial: true }))], [{ pref: 'BAD_PREF', level: 'BAD_LEVEL', goal: 'BAD_GOAL' }, {}, {}]);
eq('the wishes as one line (from the form and from a stored request), and nothing when there are none', [D.prefLine({ pref: 'female', level: 'weak', goal: 'exam', trial: true }), D.prefLine({ pref_gender: 'male', student_level: '', goal: '', want_trial: false }), D.prefLine({})], ['চান: আপু · সন্তান: পড়ায় দুর্বল · লক্ষ্য: পরীক্ষার ভালো প্রস্তুতি · প্রথমে ট্রায়াল ক্লাস চান', 'চান: ভাইয়া', '']);
yes('the text to a tutor carries the wishes (no number, no name)', (() => { const m = D.msgToTutor(Object.assign({}, R, { pref_gender: 'female', student_level: 'weak', want_trial: true }), TU); return m.includes('অভিভাবকের পছন্দ: চান: আপু') && m.includes('ট্রায়াল') && !m.includes('রহিমা') && !m.includes('01712345678'); })());
yes('the text to a tutor is unchanged when there are no wishes', !D.msgToTutor(R, TU).includes('অভিভাবকের পছন্দ'));
yes('the text to a guardian says the tutor accepts a trial, as the tutor\'s word, and never the tutor number', (() => { const m = D.msgToGuardian(R, Object.assign({}, TU, { trial: true })); return m.includes('ট্রায়াল দিতে রাজি (টিউটরের কথা)') && !m.includes('01711223344'); })());
const X = D.extrasOf({ trial: true, pledge_all: true, medium: ['bangla'], exams: ['ssc', 'ielts'], style: ['concept', 'patient'], batch: 'small', days_max: 3, session_mins: 90, exp: 'y3_5', taught: 'n6_20', ssc_gpa: '5.00', hsc_gpa: '4.8', achv: 'ভর্তি পরীক্ষায় উত্তীর্ণ', fee: 'মাসে ২০০০' });
eq('what a guardian sees: two badges, the chips, and the lines', [X.badges.map(b => b.k), X.chips, X.lines.length], [['trial', 'pledge'], ['বাংলা মাধ্যম', 'এসএসসি', 'IELTS'], 6]);
yes('every self-declared line says so, and the fee line says the two sides agree it', X.lines.filter(l => /অভিজ্ঞতা|জিপিএ|অর্জন/.test(l)).every(l => l.includes('(নিজে দিয়েছেন)')) && X.lines.some(l => l.startsWith('ফি: মাসে ২০০০') && l.includes('আপনি আর টিউটর ঠিক করবেন')));
yes('nothing said means nothing shown (no empty badge, no empty line)', (() => { const e = D.extrasOf({}); return e.badges.length === 0 && e.chips.length === 0 && e.lines.length === 0; })());
yes('two promises are not the badge, three are (from the public flag or from the list)', D.extrasOf({ pledge: ['guardian_first', 'hours'] }).badges.length === 0 && D.extrasOf({ pledge: ['guardian_first', 'open_place', 'hours'] }).badges.length === 1 && D.extrasOf({ pledge_all: false }).badges.length === 0);
yes('the fee shows only when the tutor said so (public rows carry it already; a profile needs fee_show)', D.extrasOf({ fee_show: false, fee_note: 'মাসে ২০০০' }).lines.length === 0 && D.extrasOf({ fee_show: true, fee_note: 'মাসে ২০০০' }).lines.length === 1);
yes('the card pieces are escaped (a tag typed into a free line cannot run), and the grey "self-declared" note is wrapped', (() => { const h = D.extrasHtml({ achv: '<img src=x onerror=1>' }, s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))); return !h.lines.includes('<img') && h.lines.includes('&lt;img') && h.lines.includes('<span class="tt-self">(নিজে দিয়েছেন)</span>'); })());
yes('the extras SQL: every new column has a default and a check, and nothing in it makes a "verified" mark', ['medium', 'exams', 'style', 'trial', 'batch', 'days_max', 'session_mins', 'exp', 'taught', 'ssc_gpa', 'hsc_gpa', 'achv', 'fee_show', 'pledge'].every(c => new RegExp('add column if not exists ' + c + ' [^\\n]*not null default').test(sql3)) && !/verify\s*=/.test((sql3.match(/function public\.tutor_profile_save[^]*?end \$\$;/) || [''])[0]));
yes('the extras SQL: the public search returns no phone, real name, area note, admin note, fee switch or promise list, and the fee only when the tutor ticked it', (() => { const body = (sql3.match(/create function public\.tutor_search[^]*?\$\$;/) || [''])[0]; const cols = body.split('returns table')[1].split('language sql')[0]; return !/\b(phone|full_name|area_note|fee_note|fee_show|admin_note|user_id|pledge)\b/.test(cols.replace('pledge_all', '')) && /case when s\.fee_show then s\.fee_note else '' end/.test(body) && /cardinality\(s\.pledge\) >= 3/.test(body); })());
yes('the extras SQL: the old 11-argument request function is dropped (no overload), the new one has defaults for the wishes, and anon may call it and the search but not the profile functions', /drop function if exists public\.tutor_request_add\(text, text, text, text, text, text, text\[\], text, text, text, text\);/.test(sql3) && /p_pref text default '', p_level text default '', p_goal text default '', p_trial boolean default false/.test(sql3) && /grant execute on function public\.tutor_request_add\(text, text, text, text, text, text, text\[\], text, text, text, text, text, text, text, boolean\) to anon, authenticated;/.test(sql3) && /grant execute on function public\.tutor_search\([^)]*\) to anon, authenticated;/.test(sql3) && /revoke execute on function public\.tutor_profile_save\(jsonb, boolean\) from anon;/.test(sql3));
yes('the extras SQL can run twice (add column if not exists, create or replace, drop if exists then create)', !/\bcreate table\b/.test(sql3) && (sql3.match(/drop function if exists/g) || []).length === 3 && /create or replace function public\.tutor_profile_save/.test(sql3));
yes('the join page asks for every extra, in the two optional steps, and the pledge is three separate ticks', ['jTrial', 'jMed', 'jExam', 'jStyle', 'jBatch', 'jDays', 'jSess', 'jExp', 'jTaught', 'jSsc', 'jHsc', 'jAchv', 'jFeeShow', 'jPledge'].every(id => new RegExp('id="' + id + '"').test(join)) && /D\.PLEDGES\.map/.test(join) && (join.match(/class="tt-opt">ঐচ্ছিক</g) || []).length === 2);
yes('the join page says plainly that these are the tutor\'s own words, not a check', /আমরা "যাচাইকৃত" চিহ্ন দিই শুধু কাগজ দেখার পর/.test(join) && /এটা প্রতিশ্রুতি, যাচাই নয়/.test(join));
yes('the join page tells the owner when the server has not been upgraded yet (no silent loss)', /upgraded: !!\(data && 'trial' in data\)/.test(join) && /বাড়তি তথ্য সেভ হবে সার্ভার আপডেটের পর/.test(join));
yes('the request dialog has four steps with an optional wishes step, and the wishes go to the server', /id="rDots"[^]*?<i class="on"><\/i><i><\/i><i><\/i><i><\/i>/.test(page) && ['rPref', 'rLv', 'rGoal', 'rTrial'].every(id => new RegExp('id="' + id + '"').test(page)) && /p_pref: r\.pref, p_level: r\.level, p_goal: r\.goal, p_trial: !!r\.trial/.test(page));
yes('an old server (the SQL not run yet) still gets the plain request instead of an error', /PGRST202\|Could not find the function\|schema cache/.test(page) && /\['p_pref', 'p_level', 'p_goal', 'p_trial'\]\.forEach\(k => \{ delete args\[k\]; \}\)/.test(page));
yes('the tutor card shows the extras, and the sample card in the call-to-action shows them too (labelled as a sample)', /ex\.badges/.test(page) && /ex\.chips/.test(page) && /ex\.lines/.test(page) && /class="tt-sample">নমুনা/.test(page) && /প্রথম ক্লাস ফ্রি ট্রায়াল<\/span><span class="tt-b vio">/.test(page));
yes('the admin shows the extras (as the tutor\'s own words, not a check) and the guardian\'s wishes, and uses the wishes to order candidates', /function ttExtras\(p\)/.test(admin) && /টিউটরের নিজের দেওয়া, যাচাই নয়/.test(admin) && /TD\.prefLine\(r\)/.test(admin) && /r\.pref_gender && p\.gender === r\.pref_gender \? 3 : 0/.test(admin));

// ----- the results system (2026-12-20): the filters, the sorts, the counts, the cards, the address -----
const sql4 = read('migrations/2026-12-20_tutor_browse.sql');
eq('searchArgs carries every new filter and the sort, only when they are on', [D.searchArgs({ district: 'বরিশাল', gender: 'female', medium: 'bangla', exam: 'ssc', trial: true, verified: true, pledge: true, sort: 'new', limit: 12, offset: 12 }), D.searchArgs({ gender: 'alien', medium: 'x', exam: 'y', trial: false, verified: false, pledge: false, sort: 'best' }), D.searchArgs({ sort: 'cheapest' })],
  [{ p_limit: 12, p_offset: 12, p_district: 'বরিশাল', p_gender: 'female', p_medium: 'bangla', p_exam: 'ssc', p_trial: true, p_verified: true, p_pledge: true, p_sort: 'new' }, { p_limit: 12, p_offset: 0 }, { p_limit: 12, p_offset: 0 }]);
eq('facetArgs: only the area and the mode (class, subject and the other filters do not narrow the counts)', [D.facetArgs({ district: 'বরিশাল', upazila: 'বরিশাল সদর', mode: 'home', cls: 'c6-8', subject: 'math', gender: 'female' }), D.facetArgs({ mode: 'any' })], [{ p_district: 'বরিশাল', p_upazila: 'বরিশাল সদর', p_mode: 'home' }, {}]);
const FF = Object.assign(D.blankFilters(), { district: 'বরিশাল', upazila: 'বরিশাল সদর', cls: 'c6-8', subject: 'math', mode: 'home', gender: 'female', medium: 'bangla', exam: 'ssc', trial: true, verified: true, pledge: true, sort: 'verified' });
eq('the filters go to the address and come back the same (and a plain visit has an empty address)', [D.filtersFromQuery(D.queryFromFilters(FF)), D.queryFromFilters(D.blankFilters())], [FF, '']);
eq('an address from outside is cleaned: only values from our lists, flags only "1", a sort only from the list', D.filtersFromQuery('?d=ঢাকা&c=hack&s=<b>&m=zoom&g=alien&md=x&x=y&t=yes&v=2&p=1&o=cheapest'), Object.assign(D.blankFilters(), { district: 'ঢাকা', pledge: true }));
eq('the chips above the results: one per filter that is on, in a fixed order, no sort', D.filterChips(FF).map(x => x[0]).join(), 'district,upazila,mode,cls,subject,gender,medium,exam,trial,verified,pledge');
eq('and none for a plain state', D.filterChips(D.blankFilters()), []);
eq('the classes as one short text: bands next to each other join, a gap stays, admission is its own word', [D.classSpan(['c1-5', 'c6-8']), D.classSpan(['c6-8', 'c9-10', 'c11-12']), D.classSpan(['c1-5', 'c9-10']), D.classSpan(['c9-10', 'admission']), D.classSpan(['admission']), D.classSpan([])], ['১-৮', '৬-১২', '১-৫, ৯-১০', '৯-১০, ভর্তি', 'ভর্তি', '']);
eq('the three small facts of a card are what the tutor offers (classes, how, a free trial), never a claim', [D.statsOf({ classes: ['c9-10'], modes: ['home', 'online'], trial: true }), D.statsOf({ classes: [], modes: ['online'], trial: false })], [[{ l: 'শ্রেণি', v: '৯-১০' }, { l: 'কীভাবে', v: 'বাসা + অনলাইন' }, { l: 'প্রথম ক্লাস', v: 'ফ্রি ট্রায়াল' }], [{ l: 'শ্রেণি', v: '' }, { l: 'কীভাবে', v: 'অনলাইনে' }, { l: 'প্রথম ক্লাস', v: '' }]]);
eq('the three sorts: the page list, the menu and the edge function agree', [D.keysOf(D.SORTS), [...page.matchAll(/class="rs-so" role="option" data-v="([a-z]+)"/g)].map(m => m[1]), ((dir.match(/const TUTOR_SORTS = \[([^\]]+)\]/) || [])[1] || '').split(',').map(x => x.trim().replace(/'/g, ''))], [['best', 'new', 'verified'], ['best', 'new', 'verified'], ['best', 'new', 'verified']]);
eq('mediums and exams: tutor-data.js, the SQL of the extras and the edge function agree', [D.keysOf(D.MEDIUMS), D.keysOf(D.EXAMS)], [((dir.match(/const TUTOR_MEDIUMS = \[([^\]]+)\]/) || [])[1] || '').split(',').map(x => x.trim().replace(/'/g, '')), ((dir.match(/const TUTOR_EXAMS = \[([^\]]+)\]/) || [])[1] || '').split(',').map(x => x.trim().replace(/'/g, ''))]);
yes('the browse SQL: the search has the new filters with defaults, the three sorts, a stable order, and it still returns nothing until the list is on', /p_gender text default null, p_medium text default null, p_exam text default null, p_trial boolean default null, p_verified boolean default null, p_pledge boolean default null, p_sort text default 'best'/.test(sql4) && /p_sort = 'verified'/.test(sql4) && /p_sort = 'new'/.test(sql4) && /s\.pid\n/.test(sql4) && /x\.public_listing/.test(sql4) && /t\.status = 'approved'/.test(sql4));
yes('the browse SQL: the 7-argument search is dropped (no two overloads), and a re-run is fine (create or replace)', /drop function if exists public\.tutor_search\(text, text, text, text, text, int, int\);/.test(sql4) && /create or replace function public\.tutor_search\(/.test(sql4) && !/create table|create policy/.test(sql4));
yes('the facets return only counts: the keys are fixed, there is no phone, name, id or note anywhere in the function, and it is open to anon like the search', (() => { const body = (sql4.match(/function public\.tutor_facets[^]*?\$\$;/) || [''])[0]; return !/\b(phone|full_name|display_name|pid|bio|admin_note|user_id|fee_note)\b/.test(body) && /jsonb_build_object\(\s*'total'/.test(body) && /grant execute on function public\.tutor_facets\(text, text, text\) to anon, authenticated;/.test(sql4); })());
yes('the browse SQL: the search still returns the same columns and none of the private ones', (() => { const cols = ((sql4.match(/create or replace function public\.tutor_search[^]*?language sql/) || [''])[0].split('returns table')[1] || ''); return /pledge_all boolean/.test(cols) && !/\b(phone|full_name|fee_note|fee_show|admin_note|user_id|area_note)\b/.test(cols.replace('pledge_all', '')); })());
yes('the older files drop the longer search before making their own, so running one again never leaves two overloads', /drop function if exists public\.tutor_search\(text, text, text, text, text, int, int, text, text, text, boolean, boolean, boolean, text\);/.test(sql) && /drop function if exists public\.tutor_search\(text, text, text, text, text, int, int, text, text, text, boolean, boolean, boolean, text\);/.test(sql3));
yes('the results markup is the directory\'s: a filter sidebar, a header with the count and the sort, the chips, the cards, the overlay of the phone sheet', ['rsFilters', 'rsReset', 'rsClose', 'rsApply', 'fMode', 'fDist', 'fUp', 'fCls', 'fSub', 'fGender', 'fMed', 'fExam', 'fSwitches', 'ttResT', 'rsCount', 'rsOpen', 'rsFc', 'rsSort', 'rsSortBtn', 'rsSortLbl', 'rsPop', 'rsActive', 'ttResBody', 'rsOverlay'].every(id => new RegExp('id="' + id + '"').test(page)));
yes('the page asks the edge for the list, the counts and the state, and never reads a tutor table or calls the search function itself', /\/api\/dir\?f=tutors&a=/.test(page) && /\/api\/dir\?f=tutorfacets&a=/.test(page) && /\/api\/dir\?f=tutorstate/.test(page) && !/rpc\('tutor_search'|rpc\('tutor_facets'|\.from\(\s*['"]tutor_/.test(page));
yes('the sidebar pickers use the home page\'s picker look (compact: an icon tile, a small label, a round clear button), and the sheet gives them room', /TTSelect\.enhance\(\$\('fDist'\), \{ compact: true/.test(page) && /TTSelect\.enhance\(\$\('fUp'\), \{ compact: true/.test(page) && /tts:toggle/.test(page) && /compact: true/.test(read('tt-select.js')) && /tts-clear/.test(read('tt-select.js')) && /\.rs-filters\.picking\{/.test(css));
yes('the results CSS has the directory\'s shape: a 288px sidebar, a two-column card grid, and below 900px the sidebar is a bottom sheet with an overlay and a one-column list', /\.rs-layout\{display:grid;grid-template-columns:288px minmax\(0,1fr\)/.test(css) && /\.rs-cards\{display:grid;grid-template-columns:repeat\(auto-fill,minmax\(340px,1fr\)\)/.test(css) && /@media\(max-width:900px\)\{\s*\.rs-layout\{grid-template-columns:1fr\}[^]*?\.rs-filters\{position:fixed[^]*?\.rs-cards\{grid-template-columns:1fr\}/.test(css) && /prefers-reduced-motion:reduce\)\{\.rs-new/.test(css));
yes('a card says "যাচাইকৃত" only from the verified flag and otherwise only "অনুমোদিত"; it never prints a phone number; the details say the number is not given', /t\.verified \? '✓ যাচাইকৃত' : 'অনুমোদিত'/.test(page) && !/t\.phone|\.phone\b/.test(page.replace(/p_phone|r\.phone|\$\('rPhone'\)/g, '')) && /ফোন নম্বর আমরা দিই না/.test(page));
yes('the whole card is one keyboard-reachable button (the name) and the details dialog closes with Escape and a click outside', /<button type="button" data-open="/.test(page) && /\.rs-name button::after\{content:'';position:absolute;inset:0/.test(css) && /ov\.id === 'tdOv'/.test(page) && /e\.target === \$\('tdOv'\)/.test(page));
yes('the hero has a direct link to send a request without searching (the request is the main way to a tutor today)', /id="ttDirect"/.test(page) && /\$\('ttDirect'\)\.addEventListener\('click', \(\) => openReq\(null\)\)/.test(page));
yes('the request dialog carries the filters over: who teaches and a free trial', /setPressed\(\$\('rPref'\), S\.f\.gender \|\| ''\)/.test(page) && /\$\('rTrial'\)\.checked = !!S\.f\.trial/.test(page));
yes('with the public list off the page asks nothing about tutors (the answer is known) and shows only the offer', /if\(!S\.listing \|\| needsArea\(\)\)\{ S\.busy = false/.test(page) && /rs-solo/.test(page) && /\.rs-solo \.rs-filters,\.rs-solo \.rs-head,\.rs-solo \.rs-active\{display:none\}/.test(css));
yes('a stale answer never overwrites a newer search (a sequence number) and the counts have their own', /const my = \+\+S\.seq/.test(page) && /if\(my !== S\.seq\) return/.test(page) && /const my = \+\+S\.fseq/.test(page));
yes('no invented numbers, ratings or testimonials in the results code', !/[★⭐]/.test(page) && !/\d+\s*\+?\s*(জন|হাজার)\s*(টিউটর|অভিভাবক)\s*(যুক্ত|আছেন)/.test(page));

const heroArt = (/<div class="tt-art"[^]*?<\/header>/.exec(page) || [''])[0];
yes('under the search there are four lines in this order, each its own block: how to teach, the popular chips, the three ticks, the direct request link (no shared row, no link inside the ticks)', /<div class="tt-modes">[^]*?id="sModeL"[^]*?<div class="tt-quick" id="sQuick">[^]*?<div class="tt-trust">[^]*?<p class="tt-direct">[^]*?id="ttDirect"[^]*?<\/p>\s*<div class="tt-art"/.test(page) && !/tt-chiprow|tt-tlink/.test(page + css) && !/class="tt-trust">(?:(?!<\/div>)[^])*id="ttDirect"/.test(page));
yes('the picture has its own band below the four lines and nothing is drawn over it: it holds no text of its own, and it clips its own corners (so a dropdown is never cut off by the banner)', heroArt.length > 2000 && !/<text[\s>]|<foreignObject/.test(heroArt) && /<svg viewBox="0 0 1200 160"/.test(heroArt) && /\.tt-art\{[^}]*overflow:hidden;border-radius:0 0 31px 31px\}/.test(css) && /\.tt-art svg\{[^}]*aspect-ratio:1200\/160/.test(css) && !/\.tt-hero2\{[^}]*overflow:hidden/.test(css));
yes('the banner stays compact: the phone puts the four fields two by two and hides the online screen of the picture (it would be cut in half there)', /\.tt-pill\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);padding:8px;margin-top:16px\}/.test(css) && /\.tt-art \.tt-mon\{display:none\}/.test(css) && /class="tt-mon"/.test(page));
yes('the headline and the lead are short enough for the compact banner, and the free-for-guardians line is kept (in the row of ticks)', /<p class="lead">বিশ্ববিদ্যালয়ের শিক্ষার্থী টিউটর, আপনার এলাকায় বা অনলাইনে।<\/p>/.test(page) && /অভিভাবকের জন্য ফ্রি<\/span>/.test(page));

// ----- a signed-in tutor's first tap must stick (the join page used to start its flow twice and wire every chip box twice) -----
yes('the join page starts its flow once even when the member script also announces the sign-in, and wires each chip box once', /function boot\(\)\{[^}]*bootP/.test(join) && /async function bootRun\(\)/.test(join) && /if\(box\.dataset\.wired\) return; box\.dataset\.wired = '1'/.test(join));

yes('/tutor has no breadcrumb (its hero is the top of the page and keeps its distance from the menu by itself); the join page keeps its own', !/tt-crumb/.test(page) && /<header class="tt-hero2 tt-top">/.test(page) && /\.tt-hero2\.tt-top\{margin-top:98px\}/.test(css) && /@media\(max-width:640px\)\{\.tt-hero2\.tt-top\{margin-top:84px\}\}/.test(css) && /class="tt-crumb"/.test(join));

// ----- the card-style dropdown -----
const tts = read('tt-select.js');
yes('the dropdown file is loaded before the page code on both pages, and every area picker is wrapped by it', [page, join].every(h => h.indexOf('/tt-select.js?v=2') > -1 && h.indexOf('tt-select.js') < h.indexOf("const D = window.TutorData")) && ['sDist', 'sUp', 'sCls', 'sSub', 'rDist', 'rUp'].every(id => new RegExp("TTSelect\\.enhance\\(\\$\\('" + id + "'\\)").test(page)) && ['jDist', 'jUp'].every(id => new RegExp("TTSelect\\.enhance\\(\\$\\('" + id + "'\\)").test(join)));
yes('the dropdown keeps the real select as the source of truth (hidden, value setter followed, focus passed on, options and disabled watched) and sends nothing anywhere', /tts-native/.test(tts) && /defineProperty\(sel, 'value'/.test(tts) && /sel\.focus = /.test(tts) && /MutationObserver/.test(tts) && !/fetch\(|XMLHttpRequest|sendBeacon|localStorage|document\.cookie/.test(tts));
yes('the dropdown escapes the option text it prints and can be used with the keyboard', /esc\(text\)/.test(tts) && /esc\(x\.value\)|esc\(v\)/.test(tts) && /ArrowDown/.test(tts) && /Escape/.test(tts) && /aria-haspopup="listbox"/.test(tts));
yes('the dropdown look: hidden native select, search box, two-column option cards, a bottom sheet on a phone, no motion when reduced', /\.tts-native\{display:none!important\}/.test(css) && /\.tts-search/.test(css) && /\.tts-list\{[^}]*grid-template-columns:1fr 1fr/.test(css) && /\.tts-float \.tts-panel\{position:fixed/.test(css) && /prefers-reduced-motion:reduce\)\{[^}]*\.tts\.open \.tts-panel[^{]*\{animation:none/.test(css) && /\.tt-pick button\[aria-pressed=true\]\{background:linear-gradient/.test(css));

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

// ----- the links that make it visible (added after the SQL was run) -----
const nav = read('nav.js'), foot = read('footer.js'), card = read('card.html'), sm = read('sitemap-pages.xml'), hub = read('guide.html');
// the service is not finished, so the top menu does not show it (the icon and a one-line way to bring it back stay in nav.js)
const navLive = nav.replace(/\/\*[^]*?\*\//g, '');
yes('the top menu does not show the tutor page yet, but keeps its icon ready', !/k: 'tutor'/.test(navLive) && !/tutor\.html/.test(navLive) && /tutor: '<svg/.test(nav) && /k: 'tutor', t: 'ভাইয়া-আপু'[^}]*href: 'tutor\.html'/.test(nav));
yes('no page marks a tutor item active in a menu that has none', !/data-active="tutor"/.test(page + join));
yes('the footer links the tutor page', /\['ভাইয়া-আপু \(টিউটর\)', 'tutor\.html'\]/.test(foot));
yes('the card page: a small line in the download popup, and two cards side by side (Facebook on the left, the tutor service on the right)', /href="\/tutor-join" onclick="window\.track&amp;&amp;window\.track\('card_tutor_link'\)"/.test(card) && /<div class="promo-row">[^]*class="fb-follow">[^]*class="fb-follow tcard">/.test(card) && card.indexOf('class="fb-follow">') < card.indexOf('class="fb-follow tcard">') && /\.promo-row\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(card) && /@media\(max-width:820px\)\{\.promo-row\{grid-template-columns:1fr/.test(card));
const tcard = (card.match(/<div class="fb-follow tcard">[^]*?<\/div>\s*<\/div>\s*<\/div>/) || [''])[0];
yes('the tutor card has a find link and a join link with their own events, and says only what is true: free for guardians, the number goes only to a tutor who agrees, joining is free and the number stays private', /href="\/tutor" onclick="window\.track&amp;&amp;window\.track\('card_tutor_card_find'\)"/.test(tcard) && /href="\/tutor-join" onclick="window\.track&amp;&amp;window\.track\('card_tutor_card_join'\)"/.test(tcard) && /অভিভাবকের জন্য আমাদের সেবা ফ্রি/.test(tcard) && /আপনার নম্বর শুধু রাজি হওয়া টিউটর দেখবেন/.test(tcard) && /যোগ দেওয়া ফ্রি, ফোন নম্বর গোপন থাকে/.test(tcard));
yes('the tutor card promises nothing that is not there (no list of tutors yet, no income, no time, no numbers of people)', !/তালিকা|আয়|টাকা|ঘণ্টা|মিনিট|[০-৯0-9]+\s*(জন|হাজার)|সেরা|গ্যারান্টি|নিশ্চিত/.test(tcard.replace(/নিশ্চয়তা/g, '')));
yes('the old slim band is gone, and the ad place is still the last thing in main', !/tband/.test(card) && card.indexOf('</main>') - card.indexOf('data-slot="card-end"') < 80);
yes('the sitemap lists /tutor and not the personal flow', /<loc>https:\/\/protishthan\.com\/tutor<\/loc>/.test(sm) && !/tutor-join/.test(sm));
yes('the guide hub links the tutor page', /href="\/tutor"/.test(hub));
yes('every page asks for the current menu and footer scripts (the new links would not show for hours otherwise)', fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).every(f => { const h = read(f); return !/nav\.js\?v=[0-8]\b/.test(h) && !/footer\.js\?v=1[0-4]\b/.test(h); }));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
