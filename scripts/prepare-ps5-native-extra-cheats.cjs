// Prepare six independently sourced native PS5 cheat definitions, not content
// imported from VirusMike. Read/validate bytes only; never execute cheat data.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {writePreserving, contained} = require('./prepare-console-ready-files.cjs');
const root = path.resolve(__dirname, '..');
const repository = 'https://github.com/etaHEN/PS5_Cheats';
const commit = 'ef295511ea4252474b16325618ffaafd3afb3cbb';
const directory = 'docs/tmp/ps5-native-extra-cheats/';
const raw = file => `https://raw.githubusercontent.com/etaHEN/PS5_Cheats/${commit}/${file}`;
const blob = file => `${repository}/blob/${commit}/${file}`;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const selected = [
  {game: 'The Last of Us Part II Remastered', gameSlug: 'the-last-of-us-part-ii-remastered', titleId: 'PPSA10662', gameVersion: '01.001.030', bytes: 1640, sha256: 'ff004b7c81b0ebeb69a9bc3b76c4642e76495299373eb17d6b8a85cec6d0ea46', identity: 'Exact game name and PPSA10662 in the JSON; named in the JSON index'},
  {game: "Dragon's Dogma 2", gameSlug: 'dragons-dogma-2', titleId: 'PPSA09663', gameVersion: '01.000.000', bytes: 1337, sha256: '64b48d7605989d5ba1c0e337b64a20e41a59f58714c4824d9e1f38a2794a99d8', identity: 'PPSA09663 and DD2GAME content-name in the JSON; the same PPSA is named Dragons Dogma 2 in the publisher SHN index'},
  {game: 'Silent Hill 2', gameSlug: 'silent-hill-2', titleId: 'PPSA08710', gameVersion: '01.005.000', bytes: 1407, sha256: 'e8acaefdb28aaa5c6f9610d39050f60e6bd0a3d71710216772c924bf05356661', identity: 'PPSA08710 content-name in the JSON; the same PPSA is named Silent Hill 2 in the publisher SHN index. SHN game-update support is not applied to this JSON'},
  {game: 'Astro Bot', gameSlug: 'astro-bot', titleId: 'PPSA21564', gameVersion: '01.007.000', bytes: 949, sha256: '42d3d4c39c7f607eedc1205014176790eb6c782fd20f20d264fff14c41a6d683', identity: 'PPSA21564 content-name in the JSON; the same PPSA/update is named Astro Bot in the publisher SHN index'},
  {game: 'Black Myth: Wukong', gameSlug: 'black-myth-wukong', titleId: 'PPSA23226', gameVersion: '01.000.010', bytes: 1577, sha256: '067fb30324492c673cb42646f847df040f9ec28de4fda945058818ad390cd23d', identity: 'PPSA23226 content-name in the JSON; the same PPSA/update is named Black Myth Wukong in the publisher SHN index'},
  {game: 'Ghostrunner 2', gameSlug: 'ghostrunner-2', titleId: 'PPSA09911', gameVersion: '01.000.000', bytes: 947, sha256: '489497800a06e8995a3798e601c12fa27a305fdde2f0151a980ba2b71ea2f1b3', identity: 'Exact PPSA09911_00-GHOSTRUNNER2US00 content-name in the JSON and publisher JSON index'}
];
const notices = [
  {id: 'ps5-native-cheats-license-ef295511ea42', filename: 'LICENSE.txt', member: 'LICENSE', bytes: 35149, sha256: '3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986', title: 'etaHEN PS5 Cheats · repository GPL-3.0 licence'},
  {id: 'ps5-native-cheats-readme-ef295511ea42', filename: 'README-upstream.md', member: '.github/README.md', bytes: 2112, sha256: 'c02526be96be26ed14f4bade5bbc7c6c0001d7168ac701373bd447f9bbbcdc1d', title: 'etaHEN PS5 Cheats · publisher usage and filename instructions'},
  {id: 'ps5-native-cheats-shn-index-ef295511ea42', filename: 'shn.txt', member: 'shn.txt', bytes: 38152, sha256: '8f13c6ba38d1cb22e5c7d85eff419feae2dafb3fd0880321de0be3cafaa7584c', title: 'etaHEN PS5 Cheats · publisher title identity index'}
];
const filenameFor = pin => `${pin.titleId}_${pin.gameVersion}.json`;

function validateCheat(bytes, pin) {
  if (bytes.length !== pin.bytes || hash(bytes) !== pin.sha256) throw Error('Pinned PS5 cheat bytes differ: ' + pin.titleId);
  const data = JSON.parse(bytes.toString('utf8'));
  if (!/^PPSA\d{5}$/.test(pin.titleId) || !/^\d{2}\.\d{3}\.\d{3}$/.test(pin.gameVersion) || data.version !== pin.gameVersion || data.process !== 'eboot.bin') throw Error('Native PPSA/version/process mismatch');
  const sourceId = typeof data.id === 'string' ? data.id.trim() : null;
  if (sourceId !== pin.titleId && !(sourceId === '' && typeof data.name === 'string' && data.name.startsWith(pin.titleId + '_'))) throw Error('PPSA identity missing from source JSON');
  if (typeof data.name !== 'string' || !Array.isArray(data.credits) || !data.credits.length || data.credits.some(credit => typeof credit !== 'string' || !credit.trim())) throw Error('Game name or creator credits missing');
  if (!Array.isArray(data.mods) || !data.mods.length) throw Error('Expected game-specific JSON mods');
  const hex = value => typeof value === 'string' && /^(?:[a-f0-9]{2})+$/i.test(value);
  for (const mod of data.mods) {
    if (!mod || typeof mod.name !== 'string' || !mod.name.trim() || mod.type !== 'checkbox' || !Array.isArray(mod.memory) || !mod.memory.length) throw Error('Invalid JSON cheat option');
    for (const memory of mod.memory) if (!memory || typeof memory.offset !== 'string' || !/^[a-f0-9]+$/i.test(memory.offset) || !hex(memory.on) || !hex(memory.off)) throw Error('Invalid JSON memory definition');
  }
  return {data, sourceIdBlank: sourceId === '', cheatCount: data.mods.length, memoryDefinitions: data.mods.reduce((sum, mod) => sum + mod.memory.length, 0)};
}

async function staged(filename, member, pin, download) {
  const target = contained(root, directory + filename);
  if (!fs.existsSync(target)) {
    if (!download) throw Error('Missing cached source bytes; use --download: ' + filename);
    const response = await fetch(raw(member), {signal: AbortSignal.timeout(30000)});
    if (!response.ok) throw Error(`HTTP ${response.status}: ${raw(member)}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== pin.bytes || hash(bytes) !== pin.sha256) throw Error('Pinned upstream source changed: ' + filename);
    writePreserving(target, bytes);
  }
  const bytes = fs.readFileSync(target);
  if (bytes.length !== pin.bytes || hash(bytes) !== pin.sha256) throw Error('Cached source differs from pin: ' + filename);
  return bytes;
}

async function prepare({download = false} = {}) {
  const licence = await staged(notices[0].filename, notices[0].member, notices[0], download);
  const instructions = await staged(notices[1].filename, notices[1].member, notices[1], download);
  const identityIndex = await staged(notices[2].filename, notices[2].member, notices[2], download);
  if (!/GNU GENERAL PUBLIC LICENSE[\s\S]*Version 3/.test(licence.toString()) || !instructions.toString().includes('/data/etaHEN/cheats/json/') || !instructions.toString().includes('{titleid}_{version}.{format}')) throw Error('Publisher licence or filename/storage instructions differ');
  const old = JSON.parse(fs.readFileSync(path.join(root, 'docs/host-current-cheat-actions.json'), 'utf8')).actions;
  const resources = [], jobs = [];
  for (const pin of selected) {
    if (old.some(item => item.titleIds?.includes(pin.titleId) && item.gameVersion === pin.gameVersion)) throw Error('Selection would duplicate an existing native host cheat');
    const filename = filenameFor(pin), member = 'json/' + filename;
    const bytes = await staged(filename, member, pin, download);
    const {data, sourceIdBlank, cheatCount, memoryDefinitions} = validateCheat(bytes, pin);
    if (!['PPSA10662', 'PPSA09911'].includes(pin.titleId) && !identityIndex.toString().includes(pin.titleId + '_')) throw Error('Expected independent publisher title-identity evidence missing');
    const id = 'ps5-native-cheats-' + pin.titleId.toLowerCase() + '-' + pin.gameVersion.replaceAll('.', '-');
    const page = '/console/ps5/game-cheats/' + pin.gameSlug + '/';
    const local = '/downloads/ps4-ps5/' + id + '/' + filename;
    const installationPath = '/data/etaHEN/cheats/json/' + filename;
    const preparation = `Native PS5 ${pin.game}, ${pin.titleId}, game version ${pin.gameVersion} only. Copy this unchanged file as ${filename} to /data/etaHEN/cheats/json/. Open the matching game, then etaHEN Toolbox (Debug Settings) → Cheats (WIP); highlight an option with Up/Down and toggle with X. Keep an existing file backed up: the publisher supports only one cheat format per title ID and game version. This JSON is cheat data, not a standalone payload.`;
    const validationNote = sourceIdBlank ? `The original JSON id field is blank. Its unmodified filename and name field both identify ${pin.titleId}; its version is ${pin.gameVersion}. The publisher documents filename-based title/version naming. No field was repaired or rewritten; compatibility was not tested on hardware.` : `The original JSON id field, filename and game version agree: ${pin.titleId} ${pin.gameVersion}. Static schema checks passed; compatibility was not tested on hardware.`;
    const provenance = {repository, commit, sourceRaw: raw(member), sourceFile: blob(member), identityEvidence: pin.identity, identityIndex: blob('shn.txt'), licence: blob('LICENSE'), instructions: blob('.github/README.md'), metadataValidation: validationNote, bytePreservation: 'Original raw JSON saved without reformatting or field changes', schemaValidation: 'PPSA binding, exact game version, eboot.bin process, named checkbox mods, hex memory offsets/on/off data and creator credits; never executed'};
    jobs.push({id, title: pin.game + ' · native PS5 JSON ' + pin.titleId + ' ' + pin.gameVersion, platform: 'PS5', category: ['Games', pin.game, 'Native PS5 Cheats'], project: 'etaHEN PS5 Cheats', version: pin.titleId + ' ' + pin.gameVersion + ' · ' + commit.slice(0, 12), filename, url: raw(member), importPath: directory + filename, expectedBytes: bytes.length, expectedSha256: hash(bytes), kind: 'generated', archiveRole: ['Builds'], mirror: true, pages: [page.slice(1) + 'index.html', 'console/ps5/game-cheats.html', 'console/ps5/downloads.html'], provenance});
    resources.push({id, importJobId: id, name: pin.game + ' · native PS5 ' + pin.gameVersion, title: pin.game + ' · native PS5 JSON cheats', game: pin.game, gameSlug: pin.gameSlug, titleId: pin.titleId, titleIds: [pin.titleId], gameVersion: pin.gameVersion, version: pin.gameVersion, platforms: ['ps5'], category: 'mods', gamePlatform: 'native-ps5', format: 'JSON', filename, bytes: bytes.length, sha256: hash(bytes), url: local, source: blob(member), sourceURL: raw(member), sourceCommit: commit, page, pages: {ps5: page}, image: '/assets/images/consoles/ps5-featured-image.avif', imageKind: 'platform-artwork', imageAlt: 'PS5 console artwork; no game-specific cover is supplied', description: `Unmodified etaHEN-repository cheat definitions by ${data.credits.join(', ')}: ${data.mods.map(mod => mod.name).join('; ')}.`, compatibility: `Native PS5 ${pin.game}; ${pin.titleId}, exact game version ${pin.gameVersion}, process eboot.bin. This file does not apply to a PS4 edition or another PPSA/update. No console firmware range is certified by the cheat file.`, preparation, installationPath, cheats: data.mods.map(mod => mod.name), cheatCount, memoryDefinitions, credits: data.credits, sourceName: data.name, sourceId: data.id, sourceIdBlank, metadataValidation: validationNote, licence: 'GPL-3.0 (repository LICENSE); original credits and bytes retained', licenceURL: blob('LICENSE'), licenceDownload: '/downloads/ps4-ps5/' + notices[0].id + '/' + notices[0].filename, instructionsURL: blob('.github/README.md'), stagedPath: directory + filename, provenance});
  }
  for (const notice of notices) jobs.push({id: notice.id, title: notice.title, platform: 'PS5', category: ['Games', 'Native PS5 Cheats', 'Database notices'], project: 'etaHEN PS5 Cheats', version: commit, filename: notice.filename, url: raw(notice.member), importPath: directory + notice.filename, expectedBytes: notice.bytes, expectedSha256: notice.sha256, kind: 'generated', archiveRole: ['Metadata'], mirror: true, pages: ['console/ps5/game-cheats.html'], provenance: {repository, commit, sourceFile: blob(notice.member), method: 'Unmodified publisher metadata; no cheat data executed'}});
  const output = {schemaVersion: 1, reviewed: '2026-11-02', sourceScope: 'Independent primary etaHEN PS5_Cheats expansion; not sourced from the VirusMike Google Site', repository, commit, licence: 'GPL-3.0 (repository LICENSE)', status: 'Six ready JSON files staged and statically checked; public import and F: archival are handled by the root importer', existingNativeHostResourcesPreserved: old.map(item => ({id: item.id, sha256: item.sha256, titleIds: item.titleIds, gameVersion: item.gameVersion})), resources, notices: notices.map(item => ({id: item.id, filename: item.filename, bytes: item.bytes, sha256: item.sha256, source: blob(item.member)})), limits: ['Five original JSON id fields are blank; filename/name PPSA and exact version are preserved and disclosed without silent repair.', 'Game identity in the SHN index is used only as name evidence, never to apply a different SHN game version to a JSON file.', 'All six files are native PPSA definitions, distinct from PS4 CUSA backward-compatibility patches.', 'The repository credits the original cheat creators. etaHEN provides format/toolbox support; it does not claim authorship of every cheat.', 'No firmware compatibility, successful hardware execution or stable gameplay result is inferred from static checks.', 'No payload, cheat or commercial game executable was run; no shared host source, catalogue, helper or inventory was changed.']};
  fs.writeFileSync(path.join(root, 'docs/ps5-native-extra-cheats.json'), JSON.stringify(output, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'docs/ps5-native-extra-cheats-jobs.json'), JSON.stringify({schemaVersion: 1, reviewed: output.reviewed, repository, commit, jobs}, null, 2) + '\n');
  console.log(JSON.stringify({games: resources.length, readyJSONFiles: resources.length, cheatOptions: resources.reduce((sum, item) => sum + item.cheatCount, 0), readyBytes: resources.reduce((sum, item) => sum + item.bytes, 0), metadataJobs: notices.length, jobs: jobs.length, sourceIdBlank: resources.filter(item => item.sourceIdBlank).length, commit}, null, 2));
  return {output, jobs};
}

module.exports = {prepare, validateCheat, selected, commit};
if (require.main === module) prepare({download: process.argv.includes('--download')}).catch(error => { console.error(error.message); process.exitCode = 1; });
