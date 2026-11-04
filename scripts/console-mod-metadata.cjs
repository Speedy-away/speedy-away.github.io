const {catalog} = require('./console-mod-catalog.cjs');
const {gameAliases, unique} = require('./console-resource-tags.cjs');
const gameCopy = {
  'black-ops-1': ['Black Ops 1 Console Menus, CFG & RTM Tools', 'Browse EnCoReV8, Discarded, Purple Kush, the BO1/BO2 GSC injector, CFG resources and RTM tools, with supplied previews and guide popups.'],
  'black-ops-2': ['Black Ops 2 Console Menus & Injector Guides', 'Find BO2 menus including Jiggy, Vengeance, Baguette and BlazeD, plus shared GSC injectors, RTM tools and the supplied PC relay tutorial.'],
  'black-ops-3': ['BO3 PS4 Menus: GSC Injector, Zombies & Multiplayer', 'Browse BO3 PS4 GSC Injector setup, DayBreak, EnCoRe, MuzzMan, Purple Lake, Frostbite, Luna and more, with downloads, previews and guide popups.'],
  'black-ops-4': ['Black Ops 4 PS4 Menus: B33, Atian & Lucy', 'Browse B33, Atian and Lucy resources for Black Ops 4, with supplied screenshots and downloads, plus captured DLC title-ID references.'],
  'ghosts': ['Ghosts PS4 Menus: MatrixMods, SilentShadow & HYDRA', 'Find Ghosts MatrixMods, SilentShadow v2/v3 and the separate HYDRA 2.2.0 resource, with previews, release details and DLC title-ID references.'],
  'advanced-warfare': ['Advanced Warfare PS4 Menus: MatrixMods & Appendum', 'Browse Advanced Warfare MatrixMods and Appendum PS4 resources, supplied previews, downloads and the captured CUSA00851 DLC reference.'],
  'modern-warfare-remastered': ['MWR PS4 Menus: MatrixMods & MAG Injector', 'Browse Modern Warfare Remastered PS4 MatrixMods and MAG Menu resources, injector details, previews and the CUSA05379 v1.15 DLC reference.'],
  'modern-warfare-2-remastered': ['MW2 Campaign Remastered PS4: TER152 Menu', 'Find the TER152 resource for Modern Warfare 2 Campaign Remastered on PS4, with its supplied download and preview. Check the resource details.'],
  'cold-war': ['Cold War Console Resources & DLC References', 'View the supplied Black Ops Cold War menu demonstration and the captured CUSA15010 v1.41 DLC reference, with media and compatibility details.'],
  'infinite-warfare': ['Infinite Warfare PS4 DLC Compatibility References', 'Read the captured CUSA04762 v1.25 DLC references for Infinite Warfare, including Absolution, Sabotage, Continuum and Retribution.'],
  'wwii': ['WWII PS4 Menus: HYDRA & DLC References', 'Find HYDRA 2.2.0 PS4 WWII Multiplayer and Zombies menu notes, Windows portable download, opening controls and captured DLC title-ID references.'],
  'gta5': ['GTA 5 PS4 Mod Menus by Game Update', 'Find GTA 5 PS4 menus by game update, including older builds, Expulsion, Cyprus, Ozark, Velora and Beach, plus scripts and setup guides.'],
  'rdr2': ['RDR2 PS4 Menus: Havana, North, Sheriff & Oyster', 'Get RDR2 PS4 North, Sheriff, Havana and Oyster resources, with matching builds, publisher checksums, previews and supplied installation guides.']
};
function metadataByPage() {
  const {games, entries} = catalog();
  const result = new Map();
  for (const game of games) {
    const matching = entries.filter(entry => entry.gameId === game.id);
    const [title, description] = gameCopy[game.id] || [game.title + ' Resources', game.summary || 'Browse game-specific menus, tools and supplied guides.'];
    result.set(game.url.slice(1) + 'index.html', {title: title + ' | whatwhatboy', description,
      keywords: unique([...(gameAliases[game.id] || []), game.title, ...matching.map(entry => entry.name),
        ...matching.flatMap(entry => entry.tags), ...matching.flatMap(entry => entry.versions.match(/\bCUSA\d{5}\b/g) || [])]), type: 'CollectionPage'});
  }
  const directory = {title: 'PS4/PS5 Menu Directory: Games, Tools & Guides | whatwhatboy',
    description: `Search ${entries.length} PS4/PS5 game-resource entries across ${games.length} games by menu name, game alias, update or type. Open downloads, previews and guide popups.`,
    keywords: unique([...games.map(game => game.title), 'PS4 PS5 menu directory', 'console game resources', 'mod menu search', 'injectors', 'RTM tools', 'CFG', 'scripts', 'DLC references', ...games.flatMap(game => gameAliases[game.id] || [])]),
    type: 'CollectionPage', items: entries.map(entry => ({name: entry.game + ' · ' + entry.name, url: entry.url}))};
  result.set('console/mods/ps4/menus.html', directory);
  result.set('console/mods/ps4/index.html', {title: 'PS4/PS5 Mods / Mod Menus | whatwhatboy',
    description: `Browse ${games.length} game collections, including GTA V, RDR2 and Call of Duty. Find menus, injectors, tools and supplied guides with game-specific requirements.`,
    keywords: directory.keywords, type: 'CollectionPage'});
  const codGames = games.filter(game => game.url.includes('/call-of-duty/'));
  result.set('console/mods/ps4/call-of-duty/index.html', {title: 'Call of Duty Console Menus, Injectors & Guides | whatwhatboy',
    description: `Browse ${codGames.length} Call of Duty collections, from Black Ops to WWII, with game-specific menus, GSC injectors, RTM tools, previews and DLC references.`,
    keywords: unique(['Call of Duty console resources', 'COD mod menus', ...codGames.map(game => game.title), 'GSC injectors', 'RTM tools', 'DLC references', ...codGames.flatMap(game => gameAliases[game.id] || [])]), type: 'CollectionPage'});
  const vault = require('../docs/console-vault-resources.json');
  result.set('console/vault.html', {title: 'The Vault: Console Apps, Updates & Reference Sites | whatwhatboy',
    description: 'Find PKG-Zone, OrbisPatches, Garlicsaves, PlayStation firmware archives, SuperPSX and Vimm’s Lair, with usage notes and link-check status.',
    keywords: unique(['The Vault', 'console reference websites', ...vault.resources.map(item => item.name), ...vault.resources.flatMap(item => item.tags)]),
    type: 'CollectionPage', items: vault.resources.map(item => ({name: item.name, url: item.url}))});
  return result;
}
function pageSchema({canonical, title, description, keywords, image, metadata}) {
  const origin = 'https://whatwhatboy.com';
  const website = {'@type': 'WebSite', '@id': origin + '/#website', url: origin + '/', name: 'whatwhatboy'};
  const page = {'@type': metadata?.type || 'WebPage', '@id': canonical + '#webpage', url: canonical,
    name: title, description, inLanguage: 'en', isPartOf: {'@id': website['@id']}, keywords};
  if (image) page.image = image;
  if (metadata?.items) page.mainEntity = {'@type': 'ItemList', numberOfItems: metadata.items.length,
    itemListElement: metadata.items.map((item, i) => ({'@type': 'ListItem', position: i + 1, name: item.name, url: new URL(item.url, origin).href}))};
  return {'@context': 'https://schema.org', '@graph': [website, page]};
}
module.exports = {metadataByPage, pageSchema};
