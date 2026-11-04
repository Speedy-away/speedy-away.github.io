const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const start = '<!-- BEGIN XBOX360 GAME RESOURCES -->';
const end = '<!-- END XBOX360 GAME RESOURCES -->';
const read = () => JSON.parse(fs.readFileSync(path.join(root, 'docs/xbox360-mod-resources.json'), 'utf8'));
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const fullLink = (url, label, download = '') => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer"${download ? ` download="${escape(download)}"` : ''}>${escape(label)}</a>`;

function resourcesForGame(gameId, data = read()) {
  return data.resources.filter(item => item.platforms.includes('xbox360') && item.gameIds.includes(gameId));
}

function gamesSection() {
  const {section, grid, resource} = require('./build-console-guides.cjs');
  const data = read();
  return start + '\n' + section('game-catalogue', 'Choose your Xbox 360 game', grid(...data.games.filter(game => resourcesForGame(game.id, data).length).map(game => {
    const count = resourcesForGame(game.id, data).length;
    return resource(escape(game.title), `${count} original Xbox-labelled COD4 multiplayer patch archives. Title-update and regional requirements remain unverified.`, fullLink(game.page, 'Browse ' + game.title), game.image);
  })).replace('class="games-grid"','class="games-grid menu-game-grid"'), 'Each game page lists only resources with evidence for that game and console.') + '\n' + end;
}

function archiveCard(item) {
  const {resource} = require('./build-console-guides.cjs');
  const media=require('./console-menu-media.cjs').createMenuMedia({root});
  const image=media.figure(item,read().games.find(game=>item.gameIds.includes(game.id))?.image,'Call of Duty 4: Modern Warfare');
  const archive = item.archive;
  const links = fullLink(archive.local, 'Download original RAR', archive.filename) + fullLink(archive.url, 'Original download page') + fullLink(item.source, 'Captured source post');
  return resource(escape(item.name), escape(item.description), links, '')
    .replace('<h3>', `${image}<div class="game-features"><span class="feature">Xbox 360</span><span class="feature">COD4 multiplayer</span><span class="feature">RAR archive</span><span class="feature">${(archive.bytes / 1048576).toFixed(2)} MiB</span></div><h3>`)
    .replace('<div class="guide-links">', `<p>${escape(item.compatibility)}</p><p><strong>Menu:</strong> ${escape(item.version)}. <strong>Game update / region:</strong> not specified.</p><details data-sha256="${escape(archive.sha256)}"><summary>Archive contents</summary><ul>${item.members.map(member => `<li><code>${escape(member)}</code></li>`).join('')}</ul><p>Console execution and title-update compatibility were not tested.</p></details><div class="guide-links">`);
}

function buildGamePages() {
  const {page, section, grid, note, steps, sourceList} = require('./build-console-guides.cjs');
  const {xbox360nav} = require('./build-xbox360-pages.cjs');
  const data = read();
  for (const game of data.games) {
    const entries = resourcesForGame(game.id, data);
    if (!entries.length) continue;
    const file = game.page.replace(/^\//, '');
    page(file, 'COD4 Xbox 360 Patch Menus',
      'Original Xbox-labelled COD4 multiplayer patch archives, preserved downloads and source evidence. Exact title-update and regional requirements remain unverified.',
      game.image, xbox360nav,
      section('archives', 'COD4 multiplayer · Xbox 360 archives', note('<p>These four resources contain Xbox-labelled <code>patch_mp.ff</code> and <code>default_mp.xex</code> files for Call of Duty 4: Modern Warfare (2007). Their captured sources do not document exact title updates, regions or supported homebrew methods. Check those requirements before using a build.</p>') + grid(...entries.map(archiveCard)).replace('class="games-grid"','class="games-grid menu-resource-grid"')) +
      section('preparation', 'Before using an archive', steps([
        ['Check the exact game build', 'Match the archive to your original COD4 multiplayer installation, region, media ID and title update using its source instructions. A title-update pin is not supplied here.'],
        ['Keep the original files', 'Preserve the original RAR and your existing game files. Downloading an archive does not extract it or install its contents.'],
        ['Use the matching Xbox workflow', 'The captured Xbox executable is an XEX and the patch is a fastfile. The archives do not establish support for Peer Pressure, DashLaunch or a particular temporary-session payload.'],
        ['Review the source details', 'Yardsale includes a tentative controls note; the other three have no captured installation readme. No on-console execution or installation shortcut has been verified.']
      ]) + `<div class="guide-links">${fullLink('/console/xbox360/mods.html', 'Back to Xbox 360 game resources')}${fullLink('/console/xbox360/jailbreaks.html', 'Console setup requirements')}</div>`) +
      section('sources', 'Preserved source evidence', sourceList(entries.map(item => [item.source, item.name + ' · captured source post'])) + '<p>Original MediaFire landing pages could not be read through the verification tool. The existing local mirrors and organized backup files were checked by size and SHA-256; their source URLs are retained.</p>'),
      '#archives', 'Browse COD4 archives');
    const output = path.join(root, file);
    let html = fs.readFileSync(output, 'utf8');
    const keywords = ['Xbox 360', game.title, 'COD4', 'multiplayer patch menus', 'patch_mp.ff', 'default_mp.xex', 'title update', 'region', ...entries.map(item => item.name)].join(', ');
    html = html.replace(/<meta name="keywords" content="[^"]*">/, `<meta name="keywords" content="${escape(keywords)}">`);
    fs.writeFileSync(output, require('./apply-mobile-layout.cjs').improve(html));
  }
}

function build() {
  buildGamePages();
  const file = path.join(root, 'console/xbox360/mods.html');
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes(start)) {
    const first = html.indexOf(start), last = html.indexOf(end, first);
    if (last < 0) throw Error('Unterminated Xbox game-resource boundary');
    html = html.slice(0, first) + gamesSection() + html.slice(last + end.length);
  } else {
    if (!html.includes('<div id="content">')) throw Error('Missing Xbox mods content boundary');
    html = html.replace('<div id="content">', '<div id="content">' + gamesSection());
  }
  fs.writeFileSync(file, require('./apply-mobile-layout.cjs').improve(html));
  require('./build-discord-platform-resources.cjs').build('xbox360');
  console.log('Built Xbox COD4 archive page and preserved reviewed Discord game resources.');
}

module.exports = {resourcesForGame, gamesSection, buildGamePages, build};
if (require.main === module) build();
