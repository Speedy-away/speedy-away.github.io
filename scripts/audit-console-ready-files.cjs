// Read archive directories and small documentation only. Never run archived files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const sevenZip = process.env.WHATSITE_SEVEN_ZIP || 'C:/Program Files/7-Zip/7z.exe';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function safeArchivePath(name) {
  return typeof name === 'string' && name.length > 0 && !/^[\\/]|:|(?:^|[\\/])\.\.(?:[\\/]|$)/.test(name);
}
function inspectArchive(archive, {readDocumentation = true} = {}) {
  const listing = execFileSync(sevenZip, ['l', '-slt', archive], {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
  const payload = listing.split('----------').slice(1).join('----------');
  if (!payload) throw Error('Archive directory unavailable');
  const entries = payload.split(/\r?\n\r?\n/).map(block => {
    const name = block.match(/^Path = (.+)$/m)?.[1];
    if (!name) return null;
    const link = /^(?:Symbolic|Hard|Copy) Link = .+/m.test(block);
    if (!safeArchivePath(name) || link) throw Error('Unsafe archive path or link: ' + name);
    return {path: name.replaceAll('\\', '/'), directory: /^Folder = \+$/m.test(block), bytes: Number(block.match(/^Size = (\d+)$/m)?.[1] || 0), encrypted: /^Encrypted = \+$/m.test(block)};
  }).filter(Boolean);
  const files = entries.filter(entry => !entry.directory);
  const docs = files.filter(entry => /(?:^|\/)(?:licen[cs]e[^/]*|copying[^/]*|readme[^/]*|install[^/]*)$/i.test(entry.path) && entry.bytes <= (/licen[cs]e|copying/i.test(entry.path) ? 131072 : 16384) && !entry.encrypted)
    .sort((a, b) => Number(/licen[cs]e|copying/i.test(b.path)) - Number(/licen[cs]e|copying/i.test(a.path)));
  const documentation = [];
  if (readDocumentation) for (const entry of docs.slice(0, 12)) {
    const bytes = execFileSync(sevenZip, ['e', '-so', '-spd', archive, entry.path], {maxBuffer: 262144});
    documentation.push({path: entry.path, bytes: bytes.length, sha256: sha256(bytes), text: bytes.toString('utf8')});
  }
  const formats = {};
  for (const entry of files) {
    const extension = path.extname(entry.path).slice(1).toLowerCase() || '(none)';
    formats[extension] = (formats[extension] || 0) + 1;
  }
  const consoleFiles = files.filter(entry => /\.(?:bin|elf|prx|sprx|pkg|gsc|gscc|csc|cfg|shn|mc4)$/i.test(entry.path));
  return {fileCount: files.length, directoryCount: entries.length - files.length, formats, consoleFiles, documentation, entries};
}
function audit() {
  const inventory = JSON.parse(fs.readFileSync(path.join(root, 'docs/download-audit.json'), 'utf8')).items;
  const archives = [];
  const seen = new Set();
  for (const item of inventory) {
    if (item.status !== 'downloaded' || !/(?:PS4|PS5|console\/ps4|console\/ps5|console\/mods\/ps4)/i.test(JSON.stringify([item.platform, item.pages, item.category, item.title]))) continue;
    for (const file of item.files || []) {
      if (!/\.(?:zip|rar|7z)$/i.test(file.local || '') || seen.has(file.local)) continue;
      seen.add(file.local);
      const record = {id: item.id, title: item.title, source: item.url, local: file.local, originalSha256: file.sha256};
      try {
        const absolute = path.join(root, file.local.replace(/^\//, ''));
        const actualHash = sha256(fs.readFileSync(absolute));
        if (actualHash !== file.sha256) throw Error('File differs from recorded checksum');
        Object.assign(record, {status: 'inspected'}, inspectArchive(absolute));
        const allDocs = record.documentation.map(entry => entry.text).join('\n');
        record.license = /MIT License|Permission is hereby granted, free of charge/.test(allDocs) ? 'Embedded permissive notice; review scope' : /GNU GENERAL PUBLIC LICENSE|GNU LESSER GENERAL PUBLIC LICENSE/.test(allDocs) ? 'Embedded GPL/LGPL notice; review scope' : 'Redistribution rights not established by inspected documentation';
        record.readiness = /source/i.test(item.kind || '') || /source code|source-/.test(item.title || '') ? 'source-archive' : /\b(?:exe|dll|msi)\b/.test(Object.keys(record.formats).join(' ')) ? 'contains-desktop-helper' : record.consoleFiles.length ? 'contains-console-files; check dependencies and exact compatibility' : 'data-or-support-archive';
      } catch (error) { Object.assign(record, {status: 'inspection-failed', reason: error.message}); }
      archives.push(record);
    }
  }
  // Preserve the original GTA V set, which predates the shared audit inventory.
  const legacy = JSON.parse(fs.readFileSync(path.join(root, 'downloads/ps4/GTA5/manifest.json'), 'utf8')).files;
  for (const file of legacy.filter(file => /\.(?:zip|rar|7z)$/i.test(file.local || '') && !seen.has(file.local))) {
    const absolute = path.join(root, file.local.replace(/^\//, ''));
    const record = {id: 'legacy-gta5-' + file.group + '-' + file.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title: file.name, source: file.source, local: file.local, originalSha256: sha256(fs.readFileSync(absolute)), status: 'inspected', ...inspectArchive(absolute)};
    const allDocs = record.documentation.map(entry => entry.text).join('\n');
    record.license = /MIT License|Permission is hereby granted, free of charge/.test(allDocs) ? 'Embedded permissive notice; review scope' : 'Redistribution rights not established by inspected documentation';
    record.readiness = record.consoleFiles.length ? 'contains-console-files; check dependencies and exact compatibility' : 'data-or-support-archive';
    archives.push(record);
  }
  // Include reviewed staged bundles that are deliberately too large to mirror.
  // Do not duplicate an already inspected identical public archive.
  for (const jobsFile of ['docs/console-ready-software-jobs.json', 'docs/ps4-ps5-game-patch-jobs.json']) {
    const absoluteJobs = path.join(root, jobsFile);
    if (!fs.existsSync(absoluteJobs)) continue;
    for (const job of JSON.parse(fs.readFileSync(absoluteJobs, 'utf8')).jobs || []) {
      if (!/\.(?:zip|rar|7z)$/i.test(job.filename || '') || !job.importPath || archives.some(item => item.originalSha256 === job.expectedSha256)) continue;
      const absolute = path.resolve(root, job.importPath);
      if (!absolute.startsWith(root + path.sep) || !fs.existsSync(absolute)) continue;
      const actualHash = sha256(fs.readFileSync(absolute));
      if (actualHash !== job.expectedSha256) throw Error('Staged archive differs from expected publisher hash: ' + job.id);
      const record = {id: job.id, title: job.title, source: job.url, local: '/' + path.relative(root, absolute).replaceAll('\\', '/'), originalSha256: actualHash, status: 'inspected', stagingOnly: true, sourceJobs: jobsFile, ...inspectArchive(absolute)};
      record.license = 'See pinned publisher app/project documentation and preserved bundled notices';
      record.readiness = record.consoleFiles.length ? 'contains-console-files; complete bundle and app-specific dependencies required' : 'data-or-support-archive';
      archives.push(record);
    }
  }
  const result = {schemaVersion: 1, reviewed: '2026-11-02', method: '7-Zip directory listing and small license/readme text extraction; no archived executable was run.', archives};
  fs.writeFileSync(path.join(root, 'docs/console-archive-readiness-audit.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({archives: archives.length, failed: archives.filter(item => item.status !== 'inspected').map(item => ({id: item.id, reason: item.reason})), permissiveCandidates: archives.filter(item => item.license.startsWith('Embedded')).map(item => ({id: item.id, files: item.fileCount, consoleFiles: item.consoleFiles.length, license: item.license})), output: 'docs/console-archive-readiness-audit.json'}, null, 2));
  return result;
}
module.exports = {safeArchivePath, inspectArchive, audit};
if (require.main === module) audit();
