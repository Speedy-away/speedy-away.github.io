const fs = require('node:fs');
const path = require('node:path');
const {page, section, grid, resource, link, guideLink, esc} = require('./build-console-guides.cjs');
const root = path.resolve(__dirname, '..');
const base = '/console/mods/ps4/';
const {resourceTags, resourceTerms, categoryLabels, gameAliases} = require('./console-resource-tags.cjs');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
function catalog() {
  const cod = read('docs/ps4-ps5-cod-resources.json');
  const other = require('./build-ps4-ps5-game-imports.cjs').createGameImports();
  const bo3 = read('docs/ps4-bo3-resources.json').resources;
  const renderer = other.renderer;
  const games = [...other.data.games.filter(game => other.forGame(game.id).length).map(game => ({...game, url: base + game.slug + '/'})),
    ...cod.games.filter(game => game.id === 'black-ops-3' || cod.resources.some(item => item.publication === 'include' && item.gameIds.includes(game.id))).map(game => ({...game, url: base + 'call-of-duty/' + game.slug + '/'}))];
  const entries = [];
  function add(item, gameId, url) {
    const game = games.find(game => game.id === gameId);
    if (!game) throw Error('Unknown catalog game: ' + gameId);
    item = {...item, gameIds: [gameId], category: item.category || 'menu'};
    entries.push({name: item.name, category: item.category, game: game.title, tags: resourceTags(item),
      image:require('./ps4-ps5-card-images.cjs').resourceImage(item), gameId, versions: item.compatibilityText || item.version || item.gameVersions?.map(v => 'GTA V ' + v).join(', ') || '',
      url, search: resourceTerms(item, game.title).join(' ').toLowerCase()});
  }
  for (const item of [...cod.resources, ...other.data.resources].filter(item => item.publication === 'include' && item.category !== 'source')) {
    for (const gameId of item.gameIds) {
      const game = games.find(game => game.id === gameId);
      add(item, gameId, game.url + '#' + (renderer.hasDetails(item) ? 'guide-' : 'resource-') + item.id);
    }
  }
  for (const item of bo3) add({...item, category: item.group === 'injector' ? 'injector' : item.group === 'packs' ? 'pack' : 'menu'}, 'black-ops-3', base + 'call-of-duty/black-ops-3/#guide-bo3-' + item.id);
  const nextFile = path.join(root,'docs/virusmike-ps4-next-resources.json');
  if (fs.existsSync(nextFile)) for (const item of read('docs/virusmike-ps4-next-resources.json').resources) add(item,'black-ops-3',base+'call-of-duty/black-ops-3/#guide-'+item.id);
  for (const file of read('downloads/ps4/GTA5/manifest.json').files) {
    if (other.forGame('gta5').some(item => other.matches(item, file))) continue;
    add({name: file.name, category: file.group === 'scripts' ? 'script' : 'menu', version: file.group === 'scripts' ? 'CSC / script resource' : 'GTA V 1.' + file.group.slice(1)}, 'gta5', base + 'gta5/#' + (file.group === 'scripts' ? 'scripts' : 'v' + file.group));
  }
  return {games, entries};
}
function gameCards(codOnly = false) {
  const {games, entries} = catalog();
  return games.filter(game => game.url.includes('/call-of-duty/') === codOnly).map(game => {
    const count = entries.filter(entry => entry.gameId === game.id).length;
    return resource(esc(game.title), game.summary || count + ' menu, tool and guide entries. Check each resource’s game update and console requirements.', link(game.url, 'Browse resources'), game.cover);
  }).join('\n');
}
function build() {
  const {games, entries} = catalog();
  const controls = `<div class="guide-note"><label for="modCatalogSearch">Search games, menus or game updates</label><input id="modCatalogSearch" type="search" placeholder="Try Jiggy, Ghosts, Cyprus or 1.53" style="display:block;width:100%;padding:12px;margin-top:12px;color:inherit;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px"><label for="modCatalogGame" style="display:block;margin-top:16px">Game</label><select id="modCatalogGame" style="max-width:100%;padding:10px;margin-top:8px;color:inherit;background:var(--bg-primary);border:1px solid var(--border)"><option value="">All games</option>${games.map(game => `<option value="${esc(game.id)}">${esc(game.title)}</option>`).join('')}</select><p id="modCatalogCount" role="status" style="margin-top:16px">${entries.length} entries across ${games.length} games</p></div>`;
  const types = [...new Set(entries.map(entry => entry.category))];
  const typeFilter = `<label for="modCatalogType" style="display:block;margin-top:16px">Resource type</label><select id="modCatalogType" style="max-width:100%;padding:10px;margin-top:8px;color:inherit;background:var(--bg-primary);border:1px solid var(--border)"><option value="">All types</option>${types.map(type => `<option value="${esc(type)}">${esc(categoryLabels[type] || type)}</option>`).join('')}</select>`;
  const rows = entries.map(entry => `<article class="guide-resource mod-catalog-entry" data-catalog-search="${esc(entry.search)}" data-catalog-game="${entry.gameId}" data-catalog-category="${entry.category}">${require('./ps4-ps5-card-images.cjs').markup(entry.image)}<p>${esc(entry.game)}</p><h3>${esc(entry.name)}</h3>${entry.versions ? `<p>${esc(entry.versions)}</p>` : ''}${tagMarkup(entry.tags.slice(0, 6))}<div class="guide-links">${entryLink(entry)}</div></article>`);
  page('console/mods/ps4/menus.html', 'PS4/PS5 Menu Directory', 'Search the imported PS4/PS5 game mod menus, scripts, injectors and tools by name, game and update.', '/assets/images/covers/cod-black-ops-3.jpg', [[base, 'PS4/PS5 Games'], [base + 'menus.html', 'Menu Directory']], section('menus', 'Find a menu or tool', controls.replace('<p id="modCatalogCount"', typeFilter + '<p id="modCatalogCount"') + grid(...rows) + '<p id="modCatalogEmpty" hidden>No entries match. Try a menu name or choose another game or resource type.</p>') + '<script defer src="/assets/console-mod-catalog.js?v=2"></script>', '#menus', 'Search menus');
  fs.mkdirSync(path.join(root, 'docs/seo'), {recursive: true});
  fs.writeFileSync(path.join(root, 'docs/seo/resource-tags.json'), JSON.stringify({schemaVersion: 1,
    games: games.map(game => ({id: game.id, title: game.title, aliases: gameAliases[game.id] || [], url: game.url})),
    categories: categoryLabels, resources: entries.map(entry => ({name: entry.name, gameId: entry.gameId,
      category: entry.category, tags: entry.tags, searchTerms: entry.search, url: entry.url}))}, null, 2) + '\n');
  console.log(`Built menu directory: ${entries.length} entries across ${games.length} games.`);
}
function entryLink(entry) {
  const label = entry.category === 'reference' ? 'View compatibility reference' : 'Open menu & details';
  return (entry.url.includes('#guide-') ? guideLink : link)(entry.url, label);
}
function tagMarkup(tags) {
  return tags.length ? `<ul class="guide-resource-tags" aria-label="Tags">${tags.map(tag => `<li class="feature-tag">${esc(tag)}</li>`).join('')}</ul>` : '';
}
module.exports = {catalog, gameCards, entryLink, tagMarkup, build};
if (require.main === module) build();
