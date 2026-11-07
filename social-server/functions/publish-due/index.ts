// Supabase Edge Function "publish-due": posts the queued photo cards to Facebook Pages.
// Called by pg_cron (see 01_schema.sql). Secrets it needs (Dashboard > Edge Functions > Secrets):
//   CRON_SECRET      shared secret, same value as social_config.cron_secret
//   FB_PAGES         JSON: {"main":{"page_id":"123...","token":"EAAB..."}, "second":{...}}
//   FB_API_VERSION   optional, default v27.0 (the version the Graph API Explorer showed in 2026-11)
//   SB_SERVICE_KEY   optional: the project's service/secret key; if missing the automatic SUPABASE_SERVICE_ROLE_KEY is used
// SUPABASE_URL is provided by Supabase automatically.
// Only "erasable" type syntax is used, so the same file also runs unchanged in our local Node test.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  const env = (k: string) => Deno.env.get(k);
  if (!env('CRON_SECRET') || req.headers.get('x-cron-secret') !== env('CRON_SECRET')) return new Response('forbidden', { status: 403 });

  // SB_SERVICE_KEY (our own secret, e.g. a new-style sb_secret_ key) wins over the key Supabase injects automatically
  const SB = (env('SUPABASE_URL') || '') as string, KEY = (env('SB_SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY') || '') as string;
  const GRAPH = 'https://graph.facebook.com/' + (env('FB_API_VERSION') || 'v27.0');
  let pages: Record<string, any> = {}; try { pages = JSON.parse(env('FB_PAGES') || '{}'); } catch (_) { return json({ error: 'FB_PAGES is not valid JSON' }, 500); }
  const auth: Record<string, string> = KEY.startsWith('sb_') ? { apikey: KEY } : { apikey: KEY, Authorization: 'Bearer ' + KEY };   // new-style secret keys go in apikey only
  const rest = (path: string, init: any = {}) => fetch(SB + '/rest/v1/' + path, { ...init, headers: { ...auth, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const patch = (id: string, body: unknown) => rest('fb_posts?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(body) });
  const graph = async (path: string, params: Record<string, string>) => {
    const r = await fetch(GRAPH + '/' + path, { method: 'POST', body: new URLSearchParams(params) });
    let d: any = {}; try { d = await r.json(); } catch (_) { /* not json */ }
    if (!r.ok || d.error) { const e: any = new Error((d.error && d.error.message) || ('HTTP ' + r.status)); e.code = d.error && d.error.code; throw e; }
    return d;
  };

  let body: any = {}; try { body = await req.json(); } catch (_) { /* empty body is fine */ }

  // token / page health check:  POST {"check":true}
  if (body.check) {
    const out: Record<string, string> = { _version: 'reels-1' };   // lets us check which code is deployed
    for (const [k, p] of Object.entries(pages)) {
      try { const r = await fetch(GRAPH + '/' + p.page_id + '?fields=name&access_token=' + encodeURIComponent(p.token)); const d: any = await r.json(); out[k] = d.error ? 'ERROR: ' + d.error.message : 'ok: ' + d.name; }
      catch (e: any) { out[k] = 'ERROR: ' + e.message; }
    }
    return json(out);
  }

  const claimed = await rest('rpc/claim_due_posts', { method: 'POST', body: JSON.stringify({ p_limit: 3 }) });
  if (!claimed.ok) return json({ error: 'claim failed: ' + (await claimed.text()) }, 500);
  const rows: any[] = await claimed.json();
  const results: any[] = [];

  const started = Date.now();
  for (const row of rows) {
    // a reel can take half a minute; if this run is running out of time, hand the rest back for the next minute
    if (Date.now() - started > 35000) { await patch(row.id, { status: 'queued', attempts: Math.max(0, row.attempts - 1) }); continue; }
    const page = pages[row.page_key];
    if (!page) { await patch(row.id, { status: 'failed', error: 'page_key "' + row.page_key + '" is not in FB_PAGES' }); results.push({ id: row.id, ok: false }); continue; }
    let postId: string;
    try {
      const img = SB + '/storage/v1/object/public/cards/' + encodeURI(row.image_path);   // a card image, or the reel video
      if (row.kind === 'reel') {
        // Reels: 1) open an upload session  2) tell Facebook where the hosted video is  3) publish it
        const s = await graph(page.page_id + '/video_reels', { upload_phase: 'start', access_token: page.token });
        const up = await fetch(s.upload_url || ('https://rupload.facebook.com/video-upload/' + (env('FB_API_VERSION') || 'v27.0') + '/' + s.video_id), { method: 'POST', headers: { Authorization: 'OAuth ' + page.token, file_url: img } });
        let ud: any = {}; try { ud = await up.json(); } catch (_) { /* not json */ }
        if (!up.ok || ud.success === false || ud.error) { const e: any = new Error((ud.error && (ud.error.message || String(ud.error))) || (ud.debug_info && ud.debug_info.message) || ('upload HTTP ' + up.status)); e.code = ud.error && ud.error.code; throw e; }
        const f = await graph(page.page_id + '/video_reels', { upload_phase: 'finish', video_id: s.video_id, video_state: 'PUBLISHED', description: row.caption || '', access_token: page.token });
        postId = (f && f.post_id) || s.video_id;
        for (let i = 0; i < 5; i++) {   // a short look at the processing state; "error" means nothing was published
          await sleep(3000);
          const st: any = await (await fetch(GRAPH + '/' + s.video_id + '?fields=status&access_token=' + encodeURIComponent(page.token))).json().catch(() => ({}));
          const vs = st && st.status && st.status.video_status;
          if (vs === 'error') throw new Error('Facebook could not process the video: ' + JSON.stringify(st.status).slice(0, 200));
          if (vs === 'ready' || vs === 'published') break;
        }
      } else {
        const d = await graph(page.page_id + '/photos', { url: img, caption: row.caption || '', published: 'true', access_token: page.token });
        postId = d.post_id || d.id;
      }
    } catch (e: any) {
      const dead = e.code === 190 || row.attempts >= 3;   // 190 = token invalid or expired: do not keep trying
      await patch(row.id, dead ? { status: 'failed', error: String(e.message).slice(0, 500) } : { status: 'queued', error: String(e.message).slice(0, 500), scheduled_at: new Date(Date.now() + 5 * 60000).toISOString() });
      results.push({ id: row.id, ok: false, error: e.message }); continue;
    }
    // the photo is live from here on, so never publish it again, whatever happens next
    const done: Record<string, unknown> = { status: 'posted', fb_post_id: postId, posted_at: new Date().toISOString(), error: null };
    if (row.first_comment) {
      try { await sleep(2000); await graph(postId + '/comments', { message: row.first_comment, access_token: page.token }); done.comment_status = 'posted'; }
      catch (e: any) { done.comment_status = 'failed'; done.error = 'photo posted, comment failed: ' + String(e.message).slice(0, 400); }
    }
    await patch(row.id, done);
    results.push({ id: row.id, ok: true, post: postId });
  }
  // housekeeping: Facebook keeps its own copy, so remove our copy of images posted more than a day ago
  try {
    const cutoff = encodeURIComponent(new Date(Date.now() - 86400000).toISOString());
    const old: any[] = await (await rest('fb_posts?select=id,image_path&status=eq.posted&image_deleted=eq.false&posted_at=lt.' + cutoff + '&limit=20')).json();
    for (const o of old) {
      const r = await fetch(SB + '/storage/v1/object/cards/' + encodeURI(o.image_path), { method: 'DELETE', headers: auth });
      if (r.ok || r.status === 404) await patch(o.id, { image_deleted: true });
    }
  } catch (_) { /* cleanup is best effort, never blocks posting */ }
  return json({ claimed: rows.length, results });
});

function json(o: unknown, status = 200) { return new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } }); }
