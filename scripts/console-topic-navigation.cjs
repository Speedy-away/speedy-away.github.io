// Keep primary console navigation pointed at the topic hubs while retaining
// versioned downloads, library links and historic deep links verbatim.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifestFiles = ['docs/console-topic-platforms-retro.json', 'docs/console-topic-platforms-modern.json'];
const skip = new Set(['.git', '.agents', '.codex', '.claude', '.playwright', '.playwright-cli', 'node_modules', 'assets', 'docs', 'design-references', 'downloads', 'languages', 'i18n-tools', 'scripts', 'tmp']);
function normalized(file = '') {
  return (path.isAbsolute(file) ? path.relative(root, file) : file).replaceAll('\\', '/').replace(/^\/+/, '');
}
function platforms() {
  return manifestFiles.flatMap(file => {
    const target = path.join(root, file);
    if (!fs.existsSync(target)) return [];
    const manifest = JSON.parse(fs.readFileSync(target, 'utf8'));
    return Array.isArray(manifest) ? manifest : manifest.platforms || [];
  }).map(platform => {
    const hubFile = (platform.hubFile || platform.base + 'index.html').replace(/^\/+/, '');
    return {...platform, hubFile, hub: '/' + hubFile.replace(/index\.html$/, '')};
  }).filter(platform => fs.existsSync(path.join(root, platform.hubFile)));
}
function protectedFile(file, html) {
  const relative = normalized(file);
  return /(?:^|\/)whatsite-ps[45]\.html$/i.test(relative) ||
    relative.startsWith('downloads/') && relative !== 'downloads/index.html' ||
    /id=["']receiver-catalog["']/.test(html);
}
function localURL(value, file) {
  if (!value || value.startsWith('#') || /^(?:mailto:|javascript:|data:)/i.test(value)) return null;
  try {
    const url = new URL(value.replaceAll('&amp;', '&'), 'https://whatwhatboy.com/' + (normalized(file) || 'console/index.html'));
    return url.origin === 'https://whatwhatboy.com' ? url : null;
  } catch { return null; }
}
function matchSource(pathname, platform) {
  const source = '/' + platform.source.replace(/^\/+/, '');
  const aliases = [...(platform.aliases || []), ...(platform.id === 'psvita' ? ['/console/psvita/', '/console/psvita/index.html'] : [])];
  return pathname === source || aliases.includes(pathname) || source.endsWith('/index.html') && pathname === source.replace(/index\.html$/, '');
}
function resolveRoute(value, file = 'console/index.html', available = platforms()) {
  const url = localURL(value, file);
  if (!url || url.search || url.hash) return value;
  return available.find(platform => matchSource(url.pathname, platform))?.hub || value;
}
function entryFor(file, available = platforms()) {
  const relative = normalized(file);
  return available.find(platform => relative === (platform.id === 'psvita' ? 'console/psvita/index.html' : platform.source.replace(/^\/+/, '')))?.hub || null;
}
function applyEntry(file, html, available) {
  const entry = entryFor(file, available);
  if (!entry || !/<body\b/i.test(html)) return html;
  html = html.replace(/<body\b[^>]*>/i, body => {
    const attribute = `data-console-topic-entry="${entry}"`;
    return /\bdata-console-topic-entry=/.test(body)
      ? body.replace(/\bdata-console-topic-entry=(["'])[^"']*\1/, attribute)
      : body.replace(/>$/, ` ${attribute}>`);
  });
  if (!html.includes('/assets/console-topic-entry.js')) {
    const script = '<script defer src="/assets/console-topic-entry.js?v=1"></script>';
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, script + '\n</head>') : html.replace(/<\/body>/i, script + '\n</body>');
  }
  return require('./apply-site-background.cjs').improve(html, file);
}
function apply(file, html, options = {}) {
  if (protectedFile(file, html)) return html;
  const available = options.platforms || platforms();
  if (!available.length) return html;
  const currentPath = '/' + normalized(file);
  const current = available.find(platform => currentPath === '/' + platform.hubFile || currentPath.startsWith(platform.base) || matchSource(currentPath, platform));
  const output = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, anchor => {
    const start = anchor.match(/^<a\b[^>]*>/i)?.[0];
    if (!start || /\b(?:data-console-library|data-theme-navigation)\b/.test(start)) return anchor;
    const match = start.match(/\bhref=(["'])([^"']*)\1/i);
    if (!match) return anchor;
    let destination = resolveRoute(match[2], file, available);
    // The older Retro directory linked directly into Vita's complete library.
    // Keep deliberate library links intact and upgrade only its Explore card.
    if (destination === match[2] && /Explore\s+PS\s+Vita/i.test(anchor.replace(/<[^>]*>/g, ''))) {
      const url = localURL(match[2], file);
      const vita = available.find(platform => platform.id === 'psvita');
      if (vita && url?.pathname === '/console/psvita/library.html' && !url.search && !url.hash) destination = vita.hub;
    }
    let updated = start.replace(match[0], 'href=' + match[1] + destination + match[1]);
    if (current && /\bclass=["'][^"']*\bnav-link\b/.test(updated)) {
      updated = updated.replace(/\saria-current=["'][^"']*["']/gi, '').replace(/(\bclass=["'])([^"']*)(["'])/i, (_, open, classes, close) => open + classes.split(/\s+/).filter(value => value !== 'active').join(' ') + close);
      if (destination === current.hub) updated = updated.replace(/(\bclass=["'])([^"']*)(["'])/i, '$1$2 active$3').replace(/>$/, ' aria-current="page">');
    }
    return updated + anchor.slice(start.length);
  });
  return applyEntry(file, output, available);
}
function publicPages(directory = root) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => entry.isDirectory()
    ? skip.has(entry.name) ? [] : publicPages(path.join(directory, entry.name))
    : entry.name.endsWith('.html') ? [path.join(directory, entry.name)] : []);
}
function main({check = false} = {}) {
  let changed = 0;
  const files = [...publicPages(), path.join(root, 'downloads/index.html')].filter(file => fs.existsSync(file));
  for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const after = apply(file, before);
    if (before === after) continue;
    changed++;
    if (!check) fs.writeFileSync(file, after);
  }
  return {checked: files.length, changed, hubs: platforms().length, mode: check ? 'check' : 'write'};
}
module.exports = {apply, main, platforms, resolveRoute, protectedFile, entryFor};
if (require.main === module) {
  const check = process.argv.includes('--check');
  const report = main({check});
  console.log(JSON.stringify(report));
  if (check && report.changed) process.exitCode = 1;
}
