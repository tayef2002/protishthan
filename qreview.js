/* প্রশ্ন যাচাই: the page of a REVIEWER (a trusted member the admin added) in the member dashboard (member.html, #qreview).
   It shows the questions that wait for a check, one at a time, WITH the answer marked, and the reviewer says "সঠিক", "ভুল" (with a note) or "নিশ্চিত নই".
   A question is verified when two different reviewers say it is right; a "ভুল" sends it back to the admin. A reviewer never sees their own questions and never sees what others said.
   Data: migrations/2027-01-10_quiz_bank.sql (quiz_review_me, quiz_review_queue, quiz_review_submit). Needs member.js and quiz-data.js. */
(function(){
  'use strict';
  if(window.QReview) return;
  const MB = () => (window.Protishthan && window.Protishthan.member) || null;
  const Q = () => window.QuizData;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bn = x => String(x).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const track = (n, p) => { try{ window.track && window.track(n, p || {}); }catch(e){} };
  const ST = { me: null, queue: [], loaded: false, error: false, wrong: false, busy: false, flash: '' };
  let box = null;

  async function load(){
    const M = MB(); if(!M || !M.current()) return;
    const me = await M.sb.rpc('quiz_review_me');
    ST.me = (!me.error && me.data) ? me.data : null; ST.error = !!me.error;
    const on = !!(ST.me && ST.me.reviewer);
    document.querySelectorAll('.sn-qr').forEach(a => { a.style.display = on ? '' : 'none'; });
    if(on){
      const q = await M.sb.rpc('quiz_review_queue', { p_limit: 5 });
      if(!q.error && Array.isArray(q.data)) ST.queue = q.data; else ST.error = true;
    } else ST.queue = [];
    ST.loaded = true; badge(); paint();
  }
  function badge(){ const n = ST.me && ST.me.reviewer ? Number(ST.me.waiting) || 0 : 0; document.querySelectorAll('.cnt-qr').forEach(x => { x.textContent = bn(n); x.style.display = n ? '' : 'none'; }); }

  function paint(){
    if(!box) return;
    if(!ST.loaded){ box.innerHTML = '<div class="qr-skel"><i></i><i></i></div>'; return; }
    if(!ST.me || !ST.me.reviewer){
      box.innerHTML = '<div class="card qr-empty"><h3>আপনি এখনও যাচাইকারী নন</h3><p>প্রশ্ন যাচাই করার সুযোগ শুধু যাঁদের আমরা বিশেষভাবে যোগ করেছি। আপনি যাচাইকারী হতে চাইলে আমাদের জানান।</p></div>' + (ST.error ? '<p class="qr-bad">এখন পড়া যায়নি, একটু পরে আবার চেষ্টা করুন।</p>' : '');
      return;
    }
    const q = ST.queue[0], T = Q();
    box.innerHTML =
      '<div class="card qr-top"><div><h3>প্রশ্ন যাচাই</h3><p>প্রতিটা প্রশ্নের উত্তর আর সূত্র মিলিয়ে দেখুন। আপনি এ পর্যন্ত <b>' + bn(ST.me.done || 0) + '</b>টি যাচাই করেছেন, অপেক্ষায় আছে <b>' + bn(ST.me.waiting || 0) + '</b>টি।</p></div></div>' +
      (ST.flash ? '<div class="qr-flash">' + esc(ST.flash) + '</div>' : '') +
      (q ? card(q, T) : '<div class="card qr-empty"><h3>সব যাচাই শেষ, ধন্যবাদ! 🙏</h3><p>আপনার জন্য আর কোনো প্রশ্ন অপেক্ষায় নেই। নতুন প্রশ্ন এলে এখানে দেখবেন।</p></div>') +
      (ST.error ? '<p class="qr-bad">কিছু পড়া যায়নি, একটু পরে আবার চেষ্টা করুন।</p>' : '') +
      '<p class="qr-priv">আপনি শুধু যাচাইয়ের অপেক্ষায় থাকা প্রশ্ন দেখেন। অন্য যাচাইকারী কী বলেছেন, সেটা আপনি দেখেন না, আপনার মতও তাঁরা দেখেন না।</p>';
    const ta = $('qrNote'); if(ta && ST.wrong) ta.focus();
  }
  function card(q, T){
    return '<div class="card qr-card"><div class="qr-meta"><span>' + esc(T.labelOf(T.TOPICS, q.topic)) + '</span><span>' + esc(T.labelOf(T.BANDS, q.band)) + '</span><span>' + esc(T.labelOf(T.DIFFS, q.difficulty)) + '</span></div>' +
      '<h4>' + esc(q.question) + '</h4><ol class="qr-opts">' + (q.options || []).map((o, i) => '<li class="' + (i === q.answer_idx ? 'right' : '') + '"><span>' + esc(o) + '</span>' + (i === q.answer_idx ? '<em>✓ সঠিক উত্তর (লেখকের মতে)</em>' : '') + '</li>').join('') + '</ol>' +
      (q.explanation ? '<p class="qr-x"><b>ব্যাখ্যা:</b> ' + esc(q.explanation) + '</p>' : '') +
      '<p class="qr-x"><b>সূত্র:</b> ' + esc(q.source || '—') + '</p>' +
      '<div class="qr-ask">প্রশ্ন, উত্তর আর ব্যাখ্যা কি ঠিক?</div>' +
      (ST.wrong
        ? '<label class="qr-l" for="qrNote">কী ভুল? লিখুন (কমপক্ষে ৫ অক্ষর)</label><textarea id="qrNote" rows="3" maxlength="300" placeholder="যেমন: সঠিক উত্তর ঢাকা নয়, বইয়ে লেখা আছে…"></textarea><div class="qr-err" id="qrErr" hidden></div>' +
          '<div class="qr-act"><button type="button" class="qr-btn bad" data-qr="send-wrong" data-id="' + esc(q.id) + '">ভুল হিসেবে পাঠান</button><button type="button" class="qr-btn" data-qr="back">ফিরে যান</button></div>'
        : '<div class="qr-act"><button type="button" class="qr-btn ok" data-qr="ok" data-id="' + esc(q.id) + '">✓ সঠিক</button><button type="button" class="qr-btn bad" data-qr="wrong">✗ ভুল আছে</button><button type="button" class="qr-btn" data-qr="unsure" data-id="' + esc(q.id) + '">নিশ্চিত নই</button></div><div class="qr-err" id="qrErr" hidden></div>') + '</div>';
  }

  async function submit(id, verdict, note){
    if(ST.busy) return; ST.busy = true;
    const M = MB(), err = $('qrErr'); if(err) err.hidden = true;
    try{
      const r = await M.sb.rpc('quiz_review_submit', { p_id: id, p_verdict: verdict, p_note: note || '' });
      const d = r.data;
      if(r.error || !d || d.ok !== true){
        const m = !d ? 'এখন হলো না, একটু পরে আবার চেষ্টা করুন।' : d.error === 'NEED_NOTE' ? 'কী ভুল, কমপক্ষে ৫ অক্ষরে লিখুন।' : d.error === 'NOT_FOUND' ? 'এই প্রশ্নটা আর যাচাইয়ের অপেক্ষায় নেই।' : d.error === 'NOT_REVIEWER' ? 'আপনি যাচাইকারী নন।' : 'এখন হলো না, একটু পরে আবার চেষ্টা করুন।';
        if(err){ err.textContent = m; err.hidden = false; } if(d && d.error === 'NOT_FOUND'){ ST.wrong = false; await load(); }
        return;
      }
      track('qr_submit', { v: verdict });
      ST.flash = verdict === 'ok' ? 'সঠিক হিসেবে জমা হয়েছে ✓' : verdict === 'wrong' ? 'ভুল হিসেবে জানানো হয়েছে, ধন্যবাদ।' : 'নিশ্চিত নই হিসেবে জমা হয়েছে।';
      ST.wrong = false; ST.queue.shift(); if(ST.me){ ST.me.done = (Number(ST.me.done) || 0) + 1; ST.me.waiting = Math.max(0, (Number(ST.me.waiting) || 0) - 1); }
      badge(); paint();
      if(!ST.queue.length) load();                      // the next five
    }catch(e){ if(err){ err.textContent = 'এখন হলো না, একটু পরে আবার চেষ্টা করুন।'; err.hidden = false; } }
    finally{ ST.busy = false; }
  }
  function onClick(e){
    const b = e.target.closest('[data-qr]'); if(!b || !box.contains(b)) return; const k = b.dataset.qr;
    if(k === 'ok' || k === 'unsure') submit(b.dataset.id, k, '');
    else if(k === 'wrong'){ ST.wrong = true; paint(); }
    else if(k === 'back'){ ST.wrong = false; paint(); }
    else if(k === 'send-wrong'){ const v = ($('qrNote') || {}).value || ''; if(v.trim().length < 5){ const err = $('qrErr'); if(err){ err.textContent = 'কী ভুল, কমপক্ষে ৫ অক্ষরে লিখুন।'; err.hidden = false; } return; } submit(b.dataset.id, 'wrong', v); }
  }
  function start(){
    box = $('qrBox'); if(!box) return;
    box.addEventListener('click', onClick);
    const M = MB(); if(!M) return;
    paint(); M.ready().then(() => { if(M.current()) load(); });
    M.onChange(me => { if(me){ ST.loaded = false; paint(); load(); } });
  }
  window.QReview = { load };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
