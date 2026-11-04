const fs = require('node:fs');
const path = require('node:path');
const {page, section, grid, resource, link, guideLink, sourceList, note} = require('./build-console-guides.cjs');
const {createResourceRenderer, categories} = require('./console-resource-renderer.cjs');
const ROOT = path.resolve(__dirname, '..');
const {sourceKey, archivedMirrors} = require('./console-archived-mirrors.cjs');
function createGameImports({root = ROOT, data, files} = {}) {
  data ||= JSON.parse(fs.readFileSync(path.join(root, 'docs/ps4-ps5-game-resources.json'), 'utf8'));
  const manifest = path.join(root, 'downloads/ps4-ps5/manifest.json');
  if (!files) {
    files = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')).files : [];
    const inventory = path.join(root, 'docs/download-audit.json');
    if (fs.existsSync(inventory)) {
      const existingIds = new Set(files.filter(file => file.status === 'downloaded').map(file => file.downloadId));
      files = [...files, ...archivedMirrors(data.resources, JSON.parse(fs.readFileSync(inventory, 'utf8')).items).filter(file => !existingIds.has(file.downloadId))];
    }
  }
  const renderer = createResourceRenderer({root, files});
  const {h, localImage, httpsUrl, videoSource, hasDetails, card, details} = renderer;
  const decisions = new Set(['include', 'review', 'excluded']);
  const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const gameIds = new Set(), resourceIds = new Set(), downloadIds = new Set();
  if (data.schemaVersion !== 1 || !Array.isArray(data.games) || !Array.isArray(data.resources)) throw Error('Invalid game import schema');
  for (const game of data.games) {
    if (!slug.test(game.id) || !slug.test(game.slug) || gameIds.has(game.id) || !localImage(game.cover)) throw Error('Invalid game import metadata: ' + game.id);
    gameIds.add(game.id);
  }
  for (const item of data.resources) {
    if (!slug.test(item.id) || resourceIds.has(item.id) || !item.gameIds?.length || !item.gameIds.every(id => gameIds.has(id)) || !Object.hasOwn(categories, item.category) || !decisions.has(item.publication)) throw Error('Invalid game import resource: ' + item.id);
    resourceIds.add(item.id);
    for (const file of item.downloads || []) {
      if (!slug.test(file.id) || downloadIds.has(file.id) || !decisions.has(file.distribution)) throw Error('Invalid game download ID: ' + file.id);
      downloadIds.add(file.id);
      if (item.publication === 'include' && file.distribution === 'include' && !httpsUrl(file.url)) throw Error('Invalid game download URL: ' + file.id);
    }
    if (item.publication !== 'include') continue;
    for (const clip of item.videos || []) if (!videoSource(clip)) throw Error('Invalid game guide video: ' + item.id);
    for (const block of item.guideBlocks || []) {
      if (!['paragraph', 'code', 'steps', 'list'].includes(block.type)) throw Error('Invalid game guide block: ' + item.id);
      if (['paragraph', 'code'].includes(block.type) && typeof block.text !== 'string') throw Error('Missing game guide text: ' + item.id);
      if (['steps', 'list'].includes(block.type) && !Array.isArray(block.items)) throw Error('Missing game guide list: ' + item.id);
      if (block.type === 'steps' && !block.items.every(step => typeof step.title === 'string' && typeof step.text === 'string')) throw Error('Invalid game guide step: ' + item.id);
    }
  }
  const included = data.resources.filter(item => item.publication === 'include');
  const forGame = (id, mode = 'mods') => included.filter(item => item.gameIds.includes(id) && (mode === 'sources' ? item.category === 'source' : item.category !== 'source'));
  function keysFor(item) {
    return new Set([...(item.downloads || []).map(file => file.url), ...(item.source?.originalDownloadUrls || []), item.source?.releaseUrl].filter(Boolean).map(sourceKey));
  }
  function hashesFor(item) {
    const ids = new Set((item.downloads || []).map(file => file.id));
    return new Set(files.filter(file => ids.has(file.downloadId) && file.status === 'downloaded' && file.sha256).map(file => file.sha256));
  }
  function matches(item, legacy) {
    if (typeof legacy === 'string') legacy = {url: legacy};
    const gameVersion = /^\d{3}$/.test(legacy.group || '') ? '1.' + legacy.group.slice(1) : null;
    if (gameVersion && item.gameVersions?.length && !item.gameVersions.includes(gameVersion)) return false;
    const url = legacy.source || legacy.url;
    return (url && keysFor(item).has(sourceKey(url))) || (legacy.sha256 && hashesFor(item).has(legacy.sha256));
  }
  function legacyEnhancement(gameId, legacy, mode = 'mods') {
    const item = forGame(gameId, mode).find(item => matches(item, legacy));
    if (!item) return {guide: '', image: null, resource: null};
    const image = (item.images || []).find(image => image.role !== 'guide' && (localImage(image.display) || localImage(image.original)));
    return {
      resource: item,
      downloads: (item.downloads || []).filter(file => file.distribution === 'include').map(file => renderer.downloadButton(file, item)).join(''),
      guide: hasDetails(item) ? guideLink('#guide-' + item.id, h(item.guideLabel || 'Guide & media')) : '',
      image: image ? {src: localImage(image.display) || localImage(image.original), alt: image.caption || item.name} : null
    };
  }
  function supplement(gameId, legacy = [], mode = 'mods') {
    const items = forGame(gameId, mode);
    const legacyKeys = new Set(legacy.map(file => sourceKey(typeof file === 'string' ? file : file.source || file.url)));
    const legacyHashes = new Set(legacy.map(file => file.sha256).filter(Boolean));
    const cards = [];
    for (const item of items) {
      // The GTA V builder renders these cards in the requested update group.
      // Their guide sections are still appended below with the other details.
      if (mode === 'mods' && gameId === 'gta5' && ['v156','v157'].includes(item.catalogueSection)) continue;
      const represented = legacy.some(file => matches(item, file));
      if (legacy.some(file => file.downloadsRendered && matches(item, file))) continue;
      const downloads = (item.downloads || []).filter(file => file.distribution === 'include');
      const extras = downloads.filter(file => {
        if (legacyKeys.has(sourceKey(file.url))) return false;
        const stored = files.find(saved => saved.downloadId === file.id && saved.status === 'downloaded');
        return !stored?.sha256 || !legacyHashes.has(stored.sha256);
      });
      // A legacy release/folder link can represent its single selected asset.
      if (represented && (extras.length === 0 || downloads.length === 1)) continue;
      cards.push(card(represented ? {...item, downloads: extras} : item));
    }
    return (cards.length ? section('imported-resources', mode === 'sources' ? 'More source resources' : 'More downloads & source guides', grid(...cards)) : '') + items.map(details).join('\n');
  }
  function append(file, content, key) {
    const target = path.join(root, file);
    if (!fs.existsSync(target)) throw Error('Legacy page must be generated first: ' + file);
    let html = fs.readFileSync(target, 'utf8');
    const start = `<!-- ps4-ps5-${key}:start -->`, end = `<!-- ps4-ps5-${key}:end -->`;
    const first = html.indexOf(start), last = html.indexOf(end);
    if (first >= 0 && last >= first) html = html.slice(0, first) + html.slice(last + end.length);
    if (content) {
      const marker = '</div>\n<footer class="guide-footer">';
      if (!html.includes(marker)) throw Error('Guide content marker missing: ' + file);
      html = html.replace(marker, start + content + end + marker);
    }
    fs.writeFileSync(target, html);
  }
  function extraGameCards() {
    return data.games.filter(game => !game.legacy && !game.parent && (forGame(game.id).length || data.games.some(child => child.parent === game.id && forGame(child.id).length))).map(game => resource(h(game.title), h(game.summary || 'Game-specific downloads, screenshots and supplied guides.'), link('/console/mods/ps4/' + game.slug + '/', 'Open resources'), game.cover)).join('\n');
  }
  function buildMods({gtaFiles = [], rdrMenus = [], gameIds: selectedGames} = {}) {
    for (const game of data.games) {
      if (selectedGames && !selectedGames.includes(game.id)) continue;
      const items = forGame(game.id);
      if (game.legacy) {
        const legacy = game.id === 'gta5' ? gtaFiles : rdrMenus;
        append('console/mods/ps4/' + game.slug + '/index.html', supplement(game.id, legacy), 'game-imports');
      } else if (items.length || data.games.some(child => child.parent === game.id && forGame(child.id).length)) {
        const children = data.games.filter(child => child.parent === game.id && forGame(child.id).length).sort((a, b) => a.title.localeCompare(b.title, 'en'));
        const filter = children.length >= 6 ? '<div class="extra-game-filter"><label for="extraGameSearch">Search games or exact CUSA title ID</label><input id="extraGameSearch" type="search" placeholder="Find a game, title ID or update…" autocomplete="off"><p id="extraGameCount" role="status" aria-live="polite">' + children.length + ' game collections</p></div>' : '';
        const childCards = children.length ? section('games', 'Choose a game', filter + grid(...children.map(child => resource(h(child.title), h(child.summary || 'Game-specific files and exact compatibility.'), link('/console/mods/ps4/' + child.slug + '/', 'Open resources'), child.cover))).replace('<div class="games-grid">', '<div class="games-grid" data-extra-game-grid>') + (filter ? '<p id="extraGameEmpty" hidden>No matching game. Try the game name or a listed title ID.</p>' : '')) : '';
        const file = 'console/mods/ps4/' + game.slug + '/index.html';
        page(file, game.title + (game.platformLabel ? ' · ' + game.platformLabel : ' · PS4/PS5 Resources'), game.description || 'Downloads, screenshots and supplied guides for ' + game.title + ' in the PS4/PS5 collection.', game.cover,
          [['/console/mods/', 'Console Mods'], ['/console/mods/ps4/', 'PS4/PS5 Games'], ...(game.parent ? [['/console/mods/ps4/other-games/', 'Other Games']] : [])],
          (game.intro ? section('compatibility', 'Compatibility first', note('<p>' + h(game.intro) + '</p>')) : '') + childCards + renderer.gameContent(items) +
          (game.sourceLinks?.length ? section('sources', 'Sources & related guides', sourceList(game.sourceLinks)) : ''), '#content', 'Browse resources');
        if (game.keywords?.length || filter) {
          const target = path.join(root, file);
          let html = fs.readFileSync(target, 'utf8');
          if (game.keywords?.length) html = html.replace(/<meta name="keywords" content="[^"]*">/, '<meta name="keywords" content="' + h(game.keywords.join(', ')) + '">');
          if (filter) html = html.replace('</head>', '<link rel="stylesheet" href="/assets/console-extra-games.css"></head>').replace('</body>', '<script defer src="/assets/console-extra-games.js"></script></body>');
          fs.writeFileSync(target, html);
        }
      }
    }
  }
  function buildSources({gtaLegacyUrls = ['https://gofile.io/d/aENwykPu']} = {}) {
    const gameCards = [];
    for (const game of data.games) {
      const items = forGame(game.id, 'sources');
      if (!items.length) continue;
      const target = 'source-codes/games/' + game.slug + '/ps4.html';
      if (game.id === 'gta5') append(target, supplement(game.id, gtaLegacyUrls, 'sources'), 'source-imports');
      else {
        const url = '/source-codes/games/' + game.slug + '/';
        page(target, game.title + ' · PS4/PS5 Source Resources', 'Source archives and development resources for ' + game.title + '.', game.cover,
          [['/source-codes/', 'Source Codes'], [url, game.title]], renderer.gameContent(items), '#content', 'Browse source resources');
        page('source-codes/games/' + game.slug + '/index.html', game.title + ' Source Resources', 'Source archives organized by platform.', game.cover,
          [['/source-codes/', 'Source Codes']], section('platforms', 'Platforms', grid(resource('PS4/PS5', 'Source archives and supplied development guides.', link('/' + target, 'Open source resources'), game.cover))), '#platforms', 'Choose platform');
        gameCards.push(resource(h(game.title), 'Source archives and development resources.', link(url, 'Choose platform'), game.cover));
      }
    }
    append('source-codes/index.html', gameCards.length ? section('imported-source-games', 'More games', grid(...gameCards)) : '', 'source-games');
  }
  return {data, renderer, forGame, matches, legacyEnhancement, supplement, extraGameCards, buildMods, buildSources};
}
module.exports = {createGameImports, sourceKey};
if (require.main === module) throw Error('Run build-ps4-mods.cjs or build-source-code-pages.cjs so legacy content is regenerated before imports.');
