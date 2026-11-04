const fs = require('node:fs');
const path = require('node:path');
const {page, section, grid, resource, link} = require('./build-console-guides.cjs');

const multiGameOnly = typeof process !== 'undefined' && Array.isArray(process.argv) && process.argv.includes('--multi-game-only');
const multiGamePages = new Set(['black-ops-1', 'black-ops-2', 'wwii', 'ghosts', 'black-ops-3', 'advanced-warfare', 'modern-warfare-remastered']);
const multiCod = require('./console-multicod.cjs');
// Rebuild the legacy BO3 base once so scoped additions remain idempotent.
// Its source manifests and all retained download files remain intact.
require('./build-ps4-cod.cjs');

const root = path.resolve(__dirname, '..');
const base = '/console/mods/ps4/call-of-duty/';
const data = JSON.parse(fs.readFileSync(path.join(root, 'docs/ps4-ps5-cod-resources.json'), 'utf8'));
const manifestPath = path.join(root, 'downloads/ps4-ps5/manifest.json');
const storedFiles = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).files : [];
const legacy = JSON.parse(fs.readFileSync(path.join(root, 'docs/ps4-bo3-resources.json'), 'utf8')).resources;
const {createResourceRenderer, categories} = require('./console-resource-renderer.cjs');
const {h, localImage, httpsUrl, videoSource, card, gameContent} = createResourceRenderer({root, files: storedFiles});
const decisions = new Set(['include', 'review', 'excluded']);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function assert(condition, message) {
  if (!condition) throw new Error('PS4/PS5 COD import: ' + message);
}
function validate() {
  assert(data.schemaVersion === 1, 'unsupported schemaVersion');
  assert(Array.isArray(data.games) && Array.isArray(data.resources), 'games and resources must be arrays');
  assert(Array.isArray(storedFiles), 'manifest.files must be an array');
  const gameIds = new Set(), slugs = new Set(), resourceIds = new Set(), downloadIds = new Set();
  for (const game of data.games) {
    assert(slugPattern.test(game.id) && !gameIds.has(game.id), 'invalid or duplicate game ID');
    assert(slugPattern.test(game.slug) && !slugs.has(game.slug), 'invalid or duplicate game slug');
    assert(typeof game.title === 'string' && game.title.trim(), 'game title is required');
    assert(localImage(game.cover), 'game cover is missing: ' + game.id);
    gameIds.add(game.id); slugs.add(game.slug);
  }
  for (const item of data.resources) {
    assert(slugPattern.test(item.id) && !resourceIds.has(item.id), 'invalid or duplicate resource ID');
    resourceIds.add(item.id);
    assert(Array.isArray(item.gameIds) && item.gameIds.length && item.gameIds.every(id => gameIds.has(id)), 'unknown game on ' + item.id);
    assert(Object.hasOwn(categories, item.category), 'unknown category on ' + item.id);
    assert(typeof item.name === 'string' && item.name.trim(), 'resource name is required');
    assert(decisions.has(item.publication), 'publication decision is required on ' + item.id);
    assert(Array.isArray(item.downloads || []), 'downloads must be an array on ' + item.id);
    assert(Array.isArray(item.images || []), 'images must be an array on ' + item.id);
    assert(Array.isArray(item.guideBlocks || []), 'guideBlocks must be an array on ' + item.id);
    assert(Array.isArray(item.controls || []), 'controls must be an array on ' + item.id);
    assert(Array.isArray(item.videos || []), 'videos must be an array on ' + item.id);
    for (const file of item.downloads || []) {
      assert(slugPattern.test(file.id) && !downloadIds.has(file.id), 'invalid or duplicate download ID');
      downloadIds.add(file.id);
      assert(decisions.has(file.distribution), 'distribution decision is required on ' + file.id);
      if (item.publication === 'include' && file.distribution === 'include') assert(httpsUrl(file.url), 'included download needs an HTTPS source: ' + file.id);
    }
    if (item.publication !== 'include') continue;
    for (const clip of item.videos || []) {
      assert(clip && videoSource(clip), 'video needs a known HTTPS YouTube URL or existing local MP4/WebM on ' + item.id);
      assert(clip.title === undefined || typeof clip.title === 'string', 'video title must be text on ' + item.id);
    }
    for (const block of item.guideBlocks || []) {
      assert(['paragraph', 'steps', 'code', 'list'].includes(block.type), 'unknown guide block on ' + item.id);
      if (['steps', 'list'].includes(block.type)) assert(Array.isArray(block.items), 'guide items must be an array on ' + item.id);
      if (block.type === 'steps') assert(block.items.every(step => step && typeof step === 'object' && typeof step.title === 'string' && typeof step.text === 'string'), 'steps require title/text on ' + item.id);
      if (block.type === 'list') assert(block.items.every(text => typeof text === 'string'), 'list items must be text on ' + item.id);
      if (['paragraph', 'code'].includes(block.type)) assert(typeof block.text === 'string', 'guide text is required on ' + item.id);
    }
    assert((item.controls || []).every(control => control && typeof control.input === 'string' && typeof control.action === 'string'), 'controls require input/action on ' + item.id);
  }
}
validate();

const included = data.resources.filter(item => item.publication === 'include');
const itemsFor = game => included.filter(item => item.gameIds.includes(game.id));
const visibleGames = data.games.filter(game => itemsFor(game).length || game.id === 'black-ops-3' && legacy.length);
const nav = [['/console/mods/', 'Console Mods'], ['/console/mods/ps4/', 'PS4/PS5 Games'], [base, 'Call of Duty']];
const multiNav = [...nav, [multiCod.indexUrl, 'MultiCOD · supported games']];

for (const game of visibleGames) {
  if (multiGameOnly && !multiGamePages.has(game.id)) continue;
  const items = itemsFor(game);
  if (game.id === 'black-ops-3') {
    const target = path.join(root, 'console/mods/ps4/call-of-duty/black-ops-3/index.html');
    const html = fs.readFileSync(target, 'utf8');
    const marker = '</div>\n<footer class="guide-footer">';
    assert(html.includes(marker), 'legacy BO3 content marker is missing');
    const imported = items.length ? gameContent(items.map(item => ({...item, videos: []})), 'imported-') : '';
    fs.writeFileSync(target, html.replace(marker, imported + multiCod.gameContent(game.id) + marker));
    continue;
  }
  if (!items.length) continue;
  page('console/mods/ps4/call-of-duty/' + game.slug + '/index.html', game.title + ' · PS4/PS5 Resources',
    game.resourceDescription || 'Downloads, screenshots and supplied guides for ' + game.title + ' in the PS4/PS5 collection.',
    game.cover, [...multiNav, [base + game.slug + '/', game.title.replace(/^Call of Duty: /, '')]],
    gameContent(items.map(item => ({...item, videos: []}))) + multiCod.gameContent(game.id),
    '#content', 'Browse resources');
}

const hubCover = visibleGames.find(game => game.id === 'black-ops-3')?.cover || visibleGames[0]?.cover || '/assets/images/covers/cod-black-ops-3.jpg';
const gameCards = visibleGames.map(game => resource(h(game.title),
  game.id === 'black-ops-3' ? 'GSC Injector setup, Zombies and Multiplayer menus, downloads and screenshots.' : h(game.summary || 'Downloads, screenshots and supplied setup guides.'),
  link(base + game.slug + '/', 'Open resources'), game.cover));
page('console/mods/ps4/call-of-duty/index.html', 'Call of Duty · PS4/PS5 Resources',
  'Choose a Call of Duty game to browse the PS4/PS5 resource collection, including menus, tools, screenshots and supplied guides.',
  hubCover, multiNav, section('games', 'Call of Duty games', gameCards.length ? grid(...gameCards) : '<p>No imported games are available yet.</p>'),
  '#games', 'Browse games');
page('console/mods/ps4/call-of-duty/multicod/index.html', 'MultiCOD · Supported Games',
  'Shared Call of Duty menu packs and tools, with a separate resource entry for every source-confirmed supported game.',
  hubCover, multiNav, multiCod.indexContent(), '#supported-games', 'Choose supported game');
console.log(multiGameOnly ? 'Built MultiCOD index, COD hub and seven game-specific resource pages.' : `Built PS4/PS5 COD collection: ${visibleGames.length} games, ${included.length} new included resources; legacy BO3 preserved.`);
