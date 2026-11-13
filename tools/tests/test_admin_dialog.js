// the admin's own pop-ups (no browser "protishthan.com says" boxes) and the one-session rule.   node tools/tests/test_admin_dialog.js
const fs = require('fs'), path = require('path');
const admin = fs.readFileSync(path.join(__dirname, '..', '..', 'admin.html'), 'utf8');
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const yes = (name, v) => eq(name, !!v, true);

const code = admin.replace(/\/\*[^]*?\*\//g, m => m.startsWith('/* ADMINDLG') ? m : '');   // keep the block markers, drop other block comments
const block = (admin.match(/\/\* ADMINDLG-START[^]*?\/\* ADMINDLG-END \*\//) || [''])[0];
yes('the dialog block is in the admin page', block.length > 1500);

// ---- no native box is left anywhere in the page
const rest = admin.replace(block, '');
eq('no native confirm() or prompt() is left (every one goes through the module)', (rest.match(/(?<![\w.])(confirm|prompt)\(/g) || []).length, 0);
yes('alert() is routed to the module, so every old message gets the same look', /window\.alert = function\(m\)\{ window\.adminAlert\(m\); \};/.test(block));
yes('every await adminConfirm / adminPrompt sits in an async function (the page parses; a function that is not async would not)', (() => { const re = /<script>([^]*?)<\/script>/g; let m; while((m = re.exec(admin))){ if(m[1].length < 200) continue; try{ new Function(m[1]); }catch(e){ return false; } } return true; })());
yes('the two functions that were not async are now (the reject note and the verify question)', /async function ttReject\(uid\)/.test(admin) && /async function ttVerify\(uid\)/.test(admin));

// ---- one client for the whole page: the admin gate's session
eq('there is exactly one Supabase client in the page and `sb` is that one', [(admin.match(/supabase\.createClient\(/g) || []).length, /const sb = sbAdmin;/.test(admin), /const sb = createClient\(/.test(admin)], [1, true, false]);

// ---- the module itself: its codes, tones and text-only output
yes('the raw server codes become sentences, the longest name first (so ENGLISH_NAME_NOT_ALLOWED is not mistaken for NOT_ALLOWED)', block.indexOf('ENGLISH_NAME_NOT_ALLOWED:') < block.indexOf('NOT_ALLOWED: ') && /NOT_ALLOWED: 'এই কাজের অনুমতি পাওয়া যায়নি/.test(block) && /NOT_SIGNED_IN:/.test(block) && /DUPLICATE_INSTITUTION:/.test(block));
yes('the message is set as text (never as HTML), so nothing typed or sent by a server can inject markup', /querySelector\('\.ad-msg'\)\.textContent = o\.message/.test(block) && /querySelector\('\.ad-t'\)\.textContent = o\.title/.test(block) && !/\.ad-msg'\)\.innerHTML/.test(block));
yes('a question about deleting is red ("হ্যাঁ, মুছুন"); the others are amber; Escape and a click outside say no, Enter says yes, Tab stays inside', /var danger = \/মুছ\|চিরতরে\/\.test\(String\(message\)\)/.test(block) && /হ্যাঁ, মুছুন/.test(block) && /e\.key === 'Escape'/.test(block) && /e\.key === 'Enter'/.test(block) && /e\.key === 'Tab'/.test(block) && /e\.target === host && o\.cancel !== null/.test(block));
yes('a red question, and the duplicate question, start on "cancel" (so a stray Enter does not delete or approve a second copy)', /\(o\.focus === 'cancel' \|\| o\.tone === 'danger'\) && no \? '\.ad-no' : '\.ad-ok'/.test(block) && /cancel: 'আগে মিলিয়ে দেখি', focus: 'cancel'/.test(admin));
yes('the dialog styles: above everything (5000), a pop animation, the tone class apart from the button class, a phone layout, and no motion when reduced', /\.ad-ov\{position:fixed;inset:0;z-index:5000/.test(admin) && /ad-tone-danger \.ad-btn\.ad-ok/.test(admin) && /@media\(max-width:480px\)\{\.ad-act\{flex-direction:column-reverse\}/.test(admin) && /prefers-reduced-motion:reduce\)\{\.ad-ov,\.ad-box\{animation:none\}/.test(admin));
yes('approving a listing that may already exist asks in its own words (title, amber, "approve anyway", "let me check first")', /title: 'একই প্রতিষ্ঠান আগেই আছে', tone: 'warn', ok: 'তবুও অনুমোদন দিন', cancel: 'আগে মিলিয়ে দেখি', focus: 'cancel'/.test(admin));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
