// one institution, one listing: the listing form's red alert, the server's check, and the admin's check before approving.   node tools/tests/test_dup_guard.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);

// ---- bnname.js: the box the person sees
const win = {}, doc = { createElement: () => ({ setAttribute() {}, style: {}, appendChild() {} }), head: { appendChild() {} }, body: { appendChild() {} } };
new Function('window', 'document', read('bnname.js'))(win, doc);
const B = win.BnName;
const row = o => Object.assign({ match_level: 'same_upazila', institution_name: 'ঢাকা কলেজ', institution_type: 'কলেজ', district: 'ঢাকা', upazila: 'ধানমন্ডি', desired_slug: 'dhaka-college', status: 'approved', verification: 'verified', id: 'id-1', needs_bn_name: false }, o || {});
const en = row({ match_level: 'likely_same', institution_name: 'Dhaka College', needs_bn_name: true, id: 'id-2' });
let h = B.dupHtml([row()], { canSuggest: true });
yes('the same name in the same upazila is refused (red, no way to continue)', /dup-stop/.test(h) && /আগেই তালিকায় আছে/.test(h) && !/dupDiff/.test(h));
h = B.dupHtml([en], { canSuggest: true });
yes('a name that sounds the same in the same upazila is a RED alert with the existing listing (its English name, type, upazila, district) shown', /dup-stop/.test(h) && /আগেই তালিকায় আছে বলে মনে হচ্ছে/.test(h) && /Dhaka College/.test(h) && /ধানমন্ডি/.test(h));
yes('the red alert asks the person to say it is a different institution (a tick) before going on', /<input type="checkbox" id="dupDiff">/.test(h) && /আলাদা প্রতিষ্ঠান/.test(h));
yes('on a listing that has only an English name, "this is mine: send the Bangla name" is offered, and nowhere else', /data-dup-suggest="id-2"/.test(h) && !/data-dup-suggest/.test(B.dupHtml([row({ match_level: 'likely_same', needs_bn_name: false })], { canSuggest: true })) && !/data-dup-suggest/.test(B.dupHtml([en], {})) && !/data-dup-suggest/.test(B.dupHtml([row({ match_level: 'likely_same', needs_bn_name: true, status: 'pending' })], { canSuggest: true })));
yes('a pending listing is shown as waiting for approval', /অনুমোদনের অপেক্ষায়/.test(B.dupHtml([row({ status: 'pending' })], {})));
yes('the same name in another upazila, or a sound-alike elsewhere, is only a note (yellow)', /dup-note/.test(B.dupHtml([row({ match_level: 'same_district', upazila: 'মিরপুর' })], {})) && /dup-note/.test(B.dupHtml([row({ match_level: 'similar' })], {})) && !/dup-stop/.test(B.dupHtml([row({ match_level: 'similar' })], {})));
yes('a same-upazila match wins over a likely one (refused outright)', /dup-stop/.test(B.dupHtml([en, row()], {})) && !/dupDiff/.test(B.dupHtml([en, row()], {})));
eq('the tick belongs to exactly this set of listings', [B.likelyKey([en, row()]), B.likelyKey([row()]), B.likelyKey([])], ['id-2', '', '']);
yes('everything printed is escaped', !/<img/.test(B.dupHtml([row({ match_level: 'likely_same', institution_name: '<img src=x onerror=1>' })], {})));

// ---- the SQL
const sql = read('migrations/2026-12-22_duplicate_guard.sql');
yes('directory_check keeps its arguments and now returns the id and whether the Bangla name is missing', /drop function if exists public\.directory_check\(text, text, text\);/.test(sql) && /returns table \(match_level text, institution_name text, institution_type text, district text, upazila text,\s*desired_slug text, status text, verification text, id uuid, needs_bn_name boolean\)/.test(sql));
yes('four levels: same name here, same sound here, same name elsewhere, same sound elsewhere; pending and approved, never hidden ones', /when m\.exact and m\.here then 'same_upazila'/.test(sql) && /when m\.here then 'likely_same'/.test(sql) && /when m\.exact then 'same_district'/.test(sql) && /else 'similar'/.test(sql) && /l\.status in \('pending', 'approved'\) and coalesce\(l\.is_hidden, false\) = false/.test(sql) && /l\.phon_key_en = k\.p/.test(sql) && /l\.search_key_en = k\.q/.test(sql));
yes('the check is open to the form (anon and signed in) and closed to everyone else', /revoke all on function public\.directory_check\(text, text, text\) from public;/.test(sql) && /grant execute on function public\.directory_check\(text, text, text\) to anon, authenticated;/.test(sql));
yes('an English letter in a name is refused on INSERT only, only for hand-submitted rows, and never for the admin', /before insert on public\.listing_submissions/.test(sql) && !/before (insert or update|update)/.test(sql) && /new\.source is null and new\.institution_name ~ '\[A-Za-z\]' and not coalesce\(public\.is_admin\(\), false\)/.test(sql) && /ENGLISH_NAME_NOT_ALLOWED/.test(sql));

// ---- the listing form
const page = read('list-institution.html');
yes('the form stops on a same-upazila match, and on a same-sound match until the person ticks "this is a different one" for exactly that set', /DUP_STOP = rows\.some\(r => r\.match_level === 'same_upazila'\) \|\| \(!!lk && DUP_ACK !== lk\);/.test(page) && /DUP_ACK = ck\.checked \? lk : ''/.test(page) && /ck\.checked = DUP_ACK === lk/.test(page));
yes('"send the Bangla name" calls the existing suggestion function for that listing, then stops the form from making a second listing until the name is changed', /sb\.rpc\('suggest_bangla_name', \{ p_listing: btn\.getAttribute\('data-dup-suggest'\), p_name: nm, p_device: deviceId\(\) \}\)/.test(page) && /if\(DUP_DONE && DUP_DONE !== nm\) DUP_DONE = '';\s*if\(DUP_DONE\)\{ DUP_STOP = true; return \[\]; \}/.test(page) && /DUP_DONE = nm; DUP_STOP = true;/.test(page));
yes('the check runs before step 2 and again just before saving, and an English letter in the name is still refused by the form', (page.match(/await refreshDup\(\);/g) || []).length >= 2 && /BnName\.hasLatin\(name\)/.test(page));
yes('every page that loads the name helper asks for the new version', fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).every(f => { const m = read(f).match(/bnname\.js\?v=(\d+)/); return !m || Number(m[1]) >= 5; }));

// ---- the admin: before approving
const admin = read('admin.html');
const block = (admin.match(/\/\* DUPCHK-START[^]*?\/\* DUPCHK-END \*\//) || [''])[0];
yes('the admin block is there', block.length > 400);
const { dupOthers, dupLine } = new Function(block + '; return { dupOthers, dupLine };')();
const me = { id: 'me', institution_name: 'ঢাকা কলেজ', status: 'pending' };
eq('the row itself is left out (by id)', dupOthers([row({ id: 'me', status: 'pending' }), row({ id: 'other' })], me).map(x => x.id), ['other']);
eq('the row itself is left out when an older function gives no id', dupOthers([{ match_level: 'same_upazila', institution_name: 'ঢাকা কলেজ', status: 'pending' }, { match_level: 'same_upazila', institution_name: 'ঢাকা কলেজ', status: 'approved' }], me).length, 1);
eq('only a same-name or same-sound match in the same upazila counts', dupOthers([row({ id: 'a', match_level: 'same_district' }), row({ id: 'b', match_level: 'similar' }), row({ id: 'c', match_level: 'likely_same' })], me).map(x => x.id), ['c']);
yes('a line says what and where', /ঢাকা কলেজ \(কলেজ · ধানমন্ডি · ঢাকা, অনুমোদিত\)/.test(dupLine(row())));
yes('approving asks again and wants a yes before a second listing of the same institution is approved; the detail shows a red box for a pending row', /const dups = await subDupRows\(row\); if\(dups\.length && !confirm\(/.test(admin) && /একই প্রতিষ্ঠান দুবার অনুমোদন দিলে তালিকায় দুটো হবে/.test(admin) && /id="subDupBox"/.test(admin) && /window\._detailId !== s\.id/.test(admin));
yes('the check blocks nothing by itself: no function in the block changes a row', !/update\(|insert\(|delete\(/.test(block));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
