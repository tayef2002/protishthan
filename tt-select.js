/* ভাইয়া-আপু: the card-style dropdown (the same look as the home page filters: a search box, an "all" row, option cards in two columns).
   It wraps a normal <select>, which stays in the page (hidden) as the single source of truth: the page code keeps reading and setting select.value, filling its options,
   disabling it and marking it aria-invalid, and the dropdown follows. Nothing is sent anywhere.
   TTSelect.enhance(select, { search: 'placeholder text' (omit for no search box), allLabel: 'the row that clears the choice' (omit if a choice is required), float: true (opens over the page; a bottom sheet on a phone) }) */
(function(root){
  'use strict';
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var VAL = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  var CHEV = '<svg class="tts-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var LENS = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  var openOne = null;

  function enhance(sel, o){
    if(!sel) return null;
    if(sel._tts) return sel._tts;
    o = o || {};
    sel.classList.add('tts-native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    var lab = sel.id ? document.querySelector('label[for="' + sel.id + '"]') : null;
    var wrap = document.createElement('div');
    wrap.className = 'tts' + (o.float ? ' tts-float' : ' tts-field');
    wrap.innerHTML = '<button type="button" class="tts-btn" aria-haspopup="listbox" aria-expanded="false"' + (sel.id ? ' id="' + esc(sel.id) + '-btn"' : '') + '><span class="tts-val"></span>' + CHEV + '</button>' +
      '<div class="tts-bd"></div>' +
      '<div class="tts-panel" role="listbox">' + (o.search ? '<div class="tts-search">' + LENS + '<input type="text" autocomplete="off" placeholder="' + esc(o.search) + '" aria-label="' + esc(o.search) + '"></div>' : '') + '<div class="tts-list"></div></div>';
    sel.insertAdjacentElement('afterend', wrap);
    var btn = wrap.querySelector('.tts-btn'), val = wrap.querySelector('.tts-val'), list = wrap.querySelector('.tts-list'), input = wrap.querySelector('.tts-search input');

    function cur(){ return sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null; }
    function isOpen(){ return wrap.classList.contains('open'); }
    function row(v, text, all){
      var on = sel.value === v;
      return '<button type="button" role="option" class="tts-opt' + (all ? ' all' : '') + (on ? ' sel' : '') + '" data-v="' + esc(v) + '" aria-selected="' + (on ? 'true' : 'false') + '"><span class="tts-opt-name">' + esc(text) + '</span>' + (on ? '<span class="tts-tick" aria-hidden="true">✓</span>' : '') + '</button>';
    }
    function render(q){
      var query = String(q || '').trim().toLowerCase(), opts = [].slice.call(sel.options), h = '';
      var items = opts.filter(function(x){ return x.value !== '' && (!query || x.text.toLowerCase().indexOf(query) > -1); });
      if(o.allLabel && !query) h += row('', o.allLabel, true);
      if(items.length) h += items.map(function(x){ return row(x.value, x.text, false); }).join('');
      else h += '<div class="tts-empty">' + (query ? '“' + esc(q) + '” নামে কিছু পাওয়া যায়নি' : 'এখানে বাছার মতো কিছু নেই') + '</div>';
      list.innerHTML = h;
    }
    function refresh(){
      var c = cur();
      val.textContent = c ? c.text : '';
      wrap.classList.toggle('empty', !sel.value);
      btn.disabled = !!sel.disabled;
      if(sel.getAttribute('aria-invalid') === 'true') btn.setAttribute('aria-invalid', 'true'); else btn.removeAttribute('aria-invalid');
      btn.setAttribute('aria-label', (lab ? lab.textContent.trim() + ': ' : '') + (c ? c.text : ''));
      if(sel.disabled && isOpen()) close(); else if(isOpen()) render(input ? input.value : '');
    }
    function open(){
      if(btn.disabled) return;
      if(openOne && openOne !== api) openOne.close();
      openOne = api; wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
      if(input) input.value = '';
      render('');
      var fine = root.matchMedia && root.matchMedia('(hover:hover) and (pointer:fine)').matches;
      var on = list.querySelector('.tts-opt.sel') || list.querySelector('.tts-opt');
      if(input && fine) input.focus({ preventScroll: true }); else if(on) on.focus({ preventScroll: true });
      if(on) on.scrollIntoView({ block: 'nearest' });
      // inside a scrolling dialog or page, bring the whole card into view
      setTimeout(function(){ if(isOpen() && !wrap.classList.contains('tts-float')) wrap.querySelector('.tts-panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 40);
    }
    function close(){
      wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); if(openOne === api) openOne = null;
      [].forEach.call(list.querySelectorAll('.kb'), function(x){ x.classList.remove('kb'); });
    }
    function pick(v){
      VAL.set.call(sel, v); refresh();
      sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true }));
      close(); btn.focus({ preventScroll: true });
    }
    function move(dir){
      var opts = [].slice.call(list.querySelectorAll('.tts-opt')); if(!opts.length) return;
      var i = opts.findIndex(function(x){ return x.classList.contains('kb'); }), act = opts.indexOf(document.activeElement);
      if(i < 0 && act > -1) i = act;
      i = i < 0 ? (dir > 0 ? 0 : opts.length - 1) : (i + dir + opts.length) % opts.length;
      opts.forEach(function(x){ x.classList.remove('kb'); }); opts[i].classList.add('kb'); opts[i].scrollIntoView({ block: 'nearest' });
      if(act > -1) opts[i].focus({ preventScroll: true });
    }

    btn.addEventListener('click', function(){ isOpen() ? close() : open(); });
    wrap.querySelector('.tts-bd').addEventListener('click', close);
    if(lab) lab.addEventListener('click', function(e){ e.preventDefault(); isOpen() ? close() : open(); });
    list.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('.tts-opt') : null; if(b) pick(b.getAttribute('data-v')); });
    if(input) input.addEventListener('input', function(){ render(input.value); var f = list.querySelector('.tts-opt:not(.all)'); if(f && input.value.trim()) f.classList.add('kb'); });
    wrap.addEventListener('keydown', function(e){
      if(!isOpen()){ if(e.key === 'ArrowDown' && e.target === btn){ e.preventDefault(); open(); } return; }
      if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(); btn.focus({ preventScroll: true }); }
      else if(e.key === 'ArrowDown' || e.key === 'ArrowRight'){ e.preventDefault(); move(1); }
      else if(e.key === 'ArrowUp' || e.key === 'ArrowLeft'){ e.preventDefault(); move(-1); }
      else if(e.key === 'Enter' && e.target === input){ e.preventDefault(); var k = list.querySelector('.tts-opt.kb') || list.querySelector('.tts-opt:not(.all)'); if(k && (input.value.trim() || k.classList.contains('kb'))) pick(k.getAttribute('data-v')); }
    }, true);
    wrap.addEventListener('focusout', function(e){ if(isOpen() && e.relatedTarget && !wrap.contains(e.relatedTarget)) close(); });
    document.addEventListener('click', function(e){ if(isOpen() && !wrap.contains(e.target) && !(lab && lab.contains(e.target))) close(); });

    // the page keeps using the <select>: follow what it does to it
    Object.defineProperty(sel, 'value', { configurable: true, get: function(){ return VAL.get.call(sel); }, set: function(v){ VAL.set.call(sel, v); refresh(); } });
    sel.focus = function(){ btn.focus(); };
    sel.addEventListener('change', refresh);
    new MutationObserver(refresh).observe(sel, { childList: true, attributes: true, attributeFilter: ['disabled', 'aria-invalid'] });

    var api = { open: open, close: close, refresh: refresh, button: btn, wrap: wrap };
    sel._tts = api; refresh();
    return api;
  }
  root.TTSelect = { enhance: enhance };
})(window);
