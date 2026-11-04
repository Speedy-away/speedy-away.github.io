// Import explicitly selected Steam Deck Linux builds, Decky bundles and installers. Never execute them.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {Readable, Transform} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const {destinationForFile, safeName} = require('./download-archive-layout.cjs');

const root = path.resolve(__dirname, '..');
const backup = path.resolve('F:/whatsite-backup-downloads-etc');
const auditPath = path.join(root, 'docs/download-audit.json');
const jobsPath = path.join(root, 'docs/steamdeck-download-jobs.json');
const redirectedHosts = new Set(['github.com', 'raw.githubusercontent.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com', 'github-releases.githubusercontent.com', 'www.emudeck.com', 'emudeck.com', 'dl.flathub.org', 'cdn.tzatzikiweeb.moe']);
const flathubApps = new Set(['net.retrodeck.retrodeck', 'net.lutris.Lutris', 'com.github.Matoking.protontricks', 'com.github.tchx84.Flatseal', 'org.kde.kdeconnect', 'com.usebottles.bottles', 'org.kde.filelight']);
const deckyHash = asset => asset.hostname === 'cdn.tzatzikiweeb.moe' && !asset.search ? asset.pathname.match(/^\/file\/steam-deck-homebrew\/versions\/([a-f0-9]{64})\.zip$/)?.[1] : undefined;
const hashFile = async file => {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};

function validateJob(job) {
  if (!job || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(job.id || '')) throw Error('Each job needs a stable lowercase id.');
  for (const key of ['title', 'version', 'filename']) {
    if (typeof job[key] !== 'string' || !job[key].trim() || job[key] !== safeName(job[key])) throw Error(job.id + ': invalid ' + key);
  }
  for (const key of ['url', 'assetUrl']) {
    const url = new URL(job[key]);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) throw Error(job.id + ': require an ordinary HTTPS ' + key);
  }
  const asset = new URL(job.assetUrl);
  const githubAsset = asset.hostname === 'github.com' && /^\/[\w.-]+\/[\w.-]+\/releases\/(?:download\/[^/]+|latest\/download)\/[^/]+$/.test(asset.pathname);
  const rawInstaller = asset.hostname === 'raw.githubusercontent.com' && /^\/[\w.-]+\/[\w.-]+\/[^/]+\/.+/.test(asset.pathname);
  const emudeckInstaller = asset.hostname === 'www.emudeck.com' && asset.pathname === '/EmuDeck.desktop';
  const flathubApp = asset.pathname.match(/^\/repo\/appstream\/([\w.]+)\.flatpakref$/)?.[1];
  const flathubInstaller = asset.hostname === 'dl.flathub.org' && flathubApps.has(flathubApp) && !asset.search;
  const deckyArtifactHash = deckyHash(asset);
  if (!githubAsset && !rawInstaller && !emudeckInstaller && !flathubInstaller && !deckyArtifactHash) {
    throw Error(job.id + ': asset must be an explicit GitHub release, approved Decky build or official installer.');
  }
  if (asset.hostname === 'raw.githubusercontent.com' && !/\.(?:sh|desktop|flatpakref)$/i.test(asset.pathname)) throw Error(job.id + ': raw GitHub files must be installers.');
  if (/(?:^|[-_. ])(?:source|src|sdk|symbols?|debug)(?:[-_. ]|$)/i.test(job.filename) || /(?:^|[-_. ])(?:source|src|sdk|symbols?|debug)(?:[-_. ]|$)/i.test(decodeURIComponent(asset.pathname.split('/').pop())) || /\.(?:exe|msi|dmg|apk|ipa|deb|rpm)$/i.test(job.filename) || /(?:^|[-_. ])(?:win(?:dows)?|macos|darwin|arm64|aarch64)(?:[-_. ]|$)/i.test(job.filename)) {
    throw Error(job.id + ': select a ready-to-use Steam Deck Linux file.');
  }
  if (!/\.(?:AppImage(?:_x86_64)?|flatpakref|flatpak|desktop|sh|zip|tar\.gz|tar\.xz|tar\.zst)$/i.test(job.filename)) throw Error(job.id + ': unsupported build/installer filename.');
  if (!Array.isArray(job.archiveRole) || !['Builds', 'Helpers'].includes(job.archiveRole[0]) || job.archiveRole.length > 2 || job.archiveRole.length === 2 && job.archiveRole[1] !== 'Linux') throw Error(job.id + ': invalid archiveRole.');
  if (job.category !== undefined && !['Tools', 'Plugins'].includes(job.category)) throw Error(job.id + ': category must be Tools or Plugins.');
  if (job.category === 'Plugins' && (!/\.(?:zip|tar\.gz|tar\.xz|tar\.zst)$/i.test(job.filename) || job.archiveRole[0] !== 'Builds')) throw Error(job.id + ': Decky plugins require a ready build bundle.');
  if (flathubInstaller && (job.filename !== flathubApp + '.flatpakref' || job.archiveRole[0] !== 'Helpers' || job.category === 'Plugins')) throw Error(job.id + ': Flatpak references must retain their app ID and installer role.');
  if (deckyArtifactHash && (job.category !== 'Plugins' || job.expectedSha256?.toLowerCase() !== deckyArtifactHash)) throw Error(job.id + ': Decky store bundles require the exact published SHA-256 and Plugins category.');
  if (!Number.isSafeInteger(job.maxBytes) || job.maxBytes < 1 || job.maxBytes > 2 * 1024 ** 3) throw Error(job.id + ': provide maxBytes up to 2 GiB.');
  if (job.expectedBytes !== undefined && (!Number.isSafeInteger(job.expectedBytes) || job.expectedBytes < 1 || job.expectedBytes > job.maxBytes)) throw Error(job.id + ': invalid expectedBytes.');
  if (job.expectedSha256 !== undefined && !/^[a-f0-9]{64}$/i.test(job.expectedSha256)) throw Error(job.id + ': invalid expectedSha256.');
  return job;
}

function optionsFor(args) {
  const ids = new Set();
  for (const arg of args) {
    if (['--check', '--download'].includes(arg)) continue;
    if (!arg.startsWith('--id=') || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(arg.slice(5))) throw Error('Use --check (default) or --download, optionally with repeated --id=<job-id>.');
    ids.add(arg.slice(5));
  }
  if (args.includes('--check') && args.includes('--download')) throw Error('Use --check or --download, not both.');
  return {download: args.includes('--download'), ids};
}

function selectedJobs(jobs, ids) {
  const known = new Set(jobs.map(job => job.id));
  for (const id of ids) if (!known.has(id)) throw Error('Unknown Steam Deck job: ' + id);
  return ids.size ? jobs.filter(job => ids.has(job.id)) : jobs;
}

function validateInstallerContent(text, job) {
  const section = /\.desktop$/i.test(job.filename) ? /^\[Desktop Entry\]\s*$/m : /^\[Flatpak Ref\]\s*$/m;
  if (!section.test(text)) throw Error('Invalid online installer format; partial preserved.');
  const asset = new URL(job.assetUrl);
  if (asset.hostname === 'dl.flathub.org') {
    const expectedApp = asset.pathname.match(/\/([^/]+)\.flatpakref$/)?.[1];
    const actualApp = text.match(/^Name\s*=\s*([^\r\n]+)$/m)?.[1].trim();
    if (!expectedApp || actualApp !== expectedApp) throw Error('Flatpak installer app ID differs from the selected job; partial preserved.');
  }
}

function mergeReports(...reports) {
  const items = new Map();
  const unique = values => [...new Set(values.filter(Boolean))];
  for (const report of reports) for (const next of report.items || []) {
    const old = items.get(next.id) || {};
    const files = new Map();
    for (const file of [...(old.files || []), ...(next.files || [])]) {
      const key = (file.backupPath || '') + '\0' + (file.sha256 || '') + '\0' + (file.name || '');
      files.set(key, {...files.get(key), ...file});
    }
    const attempts = new Map();
    for (const attempt of [...(old.attempts || []), ...(next.attempts || [])]) attempts.set(JSON.stringify(attempt), attempt);
    const sourceUrls = unique([...(old.sourceUrls || []), old.url, ...(next.sourceUrls || []), next.url]);
    items.set(next.id, {...old, ...next, pages: unique([...(old.pages || []), ...(next.pages || [])]), labels: unique([...(old.labels || []), ...(next.labels || [])]), ...(sourceUrls.length > 1 ? {sourceUrls} : {}), files: [...files.values()], ...(attempts.size ? {attempts: [...attempts.values()]} : {})});
  }
  return Object.assign({}, ...reports, {items: [...items.values()]});
}

function withinArchive(file) {
  const absolute = path.resolve(file), relative = path.relative(backup, absolute);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw Error('Path escapes archive: ' + file);
  let ancestor = absolute;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  if (fs.existsSync(backup)) {
    const realRelative = path.relative(fs.realpathSync(backup), fs.realpathSync(ancestor));
    if (realRelative === '..' || realRelative.startsWith('..' + path.sep) || path.isAbsolute(realRelative)) throw Error('Path resolves outside archive: ' + file);
  }
  return absolute;
}

function saveExclusive(temporary, target) {
  const ext = path.extname(target), stem = target.slice(0, target.length - ext.length);
  let destination = target, copy = 1;
  for (;;) {
    try { fs.copyFileSync(temporary, destination, fs.constants.COPYFILE_EXCL); return destination; }
    catch (error) { if (error.code !== 'EEXIST') throw error; destination = stem + ' (copy ' + ++copy + ')' + ext; }
  }
}

function readReport(file) {
  if (!fs.existsSync(file)) return {items: []};
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data.items) || data.backupRoot && path.resolve(data.backupRoot) !== backup) throw Error('Invalid inventory: ' + file);
  return data;
}

function persist(item) {
  const inventoryPath = withinArchive(path.join(backup, 'download-inventory.json'));
  const report = mergeReports(readReport(inventoryPath), readReport(auditPath), {items: [item]});
  report.backupRoot = backup;
  report.updated = new Date().toISOString();
  const json = JSON.stringify(report, null, 2) + '\n';
  for (const file of [auditPath, inventoryPath]) {
    const temporary = file + '.steamdeck-' + crypto.randomBytes(6).toString('hex') + '.tmp';
    fs.writeFileSync(temporary, json, {flag: 'wx'});
    fs.renameSync(temporary, file);
  }
}

async function requestAsset(source) {
  let url = source;
  for (let redirect = 0; redirect <= 5; redirect++) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !redirectedHosts.has(parsed.hostname)) throw Error('Asset redirected outside approved download hosts.');
    if (parsed.hostname === 'cdn.tzatzikiweeb.moe' && !deckyHash(parsed)) throw Error('Unexpected Decky store bundle path.');
    const response = await fetch(url, {redirect: 'manual', signal: AbortSignal.timeout(600000), headers: {'User-Agent': 'whatsite-steamdeck-archive/1.0'}});
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (!location) throw Error('Redirect has no destination.');
      url = new URL(location, url).href;
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw Error('HTTP ' + response.status + ' at ' + parsed.hostname); }
    if (/text\/html|application\/json/i.test(response.headers.get('content-type') || '')) { await response.body?.cancel(); throw Error('Received a web/error page instead of an asset.'); }
    return response;
  }
  throw Error('Too many asset redirects.');
}

async function download(job, item) {
  for (const saved of item.files || []) {
    if (saved.resolvedUrl !== job.assetUrl || saved.releaseTag !== job.version || !saved.backupPath || !fs.existsSync(withinArchive(saved.backupPath))) continue;
    if ((!job.expectedSha256 || job.expectedSha256.toLowerCase() === saved.sha256) && fs.statSync(saved.backupPath).size === saved.bytes && await hashFile(saved.backupPath) === saved.sha256) return {status: 'already-saved', file: saved};
  }
  const at = new Date().toISOString();
  const file = {name: job.filename, releaseTag: job.version, archiveRole: job.archiveRole, downloadedAt: at, archivedAt: at};
  const target = withinArchive(destinationForFile(backup, item, file));
  fs.mkdirSync(path.dirname(target), {recursive: true});
  const temporary = withinArchive(target + '.partial-' + crypto.randomBytes(8).toString('hex'));
  const response = await requestAsset(job.assetUrl);
  // Fetch decompresses response bodies; compressed Content-Length is not the file size.
  const declared = response.headers.get('content-encoding') ? 0 : Number(response.headers.get('content-length'));
  if (declared > job.maxBytes || job.expectedBytes && declared && declared !== job.expectedBytes) { await response.body?.cancel(); throw Error('Asset Content-Length exceeds or differs from the job bounds.'); }
  let bytes = 0;
  const hash = crypto.createHash('sha256');
  const meter = new Transform({transform(chunk, encoding, callback) {
    bytes += chunk.length;
    if (bytes > job.maxBytes) return callback(Error('Asset exceeded maxBytes; partial preserved.'));
    hash.update(chunk); callback(null, chunk);
  }});
  await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(temporary, {flags: 'wx'}));
  if (!bytes || job.expectedBytes && bytes !== job.expectedBytes) throw Error('Asset length does not match the job; partial preserved.');
  const head = Buffer.alloc(16), descriptor = fs.openSync(temporary, 'r');
  try { fs.readSync(descriptor, head, 0, head.length, 0); } finally { fs.closeSync(descriptor); }
  const signatures = [[/\.AppImage(?:_x86_64)?$/i, '7f454c46', 4], [/\.zip$/i, '504b', 2], [/\.tar\.gz$/i, '1f8b', 2], [/\.tar\.xz$/i, 'fd377a585a00', 6]];
  for (const [pattern, magic, length] of signatures) if (pattern.test(job.filename) && head.subarray(0, length).toString('hex') !== magic) throw Error('Asset signature is invalid; partial preserved.');
  if (/\.(?:desktop|flatpakref)$/i.test(job.filename)) {
    const text = fs.readFileSync(temporary, 'utf8');
    validateInstallerContent(text, job);
  }
  const sha256 = hash.digest('hex');
  if (job.expectedSha256 && sha256 !== job.expectedSha256.toLowerCase()) throw Error('Asset SHA-256 differs from publisher metadata; partial preserved.');
  const destination = saveExclusive(temporary, target);
  // Only remove this transfer's temporary copy after the exclusive final copy succeeds.
  fs.unlinkSync(temporary);
  return {status: 'downloaded', file: {...file, name: path.basename(destination), originalName: job.filename, bytes, sha256, resolvedUrl: job.assetUrl, backupPath: destination}};
}

async function main(args = process.argv.slice(2)) {
  const options = optionsFor(args);
  const input = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
  const allJobs = (Array.isArray(input) ? input : input.jobs);
  if (!Array.isArray(allJobs) || !allJobs.length) throw Error('Provide a nonempty jobs array.');
  allJobs.forEach(validateJob);
  if (new Set(allJobs.map(job => job.id)).size !== allJobs.length) throw Error('Job ids must be unique.');
  const jobs = selectedJobs(allJobs, options.ids);
  if (!options.download) { console.log('Validated ' + jobs.length + ' selected Steam Deck Linux asset jobs (' + allJobs.length + ' total); no network or files changed.'); return; }
  if (!fs.existsSync(backup) || !fs.statSync(backup).isDirectory()) throw Error('The existing F: archive is unavailable.');
  const historyRoot = withinArchive(path.join(backup, 'archive-history'));
  fs.mkdirSync(historyRoot, {recursive: true});
  const history = withinArchive(fs.mkdtempSync(path.join(historyRoot, 'steamdeck-import-')));
  for (const [source, name] of [[auditPath, 'workspace-download-audit.json'], [path.join(backup, 'download-inventory.json'), 'download-inventory.json']]) if (fs.existsSync(source)) fs.copyFileSync(source, withinArchive(path.join(history, name)), fs.constants.COPYFILE_EXCL);
  let failures = 0;
  for (const job of jobs) {
    const latest = mergeReports(readReport(path.join(backup, 'download-inventory.json')), readReport(auditPath));
    const old = latest.items.find(item => item.id === job.id);
    if (old && old.url !== job.url) throw Error(job.id + ': existing inventory id belongs to another source.');
    const kind = deckyHash(new URL(job.assetUrl)) ? 'decky-plugin' : new URL(job.assetUrl).hostname === 'github.com' ? 'github-release' : 'official-installer';
    const item = {...old, id: job.id, url: job.url, kind, title: job.title, project: job.title, platform: 'Steam Deck', category: job.category || 'Tools', pages: [...new Set([...(old?.pages || []), 'console/steamdeck.html'])], labels: [...new Set([...(old?.labels || []), job.category === 'Plugins' ? 'Decky plugin build' : 'Linux download'])], files: old?.files || [], attempts: old?.attempts || []};
    const attempt = {at: new Date().toISOString(), sourceUrl: job.assetUrl, version: job.version};
    console.log('Steam Deck: ' + job.title + ' ' + job.version);
    try {
      const result = await download(job, item);
      if (result.status === 'downloaded') item.files.push(result.file);
      item.status = 'downloaded'; item.release = job.version; delete item.error;
      Object.assign(attempt, {status: result.status, bytes: result.file.bytes, sha256: result.file.sha256});
      console.log('  ' + result.status + ': ' + result.file.name + ' (' + result.file.bytes + ' bytes)');
    } catch (error) {
      failures++; item.status = item.files.length ? 'partial' : 'unavailable'; item.error = error.message;
      Object.assign(attempt, {status: 'unavailable', error: error.message});
      console.error('  unavailable: ' + error.message);
    }
    item.attempts.push(attempt); persist(item);
  }
  console.log('Processed ' + jobs.length + ' Steam Deck jobs; ' + failures + ' unavailable. Prior inventories: ' + history);
  if (failures) process.exitCode = 1;
}

module.exports = {validateJob, optionsFor, selectedJobs, validateInstallerContent, mergeReports, saveExclusive, main};
if (require.main === module) main().catch(error => {console.error(error.message); process.exitCode = 1;});
