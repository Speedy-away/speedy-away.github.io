// Rebuild only the Nintendo pages owned by this collection. Other consoles stay untouched.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function buildNintendoLibrary() {
  require('./build-retro-page.cjs').buildRetroPage();
  const wiiu = require('./build-wiiu-homebrew.cjs').buildWiiUHomebrew();
  const mods = require('./build-switch-game-mods.cjs').buildSwitchGameMods();
  const homebrew = require('./build-switch-homebrew.cjs').buildSwitchHomebrew();
  const consoleIndex = path.join(root, 'console/index.html');
  let html = fs.readFileSync(consoleIndex, 'utf8');
  const begin = '<!-- BEGIN NINTENDO LIBRARY LINKS -->', end = '<!-- END NINTENDO LIBRARY LINKS -->';
  const links = `${begin}<div class="hero-buttons"><a class="btn btn-outline" href="/console/retro/wiiu.html">Wii U apps &amp; homebrew</a><a class="btn btn-outline" href="/console/nintendo-switch/mods.html">Switch game mods</a></div>${end}`;
  if (html.includes(begin)) html = html.replace(new RegExp(begin + '[\\s\\S]*?' + end), links);
  else html = html.replace(/<section class="section" id="retro">[\s\S]*?<\/section>/, section => section.replace('</div></div></section>', links + '</div></div></section>'));
  html = html.replace(/(?:Wii U, )*Wii, GameCube, DS and DSi, Nintendo 2DS and 3DS, PS2, original Xbox and PSP homebrew\./g, 'Wii U, Wii, GameCube, DS and DSi, Nintendo 2DS and 3DS, PS2, original Xbox and PSP homebrew.');
  fs.writeFileSync(consoleIndex, html);
  const pages = ['console/nintendo-switch/apps.html', 'console/nintendo-switch/mods.html', 'console/retro/wiiu.html'];
  const sitemapFile = path.join(root, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapFile, 'utf8');
  for (const file of pages) {
    const url = 'https://whatwhatboy.com/' + file;
    if (!sitemap.includes('<loc>' + url + '</loc>')) sitemap = sitemap.replace('</urlset>', `  <url><loc>${url}</loc><lastmod>2026-11-02</lastmod></url>\n</urlset>`);
  }
  fs.writeFileSync(sitemapFile, sitemap);
  return {homebrew, mods, wiiu};
}
module.exports = {buildNintendoLibrary};
if (require.main === module) console.log('Built Nintendo library:', buildNintendoLibrary());
