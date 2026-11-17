// Tutor Alert on the ADMIN panel (admin.html): who asked for which tutor, who still has to be told by WhatsApp, the tutor's answer, and the news every 45 seconds.
//   node tools/tests/test_tutor_alert_admin.js
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
let pass = 0, fail = 0;
const yes = (name, v) => { const ok = !!v; ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name); };
const adm = read('admin.html'), sql = read('migrations/2027-01-09_tutor_alert_admin.sql'), TD = require('../../tutor-data.js');

// the WhatsApp to the tutor
const R = { class_band: 'c9-10', subjects: ['math'], mode: 'home', district: 'বরিশাল', upazila: 'বরিশাল সদর', pref_gender: 'female', student_level: 'mid', name: 'রহিমা বেগম', phone: '01712345678' };
const T = { display_name: 'করিম ভাইয়া', full_name: 'করিম হোসেন' };
const m = TD.msgAlertTutor(R, T);
yes('the message to a tutor names the request and the wishes, where to answer (the dashboard Tutor Alert), and carries NO guardian name or number', m.includes('করিম ভাইয়া') && m.includes('বরিশাল সদর') && m.includes('গণিত') && m.includes('অভিভাবকের পছন্দ') && m.includes('https://protishthan.com/member#tutoralert') && !m.includes('রহিমা') && !m.includes('01712345678'));
yes('the message says the contact is made only with the guardian\'s agreement', m.includes('অভিভাবকের সম্মতি নিয়ে'));
yes('with no wishes the message has no wishes line', !TD.msgAlertTutor(Object.assign({}, R, { pref_gender: '', student_level: '' }), T).includes('অভিভাবকের পছন্দ'));

// the SQL
yes('wa_at is added once; the matches the admin made before are marked done only when the column is made (a second run does not mark new alerts)', /column_name = 'wa_at'/.test(sql) && /where source = 'admin'/.test(sql) && /if not exists \(select 1 from information_schema\.columns/.test(sql));
yes('nothing new is opened to anybody (no grant in the file): only the admin reads or changes the matches', !/\bgrant\b/i.test(sql));

// the tab
yes('the tab is the first of three (Tutor Alert, guardian requests, tutor profiles), with a red count of the alerts that wait for a WhatsApp', /id="ttT-alert"/.test(adm) && /id="ttAlertN"/.test(adm) && /\['alert', 'req', 'pro'\]\.forEach/.test(adm) && /id="ttBoxAlert" hidden/.test(adm));
yes('the list is the tutor_matches rows, newest first; "WhatsApp বাকি" (wa_at empty) is the default view, "সব" shows all; a request marked spam is left out', /const ttTodo = \(\) => TT_MAT\.filter\(m => !m\.wa_at/.test(adm) && /TT_AF === 'all' \|\| !m\.wa_at/.test(adm) && /r\.status !== 'spam'/.test(adm) && /localeCompare\(String\(x\.created_at\)\)/.test(adm));
yes('each alert shows who sent it (the guardian chose the tutor, or the team), the tutor\'s answer, whether the tutor has seen it, whether the WhatsApp is done and when, the tutor with the number, the request, the wishes, the note; the guardian name and number are for the admin only', /অভিভাবক টিউটরকে বেছে নিয়েছেন/.test(adm) && /টিউটরের উত্তর: /.test(adm) && /টিউটর এখনও দেখেননি/.test(adm) && /WhatsApp বাকি/.test(adm) && /WhatsApp হয়েছে · /.test(adm) && /শুধু আপনি দেখেন/.test(adm));
yes('"টিউটরকে WhatsApp করুন" opens the window first (not blocked by the browser), builds the message without guardian data, saves wa_at, moves a new request to "matching", then opens WhatsApp; a failed save says which SQL to run', /async function ttAlertWa\(mid\)/.test(adm) && /TD\.msgAlertTutor\(r, p\)/.test(adm) && /window\.open\('about:blank', '_blank'\)/.test(adm) && /update\(\{ wa_at: t0 \}\)/.test(adm) && /2027-01-09_tutor_alert_admin\.sql/.test(adm) && /status: 'matching'/.test(adm));
yes('the admin can also mark "done" without sending (told another way) and put it back; after the tutor said yes, the guardian can be sent the tutor\'s identity; the request opens from the alert', /async function ttAlertMark\(mid, on\)/.test(adm) && /ttSendGuardian\(this\.dataset\.r/.test(adm) && /m\.status === 'accepted'/.test(adm) && /function ttAlertOpenReq\(rid\)/.test(adm));
yes('the old way (the request card sends to a tutor) also counts as WhatsApp done', /insert\(\{ request_id: rid, tutor_id: tid, wa_at:/.test(adm));
yes('the other lists follow when a match changes or a request is deleted', /ttMatchStatus = async function/.test(adm) && /ttMatchDel = async function/.test(adm) && /ttReqDel = async function/.test(adm));

// the news
yes('the page asks for news every 45 seconds and when the tab is shown again, with LIGHT questions (only what is newer than what is held: new requests, new matches, tutor replies), and a failed or slow answer changes nothing', /setInterval\(ttPoll, 45000\)/.test(adm) && /\.gt\('created_at', lastReq\)/.test(adm) && /\.gt\('created_at', lastMat\)/.test(adm) && /\.gt\('replied_at', lastRep\)/.test(adm) && /if\(a\.error \|\| b\.error\) return;/.test(adm) && /visibilitychange/.test(adm) && /if\(TT_BUSY/.test(adm));
yes('news is told in four ways: a card on the screen (press opens the tab), the page title when the tab is in the background, a sound only if switched on, a desktop notification only if allowed', /ttToast/.test(adm) && /নতুন Tutor Alert/.test(adm) && /adm_tt_sound/.test(adm) && /Notification\.permission === 'granted'/.test(adm) && /id="ttSound"/.test(adm) && /id="ttDesk"/.test(adm));
yes('it tells about a guardian choosing a tutor, a new request, and a tutor saying yes or no', /একজন অভিভাবক/.test(adm) && /নতুন টিউটর অনুরোধ/.test(adm) && /আগ্রহ জানিয়েছেন ✓/.test(adm) && /"পারব না" বলেছেন/.test(adm));
yes('admin.html loads the new tutor-data.js (the version was raised so the new message function is there)', /tutor-data\.js\?v=6/.test(adm));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
