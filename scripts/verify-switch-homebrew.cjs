const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {isNro, inspectZip} = require('./archive-switch-homebrew.cjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const catalogue = JSON.parse(read('docs/switch-homebrew-catalog.json'));
const manifest = JSON.parse(read('docs/switch-homebrew-downloads.json'));
const inventory = JSON.parse(read('docs/download-audit.json'));
const sitemap = read('sitemap.xml');
const issues = [];
const checkedFiles = new Set();
const check = (condition, message) => { if (!condition) issues.push(message); };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const localPath = value => path.join(root, decodeURIComponent(value.replace(/^\//, '')));
for (const file of ['console/nintendo-switch.html', 'console/nintendo-switch/apps.html']) {
  const html = read(file), ids = [...html.matchAll(/\bid="([^"]*)"/g)].map(match => match[1]);
  check(new Set(ids).size === ids.length, file + ': duplicate IDs');
  check(html.includes('/languages/i18n.js?v=3') || html.includes('../languages/i18n.js?v=3'), file + ': missing language runtime');
  check(html.includes('https://hb-app.store/'), file + ': missing original store URL');
  check(!/<(?:video|iframe)\b|youtube(?:-nocookie)?\.com\/embed/i.test(html), file + ': unexpected video');
  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/)?.[1];
  check(canonical && sitemap.includes('<loc>' + canonical + '</loc>'), file + ': canonical missing from sitemap');
  for (const match of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
    const value = match[1].replaceAll('&amp;', '&');
    if (/^(?:https?:|mailto:|data:|javascript:)/i.test(value) || value === '#') continue;
    const url = new URL(value, 'https://whatwhatboy.com/' + file);
    let target = localPath(url.pathname);
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    check(fs.existsSync(target), file + ': missing ' + value);
    if (fs.existsSync(target) && url.hash && target.endsWith('.html')) check(fs.readFileSync(target, 'utf8').includes('id="' + decodeURIComponent(url.hash.slice(1)) + '"'), file + ': missing anchor ' + value);
  }
}
const hub = read('console/nintendo-switch.html');
for (const anchor of ['cfw', 'homebrew', 'firmware-downloads']) check(hub.includes('id="' + anchor + '"'), 'Hub lost #' + anchor);
check(hub.includes('https://darthsternie.net/switch-firmwares/'), 'Hub lost Darthsternie firmware archive');
check(hub.includes('data-original-href="https://github.com/atmosphere-nx/atmosphere/releases"'), 'Hub lost Atmosphère source');
check(hub.includes('data-original-href="https://github.com/CTCaer/hekate/releases"'), 'Hub lost Hekate source');
for (const app of catalogue.apps) {
  const entry = manifest.apps.find(record => record.id === app.id);
  check(entry?.status === 'downloaded' && entry.version === app.version, app.id + ': missing verified download');
  if (!entry) continue;
  const primary = app.standaloneNro && entry.officialNro || (entry.requiresBundle ? entry.package : entry.nro || entry.package);
  check(primary?.local && fs.existsSync(localPath(primary.local)), app.id + ': no ready local build');
  const item = inventory.items.find(record => record.id === 'switch-homebrew-' + app.id);
  check(item, app.id + ': missing archive inventory');
  for (const file of [entry.package, entry.nro, entry.officialNro, entry.officialBundle].filter(Boolean)) {
    const archived = item?.files.find(record => record.sha256 === file.sha256 && record.bytes === file.bytes);
    check(archived && (archived.sourceUrl === file.source || archived.resolvedUrl === file.source || item.sourceUrls?.includes(file.source)), app.id + ': source URL absent from inventory for ' + file.name);
    check(archived?.backupPath && fs.existsSync(archived.backupPath), app.id + ': archive file absent for ' + file.name);
    if (archived?.backupPath && fs.existsSync(archived.backupPath)) {
      const bytes = fs.readFileSync(archived.backupPath);
      check(bytes.length === file.bytes && hash(bytes) === file.sha256, app.id + ': archive checksum mismatch ' + file.name);
      if (/\.zip$/i.test(file.name)) {
        try { const members = inspectZip(bytes); check(members.some(member => /\.nro$/i.test(member.path)), app.id + ': bundle contains no NRO'); }
        catch (error) { issues.push(app.id + ': invalid ZIP ' + error.message); }
      } else if (/\.7z$/i.test(file.name)) check(bytes.subarray(0,6).equals(Buffer.from([0x37,0x7a,0xbc,0xaf,0x27,0x1c])) && file.inspected, app.id + ': uninspected 7z release bundle');
      else check(isNro(bytes), app.id + ': invalid NRO');
      checkedFiles.add(archived.backupPath);
    }
    if (file.local) {
      const bytes = fs.readFileSync(localPath(file.local));
      check(bytes.length === file.bytes && hash(bytes) === file.sha256, app.id + ': mirror checksum mismatch ' + file.name);
    }
  }
}
check(manifest.mirror.currentBytes <= manifest.mirror.budgetBytes, 'Switch mirror exceeds scoped budget');
for (const issue of issues) console.error(issue);
console.log('Verified ' + catalogue.apps.length + ' Switch apps, ' + checkedFiles.size + ' archived files, both pages and local links: ' + issues.length + ' issue(s).');
process.exitCode = issues.length ? 1 : 0;
