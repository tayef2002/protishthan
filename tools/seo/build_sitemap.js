// Builds sitemap-pages.xml: the fixed public pages, each with the real date of its last change (from git).
// Run from the repo root after changing a public page:  node tools/seo/build_sitemap.js
// The institution and area pages are not listed here: they come from the database through /sitemap.xml (functions/sitemap*.js).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..', '..');
const SITE = 'https://protishthan.com';

// [address, file that holds the page]. software.html is left out on purpose while it is marked noindex.
const PAGES = [
  ['/', 'index.html'], ['/info', 'info.html'], ['/card', 'card.html'], ['/skill', 'skill.html'], ['/list-institution', 'list-institution.html'],
  ['/partner', 'partner.html'], ['/about', 'about.html'], ['/privacy', 'privacy.html'], ['/terms', 'terms.html'],
  ['/guide', 'guide.html'], ['/gpa', 'gpa.html'], ['/cgpa', 'cgpa.html'], ['/eiin', 'eiin.html'], ['/choose-institution', 'choose-institution.html'],
  ['/result-check', 'result-check.html'], ['/xi-admission', 'xi-admission.html'], ['/education-streams', 'education-streams.html'], ['/verify-university', 'verify-university.html'], ['/certificate-guide', 'certificate-guide.html'],
  ['/tutor', 'tutor.html'],
];

function lastChange(file) {
  try {
    const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: root, encoding: 'utf8' }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  } catch (e) {}
  return null;
}

const body = PAGES.map(([url, file]) => {
  if (!fs.existsSync(path.join(root, file))) throw new Error('missing ' + file);
  if (/name="robots"[^>]*noindex/.test(fs.readFileSync(path.join(root, file), 'utf8'))) throw new Error(file + ' is noindex: remove it from the sitemap');
  const d = lastChange(file);
  return '  <url><loc>' + SITE + url + '</loc>' + (d ? '<lastmod>' + d + '</lastmod>' : '') + '</url>';
}).join('\n');
fs.writeFileSync(path.join(root, 'sitemap-pages.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + '\n</urlset>\n');
console.log('sitemap-pages.xml written,', PAGES.length, 'pages');
