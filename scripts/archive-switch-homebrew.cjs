// Archive selected, documented Switch builds. Inspect files; never execute a build.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const {spawnSync} = require('node:child_process');
const {destinationForFile, safeName} = require('./download-archive-layout.cjs');

const root = path.resolve(__dirname, '..');
const backup = path.resolve('F:/whatsite-backup-downloads-etc');
const cataloguePath = path.join(root, 'docs/switch-homebrew-catalog.json');
const manifestPath = path.join(root, 'docs/switch-homebrew-downloads.json');
const auditPath = path.join(root, 'docs/download-audit.json');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const json = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : fallback;
const unique = values => [...new Set(values.filter(Boolean))];
const allowedHosts = new Set(['switch.cdn.fortheusers.org', 'github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com', 'github-releases.githubusercontent.com']);
const mirrorRoot = path.join(root, 'downloads/nintendo-switch');
const mirrorBudgetBytes = 384 * 1024 * 1024;
const maximumPublicFileBytes = 95 * 1024 * 1024;
function treeBytes(directory) {
  if (!fs.existsSync(directory)) return 0;
  return fs.readdirSync(directory, {withFileTypes: true}).reduce((total, entry) => total + (entry.isDirectory() ? treeBytes(path.join(directory, entry.name)) : fs.statSync(path.join(directory, entry.name)).size), 0);
}

function contained(base, file) {
  const absolute = path.resolve(file), relative = path.relative(path.resolve(base), absolute);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw Error('Path escapes intended directory: ' + file);
  let ancestor = absolute;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  if (fs.existsSync(base)) {
    const realRelative = path.relative(fs.realpathSync(base), fs.realpathSync(ancestor));
    if (realRelative === '..' || realRelative.startsWith('..' + path.sep) || path.isAbsolute(realRelative)) throw Error('Path resolves outside intended directory: ' + file);
  }
  return absolute;
}

function preserveWrite(base, file, bytes) {
  let target = contained(base, file);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  if (fs.existsSync(target)) {
    if (hash(fs.readFileSync(target)) === hash(bytes)) return target;
    const ext = path.extname(target);
    target = contained(base, target.slice(0, -ext.length || undefined) + '-' + hash(bytes).slice(0, 16) + ext);
    if (fs.existsSync(target)) {
      if (hash(fs.readFileSync(target)) === hash(bytes)) return target;
      throw Error('Refusing to replace a different file: ' + target);
    }
  }
  fs.writeFileSync(target, bytes, {flag: 'wx'});
  return target;
}

function atomicWrite(base, file, data) {
  contained(base, file);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const temporary = contained(base, file + '.switch-' + crypto.randomBytes(6).toString('hex') + '.tmp');
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
  fs.renameSync(temporary, file);
}

function safeMember(name) {
  if (!name || name.includes('\\') || name.includes('\0') || name.startsWith('/') || name.includes(':')) return false;
  return name.split('/').every(part => part !== '..' && part !== '.' && !/[<>"|?*\x00-\x1f]/.test(part));
}

const crcTable = Array.from({length: 256}, (_, value) => {
  for (let n = 0; n < 8; n++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ value >>> 8;
  return (value ^ 0xffffffff) >>> 0;
}

// Read only regular ZIP entries, with bounded decompression and CRC validation.
function inspectZip(bytes, maxExpandedBytes = 512 * 1024 * 1024) {
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) { end = offset; break; }
  }
  if (end < 0) throw Error('ZIP end-of-directory record is missing');
  const count = bytes.readUInt16LE(end + 10), directoryBytes = bytes.readUInt32LE(end + 12), directoryOffset = bytes.readUInt32LE(end + 16);
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || count !== bytes.readUInt16LE(end + 8) || count === 65535 || directoryOffset === 0xffffffff || directoryOffset + directoryBytes !== end) throw Error('Unsupported split or ZIP64 archive');
  if (!count || count > 20000) throw Error('Unexpected ZIP member count');
  const entries = [], names = new Set(); let cursor = directoryOffset, expanded = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50) throw Error('Invalid ZIP central directory');
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10), crc = bytes.readUInt32LE(cursor + 16), packed = bytes.readUInt32LE(cursor + 20), size = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32), external = bytes.readUInt32LE(cursor + 38), offset = bytes.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > end) throw Error('ZIP directory extends beyond its bounds');
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (!safeMember(name) || names.has(name.toLowerCase())) throw Error('Unsafe or duplicate ZIP member: ' + name);
    if (flags & 1 || ![0, 8].includes(method) || (external >>> 16 & 0xf000) === 0xa000) throw Error('Encrypted, linked or unsupported ZIP member: ' + name);
    names.add(name.toLowerCase()); expanded += size;
    if (expanded > maxExpandedBytes || size > maxExpandedBytes) throw Error('ZIP expanded-size limit exceeded');
    if (offset + 30 > directoryOffset || bytes.readUInt32LE(offset) !== 0x04034b50) throw Error('Invalid ZIP local member header');
    const localFlags = bytes.readUInt16LE(offset + 6), localMethod = bytes.readUInt16LE(offset + 8), localNameLength = bytes.readUInt16LE(offset + 26), localExtraLength = bytes.readUInt16LE(offset + 28);
    const dataOffset = offset + 30 + localNameLength + localExtraLength;
    if (localFlags !== flags || localMethod !== method || bytes.subarray(offset + 30, offset + 30 + localNameLength).toString('utf8') !== name || dataOffset + packed > directoryOffset) throw Error('ZIP local header does not match directory');
    const compressed = bytes.subarray(dataOffset, dataOffset + packed);
    const data = method === 0 ? compressed : zlib.inflateRawSync(compressed, {maxOutputLength: Math.max(1, size)});
    if (data.length !== size || crc32(data) !== crc) throw Error('ZIP member length or CRC mismatch: ' + name);
    const directory = name.endsWith('/');
    if (/\.nro$/i.test(name) && !isNro(data)) throw Error('Invalid NRO header: ' + name);
    entries.push({path: name, bytes: size, sha256: hash(data), directory, data});
    cursor = next;
  }
  if (cursor !== directoryOffset + directoryBytes) throw Error('ZIP directory size mismatch');
  return entries;
}

function isNro(bytes) { return bytes.length >= 0x80 && bytes.subarray(0x10, 0x14).toString() === 'NRO0'; }
function isAncillaryFile(entry) {
  return !entry.directory && !/\.nro$/i.test(entry.path) && !/(?:^|\/)(?:\.get(?:\/|$)|info\.json$|manifest\.install$|manifest\.json$|readme[^/]*$|licen[cs]e[^/]*$|copying[^/]*$)/i.test(entry.path);
}

function validateApp(app) {
  if (!app || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(app.id || '')) throw Error('Each app needs a stable ASCII store id');
  for (const key of ['title', 'version']) if (typeof app[key] !== 'string' || !app[key].trim()) throw Error(app.id + ': missing ' + key);
  const project = new URL(app.project);
  if (project.protocol !== 'https:') throw Error(app.id + ': official project must use HTTPS');
  const packageUrl = new URL(app.packageUrl);
  if (packageUrl.protocol !== 'https:' || packageUrl.hostname !== 'switch.cdn.fortheusers.org' || !/^\/zips\/[^/]+\.zip$/.test(packageUrl.pathname) || packageUrl.search || packageUrl.hash) throw Error(app.id + ': require the captured Switch store ZIP URL');
  if (app.assetUrl) {
    const assetUrl = new URL(app.assetUrl);
    if (assetUrl.protocol !== 'https:' || assetUrl.hostname !== 'github.com' || !/^\/[\w.-]+\/[\w.-]+\/releases\/download\/.+\/[^/]+\.nro$/i.test(assetUrl.pathname) || assetUrl.search || assetUrl.hash) throw Error(app.id + ': optional official asset must be a pinned release NRO');
    if (app.standaloneNro !== true) throw Error(app.id + ': standalone official NRO needs documented standaloneNro true');
  }
  if (app.releaseAssetUrl) {
    const assetUrl = new URL(app.releaseAssetUrl);
    if (assetUrl.protocol !== 'https:' || assetUrl.hostname !== 'github.com' || !/^\/[\w.-]+\/[\w.-]+\/releases\/download\/.+\/[^/]+\.(?:zip|7z)$/i.test(assetUrl.pathname) || assetUrl.search || assetUrl.hash) throw Error(app.id + ': official bundle must be a pinned console release asset');
    if (!Number.isSafeInteger(app.releaseAssetSize) || app.releaseAssetSize <= 0 || app.releaseAssetSize > 256 * 1024 * 1024) throw Error(app.id + ': invalid official bundle size');
  }
  for (const key of ['expectedPackageSha256', 'expectedAssetSha256']) if (app[key] && !/^[a-f0-9]{64}$/i.test(app[key])) throw Error(app.id + ': invalid ' + key);
  if (app.storeMD5 && !/^[a-f0-9]{1,32}$/i.test(app.storeMD5)) throw Error(app.id + ': invalid captured store checksum');
  for (const key of ['expectedPackageBytes', 'expectedAssetBytes', 'maxBytes']) if (app[key] !== undefined && (!Number.isSafeInteger(app[key]) || app[key] <= 0 || app[key] > 512 * 1024 * 1024)) throw Error(app.id + ': invalid ' + key);
  return app;
}

function mergeReports(...reports) {
  const items = new Map();
  for (const report of reports) for (const incoming of report.items || []) {
    const old = items.get(incoming.id) || {}, files = new Map(), attempts = new Map();
    for (const file of [...(old.files || []), ...(incoming.files || [])]) files.set([file.backupPath || '', file.sha256 || '', file.name || ''].join('\0'), {...files.get([file.backupPath || '', file.sha256 || '', file.name || ''].join('\0')), ...file});
    for (const attempt of [...(old.attempts || []), ...(incoming.attempts || [])]) attempts.set(JSON.stringify(attempt), attempt);
    items.set(incoming.id, {...old, ...incoming, pages: unique([...(old.pages || []), ...(incoming.pages || [])]), labels: unique([...(old.labels || []), ...(incoming.labels || [])]), sourceUrls: unique([...(old.sourceUrls || []), old.url, ...(incoming.sourceUrls || []), incoming.url]), files: [...files.values()], ...(attempts.size ? {attempts: [...attempts.values()]} : {})});
  }
  return Object.assign({}, ...reports, {items: [...items.values()]});
}

async function request(url, maxBytes) {
  for (let redirect = 0; redirect <= 5; redirect++) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !allowedHosts.has(parsed.hostname)) throw Error('Download host is not an approved store/project host');
    const response = await fetch(url, {redirect: 'manual', signal: AbortSignal.timeout(120000), headers: {'User-Agent': 'whatsite-switch-archive/1.0'}});
    if ([301, 302, 303, 307, 308].includes(response.status)) { await response.body?.cancel(); const location = response.headers.get('location'); if (!location) throw Error('Redirect has no location'); url = new URL(location, url).href; continue; }
    if (!response.ok) { await response.body?.cancel(); throw Error('HTTP ' + response.status + ' at ' + parsed.hostname); }
    if (/text\/html|application\/json/i.test(response.headers.get('content-type') || '')) { await response.body?.cancel(); throw Error('Received an error/web page instead of a build'); }
    if (Number(response.headers.get('content-length')) > maxBytes) { await response.body?.cancel(); throw Error('Download exceeds configured size limit'); }
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) { bytes += chunk.length; if (bytes > maxBytes) throw Error('Download exceeds configured size limit'); chunks.push(chunk); }
    if (!bytes) throw Error('Empty download');
    return Buffer.concat(chunks);
  }
  throw Error('Too many redirects');
}

function persistItem(item) {
  const inventoryPath = contained(backup, path.join(backup, 'download-inventory.json'));
  // Re-read both inventories immediately before each synchronous merge/write.
  const report = mergeReports(json(inventoryPath, {items: []}), json(auditPath, {items: []}), {items: [item]});
  report.updated = new Date().toISOString(); report.backupRoot = backup;
  atomicWrite(root, auditPath, report);
  const latest = mergeReports(report, json(inventoryPath, {items: []}), json(auditPath, {items: []}), {items: [item]});
  latest.updated = report.updated; latest.backupRoot = backup;
  atomicWrite(backup, inventoryPath, latest);
}

function saveBuild(item, app, bytes, filename, source, role, derivedFrom, mirror = true) {
  const at = new Date().toISOString(), sha256 = hash(bytes);
  const file = {name: safeName(filename), bytes: bytes.length, sha256, sourceUrl: source, resolvedUrl: source, releaseTag: app.version, version: app.version, archivedAt: at, archiveRole: ['Builds'], role, ...(derivedFrom ? {derivedFrom} : {})};
  file.backupPath = preserveWrite(backup, destinationForFile(backup, item, file), bytes);
  const relative = path.join('downloads/nintendo-switch', app.id, safeName(app.version), file.name);
  const existing = item.files.find(value => value.sha256 === sha256 && value.local && fs.existsSync(contained(root, path.join(root, value.local.slice(1)))));
  if (existing) file.local = existing.local;
  else if (!mirror) file.mirrorReason = 'Original store container retained in the F: archive; use its official source URL.';
  else if (bytes.length >= maximumPublicFileBytes) file.mirrorReason = 'File exceeds the 95 MiB public mirror file limit; use its official source URL.';
  else if (treeBytes(mirrorRoot) + bytes.length > mirrorBudgetBytes) file.mirrorReason = 'Switch public mirror 384 MiB collection budget reached; use its official source URL.';
  else {
    const localPath = preserveWrite(root, path.join(root, relative), bytes);
    file.local = '/' + path.relative(root, localPath).replaceAll('\\', '/');
  }
  const old = item.files.find(value => value.backupPath === file.backupPath && value.sha256 === sha256);
  if (old) Object.assign(old, file); else item.files.push(file);
  return {name: file.name, bytes: file.bytes, sha256, source, version: app.version, ...(file.local ? {local: file.local} : {mirrorReason: file.mirrorReason}), archived: true, role, ...(derivedFrom ? {derivedFrom} : {})};
}

async function obtain(item, app, source, role, expectedBytes, expectedSha256) {
  for (const file of item.files || []) {
    if (file.role !== role || file.version !== app.version || file.sourceUrl !== source || !file.backupPath || !fs.existsSync(contained(backup, file.backupPath))) continue;
    const bytes = fs.readFileSync(file.backupPath);
    if (bytes.length === file.bytes && hash(bytes) === file.sha256 && (!expectedBytes || bytes.length === expectedBytes) && (!expectedSha256 || hash(bytes) === expectedSha256.toLowerCase())) return bytes;
  }
  const bytes = await request(source, app.maxBytes || 256 * 1024 * 1024);
  if (expectedBytes && bytes.length !== expectedBytes) throw Error('Download size differs from captured metadata');
  if (expectedSha256 && hash(bytes) !== expectedSha256.toLowerCase()) throw Error('Download SHA-256 differs from captured metadata');
  return bytes;
}

async function main(args = process.argv.slice(2)) {
  if (args.some(arg => !['--check', '--download'].includes(arg)) || args.includes('--check') && args.includes('--download')) throw Error('Use --check (default) or --download');
  const catalogue = json(cataloguePath, {}), apps = catalogue.apps;
  if (!Array.isArray(apps) || !apps.length) throw Error('Provide docs/switch-homebrew-catalog.json with a nonempty apps array');
  apps.forEach(validateApp);
  if (new Set(apps.map(app => app.id.toLowerCase())).size !== apps.length) throw Error('App ids must be unique');
  if (!args.includes('--download')) { console.log('Validated ' + apps.length + ' Switch archive jobs. No network or files changed.'); return; }
  if (!fs.existsSync(backup) || !fs.statSync(backup).isDirectory()) throw Error('Existing F: archive is unavailable');
  fs.mkdirSync(contained(backup, path.join(backup, 'archive-history')), {recursive: true});
  const history = contained(backup, fs.mkdtempSync(path.join(backup, 'archive-history/switch-homebrew-')));
  for (const [source, name] of [[auditPath, 'workspace-download-audit.json'], [path.join(backup, 'download-inventory.json'), 'download-inventory.json']]) if (fs.existsSync(source)) fs.copyFileSync(source, contained(backup, path.join(history, name)), fs.constants.COPYFILE_EXCL);
  const previous = json(manifestPath, {apps: []}), records = new Map((previous.apps || []).map(app => [app.id, app]));
  let failures = 0;
  for (const app of apps) {
    const id = 'switch-homebrew-' + app.id;
    const inventory = mergeReports(json(path.join(backup, 'download-inventory.json'), {items: []}), json(auditPath, {items: []}));
    const old = inventory.items.find(item => item.id === id);
    const item = {...old, id, title: app.title, project: app.title, url: app.project, kind: 'official-switch-homebrew', platform: 'Nintendo Switch', category: 'Homebrew', release: app.version, pages: unique([...(old?.pages || []), 'console/nintendo-switch.html', 'console/nintendo-switch/apps.html']), labels: unique([...(old?.labels || []), 'Switch homebrew download']), sourceUrls: unique([...(old?.sourceUrls || []), app.project, app.packageUrl, app.assetUrl, app.releaseAssetUrl]), files: old?.files || [], attempts: old?.attempts || []};
    const attempt = {at: new Date().toISOString(), version: app.version, sourceUrl: app.packageUrl};
    const record = {id: app.id, title: app.title, version: app.version, checkedAt: attempt.at, packageUrl: app.packageUrl};
    console.log('Switch: ' + app.title + ' ' + app.version);
    try {
      const bytes = await obtain(item, app, app.packageUrl, 'store-package', app.expectedPackageBytes, app.expectedPackageSha256);
      if (app.storeMD5 && crypto.createHash('md5').update(bytes).digest('hex') !== app.storeMD5.toLowerCase().padStart(32, '0')) throw Error('Package differs from the captured store catalogue checksum');
      const packageName = app.packageFilename || app.id + '-sd-package.zip';
      // Preserve the original container before inspection so failures stay truthful.
      record.package = saveBuild(item, app, bytes, packageName, app.packageUrl, 'store-package', undefined, false);
      const entries = inspectZip(bytes), nros = entries.filter(entry => !entry.directory && /\.nro$/i.test(entry.path));
      if (!nros.length) throw Error('Store package contains no verified Switch NRO');
      record.members = entries.map(({data, ...entry}) => entry);
      record.nroPaths = nros.map(entry => entry.path);
      record.requiresBundle = nros.length !== 1 || entries.some(isAncillaryFile) || app.standaloneNro !== true;
      if (record.requiresBundle) record.package = saveBuild(item, app, bytes, packageName, app.packageUrl, 'store-package');
      if (!record.requiresBundle) {
        record.nro = saveBuild(item, app, nros[0].data, path.posix.basename(nros[0].path), app.packageUrl, 'extracted-nro', {sha256: record.package.sha256, member: nros[0].path});
        record.installPath = nros[0].path;
      }
      if (app.assetUrl) {
        const asset = await obtain(item, app, app.assetUrl, 'official-nro', app.expectedAssetBytes || app.assetSize, app.expectedAssetSha256);
        if (!isNro(asset)) throw Error('Official release file is not a valid Switch NRO');
        record.officialNro = saveBuild(item, app, asset, app.assetFilename || decodeURIComponent(new URL(app.assetUrl).pathname.split('/').pop()), app.assetUrl, 'official-nro');
      }
      if (app.releaseAssetUrl) {
        try {
          const asset = await obtain(item, app, app.releaseAssetUrl, 'official-bundle', app.releaseAssetSize);
          const filename = safeName(app.releaseAssetName || decodeURIComponent(new URL(app.releaseAssetUrl).pathname.split('/').pop()));
          if (/\.zip$/i.test(filename)) inspectZip(asset);
          else if (!asset.subarray(0, 6).equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))) throw Error('Official release is not a 7z archive');
          record.officialBundle = saveBuild(item, app, asset, filename, app.releaseAssetUrl, 'official-bundle', undefined, false);
          if (/\.7z$/i.test(filename)) {
            const archived = item.files.find(file => file.role === 'official-bundle' && file.sha256 === record.officialBundle.sha256);
            const sevenZip = 'C:/Program Files/7-Zip/7z.exe';
            if (!fs.existsSync(sevenZip)) throw Error('7-Zip is unavailable for official bundle inspection');
            const listed = spawnSync(sevenZip, ['l', '-slt', '-bd', archived.backupPath], {encoding:'utf8', windowsHide:true, timeout:60000, maxBuffer:4*1024*1024});
            if (listed.status !== 0 || !/Path = .*\.nro\r?$/im.test(listed.stdout)) throw Error('Official 7z listing did not confirm a Switch NRO');
            record.officialBundle.inspected = '7-Zip member listing; no files executed or extracted';
          } else record.officialBundle.inspected = 'ZIP paths, CRC and NRO headers';
        } catch (error) {
          record.officialBundleError = error.message;
          item.attempts.push({at:new Date().toISOString(), version:app.version, sourceUrl:app.releaseAssetUrl, status:'unavailable', error:error.message});
          console.error('  optional official bundle unavailable: ' + error.message);
        }
      }
      record.status = 'downloaded'; item.status = 'downloaded'; delete item.error;
      Object.assign(attempt, {status: 'downloaded', bytes: bytes.length, sha256: record.package.sha256});
      console.log('  archived package; ' + nros.length + ' verified NRO; ' + (record.nro ? 'standalone NRO available' : 'keep complete SD bundle'));
    } catch (error) {
      failures++; record.status = 'unavailable'; record.error = error.message;
      item.status = item.files.length ? 'partial' : 'unavailable'; item.error = error.message;
      Object.assign(attempt, {status: 'unavailable', error: error.message});
      console.error('  unavailable: ' + error.message);
    }
    item.attempts.push(attempt); persistItem(item);
    const older = records.get(app.id);
    if (older && older.version !== app.version) record.previousVersions = [...(older.previousVersions || []), older];
    else if (older?.previousVersions) record.previousVersions = older.previousVersions;
    records.set(app.id, record);
    atomicWrite(root, manifestPath, {schemaVersion: 1, updated: new Date().toISOString(), method: 'Selected store ZIPs and pinned official NROs. ZIP paths, CRC and NRO headers inspected; builds never executed.', mirror: {scope: 'downloads/nintendo-switch only; older public collections preserved', budgetBytes: mirrorBudgetBytes, maximumFileBytes: maximumPublicFileBytes, currentBytes: treeBytes(mirrorRoot), strategy: 'Publish standalone NROs when dependencies permit; publish intact SD bundles otherwise. Original containers always preserved in the F: archive.'}, apps: [...records.values()]});
  }
  console.log('Processed ' + apps.length + ' Switch apps; ' + failures + ' unavailable. Prior inventories: ' + history);
  console.log('Refresh archive index afterward: node scripts/refresh-local-download-index.cjs --write');
  if (failures) process.exitCode = 1;
}

module.exports = {safeMember, inspectZip, isNro, crc32, validateApp, mergeReports, main};
if (require.main === module) main().catch(error => {console.error(error.message); process.exitCode = 1;});
