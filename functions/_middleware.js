// Runs only for the paths listed in _routes.json. The whole project folder is published, so files that are not part of the website
// (plans, database scripts, server code, old work files) were reachable by address and could even be found by Google.
// They answer "not found" now. The website itself is untouched: only these names are blocked.

const NOT_THE_WEBSITE = /^\/(migrations|social-server|tools|_archive|data|video)(\/|$)|^\/(PROJECT_CONTEXT|MARKETING_PLAN|PLAN)\.md$|^\/(server|classroom-server)\.js$|^\/package(-lock)?\.json$|^\/migration_all\.sql$|^\/\.gitignore$/;

export async function onRequest(context) {
  const path = new URL(context.request.url).pathname;
  if (NOT_THE_WEBSITE.test(path)) {
    let body = 'Not found', type = 'text/plain; charset=utf-8';
    try {
      const page = await context.env.ASSETS.fetch(new Request(new URL('/404.html', context.request.url)));
      if (page.ok) { body = await page.text(); type = 'text/html; charset=utf-8'; }
    } catch (e) {}
    return new Response(body, { status: 404, headers: { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  }
  return context.next();
}
