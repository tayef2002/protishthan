// Tutor Alert on the member dashboard (tutoralert.js, tutoralert.css) against the SQL it calls (migrations/2027-01-08_tutor_alerts.sql) and how it is wired.   node tools/tests/test_tutoralert.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const read = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
let pass = 0, fail = 0;
const yes = (name, v) => { const ok = !!v; ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name); };
const js = read('tutoralert.js'), css = read('tutoralert.css'), sql = read('migrations/2027-01-08_tutor_alerts.sql'), mem = read('member.html'), mjs = read('member.js'), join = read('tutor-join.html');

// the calls and their argument names are the SQL ones
const sigs = {}; for (const m of sql.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)) sigs[m[1]] = m[2].split(',').map(x => x.trim().split(/\s+/)[0]).filter(x => /^p_/.test(x));
const calls = [...(js + mjs).matchAll(/rpc\('(tutor_\w+)'(?:,\s*\{([^}]*)\})?/g)].map(m => [m[1], (m[2] || '').split(',').map(x => x.split(':')[0].trim()).filter(Boolean)]);
const mine = calls.filter(c => /tutor_alert/.test(c[0]));
yes('the page calls tutor_alerts_me, tutor_alert_unread, tutor_alert_seen(p_ids) and tutor_alert_reply(p_id, p_reply), exactly as the SQL defines them', ['tutor_alerts_me', 'tutor_alert_unread', 'tutor_alert_seen', 'tutor_alert_reply'].every(n => !!sigs[n] && mine.some(c => c[0] === n)) && mine.every(c => c[1].every(a => (sigs[c[0]] || []).includes(a))));

// the privacy promise: the guardian's name and number never reach the page
const body = (sql.match(/create or replace function public\.tutor_alerts_me\(\)[\s\S]*?\$\$;/) || [''])[0];
yes('THE SQL answer has no guardian name, number, device or user id (privacy.html section 8: no tutor sees a guardian number)', /jsonb_build_object/.test(body) && !/\br\.name\b|\br\.phone\b|\br\.device\b|\br\.user_id\b|admin_note/.test(body));
yes('the page shows no name or number either (it has nothing of the kind to show), and says so', !/\.phone|\.name\b|guardian_name/.test(js) && /অভিভাবকের নাম বা নম্বর আপনাকে দেখানো হয় না/.test(js));
yes('only an APPROVED tutor gets an alert from a guardian request; a request that the admin marked spam is hidden and not counted', /p\.status = 'approved'/.test(sql) && (sql.match(/r\.status <> 'spam'/g) || []).length >= 3);
yes('an answer is only "accepted" or "declined", for the tutor own alert, and not after the admin marked it started', /p_reply not in \('accepted', 'declined'\)/.test(sql) && /m\.tutor_id = auth\.uid\(\)/.test(sql) && /ALREADY_STARTED/.test(sql) && /data-a="accepted"/.test(js) && /data-a="declined"/.test(js) && /ALREADY_STARTED/.test(js));
yes('the four functions are closed to anon (revoked by name, Supabase grants anon by default) and open to signed-in members', /tutor_alerts_me\(\) from public, anon/.test(sql) && /tutor_alert_reply\(uuid, text\) from public, anon/.test(sql) && /grant execute on function public\.tutor_alert_reply\(uuid, text\) to authenticated/.test(sql));
yes('older matches are not shown as new when the migration is run (seen_at is back-filled once, only when the column is made)', /column_name = 'seen_at'/.test(sql) && /update public\.tutor_matches set seen_at = created_at/.test(sql));

// the page
yes('a tutor with a profile that is not a draft sees the menu item; others do not, and a person without a profile gets a way to make one', /ST\.profile\.status !== 'draft'/.test(js) && /\.sn-ta/.test(js) && /tutor-join\.html/.test(js) && /আপনার টিউটর প্রোফাইল এখনও নেই/.test(js));
yes('the alert shows class, subjects, how and where, the wishes, the note, who sent it, and how long ago; the new ones are marked and counted on the menu', /T\.labelOf\(T\.CLASSES/.test(js) && /T\.labels\(T\.SUBJECTS/.test(js) && /T\.prefLine\(a\)/.test(js) && /a\.note/.test(js) && /একজন অভিভাবক আপনাকে বেছে নিয়েছেন/.test(js) && /আমাদের টিম আপনার কাছে অনুরোধ পাঠিয়েছে/.test(js) && /cnt-ta/.test(js) && /ta-new/.test(js));
yes('the alerts on the screen count as seen after a moment (one call), the page asks again only while it is open and visible, slowly', /setTimeout\(async \(\) =>/.test(js) && /rpc\('tutor_alert_seen'/.test(js) && /document\.hidden/.test(js) && /90000/.test(js));
yes('a failed read says so, nothing is invented', /অ্যালার্ট এখন পড়া যায়নি/.test(js));
yes('the dashboard has the section, the menu item, the view, the styles and the scripts (tutor-data.js before tutoralert.js)', /id="tutoralert"/.test(mem) && /id="taBox"/.test(mem) && /href: '#tutoralert'/.test(mem) && /tutoralert: \['tutoralert'\]/.test(mem) && /tutoralert\.css/.test(mem) && mem.indexOf('tutor-data.js') > 0 && mem.indexOf('tutor-data.js') < mem.indexOf('tutoralert.js'));
yes('the phone layout stacks, reduced motion is respected', /@media\(max-width:560px\)/.test(css) && /prefers-reduced-motion/.test(css));

// the bell on every page: no extra call for people who are not tutors
yes('member.js asks for new alerts only when this browser knows the member is a tutor (flag prot_is_tutor), and puts a dot and a line on the bell', /ls\.get\('prot_is_tutor'\) === '1'\) sb\.rpc\('tutor_alert_unread'\)/.test(mjs) && /mb-ta/.test(mjs));
yes('the flag is set by the dashboard and by the join page, and removed when the profile is gone', /localStorage\.setItem\(FLAG, '1'\)/.test(js) && /localStorage\.removeItem\(FLAG\)/.test(js) && /localStorage\.setItem\('prot_is_tutor', '1'\)/.test(join));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
