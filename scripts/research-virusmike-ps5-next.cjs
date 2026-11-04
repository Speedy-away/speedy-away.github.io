// Inspect only captured, observed Google Sites pages. No URL guessing,
// downloadable payload execution, catalogue changes or archive writes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const decode = value => value.replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
function links(html, base) {
  return [...new Set([...decode(html).matchAll(/href="([^"]*)"/g)].flatMap(match => {
    try {
      const url = new URL(match[1], base);
      if (url.hostname === 'www.google.com' && url.pathname === '/url' && url.searchParams.has('q')) return [url.searchParams.get('q')];
      return url.protocol === 'https:' ? [url.href] : [];
    } catch { return []; }
  }))];
}
function prepare() {
  const supplied = 'https://sites.google.com/view/im-virusmike-exe/ps4-all-you-need';
  const observed = [
    {name: 'source', url: supplied, discoveredFrom: 'User-supplied URL'},
    {name: 'home', url: 'https://sites.google.com/view/im-virusmike-exe/home-page', discoveredFrom: supplied},
    {name: 'fps', url: supplied + '/60-fps-patches', discoveredFrom: supplied}
  ];
  const snapshots = observed.map(item => {
    const file = 'docs/tmp/virusmike-ps5-next/' + item.name + '.html';
    const bytes = fs.readFileSync(path.join(root, file));
    const html = bytes.toString('utf8');
    const outgoing = links(html, item.url);
    const siteLinks = outgoing.filter(url => new URL(url).hostname === 'sites.google.com' && new URL(url).pathname.startsWith('/view/im-virusmike-exe/'));
    const text = decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' '));
    return {url: item.url, discoveredFrom: item.discoveredFrom, httpStatus: 200, snapshot: file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), siteLinks, ps5Links: siteLinks.filter(url => /(?:ps5|playstation-?5)/i.test(new URL(url).pathname)), ps5TextObserved: /\b(?:PS5|PlayStation\s*5)\b/i.test(text), relevantOutgoing: item.name === 'fps' ? outgoing.filter(url => /mega\.nz|zippyshare|1fichier|psxhax|youtube\.com\/channel/.test(url)) : []};
  });
  const allNavigation = [...new Set(snapshots.slice(0, 2).flatMap(item => item.siteLinks))];
  if (snapshots.some(item => item.ps5Links.length || item.ps5TextObserved)) throw Error('New PS5 evidence observed; manually review before retaining the zero-resource conclusion');
  const cheats = read('docs/host-current-cheat-actions.json');
  const patches = read('docs/ps4-ps5-game-patches.json');
  const catalogue = read('docs/console-download-catalog.json');
  const nativePatchGames = patches.games.filter(game => game.titleIds?.some(id => /^PPSA\d+$/.test(id)));
  const result = {
    schemaVersion: 1, reviewed: '2026-11-02', source: supplied,
    status: 'No source-confirmed new PS5 game resources discovered in the observed site navigation or inspected pages',
    scope: 'PS5-specific pages reached only through observed navigation from the supplied PS4 page and its home link. No guessed PS5 URL paths were queried.',
    discovery: {uniqueObservedNavigationUrls: allNavigation.length, snapshots, conclusion: 'The observed navigation contains home, PS4 and PS3 pages. Neither entry page nor the observed FPS page supplies a PS5-specific game page, PPSA build or native PS5 resource.'},
    resources: [],
    rejectedForPs5: [{page: supplied + '/60-fps-patches', titles: ['Far Cry 3', 'Uncharted: The Lost Legacy', 'The Order: 1886', 'Ghost of Tsushima'], reason: 'Source labels PS4 models or PS4 Pro and uses legacy file hosts. Those labels do not establish native PS5 support; no new PS5 download is inferred.'}],
    existingComparison: {
      catalogueResources: catalogue.items.length,
      ps5CatalogueResources: catalogue.items.filter(item => item.platforms?.includes('ps5')).length,
      nativeCheats: cheats.actions.filter(item => item.gamePlatform === 'native-ps5').map(item => ({id: item.id, game: item.game, titleIds: item.titleIds, gameVersion: item.gameVersion, format: item.format, sha256: item.sha256, source: item.source})),
      nativePatchGames: nativePatchGames.map(game => ({id: game.id, title: game.title, titleIds: game.titleIds})),
      note: 'Existing PS4 game patches under PS5 backward compatibility remain separate from these native PPSA resources. Existing curated/native cheat files are not re-added.'
    },
    suggestedPrimarySourceReviews: [
      {source: 'https://github.com/etaHEN/PS5_Cheats', relationship: 'Already linked by the existing native-cheat integration; independently sourced, not a VirusMike PS5 page', inspected: 'Repository and its linked json directory/index were read. The repository also contains CUSA files, so its name alone is not native PS5 compatibility evidence.', nextAction: 'Review individual ready PPSA cheat files, read exact game/version/process metadata, pin the commit, compare existing hashes and retain creator credit. Download only selected ready JSON/SHN/MC4 files after review, not a source archive or full commercial game.'},
      {source: 'https://github.com/illusionyy/PS-Game-Patch', relationship: 'The Google Sites FPS page credits illusion through the observed creator channel; this GitHub URL is independently established in the existing patch integration, not directly linked by that page', inspected: 'Maintained project README and the existing pinned patch descriptors were compared.', nextAction: 'Review future source-confirmed PPSA entries or additional exact native game updates. Current native Demons Souls and Snake Eater PPSA entries are already present; preserve PS4 backward-compatibility labels for CUSA patches.'}
    ],
    limits: ['No new downloadable artifact is approved by this discovery pass, so the new job list is empty.', 'No Bstlar links, full commercial games, gates or videos were downloaded.', 'No shared catalogue, renderer, helper, inventory or F: archive was changed.', 'No downloaded console binary or cheat file was executed.']
  };
  fs.writeFileSync(path.join(root, 'docs/virusmike-ps5-next-resources.json'), JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'docs/virusmike-ps5-next-jobs.json'), JSON.stringify({schemaVersion: 1, reviewed: result.reviewed, source: supplied, reason: result.status, jobs: []}, null, 2) + '\n');
  console.log(JSON.stringify({navigationUrls: allNavigation.length, snapshots: snapshots.length, resources: result.resources.length, jobs: 0, existingNativeCheats: result.existingComparison.nativeCheats.length, existingNativePatchGames: nativePatchGames.length}, null, 2));
  return result;
}
module.exports = {links, prepare};
if (require.main === module) prepare();
