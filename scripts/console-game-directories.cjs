// Console-specific external game directories; existing ready files are untouched.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const registry = () => JSON.parse(fs.readFileSync(path.join(root, 'docs/console-game-directories.json'), 'utf8'));
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const normalized = file => (/^\/(?:console|downloads|pc|source-codes)\//.test(file) ? file : path.isAbsolute(file) ? path.relative(root, file) : file).replaceAll('\\', '/').replace(/^\/+/, '').split(/[?#]/)[0];
const directoryPath = platform => platform.base + 'game-downloads.html';
function platformFor(file, data = registry()) {
  const current = '/' + normalized(file);
  return data.platforms.find(p => current.startsWith(p.base) || current === p.hub || current === '/' + p.source || (p.aliases || []).includes(current)) || null;
}
function protectedFile(file, html) {
  const current = normalized(file);
  return current.startsWith('downloads/') || /(?:^|\/)whatsite-ps[45]\.html$/.test(current) || /\bid=["']receiver-catalog["']/.test(html);
}
function range(html, tag, predicate) {
  const tags = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
  let opening;
  while ((opening = tags.exec(html))) if (predicate(opening[0])) {
    const same = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    same.lastIndex = tags.lastIndex;
    let depth = 1, token;
    while (depth && (token = same.exec(html))) depth += token[1] ? -1 : 1;
    return depth ? null : {start: opening.index, content: tags.lastIndex, close: token.index, end: same.lastIndex};
  }
  return null;
}
function hubCard(platform) {
  const detail = platform.providers.length ? `Find ${platform.title} game directories, with direct links to the matching console categories.` : 'Browse game directories by console and choose the system listed by the provider.';
  return `<article class="guide-resource" data-console-game-card="${platform.id}"><img src="${esc(platform.image)}" alt="${esc(platform.title)} game downloads" loading="lazy"><h3>Game downloads</h3><p>${esc(detail)}</p><div class="guide-links"><a href="${directoryPath(platform)}">Browse game downloads <i class="fas fa-arrow-right" aria-hidden="true"></i></a></div></article>`;
}
function apply(file, html, data = registry()) {
  if (protectedFile(file, html) || !/<main\b|<div\b[^>]*\bid="main-content"/i.test(html)) return html;
  const platform = platformFor(file, data);
  if (!platform) return html;
  const destination = directoryPath(platform);
  const item = `<a data-console-game-nav href="${destination}"${'/' + normalized(file) === destination ? ' aria-current="page"' : ''}>Game downloads</a>`;
  let hasNav = false;
  html = html.replace(/<nav\b(?=[^>]*class="[^"]*\bguide-nav\b)[^>]*>[\s\S]*?<\/nav>/g, nav => {
    hasNav = true;
    return nav.includes(`href="${destination}"`) ? nav : nav.replace('</nav>', item + '</nav>');
  });
  if (!hasNav) html = html.replace(/<main\b[^>]*>|<div\b(?=[^>]*\bid="main-content")[^>]*>/i, main => main + `<div class="container"><nav class="guide-nav" aria-label="${esc(platform.title)} game downloads">${item}</nav></div>`);
  const current = '/' + normalized(file), hubFile = platform.hub.endsWith('/') ? platform.hub + 'index.html' : platform.hub;
  if (current === destination && platform.directoryMode === 'curated-library') {
    const block = directorySection(platform);
    const existing = range(html, 'section', tag => /\bid="game-directories"/.test(tag));
    if (existing) html = html.slice(0, existing.start) + block + html.slice(existing.end);
    else {
      const footer = range(html, 'footer', tag => /\bclass="[^"]*\bguide-footer\b/.test(tag));
      const main = range(html, 'main', () => true) || range(html, 'div', tag => /\bid="main-content"/.test(tag));
      const position = footer?.start ?? main?.close;
      if (position !== undefined) html = html.slice(0, position) + block + html.slice(position);
    }
  }
  if (current === hubFile) {
    const existing = range(html, 'article', tag => tag.includes(`data-console-game-card="${platform.id}"`));
    if (existing) html = html.slice(0, existing.start) + html.slice(existing.end);
    const start = range(html, 'section', tag => /\bid="start"/.test(tag));
    if (start) {
      const section = html.slice(start.start, start.end);
      const grid = range(section, 'div', tag => /\bclass="[^"]*\bgames-grid\b/.test(tag));
      if (grid) {
        const position = start.start + grid.content;
        html = html.slice(0, position) + hubCard(platform) + html.slice(position);
      } else {
        const marker = '<!-- console-game-directory-card -->';
        // The Original Xbox start section is a text guide rather than a grid.
        const empty = /<!-- console-game-directory-card --><div class="container"><div class="games-grid"><\/div><\/div>/;
        html = html.replace(empty, '');
        const freshStart = range(html, 'section', tag => /\bid="start"/.test(tag));
        const block = marker + `<div class="container"><div class="games-grid">${hubCard(platform)}</div></div>`;
        html = html.slice(0, freshStart.end) + block + html.slice(freshStart.end);
      }
    }
  }
  return require('./category-card-art.cjs').apply(normalized(file), html);
}
function external(url, label) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw Error('Invalid game-directory URL');
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} <i class="fas fa-external-link-alt" aria-hidden="true"></i></a>`;
}
function providerCard(provider, platform = null) {
  const accessed = ['retrieved', 'retrieved-after-redirect'].includes(provider.status);
  const check = accessed ? 'The directory page was retrieved. Individual game downloads were not checked.' : 'Automated access to this directory could not be confirmed. The original link is retained; individual game availability has not been checked.';
  return `<article class="guide-resource">${require('./merged-category-covers.cjs').directory(platform)}<p>External game directory</p><h3>${esc(provider.label)}</h3><p>${esc(provider.description)}</p><div class="guide-links">${external(provider.url, 'Open game directory')}</div><details><summary>Link check</summary><p>${esc(check)}</p></details></article>`;
}
function directorySection(platform) {
  const title = `External ${esc(platform.title)} game directories`;
  const content = platform.providers.length
    ? `<div class="games-grid">${platform.providers.map(provider => providerCard(provider, platform)).join('\n')}</div>`
    : '<div class="guide-links"><a href="/console/game-downloads/">Browse all console directories <i class="fas fa-arrow-right" aria-hidden="true"></i></a></div>';
  return `<section class="section" id="game-directories"><div class="container"><div class="section-header"><h2 class="section-title">${title}</h2><p class="section-subtitle">Open the matching console category on an external website.</p></div>${content}</div></section>`;
}
function prepare(file) {
  const target = path.join(root, file);
  let html = fs.readFileSync(target, 'utf8');
  html = html.replace(/<div class="container guide-hero-grid(?: guide-hero-text)?">/, '<div class="container guide-hero-grid guide-hero-text">').replace(/<img src="[^"]*" alt="[^"]*" width="1280" height="720">/, '');
  html = require('./apply-site-background.cjs').improve(html, file);
  fs.writeFileSync(target, require('./search-page-output.cjs').finish(file, html));
}
function updatePublicPages({check = false} = {}) {
  const skip = new Set(['.git', '.agents', '.codex', '.claude', 'node_modules', 'assets', 'docs', 'downloads', 'languages', 'i18n-tools', 'scripts', 'tmp', 'design-references']);
  const files = directory => fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? skip.has(entry.name) ? [] : files(path.join(directory, entry.name)) : entry.name.endsWith('.html') ? [path.join(directory, entry.name)] : []);
  const data = registry();
  let changed = 0, checked = 0;
  for (const file of files(path.join(root, 'console'))) {
    const before = fs.readFileSync(file, 'utf8');
    if (protectedFile(file, before)) continue;
    checked++;
    const after = apply(file, before, data);
    if (after !== before) { changed++; if (!check) fs.writeFileSync(file, after); }
  }
  return {checked, changed, mode: check ? 'check' : 'write'};
}
function build() {
  const data = registry();
  const guides = require('./build-console-guides.cjs');
  const files = [];
  for (const platform of data.platforms) {
    // This route has its own ready-file library builder. Preserve that page;
    // generic provider rendering must not replace its games and setup details.
    if (platform.directoryMode === 'curated-library') continue;
    const destination = directoryPath(platform), file = destination.slice(1);
    const content = platform.providers.length
      ? guides.section('game-directories', `${esc(platform.title)} game downloads`, guides.grid(...platform.providers.map(provider => providerCard(provider, platform))), 'Choose an external directory for this console.')
      : guides.section('game-directories', 'Browse games by console', `<p>Browse the all-console index and choose the exact platform named by the source website.</p><div class="guide-links"><a href="/console/game-downloads/">Browse all console directories <i class="fas fa-arrow-right" aria-hidden="true"></i></a></div>`);
    guides.page(file, `${platform.title} Game Downloads`, `External game directories for ${platform.title}. Open a source website and check its console, region and file-format details.`, platform.image, [[platform.hub, platform.title], [destination, 'Game downloads'], ['/console/game-downloads/', 'All consoles']], content + guides.section('more-directories', 'More game directories', `<div class="guide-links"><a href="/console/game-downloads/">All console game directories <i class="fas fa-arrow-right" aria-hidden="true"></i></a>${external('https://vimm.net/vault', 'Vimm’s Vault · all systems')}${external('https://dlpsgame.com/', 'DLPSGame · all games')}</div>`), '#game-directories', 'Browse game directories');
    prepare(file);
    files.push(file);
  }
  const cards = data.platforms.filter(p => p.providers.length).map(p => guides.resource(esc(p.title), `${p.providers.length} external game ${p.providers.length === 1 ? 'directory' : 'directories'} for this console.`, `<a href="${directoryPath(p)}">Browse game downloads <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`, p.image));
  const more = data.vaultSystems.map(item => `<li>${external(item.url, item.label)}</li>`).join('');
  const file = 'console/game-downloads/index.html';
  guides.page(file, 'Console Game Downloads', 'Find console-specific game directories, including Vimm’s Lair, DLPSGame, DownloadGamePSP, NSWGame and NSWGF.', '/assets/images/custom-console-art/xbox360-game-library.jpg', [['/console/', 'Consoles'], ['/console/game-downloads/', 'Game downloads'], ['/console/vault.html', 'The Vault']], guides.section('consoles', 'Choose your console', guides.grid(...cards)) + guides.section('all-websites', 'All game websites', guides.grid(...data.general.map(provider=>providerCard(provider)))) + guides.section('more-systems', 'More systems in Vimm’s Vault', `<ul class="guide-source-list">${more}</ul><p>For the other consoles, WiiWare and earlier systems shown in The Vault, open the full system index.</p><div class="guide-links">${external('https://vimm.net/vault', 'Browse every system in The Vault')}</div>`), '#consoles', 'Choose your console');
  prepare(file);
  files.push(file);
  // Add an entry to the existing general download page without replacing its cards.
  const general = path.join(root, 'games-downloads/index.html');
  let html = fs.readFileSync(general, 'utf8');
  if (!html.includes('id="console-game-downloads"')) {
    const block = guides.section('console-game-downloads', 'Console game downloads', `<p>Choose a console to find the matching Vimm’s Lair, DLPSGame, PSP / Vita or Nintendo game directories.</p><div class="guide-links"><a href="/console/game-downloads/">Browse console game downloads <i class="fas fa-arrow-right" aria-hidden="true"></i></a></div>`);
    html = html.replace(/<section\b[^>]*\bid="downloads"[^>]*>/i, opening => block + opening);
  }
  html = html.replace('Launchers, modpacks, and legacy editions. Everything here is free and links straight to the official source.', 'Game launchers, fan projects and console game directories. Choose a section to browse its sources.');
  fs.writeFileSync(general, html);
  const sitemapFile = path.join(root, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapFile, 'utf8');
  for (const item of files) {
    const url = 'https://whatwhatboy.com/' + item.replace(/index\.html$/, '');
    if (!sitemap.includes('<loc>' + url + '</loc>')) sitemap = sitemap.replace('</urlset>', `  <url><loc>${url}</loc><lastmod>2026-11-02</lastmod></url>\n</urlset>`);
  }
  fs.writeFileSync(sitemapFile, sitemap);
  require('./build-console-topic-hubs.cjs').finalizeMetadata(files);
  files.forEach(prepare);
  const integration = updatePublicPages();
  return {platforms: data.platforms.length, platformLinks: data.platforms.reduce((n, p) => n + p.providers.length, 0), files, integration};
}
module.exports = {registry, directoryPath, platformFor, protectedFile, apply, updatePublicPages, build};
if (require.main === module) console.log(JSON.stringify(process.argv.includes('--check') ? updatePublicPages({check: true}) : build(), null, 2));
