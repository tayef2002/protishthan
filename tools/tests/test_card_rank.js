// Tests the "Nth card holder of my institution" block of card.html (between RANK-START and RANK-END), run exactly as it is on the page.
//   node tools/tests/test_card_rank.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'card.html'), 'utf8');
const a = html.indexOf('/* RANK-START'), b = html.indexOf('/* RANK-END */');
if (a < 0 || b < 0) { console.error('markers not found in card.html'); process.exit(1); }
const code = html.slice(a, b);

let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '  got ' + JSON.stringify(got) + '  want ' + JSON.stringify(want))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// a fresh page-like world per test: the levels of the card, a fake localStorage, a fake Supabase client that records the calls
function world({ levels, rpc }) {
  const store = {}, calls = [], log = [];
  const S = { edu: {} }; levels.forEach(l => { S.edu[l.key] = { name: l.name || l.key, slug: l.slug || '' }; });
  const sb = { rpc: async (name, args) => { calls.push(name); return rpc(name, args); } };
  const sandbox = {
    S, sb, calls, log, store, setTimeout, Promise, JSON, Set, Number, String, Math, console,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    bn: x => String(x).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]),
    deviceId: () => 'device-12345678',
    filledLevels: () => levels.filter(l => S.edu[l.key].name.trim()).map(l => ({ key: l.key })),   // in level order, lowest first, like the page
    T: (n, p) => log.push(['T', n, p]), loadLeaderboard: () => log.push(['lb']),
    DL_VARIANT: 'pride', DL_COPIED: false, caption: () => 'cap', silentCopy: () => { log.push(['copy']); return Promise.resolve(true); },
  };
  vm.createContext(sandbox);
  vm.runInContext(code + `;this.api = { ordBn, currentRank, claimRanks, ensureRank, rankForCard, countMyInstitutes, rankCache, getVariant: () => DL_VARIANT, missing: () => RANK_RPC_MISSING };`, sandbox);
  return sandbox;
}
const L = (key, slug, name) => ({ key, slug, name: name || key });
const okRpc = map => async (fn, args) => {
  if (fn === 'card_claim_ranks') return { data: args.p_slugs.filter(s => map[s]).map(s => ({ slug: s, name: 'Name of ' + s, seq: map[s] })), error: null };
  return { data: 0, error: null };
};

(async () => {
  // ----- the Bangla ordinals -----
  const w = world({ levels: [L('school', 's1')], rpc: okRpc({}) }).api;
  eq('ordinals 1..10', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(w.ordBn), ['১ম', '২য়', '৩য়', '৪র্থ', '৫ম', '৬ষ্ঠ', '৭ম', '৮ম', '৯ম', '১০ম']);
  eq('ordinals 11, 21, 127, 1234', [11, 21, 127, 1234].map(w.ordBn), ['১১তম', '২১তম', '১২৭তম', '১২৩৪তম']);

  // ----- which number goes on the card -----
  let W = world({ levels: [L('school', 's1'), L('college', 's2'), L('bachelor', 's3')], rpc: okRpc({ s1: 3, s2: 1, s3: 2 }) });
  await W.api.claimRanks(['s1', 's2', 's3']);
  eq('smallest number wins (3, 1, 2 -> 1)', W.api.currentRank() && [W.api.currentRank().slug, W.api.currentRank().seq], ['s2', 1]);
  W = world({ levels: [L('school', 's1'), L('college', 's2'), L('bachelor', 's3')], rpc: okRpc({ s1: 1, s2: 4, s3: 1 }) });
  await W.api.claimRanks(['s1', 's2', 's3']);
  eq('tie (1 and 1) goes to the highest level', W.api.currentRank().slug, 's3');
  W = world({ levels: [L('school', 's1'), L('college', 'x-unlisted')], rpc: okRpc({ s1: 7 }) });
  await W.api.claimRanks(['s1']);
  eq('an institution that is not listed is ignored', W.api.currentRank().slug, 's1');
  W = world({ levels: [L('school', '')], rpc: okRpc({}) });
  eq('no listed institution -> no number', W.api.currentRank(), null);
  W = world({ levels: [L('school', 's1')], rpc: okRpc({ s1: 5 }) });
  await W.api.claimRanks(['s1']);
  W.S.edu.school.slug = '';
  eq('slug removed from the card -> the number disappears', W.api.currentRank(), null);

  // ----- the answer is kept in the browser -----
  W = world({ levels: [L('school', 's1')], rpc: okRpc({ s1: 9 }) });
  await W.api.claimRanks(['s1']);
  eq('stored in localStorage', JSON.parse(W.store.sk_ranks_v1).s1.s, 9);
  const W2 = world({ levels: [L('school', 's1')], rpc: async () => { throw new Error('must not be called'); } });
  W2.store.sk_ranks_v1 = W.store.sk_ranks_v1;
  eq('a returning visitor has the number at once', W2.api.currentRank().seq, 9);
  await W2.api.ensureRank(50);
  eq('and no request is made for it', W2.calls.length, 0);

  // ----- waiting is capped -----
  W = world({ levels: [L('school', 's1')], rpc: async () => { await sleep(400); return { data: [{ slug: 's1', name: 'N', seq: 2 }], error: null }; } });
  let t0 = Date.now(); await W.api.ensureRank(60); const waited = Date.now() - t0;
  eq('a slow server holds the card for at most the cap', waited < 250, true);
  eq('no number yet (the card goes without it)', W.api.currentRank(), null);
  await sleep(450);
  eq('the late answer still lands in the cache', W.api.currentRank() && W.api.currentRank().seq, 2);

  // ----- two callers share one request -----
  W = world({ levels: [L('school', 's1')], rpc: async () => { await sleep(30); return { data: [{ slug: 's1', name: 'N', seq: 1 }], error: null }; } });
  await Promise.all([W.api.claimRanks(['s1']), W.api.claimRanks(['s1'])]);
  eq('same institutions asked at the same time = one request', W.calls.filter(c => c === 'card_claim_ranks').length, 1);

  // ----- the migration is not run yet: the old counting call keeps working -----
  W = world({ levels: [L('school', 's1')], rpc: async fn => fn === 'card_claim_ranks' ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.card_claim_ranks' } } : { data: 1, error: null } });
  await W.api.countMyInstitutes();
  eq('falls back to count_card_institutes', W.calls, ['card_claim_ranks', 'count_card_institutes']);
  eq('and remembers that the new call is missing', W.api.missing(), true);
  await W.api.countMyInstitutes();
  eq('the missing call is not asked again', W.calls.filter(c => c === 'card_claim_ranks').length, 1);
  eq('no number on the card', W.api.currentRank(), null);

  // ----- the database is busy (not a missing function): try again next time -----
  let busy = true;
  W = world({ levels: [L('school', 's1')], rpc: async fn => { if (fn === 'card_claim_ranks' && busy) return { data: null, error: { code: 'PGRST002', message: 'Could not query the database for the schema cache. Retrying.' } }; return { data: [{ slug: 's1', name: 'N', seq: 4 }], error: null }; } });
  await W.api.ensureRank(100);
  eq('busy database: not marked as missing', W.api.missing() === true, false);
  busy = false; await W.api.ensureRank(100);
  eq('asked again later, then the number arrives', W.api.currentRank() && W.api.currentRank().seq, 4);

  // ----- a card made twice asks the server once -----
  W = world({ levels: [L('school', 's1')], rpc: okRpc({ s1: 6 }) });
  await W.api.rankForCard(100); await W.api.rankForCard(100); await W.api.countMyInstitutes();
  eq('already counted institutions are not sent again', W.calls.filter(c => c === 'card_claim_ranks').length, 1);

  // ----- the caption variant -----
  W = world({ levels: [L('school', 's1')], rpc: okRpc({ s1: 3 }) });
  await W.api.rankForCard(100);
  eq('a number of 20 or lower makes the "my institution" caption the default', W.api.getVariant(), 'school');
  eq('the shown-number event is sent once', W.log.filter(x => x[0] === 'T' && x[1] === 'card_rank_shown').length, 1);
  W = world({ levels: [L('school', 's1')], rpc: okRpc({ s1: 90 }) });
  await W.api.rankForCard(100);
  eq('a big number keeps the caption as it was', W.api.getVariant(), 'pride');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
