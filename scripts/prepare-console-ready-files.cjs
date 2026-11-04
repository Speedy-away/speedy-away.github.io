// Extract pinned, licensed mod bytes and prepare explicit import jobs.
// This script never executes a downloaded binary or writes shared inventories.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {inspectArchive, safeArchivePath} = require('./audit-console-ready-files.cjs');
const root = path.resolve(__dirname, '..');
const sevenZip = process.env.WHATSITE_SEVEN_ZIP || 'C:/Program Files/7-Zip/7z.exe';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function writePreserving(target, bytes) {
  if (fs.existsSync(target)) {
    if (digest(fs.readFileSync(target)) !== digest(bytes)) throw Error('Refusing to overwrite a different extracted file: ' + target);
    return;
  }
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, bytes, {flag: 'wx'});
}
function contained(base, relative) {
  const target = path.resolve(base, relative);
  const difference = path.relative(path.resolve(base), target);
  if (difference.startsWith('..') || path.isAbsolute(difference)) throw Error('Extracted target escapes its output directory');
  return target;
}
function prepare() {
  const plan = JSON.parse(fs.readFileSync(path.join(root, 'docs/new-console-ready-files.json'), 'utf8'));
  const jobs = [], entries = [], packs = [];
  for (const pack of plan.packs) {
    const archive = contained(root, pack.archive.replace(/^\//, ''));
    if (digest(fs.readFileSync(archive)) !== pack.archiveSha256) throw Error('Pinned source archive changed: ' + pack.id);
    const listing = inspectArchive(archive);
    const license = listing.documentation.find(file => file.path === pack.licensePath)?.text;
    if (!license?.includes('Permission is hereby granted, free of charge') || !license.includes('The above copyright notice')) throw Error('Expected permissive license unavailable: ' + pack.id);
    const selected = pack.selection === 'all' ? listing.entries.filter(file => !file.directory) : pack.selection.map(name => listing.entries.find(file => file.path === name));
    if (selected.some(file => !file)) throw Error('Selected file missing from pinned archive');
    const extracted = [];
    for (const file of selected) {
      if (!safeArchivePath(file.path) || file.encrypted || /\.(?:exe|dll|bat|cmd|ps1|msi|py)$/i.test(file.path)) throw Error('Unsupported direct console file: ' + file.path);
      const prefix = pack.id === 'expulsion-v7-ready' ? 'Expulsion V7.0/' : '';
      const relative = file.path.slice(prefix.length);
      const local = '/downloads/console-ready/' + pack.id + '/' + relative;
      const target = contained(root, local.slice(1));
      const bytes = execFileSync(sevenZip, ['e', '-so', '-spd', archive, file.path], {maxBuffer: 8 * 1024 * 1024});
      if (bytes.length !== file.bytes) throw Error('Extracted size mismatch: ' + file.path);
      if (/\.prx$/i.test(file.path) && !['7f454c46', '4f153d1d'].includes(bytes.subarray(0, 4).toString('hex'))) throw Error('Expected ELF or PS4 SELF-wrapped PRX header missing');
      writePreserving(target, bytes);
      const isBinary = file.path === pack.binary;
      const isScript = /\.lua$/i.test(file.path);
      const id = pack.id + '-' + digest(Buffer.from(file.path)).slice(0, 12);
      const sha256 = digest(bytes);
      const job = {id, title: pack.title + ' · ' + relative, platform: 'PS4', category: ['Games', 'GTA5', '157', 'Ready files', ...path.posix.dirname(relative).split('/').filter(part => part !== '.')], project: 'Expulsion', version: pack.version, kind: 'generated', archiveRole: [isBinary || isScript || /^data\/|^PS4\//.test(relative) ? 'Builds' : 'Metadata'], url: pack.source, importPath: local.slice(1), filename: path.posix.basename(relative), expectedBytes: bytes.length, expectedSha256: sha256, pages: [pack.page.slice(1), 'console/ps4/downloads.html'], provenance: {sourceArchive: pack.archive, sourceArchiveSha256: pack.archiveSha256, archiveEntry: file.path, license: pack.license, method: 'Exact 7-Zip byte extraction; no binary was run'}, mirror: true};
      jobs.push(job);
      const consoleDestination = relative.startsWith('PS4/') ? '/' + relative.slice(4) : /^(?:data|user)\//.test(relative) ? '/' + relative : null;
      extracted.push({id, filename: job.filename, archiveEntry: file.path, local, bytes: bytes.length, sha256, consoleDestination, kind: isBinary ? 'plugin-binary' : isScript ? 'console-script' : 'support-or-documentation'});
      if (isBinary || isScript) entries.push({id, name: isBinary ? pack.title.replace(/ · .*/, '') + ' · PRX replacement binary' : pack.title.replace(/ · .*/, '') + ' · ' + job.filename, platform: 'ps4', category: 'mods', version: pack.version, filename: job.filename, url: local, source: pack.source, page: pack.page, image: '/assets/images/ps4-gta5/expulsion.png', compatibility: pack.compatibility, description: isBinary ? 'Direct extracted PRX for an existing matching installation. Install the matching support files and keep the license notice; this file alone is not a complete mod installation.' : 'Lua script for the matching Expulsion V7.0 API, enabled manually from the menu. Keep its README, API guide and Lua license.', format: isBinary ? 'PRX' : 'Lua', requiresSupportArchive: pack.supportArchive, replacementOnly: isBinary, installation: pack.installation, importJobId: id, consoleDestination});
    }
    packs.push({id: pack.id, title: pack.title, regularFilesInOriginal: listing.fileCount, extracted, requiredSupportArchive: pack.supportArchive, licenseLocal: extracted.find(file => file.archiveEntry === pack.licensePath)?.local, installation: pack.installation});
  }
  const official = plan.officialDirectBins;
  const goldhenArchive = contained(root, official.archive.replace(/^\//, ''));
  if (digest(fs.readFileSync(goldhenArchive)) !== official.archiveSha256) throw Error('Pinned GoldHEN archive changed');
  for (const file of official.files) {
    const bytes = execFileSync(sevenZip, ['e', '-so', '-spd', goldhenArchive, file.filename], {maxBuffer: 1048576});
    if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw Error('GoldHEN BIN mismatch: ' + file.filename);
    const id = 'goldhen-2-3-' + file.firmware.replace('.', '-');
    const url = 'https://raw.githubusercontent.com/GoldHEN/GoldHEN/' + official.sourceCommit + '/' + file.filename;
    const local = '/downloads/console-ready/goldhen-2.3/' + file.filename;
    writePreserving(contained(root, local.slice(1)), bytes);
    jobs.push({id, title: 'GoldHEN 2.3 · PS4 ' + file.firmware + ' BIN', platform: 'PS4', category: ['Payloads', 'GoldHEN'], project: 'GoldHEN', version: '2.3-FW' + file.firmware, kind: 'generated', archiveRole: ['Builds'], url, importPath: local.slice(1), filename: file.filename, expectedBytes: file.bytes, expectedSha256: file.sha256, pages: ['console/ps4/goldhen.html', 'console/ps4/payloads.html', 'console/ps4/downloads.html'], mirror: false, provenance: {sourceArchive: official.archive, sourceArchiveSha256: official.archiveSha256, archiveEntry: file.filename, officialCommit: official.sourceCommit, method: 'Exact bytes extracted from archived official release; verified against official direct URL on 2026-11-02', publicDistribution: 'Use official upstream direct URL; broad redistribution license not established'}});
    const artwork = JSON.parse(fs.readFileSync(path.join(root, 'docs/console-software-images.json'), 'utf8')).goldhen.image;
    entries.push({id, name: 'GoldHEN 2.3 · firmware ' + file.firmware, platform: 'ps4', category: 'payloads', version: '2.3', firmware: file.firmware, filename: file.filename, url, source: official.release, page: '/console/ps4/goldhen.html', image: artwork, format: 'BIN', compatibility: 'PS4 firmware ' + file.firmware + ' only, loaded through an exploit compatible with this GoldHEN build. It does not establish support for another firmware or PS5.', description: 'Direct official firmware-specific BIN, byte-identical to the existing pinned GoldHEN 2.3 archive. Save and payload loading are separate actions.', importJobId: id, localExtractedCopy: local, publicMirror: false});
  }
  fs.writeFileSync(path.join(root, 'docs/new-console-ready-file-jobs.json'), JSON.stringify({reviewed: plan.reviewed, jobs}, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'docs/console-ready-file-descriptors.json'), JSON.stringify({reviewed: plan.reviewed, packs, entries}, null, 2) + '\n');
  console.log(JSON.stringify({packs: packs.map(pack => ({id: pack.id, originalFiles: pack.regularFilesInOriginal, extractedFiles: pack.extracted.length})), directEntries: entries.length, importJobs: jobs.length, outputs: ['docs/new-console-ready-file-jobs.json', 'docs/console-ready-file-descriptors.json']}, null, 2));
  return {jobs, packs, entries};
}
module.exports = {prepare, writePreserving, contained};
if (require.main === module) prepare();
