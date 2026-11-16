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
  const bn = x => String(x).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const track = (n, p) => { try{ window.track && window.track(n, p || {}); }catch(e){} };
  const LEVELS = [['psc', 'প্রাথমিক (PSC)'], ['jsc', 'জুনিয়র (JSC)'], ['ssc', 'মাধ্যমিক (SSC)'], ['hsc', 'উচ্চ মাধ্যমিক (HSC)'], ['bachelor', 'স্নাতক'], ['masters', 'স্নাতকোত্তর']];
  const LVN = {}; LEVELS.forEach(l => { LVN[l[0]] = l[1]; });
  const STATUS = [['studied', 'পড়েছি'], ['studying', 'এখনও পড়ছি'], ['left_early', 'শেষ করতে পারিনি']];
  const INTENT = 'mi_intent';
  const NOW = new Date().getFullYear();
  const ICON_USERS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c0-3.2 2.6-5.5 6-5.5s6 2.3 6 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.2c2.7.1 4.5 1.9 4.5 4.3"/></svg>';
  const ICON_CHECK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  /* ---------- the numbers on the screen ---------- */
  const COUNTS = new Map();          // slug -> members
  const asked = new Set();
  let MINE = new Set();              // the slugs the signed-in member is already in
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
    if(!signedIn()){ MINE = new Set(); paint(); return; }
    const r = await rpc('batch_me');
    MINE = new Set(Array.isArray(r.data) ? r.data.map(x => x.slug) : []);
    paint();
    if(!r.error && Array.isArray(r.data)) nudge();      // only when the answer is real: a failed call must not look like "no institution"
  }
  const countText = slug => { const n = COUNTS.get(slug); if(n == null) return ''; return n > 0 ? ICON_USERS + '<span>' + bn(n) + ' জন যুক্ত</span>' : '<span>এখনও কেউ নেই, প্রথম হোন</span>'; };
  function paint(){
    document.querySelectorAll('[data-mi-count]').forEach(el => { el.innerHTML = countText(el.getAttribute('data-mi-count')); });
    document.querySelectorAll('[data-mi-join]').forEach(el => {
      const s = el.getAttribute('data-mi-join'), inn = MINE.has(s);
      el.classList.toggle('mi-in', inn);
      el.innerHTML = inn ? ICON_CHECK + ' যুক্ত আছেন' : 'ব্যাচ খুঁজুন';
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
      const row = document.createElement('div'); row.className = 'mi-row';
      row.innerHTML = '<span class="mi-count" data-mi-count="' + esc(slug) + '">' + countText(slug) + '</span><span class="mi-join" role="button" tabindex="0" data-mi-join="' + esc(slug) + '">ব্যাচ খুঁজুন</span>';
      const foot = a.querySelector('.ic-foot'); if(foot) a.insertBefore(row, foot); else a.appendChild(row);
      const go = e => { e.preventDefault(); e.stopPropagation(); open({ slug, name }); };
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
      box.innerHTML = '<span class="mi-count mi-big" data-mi-count="' + esc(slug) + '"></span><button type="button" class="mi-btn" data-mi-join="' + esc(slug) + '">আমার ব্যাচ খুঁজুন</button><small>আপনি এখানে পড়েছেন বা পড়ছেন? আপনার ব্যাচের সহপাঠীরা আগে থেকেই এখানে থাকতে পারেন।</small>';
      host.parentNode.insertBefore(box, host.nextSibling);
      box.querySelector('.mi-btn').addEventListener('click', () => open({ slug, name: name.textContent.trim() }));
      paint(); fetchCounts([slug]);
    }, 250);
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
  const head = (sub) => '<div class="mi-h"><span class="mi-kick">আমার ব্যাচ</span><h2>' + esc(ST.name || 'প্রতিষ্ঠান') + '</h2>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>';

  function ask(){
    try{ localStorage.setItem(INTENT, JSON.stringify({ slug: ST.slug, name: ST.name, pick: !ST.slug, t: Date.now() })); }catch(e){}
    const m = MB(); if(!m){ location.href = '/member'; return; }
    track('mi_signin', {});
    m.signIn('৫ সেকেন্ড, পাসওয়ার্ড ছাড়াই। যুক্ত হওয়ার পর এই পাতাতেই ফিরে আসবেন।', {
      title: 'আপনার ব্যাচ খুঁজে নিন', chip: ST.name || 'আমার ব্যাচ', cta: 'Google দিয়ে চালিয়ে যান',
      perks: [['seat', 'আপনার ব্যাচের সদস্য নম্বর, একবার পেলে বদলায় না'], ['users', 'ব্যাচের সহপাঠীরা আগে থেকেই এখানে থাকলে সঙ্গে সঙ্গে দেখবেন'], ['eye', 'নাম-ছবি শুধু ব্যাচের সদস্যরা দেখে, আর কেউ না']]
    });
  }

  async function open(o){
    if(!ov) build();
    ST = { slug: o.slug || '', name: o.name || '', list: null };
    track('mi_open', {});
    if(!signedIn()){ const m = MB(); if(m && m.ready) await m.ready(); }
    if(!signedIn()){ ask(); return; }
    ov.classList.add('show'); document.body.style.overflow = 'hidden';
    if(!ST.slug){ showPick(); return; }
    body(head('') + '<div class="mi-sk"><i></i><i></i><i></i></div>');
    await showList();
  }

  /* the pick step: find your institution by name (the directory search), then the list of its batches */
  function showPick(){
    body('<div class="mi-h"><span class="mi-kick">আমার ব্যাচ</span><h2>আপনার ব্যাচ খুঁজে নিন</h2><p>আগে আপনার স্কুল, কলেজ বা মাদ্রাসা বেছে নিন, তারপর দেখবেন আপনার ব্যাচের কে কে আগে থেকেই আছে। এটা না করলেও সাইটের সবকিছু আগের মতোই ব্যবহার করতে পারবেন।</p></div>' +
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
      ST.slug = x.desired_slug; ST.name = x.institution_name; fetchCounts([x.desired_slug]);
      body(head('') + '<div class="mi-sk"><i></i><i></i><i></i></div>'); showList();
    });
    document.getElementById('miSkip').onclick = () => { noteSkip(); close(); };
  }

  /* the invitation after a sign-in: never a wall. "পরে" backs off (7 days, then 30 days, then it stops by itself). */
  const NK = 'mi_nudge';
  const nstate = () => { try{ return JSON.parse(localStorage.getItem(NK) || 'null') || { n: 0, t: 0 }; }catch(e){ return { n: 0, t: 0 }; } };
  const nudgeDue = () => { const s = nstate(); return s.n < 3 && (s.n === 0 || Date.now() - s.t > (s.n === 1 ? 7 : 30) * 864e5); };
  function noteSkip(){ const s = nstate(); try{ localStorage.setItem(NK, JSON.stringify({ n: s.n + 1, t: Date.now() })); }catch(e){} }
  function nudge(){
    if(!signedIn() || MINE.size > 0 || !nudgeDue() || document.getElementById('miNudge')) return;
    setTimeout(() => {
      if(!signedIn() || MINE.size > 0 || !nudgeDue() || document.getElementById('miNudge') || (ov && ov.classList.contains('show'))) return;
      const n = document.createElement('div'); n.id = 'miNudge'; n.className = 'mi-nudge'; n.setAttribute('role', 'region'); n.setAttribute('aria-label', 'আপনার ব্যাচ খুঁজে নিন');
      n.innerHTML = '<div class="mi-nt"><b>আপনার ব্যাচের বন্ধুরা কি আগে থেকেই আছে?</b><small>স্কুল-কলেজ বেছে আপনার ব্যাচটা খুঁজে নিন।</small></div><button type="button" class="mi-nb">ব্যাচ খুঁজুন</button><button type="button" class="mi-nx" aria-label="পরে করব">×</button>';
      document.body.appendChild(n);
      n.querySelector('.mi-nb').onclick = () => { n.remove(); track('mi_nudge_go', {}); open({}); };
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
    const yrs = []; for(let y = NOW + 1; y >= 1970; y--) yrs.push(y);
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
  async function submit(c, status){
    const go = document.getElementById('miGo'), err = document.getElementById('miErr'); go.disabled = true; err.hidden = true;
    const r = await rpc('member_join_batch', { p_slug: ST.slug, p_level: c.level, p_year: c.year, p_status: status, p_ref: refCode() });
    go.disabled = false;
    const d = r.data;
    if(r.error || !d){ err.textContent = 'এখন যুক্ত করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।'; err.hidden = false; return; }
    if(d.ok === true){ track('mi_joined', { created: !!d.created }); return done(c, d); }
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
      '<div class="mi-act col"><a class="mi-pri" href="' + bp + '#invite">বন্ধুদের ডাকুন</a><a class="mi-sec" href="' + bp + '">ব্যাচের পাতা খুলুন</a><a class="mi-sec" href="/card">আপনার শিক্ষিত কার্ড বানান</a><button type="button" class="mi-link" id="miClose">এখনই না</button></div></div>');
    document.getElementById('miClose').onclick = close;
  }

  /* ---------- after the sign-in: come back to the same place ---------- */
  async function resume(){
    const m = MB(); if(!m) return; await m.ready();
    if(!signedIn()) return;
    let it = null; try{ it = JSON.parse(localStorage.getItem(INTENT) || 'null'); localStorage.removeItem(INTENT); }catch(e){}
    if(it && (it.slug || it.pick) && Date.now() - it.t < 30 * 60 * 1000) open({ slug: it.slug || '', name: it.name });
  }

  window.MyInst = { open, pick: () => open({}), decorate, fetchCounts, check: loadMine };
  const start = () => { watch(); mountHero(); const m = MB(); if(m){ m.ready().then(() => { loadMine(); resume(); }); m.onChange(() => loadMine()); } };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
