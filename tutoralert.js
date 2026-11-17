/* Tutor Alert: the dashboard page of a tutor (member.html, #tutoralert).
   When a guardian asks for THIS tutor, or the team sends a request to this tutor, an alert comes here with the details of the request
   (class, subjects, how, where, the guardian's wishes, the note). The tutor answers "আমি আগ্রহী" or "পারব না".
   The guardian's NAME AND NUMBER are never sent to this page (privacy.html section 8): after "interested" the team arranges the contact when the guardian agrees.
   Data: migrations/2027-01-08_tutor_alerts.sql (tutor_alerts_me, tutor_alert_unread, tutor_alert_seen, tutor_alert_reply). Needs member.js and tutor-data.js. */
(function(){
  'use strict';
  if(window.TutorAlert) return;
  const MB = () => (window.Protishthan && window.Protishthan.member) || null;
  const TD = () => window.TutorData || null;
  const $ = id => document.getElementById(id);
  const bn = x => String(x).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const track = (n, p) => { try{ window.track && window.track(n, p || {}); }catch(e){} };
  const FLAG = 'prot_is_tutor';                    // the bell on every page asks for new alerts only when this is set (no call for people who are not tutors)
  const ST = { profile: null, alerts: [], loaded: false, error: false, unread: 0 };
  let box = null, seenT = 0, busy = false;

  const ago = iso => { const t = Date.parse(iso); if(!t) return ''; const m = Math.max(0, Math.round((Date.now() - t) / 60000)); if(m < 2) return 'এইমাত্র'; if(m < 60) return bn(m) + ' মিনিট আগে'; const h = Math.round(m / 60); if(h < 24) return bn(h) + ' ঘণ্টা আগে'; const d = Math.round(h / 24); return d < 30 ? bn(d) + ' দিন আগে' : bn(Math.round(d / 30)) + ' মাস আগে'; };
  const PATHS = {
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
  };
  const ico = n => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[n] || '') + '</svg>';

  /* ---------- loading ---------- */
  async function load(){
    const M = MB(); if(!M || !M.current()) return;
    const p = await M.sb.rpc('tutor_my_profile');
    ST.profile = (!p.error && p.data && p.data.pid) ? p.data : null;
    const has = !!(ST.profile && ST.profile.status !== 'draft');
    try{ if(has) localStorage.setItem(FLAG, '1'); else if(!p.error) localStorage.removeItem(FLAG); }catch(e){}
    document.querySelectorAll('.sn-ta').forEach(a => { a.style.display = has ? '' : 'none'; });
    if(has){
      const a = await M.sb.rpc('tutor_alerts_me');
      ST.error = !!a.error;
      if(!a.error && Array.isArray(a.data)){ const was = new Set(ST.alerts.filter(x => x.fresh).map(x => x.id)); a.data.forEach(x => { x.fresh = x.status === 'sent' && (!x.seen || was.has(x.id)); }); ST.alerts = a.data; }
    } else { ST.alerts = []; ST.error = !!p.error; }
    ST.loaded = true;
    badge(); paint(); scheduleSeen();
  }
  const unseen = () => ST.alerts.filter(x => !x.seen && x.status === 'sent');
  function badge(){
    ST.unread = unseen().length;
    document.querySelectorAll('.cnt-ta').forEach(x => { x.textContent = bn(ST.unread); x.style.display = ST.unread ? '' : 'none'; });
  }
  // the alerts on the screen for a moment count as seen (the "নতুন" mark goes away the next time the page is opened)
  function scheduleSeen(){
    clearTimeout(seenT);
    if(!unseen().length || !isOn()) return;
    seenT = setTimeout(async () => {
      const ids = unseen().map(x => x.id), M = MB(); if(!ids.length || !M || !isOn()) return;
      const r = await M.sb.rpc('tutor_alert_seen', { p_ids: ids });
      if(!r.error && r.data && r.data.ok){ ST.alerts.forEach(x => { if(ids.includes(x.id)) x.seen = true; }); badge(); track('ta_seen', { n: ids.length }); }
    }, 2500);
  }
  const isOn = () => { const s = $('tutoralert'); return !!(s && s.classList.contains('on')); };

  /* ---------- the picture ---------- */
  const STATUS_NOTE = {
    approved: ['ok', 'আপনার প্রোফাইল চালু আছে', 'কোনো অভিভাবক আপনাকে বেছে নিলে, বা আমাদের টিম আপনার কাছে অনুরোধ পাঠালে এখানে সঙ্গে সঙ্গে দেখবেন।'],
    submitted: ['wait', 'প্রোফাইল রিভিউয়ের অপেক্ষায়', 'অনুমোদন হলে অভিভাবকের অনুরোধ এখানে আসতে শুরু করবে।'],
    paused: ['pause', 'প্রোফাইল এখন বিরতিতে', 'বিরতি থাকলে নতুন অ্যালার্ট আসবে না। আগেরগুলো এখানে থাকবে।'],
    rejected: ['bad', 'প্রোফাইল অনুমোদন হয়নি', 'প্রোফাইল ঠিক করে আবার পাঠালে আমরা দেখব।']
  };
  function paint(){
    if(!box) return;
    if(!ST.loaded){ box.innerHTML = '<div class="ta-skel"><i></i><i></i></div>'; return; }
    if(!ST.profile || ST.profile.status === 'draft'){
      box.innerHTML = '<div class="card ta-empty"><span class="ta-big">' + ico('bell') + '</span><h3>আপনার টিউটর প্রোফাইল এখনও নেই</h3><p>প্রোফাইল বানিয়ে পাঠালে, কেউ আপনাকে টিউটর হিসেবে চাইলে সেই অনুরোধ এখানে আসবে।</p><a class="btn btn-blue btn-sm" href="tutor-join.html">টিউটর প্রোফাইল বানান</a></div>';
      return;
    }
    const s = STATUS_NOTE[ST.profile.status] || STATUS_NOTE.submitted, TDd = TD();
    const n = ST.alerts.length, newN = ST.alerts.filter(x => x.status === 'sent').length, okN = ST.alerts.filter(x => x.status === 'accepted').length, stN = ST.alerts.filter(x => x.status === 'started').length;
    box.innerHTML =
      '<div class="card ta-top ' + s[0] + '"><span class="ta-big">' + ico('bell') + '</span><div><h3>' + s[1] + '</h3><p>' + s[2] + '</p></div><a class="btn btn-line btn-sm" href="tutor-join.html">প্রোফাইল দেখুন</a></div>' +
      '<div class="ta-nums"><div><b>' + bn(newN) + '</b><span>উত্তরের অপেক্ষায়</span></div><div><b>' + bn(okN) + '</b><span>আগ্রহ জানিয়েছেন</span></div><div><b>' + bn(stN) + '</b><span>পড়ানো শুরু</span></div></div>' +
      (n ? '<ul class="ta-list">' + ST.alerts.map(card).join('') + '</ul>' :
        '<div class="card ta-empty"><span class="ta-big">' + ico('bell') + '</span><h3>এখনও কোনো অ্যালার্ট আসেনি</h3><p>কেউ আপনাকে টিউটর হিসেবে চাইলে এখানে দেখবেন, বিস্তারিতসহ। প্রোফাইল ভালো করে সাজানো থাকলে অভিভাবকরা বেশি বেছে নেন।</p></div>') +
      (ST.error ? '<p class="ta-bad">অ্যালার্ট এখন পড়া যায়নি, একটু পরে আবার চেষ্টা করুন।</p>' : '') +
      '<p class="ta-priv">' + ico('lock') + ' অভিভাবকের নাম বা নম্বর আপনাকে দেখানো হয় না। আগ্রহ জানালে, অভিভাবক রাজি হলে আমরা যোগাযোগের ব্যবস্থা করে দেব।</p>';
  }
  function card(a){
    const T = TD(); if(!T) return '';
    const subs = T.labels(T.SUBJECTS, a.subjects), cls = T.labelOf(T.CLASSES, a.class_band);
    const online = a.mode === 'online', home = a.mode === 'home';
    const where = online ? 'অনলাইনে' : [a.upazila, a.district].filter(Boolean).join(', ') + (home ? ' (বাসায়)' : (a.mode === 'any' ? ' (বাসায় বা অনলাইনে)' : ''));
    const isNew = a.status === 'sent' && a.fresh;
    const wishes = T.prefLine(a);
    let act = '';
    if(a.status === 'sent') act = '<button type="button" class="btn btn-blue btn-sm" data-a="accepted" data-id="' + esc(a.id) + '">আমি আগ্রহী</button><button type="button" class="btn btn-line btn-sm" data-a="declined" data-id="' + esc(a.id) + '">পারব না</button>';
    else if(a.status === 'accepted') act = '<span class="ta-ok">' + ico('check') + ' আপনি আগ্রহ জানিয়েছেন। অভিভাবক রাজি হলে আমরা জানাব।</span><button type="button" class="ta-link" data-a="declined" data-id="' + esc(a.id) + '">পারব না বলুন</button>';
    else if(a.status === 'declined') act = '<span class="ta-mut">আপনি "পারব না" বলেছেন।</span><button type="button" class="ta-link" data-a="accepted" data-id="' + esc(a.id) + '">আবার আগ্রহী</button>';
    else if(a.status === 'started') act = '<span class="ta-ok">' + ico('check') + ' পড়ানো শুরু হয়েছে। শুভকামনা!</span>';
    return '<li class="card ta-card ' + a.status + (isNew ? ' new' : '') + '"><div class="ta-hd">' + (isNew ? '<em class="ta-new">নতুন</em>' : '') +
      '<span class="ta-src">' + (a.source === 'guardian' ? 'একজন অভিভাবক আপনাকে বেছে নিয়েছেন' : 'আমাদের টিম আপনার কাছে অনুরোধ পাঠিয়েছে') + '</span><span class="ta-ago">' + esc(ago(a.created_at)) + '</span></div>' +
      '<h4>' + esc(cls) + '</h4><div class="ta-subs">' + subs.map(x => '<span>' + esc(x) + '</span>').join('') + '</div>' +
      '<div class="ta-meta"><span>' + (online ? ico('globe') : home ? ico('home') : ico('pin')) + esc(where) + '</span></div>' +
      (wishes ? '<p class="ta-w">' + esc(wishes) + '</p>' : '') +
      (a.note ? '<blockquote class="ta-note">' + esc(a.note) + '</blockquote>' : '') +
      '<div class="ta-act">' + act + '</div><div class="ta-err" id="taE-' + esc(a.id) + '" hidden></div></li>';
  }

  /* ---------- the answer ---------- */
  async function reply(id, v, btn){
    if(busy) return; busy = true; if(btn) btn.disabled = true;
    const M = MB(), err = $('taE-' + id);
    try{
      const r = await M.sb.rpc('tutor_alert_reply', { p_id: id, p_reply: v });
      const d = r.data;
      if(r.error || !d || d.ok !== true){
        const m = !d ? 'এখন হলো না, একটু পরে আবার চেষ্টা করুন।' : d.error === 'ALREADY_STARTED' ? 'পড়ানো শুরু হয়ে গেছে, এখন বদলানো যাবে না।' : d.error === 'NOT_FOUND' ? 'এই অনুরোধটা আর নেই।' : 'এখন হলো না, একটু পরে আবার চেষ্টা করুন।';
        if(err){ err.textContent = m; err.hidden = false; } return;
      }
      track('ta_reply', { v });
      const a = ST.alerts.find(x => x.id === id); if(a){ a.status = d.status; a.seen = true; a.replied_at = new Date().toISOString(); }
      badge(); paint();
      const m = MB(); if(m && m.toast) m.toast(v === 'accepted' ? 'আপনার আগ্রহ জানানো হয়েছে ✓' : 'জানিয়ে দেওয়া হয়েছে');
    }catch(e){ if(err){ err.textContent = 'এখন হলো না, একটু পরে আবার চেষ্টা করুন।'; err.hidden = false; } }
    finally{ busy = false; if(btn) btn.disabled = false; }
  }

  /* ---------- start ---------- */
  function start(){
    box = $('taBox'); if(!box) return;
    box.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if(b && box.contains(b)) reply(b.dataset.id, b.dataset.a, b); });
    const M = MB(); if(!M) return;
    paint();
    M.ready().then(() => { if(M.current()) load(); });
    M.onChange(me => { if(me){ ST.loaded = false; paint(); load(); } });
    window.addEventListener('hashchange', () => { if(isOn()){ if(ST.loaded) scheduleSeen(); load(); } });
    // while the page is open and visible the list is asked again now and then (slow: the database is small)
    setInterval(() => { if(isOn() && !document.hidden && ST.loaded && !busy) load(); }, 90000);
  }
  window.TutorAlert = { load };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
