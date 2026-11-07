// Supabase Edge Function "publish-due": posts the queued photo cards to Facebook Pages.
// Called by pg_cron (see 01_schema.sql). Secrets it needs (Dashboard > Edge Functions > Secrets):
//   CRON_SECRET      shared secret, same value as social_config.cron_secret
//   FB_PAGES         JSON: {"main":{"page_id":"123...","token":"EAAB..."}, "second":{...}}
//   FB_API_VERSION   optional, default v23.0
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
// Plain JavaScript on purpose (no type syntax) so the same file also runs in our local Node test.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  const env = (k) => Deno.env.get(k);
  if (!env('CRON_SECRET') || req.headers.get('x-cron-secret') !== env('CRON_SECRET')) return new Response('forbidden', { status: 403 });

  const SB = env('SUPABASE_URL'), KEY = env('SUPABASE_SERVICE_ROLE_KEY');
  const GRAPH = 'https://graph.facebook.com/' + (env('FB_API_VERSION') || 'v23.0');
  let pages = {}; try { pages = JSON.parse(env('FB_PAGES') || '{}'); } catch (_) { return json({ error: 'FB_PAGES is not valid JSON' }, 500); }
  const rest = (path, init = {}) => fetch(SB + '/rest/v1/' + path, { ...init, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const patch = (id, body) => rest('fb_posts?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(body) });
  const graph = async (path, params) => {
    const r = await fetch(GRAPH + '/' + path, { method: 'POST', body: new URLSearchParams(params) });
    let d = {}; try { d = await r.json(); } catch (_) {}
    if (!r.ok || d.error) { const e = new Error((d.error && d.error.message) || ('HTTP ' + r.status)); e.code = d.error && d.error.code; throw e; }
    return d;
  };

  let body = {}; try { body = await req.json(); } catch (_) {}

  // token / page health check:  POST {"check":true}
  if (body.check) {
    const out = {};
    for (const [k, p] of Object.entries(pages)) {
      try { const r = await fetch(GRAPH + '/' + p.page_id + '?fields=name&access_token=' + encodeURIComponent(p.token)); const d = await r.json(); out[k] = d.error ? 'ERROR: ' + d.error.message : 'ok: ' + d.name; }
      catch (e) { out[k] = 'ERROR: ' + e.message; }
    }
    return json(out);
  }

  const claimed = await rest('rpc/claim_due_posts', { method: 'POST', body: JSON.stringify({ p_limit: 3 }) });
  if (!claimed.ok) return json({ error: 'claim failed: ' + (await claimed.text()) }, 500);
  const rows = await claimed.json();
  const results = [];

  for (const row of rows) {
    const page = pages[row.page_key];
    if (!page) { await patch(row.id, { status: 'failed', error: 'page_key "' + row.page_key + '" is not in FB_PAGES' }); results.push({ id: row.id, ok: false }); continue; }
    let postId;
    try {
      const img = SB + '/storage/v1/object/public/cards/' + encodeURI(row.image_path);
      const d = await graph(page.page_id + '/photos', { url: img, caption: row.caption || '', published: 'true', access_token: page.token });
      postId = d.post_id || d.id;
    } catch (e) {
      const dead = e.code === 190 || row.attempts >= 3;   // 190 = token invalid or expired: do not keep trying
      await patch(row.id, dead ? { status: 'failed', error: String(e.message).slice(0, 500) } : { status: 'queued', error: String(e.message).slice(0, 500), scheduled_at: new Date(Date.now() + 5 * 60000).toISOString() });
      results.push({ id: row.id, ok: false, error: e.message }); continue;
    }
    // the photo is live from here on, so never publish it again, whatever happens next
    const done = { status: 'posted', fb_post_id: postId, posted_at: new Date().toISOString(), error: null };
    if (row.first_comment) {
      try { await sleep(2000); await graph(postId + '/comments', { message: row.first_comment, access_token: page.token }); done.comment_status = 'posted'; }
      catch (e) { done.comment_status = 'failed'; done.error = 'photo posted, comment failed: ' + String(e.message).slice(0, 400); }
    }
    await patch(row.id, done);
    results.push({ id: row.id, ok: true, post: postId });
  }
  return json({ claimed: rows.length, results });
});

function json(o, status = 200) { return new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }); }
