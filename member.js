/* Protishthan সদস্য (member) — Google sign-in for ordinary visitors.
   Loaded on every general page (home, card, results, profile, member). Needs supabase-js loaded first.
   It uses its own browser session ('prot-member'), so it never mixes with the institution /
   teacher / guardian / student / partner logins that live on the service pages. */
(function(){
  'use strict';
  if(window.Protishthan && window.Protishthan.member) return;
  const P = window.Protishthan = window.Protishthan || {};
  const SB_URL = 'https://eoqeeuujvpydhmfteqqj.supabase.co', SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvcWVldXVqdnB5ZGhtZnRlcXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTM2NTgsImV4cCI6MjA5NzE4OTY1OH0.xuC-_euxf0DTqTpD5b8_6vgnkjeJjZIFqdKw-Bq3YbU';
  const sb = supabase.createClient(SB_URL, SB_KEY, { auth: { storageKey: 'prot-member' } });

  let ME = null, SAVED = null, resolveReady;
  const READY = new Promise(r => resolveReady = r);
  const listeners = [];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const ls = { get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }, del(k){ try{ localStorage.removeItem(k); }catch(e){} } };

  /* ---------------- styles ---------------- */
  const css = document.createElement('style');
  css.textContent = `
button.btn-ghost-nav,button.btn-primary-nav{border:none;cursor:pointer;font-family:inherit}
button.btn-ghost-nav{background:none}
button.btn-primary-nav{background:linear-gradient(135deg,#1A56DB,#3B6FE0)}
.mb-wrap{position:relative}
.mb-av{width:40px;height:40px;border-radius:50%;border:2px solid rgba(255,255,255,.4);padding:0;background:linear-gradient(135deg,#2563EB,#7C3AED);color:#fff;font:700 16px 'Hind Siliguri','Inter',sans-serif;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center}
.mb-av img{width:100%;height:100%;object-fit:cover;display:block}
.mb-light .mb-av{border-color:#E2E8F0}
.mb-av{text-decoration:none}
.mb-bar{display:inline-flex;align-items:center;gap:8px}
.mb-ic{position:relative;width:42px;height:42px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer;color:#fff;text-decoration:none;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);transition:background .15s,transform .15s}
.mb-ic:hover{background:rgba(255,255,255,.2);transform:translateY(-1px)}
.mb-dot{position:absolute;right:9px;top:9px;width:8px;height:8px;border-radius:50%;background:#F59E0B;box-shadow:0 0 0 2px rgba(15,32,72,.9);display:none}
.mb-prof{display:inline-flex;align-items:center;gap:9px;height:42px;padding:4px 16px 4px 4px;border-radius:100px;text-decoration:none;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);font:700 14px 'Hind Siliguri','Inter',sans-serif;white-space:nowrap;transition:background .15s,transform .15s}
.mb-prof:hover{background:rgba(255,255,255,.22);transform:translateY(-1px)}
.mb-prof.on{background:rgba(255,255,255,.95);color:#1A56DB;border-color:#fff}
.mb-pa{width:32px;height:32px;border-radius:50%;flex:none;overflow:hidden;display:flex;align-items:center;justify-content:center;font:800 14px 'Inter','Hind Siliguri',sans-serif;color:#fff;background:linear-gradient(135deg,#3B82F6,#7C3AED)}
.mb-pa img{width:100%;height:100%;object-fit:cover;display:block}
.mb-nw{position:relative}
.mb-pop{position:absolute;right:-6px;top:52px;width:316px;background:#fff;color:#0F172A;border:1px solid #E2E8F0;border-radius:18px;box-shadow:0 20px 50px rgba(15,23,42,.22);padding:14px;display:none;z-index:600;font-family:'Hind Siliguri','Inter',sans-serif;text-align:left}
.mb-pop.open{display:block}
.mb-pop h4{font-size:15px;margin:0 0 10px;display:flex;align-items:center;justify-content:space-between}
.mb-pop h4 i{font-style:normal;font-size:10.5px;font-weight:700;background:#FEF3C7;color:#92400E;border-radius:100px;padding:1px 9px}
.mb-pop .empty{display:flex;gap:12px;align-items:flex-start;padding:12px;border-radius:14px;background:#F8FAFF;border:1px dashed #E2E8F0}
.mb-pop .empty span{width:38px;height:38px;border-radius:12px;background:#fff;border:1px solid #E2E8F0;display:flex;align-items:center;justify-content:center;color:#1A56DB;flex:none}
.mb-pop .empty b{display:block;font-size:13.5px;line-height:1.35}
.mb-pop .empty p{font-size:12.5px;color:#64748B;margin:2px 0 0;line-height:1.5}
@media(max-width:700px){.mb-pt{display:none}.mb-prof{padding:4px;width:42px;justify-content:center}.mb-bar{gap:6px}.mb-ic,.mb-prof{height:38px}.mb-ic{width:38px}.mb-pa{width:30px;height:30px}.mb-pop{position:fixed;left:12px;right:12px;top:78px;width:auto}}
@media(max-width:400px){.mb-bar .mb-partner{display:none}}
.mb-ov{position:fixed;inset:0;z-index:2000;background:rgba(10,22,40,.62);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;padding:18px}
.mb-ov.show{display:flex}
.mb-box{width:100%;max-width:380px;background:#fff;border-radius:24px;padding:30px 26px 22px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.4);position:relative;font-family:'Hind Siliguri','Inter',sans-serif;color:#0F172A;max-height:92vh;overflow:auto}
.mb-x{position:absolute;right:12px;top:12px;width:34px;height:34px;border:none;border-radius:50%;background:#F1F5F9;color:#475569;font-size:18px;cursor:pointer;line-height:1}
.mb-logo{width:52px;height:52px;border-radius:16px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#2563EB,#7C3AED);box-shadow:0 10px 24px rgba(37,99,235,.35)}
.mb-box h2{font-size:22px;line-height:1.25;margin:0 0 6px;font-weight:700;letter-spacing:-.2px}
.mb-box p.sub{font-size:14px;color:#64748B;margin:0 0 18px}
.mb-why{font-size:13px;font-weight:600;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:8px 12px;margin-bottom:14px}
.mb-perks{list-style:none;margin:0 0 20px;padding:14px 16px;background:#F8FAFC;border-radius:14px;text-align:left}
.mb-perks li{display:flex;gap:11px;align-items:center;font-size:14px;color:#334155;margin-bottom:10px;line-height:1.4}
.mb-perks li:last-child{margin-bottom:0}
.mb-perks i{flex:none;width:26px;height:26px;border-radius:8px;background:#EEF3FF;color:#1A56DB;display:flex;align-items:center;justify-content:center;font-style:normal}
.mb-google{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:13px;border-radius:14px;border:1.5px solid #CBD5E1;background:#fff;font:700 15px 'Hind Siliguri','Inter',sans-serif;color:#0F172A;cursor:pointer;transition:background .15s,box-shadow .15s}
.mb-google:hover{background:#F8FAFC;box-shadow:0 4px 14px rgba(15,23,42,.1)}
.mb-google:disabled{opacity:.6;cursor:default}
.mb-fine{font-size:12px;color:#94A3B8;text-align:center;margin-top:14px;line-height:1.55}
.mb-fine a{color:#64748B;text-decoration:underline}
.mb-err{display:none;background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;border-radius:10px;padding:8px 12px;font-size:12.5px;margin-top:10px}
.mb-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);background:#0F172A;color:#fff;padding:11px 18px;border-radius:12px;font:600 13.5px 'Hind Siliguri','Inter',sans-serif;opacity:0;pointer-events:none;transition:all .25s;z-index:2100;max-width:92vw;text-align:center}
.mb-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
`;
  document.head.appendChild(css);

  /* ---------------- small helpers ---------------- */
  let toastEl, toastT;
  function toast(msg){
    if(!toastEl){ toastEl = document.createElement('div'); toastEl.className = 'mb-toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  /* ---------------- sign-in popup ---------------- */
  const GOOGLE_G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.5 7l7.3 5.7c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.2 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
  let ov;
  function buildModal(){
    ov = document.createElement('div'); ov.className = 'mb-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="mb-box">
      <button type="button" class="mb-x" aria-label="বন্ধ করুন">×</button>
      <div class="mb-logo" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v5"/></svg></div>
      <h2>Protishthan-এ স্বাগতম</h2>
      <p class="sub" id="mbSub">৫ সেকেন্ড, পাসওয়ার্ড ছাড়াই।</p>
      <ul class="mb-perks">
        <li><i><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></i>পছন্দের প্রতিষ্ঠান সেভ করুন</li>
        <li><i><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h4M7 14h7"/></svg></i>শিক্ষিত কার্ড সবসময় সাথে থাকবে</li>
        <li><i><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg></i>ভর্তি ও ফলাফলের খবর · শীঘ্রই</li>
      </ul>
      <button type="button" class="mb-google" id="mbGoogle">${GOOGLE_G}<span>Google দিয়ে চালিয়ে যান</span></button>
      <div class="mb-err" id="mbErr"></div>
      <div class="mb-fine">আমরা শুধু আপনার নাম ও ইমেইল রাখি। চালিয়ে গেলে <a href="privacy.html">গোপনীয়তা নীতি</a> ও <a href="terms.html">শর্ত</a> মানা হয় (বয়স ১৩+)।</div>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if(e.target === ov) closeModal(); });
    ov.querySelector('.mb-x').addEventListener('click', closeModal);
    document.getElementById('mbGoogle').addEventListener('click', google);
    document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });
  }
  function openModal(reason){
    if(!ov) buildModal();
    document.getElementById('mbSub').textContent = reason || '৫ সেকেন্ড, পাসওয়ার্ড ছাড়াই।';
    document.getElementById('mbErr').style.display = 'none';
    document.getElementById('mbGoogle').disabled = false;
    ov.classList.add('show'); document.body.style.overflow = 'hidden';
  }
  function closeModal(){ if(ov){ ov.classList.remove('show'); document.body.style.overflow = ''; } }

  async function google(){
    const btn = document.getElementById('mbGoogle'), err = document.getElementById('mbErr');
    btn.disabled = true; err.style.display = 'none';
    // if the Google provider isn't switched on yet, say so nicely instead of sending the visitor to a raw error page
    try{
      const st = await fetch(SB_URL + '/auth/v1/settings', { headers: { apikey: SB_KEY } }).then(r => r.json());
      if(st && st.external && st.external.google === false){ btn.disabled = false; err.textContent = 'Google দিয়ে যোগ দেওয়া এখনো চালু হয়নি — একটু পরে আবার চেষ্টা করুন।'; err.style.display = 'block'; return; }
    }catch(e){}
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname + location.search, queryParams: { prompt: 'select_account' } } });
    if(error){ btn.disabled = false; err.textContent = 'এখন চালু করা যাচ্ছে না: ' + error.message; err.style.display = 'block'; }
  }

  /* ---------------- session ---------------- */
  async function loadMember(session){
    if(!session){ ME = null; return null; }
    const { data, error } = await sb.rpc('ensure_member');
    if(error){ console.warn('ensure_member:', error.message); ME = { user_id: session.user.id, display_name: (session.user.user_metadata || {}).full_name || session.user.email, avatar_url: null, email: session.user.email, _fallback: true }; }
    else ME = data;
    return ME;
  }
  async function refresh(session){
    await loadMember(session);
    SAVED = null;
    render();
    listeners.forEach(cb => { try{ cb(ME); }catch(e){ console.error(e); } });
    return ME;
  }
  sb.auth.getSession().then(async ({ data: { session } }) => {
    await refresh(session);
    resolveReady(ME);
    // finish a "save" the visitor started before being sent to Google
    const pend = ls.get('prot_pending_save');
    if(ME && pend){ ls.del('prot_pending_save'); try{ const p = JSON.parse(pend); if(p.path === location.pathname){ await toggleSaved(p.id, true); toast('সেভ করা হয়েছে ★'); } }catch(e){} }
  });
  sb.auth.onAuthStateChange((evt, session) => {
    if(evt === 'SIGNED_OUT'){ ME = null; SAVED = null; render(); listeners.forEach(cb => cb(null)); }
    else if(evt === 'SIGNED_IN' && !ME){ setTimeout(() => refresh(session).then(() => resolveReady(ME)), 0); }
  });

  /* ---------------- nav slots ---------------- */
  function initial(m){ return String((m && (m.display_name || m.email)) || '?').trim().charAt(0).toUpperCase(); }
  function render(){
    document.querySelectorAll('[data-member-slot]').forEach(slot => {
      const light = slot.dataset.memberSlot === 'light';
      if(!ME){
        slot.innerHTML = light
          ? '<button type="button" class="tbtn mb-join" style="background:#1A56DB;border-color:#1A56DB;color:#fff"><span>যোগ দিন</span></button>'
          : '<button type="button" class="btn-ghost-nav mb-login">লগইন</button><button type="button" class="btn-primary-nav mb-join">যোগ দিন</button>';
        slot.querySelectorAll('.mb-join,.mb-login').forEach(b => b.addEventListener('click', () => openModal()));
        return;
      }
      const face = ME.avatar_url ? `<img src="${esc(ME.avatar_url)}" alt="">` : esc(initial(ME));
      const onProfile = /\/member(\.html)?$/.test(location.pathname);
      if(light){
        slot.innerHTML = `<span class="mb-wrap mb-light"><a class="mb-av" href="member.html" aria-label="আমার প্রোফাইল" title="আমার প্রোফাইল">${face}</a></span>`;
      } else {
        slot.innerHTML = `<span class="mb-bar">
          <a class="mb-ic mb-partner" href="partner.html" aria-label="Protishthan Partner" title="Protishthan Partner"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg></a>
          <span class="mb-nw"><button type="button" class="mb-ic mb-bell" aria-label="নোটিফিকেশন" aria-haspopup="true" title="নোটিফিকেশন"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg><i class="mb-dot"></i></button>
            <div class="mb-pop" role="dialog" aria-label="নোটিফিকেশন"><h4>নোটিফিকেশন <i>শীঘ্রই</i></h4><div class="empty"><span><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg></span><div><b>এখনো কোনো নোটিফিকেশন নেই</b><p>সেভ করা প্রতিষ্ঠানের ভর্তি, নোটিস আর ফলাফলের খবর এখানে আসবে।</p></div></div></div></span>
          <a class="mb-prof${onProfile ? ' on' : ''}" href="member.html" aria-label="আমার প্রোফাইল" title="${esc(ME.display_name || 'আমার প্রোফাইল')}"><span class="mb-pa">${face}</span><span class="mb-pt">আমার প্রোফাইল</span></a>
        </span>`;
        const bell = slot.querySelector('.mb-bell'), pop = slot.querySelector('.mb-pop');
        bell.addEventListener('click', e => { e.stopPropagation(); pop.classList.toggle('open'); });
      }
      // on the profile page itself the profile button just scrolls to the top
      const prof = slot.querySelector('.mb-av, .mb-prof');
      if(prof) prof.addEventListener('click', e => { if(onProfile){ e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
    });
  }
  document.addEventListener('click', e => { if(!e.target.closest('.mb-nw')) document.querySelectorAll('.mb-pop.open').forEach(p => p.classList.remove('open')); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') document.querySelectorAll('.mb-pop.open').forEach(p => p.classList.remove('open')); });
  document.addEventListener('DOMContentLoaded', render);
  if(document.readyState !== 'loading') render();

  async function signOut(){ await sb.auth.signOut(); location.reload(); }

  /* ---------------- saved institutions ---------------- */
  async function loadSaved(){
    if(!ME) return new Set();
    if(SAVED) return SAVED;
    const { data } = await sb.from('saved_institutions').select('listing_id');
    SAVED = new Set((data || []).map(r => r.listing_id));
    return SAVED;
  }
  async function isSaved(id){ return (await loadSaved()).has(id); }
  // returns true if the institution is saved afterwards; null if the visitor had to sign in first
  async function toggleSaved(id, forceOn){
    if(!ME){ ls.set('prot_pending_save', JSON.stringify({ id, path: location.pathname })); openModal('এই প্রতিষ্ঠান সেভ করতে যোগ দিন'); return null; }
    const set = await loadSaved();
    const on = forceOn === true ? true : !set.has(id);
    if(on){ const { error } = await sb.from('saved_institutions').upsert({ user_id: ME.user_id, listing_id: id }, { onConflict: 'user_id,listing_id' }); if(error){ toast('সেভ হয়নি: ' + error.message); return set.has(id); } set.add(id); }
    else { const { error } = await sb.from('saved_institutions').delete().match({ user_id: ME.user_id, listing_id: id }); if(error){ toast('সরানো যায়নি: ' + error.message); return set.has(id); } set.delete(id); }
    return on;
  }

  // change the signed-in member's own name / picture (RLS + column grants allow only these two fields)
  async function updateProfile(patch){
    if(!ME) throw new Error('NOT_SIGNED_IN');
    const upd = {};
    if('display_name' in patch) upd.display_name = patch.display_name;
    if('avatar_url' in patch) upd.avatar_url = patch.avatar_url;
    const { data, error } = await sb.from('members').update(upd).eq('user_id', ME.user_id).select().single();
    if(error) throw error;
    ME = data; render();
    listeners.forEach(cb => { try{ cb(ME); }catch(e){ console.error(e); } });
    return ME;
  }

  P.member = {
    sb, ready: () => READY, current: () => ME,
    onChange(cb){ listeners.push(cb); },
    signIn: openModal, signOut, toast, esc, updateProfile,
    saved: { has: isSaved, toggle: toggleSaved, list: loadSaved }
  };
})();
