'use strict';
// Stage Pages independently of the complete, version-preserving Git archive.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const LIMIT = 900 * 1024 * 1024;
const encodePath = name => name.split('/').map(encodeURIComponent).join('/');
function rawURL(name, revision = 'main') {
  if (!/^(?:main|[a-f0-9]{40})$/.test(revision)) throw Error('Invalid repository revision');
  return 'https://raw.githubusercontent.com/Speedy-away/whatsite/' + revision + '/' + encodePath(name);
}
function eligible(name) {
  return (/^(?:downloads|hosts\/runtime)\//.test(name) || !name.split('/').some(p => p.startsWith('.'))) &&
    !/^(?:scripts|i18n-tools|design-references)\//.test(name) &&
    !/^docs\/(?:qa|screenshots|host-reviews)\//.test(name) &&
    !/^(?:AGENTS\.md|SYNC\.md|sync\.ps1|skills-lock\.json)$/.test(name);
}
function plan(root = ROOT, names, revision = 'main') {
  const karoBuild = path.join(root, 'docs/host-reviews/karo/build.json');
  const activeKaro = fs.existsSync(karoBuild) ? JSON.parse(fs.readFileSync(karoBuild, 'utf8')).runtime?.replace(/^\//, '').replace(/web\/$/, '') : null;
  const protectedFiles = new Set();
  for (const file of fs.readdirSync(path.join(root, 'docs')).filter(n => /actions.*\.json$/.test(n))) {
    const data = JSON.parse(fs.readFileSync(path.join(root, 'docs', file), 'utf8'));
    for (const action of data.actions || []) if (action.downloadURL?.startsWith('/downloads/')) {
      protectedFiles.add(decodeURIComponent(action.downloadURL.slice(1)));
    }
  }
  // Unpublished intermediate KARO assemblies remain in Git and their complete
  // archived ZIPs; deploy the current assembly selected by its build report.
  const files = [...new Set(names)].filter(eligible).filter(name => !/^hosts\/runtime\/karo-/.test(name) || !activeKaro || name.startsWith(activeKaro)).map(name => ({name, bytes: fs.statSync(path.join(root, name)).size}));
  let bytes = files.reduce((sum, f) => sum + f.bytes, 0);
  const candidates = files.filter(f =>
    (f.name.startsWith('downloads/') && !protectedFiles.has(f.name) && !/\.(?:html|js|mjs|css|json|wasm|txt|md|xml|ini|cfg|conf|lua|gsc|csc|c|cc|cpp|h|hpp|py|ps1|sh|bat|cmd|ct|cht|csv|tsv|yml|yaml|toml|svg|png|jpe?g|webp|gif|avif|ico)$/i.test(f.name)) ||
    /^assets\/images\/.+\.(?:png|jpe?g|webp|gif|avif|svg|ico)$/i.test(f.name) ||
    /^hosts\/runtime\/karo-[^/]+\/web\/.+\.(?:bin|elf|bz2|zip)$/i.test(f.name)
  ).sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
  const offloaded = new Map();
  for (const file of candidates) {
    if (bytes <= LIMIT) break;
    offloaded.set(file.name, rawURL(file.name, revision));
    bytes -= file.bytes;
  }
  if (bytes > LIMIT) throw Error('Required Pages files exceed the 900 MiB deployment budget');
  return {files, offloaded, bytes, protectedFiles};
}
function rewriter(offloaded) {
  const forms = new Map();
  for (const [name, url] of offloaded) for (const form of new Set([name, encodePath(name), encodeURI(name)])) {
    forms.set('/' + form, url);
  }
  const pattern = new RegExp('(?<![a-zA-Z0-9_./%:-])(?:https://whatwhatboy\\.com)?(?:' + [...forms.keys()].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-zA-Z0-9_%./-])', 'g');
  return (source, name) => {
    source = source.replace(pattern, match => forms.get(match.replace(/^https:\/\/whatwhatboy\.com/, '')) || match);
    // Relative HTML attributes and CSS URLs also resolve against their document.
    const replaceRelative = (whole, prefix, value, suffix) => {
      if (/^(?:[a-z]+:|\/\/|#)/i.test(value)) return whole;
      try {
        const parsed = new URL(value.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&#x27;', "'"), 'https://whatwhatboy.com/' + name);
        const target = offloaded.get(decodeURIComponent(parsed.pathname.slice(1)));
        return target ? prefix + target + parsed.search + parsed.hash + suffix : whole;
      } catch { return whole; }
    };
    return source.replace(/((?:href|src)=)(["'])(.*?)\2/g, (whole, prefix, quote, value) => replaceRelative(whole, prefix + quote, value, quote))
      .replace(/(url\(["']?)([^"'<>\s)]+)(["']?\))/g, replaceRelative);
  };
}
function build({root = ROOT, output = path.join(ROOT, 'tmp/pages-build'), revision = 'main', names} = {}) {
  names ||= execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {cwd: root, maxBuffer: 64 * 1024 * 1024}).toString().split('\0').filter(Boolean);
  if (fs.existsSync(output)) throw Error('Use a fresh output directory; existing files are never removed');
  const result = plan(root, names, revision), rewrite = rewriter(result.offloaded);
  const runtimeFiles = Object.fromEntries([...result.offloaded].filter(([name]) => name.startsWith('hosts/runtime/')).map(([name, url]) => ['/' + name, url]));
  for (const {name} of result.files) {
    if (result.offloaded.has(name)) continue;
    const destination = path.join(output, name);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    // Immutable downloads and receiver snapshots keep their exact archived bytes.
    if ((!name.startsWith('downloads/') || name === 'downloads/index.html') && !/^console\/ps[45]\/whatsite-ps[45]\.html$/.test(name) && /\.(?:html|js|css|json|xml|md|txt)$/i.test(name)) {
      let content = rewrite(fs.readFileSync(path.join(root, name), 'utf8'), name);
      if (/^hosts\/runtime\/karo-[^/]+\/web\/.+\.html$/i.test(name) && Object.keys(runtimeFiles).length) {
        const adapter = '<script src="/pages-runtime-map.js"></script><script src="/assets/pages-runtime-files.js"></script>';
        content = /<head\b[^>]*>/i.test(content) ? content.replace(/<head\b[^>]*>/i, head => head + adapter) : adapter + content;
      }
      fs.writeFileSync(destination, content);
    } else fs.copyFileSync(path.join(root, name), destination);
  }
  const mapping = Object.fromEntries([...result.offloaded].map(([name, url]) => ['/' + name, url]));
  fs.writeFileSync(path.join(output, 'pages-download-map.json'), JSON.stringify(mapping));
  fs.writeFileSync(path.join(output, 'pages-runtime-map.js'), 'window.WHATSITE_RUNTIME_FILES=' + JSON.stringify(runtimeFiles).replaceAll('<', '\\u003c') + ';');
  fs.writeFileSync(path.join(output, '.nojekyll'), '');
  // Old bookmarked download paths still offer the exact repository file.
  const fallback = '<script>if(location.pathname.indexOf("/downloads/")===0){fetch("/pages-download-map.json",{cache:"no-store"}).then(function(r){return r.json()}).then(function(m){var u=m[decodeURIComponent(location.pathname)];if(u)location.replace(u)}).catch(function(){})}</script>';
  const errorPage = path.join(output, '404.html');
  fs.appendFileSync(errorPage, fallback);
  const report = {revision, bytes: result.bytes, budget: LIMIT, hostedFiles: result.files.length-result.offloaded.size, repositoryFiles: result.offloaded.size, protectedNativeFiles: result.protectedFiles.size};
  fs.writeFileSync(path.join(output, 'pages-build.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  return report;
}
if (require.main === module) build({output: process.argv[2] && path.resolve(process.argv[2]), revision: process.env.GITHUB_SHA || 'main'});
module.exports = {build, plan, rewriter, rawURL, eligible, LIMIT};
