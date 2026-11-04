// Download only requested source snapshots. Never builds or executes archive contents.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {Readable, Transform} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const {destinationForFile} = require('./download-archive-layout.cjs');
const {MAX_MIRROR_BYTES} = require('./download-mirror-policy.cjs');
const root = path.resolve(__dirname, '..');
const backup = path.resolve('F:/whatsite-backup-downloads-etc');
const catalogPath = path.join(root, 'docs/gta5-pc-source-catalog.json');
const manifestPath = path.join(root, 'downloads/source-codes/gta5-pc/manifest.json');
const args = process.argv.slice(2);
if (args.some(arg => !['--download', '--archive'].includes(arg) && !/^--skip=[a-z0-9-]+$/.test(arg))) throw Error('Use --download, --archive and optional --skip=<project-id>.');
const skipped = new Set(args.filter(arg => arg.startsWith('--skip=')).map(arg => arg.slice(7)));
const read = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
function within(base, file) {
  const absolute = path.resolve(file), relative = path.relative(base, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Destination outside root: ' + absolute);
  let parent = absolute;
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  const realBase = fs.realpathSync(base), realParent = fs.realpathSync(parent);
  const realRelative = path.relative(realBase, realParent);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw Error('Destination resolves outside root');
  return absolute;
}
async function fileInfo(file) {
  const digest = crypto.createHash('sha256'); let bytes = 0;
  for await (const chunk of fs.createReadStream(file)) { digest.update(chunk); bytes += chunk.length; }
  return {bytes, sha256: digest.digest('hex')};
}
async function immutableCopy(file, source, expected, base = root) {
  within(base, file);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  if (fs.existsSync(file)) {
    const current = await fileInfo(file);
    if (current.bytes !== expected.bytes || current.sha256 !== expected.sha256) throw Error('Refusing to replace different archive: ' + file);
  } else fs.copyFileSync(source, file, fs.constants.COPYFILE_EXCL);
}
function json(file, value) { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
async function download(url, project) {
  const response = await fetch(url, {headers: {'User-Agent': 'whatsite-source-archive'}, signal: AbortSignal.timeout(project.timeoutMs || 1800000)});
  if (!response.ok) throw Error('HTTP ' + response.status + ': ' + url);
  const max = project.maxBytes || 512 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > max) throw Error('Source ZIP exceeds limit');
  const directory = path.join(root, 'tmp/gta5-source-downloads'); fs.mkdirSync(directory, {recursive: true});
  const staged = path.join(directory, project.id + '-' + project.commit.slice(0, 12) + '-' + Date.now() + '.partial');
  let length = 0, reported = 0;
  const digest = crypto.createHash('sha256');
  const meter = new Transform({transform(chunk, encoding, callback) {
    length += chunk.length;
    if (length > max) return callback(Error('Source ZIP exceeds limit; partial retained at ' + staged));
    digest.update(chunk);
    if (length - reported >= 25 * 1024 * 1024) { reported = length; console.log(project.title + ': received ' + Math.round(length / 1048576) + ' MiB'); }
    callback(null, chunk);
  }});
  await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(staged, {flags: 'wx'}));
  const descriptor = fs.openSync(staged, 'r');
  try {
    const header = Buffer.alloc(4), tail = Buffer.alloc(Math.min(length, 65557));
    fs.readSync(descriptor, header, 0, 4, 0); fs.readSync(descriptor, tail, 0, tail.length, length - tail.length);
    const end = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (length < 22 || header.readUInt32LE(0) !== 0x04034b50 || end < 0 || end + 22 > tail.length || end + 22 + tail.readUInt16LE(end + 20) !== tail.length) throw Error('Not a complete ZIP; partial retained at ' + staged);
  } finally { fs.closeSync(descriptor); }
  return {staged, bytes: length, sha256: digest.digest('hex'), resolvedUrl: response.url};
}
async function main() {
  const catalog = read(catalogPath);
  if (!catalog?.projects?.length) throw Error('Prepare the reviewed source catalogue first.');
  const manifest = read(manifestPath, {schemaVersion: 1, files: []});
  for (const project of catalog.projects) {
    if (skipped.has(project.id)) continue;
    if (project.status === 'empty' || !project.commit) {
      const status = project.status === 'empty' ? 'empty' : 'unavailable';
      const reason = project.availabilityNote || (status === 'empty' ? 'No committed files.' : 'No accessible branch snapshot.');
      if (!manifest.files.some(file => file.id === project.id && file.status === status && file.commit === null)) manifest.files.push({id: project.id, repo: project.repo, branch: project.branch, commit: null, edition: project.edition, status, sourceUrl: project.branchUrl, checkedAt: new Date().toISOString(), error: reason});
      json(manifestPath, manifest);
      if (args.includes('--archive')) {
        const auditPath = path.join(root, 'docs/download-audit.json'), audit = read(auditPath), id = 'gta5-pc-source-' + project.id + '-' + status;
        if (!audit.items.some(item => item.id === id)) audit.items.push({id, title: project.title, url: project.branchUrl, kind: 'github-source', platform: 'PC', category: ['Games', 'GTA5', project.edition], pages: ['source-codes/pc/gta5/index.html'], labels: [], status: status === 'empty' ? 'reference' : 'unavailable', reason, error: reason, files: [], sourceUrls: [project.branchUrl]});
        json(auditPath, audit);
      }
      console.log(project.title + ': ' + status + '; no snapshot invented');
      continue;
    }
    if (!/^[a-z0-9-]+$/.test(project.id) || !/^[a-f0-9]{40}$/.test(project.commit) || !['Legacy', 'Enhanced'].includes(project.edition)) throw Error('Invalid source metadata');
    const url = `https://codeload.github.com/${project.repo}/zip/${project.commit}`;
    const filename = project.repo.split('/')[1] + '-' + project.commit.slice(0, 12) + '-source.zip';
    const local = '/downloads/source-codes/gta5-pc/' + project.id + '/' + filename;
    const absolute = within(root, path.join(root, local));
    let record = manifest.files.find(file => file.id === project.id && file.commit === project.commit);
    let sourceFile = absolute;
    if (record?.bytes >= MAX_MIRROR_BYTES && record.backupPath && fs.existsSync(record.backupPath)) {
      sourceFile = within(backup, record.backupPath);
      const info = await fileInfo(sourceFile);
      if (info.bytes !== record.bytes || info.sha256 !== record.sha256) throw Error('Archived source snapshot hash changed: ' + project.id);
    } else if (!fs.existsSync(absolute)) {
      if (!args.includes('--download')) throw Error('Source snapshot not downloaded: ' + project.id);
      try {
        const downloaded = await download(url, project);
        if (downloaded.bytes < MAX_MIRROR_BYTES) await immutableCopy(absolute, downloaded.staged, downloaded);
        else sourceFile = downloaded.staged; // Keep large originals outside public Git content.
        record = {id: project.id, repo: project.repo, branch: project.branch, commit: project.commit, edition: project.edition, status: 'downloaded', name: filename, local, bytes: downloaded.bytes, sha256: downloaded.sha256, sourceUrl: url, resolvedUrl: downloaded.resolvedUrl, version: project.branch + '-' + project.commit.slice(0, 12), archivedAt: new Date().toISOString(), archiveRole: ['Source Code']};
      } catch (error) {
        const attempt = {id: project.id, commit: project.commit, status: 'unavailable', sourceUrl: url, checkedAt: new Date().toISOString(), error: error.message};
        manifest.files.push(attempt); json(manifestPath, manifest); console.log(project.id + ': ' + error.message); continue;
      }
    } else {
      const info = await fileInfo(absolute);
      if (record?.sha256 && info.sha256 !== record.sha256) throw Error('Existing snapshot hash changed: ' + project.id);
      record = {...record, id: project.id, repo: project.repo, branch: project.branch, commit: project.commit, edition: project.edition, status: 'downloaded', name: filename, local, ...info, sourceUrl: record?.sourceUrl || url, resolvedUrl: record?.resolvedUrl || url, version: project.branch + '-' + project.commit.slice(0, 12), archivedAt: record?.archivedAt || new Date().toISOString(), archiveRole: ['Source Code']};
    }
    const itemId = 'gta5-pc-source-' + project.id + '-' + project.commit.slice(0, 12);
    const item = {id: itemId, title: project.title + ' source code · GTA 5 ' + project.edition, project: project.title, url: project.branchUrl, kind: 'github-source', platform: 'PC', category: ['Games', 'GTA5', project.edition], archiveRole: ['Source Code'], release: record.version, edition: project.edition, repository: project.repo, branch: project.branch, commit: project.commit, pages: ['source-codes/pc/gta5/index.html'], labels: ['Download source ZIP'], status: 'downloaded', sourceUrls: [project.branchUrl, project.commitUrl, url, ...(project.requestedUrl ? [project.requestedUrl] : [])], files: []};
    record.inventoryId = itemId;
    if (args.includes('--archive')) {
      if (!fs.existsSync(backup)) throw Error('F: backup root unavailable');
      const archiveFile = {...record, releaseTag: record.version};
      const destination = within(backup, destinationForFile(backup, item, archiveFile));
      await immutableCopy(destination, sourceFile, record, backup);
      const archived = await fileInfo(destination);
      if (archived.bytes !== record.bytes || archived.sha256 !== record.sha256) throw Error('Archive verification failed');
      record.backupPath = destination;
      item.files = [{...record, releaseTag: record.version, archiveAvailability: 'present', archiveCheckedAt: new Date().toISOString()}];
      // Reload immediately before saving so other chats' inventory entries survive.
      const auditPath = path.join(root, 'docs/download-audit.json'), audit = read(auditPath);
      const existing = audit.items.find(entry => entry.id === itemId);
      if (existing) {
        Object.assign(existing, {...item, files: [...(existing.files || []), ...item.files.filter(file => !existing.files?.some(saved => saved.sha256 === file.sha256 && saved.backupPath === file.backupPath))]});
      } else audit.items.push(item);
      audit.updated = new Date().toISOString(); json(auditPath, audit);
    }
    const index = manifest.files.findIndex(file => file.id === project.id && file.commit === project.commit && file.status === 'downloaded');
    if (index < 0) manifest.files.push(record); else manifest.files[index] = record;
    manifest.updatedAt = new Date().toISOString(); json(manifestPath, manifest);
    console.log(project.title + ': ' + record.bytes + ' bytes' + (record.backupPath ? ', F: SHA-256 verified' : ', staged locally'));
  }
  if (catalog.projects.some(project => !skipped.has(project.id) && project.status !== 'empty' && project.commit && !manifest.files.some(file => file.id === project.id && file.commit === project.commit && file.status === 'downloaded' && (!args.includes('--archive') || file.backupPath)))) process.exitCode = 1;
}
if (require.main === module) main().catch(error => {console.error(error); process.exitCode = 1;});
module.exports = {download, fileInfo, within};
