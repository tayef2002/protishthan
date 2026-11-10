/* Protishthan — the saved name index for the card page: an institution name typed on the card page is answered in the browser, at once, from small saved files
   (card-index/k/…, card-index/p/…, built by tools/card-index/build.mjs) instead of a question to the database.
   It follows the first two steps of directory_search() in the database exactly (spelled alike and starting with what was typed; then same sound, starting with what
   was typed). The later steps ("contains what was typed") stay with the server: when this index does not fill the list, the page asks the server as before.
   CardIndex.create({ BnName, PhonKey, load, version }) -> { search(q, { limit, extra }) }
     load(path) -> Promise<string|null>: the text of a saved file, null when there is no such file (nothing starts with those letters), a rejected promise when the network fails
     search -> Promise<{ rows, complete, failed }>   complete = the list is full from the first two steps, so no server question is needed */
(function(root){
  'use strict';
  var BANGLA = /^[ঀ-৿]/;
  var sid = function(s2){ var o = []; for (var i = 0; i < s2.length; i++) o.push(s2.charCodeAt(i).toString(16)); return o.join('-'); };
  var byName = function(a, b){ return a.institution_name < b.institution_name ? -1 : a.institution_name > b.institution_name ? 1 : 0; };

  function create(deps){
    var BnName = deps.BnName, PhonKey = deps.PhonKey, load = deps.load, version = deps.version || '1';
    var files = {};

    function keys(r){
      if (r._k === undefined) {
        r._k = BnName.key(r.institution_name); r._ke = r.name_en ? BnName.key(r.name_en) : '';
        if (r._pk === undefined) { r._pk = PhonKey(r.institution_name); r._pke = r.name_en ? PhonKey(r.name_en) : ''; }
      }
      return r;
    }
    function parse(text){
      if (text == null) return [];
      var out = [], lines = text.split('\n');
      for (var i = 0; i < lines.length; i++) {
        if (!lines[i]) continue;
        var f = lines[i].split('\t');
        out.push({ id: '', institution_name: f[0], name_en: f[1] || '', institution_type: f[2], district: f[3], upazila: f[4], desired_slug: f[5], verification: 'unverified', _pk: f[6] || '', _pke: f[7] || '' });
      }
      return out;
    }
    function shard(fam, key){
      var id = fam + '/' + sid(key.slice(0, 2));
      if (!files[id]) files[id] = Promise.resolve(load(id + '.txt?v=' + encodeURIComponent(version))).then(parse, function(){ delete files[id]; return null; });
      return files[id];
    }

    function search(q, opts){
      opts = opts || {};
      var limit = opts.limit || 7, extra = opts.extra || [];
      var qk = BnName.key(q), pk = PhonKey(q);
      var useK = qk.length >= 2 && BANGLA.test(qk), useP = pk.length >= 3;
      return Promise.all([useK ? shard('k', qk) : [], useP ? shard('p', pk) : []]).then(function(res){
        if (res[0] === null || res[1] === null) return { rows: [], complete: false, failed: true };
        // one row per page address; a row the page already holds (verified ones, with their real status) wins over the saved one
        var bySlug = {};
        res[0].concat(res[1]).forEach(function(r){ if (r.desired_slug && !bySlug[r.desired_slug]) bySlug[r.desired_slug] = r; });
        extra.forEach(function(r){ if (r && r.desired_slug) bySlug[r.desired_slug] = r; });
        var pool = Object.keys(bySlug).map(function(s){ return keys(bySlug[s]); });
        var out = [], seen = {};
        var take = function(list, kind){ for (var i = 0; i < list.length && out.length < limit; i++) { var r = list[i]; if (seen[r.desired_slug]) continue; seen[r.desired_slug] = 1; out.push(Object.assign({}, r, { match_kind: kind })); } };
        if (qk.length >= 2) {
          var s1 = pool.filter(function(r){ return r._k.indexOf(qk) === 0 || (r._ke && r._ke.indexOf(qk) === 0); });
          s1.sort(function(a, b){ var ea = (a._k === qk || a._ke === qk) ? 0 : 1, eb = (b._k === qk || b._ke === qk) ? 0 : 1; return ea - eb || a._k.length - b._k.length || byName(a, b); });
          take(s1, 'exact');
        }
        if (useP && out.length < limit) {
          var s2 = pool.filter(function(r){ return !seen[r.desired_slug] && (r._pk.indexOf(pk) === 0 || (r._pke && r._pke.indexOf(pk) === 0)); });
          s2.sort(function(a, b){ var ea = (a._pk === pk || a._pke === pk) ? 0 : 1, eb = (b._pk === pk || b._pke === pk) ? 0 : 1; return ea - eb || a._pk.length - b._pk.length || byName(a, b); });
          take(s2, 'sound');
        }
        // for a Latin query there are no spelling files, so the exact step above only saw the page's own rows: the server must still be asked
        return { rows: out, complete: out.length >= limit && BANGLA.test(qk), failed: false };
      });
    }
    return { search: search };
  }

  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CardIndex = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
