const fs = require('node:fs');
const path = require('node:path');
const {page, section, grid, link, ext, esc} = require('./build-console-guides.cjs');
const root = path.resolve(__dirname, '..');
function build() {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'docs/console-vault-resources.json'), 'utf8'));
  const h = value => esc(String(value));
  const cards = data.resources.map(item => {
    const url = new URL(item.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw Error('Unsafe Vault website URL');
    const guideId = 'guide-' + item.id;
    return `<article class="guide-resource" id="${h(item.id)}">${require('./console-rest-card-images.cjs').markup('console/vault.html',item.name)}<p>${h(item.category)}</p><h3>${h(item.name)}</h3><p>${h(item.description)}</p><ul class="guide-resource-tags" aria-label="Tags">${item.tags.map(tag => `<li class="feature-tag">${h(tag)}</li>`).join('')}</ul><div class="guide-links"><a href="#${h(guideId)}" data-guide-open>Guide &amp; link check</a>${ext(item.url, 'Open website')}${item.source ? ext(item.source, 'Original Discord post') : ''}</div><section id="${h(guideId)}" data-guide-panel data-guide-title="${h(item.name + ' · Usage guide')}"><h4>Usage notes</h4><p>${h(item.guide)}</p><p>${h(item.accessCheck)}</p></section></article>`;
  });
  page('console/vault.html', 'The Vault · Console Reference Websites',
    'PKG-Zone, OrbisPatches, Garlicsaves, PlayStation firmware archives, SuperPSX and Vimm’s Lair, with usage notes and website-check status.',
    '/assets/images/consoles/playstation.jpg', [['/console/', 'Consoles'], ['/console/vault.html', 'The Vault'], ['/console/mods/', 'Mods / Mod Menus']],
    section('websites', 'Websites from The Vault', grid(...cards)) +
    section('game-guides', 'Game-specific menus and guides', `<p>Use the game collections for the menu’s exact platform, game update, build and supplied instructions.</p><div class="guide-links">${link('/console/mods/ps4/', 'PS4/PS5 games')}${link('/console/ps3/mods.html', 'PS3 games')}${link('/console/xbox360/mods.html', 'Xbox 360 mods')}${link('/pc/discord-mods/index.html', 'PC menus')}</div>`), '#websites', 'Browse websites');
  const hub = path.join(root, 'console/index.html');
  let html = fs.readFileSync(hub, 'utf8');
  const start = '<!-- console-vault:start -->', end = '<!-- console-vault:end -->';
  const oldStart = html.indexOf(start), oldEnd = html.indexOf(end);
  if (oldStart >= 0 && oldEnd > oldStart) html = html.slice(0, oldStart) + html.slice(oldEnd + end.length);
  const marker = /(    <\/div>\r?\n\s*)(?=<script src="\.\.\/script\.js)/;
  if (!marker.test(html)) throw Error('Console hub insertion marker missing');
  const content = start + section('vault', 'The Vault', '<p>Reference websites for homebrew apps, save tools, game-update lookup and PlayStation firmware archives.</p><div class="guide-links">' + link('/console/vault.html', 'Browse The Vault') + '</div>') + end;
  html = html.replace(marker, (_, close) => content + '\n' + close);
  fs.writeFileSync(hub, html);
  const sitemapPath = path.join(root, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const url = 'https://whatwhatboy.com/console/vault.html';
  if (!sitemap.includes('<loc>' + url + '</loc>')) {
    sitemap = sitemap.replace('</urlset>', `  <url><loc>${url}</loc><lastmod>2026-11-02</lastmod></url>\n</urlset>`);
    fs.writeFileSync(sitemapPath, sitemap);
  }
  console.log('Built The Vault with ' + cards.length + ' reference websites.');
}
module.exports = {build};
if (require.main === module) build();
