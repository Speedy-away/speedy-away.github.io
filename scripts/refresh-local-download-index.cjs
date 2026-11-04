// Metadata-only archive refresh. Default/--check reads; --write refreshes indexes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {layoutFor} = require('./download-archive-layout.cjs');

const root = path.resolve(__dirname, '..');
const auditPath = path.join(root, 'docs/download-audit.json');
const backup = path.resolve('F:/whatsite-backup-downloads-etc');
const args = process.argv.slice(2);
if (args.some(arg => !['--check', '--write'].includes(arg)) || args.includes('--check') && args.includes('--write')) {
  throw Error('Use --check (default) or --write.');
}
const write = args.includes('--write');
if (!fs.existsSync(backup) || !fs.statSync(backup).isDirectory()) throw Error('Backup root is unavailable: ' + backup);
const realBackup = fs.realpathSync(backup);
const inside = (base, target) => {
  const relative = path.relative(base, target);
  return relative === '' || relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};
function within(file) {
  const absolute = path.resolve(file);
  if (!inside(backup, absolute)) throw Error('Path outside backup: ' + absolute);
  let ancestor = absolute;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  if (!inside(realBackup, fs.realpathSync(ancestor))) throw Error('Backup path resolves outside archive: ' + absolute);
  return absolute;
}
const inventoryPath = within(path.join(backup, 'download-inventory.json'));
function readReport(file, required = false) {
  if (!fs.existsSync(file)) {
    if (required) throw Error('Missing inventory: ' + file);
    return {items: []};
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data.items)) throw Error('Inventory has no items array: ' + file);
  if (data.backupRoot && path.resolve(data.backupRoot) !== backup) throw Error('Unexpected inventory backup root: ' + file);
  return data;
}
const oldBackup = readReport(inventoryPath);
const workspace = readReport(auditPath, true);
const repairRelocation=require('./archive-relocations.cjs').createRelocationRepair([oldBackup,workspace],{
  exists:filename=>fs.existsSync(within(filename)),
  verify:file=>{
    const filename=within(file.backupPath),bytes=fs.readFileSync(filename);
    if(bytes.length!==file.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha256.toLowerCase())throw Error('Relocated original no longer matches recorded bytes: '+filename);
  }
});
// An exact recovered original can repair old pathless records resurrected by
// historical inventory unions. Keep the original metadata on the recovered row.
const recoveries = new Map(), verifiedRecoveries = new Set();
const recoveryKey = (id, file) => JSON.stringify([id, file.name, file.bytes, file.sha256, file.version || null, file.sourceUrl || file.resolvedUrl || '']);
for (const report of [oldBackup, workspace]) for (const item of report.items) for (const file of item.files || []) {
  if (file.backupPath && file.recoveryOriginalFileRecord) recoveries.set(recoveryKey(item.id, file.recoveryOriginalFileRecord), file);
}
function repairRecoveredPath(id, file) {
  if (file.backupPath) return file;
  const recovered = recoveries.get(recoveryKey(id, file));
  if (!recovered) return file;
  const archived = within(recovered.backupPath);
  if (!verifiedRecoveries.has(archived)) {
    const bytes = fs.readFileSync(archived);
    if (bytes.length !== file.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw Error('Recovered original no longer matches recorded bytes: ' + id);
    verifiedRecoveries.add(archived);
  }
  return {...file, backupPath: archived, version: file.version || recovered.version,
    archiveRole: recovered.archiveRole, recoveryOriginalFileRecord: recovered.recoveryOriginalFileRecord,
    recoveryMethod: recovered.recoveryMethod};
}
const unique = values => [...new Set(values)];
const fileKey = file => {
  const location = typeof file.backupPath === 'string' && file.backupPath ? within(file.backupPath).toLowerCase() : '';
  const digest = String(file.sha256 || '').toLowerCase();
  return location || digest ? location + '\0' + digest : JSON.stringify(file);
};
const items = new Map();
for (const report of [oldBackup, workspace]) {
  for (const incoming of report.items) {
    if (typeof incoming.id !== 'string' || !incoming.id) throw Error('Inventory item is missing its ID.');
    const previous = items.get(incoming.id) || {};
    const files = new Map();
    for (const originalFile of [...(previous.files || []), ...(incoming.files || [])]) {
      const file = repairRelocation(incoming.id, repairRecoveredPath(incoming.id, originalFile));
      const key = fileKey(file);
      files.set(key, {...files.get(key), ...file});
    }
    const sourceUrls = unique([...(previous.sourceUrls || []), previous.url, ...(incoming.sourceUrls || []), incoming.url].filter(Boolean));
    const item = {...previous, ...incoming, files: [...files.values()]};
    for (const key of ['pages', 'labels']) item[key] = unique([...(previous[key] || []), ...(incoming[key] || [])]);
    if (sourceUrls.length > 1) item.sourceUrls = sourceUrls;
    items.set(item.id, item);
  }
}
const merged = {...oldBackup, ...workspace, backupRoot: backup, items: [...items.values()]};
const recordedHashes = new Map();
for (const item of merged.items) for (const file of item.files) {
  if (!file.backupPath || !/^[a-f0-9]{64}$/i.test(file.sha256 || '')) continue;
  const location = within(file.backupPath).toLowerCase();
  if (!recordedHashes.has(location)) recordedHashes.set(location, new Set());
  recordedHashes.get(location).add(file.sha256.toLowerCase());
}
function inspect(file) {
  if (!file.backupPath) return {status: 'unlocated', reason: 'No backup path was recorded.'};
  const absolute = within(file.backupPath);
  try {
    const stat = fs.statSync(absolute);
    if (!stat.isFile()) return {absolute, status: 'missing', reason: 'Recorded path is not a regular file.'};
    if (Number.isFinite(file.bytes) && stat.size !== file.bytes) return {absolute, status: 'size-mismatch', reason: 'Size differs from the inventory.', actualBytes: stat.size};
    if (recordedHashes.get(absolute.toLowerCase())?.size > 1) return {absolute, status: 'unverified-version', reason: 'Different recorded hashes share this path; the stored version is unverified.'};
    return {absolute, status: 'present', actualBytes: stat.size};
  } catch (error) {
    return {absolute, status: ['ENOENT', 'ENOTDIR'].includes(error.code) ? 'missing' : 'unreadable', reason: error.code || error.message};
  }
}
const rows = merged.items.flatMap(item => item.files.map(file => {
  const state = inspect(file);
  return {item, file, ...state, platform: layoutFor(item, file)[0]};
}));
const summary = {
  items: merged.items.length,
  fileRecords: rows.length,
  presentFileRecords: rows.filter(row => row.status === 'present').length,
  missingFileRecords: rows.filter(row => row.status === 'missing').length,
  missingPaths: new Set(rows.filter(row => row.status === 'missing').map(row => row.absolute.toLowerCase())).size,
  otherUnavailableRecords: rows.filter(row => !['present', 'missing'].includes(row.status)).length,
  availability: rows.reduce((counts, row) => {counts[row.status] = (counts[row.status] || 0) + 1; return counts;}, {})
};
console.log(JSON.stringify({mode: write ? 'write' : 'check', backupRoot: backup, ...summary}, null, 2));
if (!write) process.exit(0);

const now = new Date().toISOString();
const historyRoot = within(path.join(backup, 'archive-history'));
fs.mkdirSync(historyRoot, {recursive: true});
const history = within(fs.mkdtempSync(path.join(historyRoot, 'index-refresh-' + now.replace(/[:.]/g, '-') + '-')));
for (const name of ['download-inventory.json', 'index.html', 'CHECKSUMS.sha256', 'unavailable-downloads.csv']) {
  const source = within(path.join(backup, name));
  if (fs.existsSync(source)) fs.copyFileSync(source, within(path.join(history, name)), fs.constants.COPYFILE_EXCL);
}
fs.copyFileSync(auditPath, within(path.join(history, 'workspace-download-audit.json')), fs.constants.COPYFILE_EXCL);
merged.updated = now;
merged.indexRefresh = {updated: now, mode: 'metadata-only', history, ...summary};
for (const row of rows) {
  row.file.archiveAvailability = row.status;
  row.file.archiveCheckedAt = now;
  if (row.reason) row.file.archiveAvailabilityReason = row.reason;
  else delete row.file.archiveAvailabilityReason;
}
function atomicWrite(file, text) {
  if (file !== auditPath) within(file);
  const temporary = file + '.index-refresh-' + crypto.randomBytes(6).toString('hex') + '.tmp';
  if (file !== auditPath) within(temporary);
  fs.writeFileSync(temporary, text, {flag: 'wx'});
  fs.renameSync(temporary, file);
}
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const csv = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
const relative = file => path.relative(backup, within(file)).replaceAll('\\', '/');
const sourceLink = item => {
  try {
    const url = new URL(item.url);
    return ['http:', 'https:'].includes(url.protocol) ? `<a href="${esc(item.url)}">Source</a>` : '';
  } catch { return ''; }
};
const groups = new Map();
for (const row of rows) {
  if (!groups.has(row.platform)) groups.set(row.platform, []);
  groups.get(row.platform).push(row);
}
const sections = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([platform, entries]) => {
  const body = entries.sort((a, b) => String(a.file.backupPath || a.file.name).localeCompare(String(b.file.backupPath || b.file.name))).map(row => {
    const location = row.absolute ? relative(row.absolute) : '';
    const file = row.status === 'present' ? `<a href="${esc(location.split('/').map(encodeURIComponent).join('/'))}" download>${esc(row.file.name)}</a>` : esc(row.file.name);
    return `<tr><td>${esc(row.item.title)}<br>${sourceLink(row.item)}</td><td>${file}</td><td>${esc(row.status)}${row.reason ? ': ' + esc(row.reason) : ''}</td><td>${esc(location)}<br>${esc(row.file.bytes)} bytes</td></tr>`;
  }).join('');
  return `<section id="${esc(platform.replaceAll(' ', '-'))}"><h2>${esc(platform)} · ${entries.length} file records</h2><table><thead><tr><th>Resource</th><th>File</th><th>Availability</th><th>Recorded location and size</th></tr></thead><tbody>${body}</tbody></table></section>`;
}).join('');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local download archive</title><style>body{font:16px system-ui;margin:32px;background:#101214;color:#eee}a{color:#6fe4bb}nav{display:flex;gap:20px;flex-wrap:wrap}table{border-collapse:collapse;width:100%;margin-bottom:36px}th,td{padding:12px;border:1px solid #444;text-align:left;overflow-wrap:anywhere}td:last-child{font-size:13px;color:#aaa}</style><h1>Local download archive</h1><p>Updated ${esc(now)}. ${summary.presentFileRecords} present file records, ${summary.missingFileRecords} missing, ${summary.otherUnavailableRecords} otherwise unavailable.</p><p>Files remain in their recorded folders. Missing records are retained without download links.</p><nav>${[...groups.keys()].sort().map(platform => `<a href="#${esc(platform.replaceAll(' ', '-'))}">${esc(platform)}</a>`).join('')}</nav>${sections}</html>`;
const checksums = new Map();
for (const row of rows) {
  if (!row.absolute || !/^[a-f0-9]{64}$/i.test(row.file.sha256 || '')) continue;
  const record = row.file.sha256.toLowerCase() + '  ' + relative(row.absolute);
  checksums.set(record, row.status === 'present' ? record : '# ' + row.status + '\n' + record);
}
const unavailable = [];
for (const item of merged.items) {
  if (!['downloaded', 'excluded', 'reference'].includes(item.status)) unavailable.push([item.title, item.url, item.status, item.error || item.reason, '']);
}
for (const row of rows.filter(row => row.status !== 'present')) unavailable.push([row.item.title, row.item.url, row.status, row.reason, row.file.backupPath || '']);
const json = JSON.stringify(merged, null, 2) + '\n';
atomicWrite(auditPath, json);
atomicWrite(inventoryPath, json);
atomicWrite(within(path.join(backup, 'index.html')), html);
atomicWrite(within(path.join(backup, 'CHECKSUMS.sha256')), '# Recorded SHA-256 values; metadata refresh does not rehash payloads.\n' + [...checksums.values()].join('\n') + '\n');
atomicWrite(within(path.join(backup, 'unavailable-downloads.csv')), 'Title,URL,Status,Reason,Backup path\r\n' + unavailable.map(row => row.map(csv).join(',')).join('\r\n') + '\r\n');
console.log('Refreshed archive metadata; no payload or site file was moved, replaced or deleted. Prior metadata: ' + history);
