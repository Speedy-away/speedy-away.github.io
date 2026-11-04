// Materialize reviewed official cheat metadata and explicit archive jobs.
// Ready JSON definitions are downloaded by the archive workflow, never executed.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const readExisting = (file, fallback) => fs.existsSync(path.join(root,file)) ? read(file) : fallback;
const appendBy = (existing, additions, key) => [...existing,...additions.filter(item=>!existing.some(saved=>saved[key]===item[key]))];
function prepare() {
  const source = read('docs/ps4-extra-game-cheats.json');
  const data = read('docs/ps4-ps5-game-resources.json');
  const jobs = [], resources = [], imageSources = [];
  for (const file of source.files) {
    if (file.filename !== file.titleId + '_' + file.version + '.json' || !/^[a-f0-9]{64}$/.test(file.sha256) || !file.url.includes('/' + source.commit + '/json/')) throw Error('Invalid pinned cheat metadata');
    const id = 'goldhen-' + file.filename.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-json$/, '');
    const image = file.image || '/assets/images/ps4-ps5/' + file.game + '.jpg';
    const page = '/console/mods/ps4/' + file.game + '/';
    const variants = source.files.filter(candidate => candidate.game === file.game);
    const variantLabel = variants.length > 1 ? ' · ' + file.titleId : '';
    if (!fs.existsSync(path.join(root, image.slice(1)))) throw Error('Reviewed game artwork missing: ' + file.game);
    const game = {id: file.game, title: file.title, slug: file.game, cover: image, parent: 'other-games', platformLabel: 'PS4 Cheat Files',
      summary: 'GoldHEN JSON cheats · ' + file.titleId + ' · game ' + file.version + '.',
      description: 'Download the PS4 GoldHEN JSON cheat file for ' + file.title + ', ' + file.titleId + ' game update ' + file.version + ', with exact installation and compatibility notes.',
      intro: 'These ready JSON definitions come from the official GoldHEN Cheat Repository. Match ' + file.titleId + ' and game update ' + file.version + ' exactly. They target PS4 GoldHEN Cheat Menu; native PS5 compatibility is not established. Firmware support depends on your GoldHEN release.',
      sourceLinks: [[source.repository, 'Official GoldHEN database: formats, paths and controls'], [source.repository + '/blob/' + source.commit + '/json/' + file.filename, 'Pinned original file, cheat conditions and credits'], ['/console/ps4/downloads.html', 'PS4 direct file downloads']],
      keywords: [file.title, file.sourceName, 'PS4 GoldHEN cheats', file.titleId, 'game ' + file.version, 'JSON cheat file', 'title ID compatibility']};
    const gameIndex = data.games.findIndex(item => item.id === game.id);
    if (gameIndex < 0) data.games.push(game);
    if (variants.length > 1) {
      const managedGame = data.games.find(item => item.id === game.id);
      if (managedGame.parent !== 'other-games' || !managedGame.sourceLinks?.some(([url]) => url === source.repository)) throw Error('Refusing to replace unrelated game metadata: ' + game.id);
      const pairs = variants.map(variant => variant.titleId + ' · ' + variant.version);
      Object.assign(managedGame, {
        summary: variants.length + ' exact GoldHEN JSON builds · ' + pairs.join('; ') + '.',
        description: 'Download PS4 GoldHEN JSON cheats for ' + file.title + '. Choose your exact title ID and game update: ' + pairs.join('; ') + '.',
        intro: 'Choose the file matching your installed title ID and update exactly: ' + pairs.join('; ') + '. Each card keeps its own cheat conditions and contributor credits from the official GoldHEN Cheat Repository. These builds target PS4 GoldHEN Cheat Menu; native PS5 compatibility is not established. Firmware support depends on your GoldHEN release.',
        sourceLinks: [[source.repository, 'Official GoldHEN database: formats, paths and controls'], ...variants.map(variant => [source.repository + '/blob/' + source.commit + '/json/' + variant.filename, variant.filename + ' · original conditions and credits']), ['/console/ps4/downloads.html', 'PS4 direct file downloads']]
      });
    }
    const cheat = {id, gameIds: [file.game], category: 'cheat', publication: 'include', name: file.title + ' · ' + file.version,
      description: 'Direct GoldHEN JSON definitions. ' + file.cheats.slice(0, 4).map(value => value.trim()).join('; ') + '.',
      version: 'Game ' + file.version + ' · ' + file.titleId, gameVersions: [file.version],
      compatibilityText: 'PS4 GoldHEN Cheat Menu · ' + file.titleId + ' · game update ' + file.version + '. Native PS5 support has not been established.',
      tags: ['PS4', 'GoldHEN', 'JSON', file.titleId, file.title], keywords: [file.title, file.sourceName, file.filename, file.game, 'single player', 'cheat definitions'],
      source: {postUrl: source.repository + '/blob/' + source.commit + '/json/' + file.filename, capturedAt: source.reviewed, releaseUrl: source.repository},
      downloads: [{id, label: 'Download ' + file.filename, url: file.url, filename: file.filename, distribution: 'include'}], images: [], guideLabel: 'Install & cheat conditions',
      guideBlocks: [
        {type: 'paragraph', text: 'The database names this file “' + file.sourceName + '”. It is a ready JSON definition file for the PS4 GoldHEN Cheat Menu, independent of the user-supplied Google Sites download lists. No archive extraction, developer-menu PKG or game-data download is required.'},
        ...(file.sourceNotes || []).map(text=>({type:'paragraph',text})),
        {type: 'steps', items: [
          {title: 'Match the title ID and update', text: 'Check ' + file.titleId + ' and installed game update ' + file.version + '. Back up your save and an existing cheat file with this filename.'},
          {title: 'Transfer the JSON', text: 'Copy ' + file.filename + ' to /user/data/GoldHEN/cheats/json/ with FTP or a console file manager. Preserve its filename. GoldHEN currently supports only one cheat format for each title ID and game version.'},
          {title: 'Enable cheats deliberately', text: 'Start the matching game and hold Share, or use the quick double-PS trigger configured in GoldHEN. Highlight a cheat and press X. Read the exact conditions below, then enable only the options you intend to use.'}
        ]},
        {type: 'list', title: 'Cheat labels and conditions from this exact file', items: file.cheats.map(value => value.trim())},
        ...((file.cheatDetails || []).length ? [{type: 'list', title: 'Author conditions and instructions', items: file.cheatDetails.map(detail => detail.name + ': ' + detail.description)}] : []),
        {type: 'paragraph', text: 'Upstream revision: ' + source.commit + '. Format: JSON; process: ' + file.process + '. The original file retains its contributor credits. GPL-3.0 source and terms are available in the official repository.'}
      ],
      controls: [{input: 'Hold Share / configured double PS', action: 'Open the in-game GoldHEN Cheat Menu'}, {input: 'D-pad Up / Down, then X', action: 'Choose and toggle one cheat'}], videos: []};
    const resourceIndex = data.resources.findIndex(item => item.id === id);
    cheat.name += variantLabel;
    if (resourceIndex < 0) data.resources.push(cheat);
    else if (variants.length > 1) data.resources[resourceIndex].name = cheat.name;
    if(file.compactDownload===true)data.resources.find(item=>item.id===id).compactDownload=true;
    jobs.push({id, title: file.title + ' · GoldHEN JSON ' + file.version, platform: 'PS4', category: ['Games', file.title, 'Cheats'], project: 'GoldHEN Cheats', version: file.titleId + ' ' + file.version + ' · ' + source.commit.slice(0, 12), filename: file.filename, url: file.url, ...(file.stagedPath?{importPath:file.stagedPath}:{}), pages: [page.slice(1) + 'index.html'], archiveRole: ['Builds'], mirror: true, expectedBytes: file.bytes, expectedSha256: file.sha256});
    resources.push({id, title: file.title + ' · GoldHEN ' + file.version + variantLabel, platforms: ['ps4'], category: 'game-mod', version: file.version, compatibility: cheat.compatibilityText, image, page, source: file.url, filename: file.filename, format: 'JSON cheat', game: file.game, keywords: cheat.keywords});
    imageSources.push(file.artwork?{file:image,...file.artwork}:{file: image, source: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/' + file.steamApp + '/header.jpg', page: 'https://store.steampowered.com/app/' + file.steamApp + '/', type: 'Official publisher storefront artwork; illustration does not establish cheat compatibility'});
  }
  const count = data.games.filter(game => game.parent === 'other-games').length;
  Object.assign(data.games.find(game => game.id === 'other-games'), {summary: count + ' game collections with ready GoldHEN JSON cheats, exact title IDs and source availability notes.', description: 'PS4 cheat files and game mods across ' + count + ' collections. Match the title ID and game update, then download a ready JSON file or review the supplied source notes.'});
  fs.writeFileSync(path.join(root, 'docs/ps4-ps5-game-resources.json'), JSON.stringify(data, null, 2) + '\n');
  const previousJobs=readExisting('docs/ps4-extra-game-download-jobs.json',{jobs:[]});
  const previousDownloads=readExisting('docs/ps4-extra-game-downloads.json',{resources:[],imageSources:[]});
  for (const descriptor of previousDownloads.resources) {
    const updated = resources.find(resource => resource.id === descriptor.id);
    if (updated) descriptor.title = updated.title;
  }
  fs.writeFileSync(path.join(root, 'docs/ps4-extra-game-download-jobs.json'), JSON.stringify({...previousJobs,reviewed: source.reviewed, jobs:appendBy(previousJobs.jobs,jobs,'id')}, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'docs/ps4-extra-game-downloads.json'), JSON.stringify({...previousDownloads,reviewed: source.reviewed, sourceScope: source.sourceScope, resources:appendBy(previousDownloads.resources,resources,'id'), imageSources:appendBy(previousDownloads.imageSources,imageSources,'file')}, null, 2) + '\n');
  console.log(JSON.stringify({additionalGames: source.files.length, totalOtherGameCollections: count, jobs: jobs.length}));
  return {jobs, resources};
}
module.exports = {prepare};
if (require.main === module) prepare();
