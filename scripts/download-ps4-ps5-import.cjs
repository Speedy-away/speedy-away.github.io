const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { destinationForFile, safeName } = require('./download-archive-layout.cjs');
const { mergeImport } = require('./download-inventory-merge.cjs');

// Explicit captured jobs only. This helper never scans the site or runs payloads.
const root = path.resolve(__dirname, '..');
const collection = process.argv.find(arg => arg.startsWith('--collection='))?.slice(13) || 'ps4-ps5';
if (!['ps4-ps5', 'ps3', 'xbox360', 'pc'].includes(collection)) throw Error('Unknown download collection');
const defaultPlatform = {'ps4-ps5': 'PS4', ps3: 'PS3', xbox360: 'Xbox 360', pc: 'PC'}[collection];
const jobsArg = process.argv.find(arg => arg.startsWith('--jobs='));
if (!jobsArg) throw Error('Supply --jobs=path-to-explicit-job-list.json');
const jobsFile = path.resolve(root, jobsArg.slice(7));
const requestedIds = process.argv.find(arg => arg.startsWith('--ids='))?.slice(6).split(',');
const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8').replace(/^\uFEFF/, '')).jobs.filter(job => !requestedIds || requestedIds.includes(job.id));
if (requestedIds?.some(id => !jobs.some(job => job.id === id))) throw Error('Requested job ID is missing from the explicit list');
const backup = process.argv.find(arg => arg.startsWith('--backup='))?.slice(9);
const timeoutArg=process.argv.find(arg=>arg.startsWith('--timeout-ms='));
const requestTimeout=timeoutArg?Number(timeoutArg.slice(13)):60000;
if(!Number.isInteger(requestTimeout)||requestTimeout<1000||requestTimeout>300000)throw Error('Request timeout must be1000–300000ms');
const manifestPath = path.join(root, 'downloads', collection, 'manifest.json');
const auditPath = path.join(root, 'docs/download-audit.json');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const load = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : fallback;
const canonical = value => { const url = new URL(value); return url.hostname.endsWith('discordapp.com') ? url.origin + url.pathname : url.href; };
const publicError = error => /^(?:HTTP \d+ at [a-z0-9.-]+$|GoFile |Pinned |Bstlar |Received a |Invalid (?:ZIP|RAR|PNG|JPEG) signature$|Empty download$|Public direct download unavailable$|Download hash differs from publisher checksum$|fetch failed$)/i.test(error.message)
  ? error.message : 'File could not be saved; details are recorded in the private inventory.';
function contained(base, file) {
  const relative = path.relative(path.resolve(base), path.resolve(file));
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Destination escapes intended directory');
  return file;
}
function preserveWrite(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    if (digest(fs.readFileSync(file)) === digest(bytes)) return file;
    const extension = path.extname(file), stem = file.slice(0, file.length - extension.length);
    file = stem + '-' + digest(bytes).slice(0, 16) + extension;
    if (fs.existsSync(file)) {
      if (digest(fs.readFileSync(file)) === digest(bytes)) return file;
      throw Error('Refusing to replace existing different file: ' + file);
    }
  }
  fs.writeFileSync(file, bytes, { flag: 'wx' });
  return file;
}
async function request(url) {
  if (!url.startsWith('https://')) throw Error('Only captured HTTPS download URLs are accepted');
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(requestTimeout), headers: { 'User-Agent': 'whatsite-targeted-archive/1.0' } });
  if (!response.ok) throw Error('HTTP ' + response.status + ' at ' + new URL(url).hostname);
  return response;
}
async function readDownload(response, maxBytes) {
  if (maxBytes && Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw Error('Captured file exceeds the configured download size limit');
  }
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (maxBytes && bytes > maxBytes) throw Error('Captured file exceeds the configured download size limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function resolveDownload(source) {
  const url = new URL(source);
  if (url.hostname === 'bstlar.com' || url.hostname.endsWith('.bstlar.com')) throw Error('Bstlar downloads explicitly skipped by user');
  if ((url.hostname === 'mediafire.com' || url.hostname.endsWith('.mediafire.com')) && /^\/(?:file|file_premium|download)\//.test(url.pathname)) {
    const html = await (await request(source)).text();
    const tag = [...html.matchAll(/<a\b[^>]*>/gi)].map(match => match[0]).find(value => /id=["']downloadButton["']/.test(value));
    const resolved = tag?.match(/href=["']([^"']+)["']/)?.[1]?.replaceAll('&amp;', '&');
    if (!resolved || !new URL(resolved).hostname.endsWith('.mediafire.com')) throw Error('Public direct download unavailable');
    return resolved;
  }
  return source;
}
function verify(bytes, filename) {
  if (!bytes.length) throw Error('Empty download');
  if (/\.(?:zip|vpk|apk|jar)$/i.test(filename) && bytes.subarray(0, 2).toString() !== 'PK') throw Error('Invalid ZIP signature');
  if (/\.7z$/i.test(filename) && bytes.subarray(0, 6).toString('hex') !== '377abcaf271c') throw Error('Invalid 7z signature');
  if (/\.rar$/i.test(filename) && bytes.subarray(0, 4).toString() !== 'Rar!') throw Error('Invalid RAR signature');
  if (/\.7z$/i.test(filename) && bytes.subarray(0, 6).toString('hex') !== '377abcaf271c') throw Error('Invalid 7z signature');
  if (/\.png$/i.test(filename) && bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('Invalid PNG signature');
  if (/\.jpe?g$/i.test(filename) && bytes.subarray(0, 3).toString('hex') !== 'ffd8ff') throw Error('Invalid JPEG signature');
  if (/\.webp$/i.test(filename) && (bytes.subarray(0, 4).toString() !== 'RIFF' || bytes.subarray(8, 12).toString() !== 'WEBP')) throw Error('Invalid WebP signature');
  if (/\.iso$/i.test(filename) && !require('./disc-image-format.cjs').discImageFormat(bytes)) throw Error('Invalid ISO9660/UDF signature');
  if (/\.elf$/i.test(filename) && bytes.subarray(0, 4).toString('hex') !== '7f454c46') throw Error('Invalid ELF signature');
  if (/\.pkg$/i.test(filename) && !require('./console-package-format.cjs').consolePackageFormat(bytes)) throw Error('Invalid PKG signature or package structure');
  if (/\.(?:exe|dll)$/i.test(filename) && bytes.subarray(0, 2).toString() !== 'MZ') throw Error('Invalid PE signature');
}
function saveState(manifest, audit, downloadId) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  const merged = mergeImport(load(manifestPath, { files: [] }), load(auditPath, { items: [] }), manifest, audit, downloadId, collection);
  merged.manifest.updated = new Date().toISOString();
  merged.audit.updated = merged.manifest.updated;
  fs.writeFileSync(manifestPath, JSON.stringify(merged.manifest, null, 2) + '\n');
  fs.writeFileSync(auditPath, JSON.stringify(merged.audit, null, 2) + '\n');
  Object.assign(manifest, merged.manifest);
  Object.assign(audit, merged.audit);
}
async function run() {
  const manifest = load(manifestPath, { files: [] });
  const audit = load(auditPath, { items: [] });
  for (const job of jobs) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(job.id)) throw Error('Invalid stable job id');
    const source = job.url || (job.rawJson
      ? load(contained(root, path.resolve(root, job.rawJson)), {}).urls?.[job.urlIndex || 0]
      : fs.readFileSync(contained(root, path.resolve(root, job.rawFile)), 'utf8').replace(/^\uFEFF/, '').trim());
    if (typeof source !== 'string') throw Error('Explicit job has no captured source URL: ' + job.id);
    const id = collection + '-' + job.id;
    const kind = job.kind || (['image', 'video'].includes(job.type) ? job.type : new URL(source).hostname === 'gofile.io' ? 'gofile' : /mediafire\.com/.test(source) ? 'mediafire' : 'direct');
    let item = audit.items.find(value => value.id === id);
    if (!item) { item = { id, url: source, kind, title: job.title, platform: job.platform || defaultPlatform, category: job.category || ['Games', 'Call of Duty', job.game, job.group || 'Shared'], project: job.project || job.title, release: job.version || 'Unversioned', pages: job.pages || [], labels: ['Download'], status: 'pending', files: [], attempts: [] }; audit.items.push(item); }
    item.kind = kind;
    if (job.publication) item.publication = job.publication;
    item.title = job.title;
    if (job.version) item.release = job.version;
    if (job.archiveRole) item.archiveRole = job.archiveRole;
    item.sourceUrls ||= [];
    if (!item.sourceUrls.includes(source)) item.sourceUrls.push(source);
    if (job.capturedUrl && !item.sourceUrls.includes(job.capturedUrl)) item.sourceUrls.push(job.capturedUrl);
    item.url = canonical(source);
    item.attempts ||= [];
    try {
      if (job.unavailableReason) throw Error(job.unavailableReason);
      if (item.publication === 'private-review' && job.mirror !== false) throw Error('Private review jobs must be backup-only');
      if (job.mirror === false && !backup) throw Error('Backup-only jobs require --backup');
      const previousRows = item.publication === 'private-review' ? item.files.map(file => ({ ...file, downloadId: job.id, status: 'downloaded' })) : manifest.files;
      const previous = previousRows.findLast(value => value.downloadId === job.id && value.status === 'downloaded' && (
        value.local && fs.existsSync(contained(root, path.join(root, value.local.slice(1)))) ||
        backup && item.files.some(file => file.sha256 === value.sha256 && file.backupPath && fs.existsSync(contained(backup, file.backupPath)))
      ));
      let bytes, resolved, filename;
      if (previous) {
        const previousBackup = item.files.find(file => file.sha256 === previous.sha256 && file.backupPath && backup && fs.existsSync(contained(backup, file.backupPath)));
        const savedPath = previous.local && fs.existsSync(contained(root, path.join(root, previous.local.slice(1)))) ? contained(root, path.join(root, previous.local.slice(1))) : contained(backup, previousBackup.backupPath);
        bytes = fs.readFileSync(savedPath);
        if (digest(bytes) !== previous.sha256) throw Error('Previously staged file hash changed');
        resolved = item.files.find(value => value.sha256 === previous.sha256)?.resolvedUrl || source;
        filename = previous.name;
      } else if (job.importPath) {
        const importedPath = contained(root, path.resolve(root, job.importPath));
        bytes = fs.readFileSync(importedPath);
        resolved = source;
        filename = safeName(job.filename || path.basename(importedPath));
        verify(bytes, filename);
      } else {
        resolved = await resolveDownload(source);
        const response = await request(resolved);
        if (/text\/html|application\/json/.test(response.headers.get('content-type') || '')) { await response.body?.cancel(); throw Error('Received a web/error page instead of a file'); }
        filename = safeName(job.filename || decodeURIComponent(new URL(resolved).pathname.split('/').pop() || 'download'));
        bytes = await readDownload(response, job.maxBytes);
        verify(bytes, filename);
      }
      const sha256 = digest(bytes);
      if (job.expectedBytes && bytes.length !== job.expectedBytes) throw Error('Download size differs from captured file metadata');
      if (job.expectedSha256 && sha256 !== job.expectedSha256.toLowerCase()) throw Error('Download hash differs from publisher checksum');
      const media = ['image', 'video'].includes(job.type);
      const relative = job.type === 'image' ? 'assets/images/' + collection + '/originals/' + job.id + path.extname(filename)
        : job.type === 'video' ? 'assets/videos/' + collection + '/originals/' + job.id + path.extname(filename)
        : 'downloads/' + collection + '/' + job.id + '/' + filename;
      const staged = job.mirror === false ? null : preserveWrite(contained(root, path.join(root, relative)), bytes);
      const local = staged ? '/' + path.relative(root, staged).replaceAll('\\', '/') : previous?.local;
      let backupPath;
      if (backup && !media) {
        const intended = destinationForFile(backup, item, { name: filename, releaseTag: job.version || 'Unversioned' });
        backupPath = preserveWrite(contained(backup, intended), bytes);
      }
      let file = item.files.find(value => value.sha256 === sha256 && value.name === filename);
      if (!file) { file = { name: filename, bytes: bytes.length, sha256, sourceUrl: source, resolvedUrl: resolved, local, version: job.version || null, archivedAt: new Date().toISOString(),...(job.memberPath?{memberPath:job.memberPath}:{}),...(job.extractedFromSha256?{extractedFromSha256:job.extractedFromSha256}:{}) }; item.files.push(file); }
      if (backupPath) file.backupPath = backupPath;
      item.status = item.publication === 'private-review' ? 'private-review' : media || file.backupPath ? 'downloaded' : 'staged';
      item.attempts.push({ at: new Date().toISOString(), status: item.status, bytes: bytes.length, sha256 });
      const publicFile = { downloadId: job.id, resource: job.resource || job.id, name: filename, source: canonical(source), version: job.version || null, status: 'downloaded', local, bytes: bytes.length, sha256, archived: media || Boolean(file.backupPath) };
      if (item.publication !== 'private-review') {
        const existing = manifest.files.find(value => value.downloadId === job.id && value.sha256 === sha256);
        if (existing) Object.assign(existing, publicFile); else manifest.files.push(publicFile);
      }
      console.log(job.id + ': ' + item.status + ', ' + bytes.length + ' bytes, SHA-256 ' + sha256);
    } catch (error) {
      item.attempts.push({ at: new Date().toISOString(), status: 'unavailable', error: error.message });
      if (!item.files.length) item.status = 'unavailable';
      if (item.publication !== 'private-review' && !manifest.files.some(value => value.downloadId === job.id && value.status === 'downloaded')) manifest.files.push({ downloadId: job.id, resource: job.resource || job.id, source: canonical(source), version: job.version || null, status: 'unavailable', error: publicError(error) });
      console.log(job.id + ': unavailable — ' + error.message);
      process.exitCode = 1;
    }
    saveState(manifest, audit, job.id);
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
