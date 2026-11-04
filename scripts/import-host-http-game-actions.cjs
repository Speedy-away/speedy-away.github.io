// Exact BIN variants mapped to GoldHEN HTTP by the upstream host. Never execute them.
const fs = require('node:fs');
const path = require('node:path');
const {destinationForFile} = require('./download-archive-layout.cjs');
const {storePreserving, writeJSON, mergeAudit, sha} = require('./import-host-game-actions.cjs');
const root = path.resolve(__dirname, '..');
const backup = path.resolve('F:/whatsite-backup-downloads-etc');
const evidencePath = path.join(root, 'docs/host-game-source-evidence.json');
const inventoryPath = path.join(root, 'docs/host-game-http-download-inventory.json');
const actionsPath = path.join(root, 'docs/host-game-actions.json');
const overridesPath = path.join(root, 'docs/host-game-http-action-overrides.json');
const definitions = [
  ['arabicguy-gta5-127', 'ArabicGuy', 'GTA V', '1.27', 'GTA/ArabicGuy-1.0-1.27-rfoodxmodz.bin'],
  ['arabicguy-gta5-132', 'ArabicGuy', 'GTA V', '1.32', 'GTA/ArabicGuy-1.0-1.32-rfoodxmodz.bin'],
  ['arabicguy-gta5-133', 'ArabicGuy', 'GTA V', '1.33', 'GTA/ArabicGuy-1.0-1.33-rfoodxmodz.bin'],
  ['beefqueef-gta5-133', 'BeefQueefMod', 'GTA V', '1.33', 'GTA/BeefQueefMod-1.33.bin'],
  ...['100', '113', '119', '124', '129'].map(version => ['oysters-rdr2-' + version, 'Oysters', 'RDR2', '1.' + version.slice(1), 'RDR2/OystersMenu-1.' + version.slice(1) + '-FREE.bin'])
].map(([id, label, game, gameVersion, relative]) => ({id, label, game, gameVersion, relative}));
function applyOverrides(catalog) {
  if (!fs.existsSync(overridesPath)) return catalog;
  const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
  return {...catalog, actions:catalog.actions.map(action => ({...action, ...(overrides.actions.find(row => row.id === action.id) || {})}))};
}
async function download() {
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const commit = evidence.nazkyCommit;
  if (!/^[a-f0-9]{40}$/.test(commit)) throw Error('Missing reviewed Nazky revision');
  const sourceBase = `https://raw.githubusercontent.com/Nazky/PSFree/${commit}/`;
  const codeResponse = await fetch(sourceBase + 'payloads/payloads.js', {signal:AbortSignal.timeout(30000)});
  if (!codeResponse.ok) throw Error('Cannot read pinned HTTP dispatch source');
  const code = await codeResponse.text();
  const readyProof = evidence.sources.find(source => source.id === 'nazky-http-transport');
  if (sha(Buffer.from(code)) !== readyProof.sha256) throw Error('Reviewed HTTP transport source changed');
  const checkedAt = new Date().toISOString();
  const inventory = {schemaVersion:1, updated:checkedAt, backupRoot:backup, sourceCommit:commit, items:[]};
  const catalog = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));
  const overrides = [];
  for (const definition of definitions) {
    const sourceURL = sourceBase + 'payloads/Bins/' + definition.relative;
    const proof = evidence.nazkyBinaryCrossChecks.find(row => row.id === definition.id);
    if (!proof || proof.status !== 200 || !code.includes('./payloads/Bins/' + definition.relative)) throw Error('Exact HTTP mapping missing: ' + definition.id);
    const response = await fetch(sourceURL, {signal:AbortSignal.timeout(60000)});
    if (!response.ok) throw Error(response.status + ' ' + sourceURL);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (sha(bytes) !== proof.sha256 || bytes.length !== proof.bytes) throw Error('Reviewed menu bytes differ: ' + definition.id);
    const release = 'Nazky PSFree ' + commit.slice(0, 12) + ' - game ' + definition.gameVersion;
    const item = {id:'host-http-ps4-' + definition.id, project:definition.label, title:definition.label + ' - ' + definition.game + ' ' + definition.gameVersion + ' - Nazky HTTP variant', platform:'PS4', category:['Games', definition.game === 'GTA V' ? 'GTA5' : 'RDR2', definition.gameVersion], release, url:'https://github.com/Nazky/PSFree', sourceUrls:[sourceURL, sourceBase + 'payloads/payloads.js'], sourceCommit:commit, kind:'pinned-host-menu-build', status:'downloaded', gameVersion:definition.gameVersion, firmware:'9.00', pages:['hosts/ps4/index.html'], license:'No menu-specific redistribution licence declared; compiled build distributed by upstream host.', files:[]};
    const file = {name:definition.id + '-ps4-900.bin', bytes:bytes.length, sha256:sha(bytes), resolvedUrl:sourceURL, releaseTag:release, archivedAt:checkedAt, archiveRole:['Builds'], archiveAvailability:'present'};
    file.backupPath = storePreserving(destinationForFile(backup, item, file), bytes, backup);
    const localFile = storePreserving(path.join(root, 'downloads/hosts/ps4/game-menus/nazky-' + commit.slice(0, 12), file.name), bytes, path.join(root, 'downloads'));
    file.local = '/' + path.relative(root, localFile).split(path.sep).join('/');
    item.files.push(file); inventory.items.push(item);
    overrides.push({id:'ps4-' + definition.id, downloadURL:file.local, bytes:file.bytes, sha256:file.sha256, source:'https://github.com/Nazky/PSFree/blob/' + commit + '/payloads/payloads.js', sourceURL, sourceCommit:commit, hostURL:'https://nazky.github.io/PSFree/', firmwareEvidence:'The pinned Nazky host lists PS4 9.00 and maps this exact BIN through its GoldHEN HTTP sender. No other firmware or PS5 compatibility is asserted; hardware execution was not tested here.', loaderEvidence:{sourceURL:sourceBase + 'payloads/payloads.js', payloadPath:'./payloads/Bins/' + definition.relative, transport:'Raw BIN ArrayBuffer POST to GoldHEN HTTP port 9090, after /status reports ready.'}, run:{type:'goldhen-http', port:9090, statusPath:'/status', readyStatus:'ready'}, launchLabel:'Send to PS4', launchURL:null});
    console.log(definition.id + ': exact HTTP variant ' + file.sha256);
  }
  // Retain these downloads, but do not pretend the exploit-loader variants have an established HTTP send route.
  for (const id of ['ps4-arabicguy-gta5-100', 'ps4-lamance-gta5-138', 'ps4-north-beta-rdr2-129']) {
    const existing = catalog.actions.find(action => action.id === id);
    if (!existing) throw Error('Missing preserved upstream choice: ' + id);
    overrides.push({id, run:null, launchURL:'https://www.kmeps4.site/', launchLabel:'Open menu host', loaderEvidence:null, requirements:[
      'PS4 firmware 9.00 and the exact game update shown for this menu.',
      'This ready BIN is preserved from the pinned Kameleon browser host. Open that host and select its matching menu option.',
      'Native GoldHEN HTTP compatibility of this exact variant has not been established, so this site does not provide a direct Send action for it.',
      'Check the original menu requirements for regional title IDs and use one menu at a time in offline/story mode.'
    ]});
  }
  writeJSON(inventoryPath, inventory);
  writeJSON(overridesPath, {schemaVersion:1, updated:checkedAt, sourceCommit:commit, actions:overrides});
  writeJSON(actionsPath, {...applyOverrides(catalog), updated:checkedAt});
  if (process.argv.includes('--merge-audit')) mergeAudit(inventory);
  console.log('Stored nine exact HTTP-mapped menu variants; three preserved menus use honest upstream-host actions.');
}
function check() {
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));
  for (const item of inventory.items) {
    const file = item.files[0];
    const bytes = fs.readFileSync(path.resolve(root, '.' + file.local));
    if (sha(bytes) !== file.sha256 || bytes.length !== file.bytes) throw Error('Mirror mismatch: ' + file.name);
    const action = catalog.actions.find(row => row.id === item.id.replace('host-http-', ''));
    if (!action || action.downloadURL !== file.local || action.sha256 !== file.sha256 || action.run?.type !== 'goldhen-http') throw Error('HTTP action mismatch: ' + item.id);
    if (process.argv.includes('--verify-backup') && sha(fs.readFileSync(file.backupPath)) !== file.sha256) throw Error('Backup mismatch: ' + file.name);
  }
  console.log('Verified nine exact Nazky HTTP BIN variants and retained F: copies. No payload executed.');
}
if (require.main === module) (process.argv.includes('--download') ? download() : Promise.resolve().then(check)).catch(error => {console.error(error.message); process.exitCode=1;});
module.exports = {applyOverrides};
