// Import reviewed firmware-9.00 menu builds as data only. Never execute a payload.
// --download requires the normal permission boundary for the F: archive.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {destinationForFile} = require('./download-archive-layout.cjs');

const root = path.resolve(__dirname, '..');
const backup = path.resolve('F:/whatsite-backup-downloads-etc');
const commit = 'da9c138e47c52773aa9ab999cff69590c573667f';
const repository = 'https://github.com/kmeps4/psfree900a';
const sourceBase = `https://raw.githubusercontent.com/kmeps4/psfree900a/${commit}/`;
const inventoryFile = path.join(root, 'docs/host-game-download-inventory.json');
const actionsFile = path.join(root, 'docs/host-game-actions.json');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sevenZip = process.env.WHATSITE_SEVEN_ZIP || 'C:/Program Files/7-Zip/7z.exe';
const builds = [
  ['arabicguy-gta5-100', 'ArabicGuy', 'GTA V', '1.00', null, 'pl_ArabicGuy100.bin.bz2'],
  ['arabicguy-gta5-127', 'ArabicGuy', 'GTA V', '1.27', null, 'pl_ArabicGuy127.bin.bz2'],
  ['arabicguy-gta5-132', 'ArabicGuy', 'GTA V', '1.32', null, 'pl_ArabicGuy132.bin.bz2'],
  ['arabicguy-gta5-133', 'ArabicGuy', 'GTA V', '1.33', null, 'pl_ArabicGuy133.bin.bz2'],
  ['beefqueef-gta5-133', 'BeefQueefMod', 'GTA V', '1.33', null, 'pl_BeefQueefMod133.bin.bz2'],
  ['lamance-gta5-138', 'Lamance', 'GTA V', '1.38', '0.9', 'pl_lamance.bin.bz2'],
  ['oysters-rdr2-100', 'Oysters', 'RDR2', '1.00', null, 'pl_rdr2_100.bin.bz2'],
  ['oysters-rdr2-113', 'Oysters', 'RDR2', '1.13', null, 'pl_rdr2_113.bin.bz2'],
  ['oysters-rdr2-119', 'Oysters', 'RDR2', '1.19', null, 'pl_rdr2_119.bin.bz2'],
  ['oysters-rdr2-124', 'Oysters', 'RDR2', '1.24', null, 'pl_rdr2_124.bin.bz2'],
  ['oysters-rdr2-129', 'Oysters', 'RDR2', '1.29', null, 'pl_rdr2_129.bin.bz2'],
  ['north-beta-rdr2-129', 'North Beta', 'RDR2', '1.29', null, 'pl_NorthBeta011.bin.bz2']
].map(([id, label, game, gameVersion, menuVersion, filename]) => ({id, label, game, gameVersion, menuVersion, filename}));

function inside(base, target) {
  const relative = path.relative(path.resolve(base), path.resolve(target));
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Outside intended directory: ' + target);
}
function storePreserving(target, bytes, boundary) {
  inside(boundary, target);
  const digest = sha(bytes);
  if (fs.existsSync(target)) {
    if (sha(fs.readFileSync(target)) === digest) return target;
    const extension = path.extname(target);
    target = target.slice(0, -extension.length) + '-' + digest.slice(0, 12) + extension;
    inside(boundary, target);
    if (fs.existsSync(target)) {
      if (sha(fs.readFileSync(target)) !== digest) throw Error('Existing alternate file differs: ' + target);
      return target;
    }
  }
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, bytes, {flag:'wx'});
  return target;
}
function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
function savePS4Actions(actions, updated = new Date().toISOString()) {
  const previous = fs.existsSync(actionsFile) ? JSON.parse(fs.readFileSync(actionsFile, 'utf8')) : {};
  const otherPlatforms = (previous.actions || []).filter(action => action.platform !== 'ps4');
  let catalog = {...previous, schemaVersion:1, updated, sourceCommit:commit, actions:[...actions, ...otherPlatforms]};
  if (fs.existsSync(path.join(root, 'docs/host-game-http-action-overrides.json'))) catalog = require('./import-host-http-game-actions.cjs').applyOverrides(catalog);
  writeJSON(actionsFile, catalog);
}
async function fetchBytes(url) {
  const response = await fetch(url, {signal:AbortSignal.timeout(60000)});
  if (!response.ok) throw Error(`${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw Error('Unexpected download size: ' + url);
  return bytes;
}
function actionFor(build, file) {
  return {
    id:'ps4-' + build.id,
    label:build.label,
    platform:'ps4',
    category:'mods',
    game:build.game,
    gameVersion:build.gameVersion,
    menuVersion:build.menuVersion,
    titleIds:[],
    firmwares:['9.00'],
    firmwareEvidence:'The pinned Kameleon host README targets PS4 firmware 9.00; its index maps this exact game-update payload. Other firmware and PS5 support are not established.',
    format:'BIN',
    bytes:file.bytes,
    sha256:file.sha256,
    downloadURL:file.local,
    downloadLabel:'Download BIN',
    run:{type:'goldhen-http', port:9090, statusPath:'/status', readyStatus:'ready'},
    launchLabel:'Send to PS4',
    launchURL:null,
    hostURL:'https://www.kmeps4.site/',
    source:repository + '/blob/' + commit + '/index.html',
    sourceURL:sourceBase + build.filename,
    sourceCommit:commit,
    license:'Not declared for this closed-source menu build; publicly distributed by the credited upstream host. No open-source license is asserted.',
    requirements:[
      'PS4 firmware 9.00 with an already active compatible jailbreak and GoldHEN BinLoader HTTP server on port 9090.',
      `${build.game} PS4 game update ${build.gameVersion}; game update and console firmware are separate requirements.`,
      'Use the original menu requirements to confirm your regional title ID; the upstream host does not supply a title-ID list.',
      'The console and sender must be reachable on the same network. Open the site over HTTP when the browser blocks HTTPS-to-HTTP console requests.',
      'Use one menu at a time in offline/story mode. HTTP acceptance confirms delivery, not successful injection into the game.'
    ],
    installation:'This is a raw PS4 payload BIN, already decompressed on the server. It is not an ELF, PRX plugin, game PKG or an archive.',
    image:build.game === 'GTA V' ? '/assets/images/gta52.png' : '/assets/images/rdr2.png',
    imageRole:'Game artwork; not a screenshot of this menu build.',
    tags:['PS4', '9.00', build.game, build.gameVersion, build.label, 'mod menu', 'BIN payload', 'GoldHEN HTTP', 'ready-to-use']
  };
}
function mergeAudit(inventory) {
  // Re-read immediately before merging; never replace another import's IDs.
  const file = path.join(root, 'docs/download-audit.json');
  const current = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const item of inventory.items) {
    const index = current.items.findIndex(row => row.id === item.id);
    if (index < 0) current.items.push(item);
    else {
      const previous = current.items[index];
      const files = [...previous.files];
      for (const entry of item.files) if (!files.some(old => old.sha256 === entry.sha256 && old.name === entry.name)) files.push(entry);
      current.items[index] = {...previous, ...item, files};
    }
  }
  current.updated = new Date().toISOString();
  writeJSON(file, current);
}
async function download() {
  const checkedAt = new Date().toISOString();
  const inventory = {schemaVersion:1, updated:checkedAt, backupRoot:backup, sourceCommit:commit, items:[]};
  const actions = [];
  for (const build of builds) {
    const sourceURL = sourceBase + build.filename;
    const original = await fetchBytes(sourceURL);
    if (original.subarray(0, 3).toString('ascii') !== 'BZh') throw Error('Not a BZIP2 stream: ' + sourceURL);
    // 7-Zip only decompresses a single BZIP2 stream to stdout. No archive path extraction or execution occurs.
    const payload = execFileSync(sevenZip, ['e', '-tbzip2', '-si', '-so'], {input:original, maxBuffer:32 * 1024 * 1024, windowsHide:true});
    if (payload.length < 4096 || payload.length > 20 * 1024 * 1024 || /^\s*<!|^\s*<html/i.test(payload.subarray(0, 64).toString())) throw Error('Unexpected payload bytes: ' + build.id);
    const release = `${build.menuVersion ? 'v' + build.menuVersion + ' - ' : ''}game ${build.gameVersion} - firmware 9.00 - ${commit.slice(0, 12)}`;
    const item = {
      id:'host-games-ps4-' + build.id,
      project:build.label,
      title:`${build.label} - ${build.game} ${build.gameVersion} - PS4 9.00`,
      platform:'PS4', category:['Games', build.game === 'GTA V' ? 'GTA5' : 'RDR2', build.gameVersion],
      url:repository, sourceUrls:[sourceURL, repository + '/blob/' + commit + '/index.html'],
      kind:'pinned-host-menu-build', status:'downloaded', release,
      pages:['hosts/ps4/index.html'],
      sourceCommit:commit,
      gameVersion:build.gameVersion,
      firmware:'9.00',
      license:'No menu-specific redistribution license declared by upstream; closed-source compiled build.',
      files:[]
    };
    const originalFile = {name:build.filename, bytes:original.length, sha256:sha(original), resolvedUrl:sourceURL, releaseTag:release, archivedAt:checkedAt, archiveRole:['Builds']};
    originalFile.backupPath = storePreserving(destinationForFile(backup, item, originalFile), original, backup);
    originalFile.archiveAvailability = 'present';
    const name = build.id + '-ps4-900.bin';
    const readyFile = {name, bytes:payload.length, sha256:sha(payload), resolvedUrl:sourceURL, releaseTag:release, archivedAt:checkedAt, archiveRole:['Builds'], transformation:'BZIP2 decompression only; payload bytes were never executed.', sourceArchiveSHA256:originalFile.sha256};
    readyFile.backupPath = storePreserving(destinationForFile(backup, item, readyFile), payload, backup);
    readyFile.archiveAvailability = 'present';
    const localFile = storePreserving(path.join(root, 'downloads/hosts/ps4/game-menus/firmware-9.00', name), payload, path.join(root, 'downloads'));
    readyFile.local = '/' + path.relative(root, localFile).split(path.sep).join('/');
    item.files.push(originalFile, readyFile);
    inventory.items.push(item);
    actions.push(actionFor(build, readyFile));
    console.log(build.id + ': ' + payload.length + ' ready bytes, SHA-256 ' + readyFile.sha256);
    // Save completed progress if a later upstream file is unavailable.
    writeJSON(inventoryFile, inventory);
    savePS4Actions(actions, checkedAt);
  }
  if (process.argv.includes('--merge-audit')) mergeAudit(inventory);
}
function check() {
  const inventory = JSON.parse(fs.readFileSync(inventoryFile, 'utf8'));
  const httpInventoryFile = path.join(root, 'docs/host-game-http-download-inventory.json');
  const allItems = [...inventory.items, ...(fs.existsSync(httpInventoryFile) ? JSON.parse(fs.readFileSync(httpInventoryFile, 'utf8')).items : [])];
  const catalog = JSON.parse(fs.readFileSync(actionsFile, 'utf8'));
  const ps4Actions = catalog.actions.filter(action => action.platform === 'ps4');
  for (const action of ps4Actions) {
    const target = path.resolve(root, '.' + action.downloadURL);
    inside(path.join(root, 'downloads'), target);
    const bytes = fs.readFileSync(target);
    if (bytes.length !== action.bytes || sha(bytes) !== action.sha256) throw Error('Site payload mismatch: ' + action.id);
    if (action.platform !== 'ps4' || action.format !== 'BIN' || action.firmwares.join() !== '9.00') throw Error('Unexpected platform/format pin: ' + action.id);
    const item = allItems.find(row => row.files.some(file => file.sha256 === action.sha256 && file.local === action.downloadURL));
    if (!item || !item.files.some(file => file.sha256 === action.sha256 && file.local === action.downloadURL)) throw Error('Inventory missing: ' + action.id);
  }
  if (process.argv.includes('--verify-backup')) for (const item of inventory.items) for (const file of item.files) {
    inside(backup, file.backupPath);
    const bytes = fs.readFileSync(file.backupPath);
    if (bytes.length !== file.bytes || sha(bytes) !== file.sha256) throw Error('Backup mismatch: ' + file.backupPath);
  }
  console.log('Verified ' + ps4Actions.length + ' pinned, ready PS4 menu BINs; no payloads executed.');
}
function refreshCatalog() {
  const inventory = JSON.parse(fs.readFileSync(inventoryFile, 'utf8'));
  savePS4Actions(builds.map(build => {
    const item = inventory.items.find(row => row.id === 'host-games-ps4-' + build.id);
    const file = item?.files.find(row => row.local && row.name.endsWith('.bin'));
    if (!file) throw Error('Completed import missing: ' + build.id);
    return actionFor(build, file);
  }));
}
if (require.main === module) {
  (process.argv.includes('--download') ? download() : Promise.resolve().then(() => {
    if (process.argv.includes('--refresh-catalog')) refreshCatalog();
    check();
  })).catch(error => {console.error(error.message); process.exitCode = 1;});
}
module.exports = {builds, commit, actionFor, storePreserving, writeJSON, mergeAudit, sha};
