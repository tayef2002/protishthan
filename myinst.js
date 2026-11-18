/* আমার প্রতিষ্ঠান: "যুক্ত হোন" for every institution of the directory.
   - on the directory cards (home page, search results): how many members are joined, and a join button
   - on an institution page: the same, bigger
   - the join sheet: the batches already opened at that institution ("your batchmates are already here") or a new batch of your own, then your status (private)
   The data is the batch tables (migrations/2027-01-06_my_institution.sql): the batch membership IS the institution membership. Counts only, self-declared.
   Needs member.js (the member sign-in) loaded first. */
(function(){
  'use strict';
  if(window.MyInst) return;
  const MB = () => (window.Protishthan && window.Protishthan.member) || null;
  const QUIET = !!window.MYINST_QUIET;   // the card page: no invitation, nothing runs by itself, only the panel after a download (cardPanel)
  const bn = x => String(x).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const track = (n, p) => { try{ window.track && window.track(n, p || {}); }catch(e){} };
  const LEVELS = [['psc', 'প্রাথমিক (PSC)'], ['jsc', 'জুনিয়র (JSC)'], ['ssc', 'মাধ্যমিক (SSC)'], ['hsc', 'উচ্চ মাধ্যমিক (HSC)'], ['bachelor', 'স্নাতক'], ['masters', 'স্নাতকোত্তর']];
  const LVN = {}; LEVELS.forEach(l => { LVN[l[0]] = l[1]; });
  const STATUS = [['studied', 'পড়েছি'], ['studying', 'এখনও পড়ছি'], ['left_early', 'শেষ করতে পারিনি']];
  /* "আমার প্রতিষ্ঠান" = where the person studies now (any institution), "ব্যাচ" = the SSC (Dakhil) batch only. A school or madrasa page offers the batch;
     a college, university, technical or coaching page offers only "I study / studied here" (there is no SSC batch there). Both are optional. */
  const CSTATUS = [['studying', 'এখন পড়ছি'], ['studied', 'আগে পড়েছি']];
  const isSchool = t => !t || /স্কুল|মাদ্রাসা|দাখিল|বিদ্যালয়/.test(String(t).replace(/বিশ্ববিদ্যালয়/g, ''));   // "বিশ্ববিদ্যালয়" contains "বিদ্যালয়": a university is not a school
  const INTENT = 'mi_intent';
  const NOW = new Date().getFullYear();
  const ICON_USERS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c0-3.2 2.6-5.5 6-5.5s6 2.3 6 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.2c2.7.1 4.5 1.9 4.5 4.3"/></svg>';
  const ICON_CHECK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  /* ---------- the numbers on the screen ---------- */
  const COUNTS = new Map();          // slug -> members
  const asked = new Set();
  let MINE = new Set();              // the slugs the signed-in member is already in (a batch there, or the current institution)
  let CUR = {};                      // the current institution of the member: { slug, status, name, type } or {}
  const signedIn = () => { const m = MB(); return !!(m && m.current && m.current()); };
  const rpc = async (name, args) => { const m = MB(); if(!m || !m.sb) return { error: { message: 'NO_CLIENT' } }; try{ return await m.sb.rpc(name, args || {}); }catch(e){ return { error: { message: String(e && e.message || e) } }; } };

  async function fetchCounts(slugs){
    const todo = [...new Set(slugs)].filter(s => s && !asked.has(s));
    if(!todo.length) return;
    todo.forEach(s => asked.add(s));
    for(let i = 0; i < todo.length; i += 40){
      const part = todo.slice(i, i + 40), r = await rpc('institution_members', { p_slugs: part });
      if(r.error){ part.forEach(s => asked.delete(s)); return; }   // the SQL is not run yet or a slow moment: nothing is shown, and it is asked again next time
      const got = new Map((r.data || []).map(x => [x.slug, Number(x.members)]));
      part.forEach(s => COUNTS.set(s, got.get(s) || 0));
    }
    paint();
  }
  async function loadMine(){
    if(!signedIn()){ MINE = new Set(); CUR = {}; paint(); return; }
    const [r, c] = await Promise.all([rpc('batch_me'), rpc('member_institution_me')]);
    CUR = (!c.error && c.data && c.data.slug) ? c.data : {};
    MINE = new Set((Array.isArray(r.data) ? r.data.map(x => x.slug) : []).concat(CUR.slug ? [CUR.slug] : []));
    paint();
    if(!r.error && Array.isArray(r.data) && !c.error) nudge();      // only when both answers are real: a failed call must not look like "no institution"
  }
  const countText = slug => { const n = COUNTS.get(slug); if(n == null) return ''; return n > 0 ? ICON_USERS + '<span>' + bn(n) + ' জন যুক্ত</span>' : '<span>এখনও কেউ নেই, প্রথম হোন</span>'; };
  function paint(){
    document.querySelectorAll('[data-mi-count]').forEach(el => { el.innerHTML = countText(el.getAttribute('data-mi-count')); });
    document.querySelectorAll('[data-mi-join]').forEach(el => {
      const s = el.getAttribute('data-mi-join'), inn = MINE.has(s), inst = el.getAttribute('data-mi-kind') === 'inst', big = el.classList.contains('mi-btn');
      el.classList.toggle('mi-in', inn);
      el.innerHTML = inn ? ICON_CHECK + ' যুক্ত আছেন' : inst ? (big ? 'আমি এখানে পড়ি / পড়েছি' : 'এখানে পড়ি') : (big ? 'আমার ব্যাচ খুঁজুন' : 'ব্যাচ খুঁজুন');
    });
  }

  /* ---------- the directory cards ---------- */
  const slugOf = a => { try{ return new URL(a.getAttribute('href'), location.href).searchParams.get('slug') || ''; }catch(e){ return ''; } };
  function decorate(root){
    const cards = (root || document).querySelectorAll('a.inst-card[href*="institution-detail"]:not([data-mi])');
    if(!cards.length) return;
    const slugs = [];
    cards.forEach(a => {
      const slug = slugOf(a); if(!slug) return;
      a.setAttribute('data-mi', '1');
      const nameEl = a.querySelector('.inst-name'), name = nameEl ? nameEl.textContent.trim() : '';
      const locEl = a.querySelector('.ic-loc'), type = locEl ? locEl.textContent.split('·')[0].trim() : '';
      const row = document.createElement('div'); row.className = 'mi-row';
      row.innerHTML = '<span class="mi-count" data-mi-count="' + esc(slug) + '">' + countText(slug) + '</span><span class="mi-join" role="button" tabindex="0" data-mi-kind="' + (isSchool(type) ? 'batch' : 'inst') + '" data-mi-join="' + esc(slug) + '">' + (isSchool(type) ? 'ব্যাচ খুঁজুন' : 'এখানে পড়ি') + '</span>';
      const foot = a.querySelector('.ic-foot'); if(foot) a.insertBefore(row, foot); else a.appendChild(row);
      const go = e => { e.preventDefault(); e.stopPropagation(); open({ slug, name, type }); };
      const j = row.querySelector('.mi-join'); j.addEventListener('click', go); j.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' ') go(e); });
      slugs.push(slug);
    });
    paint();
    fetchCounts(slugs);
  }
  let obsT = 0;
  function watch(){
    decorate(document);
    new MutationObserver(() => { clearTimeout(obsT); obsT = setTimeout(() => decorate(document), 150); }).observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- an institution page ---------- */
  function mountHero(){
    if(!/institution-detail/.test(location.pathname)) return;
    const slug = new URLSearchParams(location.search).get('slug'); if(!slug) return;
    let tries = 0;
    const t = setInterval(() => {
      const name = document.getElementById('heroName'), host = document.getElementById('heroBadges');
      if(++tries > 60){ clearInterval(t); return; }
      if(!name || !host || !name.textContent.trim() || name.textContent.trim() === '—') return;
      clearInterval(t);
      if(document.getElementById('miHero')) return;
      const box = document.createElement('div'); box.id = 'miHero'; box.className = 'mi-hero';
      host.parentNode.insertBefore(box, host.nextSibling);
      // the page knows the type; the block waits for it (a school gets the batch button, a college or university the "I study here" button)
      typeOf(slug).then(type => {
        const inst = !isSchool(type);
        box.innerHTML = '<span class="mi-count mi-big" data-mi-count="' + esc(slug) + '"></span><button type="button" class="mi-btn" data-mi-kind="' + (inst ? 'inst' : 'batch') + '" data-mi-join="' + esc(slug) + '">' + (inst ? 'আমি এখানে পড়ি / পড়েছি' : 'আমার ব্যাচ খুঁজুন') + '</button><small>' +
          (inst ? 'আপনি এখানে পড়ছেন বা পড়েছেন? জানিয়ে রাখুন, আপনার সহপাঠীরাও আপনাকে খুঁজে পাবে।' : 'আপনি এখানে পড়েছেন বা পড়ছেন? আপনার ব্যাচের সহপাঠীরা আগে থেকেই এখানে থাকতে পারেন।') + '</small>';
        box.querySelector('.mi-btn').addEventListener('click', () => open({ slug, name: name.textContent.trim(), type }));
        paint(); fetchCounts([slug]);
      });
    }, 250);
  }
  /* the type of one institution (the directory table is public to read, the institution page reads it the same way) */
  async function typeOf(slug){
    const m = MB(); if(!m || !m.sb || !m.sb.from) return '';
    try{
      const r = await m.sb.from('listing_submissions').select('institution_type').eq('desired_slug', slug).eq('status', 'approved').limit(1);
      return (r.data && r.data[0] && r.data[0].institution_type) || '';
    }catch(e){ return ''; }
  }

  /* ---------- the sheet ---------- */
  let ov = null, ST = null;
  function build(){
    ov = document.createElement('div'); ov.className = 'mi-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'আমার প্রতিষ্ঠানে যুক্ত হোন');
    ov.innerHTML = '<div class="mi-sheet"><button type="button" class="mi-x" aria-label="বন্ধ করুন">×</button><div class="mi-body" id="miBody"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if(e.target === ov) close(); });
    ov.querySelector('.mi-x').addEventListener('click', close);
    document.addEventListener('keydown', e => { if(e.key === 'Escape' && ov.classList.contains('show')) close(); });
  }
  const body = html => { document.getElementById('miBody').innerHTML = html; const s = ov.querySelector('.mi-sheet'); if(s) s.scrollTop = 0; };
  function close(){ if(ov){ ov.classList.remove('show'); document.body.style.overflow = ''; } }
  const head = (sub, kick) => '<div class="mi-h"><span class="mi-kick">' + (kick || 'আমার ব্যাচ') + '</span><h2>' + esc(ST.name || 'প্রতিষ্ঠান') + '</h2>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>';

  function ask(){
    try{ localStorage.setItem(INTENT, JSON.stringify({ slug: ST.slug, name: ST.name, type: ST.type, pick: !ST.slug, mode: ST.mode, t: Date.now() })); }catch(e){}
    const m = MB(); if(!m){ location.href = '/member'; return; }
    track('mi_signin', {});
    const batch = ST.slug ? isSchool(ST.type) : ST.mode === 'batch';
    m.signIn('৫ সেকেন্ড, পাসওয়ার্ড ছাড়াই। যুক্ত হওয়ার পর এই পাতাতেই ফিরে আসবেন।', {
      title: batch ? 'আপনার ব্যাচ খুঁজে নিন' : 'আপনার প্রতিষ্ঠান বেছে নিন', chip: ST.name || (batch ? 'আমার ব্যাচ' : 'আমার প্রতিষ্ঠান'), cta: 'Google দিয়ে চালিয়ে যান',
      perks: batch
        ? [['seat', 'আপনার ব্যাচের সদস্য নম্বর, একবার পেলে বদলায় না'], ['users', 'ব্যাচের সহপাঠীরা আগে থেকেই এখানে থাকলে সঙ্গে সঙ্গে দেখবেন'], ['eye', 'নাম-ছবি শুধু ব্যাচের সদস্যরা দেখে, আর কেউ না']]
        : [['seat', 'আপনার প্রতিষ্ঠানের সদস্য সংখ্যায় আপনিও থাকবেন'], ['users', 'আপনার সহপাঠীরা এখানে থাকলে খুঁজে পাবেন'], ['eye', 'আপনি কোথায় পড়েন, সেটা শুধু আপনিই দেখেন']]
    });
  }

  async function open(o){
    if(!ov) build();
    ST = { slug: o.slug || '', name: o.name || '', type: o.type || '', mode: o.mode || 'current', list: null };
    track('mi_open', {});
    if(!signedIn()){ const m = MB(); if(m && m.ready) await m.ready(); }
    if(!signedIn()){ ask(); return; }
    ov.classList.add('show'); document.body.style.overflow = 'hidden';
    if(!ST.slug){ showPick(ST.mode); return; }
    body(head('') + '<div class="mi-sk"><i></i><i></i><i></i></div>');
    if(!ST.type) ST.type = await typeOf(ST.slug);
    if(isSchool(ST.type)) await showList(); else showInst();
  }

  /* the pick step: find an institution by name (the directory search).
     mode 'current': where do you study now (any institution)  ->  the "I study here" step.
     mode 'batch': the school where you sat SSC  ->  the list of its batches. */
  function showPick(mode){
    ST.mode = mode === 'batch' ? 'batch' : 'current';
    const batch = ST.mode === 'batch';
    body('<div class="mi-h"><span class="mi-kick">' + (batch ? 'আমার ব্যাচ' : 'আমার প্রতিষ্ঠান') + '</span><h2>' + (batch ? 'আপনার SSC কোন স্কুলে ছিল?' : 'আপনি এখন কোথায় পড়েন?') + '</h2><p>' +
      (batch ? 'স্কুল বা মাদ্রাসা বেছে নিন, তারপর দেখবেন আপনার ব্যাচের কে কে আগে থেকেই আছে।' : 'স্কুল, কলেজ, মাদ্রাসা বা বিশ্ববিদ্যালয়, যেটায় এখন পড়ছেন (বা পড়েছেন) সেটা বেছে নিন।') +
      ' এটা না করলেও সাইটের সবকিছু আগের মতোই ব্যবহার করতে পারবেন।</p></div>' +
      '<div class="mi-search"><input id="miQ" type="search" autocomplete="off" placeholder="প্রতিষ্ঠানের নাম লিখুন (বাংলা বা English)" aria-label="প্রতিষ্ঠানের নাম"></div>' +
      '<ul class="mi-res" id="miRes"></ul><p class="mi-hint" id="miHint"></p>' +
      '<div class="mi-act"><button type="button" class="mi-link" id="miSkip">এখন নয়, পরে করব</button></div>');
    const q = document.getElementById('miQ'), res = document.getElementById('miRes'), hint = document.getElementById('miHint');
    let t = 0, my = 0, rows = [];
    q.focus();
    q.addEventListener('input', () => {
      clearTimeout(t); const v = q.value.trim();
      if(v.length < 2){ res.innerHTML = ''; hint.textContent = ''; return; }
      t = setTimeout(async () => {
        const id = ++my, r = await rpc('directory_search', { p_q: v, p_limit: 8 });
        if(id !== my) return;
        if(r.error){ res.innerHTML = ''; hint.textContent = 'এখন খোঁজা যাচ্ছে না, একটু পরে আবার চেষ্টা করুন।'; return; }
        rows = Array.isArray(r.data) ? r.data : [];
        hint.innerHTML = rows.length ? '' : 'এই নামে কিছু পাওয়া গেল না। <a href="/list-institution">প্রতিষ্ঠানটা তালিকায় যোগ করুন</a>।';
        res.innerHTML = rows.map((x, i) => '<li><button type="button" data-i="' + i + '"><b>' + esc(x.institution_name) + '</b><small>' + esc([x.institution_type, x.upazila, x.district].filter(Boolean).join(' · ')) + '</small></button></li>').join('');
      }, 280);
    });
    res.addEventListener('click', e => {
      const b = e.target.closest('button[data-i]'); if(!b) return; const x = rows[+b.dataset.i]; if(!x) return;
      ST.slug = x.desired_slug; ST.name = x.institution_name; ST.type = x.institution_type || ''; ST.fromPick = true; fetchCounts([x.desired_slug]);
      if(batch && isSchool(ST.type)){ body(head('') + '<div class="mi-sk"><i></i><i></i><i></i></div>'); showList(); }
      else showInst();
    });
    document.getElementById('miSkip').onclick = () => { noteSkip(); close(); };
  }

  /* the "I study / studied here" step: the current institution (one per member, private status, changeable) */
  function showInst(){
    const mine = CUR.slug === ST.slug, other = CUR.slug && !mine, total = COUNTS.get(ST.slug) || 0;
    body(head(total ? '<b>' + bn(total) + ' জন</b> এখানে যুক্ত আছেন।' : 'এখনও কেউ যুক্ত হননি, আপনি প্রথম হতে পারেন।', 'আমার প্রতিষ্ঠান') +
      '<label class="mi-l">আপনি এখানে…</label><div class="mi-chips" id="miSt">' + CSTATUS.map((s, i) => '<button type="button" data-v="' + s[0] + '"' + ((mine ? CUR.status === s[0] : i === 0) ? ' class="on"' : '') + '>' + s[1] + '</button>').join('') + '</div>' +
      '<p class="mi-hint">এটা শুধু আপনি দেখবেন, আর কেউ না।</p>' +
      (other ? '<p class="mi-note">আপনার বর্তমান প্রতিষ্ঠান <b>' + esc(CUR.name || 'আরেকটা') + '</b>। এটা বেছে নিলে বদলে যাবে (একজনের একটাই)।</p>' : '') +
      '<div class="mi-err" id="miErr" hidden></div>' +
      '<div class="mi-act">' + (ST.fromPick ? '<button type="button" class="mi-sec" id="miBack">← ফিরে যান</button>' : '') + '<button type="button" class="mi-pri" id="miGo">' + (mine ? 'ঠিক করে রাখুন' : 'এটাই আমার প্রতিষ্ঠান') + '</button></div>' +
      (mine ? '<div class="mi-act"><button type="button" class="mi-link" id="miOut">এখান থেকে সরিয়ে দিন</button></div>' : ''));
    let st = mine ? CUR.status : 'studying';
    document.querySelectorAll('#miSt button').forEach(b => { b.onclick = () => { st = b.dataset.v; document.querySelectorAll('#miSt button').forEach(x => x.classList.toggle('on', x === b)); }; });
    const back = document.getElementById('miBack'); if(back) back.onclick = () => { ST.fromPick = false; showPick(ST.mode); };
    document.getElementById('miGo').onclick = () => submitInst(st);
    const out = document.getElementById('miOut'); if(out) out.onclick = leaveInst;
  }
  async function submitInst(status){
    const go = document.getElementById('miGo'), err = document.getElementById('miErr'); go.disabled = true; err.hidden = true;
    const r = await rpc('member_set_institution', { p_slug: ST.slug, p_status: status });
    go.disabled = false;
    const d = r.data;
    if(r.error || !d){ err.textContent = 'এখন সংরক্ষণ করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।'; err.hidden = false; return; }
    if(d.ok === true){ track('mi_current_set', { status }); CUR = { slug: ST.slug, status, name: ST.name, type: ST.type }; MINE.add(ST.slug); changed(); if(d.institution_members != null) COUNTS.set(ST.slug, Number(d.institution_members)); paint(); return doneInst(d); }
    if(d.error === 'NOT_SIGNED_IN'){ ask(); return; }
    err.textContent = ERR[d.error] || 'সংরক্ষণ করা গেল না। একটু পরে আবার চেষ্টা করুন।'; err.hidden = false;
  }
  async function leaveInst(){
    const out = document.getElementById('miOut'); if(out) out.disabled = true;
    const r = await rpc('member_clear_institution');
    if(r.error || !r.data || r.data.ok !== true){ if(out) out.disabled = false; const err = document.getElementById('miErr'); if(err){ err.textContent = 'এখন সরানো যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।'; err.hidden = false; } return; }
    CUR = {}; asked.delete(ST.slug); await loadMine(); fetchCounts([ST.slug]); changed();
    body('<div class="mi-done"><h2>সরিয়ে দেওয়া হলো</h2><p>চাইলে যেকোনো সময় আবার বেছে নিতে পারবেন।</p><div class="mi-act col"><button type="button" class="mi-pri" id="miClose">ঠিক আছে</button></div></div>');
    document.getElementById('miClose').onclick = close;
  }
  function doneInst(d){
    const n = Number(d.institution_members) || COUNTS.get(ST.slug) || 0, school = isSchool(ST.type);
    body('<div class="mi-done"><div class="mi-tick">' + ICON_CHECK.replace('width="13" height="13"', 'width="30" height="30"') + '</div><h2>আপনার প্রতিষ্ঠান ঠিক হলো</h2>' +
      '<p><b>' + esc(ST.name) + '</b></p>' +
      (n ? '<div class="mi-nums one"><div><b>' + bn(n) + '</b><small>জন যুক্ত এই প্রতিষ্ঠানে</small></div></div>' : '') +
      '<p class="mi-note">' + (school ? 'এই স্কুলে SSC দিয়ে থাকলে (বা দেবেন), আপনার ব্যাচের বন্ধুদের খুঁজে নিন।' : 'আপনার SSC কোন স্কুলে ছিল? সেই ব্যাচের বন্ধুদের খুঁজে নিন, ইচ্ছা হলে।') + '</p>' +
      '<div class="mi-act col"><button type="button" class="mi-pri" id="miNextB">' + (school ? 'আমার ব্যাচ খুঁজুন' : 'আমার SSC ব্যাচ খুঁজুন') + '</button><a class="mi-sec" href="/card">আপনার শিক্ষিত কার্ড বানান</a><button type="button" class="mi-link" id="miClose">এখনই না</button></div></div>');
    document.getElementById('miClose').onclick = close;
    document.getElementById('miNextB').onclick = () => { ST.fromPick = false; if(school){ body(head('') + '<div class="mi-sk"><i></i><i></i><i></i></div>'); showList(); } else { ST.slug = ''; ST.name = ''; ST.type = ''; showPick('batch'); } };
  }

  /* the invitation after a sign-in: never a wall. "পরে" backs off (7 days, then 30 days, then it stops by itself). */
  const NK = 'mi_nudge';
  const nstate = () => { try{ return JSON.parse(localStorage.getItem(NK) || 'null') || { n: 0, t: 0 }; }catch(e){ return { n: 0, t: 0 }; } };
  const nudgeDue = () => { const s = nstate(); return s.n < 3 && (s.n === 0 || Date.now() - s.t > (s.n === 1 ? 7 : 30) * 864e5); };
  function noteSkip(){ const s = nstate(); try{ localStorage.setItem(NK, JSON.stringify({ n: s.n + 1, t: Date.now() })); }catch(e){} }
  function nudge(){
    if(QUIET || !signedIn() || MINE.size > 0 || !nudgeDue() || document.getElementById('miNudge')) return;
    setTimeout(() => {
      if(!signedIn() || MINE.size > 0 || !nudgeDue() || document.getElementById('miNudge') || document.getElementById('mbWelcome') || (ov && ov.classList.contains('show'))) return;
      const n = document.createElement('div'); n.id = 'miNudge'; n.className = 'mi-nudge'; n.setAttribute('role', 'region'); n.setAttribute('aria-label', 'আপনি এখন কোথায় পড়েন');
      n.innerHTML = '<div class="mi-nt"><b>আপনি এখন কোথায় পড়েন?</b><small>প্রতিষ্ঠান বেছে নিলে আপনার ব্যাচের বন্ধুদেরও খুঁজে পাবেন।</small></div><button type="button" class="mi-nb">বেছে নিন</button><button type="button" class="mi-nx" aria-label="পরে করব">×</button>';
      document.body.appendChild(n);
      n.querySelector('.mi-nb').onclick = () => { n.remove(); track('mi_nudge_go', {}); open({ mode: 'current' }); };
      n.querySelector('.mi-nx').onclick = () => { noteSkip(); n.remove(); track('mi_nudge_skip', {}); };
    }, 2500);
  }

  async function showList(){
    const r = await rpc('institution_batches', { p_slug: ST.slug });
    if(r.error){ body(head('') + '<p class="mi-err">এখন লোড করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।</p><div class="mi-act"><button type="button" class="mi-pri" id="miRetry">আবার চেষ্টা করুন</button></div>'); document.getElementById('miRetry').onclick = showList; return; }
    ST.list = Array.isArray(r.data) ? r.data : [];
    const total = COUNTS.get(ST.slug) || 0;
    let h = head(ST.list.length ? 'আপনার ব্যাচের লোকজন কি আগে থেকেই এখানে? ' + (total ? '<b>' + bn(total) + ' জন</b> যুক্ত আছেন।' : '') : 'আপনার ব্যাচ এখানে এখনও খোলা হয়নি। আপনি খুললেই সহপাঠীরা আপনাকে খুঁজে পাবে।');
    if(ST.list.length){
      h += '<ul class="mi-bl">' + ST.list.map((b, i) => {
        const sub = [LVN[b.level] || b.level, b.name || '', b.convener ? 'আহ্বায়ক: ' + b.convener : ''].filter(Boolean).join(' · ');
        return '<li class="mi-b' + (b.mine ? ' me' : '') + '"><div class="mi-bt"><b>' + bn(b.year) + ' ব্যাচ</b><small>' + esc(sub) + '</small></div><div class="mi-bn">' + bn(b.members) + '<small>সদস্য</small></div>' +
          (b.mine ? '<a class="mi-go in" href="' + bpath(b.level, b.year) + '">' + ICON_CHECK + ' আপনি আছেন</a>' : '<button type="button" class="mi-go" data-i="' + i + '">যোগ দিন</button>') + '</li>';
      }).join('') + '</ul>';
    }
    h += '<button type="button" class="mi-new' + (ST.list.length ? '' : ' first') + '" id="miNew"><span>＋</span> ' + (ST.list.length ? 'আমার ব্যাচ এখানে নেই, নতুন ব্যাচ খুলি' : 'আমার ব্যাচ খুলি') + '</button>';
    body(h);
    body_bind();
  }
  function body_bind(){
    document.querySelectorAll('#miBody .mi-go[data-i]').forEach(b => { b.onclick = () => { const x = ST.list[+b.dataset.i]; showStatus({ level: x.level, year: x.year, label: bn(x.year) + ' ব্যাচ · ' + (LVN[x.level] || x.level), created: false }); }; });
    const n = document.getElementById('miNew'); if(n) n.onclick = showNew;
  }
  const bpath = (level, year) => '/b/' + encodeURIComponent(ST.slug) + '/' + level + '-' + year;

  /* a batch is the SSC (or Dakhil) batch only: no other level is offered (the data layer can hold more, we do not open them) */
  function showNew(){
    const yrs = []; for(let y = NOW + 6; y >= 1970; y--) yrs.push(y);   // up to six years ahead: a student who is still at school opens the batch of the year they will sit SSC
    body(head('নতুন ব্যাচ খুলুন। আপনি এর আহ্বায়ক হবেন, সদস্য নম্বর ১।') +
      '<label class="mi-l" for="miYr">আপনার ক্লাসের বন্ধুরা কোন সালে SSC (বা দাখিল) দিয়েছে বা দেবে?</label>' +
      '<select id="miYr" class="mi-sel"><option value="">সাল বাছুন</option>' + yrs.map(y => '<option value="' + y + '">' + bn(y) + '</option>').join('') + '</select>' +
      '<p class="mi-hint">ঝরে পড়লেও আপনার বন্ধুদের সালটাই দিন, তাহলে সবাই এক ব্যাচে থাকবেন।</p>' +
      '<div class="mi-act"><button type="button" class="mi-sec" id="miBack">← ফিরে যান</button><button type="button" class="mi-pri" id="miNext" disabled>এগিয়ে যান</button></div>');
    const sync = () => { document.getElementById('miNext').disabled = !document.getElementById('miYr').value; };
    document.getElementById('miYr').onchange = sync;
    document.getElementById('miBack').onclick = showList;
    document.getElementById('miNext').onclick = () => {
      const y = +document.getElementById('miYr').value, exists = (ST.list || []).find(x => x.level === 'ssc' && x.year === y);
      showStatus({ level: 'ssc', year: y, label: bn(y) + ' ব্যাচ · ' + LVN.ssc, created: !exists });
    };
  }

  function showStatus(c){
    body(head('') + '<div class="mi-pick"><b>' + esc(c.label) + '</b><small>' + (c.created ? 'নতুন ব্যাচ, আপনি আহ্বায়ক হবেন' : 'আগে থেকে খোলা ব্যাচ') + '</small></div>' +
      '<label class="mi-l">আপনি এখানে…</label><div class="mi-chips" id="miSt">' + STATUS.map((s, i) => '<button type="button" data-v="' + s[0] + '"' + (i === 0 ? ' class="on"' : '') + '>' + s[1] + '</button>').join('') + '</div>' +
      '<p class="mi-hint">এটা শুধু আপনি দেখবেন, ব্যাচের আর কেউ না।</p><div class="mi-err" id="miErr" hidden></div>' +
      '<div class="mi-act"><button type="button" class="mi-sec" id="miBack">← ফিরে যান</button><button type="button" class="mi-pri" id="miGo">যুক্ত হোন</button></div>');
    let st = 'studied';
    document.querySelectorAll('#miSt button').forEach(b => { b.onclick = () => { st = b.dataset.v; document.querySelectorAll('#miSt button').forEach(x => x.classList.toggle('on', x === b)); }; });
    document.getElementById('miBack').onclick = c.created ? showNew : showList;
    document.getElementById('miGo').onclick = () => submit(c, st);
  }

  const ERR = {
    RATE: 'অল্প সময়ে অনেকগুলো ব্যাচে যোগ দেওয়া হয়ে গেছে। একটু পরে আবার চেষ্টা করুন।',
    TOO_MANY: 'আপনি আগেই সর্বোচ্চ সংখ্যক ব্যাচে আছেন (বা তিনটা ব্যাচ খুলেছেন)। কোনো একটা ছেড়ে আবার চেষ্টা করুন।',
    LOCKED: 'এই ব্যাচ এখন নতুন সদস্য নিচ্ছে না।',
    NO_INSTITUTION: 'এই প্রতিষ্ঠানটা এখন তালিকায় নেই।',
    BAD_BATCH: 'স্তর বা সালটা ঠিক হয়নি, আবার বেছে নিন।'
  };
  async function afterJoin(c, d, status){
    track('mi_joined', { created: !!d.created });
    // someone who says "I am still studying here" and has no current institution yet: this school is it (they said so themselves)
    if(status === 'studying' && !CUR.slug){
      const q = await rpc('member_set_institution', { p_slug: ST.slug, p_status: 'studying' });
      if(q.data && q.data.ok === true){ CUR = { slug: ST.slug, status: 'studying', name: ST.name, type: ST.type }; if(q.data.institution_members != null) d.institution_members = q.data.institution_members; }
    }
    MINE.add(ST.slug); changed();
    done(c, d);
    if(CARD && CARD.host) cardPanel(CARD.host, CARD.card);      // the panel on the card page shows the new state when the sheet is closed
  }
  async function submit(c, status){
    const go = document.getElementById('miGo'), err = document.getElementById('miErr'); go.disabled = true; err.hidden = true;
    const r = await rpc('member_join_batch', { p_slug: ST.slug, p_level: c.level, p_year: c.year, p_status: status, p_ref: refCode() });
    go.disabled = false;
    const d = r.data;
    if(r.error || !d){ err.textContent = 'এখন যুক্ত করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।'; err.hidden = false; return; }
    if(d.ok === true) return afterJoin(c, d, status);
    if(d.error === 'NOT_SIGNED_IN'){ ask(); return; }
    if(d.error === 'ONE_PER_LEVEL'){
      const mine = (ST.list || []).find(x => x.level === c.level && x.mine);
      err.innerHTML = 'এই প্রতিষ্ঠানে ' + esc(LVN[c.level] || c.level) + ' স্তরে আপনি আগেই ' + (mine ? '<a href="' + bpath(mine.level, mine.year) + '"><b>' + bn(mine.year) + ' ব্যাচে</b></a> ' : 'অন্য একটা ব্যাচে ') + 'আছেন। একটা স্তরে একটাই ব্যাচ থাকা যায়। ভুল সাল বেছে থাকলে ওই ব্যাচ ছেড়ে এখানে আসুন।';
      err.hidden = false; return;
    }
    err.textContent = ERR[d.error] || 'যুক্ত করা গেল না। একটু পরে আবার চেষ্টা করুন।'; err.hidden = false;
  }
  const refCode = () => { try{ return (new URLSearchParams(location.search).get('r') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || null; }catch(e){ return null; } };

  function done(c, d){
    const n = Number(d.institution_members) || 0;
    COUNTS.set(ST.slug, n); MINE.add(ST.slug); paint();
    const bp = bpath(c.level, c.year);
    body('<div class="mi-done"><div class="mi-tick">' + ICON_CHECK.replace('width="13" height="13"', 'width="30" height="30"') + '</div><h2>যুক্ত হলেন!</h2>' +
      '<p><b>' + esc(ST.name) + '</b><br>' + bn(c.year) + ' ব্যাচ · ' + esc(LVN[c.level] || c.level) + '</p>' +
      '<div class="mi-nums"><div><b>' + bn(d.seq) + '</b><small>আপনি এই ব্যাচের</small></div><div><b>' + bn(n) + '</b><small>জন যুক্ত প্রতিষ্ঠানে</small></div></div>' +
      (d.created ? '<p class="mi-note">আপনি এই ব্যাচের আহ্বায়ক। বন্ধুদের ডাকলে ব্যাচ বড় হবে।</p>' : '') +
      (CUR.slug === ST.slug ? '<p class="mi-note ok">এটাই এখন আপনার প্রতিষ্ঠান।</p>' : !CUR.slug ? '<button type="button" class="mi-sec mi-cur" id="miCur">এখন কোথায় পড়েন? জানিয়ে রাখুন</button>' : '') +
      '<div class="mi-act col"><a class="mi-pri" href="' + bp + '#invite">বন্ধুদের ডাকুন</a><a class="mi-sec" href="' + bp + '">ব্যাচের পাতা খুলুন</a><a class="mi-sec" href="/card">আপনার শিক্ষিত কার্ড বানান</a><button type="button" class="mi-link" id="miClose">এখনই না</button></div></div>');
    document.getElementById('miClose').onclick = close;
    const cur = document.getElementById('miCur'); if(cur) cur.onclick = () => { ST.slug = ''; ST.name = ''; ST.type = ''; ST.fromPick = false; showPick('current'); };
  }


  /* ---------- the card page: after a download, the batch and the current institution the card itself implies ----------
     card = { batch: { slug, name, year, status } | null, cur: { slug, name, type, status } | null }, built by card.html from the SSC row and the "still studying" tick.
     One tap each: nothing to type, the year and the status come from the card. A signed-out person goes through the Google sign-in and the tapped action is done on the way back. */
  let CARD = null;
  const asciiDigits = x => String(x == null ? '' : x).replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
  async function cardPanel(host, card){
    if(!host) return;
    CARD = { host, card };
    host.hidden = true; host.innerHTML = '';
    const b = card && card.batch, c = card && card.cur;
    if(!b && !c) return;
    if(!signedIn()){ CUR = {}; MINE = new Set(); }          // signed out: nothing is remembered from an earlier session
    const out = signedIn() ? await loadMineQuiet() : true;
    if(!out) return;                                   // a failed read: say nothing rather than something wrong
    const [lst] = await Promise.all([b ? rpc('institution_batches', { p_slug: b.slug }) : Promise.resolve({ data: [] })]);
    const found = !lst.error && Array.isArray(lst.data) ? lst.data.find(x => x.level === 'ssc' && x.year === b.year) : null;
    const known = !lst.error;
    const showC = !!c && CUR.slug !== c.slug && !CUR.slug;     // never overwrite a current institution the person already chose
    const rows = [];
    if(b){
      const inB = !!(found && found.mine);
      rows.push('<div class="mi-cp-r"><div class="mi-cp-t"><b>' + esc(b.name) + '</b><small>SSC · ' + bn(b.year) + ' ব্যাচ' + (known ? (found && found.members ? ' · <em>' + bn(found.members) + ' জন আগে থেকেই আছেন</em>' : ' · এখনও কেউ নেই') : '') + '</small></div>' +
        (inB ? '<a class="mi-cp-ok" href="/b/' + encodeURIComponent(b.slug) + '/ssc-' + b.year + '">' + ICON_CHECK + ' আপনি আছেন</a>'
             : '<button type="button" class="mi-cp-b" data-cp="batch">' + (signedIn() ? (found ? 'যোগ দিন' : 'ব্যাচ খুলি') : 'Google দিয়ে যোগ দিন') + '</button>') + '</div>');
    }
    if(showC) rows.push('<div class="mi-cp-r"><div class="mi-cp-t"><b>বর্তমান প্রতিষ্ঠান: ' + esc(c.name) + '</b><small>ঠিক থাকলে জানিয়ে রাখুন, শুধু আপনি দেখবেন</small></div><button type="button" class="mi-cp-b ghost" data-cp="cur">' + (signedIn() ? 'হ্যাঁ, ঠিক' : 'Google দিয়ে জানান') + '</button></div>');
    if(!rows.length) return;
    host.innerHTML = '<div class="mi-cp-h">' + (b ? 'আপনার ব্যাচের বন্ধুরা কি আগে থেকেই আছে?' : 'আপনার প্রতিষ্ঠান') + '</div>' + rows.join('');
    host.hidden = false;
    track('mi_card_shown', { b: b ? 1 : 0, c: showC ? 1 : 0, found: found ? 1 : 0 });
    host.querySelectorAll('[data-cp]').forEach(btn => { btn.onclick = () => cardAct(btn.getAttribute('data-cp'), btn); });
  }
  async function loadMineQuiet(){            // the same read as loadMine, without the invitation; false when either answer failed
    const [r, c] = await Promise.all([rpc('batch_me'), rpc('member_institution_me')]);
    if(r.error || !Array.isArray(r.data)) return false;
    CUR = (!c.error && c.data && c.data.slug) ? c.data : {};
    MINE = new Set(r.data.map(x => x.slug).concat(CUR.slug ? [CUR.slug] : []));
    return true;
  }
  async function cardAct(kind, btn){
    const card = CARD && CARD.card; if(!card) return;
    track('mi_card_tap', { k: kind });
    if(!signedIn()){
      try{ localStorage.setItem(INTENT, JSON.stringify({ mode: 'card', act: kind, batch: card.batch || null, cur: card.cur || null, t: Date.now() })); }catch(e){}
      const m = MB(); if(!m){ location.href = '/member'; return; }
      track('mi_signin', {});
      m.signIn('৫ সেকেন্ড, পাসওয়ার্ড ছাড়াই। যুক্ত হওয়ার পর এই কার্ডের পাতাতেই ফিরে আসবেন, আপনার কার্ড তৈরিই থাকবে।', {
        title: kind === 'batch' ? 'আপনার ব্যাচে যোগ দিন' : 'আপনার প্রতিষ্ঠান জানিয়ে রাখুন', chip: (kind === 'batch' ? card.batch : card.cur).name, cta: 'Google দিয়ে চালিয়ে যান',
        perks: [['seat', 'ব্যাচের সদস্য নম্বর, একবার পেলে বদলায় না'], ['users', 'সহপাঠীরা আগে থেকেই থাকলে দেখবেন'], ['eye', 'কোথায় পড়েন, সেটা শুধু আপনি দেখেন']]
      });
      return;
    }
    if(btn) btn.disabled = true;
    if(kind === 'cur') await cardSetCurrent(card.cur, btn); else await quickJoin(card.batch);
    if(btn) btn.disabled = false;
  }
  async function cardSetCurrent(x, btn){
    const r = await rpc('member_set_institution', { p_slug: x.slug, p_status: x.status || 'studying' });
    if(r.error || !r.data || r.data.ok !== true){ if(btn){ btn.textContent = 'এখন হলো না, আবার চাপুন'; } return; }
    track('mi_current_set', { status: x.status || 'studying', from: 'card' });
    CUR = { slug: x.slug, status: x.status || 'studying', name: x.name, type: x.type || '' };
    if(CARD && CARD.host) cardPanel(CARD.host, CARD.card);
  }
  /* one tap: join (or open) the SSC batch the card implies, then the same success screen as the sheet */
  async function quickJoin(b){
    if(!ov) build();
    ST = { slug: b.slug, name: b.name || '', type: '', mode: 'current', list: null };
    ov.classList.add('show'); document.body.style.overflow = 'hidden';
    body(head('') + '<div class="mi-sk"><i></i><i></i><i></i></div>');
    const c = { level: 'ssc', year: b.year, label: bn(b.year) + ' ব্যাচ · ' + LVN.ssc, created: false };
    const status = b.status === 'studying' ? 'studying' : 'studied';
    const r = await rpc('member_join_batch', { p_slug: b.slug, p_level: 'ssc', p_year: b.year, p_status: status, p_ref: refCode() });
    const d = r.data;
    const fail = msg => { body(head('') + '<p class="mi-err">' + msg + '</p><div class="mi-act"><button type="button" class="mi-sec" id="miX">বন্ধ করুন</button><button type="button" class="mi-pri" id="miRetry">আবার চেষ্টা করুন</button></div>'); document.getElementById('miX').onclick = close; document.getElementById('miRetry').onclick = () => quickJoin(b); };
    if(r.error || !d){ fail('এখন যুক্ত করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।'); return; }
    if(d.ok === true){ c.created = !!d.created; return afterJoin(c, d, status); }
    if(d.error === 'NOT_SIGNED_IN'){ close(); cardAct('batch'); return; }
    if(d.error === 'ONE_PER_LEVEL'){ body(head('') + '<p class="mi-err">এই প্রতিষ্ঠানে SSC স্তরে আপনি আগেই অন্য একটা ব্যাচে আছেন। একটা স্তরে একটাই ব্যাচ থাকা যায়।</p><div class="mi-act col"><a class="mi-pri" href="/member">আমার ব্যাচগুলো দেখুন</a><button type="button" class="mi-link" id="miX">বন্ধ করুন</button></div>'); document.getElementById('miX').onclick = close; return; }
    fail(ERR[d.error] || 'যুক্ত করা গেল না। একটু পরে আবার চেষ্টা করুন।');
  }

  /* ---------- after the sign-in: come back to the same place ---------- */
  async function resume(){
    const m = MB(); if(!m) return; await m.ready();
    if(!signedIn()) return;
    let it = null; try{ it = JSON.parse(localStorage.getItem(INTENT) || 'null'); localStorage.removeItem(INTENT); }catch(e){}
    if(it && it.mode === 'card' && Date.now() - it.t < 30 * 60 * 1000){
      if(it.act === 'cur' && it.cur) await cardSetCurrent(it.cur); else if(it.batch) await quickJoin(it.batch);
      return;
    }
    if(it && (it.slug || it.pick) && Date.now() - it.t < 30 * 60 * 1000) open({ slug: it.slug || '', name: it.name, type: it.type, mode: it.mode });
  }

  const changed = () => { try{ document.dispatchEvent(new CustomEvent('myinst:change')); }catch(e){} };
  window.MyInst = { open, pick: () => open({ mode: 'current' }), decorate, fetchCounts, check: loadMine, cardPanel, asciiDigits, joinSsc: b => quickJoin(b) };
  const start = () => { if(!QUIET){ watch(); mountHero(); } const m = MB(); if(m){ m.ready().then(() => { if(!QUIET) loadMine(); resume(); }); m.onChange(() => { if(!QUIET) loadMine(); }); } };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
