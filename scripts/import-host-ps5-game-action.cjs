// Acquire one pinned ready ELF, never execute it. Keep source and licence links beside the download.
const fs = require('node:fs');
const path = require('node:path');
const {destinationForFile} = require('./download-archive-layout.cjs');
const {storePreserving, writeJSON, mergeAudit, sha} = require('./import-host-game-actions.cjs');
const root = path.resolve(__dirname, '..');
const backup = path.resolve('F:/whatsite-backup-downloads-etc');
const repository = 'https://github.com/armanate/rdr2-60fps-runtime-patcher';
const tag = 'v2.0';
const expectedSHA256 = '646ecb71e80415ab9d9c651539451d38ee0052a5997f7ef7504a42932c7f8261';
const assetName = 'RedDead2.60FPS_v2.0.elf';
const sourceURL = `${repository}/releases/download/${tag}/${assetName}`;
const inventoryPath = path.join(root, 'docs/host-ps5-game-download-inventory.json');
const actionsPath = path.join(root, 'docs/host-game-actions.json');
async function fetchBytes(url) {
  const response = await fetch(url, {signal:AbortSignal.timeout(60000)});
  if (!response.ok) throw Error(`${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 1024 * 1024) throw Error('Unexpected download size: ' + url);
  return bytes;
}
function actionFor(file, licenseFile, readmeFile) {
  return {
    id:'ps5-rdr2-60fps-v2-0',
    label:'RDR2 60FPS runtime patch',
    platform:'ps5',
    category:'mods',
    game:'RDR2', gameVersion:'1.32', menuVersion:null, version:tag,
    titleIds:['CUSA08519', 'CUSA03041', 'CUSA08568'],
    firmwares:[],
    firmwareEvidence:'The author requires a jailbroken PS5 with elfldr, and discusses 8.40 or newer including 13.60, but does not publish a complete validated firmware list. An empty list means compatibility is unspecified, not universal.',
    firmwarePolicy:'requirements-only',
    format:'ELF', bytes:file.bytes, sha256:file.sha256,
    downloadURL:file.local, downloadLabel:'Download ELF',
    run:{type:'elf-http', port:9021}, launchLabel:'Send to PS5', launchURL:null,
    loaderEvidence:{sourceURL:'https://github.com/ps5-payload-dev/elfldr/blob/v0.27/socksrv.c', protocol:'GET http://CONSOLE-IP:9021/?uri=encoded-console-reachable-ELF-URL', acknowledgement:'HTTP 200 is sent before the ELF is downloaded or spawned.'},
    source:repository + '/releases/tag/' + tag,
    sourceURL,
    sourceCodeURL:repository + '/tree/' + tag,
    sourceArchiveURL:repository + '/archive/refs/tags/' + tag + '.zip',
    license:'GPL-3.0; see the retained upstream GPL and MIT component notices.',
    licenseURL:licenseFile.local,
    instructionsURL:readmeFile.local,
    copyright:'Copyright (c) 2026 KurohaXR and Arman Jafari; includes code ported from OpenSourcereR/ps5debug-NG. Distributed without warranty under the upstream licence.',
    requirements:[
      'A jailbroken PS5 with elfldr v0.27 or another loader implementing its HTTP URL interface on port 9021. A configured local sender can alternatively use the compatible raw TCP loader route.',
      'For native URL loading, the ready ELF must be published at a URL the console can reach. A computer-only 127.0.0.1 URL is not reachable from the PS5.',
      'RDR2 PS4 game update 1.32, clean and unmodified, with title ID CUSA08519, CUSA03041 or CUSA08568.',
      'Fully close RDR2, load this ELF first, wait for its ready notification, then start RDR2 within 10 minutes.',
      'This applies a runtime FPS/resolution patch; it is not a full mod menu or a PS4 payload.',
      'The author does not provide a complete validated PS5 firmware list. Check the release requirements for your existing loader and firmware.',
      'The HTTP loader accepts the request before download and execution; HTTP 200 does not confirm the patch ran. Read the console notification and /data/rdr2-60fps/rdr2-60fps.log for the actual result.'
    ],
    installation:'The ready ELF is loaded in memory. Its first run creates /data/rdr2-60fps/scale.txt for optional resolution settings. Closing the game removes the runtime game changes.',
    image:'/assets/images/rdr2.png', imageRole:'Game artwork; not a screenshot of this runtime patch.',
    tags:['PS5', 'RDR2', '1.32', '60 FPS', 'runtime patch', 'ELF', 'elfldr', 'CUSA08519', 'CUSA03041', 'CUSA08568']
  };
}
function updateAction(item) {
  const catalog = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));
  const file = item.files.find(row => row.name === assetName);
  const license = item.files.find(row => row.name === 'LICENSE.txt');
  const readme = item.files.find(row => row.name === 'README-upstream.md');
  const action = actionFor(file, license, readme);
  const index = catalog.actions.findIndex(row => row.id === action.id);
  if (index < 0) catalog.actions.push(action); else catalog.actions[index] = action;
  catalog.updated = new Date().toISOString();
  writeJSON(actionsPath, catalog);
}
async function download() {
  const checkedAt = new Date().toISOString();
  const item = {id:'host-games-ps5-rdr2-60fps-v2-0', project:'RDR2 60FPS runtime patcher', title:'RDR2 60FPS runtime patcher v2.0 - PS5 - game 1.32', platform:'PS5', category:['Games', 'RDR2', '1.32'], release:tag, url:repository, sourceUrls:[sourceURL, repository + '/releases/tag/' + tag], kind:'github-release', status:'downloaded', pages:['hosts/ps5/index.html'], license:'GPL-3.0 with retained GPL/MIT component notices', files:[]};
  const inputs = [
    {name:assetName, url:sourceURL, role:['Builds']},
    {name:'LICENSE.txt', url:`https://raw.githubusercontent.com/armanate/rdr2-60fps-runtime-patcher/${tag}/LICENSE`, role:['Metadata']},
    {name:'README-upstream.md', url:`https://raw.githubusercontent.com/armanate/rdr2-60fps-runtime-patcher/${tag}/README.md`, role:['Metadata']}
  ];
  for (const input of inputs) {
    const bytes = await fetchBytes(input.url);
    if (input.name === assetName && (sha(bytes) !== expectedSHA256 || bytes.subarray(0, 4).toString('hex') !== '7f454c46')) throw Error('Release ELF signature or GitHub-published checksum mismatch');
    if (input.name === 'LICENSE.txt' && !bytes.toString().includes('GNU GENERAL PUBLIC LICENSE')) throw Error('Upstream GPL notice missing');
    const file = {name:input.name, bytes:bytes.length, sha256:sha(bytes), resolvedUrl:input.url, releaseTag:tag, archivedAt:checkedAt, archiveRole:input.role, archiveAvailability:'present'};
    file.backupPath = storePreserving(destinationForFile(backup, item, file), bytes, backup);
    const localFile = storePreserving(path.join(root, 'downloads/hosts/ps5/game-mods/rdr2-60fps/v2.0', input.name), bytes, path.join(root, 'downloads'));
    file.local = '/' + path.relative(root, localFile).split(path.sep).join('/');
    item.files.push(file);
  }
  const inventory = {schemaVersion:1, updated:checkedAt, backupRoot:backup, items:[item]};
  writeJSON(inventoryPath, inventory);
  updateAction(item);
  if (process.argv.includes('--merge-audit')) mergeAudit(inventory);
  console.log('Saved PS5 RDR2 patch ELF ' + expectedSHA256 + ' and retained upstream notices. No payload executed.');
}
function check() {
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  for (const file of inventory.items[0].files) {
    const bytes = fs.readFileSync(path.resolve(root, '.' + file.local));
    if (sha(bytes) !== file.sha256 || bytes.length !== file.bytes) throw Error('Site file mismatch: ' + file.name);
    if (process.argv.includes('--verify-backup')) {
      const archived = fs.readFileSync(file.backupPath);
      if (sha(archived) !== file.sha256 || archived.length !== file.bytes) throw Error('Backup mismatch: ' + file.name);
    }
  }
  const action = JSON.parse(fs.readFileSync(actionsPath, 'utf8')).actions.find(row => row.id === 'ps5-rdr2-60fps-v2-0');
  if (!action || action.sha256 !== expectedSHA256 || action.platform !== 'ps5' || action.gameVersion !== '1.32' || action.format !== 'ELF') throw Error('Catalog mismatch');
  if (process.argv.includes('--refresh-catalog')) updateAction(inventory.items[0]);
  console.log('Verified one PS5 ELF with upstream release checksum and licence/instruction files. No payload executed.');
}
if (require.main === module) (process.argv.includes('--download') ? download() : Promise.resolve().then(check)).catch(error => {console.error(error.message); process.exitCode = 1;});
