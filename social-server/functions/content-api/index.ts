// Supabase Edge Function "content-api": the backend of the protishthan.com/content dashboard (view + manage).
// Every request must carry the access code in the x-dash-code header; without the right code nothing happens.
// Secrets: DASH_CODE (the access code). SUPABASE_URL is provided automatically; SB_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY is the service key.
// Deploy with "Verify JWT" OFF (the code is the lock).
//
// POST body {"action": ...}:
//   list (default)                         everything the dashboard shows
//   update    {id, title?, caption?, first_comment?}  edit the text of a post that has not gone out
//   schedule  {id, scheduled_at}           give a time (stock / failed / queued -> queued)
//   swap      {a, b}                       exchange the times of two queued posts
//   unschedule{ids}                        queued / failed -> back to stock
//   delete    {ids}                        remove posts that have not gone out (and their images)
//   top       {ids}                        move stock items to the front of their line
// Posts that are already publishing or posted can never be changed from here.

const CORS: Record<string, string> = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-dash-code', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const bad = (error: string, status = 400) => json({ error }, status);
function same(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPEN = 'status=in.(stock,queued,failed)';   // the only states that may be changed from the dashboard
const FIELDS = 'id,kind,title,caption,first_comment,status,scheduled_at,posted_at,thumb_path,image_path,error,fb_post_id,comment_status,attempts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const env = (k: string) => Deno.env.get(k);
  const code = env('DASH_CODE');
  if (!code) return bad('not configured', 503);
  if (!same(req.headers.get('x-dash-code') || '', code)) { await sleep(800); return bad('wrong code', 403); }   // the delay makes guessing pointless

  const SB = (env('SUPABASE_URL') || '') as string, KEY = (env('SB_SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY') || '') as string;
  const auth: Record<string, string> = KEY.startsWith('sb_') ? { apikey: KEY } : { apikey: KEY, Authorization: 'Bearer ' + KEY };
  const db = (path: string, init: any = {}) => fetch(SB + '/rest/v1/' + path, { ...init, headers: { ...auth, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const patch = async (filter: string, body: unknown): Promise<any[]> => { const r = await db('fb_posts?' + filter, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) }); return r.ok ? await r.json() : []; };
  const ids = (b: any): string[] | null => { const a = Array.isArray(b.ids) ? b.ids : (b.id ? [b.id] : []); return a.length && a.length <= 60 && a.every((x: any) => typeof x === 'string' && UUID.test(x)) ? a : null; };

  let body: any = {}; try { body = await req.json(); } catch (_) { /* empty body = list */ }
  const action = body.action || 'list';

  if (action === 'list') {
    const since = encodeURIComponent(new Date(Date.now() - 36 * 3600000).toISOString());
    const r = await db('fb_posts?select=' + FIELDS + '&or=(status.eq.stock,scheduled_at.gte.' + since + ')&order=scheduled_at.asc.nullslast,rank.asc.nullslast,sort_key.asc.nullslast&limit=1000');
    if (!r.ok) return bad('database: ' + (await r.text()).slice(0, 200), 500);
    const rows: any[] = await r.json();
    const items = rows.map((x) => ({ id: x.id, kind: x.kind, title: x.title, caption: x.caption, first_comment: x.first_comment, status: x.status, scheduled_at: x.scheduled_at, posted_at: x.posted_at,
      error: x.error, fb_post_id: x.fb_post_id, comment_status: x.comment_status, attempts: x.attempts,
      thumb: x.thumb_path ? SB + '/storage/v1/object/public/thumbs/' + encodeURI(x.thumb_path) : null,
      // the full image is only kept until a day after posting
      image: x.image_path && x.status !== 'posted' ? SB + '/storage/v1/object/public/cards/' + encodeURI(x.image_path) : null }));
    return json({ now: new Date().toISOString(), items });
  }

  if (action === 'update') {
    const id = body.id; if (typeof id !== 'string' || !UUID.test(id)) return bad('bad id');
    const f: Record<string, string> = {};
    if (typeof body.title === 'string') f.title = body.title.trim().slice(0, 160);
    if (typeof body.caption === 'string') f.caption = body.caption.slice(0, 4000);
    if (typeof body.first_comment === 'string') f.first_comment = body.first_comment.trim().slice(0, 2000) || null as any;
    if (!Object.keys(f).length) return bad('nothing to change');
    const done = await patch('id=eq.' + id + '&' + OPEN, f);
    return done.length ? json({ ok: true }) : bad('locked: already posting or posted', 409);
  }

  if (action === 'schedule') {
    const id = body.id; if (typeof id !== 'string' || !UUID.test(id)) return bad('bad id');
    const t = Date.parse(body.scheduled_at);
    if (!isFinite(t)) return bad('bad time');
    if (t < Date.now() + 2 * 60000) return bad('time_too_soon');
    if (t > Date.now() + 400 * 86400000) return bad('time_too_far');
    const lo = encodeURIComponent(new Date(t - 20 * 60000).toISOString()), hi = encodeURIComponent(new Date(t + 20 * 60000).toISOString());
    const clash = await db('fb_posts?select=id&status=in.(queued,publishing,posted)&scheduled_at=gte.' + lo + '&scheduled_at=lte.' + hi + '&id=neq.' + id + '&limit=1');
    if (clash.ok && (await clash.json()).length) return bad('slot_taken', 409);
    const done = await patch('id=eq.' + id + '&' + OPEN, { status: 'queued', scheduled_at: new Date(t).toISOString(), attempts: 0, error: null });
    return done.length ? json({ ok: true }) : bad('locked: already posting or posted', 409);
  }

  if (action === 'swap') {
    const a = body.a, b = body.b;
    if (typeof a !== 'string' || typeof b !== 'string' || !UUID.test(a) || !UUID.test(b) || a === b) return bad('bad ids');
    const r = await db('fb_posts?select=id,scheduled_at&status=eq.queued&id=in.(' + a + ',' + b + ')');
    const rows: any[] = r.ok ? await r.json() : [];
    const ra = rows.find((x) => x.id === a), rb = rows.find((x) => x.id === b);
    if (!ra || !rb || !ra.scheduled_at || !rb.scheduled_at) return bad('both must be queued', 409);
    const da = await patch('id=eq.' + a + '&status=eq.queued', { scheduled_at: rb.scheduled_at });
    const dbb = await patch('id=eq.' + b + '&status=eq.queued', { scheduled_at: ra.scheduled_at });
    return da.length && dbb.length ? json({ ok: true }) : bad('locked: one of them is already posting', 409);
  }

  if (action === 'unschedule') {
    const list = ids(body); if (!list) return bad('bad ids');
    const done = await patch('id=in.(' + list.join(',') + ')&status=in.(queued,failed)', { status: 'stock', scheduled_at: null, attempts: 0, error: null });
    return json({ ok: true, changed: done.length });
  }

  if (action === 'delete') {
    const list = ids(body); if (!list) return bad('bad ids');
    const r = await db('fb_posts?id=in.(' + list.join(',') + ')&' + OPEN, { method: 'DELETE', headers: { Prefer: 'return=representation' } });
    const gone: any[] = r.ok ? await r.json() : [];
    for (const g of gone) {   // best effort: free the storage too
      if (g.image_path) await fetch(SB + '/storage/v1/object/cards/' + encodeURI(g.image_path), { method: 'DELETE', headers: auth }).catch(() => {});
      if (g.thumb_path) await fetch(SB + '/storage/v1/object/thumbs/' + encodeURI(g.thumb_path), { method: 'DELETE', headers: auth }).catch(() => {});
    }
    return json({ ok: true, changed: gone.length });
  }

  if (action === 'top') {
    const list = ids(body); if (!list) return bad('bad ids');
    const base = -Date.now() * 1000; let n = 0;   // newer "move to front" goes before older ones; inside one call the given order is kept
    for (let i = 0; i < list.length; i++) n += (await patch('id=eq.' + list[i] + '&status=eq.stock', { rank: base + i })).length;
    return json({ ok: true, changed: n });
  }

  return bad('unknown action');
});
