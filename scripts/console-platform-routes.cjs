const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const platforms = {
  ps3: {
    title: 'PlayStation 3', old: '/console/ps3.html', home: '/console/ps3/',
    anchors: {
      setup493: 'jailbreaks.html#setup493', cfw: 'cfw.html#cfw', hen: 'hen.html#hen',
      homebrew: 'apps.html#homebrew', downloads493: 'downloads.html#downloads493',
      'save-tools': 'save-tools.html#save-tools', mods: 'mods.html#mods', safety: 'jailbreaks.html#safety'
    }
  },
  xbox360: {
    title: 'Xbox 360', old: '/console/xbox360.html', home: '/console/xbox360/',
    anchors: {
      softmod: 'softmod.html#softmod', 'game-downloads': 'downloads.html#game-downloads',
      'more-homebrew': 'payloads.html#more-homebrew', 'desktop-tools': 'tools.html#desktop-tools',
      'app-setup': 'payloads.html#app-setup', 'jtag-rgh': 'hardware.html#jtag-rgh',
      aurora: 'apps.html#aurora', homebrew: 'apps.html#homebrew', 'rgh-app-note': 'apps.html#rgh-app-note',
      'game-mods': 'mods.html#game-mods', mods: 'mods.html#game-mods', safety: 'jailbreaks.html#safety'
    }
  }
};
const esc = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
function routesFor(platform) {
  const data = platforms[platform];
  return {home: data.home, anchors: Object.fromEntries(Object.entries(data.anchors).map(([id, target]) => [id, data.home + target]))};
}
function legacyRedirect(platform) {
  const data = platforms[platform], routes = routesFor(platform);
  const aliases = Object.entries(routes.anchors).map(([id, target]) => `<li><a id="${esc(id)}" href="${esc(target)}">${esc(id.replaceAll('-', ' '))}</a></li>`).join('');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${data.title} pages | whatwhatboy</title><meta name="robots" content="noindex, follow">
<meta name="description" content="Open the ${data.title} landing page or continue to the matching guide, app or tool page.">
<link rel="canonical" href="https://whatwhatboy.com${data.home}"><link rel="stylesheet" href="/style.css?v=3.1.21">
<script id="console-route-data" type="application/json">${JSON.stringify(routes).replaceAll('<', '\\u003c')}</script>
<script defer src="/assets/console-legacy-redirect.js"></script>
<noscript><meta http-equiv="refresh" content="0; url=${data.home}"></noscript></head>
<body data-console-migration="${platform}"><main class="container" style="padding:48px 24px;max-width:760px"><h1>${data.title}</h1><p>Choose a page for guides, apps, tools and downloads.</p><p><a href="${data.home}">Open ${data.title}</a></p><ul>${aliases}</ul></main></body></html>
`;
}
function migrateUrl(value, file) {
  if (!value || /^(?:mailto:|tel:|data:|javascript:|#|\/\/)/i.test(value)) return value;
  let url;
  try { url = new URL(value.replaceAll('&amp;', '&'), 'https://whatwhatboy.com/' + file); } catch { return value; }
  if (url.origin !== 'https://whatwhatboy.com') return value;
  const entry = Object.values(platforms).find(platform => platform.old === url.pathname);
  if (!entry) return value;
  let anchor = '';
  try { anchor = decodeURIComponent(url.hash.slice(1)); } catch { /* Use the landing page. */ }
  const destination = new URL(entry.home + (entry.anchors[anchor] || ''), url.origin);
  destination.search = url.search;
  return destination.pathname + destination.search + destination.hash;
}
function rewriteLinks(html, file) {
  return html.replace(/\bhref="([^"]*)"/g, (all, value) => {
    const next = migrateUrl(value, file);
    return next === value ? all : `href="${esc(next)}"`;
  });
}
function publicHtml(dir) {
  const skip = new Set(['.git', '.agents', '.codex', '.claude', '.playwright', 'node_modules', 'assets', 'docs', 'design-references', 'languages', 'i18n-tools', 'downloads']);
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory()
    ? skip.has(entry.name) ? [] : publicHtml(path.join(dir, entry.name))
    : entry.name.endsWith('.html') ? [path.join(dir, entry.name)] : []);
}
function refreshConsoleRoutes() {
  for (const [id, data] of Object.entries(platforms)) fs.writeFileSync(path.join(root, data.old.slice(1)), legacyRedirect(id));
  let count = 0;
  for (const file of [...publicHtml(root), path.join(root, 'downloads/index.html')]) {
    if (!fs.existsSync(file) || /whatsite-ps[45]\.html$/.test(file)) continue;
    const relative = path.relative(root, file).replaceAll('\\', '/');
    const before = fs.readFileSync(file, 'utf8'), after = rewriteLinks(before, relative);
    if (before !== after) { fs.writeFileSync(file, after); count++; }
  }
  console.log('Updated console navigation in ' + count + ' pages; legacy links forward to their matching topics.');
}
if (require.main === module) refreshConsoleRoutes();
module.exports = {platforms, routesFor, legacyRedirect, migrateUrl, rewriteLinks, refreshConsoleRoutes};
