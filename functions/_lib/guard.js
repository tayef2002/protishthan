// Shared guard for the AI endpoints (they spend our AI quota): only our own site, only signed-in users.
const SUPABASE_URL = 'https://eoqeeuujvpydhmfteqqj.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvcWVldXVqdnB5ZGhtZnRlcXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTM2NTgsImV4cCI6MjA5NzE4OTY1OH0.xuC-_euxf0DTqTpD5b8_6vgnkjeJjZIFqdKw-Bq3YbU'; // public (anon) key, the same one the site ships to browsers
const ALLOWED_ORIGINS = ['https://protishthan.com', 'https://www.protishthan.com'];

export function corsHeaders(request, methods) {
  const h = { 'Access-Control-Allow-Methods': methods, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Vary': 'Origin' };
  const o = request.headers.get('Origin');
  if (o && ALLOWED_ORIGINS.includes(o)) h['Access-Control-Allow-Origin'] = o;
  return h;
}

// Returns null when the request may proceed, otherwise a ready Response.
export async function guard(request, h) {
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return Response.json({ error: 'forbidden' }, { status: 403, headers: h });
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return Response.json({ error: 'login required' }, { status: 401, headers: h });
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + token } });
    if (!r.ok) return Response.json({ error: 'login required' }, { status: 401, headers: h });
    const u = await r.json();
    if (!u || !u.id) return Response.json({ error: 'login required' }, { status: 401, headers: h });
  } catch (e) {
    return Response.json({ error: 'login required' }, { status: 401, headers: h });
  }
  return null;
}
