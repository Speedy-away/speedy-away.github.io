// Narrow community cheat import: six exact native PS5 builds, no execution or MC4 decoding.
const fs = require('node:fs');
const path = require('node:path');
const {destinationForFile} = require('./download-archive-layout.cjs');
const {storePreserving, writeJSON, mergeAudit, sha} = require('./import-host-game-actions.cjs');
const root = path.resolve(__dirname, '..');
const backup = path.resolve('F:/whatsite-backup-downloads-etc');
const repository = 'https://github.com/TeeKay87/HEN-Cheats-Collection';
const commit = '39a55c2b0030864e7e42812faa8d6157a4a40269';
const rawBase = 'https://raw.githubusercontent.com/TeeKay87/HEN-Cheats-Collection/' + commit + '/';
const catalogPath = path.join(root, 'docs/host-current-cheat-actions.json');
const inventoryPath = path.join(root, 'docs/host-current-cheat-download-inventory.json');
const definitions = [
  ['gta5-ps5-04263-01010002', 'GTA V', 'PPSA04263', '01.010.002', 'mc4', '37ab95f2'],
  ['gta5-ps5-04264-01005000', 'GTA V', 'PPSA04264', '01.005.000', 'mc4', '33feea8f'],
  ['gta5-ps5-04264-01010002', 'GTA V', 'PPSA04264', '01.010.002', 'mc4', '666864a2'],
  ['miles-morales-ps5-01417-01013002', "Marvel's Spider-Man: Miles Morales", 'PPSA01417', '01.013.002', 'json', '9f37ad8d'],
  ['miles-morales-ps5-01460-01015001', "Marvel's Spider-Man: Miles Morales", 'PPSA01460', '01.015.001', 'json', '4eed96b4'],
  ['sonic-frontiers-ps5-03831-01041000', 'Sonic Frontiers', 'PPSA03831', '01.041.000', 'json', 'cbdc02fa']
].map(([id, game, titleId, version, format, suffix]) => ({id, game, titleId, version, format, upstreamFilename:`${titleId}_${version}_${suffix}.${format}`, filename:`${titleId}_${version}.${format}`}));
function actionFor(definition, file, metadata) {
  const format = definition.format.toUpperCase();
  const folder = '/data/etaHEN/cheats/' + definition.format + '/';
  return {
    id:definition.id,
    label:definition.game + ' cheats',
    platform:'ps5', category:'mods', game:definition.game,
    gameVersion:definition.version, titleIds:[definition.titleId], gamePlatform:'native-ps5',
    firmwares:[], firmwarePolicy:'requirements-only',
    firmwareEvidence:'Cheat data is pinned to the exact native PS5 game build. The curator does not certify a firmware range or this site’s hardware execution.',
    format, downloadURL:file.local, downloadLabel:'Download ' + format,
    downloadFilename:definition.filename,
    bytes:file.bytes, sha256:file.sha256,
    run:null, launchURL:null,
    source:repository + '/blob/' + commit + '/cheats/' + definition.format + '/' + definition.upstreamFilename,
    sourceURL:file.resolvedUrl, sourceCommit:commit,
    sourceKind:'community-curator',
    curator:'TeeKay87 / HEN Cheats Collection',
    official:false,
    instructionsURL:'https://github.com/etaHEN/PS5_Cheats#usage',
    curatorInstructionsURL:repository + '/blob/' + commit + '/README.md#installation',
    installPath:folder + definition.filename,
    license:'No repository-wide licence is declared by this community collection. Original cheat-creator credit is retained; no official etaHEN authorship is implied.',
    credits:metadata.credits || [],
    cheatCount:metadata.cheatCount || null,
    metadataValidation:metadata.validation,
    requirements:[
      `Native PS5 ${definition.game}, title ID ${definition.titleId}, exact game version ${definition.version}. Do not use this file for the PS4 edition or another game update.`,
      `A homebrew-enabled PS5 with etaHEN or another cheat manager that supports ${format}. This file is cheat data, not a standalone ELF/BIN payload or a full mod menu.`,
      `Keep a backup of any existing file. Copy this ready file as ${definition.filename} to ${folder} using FTP or your console file manager.`,
      'Open the matching game, then etaHEN Toolbox > Cheats. Choose and toggle individual cheats through the manager; downloading the file does not enable anything.',
      'The official etaHEN repository documents JSON, SHN and MC4 formats and one format per title/version. Avoid keeping conflicting cheat variants for the same game build.',
      'Community-curated definitions were checked for their source identity and exact filename/build metadata. They were not hardware-tested or executed during this import.'
    ],
    installation:'The upstream creator-suffix filename is retained in provenance. Download bytes are unchanged; the served filename uses etaHEN’s documented TITLEID_version.format convention.',
    tags:['PS5', definition.game, definition.titleId, definition.version, format, 'cheats', 'etaHEN', 'community', 'ready-to-use', 'download only']
  };
}
async function download() {
  const at = new Date().toISOString();
  const inventory = {schemaVersion:1, updated:at, backupRoot:backup, sourceCommit:commit, items:[]};
  const actions = [];
  for (const definition of definitions) {
    const sourceURL = rawBase + 'cheats/' + definition.format + '/' + definition.upstreamFilename;
    const response = await fetch(sourceURL, {signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw Error(response.status + ' ' + sourceURL);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 1024 * 1024) throw Error('Unexpected cheat file size');
    let metadata;
    if (definition.format === 'json') {
      const parsed = JSON.parse(bytes.toString('utf8'));
      if (parsed.id !== definition.titleId || parsed.version !== definition.version || parsed.name !== definition.game || !Array.isArray(parsed.mods) || !parsed.mods.length) throw Error('Embedded game identity mismatch: ' + definition.id);
      metadata = {credits:parsed.credits || [], cheatCount:parsed.mods.length, validation:'Embedded JSON game name, title ID, version and nonempty mods list match the selected build. No cheat was enabled.'};
    } else {
      if (!/^[A-Za-z0-9+/=\r\n]+$/.test(bytes.toString('ascii'))) throw Error('Unexpected MC4 encoding');
      metadata = {validation:'Exact curator filename and independently listed game title identify this encrypted MC4 build. Bytes were not decoded, modified or executed.'};
    }
    const item = {
      id:'host-current-cheat-' + definition.id,
      title:definition.game + ' - ' + definition.titleId + ' ' + definition.version + ' - ' + definition.format.toUpperCase(),
      project:'HEN Cheats Collection', platform:'PS5',
      category:['Games', definition.game === 'GTA V' ? 'GTA5' : definition.game, definition.version, 'Cheats'],
      url:repository, sourceUrls:[sourceURL, repository + '/blob/' + commit + '/README.md'],
      kind:'pinned-community-cheat', status:'downloaded', release:'community-' + commit.slice(0,12),
      gameVersion:definition.version, titleIds:[definition.titleId], sourceCommit:commit,
      pages:['hosts/ps5/index.html'], credits:metadata.credits || [],
      publicationNote:'Ready native PS5 cheat data; download only, community curator, no hardware-success claim.',
      files:[]
    };
    const file = {name:definition.filename, upstreamName:definition.upstreamFilename, bytes:bytes.length, sha256:sha(bytes), resolvedUrl:sourceURL, releaseTag:item.release, archivedAt:at, archiveRole:['Builds'], archiveAvailability:'present', transformation:'Filename normalized only; source bytes preserved unchanged. No MC4 decoding and no cheat execution.'};
    file.backupPath = storePreserving(destinationForFile(backup, item, file), bytes, backup);
    const local = storePreserving(path.join(root, 'downloads/hosts/ps5/cheats/hen-cheats-collection', commit.slice(0,12), definition.filename), bytes, path.join(root, 'downloads'));
    file.local = '/' + path.relative(root, local).split(path.sep).join('/');
    item.files.push(file); inventory.items.push(item);
    actions.push(actionFor(definition, file, metadata));
    console.log(definition.id + ': ' + bytes.length + ' bytes, SHA-256 ' + file.sha256);
  }
  writeJSON(inventoryPath, inventory);
  writeJSON(catalogPath, {schemaVersion:1, updated:at, sourceCommit:commit, sourceKind:'community-curator', official:false, actions});
  if (process.argv.includes('--merge-audit')) mergeAudit(inventory);
}
function check() {
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  if (catalog.actions.length !== 6) throw Error('Unexpected number of curated builds');
  for (const action of catalog.actions) {
    const bytes = fs.readFileSync(path.resolve(root, '.' + action.downloadURL));
    if (sha(bytes) !== action.sha256 || bytes.length !== action.bytes || action.run !== null || action.platform !== 'ps5') throw Error('Invalid download-only action: ' + action.id);
    const item = inventory.items.find(row => row.id === 'host-current-cheat-' + action.id);
    if (!item || item.files[0].sha256 !== action.sha256) throw Error('Missing inventory');
    if (process.argv.includes('--verify-backup') && sha(fs.readFileSync(item.files[0].backupPath)) !== action.sha256) throw Error('Archive mismatch');
  }
  console.log('Verified six native PS5 ready cheat downloads, including three GTA V MC4 builds. No cheats decoded or executed.');
}
if (require.main === module) (process.argv.includes('--download') ? download() : Promise.resolve().then(check)).catch(error => {console.error(error.message); process.exitCode=1;});
