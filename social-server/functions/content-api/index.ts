// Supabase Edge Function "content-api": feeds the protishthan.com/content dashboard.
// The dashboard sends the access code in the x-dash-code header; without the right code nothing is returned.
// Secrets: DASH_CODE (the access code). SUPABASE_URL is provided automatically; SB_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY is the service key.
// Deploy with "Verify JWT" OFF (the code is the lock).

const CORS: Record<string, string> = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, x-dash-code', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
function same(a: string, b: string) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const env = (k: string) => Deno.env.get(k);
  const code = env('DASH_CODE');
  if (!code) return json({ error: 'not configured' }, 503);
  if (!same(req.headers.get('x-dash-code') || '', code)) { await sleep(800); return json({ error: 'wrong code' }, 403); }   // the delay makes guessing pointless

  const SB = (env('SUPABASE_URL') || '') as string, KEY = (env('SB_SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY') || '') as string;
  const auth: Record<string, string> = KEY.startsWith('sb_') ? { apikey: KEY } : { apikey: KEY, Authorization: 'Bearer ' + KEY };
  const since = encodeURIComponent(new Date(Date.now() - 36 * 3600000).toISOString());
  const url = SB + '/rest/v1/fb_posts?select=id,kind,title,caption,status,scheduled_at,posted_at,thumb_path,error,fb_post_id,comment_status,attempts'
    + '&or=(status.eq.stock,scheduled_at.gte.' + since + ')&order=scheduled_at.asc.nullslast,sort_key.asc.nullslast&limit=1000';
  const r = await fetch(url, { headers: auth });
  if (!r.ok) return json({ error: 'database: ' + (await r.text()).slice(0, 200) }, 500);
  const rows: any[] = await r.json();
  const items = rows.map((x) => ({ id: x.id, kind: x.kind, title: x.title, caption: x.caption, status: x.status, scheduled_at: x.scheduled_at, posted_at: x.posted_at,
    error: x.error, fb_post_id: x.fb_post_id, comment_status: x.comment_status, attempts: x.attempts,
    thumb: x.thumb_path ? SB + '/storage/v1/object/public/thumbs/' + encodeURI(x.thumb_path) : null }));
  return json({ now: new Date().toISOString(), items });
});
