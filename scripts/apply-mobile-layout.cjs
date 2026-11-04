// Reapply after regenerating pages. --check verifies integration without writes.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const version = '3.3.0';
const mobileVersion = '3.3.8';
const downloadVersion = '3.3.8';
const sharedScriptVersion = '3.3.9';
const excluded = new Set(['.git','.agents','.codex','.claude','.playwright','.playwright-cli','node_modules','assets','docs','design-references','downloads','languages','i18n-tools','scripts','tmp']);
const {describeDownload} = require('../assets/mobile-downloads.js');
const decode = value => String(value).replace(/&amp;|&#38;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'");
const attr = (tag,name) => { const match=tag.match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i')); return match ? decode(match[1] ?? match[2] ?? match[3]) : ''; };
const escapeAttribute = value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function compareVersions(left, right) {
    if (!/^\d+(?:\.\d+)*$/.test(left) || !/^\d+(?:\.\d+)*$/.test(right)) return null;
    const a = left.split('.').map(BigInt), b = right.split('.').map(BigInt);
    for (let index = 0; index < Math.max(a.length,b.length); index++) {
        const difference = (a[index] || 0n) - (b[index] || 0n);
        if (difference) return difference > 0n ? 1 : -1;
    }
    return 0;
}
function minimumAssetURL(value, minimum) {
    const hashAt = value.indexOf('#'), hash = hashAt < 0 ? '' : value.slice(hashAt);
    const address = hashAt < 0 ? value : value.slice(0,hashAt), queryAt = address.indexOf('?');
    if (queryAt < 0) return address + '?v=' + minimum + hash;
    let found = false;
    const query = address.slice(queryAt+1).replace(/(^|&(?:amp;)?)v=([^&]*)/g, (match, separator, token) => {
        found = true;
        let current = token;
        try { current = decodeURIComponent(token); } catch (_) {}
        const comparison = compareVersions(current,minimum);
        // An opaque cache token has no reliable age. Preserve it rather than
        // replacing a different generator's current asset identity.
        return comparison !== null && comparison < 0 ? separator + 'v=' + minimum : match;
    });
    return address.slice(0,queryAt+1) + query + (found ? '' : (query ? '&amp;' : '') + 'v=' + minimum) + hash;
}
function currentMobileAsset(html, name, minimum) {
    const expression = new RegExp('(?:href|src)=["\']([^"\']*\\/assets\\/' + name.replaceAll('.','\\.') + '(?:[?#][^"\']*)?)["\']','gi');
    let selected = '/assets/' + name + '?v=' + minimum;
    const cacheVersion = value => {
        const token = value.split('#')[0].match(/(?:\?|&(?:amp;)?)v=([^&]*)/)?.[1];
        try { return token === undefined ? minimum : decodeURIComponent(token); } catch (_) { return token; }
    };
    for (const match of html.matchAll(expression)) {
        const candidate = minimumAssetURL(match[1],minimum);
        const comparison = compareVersions(cacheVersion(candidate),cacheVersion(selected));
        const candidateOpaque = compareVersions(cacheVersion(candidate),minimum) === null;
        const selectedOpaque = compareVersions(cacheVersion(selected),minimum) === null;
        if (candidateOpaque && !selectedOpaque || !candidateOpaque && !selectedOpaque && comparison >= 0) selected = candidate;
    }
    return selected;
}
function pages(dir = root) {
    if (/^hosts\/runtime(?:\/|$)/.test(path.relative(root,dir).replaceAll('\\','/'))) return [];
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory()
        ? entry.name === 'downloads' && dir === root
            ? fs.existsSync(path.join(dir,entry.name,'index.html')) ? [path.join(dir,entry.name,'index.html')] : []
            : excluded.has(entry.name) ? [] : pages(path.join(dir, entry.name))
        : /^whatsite-ps[45]\.html$/.test(entry.name) ? []
            : entry.name.endsWith('.html') ? [path.join(dir, entry.name)] : []);
}
function improve(html) {
    // These downloadable console helpers embed their own mobile CSS and JS.
    // Preserve their archived bytes and avoid dependencies on missing LAN assets.
    if (html.includes('id="receiver-catalog"') && /<title>PS[45] Download Receiver \| whatwhatboy<\/title>/.test(html)) return html;
    if (!/<head\b/i.test(html)) return html;
    // A slow optional ad request must not stop the parser before page styles,
    // navigation and download controls have been created.
    html = html.replace(/<script\b[^>]*\bsrc=["']https:\/\/abscloud\.org\/[^"']+["'][^>]*>/gi, tag =>
        /\s(?:async|defer)(?:\s|=|>)/i.test(tag) ? tag : tag.replace(/^<script\b/i, '<script async'));
    html = html.replace(/(<meta\b[^>]*name=["']viewport["'][^>]*content=["'])[^"']*(["'][^>]*>)/i, '$1width=device-width, initial-scale=1.0, viewport-fit=cover$2');
    if (!/<meta\b[^>]*name=["']viewport["']/i.test(html)) html = html.replace(/<head\b[^>]*>/i, '$&\n<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
    // Shared filenames remain valid from root and nested page paths.
    const normalize = (expression, minimum) => { html = html.replace(expression, (_match, prefix, url, quote) => prefix + minimumAssetURL(url,minimum) + quote); };
    normalize(/((?:href|src)=["'])([^"']*\/(?:console-guides|console-downloads|console-launcher|console-receiver|console-game-patches|ps3-catalog|ps3-browser-downloads|nintendo-switch-homebrew|steamdeck)\.css(?:[?#][^"']*)?)(["'])/g, version);
    normalize(/(src=["'])((?:[^"']*\/)?script\.js(?:[?#][^"']*)?)(["'])/g, sharedScriptVersion);
    normalize(/(href=["'])([^"']*free-keys\/key-page\.css(?:[?#][^"']*)?)(["'])/g, '3.1.29');
    normalize(/(href=["'])([^"']*free-keys\/page-access\.css(?:[?#][^"']*)?)(["'])/g, '2');
    normalize(/(src=["'])([^"']*(?:free-keys\/|\.\.\/)key\.js(?:[?#][^"']*)?)(["'])/g, version);
    const mobileStyle = currentMobileAsset(html,'mobile.css',mobileVersion);
    const downloadStyle = currentMobileAsset(html,'mobile-downloads.css',downloadVersion);
    const downloadScript = currentMobileAsset(html,'mobile-downloads.js',downloadVersion);
    html = html.replace(/\s*<link\b[^>]*href=["'][^"']*\/assets\/mobile\.css(?:[?#][^"']*)?["'][^>]*>/gi, '');
    html = html.replace(/\s*<link\b[^>]*href=["'][^"']*\/assets\/mobile-downloads\.css(?:[?#][^"']*)?["'][^>]*>/gi, '');
    html = html.replace(/\s*<script\b[^>]*src=["'][^"']*\/assets\/mobile-downloads\.js(?:[?#][^"']*)?["'][^>]*>\s*<\/script>/gi, '');
    let styles = '';
    if (/class=["'][^"']*receiver-/.test(html) && !/href=["'][^"']*console-receiver\.css/.test(html)) styles += '\n<link rel="stylesheet" href="/assets/console-receiver.css?v=' + version + '">';
    html = html.replace(/\s*<\/head>/i, styles + '\n<link rel="stylesheet" href="' + mobileStyle + '">\n<link rel="stylesheet" href="' + downloadStyle + '">\n<script defer src="' + downloadScript + '"></script>\n</head>');
    if (/id=["']mobile-sidebar-btn["']/.test(html) && !/class=["']mobile-site-header["']/.test(html)) {
        html = html.replace(/<button\b[^>]*id=["']mobile-sidebar-btn["'][^>]*>[\s\S]*?<\/button>/i, button => '<header class="mobile-site-header">\n' + button + '\n<a class="mobile-brand" href="/" aria-label="whatwhatboy home"><img src="/assets/images/logo.png" width="26" height="26" alt=""><span>whatwhatboy</span></a>\n</header>');
    }
    if (/id=["']main-content["']/.test(html) && !/class=["']skip-link["']/.test(html)) html = html.replace(/<body\b[^>]*>/i, '$&\n<a class="skip-link" href="#main-content">Skip to content</a>');
    html = html.replace(/<div\b([^>]*class=["'][^"']*main-content[^"']*["'][^>]*)>/i, (tag, attrs) => /\brole=/.test(attrs) ? tag : '<div' + attrs + ' role="main" tabindex="-1">');
    html = html.replace(/<input\b[^>]*>/gi, tag => {
        if (/\b(?:aria-label|aria-labelledby)=/.test(tag)) return tag;
        const id = tag.match(/\bid=["']([^"']+)["']/)?.[1];
        if (id && html.includes('for="' + id + '"')) return tag;
        const placeholder = tag.match(/\bplaceholder=["']([^"']+)["']/)?.[1];
        const label = id === 'argInput' ? 'GTA V launch argument' : placeholder;
        return label ? tag.replace(/>$/, ' aria-label="' + label.replaceAll('"', '&quot;') + '">') : tag;
    });
    html = html.replace(/<button\b[^>]*id=["']back-to-top["'][^>]*>/gi, tag => /aria-label=/.test(tag) ? tag : tag.replace(/>$/, ' aria-label="Back to top">'));
    html = html.replace(/<span\b([^>]*class=["']modal-close["'][^>]*)>([\s\S]*?)<\/span>/gi, '<button type="button"$1 aria-label="Close image">$2</button>');
    const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0];
    const base = canonical ? attr(canonical,'href') || 'https://whatwhatboy.com/' : 'https://whatwhatboy.com/';
    html = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, element => {
        let tag = element.match(/^<a\b[^>]*>/i)[0];
        if (/\b(?:data-receiver-file|data-receiver-open|data-client-open|data-webman-file|data-no-file-options)\b|loader-download|loaderDownload|providerLink/i.test(tag)) return element;
        const explicitDownload = /\sdownload(?:\s|=|>)/i.test(tag);
        const info = describeDownload(attr(tag,'href'),base,{explicitDownload,downloadName:attr(tag,'download'),label:decode(element.replace(/<[^>]*>/g,' '))});
        if (!info || !info.sameOrigin) return element;
        if (!attr(tag,'download')) {
            tag=tag.replace(/\sdownload(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|>)/i,'');
            tag=tag.replace(/>$/,' download="'+escapeAttribute(info.filename)+'">');
        }
        tag=tag.replace(/\s+target\s*=\s*(?:"_blank"|'_blank'|_blank)(?=\s|>)/i,'');
        return tag + element.slice(element.indexOf('>')+1);
    });
    return html;
}
module.exports = {pages, improve};
if (require.main === module) {
const check = process.argv.includes('--check');
let changed = 0;
const files = pages();
for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const after = improve(before);
    if (before === after) continue;
    changed++;
    if (check) console.error(path.relative(root, file) + ': mobile integration needs refresh');
    else fs.writeFileSync(file, after);
}
console.log(`${files.length} HTML pages checked; ${changed} ${check ? 'need updates' : 'updated'}.`);
if (check && changed) process.exitCode = 1;
}
