// Sets a teacher's login password to the phone number stored for them (the teacher login is "Teacher ID + phone number").
//
// This used to accept ANY request with a user_id and a new password and change that account's password with the service key:
// anyone who knew a user id could take over any account (an administrator's too). It now refuses unless ALL of these hold:
//   1. the caller is signed in (a valid Supabase access token in the Authorization header);
//   2. the target is a teacher of an institution that the caller owns (institutions.email = the caller's e-mail);
//   3. the new password is exactly the phone number saved on that teacher's row (so it can only ever "sync", never set an arbitrary password);
//   4. the target auth account is an internal teacher account (<id>@protishthan-teacher.internal), never a normal member / owner / admin;
//   5. the request comes from our own site (CORS and Origin check).
const SUPABASE_URL = 'https://eoqeeuujvpydhmfteqqj.supabase.co';
const ALLOWED_ORIGINS = ['https://protishthan.com', 'https://www.protishthan.com'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corsHeaders(request) {
  const h = { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Vary': 'Origin' };
  const o = request.headers.get('Origin');
  if (o && ALLOWED_ORIGINS.includes(o)) h['Access-Control-Allow-Origin'] = o;
  return h;
}
const reply = (body, status, headers) => Response.json(body, { status, headers });

async function rest(path, key) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
  return r.ok ? r.json() : null;
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const h = corsHeaders(request);
  try {
    const origin = request.headers.get('Origin');
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return reply({ error: 'forbidden' }, 403, h);

    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return reply({ error: 'not configured' }, 500, h);

    // 1) who is calling
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return reply({ error: 'login required' }, 401, h);
    const who = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: key, Authorization: 'Bearer ' + token } });
    if (!who.ok) return reply({ error: 'login required' }, 401, h);
    const caller = await who.json();
    const callerEmail = String((caller && caller.email) || '').toLowerCase();
    if (!callerEmail) return reply({ error: 'login required' }, 401, h);

    let body;
    try { body = await request.json(); } catch (e) { return reply({ error: 'bad request' }, 400, h); }
    const userId = body && body.user_id, newPassword = body && body.new_password;
    if (typeof userId !== 'string' || !UUID.test(userId) || typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 64) {
      return reply({ error: 'bad request' }, 400, h);
    }

    // 2) the target must be a teacher of an institution the caller owns
    const t = await rest('teachers?auth_user_id=eq.' + userId + '&select=institution_id,phone&limit=1', key);
    if (!t || !t.length) return reply({ error: 'not allowed' }, 403, h);
    const inst = await rest('institutions?id=eq.' + encodeURIComponent(t[0].institution_id) + '&select=email&limit=1', key);
    if (!inst || !inst.length || String(inst[0].email || '').toLowerCase() !== callerEmail) return reply({ error: 'not allowed' }, 403, h);

    // 3) the password can only be the phone number saved on the teacher's row
    if (String(t[0].phone || '').trim() !== newPassword.trim()) return reply({ error: 'not allowed' }, 403, h);

    // 4) and the account must be an internal teacher account
    const tu = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + userId, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    if (!tu.ok) return reply({ error: 'not allowed' }, 403, h);
    const target = await tu.json();
    if (!/@protishthan-teacher\.internal$/i.test(String((target && target.email) || ''))) return reply({ error: 'not allowed' }, 403, h);

    const res = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + userId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key },
      body: JSON.stringify({ password: newPassword }),
    });
    if (!res.ok) return reply({ error: 'could not update' }, 502, h);
    return reply({ success: true }, 200, h);
  } catch (e) {
    return reply({ error: 'server error' }, 500, h);   // no internal details to the caller
  }
}
