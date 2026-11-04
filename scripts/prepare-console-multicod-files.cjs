// Extract only the eight pinned Matrix PS4 ELF members. Never execute them.
// Shared inventories, public mirrors and F: archiving belong to the importer.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {inspectArchive} = require('./audit-console-ready-files.cjs');
const {writePreserving, contained} = require('./prepare-console-ready-files.cjs');
const root = path.resolve(__dirname, '..');
const sevenZip = process.env.WHATSITE_SEVEN_ZIP || 'C:/Program Files/7-Zip/7z.exe';
const archive = '/downloads/ps4/BO3/both/MatrixMenusPS4.rar';
const archiveSha256 = '2d26c503208168dbf9bb83db9344f20519680d835038853461d191962dab4bd5';
const expected = {
  'BO3_100.elf': {game: 'black-ops-3', update: '1.00', bytes: 51072},
  'BO3_126.elf': {game: 'black-ops-3', update: '1.26', bytes: 55520},
  'Ghosts_100.elf': {game: 'ghosts', update: '1.00', bytes: 2162800},
  'Ghosts_120.elf': {game: 'ghosts', update: '1.20', bytes: 2162560},
  'AW_100.elf': {game: 'advanced-warfare', update: '1.00', bytes: 2162408},
  'AW_123.elf': {game: 'advanced-warfare', update: '1.23', bytes: 2162664},
  'MWR_102.elf': {game: 'modern-warfare-remastered', update: '1.02', bytes: 2161456},
  'MWR_113.elf': {game: 'modern-warfare-remastered', update: '1.13', bytes: 2161336}
};
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

function inspectElf(bytes) {
  const fail = reason => { throw Error('Invalid Matrix ELF structure: ' + reason); };
  if (!Buffer.isBuffer(bytes) || bytes.length < 64) fail('truncated header');
  if (bytes.subarray(0, 4).toString('hex') !== '7f454c46' || bytes[4] !== 2 || bytes[5] !== 1 || bytes[6] !== 1) fail('expected little-endian ELF64 version 1');
  if (bytes.readUInt16LE(16) !== 3 || bytes.readUInt16LE(18) !== 62 || bytes.readUInt32LE(20) !== 1 || bytes.readUInt16LE(52) !== 64) fail('expected x86-64 ET_DYN header');
  const integer = (offset, label) => {
    const value = bytes.readBigUInt64LE(offset);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail(label + ' exceeds safe bounds');
    return Number(value);
  };
  const bounds = (offset, size, label) => {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < 0 || size < 0 || offset > bytes.length || size > bytes.length - offset) fail(label + ' exceeds file bounds');
  };
  const phoff = integer(32, 'program table'), shoff = integer(40, 'section table');
  const phsize = bytes.readUInt16LE(54), phnum = bytes.readUInt16LE(56), shsize = bytes.readUInt16LE(58), shnum = bytes.readUInt16LE(60);
  if (phsize !== 56 || !phnum || shsize !== 64 || !shnum || bytes.readUInt16LE(62) >= shnum) fail('unsupported table layout');
  bounds(phoff, phsize * phnum, 'program table');
  bounds(shoff, shsize * shnum, 'section table');
  for (let index = 0; index < phnum; index++) {
    const offset = phoff + index * phsize;
    bounds(integer(offset + 8, 'segment offset'), integer(offset + 32, 'segment size'), 'segment');
  }
  for (let index = 0; index < shnum; index++) {
    const offset = shoff + index * shsize;
    // SHT_NOBITS has a memory size but no corresponding bytes in the file.
    if (bytes.readUInt32LE(offset + 4) !== 8) bounds(integer(offset + 24, 'section offset'), integer(offset + 32, 'section size'), 'section');
  }
  return {format: 'ELF64', endianness: 'little', machine: 'x86-64', type: 'ET_DYN', elfVersion: 1, programHeaderCount: phnum, sectionHeaderCount: shnum, entryPoint: '0x' + bytes.readBigUInt64LE(24).toString(16), verification: 'Static ELF header and program/section file-range checks; not a runtime or hardware test'};
}

function prepare() {
  const multi = require('./console-multicod.cjs').load();
  const family = multi.data.families.find(item => item.id === 'matrix-menus-ps4');
  if (family.archiveSha256 !== archiveSha256) throw Error('Matrix source mapping checksum changed');
  const archivePath = contained(root, archive.slice(1));
  const archiveBytes = fs.readFileSync(archivePath);
  if (sha(archiveBytes) !== archiveSha256) throw Error('Pinned Matrix source archive changed');
  const legacyManifest = json('downloads/ps4/BO3/manifest.json').files.find(file => file.local === archive);
  if (!legacyManifest || legacyManifest.sha256 !== archiveSha256 || legacyManifest.bytes !== archiveBytes.length) throw Error('Matrix source differs from the preserved BO3 manifest');
  const inspection = inspectArchive(archivePath, {readDocumentation: false});
  if (inspection.fileCount !== 8 || inspection.consoleFiles.length !== 8) throw Error('Matrix pinned archive member set changed');
  const audited = json('docs/console-archive-readiness-audit.json').archives.filter(item => /^ps4-ps5-(?:ghosts|aw|mwr)-matrixmods$/.test(item.id));
  if (audited.length !== 3 || audited.some(item => item.originalSha256 !== archiveSha256 || item.status !== 'inspected')) throw Error('Matrix per-game archive evidence changed');
  const currentCatalogueMatches = json('docs/console-download-catalog.json').items.filter(item => item.filename === 'MatrixMenusPS4.rar').map(item => {
    if (item.sha256 !== archiveSha256) throw Error('Matrix current catalogue checksum differs');
    return item.id;
  });
  const resources = [], jobs = [];
  for (const [filename, pin] of Object.entries(expected)) {
    const archiveEntry = 'Matrix_Menus/' + filename;
    const mapping = family.games.find(item => item.gameId === pin.game);
    const game = multi.games.get(pin.game);
    const item = mapping?.legacy ? multi.legacy.find(item => 'bo3-' + item.id === mapping.resourceId) : multi.resources.get(mapping?.resourceId);
    const sourceMember = inspection.entries.find(item => item.path === archiveEntry);
    if (!mapping || mapping.updates[mapping.archiveFiles.indexOf(archiveEntry)] !== pin.update || !item.compatibilityText.includes(pin.update)) throw Error('Matrix game/update source evidence differs: ' + filename);
    if (!sourceMember || sourceMember.directory || sourceMember.encrypted || sourceMember.bytes !== pin.bytes) throw Error('Matrix source member differs: ' + filename);
    const supportPackSource = item.downloads[0].url;
    const supportPack = mapping.legacy ? archive : audited.find(item => item.id === 'ps4-ps5-' + mapping.resourceId).local;
    if (sha(fs.readFileSync(contained(root, supportPack.slice(1)))) !== archiveSha256) throw Error('Matrix per-game archive copy changed');
    const bytes = execFileSync(sevenZip, ['e', '-so', '-spd', archivePath, archiveEntry], {maxBuffer: 4 * 1024 * 1024});
    if (bytes.length !== pin.bytes) throw Error('Matrix extracted size differs: ' + filename);
    const elf = inspectElf(bytes), hash = sha(bytes);
    const id = 'matrix-ps4-' + filename.replace(/\.elf$/, '').toLowerCase().replace('_', '-');
    const importPath = 'docs/tmp/console-multicod-ready-files/' + archiveSha256.slice(0, 12) + '/' + filename;
    writePreserving(contained(root, importPath), bytes);
    const local = '/downloads/ps4-ps5/' + id + '/' + filename;
    const page = '/console/mods/ps4/call-of-duty/' + game.slug + '/#resource-' + mapping.resourceId;
    const preparation = `Extracted ELF for PS4 ${game.title.replace(/^Call of Duty: /, '')} game update ${pin.update} only. Save it for a compatible PS4 payload loader. This archive does not identify that loader, its port, console firmware, title-ID range or controls; confirm those requirements from the game-specific source before loading. Saving this file does not launch it. Keep the original MatrixMenusPS4.rar.`;
    const provenance = {sourceArchive: archive, sourceArchiveSha256: archiveSha256, sourceArchiveBytes: archiveBytes.length, archiveEntry, sourcePost: mapping.source, sourceAttachment: supportPackSource, sourceRecord: mapping.legacy ? 'docs/ps4-bo3-resources.json#matrix' : 'docs/ps4-ps5-cod-resources.json#' + mapping.resourceId, archiveEvidence: 'docs/console-archive-readiness-audit.json', method: 'Exact 7-Zip member bytes extracted to private staging; no downloaded file was executed', documentation: 'No README, license, installation or control instructions were present in the inspected archive', elf};
    jobs.push({id, title: 'MatrixMods · ' + game.title.replace(/^Call of Duty: /, '') + ' · PS4 game ' + pin.update + ' ELF', platform: 'PS4', category: ['Games', 'Call of Duty', game.title.replace(/^Call of Duty: /, ''), 'Menus', 'Ready ELF files'], project: 'MatrixMods', version: 'Unversioned-Game' + pin.update, kind: 'generated', archiveRole: ['Builds'], url: supportPackSource, importPath, filename, expectedBytes: bytes.length, expectedSha256: hash, pages: [page.slice(1).split('#')[0] + 'index.html', 'console/mods/ps4/call-of-duty/multicod/index.html', 'console/ps4/downloads.html'], mirror: true, provenance});
    resources.push({id, importJobId: id, name: 'MatrixMods · ' + game.title.replace(/^Call of Duty: /, '') + ' ' + pin.update + ' ELF', platforms: ['ps4'], platform: 'ps4', gameId: pin.game, gameUpdate: pin.update, category: 'mods', version: 'Game update ' + pin.update + ' · menu version not stated', filename, format: 'ELF', url: local, source: mapping.source, supportPack, supportPackSource, page, pages: {ps4: page}, image: item.images?.[0]?.display || item.images?.[0]?.original || game.cover, compatibility: `PS4 ${game.title.replace(/^Call of Duty: /, '')} game update ${pin.update} only, from the source post and matching archive member. Console firmware, CUSA range and native PS5 support are not established.`, description: 'Direct byte-identical console ELF extracted from the preserved Matrix archive; select the exact game update. Header validation does not establish runtime compatibility.', preparation, bytes: bytes.length, expectedBytes: bytes.length, sha256: hash, expectedSha256: hash, stagedPath: importPath, sourceArchiveMember: archiveEntry, sourceArchiveSha256: archiveSha256, provenance});
  }
  const result = {schemaVersion: 1, reviewed: '2026-11-02', status: 'Prepared in private staging; root importer archives and mirrors before publication', sourceArchive: {local: archive, filename: family.archiveFilename, bytes: archiveBytes.length, sha256: archiveSha256, currentCatalogueMatches, currentCatalogueNote: currentCatalogueMatches.length ? 'Existing public catalogue archive checksum verified' : 'Original Matrix RAR is absent from the current public download catalogue; the preserved per-game source records, BO3 manifest, inspected archive audit and actual bytes were verified instead'}, resources};
  fs.writeFileSync(path.join(root, 'docs/console-multicod-ready-files.json'), JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'docs/console-multicod-ready-file-jobs.json'), JSON.stringify({schemaVersion: 1, reviewed: result.reviewed, jobs}, null, 2) + '\n');
  console.log(JSON.stringify({resources: resources.length, bytes: resources.reduce((sum, item) => sum + item.bytes, 0), outputs: ['docs/console-multicod-ready-files.json', 'docs/console-multicod-ready-file-jobs.json']}, null, 2));
  return {result, jobs};
}

module.exports = {prepare, inspectElf, expected};
if (require.main === module) prepare();
