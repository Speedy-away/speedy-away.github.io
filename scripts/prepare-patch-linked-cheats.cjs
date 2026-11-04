// Explicit second continuation: fetch ready JSON definitions as inert bytes.
// No repository clone, code archive, console connection or payload execution.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (file, value) => fs.writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + '\n');
const hash = (bytes, algorithm = 'sha256') => crypto.createHash(algorithm).update(bytes).digest('hex');
const selections = [
  ['bloodborne', 'CUSA00207_01.09.json', 'CUSA00208_01.09.json', 'CUSA00900_01.09.json'],
  ['assassin-s-creed-syndicate', 'CUSA02376_01.52.json'],
  ['cyberpunk-2077', 'CUSA16579_01.61.json'],
  ['dead-island-2', 'CUSA27043_01.10.json'],
  ['dishonored-definitive-edition', 'CUSA02231_01.00.json'],
  ['far-cry-6', 'CUSA15778_01.06.json'],
  ['far-cry-primal', 'CUSA03309_01.03.json'],
  ['gravity-rush-2', 'CUSA03694_01.11.json', 'CUSA04943_01.11.json'],
  ['just-cause-3', 'CUSA01493_01.05.json', 'CUSA02747_01.05.json'],
  ['ratchet-and-clank', 'CUSA01073_01.09.json'],
  ['red-dead-redemption', 'CUSA36843_01.03.json'],
  ['shadow-of-the-colossus', 'CUSA08809_01.01.json'],
  ['the-evil-within', 'CUSA00203_01.06.json'],
  ['the-order-1886', 'CUSA00100_01.02.json', 'CUSA00785_01.02.json'],
  ['final-fantasy-vii-remake', 'CUSA07052_01.02.json', 'CUSA07187_01.02.json'],
  ['horizon-forbidden-west', 'CUSA24705_01.18.json', 'CUSA28561_01.18.json'],
  ['stray', 'CUSA24899_01.03.json']
];
async function fetchBytes(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw Error('HTTP ' + response.status + ': ' + url);
  return Buffer.from(await response.arrayBuffer());
}
function preserve(file, bytes) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  if (fs.existsSync(target)) {
    if (hash(fs.readFileSync(target)) !== hash(bytes)) throw Error('Refusing to replace ' + file);
  } else fs.writeFileSync(target, bytes, {flag: 'wx'});
}
async function prepare() {
  const source = read('docs/ps4-extra-game-cheats.json');
  const tree = read('docs/ps4-ps5-research/goldhen-full-tree.json');
  if (tree.sha !== source.commit) throw Error('Pinned tree revision differs');
  const patches = read('docs/ps4-ps5-game-patches.json');
  const images = read('docs/ps4-ps5-game-patch-images.json').images;
  const baselineFile = 'docs/qa/patch-linked-cheats-baseline.json';
  if (!fs.existsSync(path.join(root, baselineFile))) {
    const audit = read('docs/download-audit.json');
    write(baselineFile, {
      capturedAt: new Date().toISOString(), catalogue: read('docs/console-download-catalog.json').items,
      sourceFiles: source.files, games: read('docs/ps4-ps5-game-resources.json').games,
      inventory: audit.items.map(item => ({id: item.id, files: (item.files || []).map(file => ({name: file.name, sha256: file.sha256, bytes: file.bytes, backupPath: file.backupPath}))})),
      companions: ['ps4', 'ps5'].map(platform => {
        const file = 'console/' + platform + '/whatsite-' + platform + '.html';
        const bytes = fs.readFileSync(path.join(root, file));
        return {file, bytes: bytes.length, sha256: hash(bytes)};
      })
    });
  }
  const records = [];
  for (const [gameId, ...filenames] of selections) {
    const game = patches.games.find(game => game.id === gameId && game.arch === 'orbis');
    if (!game) throw Error('Missing PS4 patch family: ' + gameId);
    let artwork = images[gameId];
    if (!artwork && gameId === 'ratchet-and-clank') {
      const sourcePage = 'https://www.playstation.com/en-gb/games/ratchet-and-clank/';
      const html = fs.readFileSync(path.join(root, 'tmp/ratchet-official-page.html'), 'utf8');
      const tag = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]).find(tag => /(?:property|name)=["']og:image["']/.test(tag));
      const url = tag?.match(/content=["']([^"']+)["']/)?.[1]?.replaceAll('&amp;', '&');
      if (!url || !/^https:\/\/(?:gmedia\.playstation\.com|image\.api\.playstation\.com)\//.test(url)) throw Error('No official Ratchet artwork');
      const bytes = await fetchBytes(url);
      if (!['ffd8ff', '89504e'].includes(bytes.subarray(0, 3).toString('hex'))) throw Error('Invalid official image');
      const image = '/assets/images/game-patches/ratchet-and-clank-official' + (bytes[0] === 0x89 ? '.png' : '.jpg');
      preserve(image.slice(1), bytes);
      artwork = {image, sourcePage, source: url, bytes: bytes.length, sha256: hash(bytes), kind: 'Official PlayStation Ratchet & Clank (PS4) artwork'};
    }
    if (!artwork) throw Error('No reviewed artwork for ' + gameId);
    const imageBytes = fs.readFileSync(path.join(root, artwork.image.slice(1)));
    if (imageBytes.length !== artwork.bytes || hash(imageBytes) !== artwork.sha256) throw Error('Artwork does not match evidence: ' + gameId);
    for (const filename of filenames) {
      const entry = tree.tree.find(entry => entry.path === 'json/' + filename);
      if (!entry) throw Error('File absent from pinned tree: ' + filename);
      const url = 'https://raw.githubusercontent.com/GoldHEN/GoldHEN_Cheat_Repository/' + source.commit + '/json/' + filename;
      const stagedPath = 'tmp/patch-linked-cheats/' + filename;
      const bytes = fs.existsSync(path.join(root, stagedPath)) ? fs.readFileSync(path.join(root, stagedPath)) : await fetchBytes(url);
      if (bytes.length !== entry.size || hash(Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes]), 'sha1') !== entry.sha) throw Error('Official Git blob differs: ' + filename);
      const json = JSON.parse(bytes.toString('utf8'));
      if (filename !== json.id + '_' + json.version + '.json' || !game.titleIds.includes(json.id) || !json.mods?.length || json.process !== 'eboot.bin') throw Error('Invalid ready cheat metadata: ' + filename);
      preserve(stagedPath, bytes);
      records.push({game: gameId, title: game.title, filename, url, sourceName: json.name, titleId: json.id, version: json.version, process: json.process, credits: json.credits, cheats: json.mods.map(mod => mod.name), bytes: bytes.length, sha256: hash(bytes), stagedPath, image: artwork.image,
        artwork: {source: artwork.source, page: artwork.sourcePage, type: artwork.kind, bytes: artwork.bytes, sha256: artwork.sha256},
        sourceNotes: ['This download is a PS4 cheat definition for ' + json.id + ' update ' + json.version + '. The FPS/graphics patch link below is a separate resource with its own update and hardware requirements; matching title IDs alone do not establish that both files can be enabled together.']});
      console.log(filename + ': ' + json.name + ' · ' + json.mods.length + ' cheat labels · verified official Git blob');
    }
  }
  // Re-read shared inputs immediately before each additive merge.
  const latest = read('docs/ps4-extra-game-cheats.json');
  for (const record of records) {
    const existing = latest.files.find(file => file.filename === record.filename);
    if (existing && existing.sha256 !== record.sha256) throw Error('Different existing cheat version: ' + record.filename);
    if (!existing) latest.files.push(record);
  }
  write('docs/ps4-extra-game-cheats.json', latest);
  write('docs/ps4-ps5-research/patch-linked-cheats.json', {reviewed: '2026-11-02', repository: source.repository, commit: source.commit, method: 'Ready JSON bytes checked against the pinned Git tree blob size and SHA-1, then SHA-256 recorded. Artwork checked against original publisher provenance. No files executed.', games: selections.map(([game]) => game), files: records});
  require('./prepare-extra-game-cheats.cjs').prepare();
  const jobs = read('docs/ps4-extra-game-download-jobs.json').jobs.filter(job => records.some(file => file.filename === job.filename));
  write('docs/qa/patch-linked-cheats-download-jobs.json', {reviewed: '2026-11-02', jobs});
  console.log(JSON.stringify({newGameCollections: selections.length, readyFiles: records.length, archiveJobs: jobs.length}));
}
if (require.main === module) prepare().catch(error => {console.error(error.message); process.exitCode = 1;});
module.exports = {selections, prepare};
