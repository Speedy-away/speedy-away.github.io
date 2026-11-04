// Read-only audit of public download anchors and hosted file inventory.
// Reads metadata and the first 1 KiB only; never runs a downloaded file.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const origin = 'https://whatwhatboy.com';
const excluded = new Set(['.git', '.agents', '.codex', '.claude', '.playwright', '.playwright-cli', 'node_modules', 'assets', 'docs', 'design-references', 'languages', 'i18n-tools', 'scripts', 'tmp']);
const extension = /\.(?:zip|7z|rar|tar|gz|bz2|xz|bin|elf|pkg|prx|sprx|plugin|lua|gsc|csc|asi|dll|exe|msi|apk|ipa|iso|img|vpk|p3t|ptf|ctf|nxtheme|wuhb|xbe|pbp|rpl|self|fself|rpx|nro|nsp|cia|3dsx|nds|dol|wad|pup|upd|pdb|jar|json|xml|csv|txt|md|pdf)$/i;
const decode = value => value.replace(/&(?:amp|#38);/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'");
function attribute(tag, name) {
    const found = tag.match(new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
    return found ? decode(found[1] ?? found[2] ?? found[3]) : null;
}
function pageFiles(dir = root) {
    if (/^hosts\/runtime(?:\/|$)/.test(path.relative(root,dir).replaceAll('\\','/'))) return [];
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
        if (entry.isDirectory()) {
            if (excluded.has(entry.name)) return [];
            // Downloadable HTML companions are files, rather than site pages.
            if (entry.name === 'downloads') {
                const index = path.join(dir, entry.name, 'index.html');
                return fs.existsSync(index) ? [index] : [];
            }
            return pageFiles(path.join(dir, entry.name));
        }
        return entry.name.endsWith('.html') ? [path.join(dir, entry.name)] : [];
    });
}
function localFile(url) {
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return {error: 'malformed encoded filename'}; }
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) return {error: 'path outside checkout'};
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return {error: 'missing file'};
    return {file, pathname, bytes: fs.statSync(file).size};
}
function head(file) {
    const fd = fs.openSync(file, 'r');
    try {
        const buffer = Buffer.alloc(1024);
        return buffer.subarray(0, fs.readSync(fd, buffer, 0, buffer.length, 0)).toString('utf8');
    } finally { fs.closeSync(fd); }
}
function audit() {
    const files = pageFiles();
    const hosted = new Map();
    const failures = [];
    const warnings = [];
    const externalHosts = {};
    let localAnchors = 0;
    let externalDirectAnchors = 0;
    let inventoryEntries = 0;
    const record = (url, page, expectedBytes) => {
        const entry = localFile(url);
        if (entry.error) { failures.push({page, file: url.pathname, issue: entry.error}); return; }
        if (!hosted.has(entry.file)) {
            hosted.set(entry.file, entry);
            const first = head(entry.file).replace(/^\uFEFF/, '').trimStart();
            if (!entry.bytes) failures.push({page, file: url.pathname, issue: 'zero-byte file'});
            if (!/\.x?html?$/i.test(entry.pathname) && /^(?:<!doctype\s+html|<html\b)/i.test(first)) failures.push({page, file: url.pathname, issue: 'HTML response stored as a download'});
            if (/^version https:\/\/git-lfs\.github\.com\/spec\/v1\s/.test(first)) failures.push({page, file: url.pathname, issue: 'Git LFS pointer instead of usable file'});
        }
        if (Number.isFinite(expectedBytes) && expectedBytes !== entry.bytes) failures.push({page, file: url.pathname, issue: 'inventory size mismatch', inventoryBytes: expectedBytes, actualBytes: entry.bytes});
    };
    for (const file of files) {
        const page = path.relative(root, file).replaceAll('\\', '/');
        const html = fs.readFileSync(file, 'utf8');
        if (/http-equiv\s*=\s*["']refresh["']/i.test(html)) continue;
        for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
            const tag = match[0];
            const href = attribute(tag, 'href');
            if (!href) continue;
            let url;
            try { url = new URL(href, origin + '/' + page); } catch { continue; }
            if (!['https:', 'http:'].includes(url.protocol)) continue;
            const isLocal = url.origin === origin;
            const hasDownload = /\sdownload(?:\s|=|>)/i.test(tag);
            const knownExtension = extension.test(url.pathname);
            const localDownloadsPath = isLocal && url.pathname.startsWith('/downloads/') && !url.pathname.endsWith('/') && !/\.html$/i.test(url.pathname);
            if (!hasDownload && !knownExtension && !localDownloadsPath) continue;
            if (!isLocal) {
                externalDirectAnchors++;
                externalHosts[url.hostname] = (externalHosts[url.hostname] || 0) + 1;
                if (hasDownload) warnings.push({page, file: url.pathname, host: url.hostname, issue: 'cross-origin download attribute is not a reliable save instruction'});
                continue;
            }
            localAnchors++;
            record(url, page);
            if (!hasDownload) warnings.push({page, file: url.pathname, issue: 'same-origin file link lacks download filename'});
            if (attribute(tag, 'target') === '_blank') warnings.push({page, file: url.pathname, issue: 'same-origin file link opens a new tab'});
        }
    }
    const catalogFile = path.join(root, 'downloads/catalog.json');
    if (fs.existsSync(catalogFile)) {
        const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
        for (const item of catalog.items || []) for (const file of item.files || []) {
            if (!file.local) continue;
            inventoryEntries++;
            let url;
            try { url = new URL(file.local, origin); } catch { failures.push({page: 'downloads/catalog.json', issue: 'invalid local inventory URL'}); continue; }
            if (url.origin !== origin || !url.pathname.startsWith('/downloads/')) { failures.push({page: 'downloads/catalog.json', issue: 'local inventory URL is not hosted under /downloads/'}); continue; }
            record(url, 'downloads/catalog.json', file.bytes);
        }
    }
    return {
        mode: 'read-only local file audit; remote availability and device saving are not claimed',
        pages: files.length,
        localDownloadAnchors: localAnchors,
        uniqueHostedFiles: hosted.size,
        hostedBytes: [...hosted.values()].reduce((total, entry) => total + entry.bytes, 0),
        inventoryEntries,
        externalDirectAnchors,
        externalHosts,
        failures,
        warningCount: warnings.length,
        warnings
    };
}
module.exports = {audit};
if (require.main === module) {
    const result = audit();
    if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else {
        console.log(`Audited ${result.pages} HTML pages, ${result.localDownloadAnchors} hosted download anchors, ${result.uniqueHostedFiles} unique hosted files and ${result.inventoryEntries} public inventory entries.`);
        console.log(`${result.failures.length} file failures; ${result.warningCount} link enhancement findings; ${result.externalDirectAnchors} external direct-file links (availability not checked).`);
        for (const failure of result.failures) console.error(JSON.stringify(failure));
        const grouped = {};
        for (const warning of result.warnings) grouped[warning.issue] = (grouped[warning.issue] || 0) + 1;
        for (const [issue, count] of Object.entries(grouped)) console.log(`${count}: ${issue}`);
    }
    process.exitCode = result.failures.length ? 1 : 0;
}
