// On-demand release updates. Default: inspect only. --download saves new builds.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const root = path.resolve(__dirname, '..');
const inventoryPath = path.join(root, 'docs/download-audit.json');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const fallbackName = value => String(value).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(0, 145) || 'download';
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"');
const consolePage = value => {
  let page = String(value || '').replaceAll('\\', '/');
  try { if (/^https?:/i.test(page)) page = new URL(page).pathname; } catch { return false; }
  page = page.replace(/^\/+/, '').split(/[?#]/)[0];
  return /^console\/(?:ps[345]|psvita|xbox360|nintendo-switch|switch|retro)(?:\/|\.html$)/i.test(page) ||
    /^console\/mods\/(?:ps[345]|xbox360|nintendo-switch|switch)(?:\/|\.html$)/i.test(page);
};

function githubRepo(value) {
  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() !== 'github.com') return null;
    const [owner, repo] = url.pathname.split('/').filter(Boolean);
    if (!owner || !repo || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return null;
    return owner + '/' + repo.replace(/\.git$/, '');
  } catch { return null; }
}

function releaseTag(value) {
  try {
    const pathname = new URL(value).pathname;
    const encoded = pathname.match(/\/releases\/(?:tag|download)\/([^/]+)/)?.[1];
    return encoded ? decodeURIComponent(encoded) : null;
  } catch { return null; }
}

function collectRepositories(inventory, options = {}) {
  const jobs = new Map();
  for (const item of inventory.items || []) {
    if (item.status === 'excluded' || item.kind === 'bstlar' || item.publication === 'private-review') continue;
    if (!options.allTools && !(item.pages || []).some(consolePage)) continue;
    const candidates = [item.url, ...(item.files || []).map(file => file.resolvedUrl)].filter(Boolean);
    for (const candidate of candidates) {
      const repo = githubRepo(candidate);
      if (!repo || options.repo && repo.toLowerCase() !== options.repo.toLowerCase()) continue;
      const key = repo.toLowerCase();
      if (!jobs.has(key)) jobs.set(key, { repo, items: [], pinnedTags: new Set() });
      const job = jobs.get(key);
      if (!job.items.includes(item)) job.items.push(item);
      const tag = releaseTag(candidate);
      if (tag) job.pinnedTags.add(tag);
    }
  }
  return [...jobs.values()].sort((a, b) => a.repo.localeCompare(b.repo));
}

function isReadyAsset(name, options = {}) {
  if (/(?:^|[-_.\s])(?:source|src|sdk|developer|symbols?|pdbs?|debug|uibase|commits|license)(?:[-_.\s]|$)/i.test(name)) return false;
  if (/\.sha\d*$|sha\d*sums|\.zsync$|\.json$|\.txt$|\.asc$|\.sig$/i.test(name)) return false;
  const consoleLinuxPayload = /(?:ps[345]|loader|payload)/i.test(name) && /\.(?:elf|bin|self)$/i.test(name);
  if ((!consoleLinuxPayload && /linux|ubuntu/i.test(name)) || /darwin|macos|mac[-_.]|android|ios|\.dmg$|\.deb$|\.rpm$|\.AppImage$|\.ipa$|\.flatpak$/i.test(name)) return false;
  if (!options.allTools && /(?:^|[-_.])win(?:dows)?(?:32|64|[-_.])|windows|\.exe$|\.msi$|\.dll$/i.test(name)) return false;
  return /\.(?:pkg|fpkg|ffpkg|vpk|prx|sprx|elf|self|bin|xex|nro|nsp|ovl|rpx|wuhb|dol|cia|3dsx|nds|wad|jar|zip|rar|7z|tar(?:\.gz|\.xz)?|exe|msi|dll|lua|gsc|gscc|csc|ctd)$/i.test(name);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    redirect: 'follow', signal: AbortSignal.timeout(45000),
    headers: { 'User-Agent': 'whatsite-local-update-check/1.0', Accept: '*/*' }, ...options
  });
  if (!response.ok) { await response.body?.cancel(); throw Error('HTTP ' + response.status + ' at ' + new URL(url).hostname); }
  return response;
}

function normalizeRelease(data) {
  return {
    tag: data.tag_name,
    publishedAt: data.published_at || data.created_at || null,
    updatedAt: data.updated_at || data.published_at || data.created_at || null,
    prerelease: Boolean(data.prerelease),
    revision: String(data.id || ''),
    assets: (data.assets || []).map(asset => ({
      name: asset.name, url: asset.browser_download_url,
      bytes: Number.isFinite(asset.size) ? asset.size : null,
      digest: /^sha256:[a-f0-9]{64}$/i.test(asset.digest || '') ? asset.digest.slice(7).toLowerCase() : null,
      updatedAt: asset.updated_at || null,
      revision: asset.id == null ? null : String(asset.id)
    })).filter(asset => asset.name && asset.url)
  };
}

async function releaseFromHtml(repo) {
  const base = 'https://github.com/' + repo;
  let response;
  try { response = await request(base + '/releases/latest'); }
  catch { response = await request(base + '/releases'); }
  const html = await response.text();
  let tag = releaseTag(response.url);
  if (!tag) {
    const escaped = repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = html.match(new RegExp('href="/' + escaped + '/releases/tag/([^"#?]+)"', 'i'));
    if (match) tag = decodeURIComponent(decode(match[1]));
  }
  if (!tag) throw Error('No public release was found');
  const assetHtml = await (await request(base + '/releases/expanded_assets/' + encodeURIComponent(tag))).text();
  const assets = new Map();
  for (const match of assetHtml.matchAll(/href="([^"]*\/releases\/download\/[^\"]+)"/g)) {
    const url = new URL(decode(match[1]), base).href;
    const rowStart = assetHtml.lastIndexOf('<li', match.index);
    const rowEnd = assetHtml.indexOf('</li>', match.index);
    const row = rowStart >= 0 && rowEnd >= 0 ? assetHtml.slice(rowStart, rowEnd) : '';
    assets.set(url, {
      name: decodeURIComponent(new URL(url).pathname.split('/').pop()), url,
      bytes: null, digest: null,
      updatedAt: row.match(/datetime="([^"]+)"/)?.[1] || null,
      revision: null
    });
  }
  return {
    tag, publishedAt: html.match(/<relative-time[^>]*datetime="([^"]+)"/)?.[1] || null,
    updatedAt: null, prerelease: /Pre-release/.test(html), revision: '',
    assets: [...assets.values()], discovery: 'public-release-page'
  };
}

async function latestRelease(repo) {
  const base = 'https://api.github.com/repos/' + repo;
  try { return normalizeRelease(await (await request(base + '/releases/latest')).json()); }
  catch (error) {
    // A project with only prereleases has no /latest stable release.
    if (/HTTP 404/.test(error.message)) {
      try {
        const releases = await (await request(base + '/releases?per_page=1')).json();
        if (Array.isArray(releases) && releases.length) return normalizeRelease(releases[0]);
      } catch { /* Continue through the project's normal public release page. */ }
    }
    return releaseFromHtml(repo);
  }
}

function sameAssetUrl(a, b) {
  try {
    const left = new URL(a), right = new URL(b);
    return left.hostname.toLowerCase() === right.hostname.toLowerCase() && decodeURIComponent(left.pathname) === decodeURIComponent(right.pathname);
  } catch { return false; }
}

function existingMatches(job, asset, release) {
  return job.items.flatMap(item => (item.files || []).map(file => ({ item, file }))).filter(({ item, file }) => {
    if (asset.digest && file.sha256 === asset.digest) return true;
    if (sameAssetUrl(file.resolvedUrl || '', asset.url)) return true;
    return file.name === asset.name && (file.releaseTag || item.release || releaseTag(file.resolvedUrl || '')) === release.tag;
  });
}

async function inspectAsset(job, asset, release) {
  const matches = existingMatches(job, asset, release).filter(({ file }) => file.backupPath && fs.existsSync(file.backupPath));
  if (!matches.length) return { ...asset, status: 'new', reason: 'No saved copy of this release asset' };
  if (asset.digest && matches.some(({ file }) => file.sha256 === asset.digest)) return { ...asset, status: 'current', reason: 'Published SHA-256 matches saved copy' };
  const known = matches.find(({ file }) => file.remoteRevision && file.remoteRevision === asset.revision && file.remoteUpdatedAt === asset.updatedAt);
  if (known) return { ...asset, status: 'current', reason: 'Release asset revision is unchanged' };
  let bytes = asset.bytes, modified = asset.updatedAt, etag = null;
  if (bytes == null || !modified) {
    try {
      const head = await request(asset.url, { method: 'HEAD' });
      if (head.headers.has('content-length')) bytes = Number(head.headers.get('content-length'));
      modified ||= head.headers.get('last-modified');
      etag = head.headers.get('etag');
    } catch (error) { return { ...asset, status: 'needs-review', reason: 'Saved copy exists; remote revision could not be verified: ' + error.message }; }
  }
  const newer = matches.every(({ file }) => {
    if (bytes != null && file.bytes !== bytes) return true;
    if (etag && file.remoteEtag) return etag !== file.remoteEtag;
    const localTime = file.downloadedAt ? Date.parse(file.downloadedAt) : fs.statSync(file.backupPath).mtimeMs;
    return modified && Date.parse(modified) > localTime + 2000;
  });
  if (newer) return { ...asset, bytes, updatedAt: modified, etag, status: 'updated', reason: 'Remote file size or modification revision changed' };
  if (bytes != null && modified) return { ...asset, bytes, updatedAt: modified, etag, status: 'current', reason: 'Saved release asset size and modification date match' };
  return { ...asset, status: 'needs-review', reason: 'Saved copy exists but remote metadata is insufficient' };
}

function assertInside(parent, target) {
  const boundary = path.resolve(parent) + path.sep, resolved = path.resolve(target);
  if (!resolved.startsWith(boundary)) throw Error('Target escapes archive folder');
  return resolved;
}

function verifySignature(file, name) {
  const fd = fs.openSync(file, 'r'), head = Buffer.alloc(8);
  try { fs.readSync(fd, head, 0, 8, 0); } finally { fs.closeSync(fd); }
  const checks = [[/\.(?:zip|vpk)$/i, '504b', 2], [/\.rar$/i, '52617221', 4], [/\.7z$/i, '377abcaf271c', 6], [/\.(?:exe|dll)$/i, '4d5a', 2], [/\.tar\.gz$/i, '1f8b', 2], [/\.tar\.xz$/i, 'fd377a585a00', 6]];
  for (const [pattern, magic, length] of checks) if (pattern.test(name) && head.subarray(0, length).toString('hex') !== magic) throw Error('Unexpected file signature for ' + name);
}

async function fileDigest(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file, { highWaterMark: 8 * 1024 * 1024 })) hash.update(chunk);
  return hash.digest('hex');
}

function saveExclusive(temp, directory, name, safeName = fallbackName) {
  assertInside(directory, temp);
  let destination = path.join(directory, name), suffix = 1;
  const extension = path.extname(name), stem = name.slice(0, name.length - extension.length);
  for (;;) {
    assertInside(directory, destination);
    try { fs.copyFileSync(temp, destination, fs.constants.COPYFILE_EXCL); break; }
    catch (error) { if (error.code !== 'EEXIST') throw error; destination = path.join(directory, safeName(stem + ' (' + ++suffix + ')' + extension)); }
  }
  // Only this invocation's partial copy is removed, after its data is saved
  // under an exclusive new name. Existing completed files are never removed.
  fs.unlinkSync(temp);
  return destination;
}

function preferredItem(job, inventory) {
  const release = job.items.find(item => /^\/[^/]+\/[^/]+\/releases(?:\/latest)?\/?$/.test(new URL(item.url).pathname) && item.kind !== 'github-source');
  if (release) return release;
  const url = 'https://github.com/' + job.repo + '/releases';
  let item = inventory.items.find(entry => entry.url === url);
  if (!item) {
    const original = job.items[0];
    item = { id: sha(url).slice(0, 12), url, kind: 'github-release', title: job.repo.split('/')[1], pages: [...new Set(job.items.flatMap(entry => entry.pages || []))], labels: ['Release updates'], status: 'pending', files: [],
      ...(original.platform ? {platform: original.platform} : {}), ...(original.category ? {category: original.category} : {}) };
    inventory.items.push(item);
  }
  return item;
}

async function downloadAsset(item, asset, release, job, backup) {
  const { layoutFor, safeName = fallbackName } = require('./download-archive-layout.cjs');
  const downloadedAt = new Date().toISOString();
  const stamp = String(asset.updatedAt || release.updatedAt || release.publishedAt || downloadedAt).replace(/[^\d]/g, '').slice(0, 14);
  const metadata = {
    name: safeName(asset.name), releaseTag: release.tag, release: release.tag,
    releaseDate: release.publishedAt, releaseRevision: stamp || release.revision,
    repo: job.repo, downloadedAt
  };
  const segments = layoutFor(item, metadata).map(safeName);
  // Always keep an explicit release revision, including edited nightly assets.
  const revisionFolder = safeName(release.tag + '--' + (stamp || release.revision || 'release'));
  if (!segments.includes(revisionFolder)) segments.push(revisionFolder);
  const directory = assertInside(path.join(backup, 'files'), path.join(backup, 'files', ...segments));
  fs.mkdirSync(directory, { recursive: true });
  const name = safeName(asset.name);
  const temp = assertInside(directory, path.join(directory, name + '.partial-' + crypto.randomBytes(6).toString('hex')));
  const response = await request(asset.url, { signal: AbortSignal.timeout(600000) });
  if (/text\/html|application\/json/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel(); throw Error('Download returned a web/error page');
  }
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temp, { flags: 'wx' }));
  const bytes = fs.statSync(temp).size;
  if (!bytes || asset.bytes != null && bytes !== asset.bytes) throw Error('Downloaded size differs from release metadata');
  verifySignature(temp, name);
  const digest = await fileDigest(temp);
  if (asset.digest && digest !== asset.digest) throw Error('Downloaded SHA-256 differs from the published digest');
  const destination = saveExclusive(temp, directory, name, safeName);
  return {
    ...metadata, name: path.basename(destination), originalName: asset.name,
    bytes, sha256: digest, resolvedUrl: asset.url, backupPath: destination,
    remoteRevision: asset.revision, remoteUpdatedAt: asset.updatedAt,
    remoteEtag: asset.etag || response.headers.get('etag') || null,
    updateSource: 'github-release'
  };
}

function optionsFrom(args) {
  const value = key => args.find(arg => arg.startsWith('--' + key + '='))?.slice(key.length + 3);
  return { download: args.includes('--download'), allTools: args.includes('--all-tools'), repo: value('repo'), backup: value('backup'), json: args.includes('--json'), help: args.includes('--help') };
}

function mergeUpdateInventory(latest, pending, changedIds) {
  const ids = new Set(changedIds);
  const items = (latest.items || []).map(item => ({...item}));
  for (const incoming of (pending.items || []).filter(item => ids.has(item.id))) {
    const index = items.findIndex(item => item.id === incoming.id);
    const old = index < 0 ? {} : items[index];
    const files = new Map();
    for (const file of [...(old.files || []), ...(incoming.files || [])]) {
      const key = [file.backupPath || '', file.sha256 || '', file.name || file.filename || ''].join('\0');
      files.set(key, {...files.get(key), ...file});
    }
    const item = {...incoming, ...old, files: [...files.values()],
      pages: [...new Set([...(old.pages || []), ...(incoming.pages || [])])],
      labels: [...new Set([...(old.labels || []), ...(incoming.labels || [])])],
      status: old.status === 'excluded' ? old.status : incoming.status,
      ...(incoming.release ? {release: incoming.release} : {})};
    if (index < 0) items.push(item); else items[index] = item;
  }
  return {...latest, items, updated: new Date().toISOString()};
}

function writeJsonAtomic(file, value) {
  const temporary = file + '.update-' + crypto.randomBytes(6).toString('hex') + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
  fs.renameSync(temporary, file);
}

function persist(inventory, backup, result, changedIds) {
  // A release check/download may take minutes. Re-read immediately before saving
  // and merge only downloaded records, retaining other chats' IDs and versions.
  const latest = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const merged = mergeUpdateInventory(latest, inventory, changedIds);
  writeJsonAtomic(inventoryPath, merged);
  fs.mkdirSync(backup, { recursive: true });
  const backupInventory = path.join(backup, 'download-inventory.json');
  const saved = fs.existsSync(backupInventory) ? JSON.parse(fs.readFileSync(backupInventory, 'utf8')) : {items: []};
  // Apply the same own-file delta to the latest backup inventory. Do not replay
  // unrelated local records or old file metadata over another writer's work.
  writeJsonAtomic(backupInventory, mergeUpdateInventory(saved, inventory, changedIds));
  fs.mkdirSync(path.join(backup, 'updates'), { recursive: true });
  const stamp = result.checkedAt.replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(backup, 'updates', 'check-' + stamp + '.json'), JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(path.join(backup, 'updates', 'latest-check.json'), JSON.stringify(result, null, 2) + '\n');
}

async function main(args = process.argv.slice(2)) {
  const options = optionsFrom(args);
  if (options.help) {
    console.log('node scripts/update-local-downloads.cjs [--check] [--download] [--all-tools] [--repo=owner/repo] [--backup=F:/whatsite-backup-downloads-etc] [--json]');
    console.log('Default: check console GitHub releases only. --download saves new builds and retains every older version. Non-GitHub links require publisher/manual review.');
    return;
  }
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const changedIds = new Set();
  const pendingItems = new Map();
  const backup = path.resolve(options.backup || inventory.backupRoot || 'F:/whatsite-backup-downloads-etc');
  if (backup === path.parse(backup).root) throw Error('A dedicated backup directory is required');
  const jobs = collectRepositories(inventory, options);
  if (options.repo && !jobs.length) throw Error('Repository is not part of the selected archive scope');
  const result = { checkedAt: new Date().toISOString(), mode: options.download ? 'download' : 'check', scope: options.allTools ? 'all-tools' : 'console-tools', repositories: [], manualSources: [], downloadedFiles: 0 };
  for (const job of jobs) {
    const entry = { repo: job.repo, pinnedWebsiteTags: [...job.pinnedTags], assets: [] };
    try {
      const release = await latestRelease(job.repo);
      entry.latestTag = release.tag; entry.publishedAt = release.publishedAt; entry.prerelease = release.prerelease;
      const assets = release.assets.filter(asset => isReadyAsset(asset.name, options));
      if (!assets.length) { entry.status = 'no-installable-assets'; entry.reason = 'No ready-to-use assets matched the selected platforms; source archives are not cloned'; }
      else {
        for (const asset of assets) {
          const checked = await inspectAsset(job, asset, release);
          if (options.download && ['new', 'updated'].includes(checked.status)) {
            try {
              const item = preferredItem(job, inventory);
              const saved = await downloadAsset(item, checked, release, job, backup);
              item.files ||= []; item.files.push(saved); item.status = 'downloaded'; item.release = release.tag;
              changedIds.add(item.id);
              const pending = pendingItems.get(item.id) || {...item, files: []};
              pending.files.push(saved); pending.status = 'downloaded'; pending.release = release.tag;
              pendingItems.set(item.id, pending);
              checked.status = 'downloaded'; checked.sha256 = saved.sha256; checked.bytes = saved.bytes;
              result.downloadedFiles++;
              // Persist each completed file so an interruption never loses its inventory.
              persist({items: [...pendingItems.values()]}, backup, result, changedIds);
            } catch (error) { checked.status = 'download-failed'; checked.reason = error.message; }
          }
          entry.assets.push(checked);
        }
        entry.status = entry.assets.some(asset => ['new', 'updated'].includes(asset.status)) ? 'updates-available'
          : entry.assets.some(asset => asset.status === 'download-failed') ? 'download-failed'
          : entry.assets.some(asset => asset.status === 'needs-review') ? 'needs-review' : 'current';
        if (entry.assets.some(asset => asset.status === 'downloaded')) entry.status = entry.status === 'current' ? 'downloaded' : entry.status;
      }
    } catch (error) { entry.status = 'unavailable'; entry.reason = error.message; }
    result.repositories.push(entry);
    if (!options.json) console.log(job.repo + ': ' + (entry.latestTag || 'no release') + ' — ' + entry.status + (entry.reason ? ' (' + entry.reason + ')' : ''));
  }
  const githubItems = new Set(jobs.flatMap(job => job.items));
  result.manualSources = (inventory.items || []).filter(item => !githubItems.has(item) && !['excluded', 'reference'].includes(item.status) && item.kind !== 'bstlar' && item.publication !== 'private-review' && (options.allTools || (item.pages || []).some(consolePage)))
    .map(item => ({ title: item.title, url: item.url, reason: 'No automatic GitHub release feed; inspect the original publisher/download page for a new link' }));
  if (options.download) persist({items: [...pendingItems.values()]}, backup, result, changedIds);
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else console.log('Checked ' + jobs.length + ' repositories; saved ' + result.downloadedFiles + ' new files. ' + result.manualSources.length + ' non-GitHub source links require manual review. Older versions and website compatibility links were preserved.');
  return result;
}

module.exports = { consolePage, githubRepo, releaseTag, collectRepositories, isReadyAsset, normalizeRelease, sameAssetUrl, existingMatches, inspectAsset, assertInside, verifySignature, saveExclusive, preferredItem, mergeUpdateInventory, optionsFrom, main };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
