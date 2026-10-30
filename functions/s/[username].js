// protishthan.com/s/<username> — the public skill-identity page.
// The page itself is the static /s.html. This function adds what link-preview bots (Facebook, WhatsApp, Telegram, Google)
// need and cannot get from client-side JavaScript: the person's name, headline and skills as <title> / description /
// Open Graph tags, a preview image, and the profile data itself (so the page paints without a second request).
// Only a published, not-hidden profile is ever read (through the get_skill_profile() database function).

const SB = 'https://eoqeeuujvpydhmfteqqj.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvcWVldXVqdnB5ZGhtZnRlcXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTM2NTgsImV4cCI6MjA5NzE4OTY1OH0.xuC-_euxf0DTqTpD5b8_6vgnkjeJjZIFqdKw-Bq3YbU';
const SITE = 'https://protishthan.com';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

async function loadProfile(username) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 2500);
  try {
    const r = await fetch(SB + '/rest/v1/rpc/get_skill_profile', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_username: username }),
      signal: ctl.signal,
    });
    if (!r.ok) return undefined;               // undefined = "could not find out": let the page ask for itself
    return await r.json();                      // an object, or null when it does not exist / is not public
  } catch (e) {
    return undefined;
  } finally {
    clearTimeout(t);
  }
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const raw = Array.isArray(params.username) ? params.username[0] : params.username;
  const username = String(raw || '').toLowerCase();
  const valid = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(username);

  const page = await env.ASSETS.fetch(new Request(new URL('/s', request.url), { headers: request.headers }));
  if (!page.ok) return page;

  const profile = valid ? await loadProfile(username) : null;

  let meta = '';
  let status = 200;
  let pageTitle = '';
  if (profile) {
    const skills = (profile.skills || []).map(s => s.n).slice(0, 6);
    const title = clip(profile.display_name + (profile.headline ? ' — ' + profile.headline : ''), 70) + ' | Protishthan';
    const desc = clip((profile.headline ? profile.headline + '. ' : '') + (skills.length ? 'স্কিল: ' + skills.join(', ') + '. ' : '') + 'স্ব-ঘোষিত স্কিল আইডেন্টিটি।', 190);
    const url = SITE + '/s/' + profile.username;
    const img = SB + '/storage/v1/object/public/skill-og/' + profile.og_key + '.jpg?v=' + profile.og_version;
    const ld = {
      '@context': 'https://schema.org', '@type': 'ProfilePage', url, name: title,
      mainEntity: { '@type': 'Person', name: profile.display_name, jobTitle: profile.headline || undefined, knowsAbout: skills, url },
    };
    meta =
      '<meta name="description" content="' + esc(desc) + '">' +
      '<meta name="robots" content="index,follow,max-image-preview:large">' +
      '<link rel="canonical" href="' + esc(url) + '">' +
      '<meta property="og:type" content="profile"><meta property="og:site_name" content="Protishthan">' +
      '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">' +
      '<meta property="og:url" content="' + esc(url) + '"><meta property="og:image" content="' + esc(img) + '">' +
      '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' +
      '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + esc(title) + '">' +
      '<meta name="twitter:description" content="' + esc(desc) + '"><meta name="twitter:image" content="' + esc(img) + '">' +
      '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>';
    meta += '<script id="boot" type="application/json">' + JSON.stringify(profile).replace(/</g, '\\u003c') + '</script>';
    pageTitle = title;
  } else if (profile === null) {
    // not found / not public: keep it out of search and say so to the page without another request
    status = 404;
    meta = '<meta name="robots" content="noindex,nofollow"><script id="boot" type="application/json">null</script>';
  } else {
    meta = '<meta name="robots" content="noindex">';      // could not reach the database: the page will try for itself
  }

  const rewritten = new HTMLRewriter()
    .on('title', { element(e) { if (pageTitle) e.setInnerContent(pageTitle); } })
    .on('head', { element(e) { e.append(meta, { html: true }); } })
    .transform(page);

  const headers = new Headers(rewritten.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=60');
  return new Response(rewritten.body, { status, headers });
}
