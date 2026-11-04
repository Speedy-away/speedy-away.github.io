// Build after the download audit and local mirrors have finished.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { publicMirror, MAX_MIRROR_BYTES } = require('./download-mirror-policy.cjs');
const { page, section, grid, esc } = require('./build-console-guides.cjs');
const root = path.resolve(__dirname, '..');
const audit = JSON.parse(fs.readFileSync(path.join(root, 'docs/download-audit.json'), 'utf8'));
if (!Array.isArray(audit.items)) throw new Error('Download audit is missing its items array.');

const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
// Original guide media have their own provenance records, not tool downloads.
const items = audit.items.filter(item => item.publication !== 'private-review' && !['private-review', 'source-review', 'image', 'video'].includes(item.kind))
  .map(item => ({ ...item, files: (item.files || []).map(file => ({ ...file })) }));
const safeText = value => String(value ?? '');
const nameOnly = value => safeText(value).replaceAll('\\', '/').split('/').pop() || 'Download';
function originalUrl(value) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '';
    // Preserve the supplied URL, including public Discord/Mega signatures. Only
    // item.url/source is used; resolved URLs and guest-session tokens are never copied.
    return safeText(value);
  } catch { return ''; }
}
function mirror(value) {
  return publicMirror(value, root);
}

// Earlier PS4 files predate the full-site audit. Merge by original source URL
// and avoid presenting the same named/hash-identical file twice in one resource.
const bo3ResourcesFile = path.join(root, 'docs/ps4-bo3-resources.json');
const bo3Names = fs.existsSync(bo3ResourcesFile)
  ? new Map(read('docs/ps4-bo3-resources.json').resources.map(item => [item.id, item.name])) : new Map();
for (const [manifest, game] of [['downloads/ps4/GTA5/manifest.json', 'GTA5'], ['downloads/ps4/BO3/manifest.json', 'BO3']]) {
  if (!fs.existsSync(path.join(root, manifest))) continue;
  for (const file of read(manifest).files || []) {
    const source = originalUrl(file.source);
    const title = game === 'BO3' ? bo3Names.get(file.resource) || file.filename
      : `${file.name || file.filename}${/^15[67]$/.test(file.group) ? ' · GTA V 1.' + file.group.slice(1) : ' · GTA V scripts'}`;
    let item = source && items.find(entry => entry.url === source);
    if (!item) {
      const id = 'legacy-' + game.toLowerCase() + '-' + crypto.createHash('sha256').update(source || file.local || file.filename).digest('hex').slice(0, 12);
      item = { id, title, url: source, kind: 'local-ps4-archive', status: file.status || 'unavailable', files: [] };
      items.push(item);
    }
    const incoming = { name: file.filename, bytes: file.bytes, sha256: file.sha256, local: file.local };
    const same = item.files.find(existing => existing.local === incoming.local ||
      (existing.name === incoming.name && existing.sha256 && existing.sha256 === incoming.sha256));
    if (!same) item.files.push(incoming);
    else if (!mirror(same.local) && mirror(incoming.local)) same.local = incoming.local;
  }
}

// Explicit field selection prevents machine paths, error details, cookies and
// temporary/resolved URLs from leaking from the private audit into public JSON.
const ids = new Set();
const catalogItems = items.map(item => {
  const id = safeText(item.id);
  if (!/^[\w-]+$/.test(id) || ids.has(id)) throw new Error('Invalid or duplicate download resource ID: ' + id);
  ids.add(id);
  const files = item.files.map(file => {
    const stored = mirror(file.local);
    const result = {
      name: nameOnly(file.name || file.filename),
      bytes: stored ? stored.bytes : Number.isFinite(file.bytes) && file.bytes >= 0 ? file.bytes : null,
      sha256: /^[a-f0-9]{64}$/i.test(file.sha256 || '') ? file.sha256.toLowerCase() : null,
      availability: stored ? 'mirrored' : file.backupPath && (!file.local || file.bytes >= MAX_MIRROR_BYTES) ? 'backup-only' : file.local ? 'missing-local' : 'unavailable'
    };
    if (stored) result.local = stored.local;
    return result;
  });
  const mirrored = files.filter(file => file.local).length;
  const availability = mirrored ? 'mirrored' : files.some(file => file.availability === 'missing-local') ? 'missing-local'
    : files.some(file => file.availability === 'backup-only') ? 'backup-only' : 'unavailable';
  return { id, title: safeText(item.title || 'Download resource'), url: originalUrl(item.url),
    kind: safeText(item.kind || 'download'), status: safeText(item.status || 'unknown'), availability, files };
});
const available = catalogItems.filter(item => item.files.some(file => file.local))
  .sort((a, b) => a.title.localeCompare(b.title, 'en', { numeric: true }));
const hostedFiles = available.flatMap(item => item.files.filter(file => file.local));
const statusCounts = {};
for (const item of catalogItems) statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
const catalog = {
  updated: safeText(audit.updated || new Date().toISOString()),
  scope: 'Mod menus, scripts, tools and source codes; excludes games and firmware.',
  summary: { resources: catalogItems.length, mirroredResources: available.length, mirroredFiles: hostedFiles.length,
    mirroredBytes: hostedFiles.reduce((total, file) => total + file.bytes, 0), statuses: statusCounts },
  items: catalogItems
};
fs.mkdirSync(path.join(root, 'downloads'), { recursive: true });
fs.writeFileSync(path.join(root, 'downloads/catalog.json'), JSON.stringify(catalog, null, 2) + '\n');

function size(bytes) {
  if (!Number.isFinite(bytes)) return 'Size unavailable';
  if (bytes < 1024) return bytes + (bytes === 1 ? ' byte' : ' bytes');
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return new Intl.NumberFormat('en', { maximumFractionDigits: value < 10 ? 2 : 1 }).format(value) + ' ' + units[unit];
}
function card(item) {
  const files = item.files.filter(file => file.local);
  const remote = item.files.filter(file => !file.local);
  // Verified equivalent HTTPS roots. Keep the original provenance in catalog.json;
  // do not upgrade other publishers whose HTTPS service may be unavailable.
  const sourceUrl = new Map([
    ['http://openiv.com/', 'https://openiv.com/'],
    ['http://dege.freeweb.hu/', 'https://dege.freeweb.hu/']
  ]).get(item.url) || item.url;
  const search = [item.title, item.kind, item.url, ...files.map(file => file.name)].join(' ').toLowerCase();
  const downloads = files.map(file => `<li style="min-width:0"><a href="${esc(file.local)}" class="btn btn-primary" download="${esc(file.name)}" style="white-space:normal;max-width:100%;text-align:left"><i class="fas fa-download" aria-hidden="true"></i><span style="min-width:0;overflow-wrap:anywhere">${esc(file.name)}</span></a><p style="margin-top:6px">${size(file.bytes)}</p></li>`).join('');
  return `<article class="guide-resource game-card" id="resource-${item.id}" data-search="${esc(search)}" style="scroll-margin-top:24px"><h3 style="overflow-wrap:anywhere">${esc(item.title)}</h3><ul style="list-style:none;padding:0;margin:0;display:grid;gap:16px;width:100%">${downloads}</ul>${remote.length?`<details style="max-width:100%;overflow-wrap:anywhere"><summary>Other release files (${remote.length})</summary><p>Use the original page for files not hosted here.</p><ul>${remote.map(f=>`<li>${esc(f.name)} · ${size(f.bytes)}</li>`).join('')}</ul></details>`:''}${sourceUrl ? `<div class="guide-links"><a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Original page <i class="fas fa-external-link-alt" aria-hidden="true"></i></a></div>` : ''}</article>`;
}
const search = `<div class="search-container"><div class="search-box"><i class="fas fa-search search-icon" aria-hidden="true"></i><input type="search" class="search-input" id="gameSearch" placeholder="Search menus, scripts and tools..." aria-label="Search download library"></div></div>`;
const inventory = `<p>${available.length} resources · ${hostedFiles.length} files · ${size(catalog.summary.mirroredBytes)} hosted here.</p><p><a href="/downloads/catalog.json" download="catalog.json">Download file inventory &amp; SHA-256 hashes</a></p>`;
const content = section('console-downloads', 'Downloading on a PlayStation?', '<p>Use a console catalogue for compatible apps, payloads, game mods and storage setup.</p><div class="guide-links"><a href="/console/ps4/downloads.html">PS4 downloads →</a><a href="/console/ps5/downloads.html">PS5 downloads →</a></div>') + section('library', 'All-platform file library', search + inventory +
  (available.length ? grid(...available.map(card)) : '<p>No mirrored files are currently available.</p>') +
  '<p class="no-results" style="display:none" role="status">No downloads match your search.</p>',
  'Search the files hosted on this site. The inventory also records resources that could not be mirrored.');
page('downloads/index.html', 'Download Library',
  'Download locally hosted mod menus, Lua and GSC scripts, console tools and source-code archives. Search files and check their sizes and SHA-256 hashes.',
  '/assets/images/ps4-gta5/oxagon.png', [['/downloads/', 'Download Library'], ['/source-codes/', 'Source Codes'], ['/tools/', 'Tools']],
  content, '#library', 'Browse downloads');
console.log(`Built Download Library: ${available.length} mirrored resources, ${hostedFiles.length} files; ${catalogItems.length} total inventory records.`);
