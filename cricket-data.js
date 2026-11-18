/* ক্রিকেট কুইজ: the rules of the match, pure (no page, no network), checked by tools/tests/test_cricket_page.js.
   You bat. Every ball is a question: a RIGHT answer scores runs by how fast you were (the faster, the bigger the shot), a WRONG answer is OUT, no answer in time is a dot ball.
   A match is 12 balls and 3 wickets and you chase a target (30, 40 or 50); it ends when the target is reached, the balls are used or the third wicket falls.
   The questions come from the other games of the league (the arithmetic of অঙ্ক স্প্রিন্ট, the districts of কোন জেলায়?), so nothing new has to be written or checked. */
(function(root){
  'use strict';
  var BALLS = 12, WICKETS = 3;
  var TARGETS = [[30, 'সহজ'], [40, 'মাঝারি'], [50, 'কঠিন']];
  var TOPICS = [['math-c3', 'অঙ্ক · শ্রেণি ৩-৫', 10], ['math-c6', 'অঙ্ক · শ্রেণি ৬-৮', 10], ['math-c9', 'অঙ্ক · শ্রেণি ৯-১০', 12], ['district', 'কোন জেলায়?', 12]];
  function topic(key){ for(var i = 0; i < TOPICS.length; i++) if(TOPICS[i][0] === key) return TOPICS[i]; return null; }
  function secondsFor(key){ var t = topic(key); return t ? t[2] : 10; }
  // runs for a right answer: the part of the time that was used (0 = at once, 1 = the last moment)
  function runsFor(used){ var f = Math.max(0, Math.min(1, used)); return f < 0.3 ? 6 : f < 0.6 ? 4 : f < 0.85 ? 2 : 1; }
  function newMatch(target){ return { target: target, balls: 0, runs: 0, wickets: 0, log: [], over: false, result: '' }; }
  // one ball: kind 'run' (value = the runs), 'dot' (no answer in time) or 'out' (a wrong answer). The state is copied, never changed.
  function play(m, kind, value){
    if(m.over) return m;
    var n = { target: m.target, balls: m.balls + 1, runs: m.runs, wickets: m.wickets, log: m.log.slice(), over: false, result: '' };
    if(kind === 'run'){ n.runs += value; n.log.push(value); } else if(kind === 'out'){ n.wickets++; n.log.push('W'); } else n.log.push(0);
    if(n.runs >= n.target){ n.over = true; n.result = 'win'; } else if(n.wickets >= WICKETS || n.balls >= BALLS){ n.over = true; n.result = 'lose'; }
    return n;
  }
  var EMOJI = { 6: '6️⃣', 4: '4️⃣', 2: '2️⃣', 1: '1️⃣', 0: '⚪', W: '❌' };
  function emojiRow(log){ return log.map(function(x){ return EMOJI[x] || '⚪'; }).join(''); }
  var SAY = { 6: 'ছক্কা! বল গ্যালারিতে! 🔥', 4: 'চার! দুর্দান্ত বাউন্ডারি! 💥', 2: 'দুই রান, ভালো দৌড়', 1: 'এক রান, তবে একটু দেরি হয়ে গেল', 0: 'ডট বল, সময় শেষ', W: 'আউট! ভুল উত্তর ☝️' };
  function say(x){ return SAY[x] || ''; }
  function bn(x){ return String(x).replace(/[0-9]/g, function(d){ return '০১২৩৪৫৬৭৮৯'[d]; }); }
  function verdict(m){
    if(m.result === 'win') return m.balls <= 6 ? 'অসাধারণ! মাত্র ' + bn(m.balls) + ' বলে লক্ষ্য ছুঁয়ে ফেললেন 🏆' : bn(m.balls) + ' বলে জিতেছেন! 🏆';
    return m.wickets >= WICKETS ? 'অল আউট! ' + bn(m.target - m.runs) + ' রান কম পড়ল' : 'বল শেষ, ' + bn(m.target - m.runs) + ' রান কম পড়ল';
  }
  var api = { BALLS: BALLS, WICKETS: WICKETS, TARGETS: TARGETS, TOPICS: TOPICS, topic: topic, secondsFor: secondsFor, runsFor: runsFor, newMatch: newMatch, play: play, emojiRow: emojiRow, say: say, verdict: verdict, bn: bn };
  root.CricketData = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
