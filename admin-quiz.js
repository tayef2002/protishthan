/* প্রতিষ্ঠান লিগ, admin side: the QUESTION BANK (migrations/2027-01-10_quiz_bank.sql). Needs quiz-data.js, and the admin page's own sbAdmin / ADMIN_READY / showView / navTitles.
   Write and import questions as drafts, send them to checking, see what the checkers said, fix what is flagged, verify (or let two reviewers verify), retire.
   Only VERIFIED questions will ever reach a player (next steps). The answers never leave this page and the reviewer page. */
(function(){
  'use strict';
  if(window.AdminQuiz) return;
  const Q = window.QuizData;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const bn = Q.bn;
  const ST = { rows: [], checks: [], reviewers: [], status: 'draft', topic: 'all', text: '', edit: null, panel: null, daily: null, league: null, loaded: false, error: '', uid: null, preview: null, msg: '' };
  const B = 'style="padding:7px 12px;margin:6px 8px 0 0;border:1px solid #CBD5E1;border-radius:8px;background:#fff;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer"';
  const B_OK = 'style="padding:7px 12px;margin:6px 8px 0 0;border:1px solid #86EFAC;border-radius:8px;background:#F0FDF4;color:#166534;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer"';
  const B_BLUE = 'style="padding:8px 14px;margin:6px 8px 0 0;border:0;border-radius:8px;background:#1A56DB;color:#fff;font:inherit;font-size:14px;font-weight:700;cursor:pointer"';
  const B_RED = 'style="padding:7px 12px;margin:6px 8px 0 0;border:1px solid #FCA5A5;border-radius:8px;background:#fff;color:#B91C1C;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer"';
  const IN = 'style="width:100%;padding:8px 10px;border:1px solid #CBD5E1;border-radius:8px;font:inherit;font-size:14px;box-sizing:border-box"';
  const SC = { draft: ['#F1F5F9', '#475569'], review: ['#FEF3C7', '#92400E'], flagged: ['#FEE2E2', '#B91C1C'], verified: ['#DCFCE7', '#166534'], retired: ['#E2E8F0', '#64748B'] };
  const chip = (c, t) => '<span style="display:inline-block;font-size:11.5px;font-weight:800;border-radius:100px;padding:2px 9px;background:' + c[0] + ';color:' + c[1] + '">' + esc(t) + '</span>';
  const ERR = { NEED_SOURCE: 'সূত্র লিখুন: কোথায় দেখে যাচাই করা যাবে (বই, ওয়েবসাইট)। সূত্র ছাড়া যাচাইয়ে পাঠানো যায় না।' };
  const errText = e => { const m = String((e && e.message) || e || ''); for(const k in ERR) if(m.indexOf(k) >= 0) return ERR[k]; return /duplicate/i.test(m) ? 'এই তথ্য আগেই আছে।' : 'হয়নি: ' + m; };

  /* ---------- loading ---------- */
  async function load(){
    const root = $('quizRoot'); if(!root) return;
    /* the database gives at most 1000 rows a request: read page by page, or the counts and the duplicate check of an import would only see the newest 1000 */
    const pageAll = async (table, order) => { let all = [], err = null; for(let from = 0; from < 20000; from += 1000){ const p = await table().select('*').order(order, { ascending: false }).range(from, from + 999); if(p.error){ err = p.error; break; } all = all.concat(p.data || []); if((p.data || []).length < 1000) break; } return err ? { error: err } : { data: all }; };
    const [a, c, r] = await Promise.all([
      pageAll(() => sbAdmin.from('quiz_questions'), 'created_at'),
      pageAll(() => sbAdmin.from('quiz_checks'), 'created_at'),
      sbAdmin.from('quiz_reviewers').select('*')]);
    if(a.error){ ST.error = 'লোড করা যায়নি: ' + a.error.message + ' — migrations/2027-01-10_quiz_bank.sql চালানো হয়েছে কি?'; ST.loaded = true; paint(); return; }
    ST.error = ''; ST.rows = a.data || []; ST.checks = (c && c.data) || []; ST.reviewers = (r && r.data) || [];
    if(ST.reviewers.length){
      const m = await sbAdmin.from('members').select('user_id,display_name,email').in('user_id', ST.reviewers.map(x => x.user_id));
      const by = {}; ((m && m.data) || []).forEach(x => { by[x.user_id] = x; }); ST.reviewers.forEach(x => { x.m = by[x.user_id] || null; });
    }
    try{ const u = await sbAdmin.auth.getUser(); ST.uid = u && u.data && u.data.user && u.data.user.id || null; }catch(e){}
    ST.loaded = true; badge(); paint();
  }
  const reviewerName = id => { const x = ST.reviewers.find(r => r.user_id === id); return x ? ((x.m && (x.m.display_name || x.m.email)) || 'যাচাইকারী') : 'যাচাইকারী'; };
  function badge(){ const n = ST.rows.filter(q => q.status === 'flagged').length, b = $('quizBadge'); if(b){ b.textContent = n; b.style.display = n ? '' : 'none'; } }

  /* ---------- the picture ---------- */
  const count = s => ST.rows.filter(q => q.status === s).length;
  function paint(){
    const root = $('quizRoot'); if(!root) return;
    if(!ST.loaded){ root.innerHTML = '<div class="bill-note">লোড হচ্ছে…</div>'; return; }
    if(ST.error){ root.innerHTML = '<div class="bill-note">' + esc(ST.error) + '</div>'; return; }
    const stats = ['draft', 'review', 'flagged', 'verified', 'retired'].map(s => '<button type="button" data-qz="status" data-v="' + s + '" style="border:2px solid ' + (ST.status === s ? '#1A56DB' : '#E2E8F0') + ';border-radius:12px;background:#fff;padding:8px 14px;cursor:pointer;font:inherit;text-align:center;min-width:92px"><b style="display:block;font-size:20px;color:' + SC[s][1] + '">' + bn(count(s)) + '</b><span style="font-size:12.5px;color:#475569">' + Q.STATUS[s] + '</span></button>').join('');
    const vv = count('verified'), byTopic = Q.TOPICS.map(t => t[1] + ' ' + bn(ST.rows.filter(q => q.status === 'verified' && q.topic === t[0]).length)).join(' · ');
    root.innerHTML =
      '<div class="bill-note" style="margin-top:0">এটা কুইজ আর লাইভ ব্যাচ চ্যালেঞ্জের প্রশ্নের ভাণ্ডার। নিয়ম: প্রশ্ন লিখুন বা ইমপোর্ট করুন (খসড়া) → সূত্র দিয়ে "যাচাইয়ে পাঠান" → <b>দুজন আলাদা যাচাইকারী "সঠিক" বললে</b> যাচাই হয়ে যায় (কেউ "ভুল" বললে আপনার কাছে ফিরে আসে)। <b>শুধু যাচাই হওয়া প্রশ্নই খেলোয়াড়ের কাছে যাবে।</b> সম্পাদনা করলে আবার যাচাই লাগে।</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:0 0 12px">' + stats + '</div>' +
      '<div style="font-size:13px;color:#475569;margin-bottom:10px">যাচাই হওয়া: <b>' + bn(vv) + '</b>টি' + (vv ? ' (' + esc(byTopic) + ')' : '') + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">' +
        '<button type="button" ' + B_BLUE + ' data-qz="new">＋ নতুন প্রশ্ন</button><button type="button" ' + B + ' data-qz="panel" data-v="import">📥 অনেক প্রশ্ন একসঙ্গে (ইমপোর্ট)</button><button type="button" ' + B + ' data-qz="panel" data-v="reviewers">👥 যাচাইকারী (' + bn(ST.reviewers.length) + ')</button><button type="button" ' + B + ' data-qz="panel" data-v="daily">📅 আজকের কুইজ</button><button type="button" ' + B + ' data-qz="panel" data-v="league">🚫 লিগ নজরদারি</button>' +
        '<select id="qzTopic" style="padding:7px 10px;border:1px solid #CBD5E1;border-radius:8px;font:inherit;font-size:13.5px;margin-top:6px"><option value="all">সব বিষয়</option>' + Q.TOPICS.map(t => '<option value="' + t[0] + '"' + (ST.topic === t[0] ? ' selected' : '') + '>' + t[1] + '</option>').join('') + '</select>' +
        '<input id="qzText" type="search" placeholder="প্রশ্নে খুঁজুন…" value="' + esc(ST.text) + '" style="padding:7px 10px;border:1px solid #CBD5E1;border-radius:8px;font:inherit;font-size:13.5px;margin-top:6px;min-width:180px"><button type="button" ' + B + ' data-qz="status" data-v="all">সব দেখুন</button></div>' +
      (ST.msg ? '<div class="bill-note" style="background:#F0FDF4;border-color:#86EFAC;color:#166534">' + esc(ST.msg) + '</div>' : '') +
      (ST.panel === 'import' ? importPanel() : '') + (ST.panel === 'reviewers' ? reviewersPanel() : '') + (ST.panel === 'daily' ? dailyPanel() : '') + (ST.panel === 'league' ? leaguePanel() : '') + (ST.edit ? formPanel() : '') +
      '<div id="qzList">' + list() + '</div>';
  }
  function filtered(){
    const t = Q.clean(ST.text).toLowerCase();
    return ST.rows.filter(q => (ST.status === 'all' || q.status === ST.status) && (ST.topic === 'all' || q.topic === ST.topic) && (!t || q.question.toLowerCase().indexOf(t) >= 0 || (q.options || []).some(o => String(o).toLowerCase().indexOf(t) >= 0)));
  }
  function list(){
    const rows = filtered();
    if(!rows.length) return '<div class="bill-note">' + (ST.rows.length ? 'এই ফিল্টারে কোনো প্রশ্ন নেই।' : 'ভাণ্ডার এখনও ফাঁকা। "📥 ইমপোর্ট" দিয়ে tools/quiz/seed-001.json-এর প্রশ্নগুলো তুলতে পারেন (সব খসড়া হয়ে আসবে)।') + '</div>';
    const shown = rows.slice(0, 60);
    return shown.map(card).join('') + (rows.length > shown.length ? '<div class="bill-note">আরও ' + bn(rows.length - shown.length) + 'টি আছে, ফিল্টার বা খোঁজা দিয়ে কমান।</div>' : '');
  }
  function card(q){
    const id = esc(q.id), tl = Q.tally(ST.checks.filter(c => c.question_id === q.id), q.rev), inReview = q.status === 'review' || q.status === 'flagged' || q.status === 'verified';
    let h = '<div style="border:1px solid ' + (q.status === 'flagged' ? '#FCA5A5' : '#E2E8F0') + ';border-radius:14px;padding:14px 16px;margin-bottom:12px;background:#fff">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' + chip(SC[q.status], Q.STATUS[q.status]) + chip(['#EEF3FF', '#1A56DB'], Q.labelOf(Q.TOPICS, q.topic)) + chip(['#F1F5F9', '#475569'], Q.labelOf(Q.BANDS, q.band)) + chip(['#F1F5F9', '#475569'], Q.labelOf(Q.DIFFS, q.difficulty)) +
      (q.rev > 1 ? chip(['#F5F3FF', '#5B21B6'], 'সংস্করণ ' + bn(q.rev)) : '') + (q.verified_at ? chip(['#ECFDF5', '#047857'], (q.verified_by === 'admin' ? 'আপনি যাচাই করেছেন' : 'যাচাইকারীরা যাচাই করেছেন')) : '') +
      '<span style="font-size:12px;color:var(--text-3);margin-left:auto">' + new Date(q.created_at).toLocaleDateString('bn-BD') + '</span></div>' +
      '<div style="font-size:16px;font-weight:700;margin:10px 0 6px;line-height:1.55">' + esc(q.question) + '</div><ol style="margin:0 0 6px;padding-left:22px;line-height:1.75">' +
      (q.options || []).map((o, i) => '<li style="' + (i === q.answer_idx ? 'color:#166534;font-weight:800' : '') + '">' + esc(o) + (i === q.answer_idx ? ' ✓' : '') + '</li>').join('') + '</ol>' +
      (q.explanation ? '<div style="font-size:13.5px;color:#475569">ব্যাখ্যা: ' + esc(q.explanation) + '</div>' : '') +
      '<div style="font-size:13px;color:' + (q.source ? '#475569' : '#B45309') + '">সূত্র: ' + (q.source ? esc(q.source) : 'নেই (যাচাইয়ে পাঠাতে লাগবে)') + '</div>' +
      (q.admin_note ? '<div style="font-size:13px;color:#6D28D9">আপনার নোট: ' + esc(q.admin_note) + '</div>' : '');
    if(inReview){
      const names = l => l.map(c => esc(reviewerName(c.reviewer_id))).join(', ');
      h += '<div style="margin:8px 0;padding:8px 10px;background:#F8FAFF;border:1px solid #E2E8F0;border-radius:10px;font-size:13.5px"><b>যাচাই (এই সংস্করণে):</b> সঠিক ' + bn(tl.ok.length) + '/' + bn(Q.NEED_OK) + (tl.ok.length ? ' (' + names(tl.ok) + ')' : '') + ' · ভুল ' + bn(tl.wrong.length) + ' · নিশ্চিত নই ' + bn(tl.unsure.length) +
        tl.wrong.concat(tl.unsure).map(c => '<div style="margin-top:4px;color:' + (c.verdict === 'wrong' ? '#B91C1C' : '#92400E') + '">' + (c.verdict === 'wrong' ? '✗ ' : '? ') + esc(reviewerName(c.reviewer_id)) + ': ' + esc(c.note || '(লেখা নেই)') + '</div>').join('') + '</div>';
    }
    const A = (a, t, st) => '<button type="button" ' + (st || B) + ' data-qz="act" data-a="' + a + '" data-id="' + id + '">' + t + '</button>';
    h += '<div>' + A('edit', q.status === 'draft' ? 'সম্পাদনা' : 'সম্পাদনা (নতুন সংস্করণ, আবার যাচাই লাগবে)');
    if(q.status === 'draft') h += A('review', 'যাচাইয়ে পাঠান', B_OK) + A('del', 'মুছুন', B_RED);
    if(q.status === 'review') h += A('adminverify', 'নিজে যাচাই করলাম', B_OK) + A('draft', 'খসড়ায় ফেরান');
    if(q.status === 'flagged') h += A('retire', 'বাদ দিন', B_RED) + A('draft', 'খসড়ায় ফেরান');
    if(q.status === 'verified') h += A('retire', 'বাদ দিন', B_RED);
    if(q.status === 'retired') h += A('draft', 'খসড়ায় ফেরান') + A('del', 'মুছুন', B_RED);
    return h + '</div></div>';
  }

  /* ---------- the form ---------- */
  function formPanel(){
    const e = ST.edit, o = e.data;
    return '<div style="border:2px solid #1A56DB;border-radius:14px;padding:16px;margin:0 0 14px;background:#F8FBFF"><b style="font-size:15px">' + (e.id ? 'প্রশ্ন সম্পাদনা' : 'নতুন প্রশ্ন') + '</b>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0"><label>বিষয়<select id="qfTopic" ' + IN + '>' + Q.TOPICS.map(t => '<option value="' + t[0] + '"' + (o.topic === t[0] ? ' selected' : '') + '>' + t[1] + '</option>').join('') + '</select></label>' +
      '<label>শ্রেণি<select id="qfBand" ' + IN + '>' + Q.BANDS.map(t => '<option value="' + t[0] + '"' + (o.band === t[0] ? ' selected' : '') + '>' + t[1] + '</option>').join('') + '</select></label>' +
      '<label>কঠিনতা<select id="qfDiff" ' + IN + '>' + Q.DIFFS.map(t => '<option value="' + t[0] + '"' + (Number(o.difficulty) === t[0] ? ' selected' : '') + '>' + t[1] + '</option>').join('') + '</select></label></div>' +
      '<label>প্রশ্ন<textarea id="qfQ" rows="2" maxlength="300" ' + IN + '>' + esc(o.question) + '</textarea></label>' +
      '<div style="margin:10px 0 4px;font-weight:700">চারটা উত্তর <span style="font-weight:500;color:#64748B">(গোল বোতামে সঠিকটা বেছে নিন)</span></div>' +
      [0, 1, 2, 3].map(i => '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><input type="radio" name="qfA" value="' + i + '"' + (Number(o.answer_idx) === i ? ' checked' : '') + ' style="width:18px;height:18px"><input id="qfO' + i + '" ' + IN + ' maxlength="100" placeholder="উত্তর ' + bn(i + 1) + '" value="' + esc((o.options || [])[i] || '') + '"></div>').join('') +
      '<label>ব্যাখ্যা (খেলা শেষে দেখানো হবে)<input id="qfE" ' + IN + ' maxlength="300" value="' + esc(o.explanation) + '"></label>' +
      '<label>সূত্র: কোথায় দেখে যাচাই করা যাবে <span style="color:#B45309">(যাচাইয়ে পাঠাতে লাগবে)</span><input id="qfS" ' + IN + ' maxlength="200" placeholder="যেমন: পাঠ্যবই বিজ্ঞান, শ্রেণি ৭, অধ্যায় ৩" value="' + esc(o.source) + '"></label>' +
      '<label>আপনার নোট (শুধু আপনি দেখেন)<input id="qfN" ' + IN + ' maxlength="600" value="' + esc(o.admin_note) + '"></label>' +
      '<div id="qfErr" style="display:none;color:#B91C1C;margin-top:8px;font-weight:700"></div>' +
      '<div><button type="button" ' + B_BLUE + ' data-qz="save" data-v="draft">সেভ করুন</button>' + (e.id && e.status !== 'draft' ? '' : '<button type="button" ' + B_OK + ' data-qz="save" data-v="review">সেভ করে যাচাইয়ে পাঠান</button>') + '<button type="button" ' + B + ' data-qz="cancel">বাতিল</button></div></div>';
  }
  function readForm(){
    return { topic: $('qfTopic').value, band: $('qfBand').value, difficulty: Number($('qfDiff').value), question: $('qfQ').value, options: [0, 1, 2, 3].map(i => $('qfO' + i).value), answer_idx: Number((document.querySelector('input[name="qfA"]:checked') || {}).value), explanation: $('qfE').value, source: $('qfS').value, admin_note: Q.clean($('qfN').value) };
  }
  async function save(target){
    const err = $('qfErr'); err.style.display = 'none'; const o = readForm();
    const bad = Q.validateQuestion(o) || (target === 'review' && Q.clean(o.source).length < 3 ? 'সূত্র লিখুন, নাহলে যাচাইয়ে পাঠানো যায় না।' : '');
    if(bad){ err.textContent = bad; err.style.display = 'block'; return; }
    const row = Object.assign(Q.normalize(o), { admin_note: o.admin_note });
    let res;
    if(ST.edit.id){ if(ST.edit.status === 'draft' && target === 'review') row.status = 'review'; res = await sbAdmin.from('quiz_questions').update(row).eq('id', ST.edit.id).select().single(); }
    else { row.status = target === 'review' ? 'review' : 'draft'; row.created_by = ST.uid; res = await sbAdmin.from('quiz_questions').insert(row).select().single(); }
    if(res.error){ err.textContent = errText(res.error); err.style.display = 'block'; return; }
    const i = ST.rows.findIndex(x => x.id === res.data.id); if(i >= 0) ST.rows[i] = res.data; else ST.rows.unshift(res.data);
    ST.msg = ST.edit.id ? 'সেভ হয়েছে ✓' : 'নতুন প্রশ্ন সেভ হয়েছে ✓'; ST.edit = null; badge(); paint();
  }
  const blank = () => ({ topic: 'gk', band: 'any', difficulty: 2, question: '', options: ['', '', '', ''], answer_idx: 0, explanation: '', source: '', admin_note: '' });

  /* ---------- the actions on one question ---------- */
  async function act(a, id){
    const q = ST.rows.find(x => x.id === id); if(!q) return;
    if(a === 'edit'){ ST.edit = { id: q.id, status: q.status, data: Object.assign({}, q) }; ST.panel = null; paint(); const f = $('qfQ'); if(f) f.scrollIntoView({ block: 'center' }); return; }
    if(a === 'del'){ if(!await adminConfirm('এই প্রশ্নটা চিরতরে মুছবেন? (ফেরানো যাবে না)')) return; const r = await sbAdmin.from('quiz_questions').delete().eq('id', id); if(r.error){ alert(errText(r.error)); return; } ST.rows = ST.rows.filter(x => x.id !== id); ST.checks = ST.checks.filter(c => c.question_id !== id); badge(); paint(); return; }
    let patch = null;
    if(a === 'review'){ if(Q.clean(q.source).length < 3){ alert('আগে সূত্র লিখুন (সম্পাদনা চাপুন), নাহলে যাচাইকারী কোথায় মেলাবেন?'); return; } patch = { status: 'review' }; }
    if(a === 'adminverify'){ if(Q.clean(q.source).length < 3){ alert('সূত্র লিখুন, তারপর যাচাই করুন।'); return; } if(!await adminConfirm('আপনি নিজে যাচাই করছেন, যাচাইকারীদের ছাড়াই। প্রশ্নটা, উত্তরটা আর সূত্র আপনি মিলিয়ে দেখেছেন?')) return; patch = { status: 'verified' }; }
    if(a === 'draft') patch = { status: 'draft' };
    if(a === 'retire'){ if(!await adminConfirm('এই প্রশ্ন বাদ দেবেন? খেলায় আর আসবে না (ইতিহাস থাকবে)।')) return; patch = { status: 'retired' }; }
    if(!patch) return;
    const r = await sbAdmin.from('quiz_questions').update(patch).eq('id', id).select().single();
    if(r.error){ alert(errText(r.error)); return; }
    Object.assign(q, r.data); badge(); paint();
  }

  /* ---------- import ---------- */
  const SAMPLE = '[\n  { "topic": "gk", "band": "any", "difficulty": 1, "q": "বাংলাদেশের রাজধানীর নাম কী?",\n    "correct": "ঢাকা", "wrong": ["চট্টগ্রাম", "খুলনা", "রাজশাহী"],\n    "explanation": "...", "source": "সংবিধান, অনুচ্ছেদ ৫" }\n]';
  function importPanel(){
    const p = ST.preview;
    return '<div style="border:2px solid #7C3AED;border-radius:14px;padding:16px;margin:0 0 14px;background:#FBF9FF"><b style="font-size:15px">অনেক প্রশ্ন একসঙ্গে</b>' +
      '<div style="font-size:13.5px;color:#475569;margin:6px 0">নিচে একটা JSON তালিকা পেস্ট করুন, বা ফাইল বেছে নিন (যেমন <code>tools/quiz/seed-001.json</code>)। প্রতিটায় <code>correct</code> (সঠিক উত্তর) আর <code>wrong</code> (ঠিক তিনটা ভুল উত্তর) দিলে উত্তরগুলো নিজে নিজে এলোমেলো হয়ে বসবে। সব <b>খসড়া</b> হয়ে আসবে। আগে থেকে ভাণ্ডারে থাকা একই প্রশ্ন বাদ যাবে।</div>' +
      '<details style="margin-bottom:8px"><summary style="cursor:pointer;font-weight:700;font-size:13.5px">নমুনা দেখুন</summary><pre style="background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:8px;font-size:12.5px;overflow:auto">' + esc(SAMPLE) + '</pre></details>' +
      '<input type="file" id="qiFile" accept=".json,application/json" style="margin-bottom:8px"><textarea id="qiText" rows="7" ' + IN + ' placeholder="[ { ... }, { ... } ]">' + esc((p && p.text) || '') + '</textarea>' +
      '<div><button type="button" ' + B + ' data-qz="preview">দেখে নিন</button>' + (p && p.items.length ? '<button type="button" ' + B_BLUE + ' data-qz="doimport">' + bn(p.fresh.length) + 'টি প্রশ্ন খসড়া হিসেবে তুলুন</button>' : '') + '<button type="button" ' + B + ' data-qz="cancel">বন্ধ করুন</button></div>' +
      (p ? '<div style="margin-top:10px;font-size:14px"><b>' + bn(p.items.length) + '</b>টি ঠিক আছে' + (p.dups ? ' (এর মধ্যে ' + bn(p.dups) + 'টি ভাণ্ডারে আগেই আছে, বাদ যাবে)' : '') + (p.errors.length ? ', <b style="color:#B91C1C">' + bn(p.errors.length) + 'টায় সমস্যা</b>' : '') + '।' + p.errors.slice(0, 12).map(e => '<div style="color:#B91C1C;font-size:13px">' + esc(e) + '</div>').join('') + (p.errors.length > 12 ? '<div style="color:#B91C1C;font-size:13px">…আরও ' + bn(p.errors.length - 12) + 'টি</div>' : '') + '</div>' : '') + '</div>';
  }
  function doPreview(){
    const text = $('qiText').value, r = Q.parseImport(text), have = new Set(ST.rows.map(q => Q.clean(q.question)));
    const fresh = r.items.filter(i => !have.has(i.question));
    ST.preview = { text, items: r.items, errors: r.errors, fresh, dups: r.items.length - fresh.length }; paint();
  }
  async function doImport(){
    const p = ST.preview; if(!p || !p.fresh.length) return;
    const rows = p.fresh.map(i => Object.assign({}, i, { status: 'draft', created_by: ST.uid })); let done = 0;
    for(let i = 0; i < rows.length; i += 50){
      const r = await sbAdmin.from('quiz_questions').insert(rows.slice(i, i + 50)).select();
      if(r.error){ ST.msg = ''; alert('এখানে থেমে গেছে (' + bn(done) + 'টি তোলা হয়েছে): ' + errText(r.error)); break; }
      done += r.data.length; ST.rows = r.data.concat(ST.rows);
    }
    ST.msg = bn(done) + 'টি প্রশ্ন খসড়া হিসেবে তোলা হয়েছে ✓ এখন সূত্র দেখে "যাচাইয়ে পাঠান"।'; ST.preview = null; ST.panel = null; ST.status = 'draft'; badge(); paint();
  }

  /* ---------- the reviewers ---------- */
  function reviewersPanel(){
    return '<div style="border:2px solid #0D9488;border-radius:14px;padding:16px;margin:0 0 14px;background:#F6FFFD"><b style="font-size:15px">যাচাইকারী</b>' +
      '<div style="font-size:13.5px;color:#475569;margin:6px 0">যাচাইকারী হলেন আপনার বিশ্বস্ত শিক্ষক বা বন্ধু। তাঁদের আগে Google দিয়ে সাইট-এ সাইন-আপ করতে হবে। তারপর তাঁদের ইমেইল দিয়ে এখানে যোগ করুন। তাঁরা ড্যাশবোর্ডে নতুন মেনু <b>"প্রশ্ন যাচাই"</b> দেখবেন (<code>protishthan.com/member#qreview</code>), ফোনেও চলে। তাঁরা শুধু যাচাইয়ের অপেক্ষায় থাকা প্রশ্ন দেখেন, নিজের লেখা প্রশ্ন নয়।</div>' +
      (ST.reviewers.length ? ST.reviewers.map(r => '<div style="display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid #E2E8F0"><b>' + esc((r.m && r.m.display_name) || 'নামহীন') + '</b><span style="color:#475569">' + esc((r.m && r.m.email) || '') + '</span><span style="font-size:12.5px;color:#64748B">যাচাই করেছেন ' + bn(ST.checks.filter(c => c.reviewer_id === r.user_id).length) + 'টি</span><button type="button" ' + B_RED + ' data-qz="rmrev" data-id="' + esc(r.user_id) + '" style="margin-left:auto;padding:5px 10px;border:1px solid #FCA5A5;border-radius:8px;background:#fff;color:#B91C1C;font:inherit;font-size:13px;cursor:pointer">সরান</button></div>').join('') : '<div style="color:#64748B">এখনও কেউ নেই।</div>') +
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><input id="qrEmail" type="email" placeholder="যাচাইকারীর Gmail" ' + IN.replace('width:100%', 'flex:1;min-width:200px') + '><button type="button" ' + B_BLUE + ' data-qz="addrev">যোগ করুন</button><button type="button" ' + B + ' data-qz="cancel">বন্ধ করুন</button></div><div id="qrErr" style="display:none;color:#B91C1C;margin-top:6px"></div></div>';
  }
  async function addReviewer(){
    const email = Q.clean($('qrEmail').value).toLowerCase(), err = $('qrErr'); err.style.display = 'none';
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ err.textContent = 'একটা ঠিক ইমেইল লিখুন।'; err.style.display = 'block'; return; }
    const m = await sbAdmin.from('members').select('user_id,display_name,email').ilike('email', email).limit(1);
    if(m.error || !m.data || !m.data.length){ err.textContent = 'এই ইমেইলে কোনো সদস্য নেই। আগে তাঁকে Google দিয়ে সাইন-আপ করতে বলুন।'; err.style.display = 'block'; return; }
    if(ST.reviewers.some(r => r.user_id === m.data[0].user_id)){ err.textContent = 'ইনি আগেই যাচাইকারী।'; err.style.display = 'block'; return; }
    const r = await sbAdmin.from('quiz_reviewers').insert({ user_id: m.data[0].user_id }).select().single();
    if(r.error){ err.textContent = errText(r.error); err.style.display = 'block'; return; }
    r.data.m = m.data[0]; ST.reviewers.push(r.data); ST.msg = (m.data[0].display_name || email) + ' এখন যাচাইকারী ✓'; paint();
  }
  async function removeReviewer(uid){
    if(!await adminConfirm('এই যাচাইকারীকে সরাবেন? (আগের যাচাই থাকবে)')) return;
    const r = await sbAdmin.from('quiz_reviewers').delete().eq('user_id', uid); if(r.error){ alert(errText(r.error)); return; }
    ST.reviewers = ST.reviewers.filter(x => x.user_id !== uid); paint();
  }


  /* ---------- the daily quiz (migrations/2027-01-11_daily_quiz.sql) ---------- */
  const DBANDS = ['c1-5', 'c6-8', 'c9-10', 'c11-12'];
  /* how many verified questions each band can use: its own, and the "any" ones that are not too hard for it (the rule of quiz_pick) */
  const bandCount = b => ST.rows.filter(q => q.status === 'verified' && (q.band === b || (q.band === 'any' && q.difficulty <= (b === 'c1-5' ? 1 : b === 'c6-8' ? 2 : 3)))).length;
  const bdToday = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
  const qText = id => { const q = ST.rows.find(x => x.id === id); return q ? q.question : '(মুছে ফেলা প্রশ্ন)'; };
  async function loadDaily(){
    const d = bdToday();
    const [a, b, c] = await Promise.all([
      sbAdmin.from('quiz_daily').select('*').gte('day', d).order('day', { ascending: true }).order('band', { ascending: true }).limit(124),
      sbAdmin.from('quiz_plays').select('player', { count: 'exact', head: true }).eq('day', d).eq('idx', 0),
      sbAdmin.from('quiz_plays').select('player', { count: 'exact', head: true }).eq('day', d).eq('idx', 0).not('user_id', 'is', null)]);
    ST.daily = { err: a.error ? a.error.message : '', rows: (a.data || []), today: d, players: (b && b.count) || 0, members: (c && c.count) || 0 };
    paint();
  }
  function dailyPanel(){
    const D = ST.daily, verified = count('verified');
    if(!D) return '<div class="bill-note">লোড হচ্ছে…</div>';
    return '<div style="border:2px solid #F59E0B;border-radius:14px;padding:16px;margin:0 0 14px;background:#FFFBEB"><b style="font-size:15px">আজকের কুইজ (প্রতিদিন ৫টা, বাংলাদেশের সময়)</b>' +
      '<div style="font-size:13.5px;color:#475569;margin:6px 0">যাচাই হওয়া প্রশ্ন থেকেই বাছা হয়: আগে প্রতিটা বিষয় থেকে একটা, যেটা সবচেয়ে আগে ব্যবহার হয়েছিল (বা কখনো হয়নি) সেটা আগে। কোনো দিনের সেট না থাকলে প্রথম খেলোয়াড় এলে নিজে নিজে তৈরি হয়। আগে থেকে তৈরি করে দেখে নিতে পারেন।</div>' +
      '<div style="margin:8px 0;font-size:14px">যাচাই হওয়া প্রশ্ন: <b>' + bn(verified) + 'টি</b>' + (verified < 5 ? ' <b style="color:#B91C1C">(আজকের কুইজ চালু করতে অন্তত ৫টা লাগবে, আলাদা আলাদা বিষয়ে হলে ভালো)</b>' : ' · প্রায় <b>' + bn(Math.floor(verified / 5)) + ' দিনের</b> নতুন প্রশ্ন আছে (এরপর আগেরগুলো আবার আসবে)') + '</div>' +
      '<div style="margin:8px 0;font-size:14px">প্রতিটা ধাপের নিজের প্রশ্ন লাগে: ' + DBANDS.map(b => '<b>' + Q.labelOf(Q.BANDS, b) + '</b> ' + bn(bandCount(b)) + 'টি (প্রায় ' + bn(Math.floor(bandCount(b) / 5)) + ' দিন)').join(' · ') + '</div>' +
      '<div style="margin:8px 0;font-size:14px">আজ এখন পর্যন্ত শুরু করেছেন <b>' + bn(D.players) + '</b> জন, এর মধ্যে সাইন-ইন করা সদস্য <b>' + bn(D.members) + '</b> জন (শুধু এঁরাই বোর্ডে আসেন)।</div>' +
      (D.err ? '<div style="color:#B91C1C;margin:6px 0">লোড করা যায়নি: ' + esc(D.err) + ' — migrations/2027-01-11_daily_quiz.sql চালানো হয়েছে কি?</div>' : '') +
      '<button type="button" ' + B_BLUE + ' data-qz="plan">আগামী ৭ দিনের কুইজ তৈরি করুন</button><button type="button" ' + B + ' data-qz="cancel">বন্ধ করুন</button>' +
      (D.rows.length ? D.rows.map(r => '<div style="margin-top:10px;padding:10px 12px;background:#fff;border:1px solid #E2E8F0;border-radius:10px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>' + new Date(r.day + 'T00:00:00').toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long' }) + (r.day === D.today ? ' (আজ)' : '') + '</b>' + chip(['#EEF2FF', '#4338CA'], Q.labelOf(Q.BANDS, r.band || 'c6-8')) + chip(r.source === 'admin' ? ['#F5F3FF', '#5B21B6'] : ['#F1F5F9', '#475569'], r.source === 'admin' ? 'আপনি বেছেছেন' : 'নিজে তৈরি') +
        (r.day > D.today ? '<button type="button" ' + B + ' data-qz="reroll" data-day="' + esc(r.day) + '" data-band="' + esc(r.band || 'c6-8') + '" style="margin:0 0 0 auto;padding:4px 10px;border:1px solid #CBD5E1;border-radius:8px;background:#fff;font:inherit;font-size:13px;font-weight:700;cursor:pointer">নতুন করে বাছুন</button>' : '') + '</div><ol style="margin:6px 0 0;padding-left:22px;font-size:13.5px;color:#334155;line-height:1.7">' + r.qids.map(id => '<li>' + esc(qText(id)) + '</li>').join('') + '</ol></div>').join('') : '<div style="margin-top:10px;color:#64748B">এখনও কোনো দিনের সেট তৈরি হয়নি।</div>') + '</div>';
  }
  /* ---------- the league watch: batches with points (are they real?), and the ones excluded from the league (migrations/2027-01-17_league_guard.sql) ---------- */
  const bname = b => b ? (b.name || 'ব্যাচ') + ' · ' + bn(b.year || '') + ' ব্যাচ' : '';
  async function loadLeague(){
    const r = await sbAdmin.rpc('league_admin', { p_limit: 40 });
    ST.league = r.error ? { err: r.error.message || 'error' } : (r.data || { excluded: [], top: [] });
    paint();
  }
  function leaguePanel(){
    const L = ST.league; if(!L) return '<div class="bill-note">লোড হচ্ছে…</div>';
    if(L.err) return '<div style="border:2px solid #F59E0B;border-radius:14px;padding:16px;margin:0 0 14px;background:#FFFBEB"><b>লিগ নজরদারি</b><div style="color:#B91C1C;margin:6px 0">লোড করা যায়নি: ' + esc(L.err) + ' — migrations/2027-01-17_league_guard.sql চালানো হয়েছে কি?</div><button type="button" ' + B + ' data-qz="cancel">বন্ধ করুন</button></div>';
    const th = 'style="text-align:left;padding:6px 8px;font-size:12.5px;color:#475569;border-bottom:1px solid #E2E8F0"', td = 'style="padding:6px 8px;border-bottom:1px solid #F1F5F9;font-size:13.5px"';
    const rows = (L.top || []).map(t => {
      const sus = !t.excluded && (t.new24 >= 5 && t.new24 >= t.members * 0.6);       // most of the members joined in the last day: look at it
      return '<tr' + (t.excluded ? ' style="opacity:.6"' : '') + '><td ' + td + '><b>' + esc(bname(t.batch)) + '</b>' + (t.excluded ? ' ' + chip(['#FEE2E2', '#B91C1C'], 'বাদ') : '') + (sus ? ' ' + chip(['#FEF3C7', '#92400E'], 'নতুন সদস্য বেশি') : '') + '</td><td ' + td + '>' + bn(t.members) + '</td><td ' + td + '>' + bn(t.new24) + '</td><td ' + td + '>' + bn(t.week) + '</td><td ' + td + '>' + bn(t.all) + '</td><td ' + td + '>' + bn(t.matches) + '</td><td ' + td + '>' +
        (t.excluded ? '<button type="button" ' + B + ' data-qz="lgi" data-id="' + esc(t.batch.id) + '" data-name="' + esc(bname(t.batch)) + '">ফিরিয়ে আনুন</button>' : '<button type="button" ' + B + ' data-qz="lgx" data-id="' + esc(t.batch.id) + '" data-name="' + esc(bname(t.batch)) + '" style="padding:5px 10px;margin:0;border:1px solid #FCA5A5;border-radius:8px;background:#fff;color:#B91C1C;font:inherit;font-size:13px;font-weight:700;cursor:pointer">লিগ থেকে বাদ দিন</button>') + '</td></tr>';
    }).join('');
    const ex = (L.excluded || []).filter(e => !(L.top || []).some(t => t.batch && e.batch && t.batch.id === e.batch.id));
    return '<div style="border:2px solid #F59E0B;border-radius:14px;padding:16px;margin:0 0 14px;background:#FFFBEB"><b style="font-size:15px">লিগ নজরদারি</b>' +
      '<div style="font-size:13.5px;color:#475569;margin:6px 0">যে ব্যাচ পয়েন্ট পেয়েছে, তারা এখানে আছে। "নতুন সদস্য" মানে গত ২৪ ঘণ্টায় যোগ দেওয়া সদস্য। প্রায় সবাই একদিনে যোগ দিলে (হলুদ চিহ্ন) ব্যাচটা ভালো করে দেখুন। বাদ দিলে ব্যাচের চ্যালেঞ্জ, রশি টানাটানি আর ডুয়েলের পয়েন্ট লিগে গোনা হয় না, ওদের বিপক্ষের খেলার পয়েন্টও না, আর কুইজের বোর্ডেও ওদের খেলোয়াড় ধরা হয় না। যা ঘটেছে তা ডেটায় থেকে যায়, ফিরিয়ে আনলে সব আগের মতো হয়ে যায়।</div>' +
      ((L.top || []).length ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #E2E8F0;border-radius:10px"><thead><tr><th ' + th + '>ব্যাচ</th><th ' + th + '>সদস্য</th><th ' + th + '>নতুন সদস্য (২৪ ঘণ্টা)</th><th ' + th + '>এই সপ্তাহে</th><th ' + th + '>মোট পয়েন্ট</th><th ' + th + '>খেলা</th><th ' + th + '></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div style="margin:8px 0;font-size:14px">এখনও কোনো ব্যাচ লিগে পয়েন্ট পায়নি।</div>') +
      (ex.length ? '<div style="margin-top:10px;font-size:13.5px"><b>বাদ দেওয়া ব্যাচ (এখন পয়েন্ট নেই):</b> ' + ex.map(e => esc(bname(e.batch)) + (e.reason ? ' (' + esc(e.reason) + ')' : '') + ' <button type="button" ' + B + ' data-qz="lgi" data-id="' + esc(e.batch.id) + '" data-name="' + esc(bname(e.batch)) + '">ফিরিয়ে আনুন</button>').join(' · ') + '</div>' : '') +
      '<button type="button" ' + B + ' data-qz="cancel">বন্ধ করুন</button></div>';
  }
  async function leagueExclude(id, name){
    const why = prompt('"' + name + '" ব্যাচকে লিগ থেকে বাদ দিচ্ছেন। কারণ লিখুন (নিজের জন্য, ঐচ্ছিক):', '');
    if(why === null) return;
    const r = await sbAdmin.rpc('league_exclude', { p_batch: id, p_reason: why });
    if(r.error){ alert(errText(r.error)); return; }
    ST.msg = (r.data && r.data.ok) ? name + ' লিগ থেকে বাদ গেছে ✓' : 'বাদ দেওয়া গেল না।'; await loadLeague();
  }
  async function leagueInclude(id, name){
    if(!await adminConfirm('"' + name + '" ব্যাচকে লিগে ফিরিয়ে আনবেন? ওদের আগের পয়েন্ট আবার গোনা হবে।')) return;
    const r = await sbAdmin.rpc('league_include', { p_batch: id });
    if(r.error){ alert(errText(r.error)); return; }
    ST.msg = name + ' লিগে ফিরেছে ✓'; await loadLeague();
  }
  async function planDays(){
    const rs = await Promise.all(DBANDS.map(b => sbAdmin.rpc('quiz_plan', { p_days: 7, p_band: b })));
    const bad = rs.find(r => r.error); if(bad){ alert(errText(bad.error)); return; }
    ST.msg = DBANDS.map((b, i) => Q.labelOf(Q.BANDS, b) + ': ' + (Array.isArray(rs[i].data) && rs[i].data.length ? bn(rs[i].data.length) + ' দিন ✓' : 'প্রশ্ন কম (অন্তত ৫টা লাগবে)')).join(' · '); await loadDaily();
  }
  async function rerollDay(day, band){
    if(!await adminConfirm('এই দিনের ৫টা প্রশ্ন বদলে নতুন করে বাছবেন?')) return;
    const r = await sbAdmin.rpc('quiz_reroll', { p_day: day, p_band: band || 'c6-8' });
    if(r.error){ alert(errText(r.error)); return; }
    const d = r.data || {}; ST.msg = d.ok ? 'নতুন করে বাছা হয়েছে ✓' : d.error === 'ALREADY_PLAYED' ? 'এই দিনে কেউ খেলে ফেলেছে, বদলানো যাবে না।' : d.error === 'PAST' ? 'আগের দিন বদলানো যায় না।' : 'যথেষ্ট যাচাই হওয়া প্রশ্ন নেই।'; await loadDaily();
  }

  /* ---------- events ---------- */
  function onClick(e){
    const b = e.target.closest('[data-qz]'); if(!b) return; const k = b.dataset.qz;
    if(k === 'status'){ ST.status = b.dataset.v; ST.msg = ''; paint(); }
    else if(k === 'new'){ ST.edit = { id: null, status: 'draft', data: blank() }; ST.panel = null; paint(); const f = $('qfQ'); if(f) f.focus(); }
    else if(k === 'panel'){ ST.panel = ST.panel === b.dataset.v ? null : b.dataset.v; ST.edit = null; ST.msg = ''; paint(); if(ST.panel === 'daily') loadDaily(); if(ST.panel === 'league') loadLeague(); }
    else if(k === 'plan') planDays();
    else if(k === 'lgx') leagueExclude(b.dataset.id, b.dataset.name);
    else if(k === 'lgi') leagueInclude(b.dataset.id, b.dataset.name);
    else if(k === 'reroll') rerollDay(b.dataset.day, b.dataset.band);
    else if(k === 'cancel'){ ST.edit = null; ST.panel = null; ST.preview = null; paint(); }
    else if(k === 'save') save(b.dataset.v);
    else if(k === 'act') act(b.dataset.a, b.dataset.id);
    else if(k === 'preview') doPreview();
    else if(k === 'doimport') doImport();
    else if(k === 'addrev') addReviewer();
    else if(k === 'rmrev') removeReviewer(b.dataset.id);
  }
  function onChange(e){
    if(e.target.id === 'qzTopic'){ ST.topic = e.target.value; const l = $('qzList'); if(l) l.innerHTML = list(); }
    if(e.target.id === 'qiFile' && e.target.files && e.target.files[0]){ const rd = new FileReader(); rd.onload = () => { $('qiText').value = String(rd.result || ''); doPreview(); }; rd.readAsText(e.target.files[0], 'utf-8'); }
  }
  let tT = 0;
  function onInput(e){ if(e.target.id === 'qzText'){ clearTimeout(tT); const v = e.target.value; tT = setTimeout(() => { ST.text = v; const l = $('qzList'); if(l) l.innerHTML = list(); }, 200); } }

  function start(){
    const root = $('quizRoot'); if(!root) return;
    root.addEventListener('click', onClick); root.addEventListener('change', onChange); root.addEventListener('input', onInput);
    if(typeof navTitles !== 'undefined') navTitles.quiz = ['প্রতিষ্ঠান লিগ: প্রশ্নের ভাণ্ডার', 'কুইজ আর ব্যাচ চ্যালেঞ্জের প্রশ্ন লেখা, যাচাই আর প্রকাশ'];
    paint(); if(typeof ADMIN_READY !== 'undefined') ADMIN_READY.then(load);
  }
  window.AdminQuiz = { load, paint, state: ST };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
