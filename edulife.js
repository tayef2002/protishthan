/* আমার শিক্ষাজীবন: the member's education life on the dashboard (member.html, #life).
   - one list, PSC to masters: institution (picked from the directory, or typed), year, "still studying"
   - the SAME data as the শিক্ষিত কার্ড: member_cards.data.edu (a card made before the sign-up is adopted by member.js, so it is already here)
     so a change here is on the card, and a change on the card is here
   - "বর্তমান প্রতিষ্ঠান" (member_institution) and the SSC batch (batch_me) are shown above the list, with one tap to set or join from what the list says
   Needs member.js (Protishthan.member) and, for the two top blocks, myinst.js (window.MyInst). Everything is optional; nothing here is shown to anybody else. */
(function(){
  'use strict';
  if(window.EduLife) return;
  const MB = () => (window.Protishthan && window.Protishthan.member) || null;
  const $ = id => document.getElementById(id);
  const bn = x => String(x).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const asc = x => String(x == null ? '' : x).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NOW = new Date().getFullYear();
  const track = (n, p) => { try{ window.track && window.track(n, p || {}); }catch(e){} };
  /* the levels of the card (same keys as card.html LEVELS); the Qawmi-only levels stay in the data and are edited on the card page */
  const LV = [
    { k: 'psc', t: 'প্রাথমিক', names: { g: 'PSC', a: 'ইবতেদায়ি', q: 'ইবতেদাইয়্যাহ' }, ph: 'প্রাথমিক বিদ্যালয়ের নাম' },
    { k: 'jsc', t: 'জুনিয়র', names: { g: 'JSC', a: 'JDC', q: 'মুতাওয়াসসিতাহ' }, ph: 'স্কুল বা মাদ্রাসার নাম' },
    { k: 'school', t: 'মাধ্যমিক', names: { g: 'SSC', a: 'দাখিল', q: 'সানাবিয়্যাহ আম্মাহ' }, ph: 'স্কুল বা মাদ্রাসার নাম', ssc: true },
    { k: 'college', t: 'উচ্চ মাধ্যমিক', names: { g: 'HSC', a: 'আলিম', q: 'সানাবিয়্যাহ খাস্সাহ' }, ph: 'কলেজ বা মাদ্রাসার নাম' },
    { k: 'diploma', t: 'ডিপ্লোমা', names: { g: 'পলিটেকনিক, ডিপ্লোমা ইন ইঞ্জিনিয়ারিং' }, ph: 'পলিটেকনিক বা ইনস্টিটিউটের নাম' },
    { k: 'bachelor', t: 'স্নাতক', names: { g: 'অনার্স / ডিগ্রি', a: 'ফাজিল', q: 'ফযীলত' }, ph: 'বিশ্ববিদ্যালয় বা কলেজের নাম' },
    { k: 'masters', t: 'স্নাতকোত্তর', names: { g: 'মাস্টার্স', a: 'কামিল', q: 'তাকমীল (দাওরা)' }, ph: 'বিশ্ববিদ্যালয়ের নাম' }
  ];
  const ST = { card: null, cur: {}, batches: [], loaded: false, error: false, open: null, draft: null, saving: false, fromCard: false };
  let box = null;

  const emptyRow = () => ({ name: '', district: '', year: '', current: false, slug: '', yAuto: false, track: 'g', tManual: false });
  const eduOf = () => (ST.card && ST.card.edu) || {};
  const rowOf = k => { const e = eduOf()[k]; return e && String(e.name || '').trim() ? e : null; };
  const trackOf = (k) => { const e = eduOf()[k]; return (e && (e.track === 'a' || e.track === 'q')) ? e.track : 'g'; };
  const labelOf = l => l.names[trackOf(l.k)] || l.names.g;
  const normName = s => { s = String(s || '').replace(/\s+/g, ' ').trim(); try{ if(window.BnName && BnName.norm) s = BnName.norm(s); }catch(e){} return s; };

  /* ---------- loading ---------- */
  async function load(){
    const M = MB(); if(!M || !M.current()){ return; }
    const [c, i, b] = await Promise.all([
      M.sb.from('member_cards').select('data,saved_at').maybeSingle(),
      M.sb.rpc('member_institution_me'),
      M.sb.rpc('batch_me')
    ]);
    ST.error = !!c.error;
    ST.card = (c.data && c.data.data) || null;
    ST.cur = (!i.error && i.data && i.data.slug) ? i.data : {};
    ST.curKnown = !i.error;
    ST.batches = (!b.error && Array.isArray(b.data)) ? b.data : [];
    ST.loaded = true;
    // member.js sets this when it took the card made before the sign-up into the account: say so once
    try{ if(localStorage.getItem('el_adopted') === '1' && ST.card){ ST.fromCard = true; localStorage.removeItem('el_adopted'); } }catch(e){}
    paint();
  }

  /* ---------- the picture ---------- */
  const filled = () => LV.filter(l => rowOf(l.k));
  const sscBatch = () => ST.batches.find(x => x.level === 'ssc') || null;
  const yearOk = y => y >= 1970 && y <= NOW + 6;
  // what the list says about the batch: the SSC row with a listed school and a year
  function sscFromList(){
    const e = rowOf('school'); if(!e || !e.slug) return null;
    const y = parseInt(asc(e.year), 10); if(!yearOk(y)) return null;
    return { slug: e.slug, name: e.name, year: y, status: e.current ? 'studying' : 'studied' };
  }
  // the highest row that says "still studying" with a listed institution
  function curFromList(){
    for(let i = LV.length - 1; i >= 0; i--){ const e = rowOf(LV[i].k); if(e && e.current && e.slug) return { slug: e.slug, name: e.name, status: 'studying' }; }
    return null;
  }

  function paint(){
    if(!box) return;
    if(!ST.loaded){ box.innerHTML = '<div class="el-skel"><i></i><i></i><i></i></div>'; return; }
    const n = filled().length, pct = Math.round(n * 100 / LV.length);
    box.innerHTML =
      '<div class="card el-top"><div class="el-ring" style="--p:' + pct + '"><b>' + bn(n) + '/' + bn(LV.length) + '</b></div>' +
      '<div><h3>' + (n ? 'আপনার শিক্ষাজীবন সাজানো হচ্ছে' : 'আপনার শিক্ষাজীবন এখনও ফাঁকা') + '</h3>' +
      '<p>' + (n ? (ST.fromCard ? 'আপনার শিক্ষিত কার্ডের তথ্য এখানে বসে গেছে, আর এখানে বদলালে কার্ডেও বদলাবে। ' : 'এখানে বদলালে আপনার শিক্ষিত কার্ডেও বদলাবে। ') : 'প্রাথমিক থেকে স্নাতকোত্তর, যতটুকু পড়েছেন যোগ করুন। ') + 'সবটাই ঐচ্ছিক, আর শুধু আপনি দেখেন।</p></div></div>' +
      curBlock() + batchBlock() +
      '<div class="card el-levels"><h3>স্তর অনুযায়ী</h3><ul>' + LV.map(levelRow).join('') + '</ul>' +
      '<p class="el-foot">কওমি ধারার (হিফজ, ইফতা) তথ্য <a href="card.html">কার্ড পাতা</a> থেকে বদলান।' + (ST.error ? ' <b class="el-bad">তথ্য এখন পড়া যায়নি, একটু পরে আবার চেষ্টা করুন।</b>' : '') + '</p></div>';
    if(ST.open) openEditor(ST.open, true);
  }

  /* the current institution */
  function curBlock(){
    const c = ST.cur, sug = curFromList();
    let h = '<div class="card el-cur"><div class="el-h"><span class="el-ic">' + ico('pin') + '</span><div><h3>বর্তমান প্রতিষ্ঠান</h3><p>এখন যেখানে পড়ছেন (বা সবচেয়ে সম্প্রতি পড়েছেন)। একজনের একটাই।</p></div></div>';
    if(!ST.curKnown) return h + '<p class="el-mut">এখন পড়া যাচ্ছে না, একটু পরে আবার চেষ্টা করুন।</p></div>';
    if(c.slug){
      h += '<div class="el-now"><div><b><a href="institution-detail.html?slug=' + encodeURIComponent(c.slug) + '">' + esc(c.name || c.slug) + '</a></b><small>' + (c.status === 'studied' ? 'আগে পড়েছি' : 'এখন পড়ছি') + ' · শুধু আপনি দেখেন</small></div>' +
        '<div class="el-bt"><button type="button" class="btn btn-line btn-sm" data-a="cur-change">বদলান</button><button type="button" class="el-link" data-a="cur-clear">সরান</button></div></div>';
    } else if(sug){
      h += '<div class="el-now sug"><div><b>' + esc(sug.name) + '</b><small>আপনার তালিকা অনুযায়ী আপনি এখানে পড়ছেন। এটাই কি বর্তমান প্রতিষ্ঠান?</small></div>' +
        '<div class="el-bt"><button type="button" class="btn btn-blue btn-sm" data-a="cur-yes">হ্যাঁ, এটাই</button><button type="button" class="el-link" data-a="cur-change">অন্যটা বেছে নিই</button></div></div>';
    } else {
      h += '<div class="el-now"><div><b>এখনও বেছে নেননি</b><small>চাইলে বেছে নিন, না চাইলে থাক।</small></div><div class="el-bt"><button type="button" class="btn btn-blue btn-sm" data-a="cur-change">বেছে নিন</button></div></div>';
    }
    return h + '</div>';
  }

  /* the SSC batch */
  function batchBlock(){
    const b = sscBatch(), sug = sscFromList();
    let h = '<div class="card el-bat"><div class="el-h"><span class="el-ic g2">' + ico('users') + '</span><div><h3>আমার SSC ব্যাচ</h3><p>যে স্কুলে, যে সালে SSC (বা দাখিল) দিয়েছেন বা দেবেন, সেই ক্লাসের বন্ধুদের ব্যাচ।</p></div></div>';
    if(b){
      h += '<div class="el-now"><div><b><a href="/b/' + encodeURIComponent(b.slug) + '/ssc-' + b.year + '">' + esc(b.name || b.slug) + ' · ' + bn(b.year) + ' ব্যাচ</a></b><small>' + bn(b.members || 0) + ' জন সদস্য · আপনি ' + bn(b.seq || 1) + ' নম্বর</small></div><div class="el-bt"><a class="btn btn-line btn-sm" href="#batch">ব্যাচের পাতা</a></div></div>';
    } else if(sug){
      h += '<div class="el-now sug"><div><b>' + esc(sug.name) + ' · ' + bn(sug.year) + '</b><small>আপনার তালিকা অনুযায়ী এটাই আপনার SSC। এই ব্যাচের বন্ধুরা কি আগে থেকেই আছে?</small></div><div class="el-bt"><button type="button" class="btn btn-blue btn-sm" data-a="bat-join">ব্যাচ খুঁজুন</button></div></div>';
    } else {
      const e = rowOf('school');
      h += '<div class="el-now"><div><b>' + (e ? 'ব্যাচ খুঁজতে তালিকা থেকে স্কুল আর সাল বেছে নিন' : 'এখনও ব্যাচ নেই') + '</b><small>' + (e ? 'আপনার লেখা স্কুলটা তালিকার সঙ্গে মেলানো হয়নি, বা সাল নেই।' : 'নিচে "মাধ্যমিক"-এ স্কুল আর সাল যোগ করলেই ব্যাচ খুঁজে পাবেন।') + '</small></div><div class="el-bt"><button type="button" class="btn btn-line btn-sm" data-a="edit" data-k="school">' + (e ? 'ঠিক করুন' : 'যোগ করুন') + '</button></div></div>';
    }
    return h + '</div>';
  }

  /* one level */
  function levelRow(l){
    const e = rowOf(l.k), n = LV.indexOf(l) + 1, lab = labelOf(l);
    let val;
    if(e){
      const yr = e.current ? 'চলমান' : (e.year ? bn(asc(e.year)) : '');
      val = '<div class="el-val"><b>' + (e.slug ? '<a href="institution-detail.html?slug=' + encodeURIComponent(e.slug) + '">' + esc(e.name) + '</a><span class="el-tick" title="তালিকাভুক্ত প্রতিষ্ঠান">' + ico('check', 11) + '</span>' : esc(e.name)) + '</b>' + (yr ? '<small>' + yr + (e.district ? ' · ' + esc(e.district) : '') + '</small>' : (e.district ? '<small>' + esc(e.district) + '</small>' : '')) + '</div>';
    } else val = '<div class="el-val"><span class="el-no">এখনও যোগ করা হয়নি</span></div>';
    return '<li class="el-lv' + (e ? ' has' : '') + (ST.open === l.k ? ' open' : '') + '" data-k="' + l.k + '"><div class="el-row"><span class="el-dot">' + (e ? ico('check', 14) : bn(n)) + '</span>' +
      '<div class="el-lb"><b>' + l.t + '</b><em>' + esc(lab) + '</em></div>' + val +
      '<button type="button" class="btn btn-line btn-sm el-eb" data-a="edit" data-k="' + l.k + '">' + (e ? 'বদলান' : 'যোগ করুন') + '</button></div>' +
      '<div class="el-ed" id="el-ed-' + l.k + '"></div></li>';
  }

  /* ---------- the editor of one level ---------- */
  function openEditor(k, keep){
    const l = LV.find(x => x.k === k); if(!l) return;
    const old = rowOf(k);
    if(!keep || !ST.draft || ST.draft.k !== k) ST.draft = { k, name: old ? old.name : '', slug: old ? (old.slug || '') : '', district: old ? (old.district || '') : '', year: old ? asc(old.year) : '', current: old ? !!old.current : false };
    ST.open = k;
    document.querySelectorAll('.el-lv.open').forEach(x => { if(x.dataset.k !== k){ x.classList.remove('open'); const o = x.querySelector('.el-ed'); if(o) o.innerHTML = ''; } });
    const li = box.querySelector('.el-lv[data-k="' + k + '"]'); if(!li) return;
    li.classList.add('open');
    const d = ST.draft, yrs = []; for(let y = NOW + 6; y >= 1950; y--) yrs.push(y);
    $('el-ed-' + k).innerHTML =
      '<label class="el-l" for="elQ">' + esc(l.t) + ' (' + esc(labelOf(l)) + ') এর প্রতিষ্ঠান</label>' +
      '<input id="elQ" class="el-in" type="text" autocomplete="off" value="' + esc(d.name) + '" placeholder="' + esc(l.ph) + ' (বাংলা বা English)">' +
      '<div class="el-pk" id="elPk"></div><ul class="el-res" id="elRes"></ul>' +
      '<div class="el-two"><div><label class="el-l" for="elY">পাসের সাল</label><select id="elY" class="el-in"><option value="">সাল বাছুন</option>' + yrs.map(y => '<option value="' + y + '"' + (String(y) === String(d.year) ? ' selected' : '') + '>' + bn(y) + '</option>').join('') + '</select></div>' +
      '<label class="el-cb"><input type="checkbox" id="elC"' + (d.current ? ' checked' : '') + '> <span>এখনও পড়ছি</span></label></div>' +
      (l.ssc ? '<p class="el-hint">SSC-র সাল দিলে (পরের ' + bn(6) + ' বছরের মধ্যে হলেও) ব্যাচ খুঁজে পাবেন।</p>' : '') +
      '<div class="el-err" id="elErr" hidden></div>' +
      '<div class="el-act"><button type="button" class="btn btn-blue btn-sm" data-a="save">সেভ করুন</button><button type="button" class="btn btn-line btn-sm" data-a="cancel">বাতিল</button>' + (old ? '<button type="button" class="el-link red" data-a="remove">এই স্তর মুছুন</button>' : '') + '</div>';
    paintPick();
    const q = $('elQ'); if(q && !keep){ q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }
  function paintPick(){
    const d = ST.draft, pk = $('elPk'); if(!pk || !d) return;
    pk.innerHTML = d.slug ? '<span class="el-chip">' + ico('check', 12) + ' তালিকাভুক্ত প্রতিষ্ঠান বেছে নেওয়া হয়েছে' + (d.district ? ' · ' + esc(d.district) : '') + '</span>'
      : (String(d.name).trim().length >= 3 ? '<span class="el-chip plain">তালিকা থেকে না বেছে নিলে নিজের লেখাই থাকবে</span>' : '');
  }
  let sT = 0, sId = 0;
  function search(v){
    clearTimeout(sT); const res = $('elRes'); if(!res) return;
    if(v.trim().length < 2){ res.innerHTML = ''; return; }
    sT = setTimeout(async () => {
      const id = ++sId, M = MB(); if(!M) return;
      let r; try{ r = await M.sb.rpc('directory_search', { p_q: v.trim(), p_limit: 6 }); }catch(e){ return; }
      if(id !== sId || !$('elRes')) return;
      const rows = (!r.error && Array.isArray(r.data)) ? r.data : [];
      ST.results = rows;
      $('elRes').innerHTML = rows.map((x, i) => '<li><button type="button" data-a="pick" data-i="' + i + '"><b>' + esc(x.institution_name) + '</b><small>' + esc([x.institution_type, x.upazila, x.district].filter(Boolean).join(' · ')) + '</small></button></li>').join('') ||
        '<li class="el-none">এই নামে তালিকায় পাওয়া গেল না। নিজের লেখাটাই রাখতে পারেন।</li>';
    }, 280);
  }

  /* ---------- saving: the same row the card keeps (member_cards.data.edu[key]) ---------- */
  async function writeEdu(k, row){
    const M = MB(); if(!M || !M.current()) throw new Error('NOT_SIGNED_IN');
    const r = await M.sb.from('member_cards').select('data,saved_at').maybeSingle();     // read the newest copy just before the change (the card may have changed on another device)
    if(r.error) throw r.error;
    const d = (r.data && r.data.data && typeof r.data.data === 'object') ? r.data.data : { badges: [], theme: 'night', format: 'post', name: '' };
    d.edu = d.edu || {};
    if(row === null){ d.edu[k] = Object.assign(emptyRow(), { track: (d.edu[k] && d.edu[k].track) || 'g' }); }
    else d.edu[k] = Object.assign(emptyRow(), d.edu[k] || {}, row);
    d.savedAt = Date.now();
    const u = await M.sb.from('member_cards').upsert({ user_id: M.current().user_id, data: d, saved_at: d.savedAt, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if(u.error) throw u.error;
    ST.card = d;
  }
  async function save(){
    const d = ST.draft, err = $('elErr'); if(!d || ST.saving) return;
    const name = normName(d.name); err.hidden = true;
    if(name.length < 3){ err.textContent = 'প্রতিষ্ঠানের নাম অন্তত ৩ অক্ষরের লিখুন, বা তালিকা থেকে বেছে নিন।'; err.hidden = false; return; }
    d.year = $('elY').value; d.current = $('elC').checked;
    ST.saving = true; const btn = box.querySelector('[data-a="save"]'); if(btn) btn.disabled = true;
    try{
      await writeEdu(d.k, { name, slug: d.slug || '', district: d.district || '', year: d.year ? String(d.year) : '', current: !!d.current, yAuto: false });
      track('el_saved', { k: d.k, listed: d.slug ? 1 : 0 });
      ST.open = null; ST.draft = null; paint(); document.dispatchEvent(new CustomEvent('edulife:saved'));
      const M = MB(); if(M && M.toast) M.toast('সেভ হয়েছে ✓');
    }catch(e){ err.textContent = 'এখন সেভ করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।'; err.hidden = false; }
    finally{ ST.saving = false; if(btn) btn.disabled = false; }
  }
  async function remove(){
    const d = ST.draft; if(!d) return;
    if(!confirm('এই স্তরের তথ্য মুছে ফেলবেন? কার্ড থেকেও যাবে।')) return;
    try{ await writeEdu(d.k, null); track('el_removed', { k: d.k }); ST.open = null; ST.draft = null; paint(); document.dispatchEvent(new CustomEvent('edulife:saved')); }
    catch(e){ const err = $('elErr'); if(err){ err.textContent = 'এখন মোছা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।'; err.hidden = false; } }
  }

  /* ---------- the two top blocks use myinst.js ---------- */
  async function curYes(){
    const s = curFromList(), M = MB(); if(!s || !M) return;
    const r = await M.sb.rpc('member_set_institution', { p_slug: s.slug, p_status: 'studying' });
    if(r.error || !r.data || r.data.ok !== true){ if(M.toast) M.toast('এখন সংরক্ষণ করা যাচ্ছে না, একটু পরে আবার চাপুন'); return; }
    track('el_current_set', {}); await load(); if(window.MyInst && MyInst.check) MyInst.check();
  }
  async function curClear(){
    const M = MB(); if(!M) return;
    const r = await M.sb.rpc('member_clear_institution');
    if(r.error || !r.data || r.data.ok !== true){ if(M.toast) M.toast('এখন সরানো যাচ্ছে না, একটু পরে আবার চাপুন'); return; }
    await load(); if(window.MyInst && MyInst.check) MyInst.check();
  }

  /* ---------- events ---------- */
  function onClick(e){
    const b = e.target.closest('[data-a]'); if(!b || !box.contains(b)) return;
    const a = b.dataset.a;
    if(a === 'edit'){ const k = b.dataset.k || (b.closest('.el-lv') || {}).dataset.k; if(ST.open === k){ ST.open = null; ST.draft = null; paint(); } else { ST.open = k; ST.draft = null; paint(); const li = box.querySelector('.el-lv[data-k="' + k + '"]'); if(li) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
    else if(a === 'cancel'){ ST.open = null; ST.draft = null; paint(); }
    else if(a === 'save') save();
    else if(a === 'remove') remove();
    else if(a === 'pick'){ const x = (ST.results || [])[+b.dataset.i]; if(!x || !ST.draft) return; ST.draft.name = x.institution_name; ST.draft.slug = x.desired_slug; ST.draft.district = x.district || ''; $('elQ').value = x.institution_name; $('elRes').innerHTML = ''; paintPick(); }
    else if(a === 'cur-change'){ if(window.MyInst) MyInst.open({ mode: 'current' }); }
    else if(a === 'cur-yes') curYes();
    else if(a === 'cur-clear') curClear();
    else if(a === 'bat-join'){ const s = sscFromList(); if(s && window.MyInst && MyInst.joinSsc) MyInst.joinSsc(s); }
  }
  function onInput(e){
    if(e.target.id === 'elQ' && ST.draft){ ST.draft.name = e.target.value; ST.draft.slug = ''; ST.draft.district = ''; paintPick(); search(e.target.value); }
  }

  /* ---------- small icons (the dashboard has its own set, this is self-contained) ---------- */
  function ico(n, s){
    s = s || 20;
    const P = { pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>', users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c0-3.2 2.6-5.5 6-5.5s6 2.3 6 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.2c2.7.1 4.5 1.9 4.5 4.3"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>' };
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (n === 'check' ? 3 : 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P[n] + '</svg>';
  }

  /* ---------- start ---------- */
  function start(){
    box = $('lifeBox'); if(!box) return;
    box.addEventListener('click', onClick); box.addEventListener('input', onInput);
    document.addEventListener('myinst:change', () => { if(ST.loaded) load(); });
    const M = MB(); if(!M) return;
    paint();
    M.ready().then(() => { if(M.current()) load(); });
    M.onChange(me => { if(me){ ST.loaded = false; paint(); load(); } });
  }
  window.EduLife = { load, LV, sscFromList, curFromList };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
