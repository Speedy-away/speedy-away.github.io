// Read-only PS3 archive HTTP server. Never extracts, installs or executes files.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {pipeline} = require('node:stream/promises');

const DEFAULT_ARCHIVE = path.resolve('F:/whatsite-backup-downloads-etc');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8766;
const MAX_FILE_BYTES = 16 * 1024 ** 3;
const MAX_ENTRIES = 5000;
const CONSOLE_EXTENSIONS = new Set(['.pkg', '.sprx', '.prx', '.bin', '.rpf', '.edat', '.img', '.sco', '.sc3', '.gsc', '.csc', '.gscc', '.ff', '.ini', '.cfg', '.xml', '.dat', '.ctd', '.key', '.dds', '.txt', '.zip', '.rar', '.7z']);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256 = /^[a-f0-9]{64}$/i;
const ownRoleIsUnsafe = role => role !== undefined && (!Array.isArray(role) || role.length !== 1 || role[0] !== 'Builds');
const h = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function isPrivateHost(value) {
  if (value === DEFAULT_HOST) return true;
  if (typeof value !== 'string') return false;
  const parts = value.split('.');
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255 || String(Number(part)) !== part)) return false;
  return parts[0] === '10' || parts[0] === '192' && parts[1] === '168' || parts[0] === '172' && Number(parts[1]) >= 16 && Number(parts[1]) <= 31;
}

function under(base, target) {
  const relative = path.relative(base, target);
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function archiveContext(archiveRoot) {
  if (!path.isAbsolute(archiveRoot)) throw Error('Archive root must be absolute.');
  const absolute = path.resolve(archiveRoot);
  if (!fs.statSync(absolute).isDirectory()) throw Error('Archive root is unavailable.');
  return {absolute, real: fs.realpathSync(absolute)};
}

function verifiedPath(context, filename, expectedBytes) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename)) throw Error('Archive file path must be absolute.');
  const absolute = path.resolve(filename);
  if (!under(context.absolute, absolute)) throw Error('Archive file is outside the allowed root.');
  const real = fs.realpathSync(absolute);
  if (!under(context.real, real)) throw Error('Archive file resolves outside the allowed root.');
  const stat = fs.statSync(real);
  if (!stat.isFile() || stat.size !== expectedBytes) throw Error('Archived file size no longer matches its inventory.');
  return {absolute, real, stat};
}

function plainText(value, fallback = '', max = 500) {
  const text = String(value ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').trim();
  // Only local download routes are public. Do not forward machine paths or host URLs from metadata.
  if (/[a-z]:[\\/]|\\\\|https?:\/\//i.test(text)) return fallback;
  return (text || fallback).slice(0, max);
}

function safeFilename(value) {
  if (typeof value !== 'string' || !value || /[\\/]/.test(value)) return null;
  if (/^(?:\._|\.DS_Store$)/i.test(value)) return null;
  const extension = path.extname(value);
  if (!CONSOLE_EXTENSIONS.has(extension.toLowerCase())) return null;
  let stem = value.slice(0, -extension.length).replace(/[<>:"|?*\x00-\x1f\x7f]/g, '_').replace(/[. ]+$/g, '').slice(0, 150);
  if (!stem || stem === '.' || stem === '..') stem = 'PS3-file';
  if (/^(?:CON|PRN|AUX|NUL|COM\d|LPT\d)$/i.test(stem)) stem = '_' + stem;
  return stem + extension;
}

function variantLabel(value) {
  if (!value) return null;
  if (typeof value !== 'string' || /^(?:[\\/]|[a-z]:)/i.test(value)) return null;
  const parts = value.split(/[\\/]+/);
  if (parts.some(part => !part || part === '.' || part === '..' || part.includes(':'))) return null;
  return plainText(parts.join(' / '), '', 1000) || null;
}

function buildDirectory(entry) {
  const variant = (entry.variant || '').split(' / ').slice(-3, -1).join('-');
  const label = (entry.filename + '-' + variant).normalize('NFKD').replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'PS3-build';
  return label + '--' + entry.id;
}

function canonicalPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\#?\x00-\x20\x7f]/.test(value)) return null;
  try {
    const parts = value.split('/').map(part => decodeURIComponent(part));
    // A literal # is rejected above, but %23 may be a real filename character.
    // Exact allowlist matching still controls every decoded segment.
    if (parts.some(part => part === '.' || part === '..' || /[\\/?\x00-\x1f\x7f]/.test(part))) return null;
    return parts.map(encodeURIComponent).join('/');
  } catch { return null; }
}

function siteAlias(value) {
  // Legacy records contain spaces; newer records already escape # and other bytes.
  // Normalize exactly one decode/encode round so encoded URLs are never doubled.
  if (typeof value !== 'string' || !/^\/downloads\/(?:ps3|archive)\//.test(value) || /[?#\\\x00-\x1f\x7f]/.test(value)) return null;
  try {
    const parts = value.split('/').map(part => decodeURIComponent(part));
    if (parts.some(part => part === '.' || part === '..' || /[\\/\x00-\x1f\x7f]/.test(part))) return null;
    return canonicalPath(parts.map(encodeURIComponent).join('/'));
  } catch { return null; }
}

function readJson(filename, fallback) {
  if (!fs.existsSync(filename)) return fallback;
  if (fs.statSync(filename).size > 64 * 1024 ** 2) throw Error('Inventory exceeds the selected metadata size bound.');
  return JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
}

function selectArchiveFiles({archiveRoot = DEFAULT_ARCHIVE, scopedInventory = {items: []}, pinnedApps = [], auditInventory = {items: []}, resources = []} = {}) {
  const context = archiveContext(archiveRoot), records = new Map(), routes = new Map();
  const resourceFor = owner => resources.find(resource => resource.id === owner.resourceId || resource.id === owner.id || (resource.downloads || []).some(download => download.url === owner.url));
  function add(owner, file, pinnedApp) {
    if (owner.platform !== 'PS3' || owner.readiness === 'incomplete' || file.readiness === 'invalid-console-header' || owner.category === 'rtm' || owner.kind === 'github-source' || ownRoleIsUnsafe(owner.archiveRole) || ownRoleIsUnsafe(file.archiveRole) || /Helpers|Windows|Source|Metadata|Development|Android|Linux|macOS/i.test(JSON.stringify(file.role || owner.role || ''))) return;
    const role = file.archiveRole || owner.archiveRole;
    if ((!Array.isArray(role) || role.length !== 1 || role[0] !== 'Builds') && !pinnedApp) return;
    const filename = safeFilename(file.name || file.filename);
    if (!filename || /(?:^|[\s_.-])(?:windows|win32|win64|desktop|source|sources|src|sdk|android|vita|ps4|ps5)(?:$|[\s_.-])/i.test(filename) || !Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > MAX_FILE_BYTES || !SHA256.test(file.sha256 || '')) return;
    const resource = pinnedApp || resourceFor(owner);
    if (resource?.category === 'rtm' || resource?.readiness === 'incomplete') return;
    const resourceId = owner.resourceId || resource?.id || owner.id;
    if (!SLUG.test(resourceId || '')) return;
    let location;
    try { location = verifiedPath(context, file.backupPath, file.bytes); } catch { return; }
    const digest = file.sha256.toLowerCase(), key = location.real + '\0' + digest;
    const alias = siteAlias(file.local);
    if (records.has(key)) {
      const previous = records.get(key);
      if (alias && !previous.aliases.includes(alias)) previous.aliases.push(alias);
      return;
    }
    const id = crypto.createHash('sha256').update(resourceId + '\0' + digest + '\0' + path.relative(context.absolute, location.absolute)).digest('hex').slice(0, 32);
    const url = '/files/' + id + '/' + encodeURIComponent(filename);
    const entry = {
      id, resourceId, title: plainText(resource?.name || resource?.title || owner.title, 'PS3 archive file', 200),
      filename, bytes: file.bytes, sha256: digest, version: plainText(file.releaseTag || file.version || resource?.version || owner.version || owner.release, 'Unversioned', 100),
      gameUpdate: plainText(resource?.gameUpdate, 'Not specified', 150), compatibility: plainText(resource?.compatibility || pinnedApp?.description || owner.compatibility, 'Check the project’s PS3 requirements.'),
      region: plainText(resource?.region, 'Match your game title ID.'), variant: variantLabel(file.memberPath),
      kind: /\.pkg$/i.test(filename) ? 'package' : /\.(?:zip|rar|7z)$/i.test(filename) ? 'archive' : 'game-file', url,
      aliases: alias ? [alias] : [], archivePath: location.absolute, realPath: location.real,
      modified: location.stat.mtime.toISOString().slice(0, 16).replace('T', ' ')
    };
    entry.directoryUrl = '/ezremote/' + entry.resourceId + '/' + buildDirectory(entry) + '/';
    entry.ezremoteUrl = entry.directoryUrl + encodeURIComponent(filename);
    if (routes.has(url) && routes.get(url) !== key) throw Error('Conflicting PS3 archive route identity.');
    routes.set(url, key); records.set(key, entry);
    if (records.size > MAX_ENTRIES) throw Error('PS3 file count exceeds the selected server bound.');
  }
  for (const owner of scopedInventory.items || []) for (const file of owner.files || []) add(owner, file);
  // Only exact PS3 app URLs already pinned in the PS3 expansion data may use the shared audit.
  for (const app of pinnedApps) {
    if (!siteAlias(app.url)) continue;
    for (const owner of auditInventory.items || []) {
      if (owner.platform && owner.platform !== 'PS3' || !(owner.pages || []).some(page => /^\/?console\/ps3(?:\.html|\/)/.test(page))) continue;
      for (const file of owner.files || []) if (file.local === app.url) add({...owner, platform: 'PS3'}, file, app);
    }
  }
  return [...records.values()].sort((a, b) => a.resourceId.localeCompare(b.resourceId) || a.kind.localeCompare(b.kind) || a.filename.localeCompare(b.filename) || (a.variant || '').localeCompare(b.variant || ''));
}

function loadArchiveCatalogue({projectRoot = PROJECT_ROOT, archiveRoot = DEFAULT_ARCHIVE} = {}) {
  const data = readJson(path.join(projectRoot, 'docs/ps3-mod-resources.json'), {resources: []});
  const apps = readJson(path.join(projectRoot, 'docs/ps3-apps-source-evidence.json'), {apps: []});
  return selectArchiveFiles({archiveRoot,
    scopedInventory: readJson(path.join(projectRoot, 'docs/ps3-expansion-download-inventory.json'), {items: []}),
    pinnedApps: readJson(path.join(projectRoot, 'docs/expansion-ps3.json'), {apps: []}).apps,
    auditInventory: readJson(path.join(projectRoot, 'docs/download-audit.json'), {items: []}), resources: [...data.resources, ...data.apps || [], ...apps.apps]
  });
}

function publicFile(entry) {
  const {id, resourceId, title, filename, bytes, sha256, version, gameUpdate, compatibility, region, variant, kind, url, directoryUrl, ezremoteUrl} = entry;
  return {id, resourceId, title, filename, bytes, sha256, version, gameUpdate, compatibility, region, variant, kind, url, directoryUrl, ezremoteUrl, ...(entry.aliases.length ? {sitePath: entry.aliases[0]} : {})};
}

function parseSingleRange(value, size) {
  if (value === undefined) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(value).trim());
  if (!match || !size || !match[1] && !match[2]) throw Error('Invalid byte range.');
  const total = BigInt(size);
  let start, end;
  if (!match[1]) {
    const suffix = BigInt(match[2]);
    if (suffix === 0n) throw Error('Invalid byte range.');
    start = suffix >= total ? 0n : total - suffix; end = total - 1n;
  } else {
    start = BigInt(match[1]); end = match[2] ? BigInt(match[2]) : total - 1n;
    if (start >= total || end < start) throw Error('Invalid byte range.');
    if (end >= total) end = total - 1n;
  }
  return {start: Number(start), end: Number(end), length: Number(end - start + 1n)};
}

const fingerprint = stat => [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(':');
async function hashHandle(handle, size) {
  const digest = crypto.createHash('sha256'), buffer = Buffer.alloc(1024 * 1024);
  let position = 0;
  while (position < size) {
    const {bytesRead} = await handle.read(buffer, 0, Math.min(buffer.length, size - position), position);
    if (!bytesRead) throw Error('Archived file was truncated.');
    digest.update(buffer.subarray(0, bytesRead)); position += bytesRead;
  }
  return digest.digest('hex');
}

function disposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const utf8 = encodeURIComponent(filename).replace(/[!'()*]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase());
  return 'attachment; filename="' + ascii + '"; filename*=UTF-8\'\'' + utf8;
}

function createArchiveServer({archiveRoot = DEFAULT_ARCHIVE, files, projectRoot = PROJECT_ROOT, host = DEFAULT_HOST, maxActiveTransfers = 4} = {}) {
  if (!isPrivateHost(host)) throw Error('Bind only to 127.0.0.1 or an explicit private IPv4 address.');
  if (!Number.isInteger(maxActiveTransfers) || maxActiveTransfers < 1 || maxActiveTransfers > 16) throw Error('Invalid concurrent transfer bound.');
  const context = archiveContext(archiveRoot), catalogue = files || loadArchiveCatalogue({archiveRoot, projectRoot});
  const routeMap = new Map(), hashCache = new Map();
  for (const entry of catalogue) {
    for (const route of [entry.url, entry.ezremoteUrl, ...entry.aliases]) {
      if (canonicalPath(route) !== route || routeMap.has(route) && routeMap.get(route).sha256 !== entry.sha256) throw Error('Conflicting or invalid allowlisted route.');
      routeMap.set(route, entry);
    }
  }
  let activeTransfers = 0;
  const server = http.createServer((request, response) => { handle(request, response).catch(() => {
    if (response.headersSent) response.destroy(); else textResponse(request, response, 500, 'Unable to read the selected archived file.');
  }); });
  server.maxConnections = 32; server.maxHeadersCount = 32;
  server.headersTimeout = 30000; server.requestTimeout = 30000; server.keepAliveTimeout = 5000;

  function textResponse(request, response, code, text, extra = {}) {
    const body = Buffer.from(text + '\n');
    response.writeHead(code, {'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store', ...extra});
    response.end(request.method === 'HEAD' ? undefined : body);
  }
  function originFor(request) {
    const address = server.address(), port = address?.port;
    const authority = host + (port === 80 ? '' : ':' + port);
    const requested = request.headers.host;
    const allowed = [authority, ...(host === DEFAULT_HOST ? ['localhost' + (port === 80 ? '' : ':' + port)] : [])];
    if (requested && !allowed.includes(requested.toLowerCase())) return null;
    return 'http://' + authority;
  }
  function listing(entries, origin, filter) {
    const blocks = [['package', 'PS3 PKG packages'], ['game-file', 'Game files and configuration'], ['archive', 'Original archives · extract first']].map(([kind, title]) =>
      '<h2>' + title + '</h2><ul>' + entries.filter(entry => entry.kind === kind).map(entry => {
        const source = origin + entry.url;
        const webman = source.length < 360 ? ' · <a href="' + h('http://127.0.0.1/xmb.ps3/download.ps3?url=' + source) + '">Save with webMAN on this PS3</a>' : '';
        return '<li id="file-' + entry.id + '"><h3>' + h(entry.title) + '</h3><p><a href="' + h(entry.url) + '">' + h(entry.filename) + '</a> (' + entry.bytes + ' bytes; ' + (entry.bytes / 1048576).toFixed(2) + ' MiB) · ' + h(entry.version) + '</p>' +
          (entry.variant ? '<p>Build / region path: ' + h(entry.variant) + '</p>' : '') + '<p>' + h(entry.compatibility) + '</p><p>Game update: ' + h(entry.gameUpdate) + ' · Region: ' + h(entry.region) + '</p><p><a href="' + h(entry.url) + '">Download file</a>' + webman + '</p><p class="hash">SHA-256 ' + entry.sha256 + '</p></li>';
      }).join('') + '</ul>').join('');
    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PS3 local archive downloads | whatwhatboy</title><style>body{margin:0;background:#0b100d;color:#eaf2ed;font:16px/1.6 Arial,sans-serif}main{display:block;max-width:960px;margin:auto;padding:24px}a{color:#9be5b7}a:focus{outline:2px solid #9be5b7}h1{font-size:30px;line-height:1.2}h2{margin-top:32px}h3{font-size:18px}ul{padding-left:20px}li{border-bottom:1px solid #31513c;padding:10px 0 20px;word-wrap:break-word}p{margin:8px 0}.hash{font:12px/1.6 monospace;word-break:break-all}.notice{border-left:3px solid #9be5b7;padding:10px 16px;background:#142219}</style></head><body><main><p>whatwhatboy / PLAYSTATION 3</p><h1>PS3 local archive downloads</h1><p>' + entries.length + ' console files' + (filter ? ' for ' + h(filter) : '') + '. <a href="/">All PS3 files</a> · <a href="/catalog.json' + (filter ? '?resource=' + encodeURIComponent(filter) : '') + '">File inventory and checksums</a> · <a href="/ezremote/">ezRemote directory</a></p>' +
      '<div class="notice"><p>Read-only HTTP downloads from the selected local archive. Packages still need installation through a compatible PS3 environment. Game files need their matching title, build and loader. Archives need extraction.</p><p>Open this computer’s private LAN address on the PS3. For ezRemote, use the server URL ending in /ezremote/, HTTP server type Apache and remote directory /. Plain file links need no JavaScript. Save with webMAN requires webMAN MOD already running on the PS3; 127.0.0.1 in that link means the PS3 where it is opened. These links only download to /dev_hdd0/packages.</p><p>Check console free space and keep the original archives. No file has been installed or executed by this server. PS3 hardware operation has not been tested.</p></div>' + blocks + '</main></body></html>';
  }
  function apacheListing(route) {
    let rows;
    if (route === '/ezremote/') {
      rows = [...new Set(catalogue.map(entry => entry.resourceId))].map(resourceId => ({href: resourceId + '/', name: resourceId, directory: true}));
    } else {
      const resourceMatch = /^\/ezremote\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/.exec(route);
      if (resourceMatch) {
        const entries = catalogue.filter(entry => entry.resourceId === resourceMatch[1]);
        if (!entries.length) return null;
        rows = entries.map(entry => ({href: buildDirectory(entry) + '/', name: buildDirectory(entry), directory: true, modified: entry.modified}));
      } else {
        const entry = catalogue.find(entry => entry.directoryUrl === route);
        if (!entry) return null;
        rows = [{href: encodeURIComponent(entry.filename), name: entry.filename, modified: entry.modified, bytes: entry.bytes}];
      }
    }
    // Match ezRemote's Apache parser: four td cells, first img alt, then a relative
    // immediate-child href, YYYY-MM-DD HH:MM and a size. K avoids its atoi overflow.
    const row = entry => '<tr><td><img alt="' + (entry.directory ? '[DIR]' : '[   ]') + '"></td><td><a href="' + h(entry.href) + '">' + h(entry.name) + '</a></td><td>' + (entry.modified || '2026-11-02 00:00') + '</td><td>' + (entry.directory ? '-' : Math.ceil(entry.bytes / 1024) + 'K') + '</td></tr>';
    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Index of ' + h(route) + '</title></head><body><h1>Index of ' + h(route) + '</h1><table><tr><th>Type</th><th>Name</th><th>Last modified (UTC)</th><th>Size</th></tr><tr><td><img alt="[PARENTDIR]"></td><td><a href="../">Parent directory</a></td><td>-</td><td>-</td></tr>' + rows.map(row).join('') + '</table></body></html>';
  }
  async function openVerified(entry) {
    const location = verifiedPath(context, entry.archivePath, entry.bytes);
    if (location.real !== entry.realPath) throw Error('Archived path changed.');
    const handle = await fs.promises.open(location.real, 'r');
    try {
      const stat = await handle.stat(), identity = fingerprint(stat);
      if (!stat.isFile() || stat.size !== entry.bytes || identity !== fingerprint(location.stat)) throw Error('Archived file changed.');
      let cached = hashCache.get(entry.id);
      if (!cached || cached.identity !== identity) {
        cached = {identity, pending: hashHandle(handle, entry.bytes)};
        hashCache.set(entry.id, cached);
      }
      if (await cached.pending !== entry.sha256 || fingerprint(await handle.stat()) !== identity) throw Error('Archived checksum no longer matches its inventory.');
      return {handle, stat};
    } catch (error) { await handle.close(); throw error; }
  }
  async function handle(request, response) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
    if (request.method !== 'GET' && request.method !== 'HEAD') return textResponse(request, response, 405, 'Read-only server: use GET or HEAD.', {Allow: 'GET, HEAD'});
    const origin = originFor(request);
    if (!origin) return textResponse(request, response, 400, 'Use the server’s printed IPv4 address.');
    if (typeof request.url !== 'string' || request.url.length > 4096) return textResponse(request, response, 400, 'Invalid request target.');
    const queryAt = request.url.indexOf('?'), route = canonicalPath(queryAt < 0 ? request.url : request.url.slice(0, queryAt));
    if (!route) return textResponse(request, response, 404, 'File is not allowlisted.');
    const parameters = new URLSearchParams(queryAt < 0 ? '' : request.url.slice(queryAt + 1));
    if (route.startsWith('/ezremote/') && route.endsWith('/')) {
      if (parameters.size) return textResponse(request, response, 400, 'Invalid directory query.');
      const html = apacheListing(route);
      if (html === null) return textResponse(request, response, 404, 'Directory is not allowlisted.');
      const body = Buffer.from(html);
      response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store'});
      return response.end(request.method === 'HEAD' ? undefined : body);
    }
    if (route === '/' || route === '/catalog.json') {
      if ([...parameters.keys()].some(key => key !== 'resource') || parameters.getAll('resource').length > 1) return textResponse(request, response, 400, 'Invalid catalogue filter.');
      const filter = parameters.get('resource');
      if (filter && !SLUG.test(filter)) return textResponse(request, response, 400, 'Invalid resource ID.');
      const entries = filter ? catalogue.filter(entry => entry.resourceId === filter) : catalogue;
      const body = Buffer.from(route === '/' ? listing(entries, origin, filter) : JSON.stringify({platform: 'PS3', files: entries.map(publicFile)}, null, 2) + '\n');
      response.writeHead(200, {'Content-Type': route === '/' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store'});
      return response.end(request.method === 'HEAD' ? undefined : body);
    }
    const entry = routeMap.get(route);
    if (!entry || parameters.size) return textResponse(request, response, 404, 'File is not allowlisted.');
    if (activeTransfers >= maxActiveTransfers) return textResponse(request, response, 503, 'Transfer slots are busy. Try again shortly.', {'Retry-After': '5'});
    activeTransfers++;
    let opened;
    try {
      try { opened = await openVerified(entry); } catch { return textResponse(request, response, 409, 'Archived file changed or is unavailable. Refresh the inventory before retrying.'); }
      const etag = '"sha256-' + entry.sha256 + '"', modified = opened.stat.mtime.toUTCString();
      const headers = {'Content-Type': 'application/octet-stream', 'Content-Disposition': disposition(entry.filename), 'Accept-Ranges': 'bytes', ETag: etag, 'Last-Modified': modified, 'X-Checksum-SHA256': entry.sha256, 'Cache-Control': 'private, max-age=0, must-revalidate'};
      const ifNoneMatch = request.headers['if-none-match'];
      if (ifNoneMatch && ifNoneMatch.split(',').some(value => value.trim() === '*' || value.trim().replace(/^W\//, '') === etag)) { response.writeHead(304, {ETag: etag}); return response.end(); }
      const ifRange = request.headers['if-range'];
      const rangeMatches = !ifRange || ifRange === etag || !ifRange.startsWith('W/') && !ifRange.startsWith('"') && Number.isFinite(Date.parse(ifRange)) && Math.floor(opened.stat.mtimeMs / 1000) * 1000 <= Date.parse(ifRange);
      let range;
      try { range = parseSingleRange(rangeMatches ? request.headers.range : undefined, entry.bytes); } catch { return textResponse(request, response, 416, 'Requested byte range is not satisfiable.', {'Content-Range': 'bytes */' + entry.bytes, 'Accept-Ranges': 'bytes', ETag: etag}); }
      response.writeHead(range ? 206 : 200, {...headers, 'Content-Length': range ? range.length : entry.bytes, ...(range ? {'Content-Range': 'bytes ' + range.start + '-' + range.end + '/' + entry.bytes} : {})});
      if (request.method === 'HEAD') return response.end();
      response.setTimeout(120000, () => response.destroy());
      const stream = opened.handle.createReadStream({start: range ? range.start : 0, end: range ? range.end : entry.bytes - 1, autoClose: true});
      opened = null;
      try { await pipeline(stream, response); } catch { response.destroy(); }
    } finally { if (opened) await opened.handle.close(); activeTransfers--; }
  }
  return server;
}

function parseArgs(args) {
  let host = DEFAULT_HOST, port = DEFAULT_PORT, help = false;
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') help = true;
    else if (arg.startsWith('--host=')) host = arg.slice(7);
    else if (arg.startsWith('--port=') && /^\d+$/.test(arg.slice(7))) port = Number(arg.slice(7));
    else throw Error('Use --host=<private IPv4>, --port=<1024-65535> or --help.');
  }
  if (!isPrivateHost(host) || !Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Use loopback or one explicit private IPv4 address and a port from 1024 to 65535.');
  return {host, port, help};
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log('PS3 read-only archive server\nnode scripts/serve-ps3-downloads.cjs [--host=192.168.1.20] [--port=8766]\nDefault: http://127.0.0.1:8766/ (this computer only). Explicit private IPv4 enables access on that interface. No firewall changes are made.'); return; }
  const files = loadArchiveCatalogue(), server = createArchiveServer({...options, files});
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(options.port, options.host, resolve); });
  console.log('PS3 read-only archive: http://' + options.host + ':' + options.port + '/ · ' + files.length + ' files. Ctrl+C stops it.');
  const stop = () => server.close(() => process.exit(0));
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = {DEFAULT_HOST, DEFAULT_PORT, isPrivateHost, selectArchiveFiles, loadArchiveCatalogue, publicFile, parseSingleRange, createArchiveServer, parseArgs};
