const SUPABASE_URL = 'https://eoqeeuujvpydhmfteqqj.supabase.co';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  try {
    const { user_id, new_password } = await context.request.json();
    if (!user_id || !new_password) {
      return Response.json({ error: 'user_id and new_password required' }, { status: 400, headers: CORS });
    }

    const serviceKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return Response.json({ error: 'Service key not configured' }, { status: 500, headers: CORS });
    }

    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ password: new_password }),
    });

    const json = await res.json();
    if (!res.ok) {
      return Response.json({ error: json.message || 'Failed to update password' }, { status: res.status, headers: CORS });
    }

    return Response.json({ success: true }, { headers: CORS });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500, headers: CORS });
  }
}
