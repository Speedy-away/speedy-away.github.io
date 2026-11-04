/**
 * Scoped archive intake for cooperating console-expansion chats.
 * No network, no execution of downloaded files, and no writes on import.
 * See docs/console-expansion-archive-helper.md for the public API and CLI.
 */
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {pipeline} = require('node:stream/promises');
const {Transform} = require('node:stream');
const {destinationForFile, safeName, roleFor} = require('./download-archive-layout.cjs');

const DEFAULT_WORKSPACE = path.resolve(__dirname, '..');
const DEFAULT_BACKUP = path.resolve('F:/whatsite-backup-downloads-etc');
const hashBytes = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const random = () => crypto.randomBytes(12).toString('hex');
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function union(a = [], b = [], key = canonical) {
  const rows = new Map(a.map(row => [key(row), clone(row)]));
  for (const row of b) {
    const id = key(row);
    rows.set(id, rows.has(id) && row && typeof row === 'object' && !Array.isArray(row) ? deepMerge(rows.get(id), row) : clone(row));
  }
  return [...rows.values()];
}
function fileIdentity(file) {
  return canonical([file.backupPath || '', file.sha256 || '', file.name || file.filename || '', file.version || file.releaseTag || '', file.sourceUrl || file.resolvedUrl || '']);
}
function deepMerge(a, b, field = '') {
  if (b === undefined) return clone(a);
  if (a === undefined) return clone(b);
  if (Array.isArray(a) && Array.isArray(b)) {
    if (field === 'items') return union(a, b, row => row.id || canonical(row));
    if (field === 'files') return union(a, b, fileIdentity);
    return union(a, b);
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const result = {...a};
    for (const [key, value] of Object.entries(b)) result[key] = key in result ? deepMerge(result[key], value, key) : clone(value);
    return result;
  }
  return clone(b);
}
function mergeReports(...reports) {
  let merged = {items: []};
  for (const report of reports) merged = deepMerge(merged, report || {});
  return merged;
}

// Check lexical containment AND the resolved nearest existing ancestor. This also
// rejects symlinks/junctions through which an otherwise local path escapes.
function contained(base, file) {
  const absoluteBase = path.resolve(base), absolute = path.resolve(file);
  const relative = path.relative(absoluteBase, absolute);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw Error('Path escapes intended root: ' + absolute);
  let ancestor = absolute;
  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw Error('No existing ancestor for path');
    ancestor = parent;
  }
  if (fs.existsSync(absoluteBase)) {
    const realRelative = path.relative(fs.realpathSync(absoluteBase), fs.realpathSync(ancestor));
    if (realRelative === '..' || realRelative.startsWith('..' + path.sep) || path.isAbsolute(realRelative)) throw Error('Path resolves outside intended root: ' + absolute);
  }
  return absolute;
}
function readSnapshot(base, file) {
  contained(base, file);
  if (!fs.existsSync(file)) return {exists: false, bytes: Buffer.alloc(0), digest: 'absent', report: {items: []}};
  const bytes = fs.readFileSync(file);
  const report = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw Error('Inventory must be a JSON object: ' + file);
  return {exists: true, bytes, digest: hashBytes(bytes), report};
}
async function hashFile(file) {
  const hash = crypto.createHash('sha256'); let bytes = 0;
  for await (const chunk of fs.createReadStream(file)) { bytes += chunk.length; hash.update(chunk); }
  return {bytes, sha256: hash.digest('hex')};
}
function sourceUrl(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw Error('Use an original public HTTP(S) source URL without credentials');
  return url.href;
}
function validateScope(scope) {
  if (typeof scope !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(scope)) throw Error('Scope must be a lowercase ASCII slug, up to 80 characters');
  return scope;
}
function validateItem(item, scope) {
  validateScope(scope);
  if (!item || typeof item.id !== 'string' || !item.id.startsWith(scope + '-') || !/^[a-zA-Z0-9_.-]{1,180}$/.test(item.id)) throw Error('Item id must start with scope + "-" and be a stable ASCII identifier');
  for (const key of ['title', 'platform']) if (typeof item[key] !== 'string' || !item[key].trim()) throw Error('Item needs ' + key);
  const categories = Array.isArray(item.category) ? item.category : [item.category];
  if (!categories.length || categories.some(value => typeof value !== 'string' || !value.trim())) throw Error('Item needs an explicit category or category array');
  if (item.url) sourceUrl(item.url);
  return clone(item);
}
function normalizedFile(item, file) {
  if (!file || typeof file.name !== 'string' || !file.name || /[\\/:\x00-\x1f]/.test(file.name) || ['.', '..'].includes(file.name)) throw Error('File name must be a basename, not a path');
  const version = file.version || file.releaseTag;
  if (typeof version !== 'string' || !version.trim()) throw Error('File needs an explicit version (or a named snapshot)');
  const result = {...clone(file), name: safeName(file.name), version, releaseTag: version, sourceUrl: sourceUrl(file.sourceUrl), archivedAt: new Date().toISOString()};
  result.archiveRole = roleFor(item, result);
  if (file.expectedSha256 && !/^[a-f0-9]{64}$/i.test(file.expectedSha256)) throw Error('Invalid expected SHA-256');
  if (file.expectedBytes !== undefined && (!Number.isSafeInteger(file.expectedBytes) || file.expectedBytes < 0)) throw Error('Invalid expected byte count');
  if (result.name !== file.name) result.originalName = file.name;
  delete result.expectedSha256; delete result.expectedBytes;
  return result;
}
function verifyExpected(actual, expected) {
  if (expected.expectedBytes !== undefined && actual.bytes !== expected.expectedBytes) throw Error('File size differs from the expected release metadata');
  if (expected.expectedSha256 && actual.sha256 !== expected.expectedSha256.toLowerCase()) throw Error('File SHA-256 differs from the expected release metadata');
}
function publicFile(file) {
  const result = {name: file.name, version: file.version || file.releaseTag, bytes: file.bytes, sha256: file.sha256, sourceUrl: file.sourceUrl, archiveRole: file.archiveRole};
  if (file.local) {
    if (typeof file.local !== 'string' || !file.local.startsWith('/downloads/') || /[\\?#]/.test(file.local) || decodeURIComponent(file.local).split('/').some(part => part === '..' || part === '.')) throw Error('Public local file must be a /downloads/ path without traversal');
    result.local = file.local;
  }
  return result;
}

function createArchive(options = {}) {
  const workspaceRoot = path.resolve(options.workspaceRoot || DEFAULT_WORKSPACE);
  const backupRoot = path.resolve(options.backupRoot || DEFAULT_BACKUP);
  const lockTimeoutMs = options.lockTimeoutMs ?? 30000;
  const lockPollMs = options.lockPollMs ?? 40;
  const docs = contained(workspaceRoot, path.join(workspaceRoot, 'docs'));
  const ledgerRoot = contained(workspaceRoot, path.join(docs, '.console-expansion-private-inventory'));
  const workspaceLock = contained(workspaceRoot, path.join(workspaceRoot, '.console-expansion-intake.lock'));
  const backupLock = contained(backupRoot, path.join(backupRoot, '.console-expansion-intake.lock'));
  const auditFile = contained(workspaceRoot, path.join(docs, 'download-audit.json'));
  const backupInventory = contained(backupRoot, path.join(backupRoot, 'download-inventory.json'));
  const historyRoot = contained(backupRoot, path.join(backupRoot, 'archive-history/console-expansion-intake'));
  function inventoryPath(scope) { return contained(workspaceRoot, path.join(docs, validateScope(scope) + '-private-inventory.json')); }
  function requireBackup() { if (!fs.existsSync(backupRoot) || !fs.statSync(backupRoot).isDirectory()) throw Error('Existing local archive is unavailable: ' + backupRoot); }
  async function lock(base, file, operation) {
    contained(base, file); const token = random(), started = Date.now(); let handle;
    while (!handle) {
      try { handle = await fsp.open(file, 'wx'); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (Date.now() - started >= lockTimeoutMs) throw Error('Archive intake lock is busy; retry after the cooperating writer finishes: ' + file);
        await sleep(lockPollMs);
      }
    }
    try {
      await handle.writeFile(JSON.stringify({pid: process.pid, token, createdAt: new Date().toISOString()}));
      return await operation();
    } finally {
      await handle.close();
      // Only remove this helper's own ephemeral coordination token, never a build.
      if (fs.existsSync(file) && JSON.parse(fs.readFileSync(contained(base, file), 'utf8')).token === token) fs.unlinkSync(file);
    }
  }
  function immutable(base, directory, label, bytes) {
    contained(base, directory); fs.mkdirSync(directory, {recursive: true});
    const name = label + '-' + hashBytes(bytes) + '.json', file = contained(base, path.join(directory, name));
    try { fs.writeFileSync(file, bytes, {flag: 'wx'}); }
    catch (error) { if (error.code !== 'EEXIST' || hashBytes(fs.readFileSync(file)) !== hashBytes(bytes)) throw error; }
    return file;
  }
  function writeMaterialized(base, target, report, previous) {
    contained(base, target); fs.mkdirSync(path.dirname(target), {recursive: true});
    const temp = contained(base, target + '.intake-' + random() + '.tmp');
    fs.writeFileSync(temp, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
    const current = readSnapshot(base, target);
    if (previous && current.digest !== previous.digest) {
      // The temporary file is our own unpublished metadata, not a download.
      fs.unlinkSync(temp); return {changed: current};
    }
    fs.renameSync(temp, target);
    return {written: true};
  }
  function discoverSidecars() {
    const files = fs.existsSync(docs) ? fs.readdirSync(docs).filter(name => /^[a-z0-9][a-z0-9-]*-private-inventory\.json$/.test(name)).map(name => contained(workspaceRoot, path.join(docs, name))) : [];
    if (fs.existsSync(ledgerRoot)) for (const scope of fs.readdirSync(ledgerRoot, {withFileTypes: true})) {
      if (!scope.isDirectory()) continue;
      const dir = contained(workspaceRoot, path.join(ledgerRoot, scope.name));
      for (const name of fs.readdirSync(dir)) if (name.endsWith('.json')) files.push(contained(workspaceRoot, path.join(dir, name)));
    }
    return files;
  }
  function incomingReports(explicit) {
    const files = [...new Set([...discoverSidecars(), ...(explicit ? [explicit] : [])])];
    return files.map(file => ({file, ...readSnapshot(workspaceRoot, file)}));
  }
  async function validateReport(report, verifyFiles = false) {
    if (!report.scope || !Array.isArray(report.items)) throw Error('Scoped sidecar needs scope and items');
    validateScope(report.scope);
    for (const item of report.items) {
      validateItem(item, report.scope);
      if (item.files !== undefined && !Array.isArray(item.files)) throw Error('Item files must be an array');
      for (const file of item.files || []) {
        if (!file.backupPath || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/i.test(file.sha256 || '') || !(file.version || file.releaseTag)) throw Error('Sidecar file needs backupPath, bytes, SHA-256 and version');
        sourceUrl(file.sourceUrl || file.resolvedUrl);
        const archived = contained(backupRoot, file.backupPath);
        if (!fs.existsSync(archived) || !fs.statSync(archived).isFile() || fs.statSync(archived).size !== file.bytes) throw Error('Sidecar archive file missing or size differs: ' + archived);
        if (verifyFiles && (await hashFile(archived)).sha256 !== file.sha256.toLowerCase()) throw Error('Sidecar archive SHA-256 mismatch: ' + archived);
      }
    }
  }
  async function appendInventory({scope, items, publicFiles = []}) {
    validateScope(scope);
    const event = {schemaVersion: 1, scope, updated: new Date().toISOString(), items: clone(items), publicFiles: clone(publicFiles)};
    await validateReport(event, false);
    fs.mkdirSync(docs, {recursive: true});
    return lock(workspaceRoot, workspaceLock, async () => {
      const eventDir = contained(workspaceRoot, path.join(ledgerRoot, scope));
      immutable(workspaceRoot, eventDir, Date.now() + '-' + random(), Buffer.from(JSON.stringify(event, null, 2) + '\n'));
      const target = inventoryPath(scope);
      const reports = incomingReports(target).filter(row => row.report.scope === scope).map(row => row.report);
      const merged = mergeReports(...reports, event); merged.scope = scope; merged.updated = event.updated;
      const previous = readSnapshot(workspaceRoot, target);
      const written = writeMaterialized(workspaceRoot, target, merged, previous);
      if (!written.written) throw Error('Non-cooperating writer changed scoped sidecar; immutable intake event preserved; rerun merge');
      return target;
    });
  }
  async function preservedWrite(target, actual, writer) {
    contained(backupRoot, target); fs.mkdirSync(path.dirname(target), {recursive: true});
    const extension = path.extname(target), stem = extension ? target.slice(0, -extension.length) : target;
    let candidate = target;
    for (let attempt = 0; attempt < 8; attempt++) {
      contained(backupRoot, candidate);
      if (fs.existsSync(candidate)) {
        const existing = await hashFile(candidate);
        if (existing.bytes === actual.bytes && existing.sha256 === actual.sha256) return {backupPath: candidate, reused: true};
        candidate = stem + '-' + actual.sha256.slice(0, 16) + (attempt ? '-' + random() : '') + extension;
        continue;
      }
      try {
        const handle = await fsp.open(candidate, 'wx');
        try { await writer(handle); } finally { await handle.close(); }
        return {backupPath: candidate, reused: false};
      } catch (error) {
        if (error.code === 'EEXIST') continue;
        error.preservedPartialPath = candidate; throw error;
      }
    }
    throw Error('Could not reserve a unique archive destination');
  }
  async function finish(scope, item, file, actual, writer) {
    requireBackup();
    publicFile(file); // Validate any public URL before touching the archive.
    const destination = contained(backupRoot, destinationForFile(backupRoot, item, file));
    const saved = await preservedWrite(destination, actual, writer);
    const completed = {...file, bytes: actual.bytes, sha256: actual.sha256, backupPath: saved.backupPath};
    const resultItem = {...item, files: union(item.files || [], [completed], fileIdentity), sourceUrls: [...new Set([...(item.sourceUrls || []), item.url, completed.sourceUrl].filter(Boolean))], status: 'downloaded'};
    const publicMetadata = {...publicFile(completed), itemId: item.id, platform: item.platform, category: item.category};
    const inventory = await appendInventory({scope, items: [resultItem], publicFiles: [publicMetadata]});
    return {item: resultItem, file: completed, publicFile: publicMetadata, inventory, reused: saved.reused};
  }
  async function writeBytes({scope, item: itemInput, file: fileInput, bytes}) {
    const item = validateItem(itemInput, scope), file = normalizedFile(item, fileInput);
    if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) throw Error('writeBytes expects Buffer or Uint8Array');
    const data = Buffer.from(bytes), actual = {bytes: data.length, sha256: hashBytes(data)}; verifyExpected(actual, fileInput);
    return finish(scope, item, file, actual, async handle => { await handle.writeFile(data); });
  }
  async function archiveFile({scope, item: itemInput, file: fileInput, sourceFile}) {
    const item = validateItem(itemInput, scope), file = normalizedFile(item, fileInput);
    if (typeof sourceFile !== 'string' || !fs.statSync(sourceFile).isFile()) throw Error('archiveFile needs an existing regular source file');
    const original = fs.statSync(sourceFile), actual = await hashFile(sourceFile); verifyExpected(actual, fileInput);
    return finish(scope, item, file, actual, async handle => {
      const hash = crypto.createHash('sha256'); let bytes = 0;
      const meter = new Transform({transform(chunk, encoding, callback) { bytes += chunk.length; hash.update(chunk); callback(null, chunk); }});
      // autoClose:false leaves handle lifecycle to preservedWrite; no build is run.
      await pipeline(fs.createReadStream(sourceFile), meter, fs.createWriteStream('', {fd: handle.fd, autoClose: false}));
      const current = fs.statSync(sourceFile);
      if (bytes !== actual.bytes || hash.digest('hex') !== actual.sha256 || current.size !== original.size || current.mtimeMs !== original.mtimeMs) throw Error('Source changed while archiving; partial preserved and not inventoried');
    });
  }
  async function mergeInventory({inventory, verifyFiles = false, checkOnly = false} = {}) {
    requireBackup();
    const explicit = inventory ? contained(workspaceRoot, path.resolve(workspaceRoot, inventory)) : undefined;
    if (explicit && !/-private-inventory\.json$/.test(path.basename(explicit))) throw Error('Intake path must be a scoped *-private-inventory.json sidecar');
    if (explicit && !fs.existsSync(explicit)) throw Error('Scoped sidecar is unavailable: ' + explicit);
    const snapshots = incomingReports(explicit);
    if (!snapshots.length) throw Error('No scoped intake sidecars or immutable intake events found');
    // Potentially expensive hashing happens before either coordination lock.
    const verified = new Map();
    for (const row of snapshots) {
      const key = canonical(row.report);
      if (!verified.has(key)) { await validateReport(row.report, verifyFiles); verified.set(key, true); }
    }
    const historyReports = fs.existsSync(historyRoot) ? fs.readdirSync(historyRoot).filter(name => name.endsWith('.json')).map(name => readSnapshot(backupRoot, contained(backupRoot, path.join(historyRoot, name))).report) : [];
    const combined = mergeReports(...snapshots.map(row => row.report));
    if (checkOnly) return {checkOnly: true, sidecars: snapshots.length, items: combined.items.length, files: combined.items.reduce((n, item) => n + (item.files || []).length, 0)};
    return lock(workspaceRoot, workspaceLock, () => lock(backupRoot, backupLock, async () => {
      const fresh = incomingReports(explicit);
      const originalDigests = new Map(snapshots.map(row => [row.file, row.digest]));
      if (fresh.some(row => originalDigests.get(row.file) !== row.digest) || fresh.length !== snapshots.length) throw Error('Intake changed during validation; retry merge (all scoped events are preserved)');
      const history = historyRoot;
      fs.mkdirSync(history, {recursive: true});
      const intakeItems = fresh.map(row => ({items: row.report.items}));
      let universe = mergeReports(...historyReports, readSnapshot(workspaceRoot, auditFile).report, readSnapshot(backupRoot, backupInventory).report, ...intakeItems);
      // Archive only metadata snapshots. No existing build/version is changed.
      const saveSnapshot = (label, snapshot) => { if (snapshot.exists) immutable(backupRoot, history, label, snapshot.bytes); };
      for (const [base, target, label] of [[workspaceRoot, auditFile, 'workspace'], [backupRoot, backupInventory, 'backup']]) {
        let wrote = false;
        for (let attempt = 0; attempt < 8; attempt++) {
          const before = readSnapshot(base, target); saveSnapshot(label, before);
          // Re-read both inventories, then compare the target immediately before
          // its atomic rename, preserving intervening legacy-writer metadata.
          universe = mergeReports(universe, readSnapshot(workspaceRoot, auditFile).report, readSnapshot(backupRoot, backupInventory).report, before.report, ...intakeItems);
          universe.updated = new Date().toISOString(); universe.backupRoot = backupRoot;
          const result = writeMaterialized(base, target, universe, before);
          if (result.written) { wrote = true; break; }
          saveSnapshot(label + '-concurrent', result.changed); universe = mergeReports(universe, result.changed.report);
        }
        if (!wrote) throw Error('Legacy writer kept changing inventory; immutable sidecars and snapshots retained; retry after it finishes');
      }
      // The latest union is itself durable even if a legacy writer subsequently
      // ignores the lock and replaces either materialized global inventory.
      immutable(backupRoot, history, 'merged', Buffer.from(JSON.stringify(universe, null, 2) + '\n'));
      return {sidecars: fresh.length, items: universe.items.length, files: universe.items.reduce((n, item) => n + (item.files || []).length, 0), inventory: backupInventory, workspaceAudit: auditFile};
    }));
  }
  return {archiveFile, writeBytes, appendInventory, mergeInventory, inventoryPath, workspaceRoot, backupRoot};
}

async function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) { console.log('node scripts/console-expansion-archive.cjs [--inventory=docs/<scope>-private-inventory.json | --all] [--check] [--verify]\nNo downloads or payload execution. Default action merges all durable scoped intake records into the two latest inventories.'); return; }
  if (args.some(arg => !['--all', '--check', '--verify'].includes(arg) && !arg.startsWith('--inventory='))) throw Error('Unknown archive intake option; use --help');
  const inventory = args.find(arg => arg.startsWith('--inventory='))?.slice('--inventory='.length);
  if (!inventory && !args.includes('--all')) throw Error('Provide --inventory=docs/<scope>-private-inventory.json or --all');
  const result = await createArchive().mergeInventory({inventory, verifyFiles: args.includes('--verify'), checkOnly: args.includes('--check')});
  console.log(JSON.stringify(result));
}
module.exports = {createArchive, mergeReports, contained, hashFile, publicFile, main};
if (require.main === module) main().catch(error => { console.error(error.message); if (error.preservedPartialPath) console.error('Preserved incomplete copy: ' + error.preservedPartialPath); process.exitCode = 1; });
