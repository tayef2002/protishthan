# Search-engine (SEO) setup

What makes protishthan.com readable for Google, Bing and link previews. Everything is public information already shown on the site.

| What | Where |
|---|---|
| Which pages may be indexed | `robots.txt` (points to the sitemap); private pages carry `<meta name="robots" content="noindex,nofollow">` (added by `tools/seo/patch_head.js`) |
| Real "not found" answers | `404.html` (before this, every wrong address answered 200 with the home page) |
| Files that are not the website (plans, SQL, server code) answer 404 | `functions/_middleware.js` + `_routes.json` |
| One institution page, with title, description, canonical, structured data and a readable summary in the first HTML | `functions/institution-detail.js` |
| District / upazila / kind pages (`/area/...`), so every institution is reachable by plain links | `functions/area/[[path]].js` |
| Sitemaps | `/sitemap.xml` (index) → `sitemap-pages.xml` (file, rebuilt by `node tools/seo/build_sitemap.js`), `/sitemap-areas.xml`, `/sitemap-institutions/<n>` (5,000 per file) |
| Database side | `migrations/2026-12-13_seo_sitemaps.sql` (run once). After every big import run `select public.refresh_seo_area_counts();` so the area numbers follow. |
| Check | `node tools/seo/test_functions.js` (no internet needed) |

When `software.html` is released: remove its `noindex` line and add it to `PAGES` in `build_sitemap.js`.
When a new public page is added: give it a title, description and canonical, add it to `PAGES`, run `build_sitemap.js`.
