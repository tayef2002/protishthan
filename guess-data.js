/* "কোন জেলায়?": the rules of the game that must be the same on every phone and are checked by tests (tools/tests/test_guess_page.js).
   The pool of institutions comes from the directory (migrations/2027-01-15_guess_pool.sql); everything below is pure: no page, no network.
   The upazila is shown with the name (that is the real geography question: which district is this upazila in?), so a row needs an upazila, and an upazila that carries the district's own name ("কুমিল্লা সদর") is not used: it gives the answer away.
   Daily set: the same 10 questions for everybody on a Bangladesh day, because the pool is in a fixed order for that day and the first 10 usable ones are taken.
   Free play: 10 at random from the same pool. Options: the right district plus three others, two from the same division when it can be (harder), the order shuffled by a seed. */
(function(root){
  'use strict';
  var ROUNDS = 10, SECONDS = 10;
  var DIV = {};                                     // district -> division, set from bd-locations.js (window.BD_DIVISIONS) or by the tests
  function setDivisions(map){ DIV = map || {}; }
  function divisionOf(d){ return DIV[String(d || '').trim()] || ''; }
  function districts(){ return Object.keys(DIV); }

  // a small seeded random number generator (mulberry32) and a string hash, so that a seed gives the same sequence everywhere
  function hash(s){ var h = 2166136261; s = String(s); for(var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed){ var a = hash(seed); return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(arr, rand){ var a = arr.slice(); for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(rand() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // the Bangladesh day, "2026-11-18", from a time in milliseconds (UTC+6, no summer time)
  function dayKey(ms){ var d = new Date((ms == null ? Date.now() : ms) + 6 * 3600e3); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }

  // only rows the game can use: a district that is one of the 64, a name, a slug
  function usable(row){ if(!(row && row.slug && row.name && divisionOf(row.district))) return false; var d = String(row.district).trim(), u = String(row.upazila || '').trim(); return String(row.name).indexOf(d) < 0 && u.length > 0 && u.indexOf(d) < 0; }
  function clean(pool){ var seen = {}, out = []; (Array.isArray(pool) ? pool : []).forEach(function(r){ if(usable(r) && !seen[r.slug]){ seen[r.slug] = 1; out.push({ slug: String(r.slug), name: String(r.name).trim(), type: String(r.type || ''), district: String(r.district).trim(), upazila: String(r.upazila || '').trim() }); } }); return out; }

  // four options for one institution
  function optionsFor(row, seed){
    var rand = rng('opt|' + seed + '|' + row.slug), div = divisionOf(row.district), all = districts().filter(function(d){ return d !== row.district; });
    var same = shuffle(all.filter(function(d){ return divisionOf(d) === div; }), rand), other = shuffle(all.filter(function(d){ return divisionOf(d) !== div; }), rand);
    var pick = same.slice(0, 2); other.forEach(function(d){ if(pick.length < 3) pick.push(d); }); same.slice(2).forEach(function(d){ if(pick.length < 3) pick.push(d); });
    return shuffle([row.district].concat(pick.slice(0, 3)), rand);
  }
  // the ten questions: kind 'daily' (the first usable ones of the pool, in its order) or 'free' (random, the seed is anything)
  function build(pool, kind, seed){
    var rows = clean(pool); if(kind !== 'daily') rows = shuffle(rows, rng('free|' + seed));
    return rows.slice(0, ROUNDS).map(function(r){ return { slug: r.slug, name: r.name, type: r.type, district: r.district, upazila: r.upazila, options: optionsFor(r, kind === 'daily' ? seed : 'free|' + seed) }; });
  }
  // the points of an answer: 10 for a right one and up to 5 more for speed; a wrong one or none scores nothing
  function score(correct, msLeft){ if(!correct) return 0; var f = Math.max(0, Math.min(1, msLeft / (SECONDS * 1000))); return 10 + Math.round(5 * f); }
  function emojiRow(results){ return results.map(function(r){ return r ? '🟩' : '🟥'; }).join(''); }
  var api = { ROUNDS: ROUNDS, SECONDS: SECONDS, setDivisions: setDivisions, divisionOf: divisionOf, districts: districts, hash: hash, rng: rng, shuffle: shuffle, dayKey: dayKey, usable: usable, clean: clean, optionsFor: optionsFor, build: build, score: score, emojiRow: emojiRow };
  root.GuessData = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
