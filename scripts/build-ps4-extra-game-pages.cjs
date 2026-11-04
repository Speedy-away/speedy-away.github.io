// Rebuild only the newly added game pages. Preserve concurrent GTA/RDR/COD work.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const imports = require('./build-ps4-ps5-game-imports.cjs').createGameImports();
const gameIds = ['other-games', ...imports.data.games.filter(game => game.parent === 'other-games').map(game => game.id)];
imports.buildMods({gameIds});
const patchLinks=require('./extra-game-patch-links.cjs');
const patches=JSON.parse(fs.readFileSync(path.join(root,'docs/ps4-ps5-game-patches.json'),'utf8'));
for(const game of imports.data.games.filter(game=>game.parent==='other-games')){
  const file=path.join(root,'console/mods/ps4',game.slug,'index.html');
  const html=fs.readFileSync(file,'utf8');
  const updated=patchLinks.appendPatchLinks(html,patchLinks.relatedPatches(game.id,imports.data.resources,patches));
  if(updated!==html)fs.writeFileSync(file,updated);
}
const target = path.join(root, 'console/mods/ps4/index.html');
let html = fs.readFileSync(target, 'utf8');
const start = '<!-- extra-game-chooser:start -->';
const end = '<!-- extra-game-chooser:end -->';
html = html.replace(/<!-- extra-game-chooser:start -->[\s\S]*?<!-- extra-game-chooser:end -->/, '');
const sectionStart = html.indexOf('<section class="section" id="games">');
const sectionEnd = html.indexOf('</section>', sectionStart);
if (sectionStart < 0 || sectionEnd < 0) throw Error('PS4 game chooser section missing');
const section = html.slice(sectionStart, sectionEnd);
// A full mod rebuild already includes the additive card through extraGameCards().
if (!section.includes('href="/console/mods/ps4/other-games/"')) {
  const closingGrid = html.lastIndexOf('</div></div>', sectionEnd);
  if (closingGrid < sectionStart) throw Error('PS4 game chooser grid missing');
  html = html.slice(0, closingGrid) + start + imports.extraGameCards() + end + html.slice(closingGrid);
}
fs.writeFileSync(target, html);
require('./console-mod-catalog.cjs').build();
// Read the latest shared sitemap immediately before its additive merge.
const sitemapFile = path.join(root, 'sitemap.xml');
let sitemap = fs.readFileSync(sitemapFile, 'utf8');
const routes = gameIds.map(id => imports.data.games.find(game => game.id === id)).map(game => 'https://whatwhatboy.com/console/mods/ps4/' + game.slug + '/');
const additions = routes.filter(url => !sitemap.includes('<loc>' + url + '</loc>')).map(url => `  <url><loc>${url}</loc><lastmod>2026-11-02</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
if (additions.length) {
  if (!sitemap.includes('</urlset>')) throw Error('Shared sitemap closing tag missing');
  sitemap = sitemap.replace('</urlset>', additions.join('\n') + '\n</urlset>');
  fs.writeFileSync(sitemapFile, sitemap);
}
console.log('Built Other Games, ' + (gameIds.length - 1) + ' game collections and the searchable menu directory.');
