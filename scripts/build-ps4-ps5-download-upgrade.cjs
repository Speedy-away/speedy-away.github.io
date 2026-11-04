// Scoped local build: no downloads, companion mutation, deployment or other-platform builds.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
for (const script of ['build-ps4-software.cjs', 'build-ps5-software.cjs', 'build-console-archive-guide.cjs', 'build-console-launchers.cjs', 'build-ps4-transfer-tools.cjs', 'build-ps4-extra-game-pages.cjs', 'build-ps4-ps5-customization.cjs', 'build-console-game-patches.cjs', 'build-ps5-game-cheats.cjs', 'build-ps5-mods.cjs']) {
  execFileSync(process.execPath, [path.join(__dirname, script)], {cwd:root, stdio:'inherit'});
}
// Source pages must exist before resolving each download's exact guide URL.
execFileSync(process.execPath, [path.join(__dirname, 'build-console-downloads.cjs')], {cwd:root, stdio:'inherit'});
execFileSync(process.execPath, [path.join(__dirname, 'build-ps4-ps5-cod.cjs'), '--multi-game-only'], {cwd:root, stdio:'inherit'});
execFileSync(process.execPath, [path.join(__dirname, 'build-download-library.cjs')], {cwd:root, stdio:'inherit'});
const pages = [
  'console/ps4/downloads.html', 'console/ps5/downloads.html',
  'console/ps4/apps.html', 'console/ps4/payloads.html', 'console/ps4/transfer-tools.html',
  'console/ps5/mods.html', 'console/ps5/game-cheats.html',
  ...require('./build-ps5-game-cheats.cjs').collect().map(game => `console/ps5/game-cheats/${game.slug}/index.html`),
  'console/ps5/apps.html', 'console/ps5/payloads.html', 'console/ps5/transfer-tools.html',
  'console/ps4/archive-files.html', 'console/ps4/site-launcher.html', 'console/ps5/site-launcher.html',
  'console/ps5/payload-manager.html', 'console/ps4/game-patches.html', 'console/ps5/game-patches.html', 'console/ps4/themes.html', 'console/ps5/themes.html',
  'console/mods/ps4/index.html', 'console/mods/ps4/menus.html',
  'console/mods/ps4/call-of-duty/index.html', 'console/mods/ps4/call-of-duty/multicod/index.html',
  ...['black-ops-1', 'black-ops-2', 'wwii', 'ghosts', 'black-ops-3', 'advanced-warfare', 'modern-warfare-remastered'].map(game => `console/mods/ps4/call-of-duty/${game}/index.html`),
  ...['other-games', ...JSON.parse(fs.readFileSync(path.join(root,'docs/ps4-ps5-game-resources.json'),'utf8')).games.filter(game=>game.parent==='other-games').map(game=>game.slug)].map(game => `console/mods/ps4/${game}/index.html`),
  'downloads/index.html'
];
execFileSync(process.execPath, [path.join(__dirname, 'update-page-metadata.cjs'), ...pages.flatMap(page => ['--page', page])], {cwd:root, stdio:'inherit'});
const {improve: integrateBackground} = require('./apply-site-background.cjs');
for (const page of pages) {
  const file = path.join(root, page), before = fs.readFileSync(file, 'utf8');
  const after = integrateBackground(before, file);
  if (after !== before) fs.writeFileSync(file, after);
}
// Re-read the shared sitemap immediately before the additive write.
const sitemapPath = path.join(root, 'sitemap.xml');
let sitemap = fs.readFileSync(sitemapPath, 'utf8');
const urls = pages.map(page => 'https://whatwhatboy.com/' + page.replace(/index\.html$/, ''));
const additions = urls.filter(url => !sitemap.includes('<loc>' + url + '</loc>'));
if (additions.length) {
  sitemap = sitemap.replace('</urlset>', additions.map(url => `  <url><loc>${url}</loc><lastmod>2026-11-02</lastmod></url>`).join('\n') + '\n</urlset>');
  fs.writeFileSync(sitemapPath, sitemap);
}
console.log(`PS4/PS5 download upgrade built; ${additions.length} sitemap URLs added. Archived companions preserved.`);
