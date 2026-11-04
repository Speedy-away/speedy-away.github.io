const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const zlib = require('node:zlib');
const {inspectZip} = require('../archive-switch-homebrew.cjs');
const {isBuild} = require('../archive-wiiu-homebrew.cjs');
const root = path.resolve(__dirname, '../..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const html = file => fs.readFileSync(path.join(root, file), 'utf8');
const localPath = url => {
  assert.match(url, /^\/(?!\/)/, 'Use an origin-relative public file');
  const resolved = path.resolve(root, decodeURIComponent(url.split(/[?#]/)[0]).slice(1));
  assert.ok(!path.relative(root, resolved).startsWith('..'), 'Public path stays within checkout');
  return resolved;
};
function verifyFile(file) {
  const bytes = fs.readFileSync(localPath(file.local));
  assert.equal(bytes.length, file.bytes, file.local + ' byte count');
  assert.equal(hash(bytes), file.sha256, file.local + ' SHA-256');
  return bytes;
}

test('Wii U expansion preserves every baseline version, original URL and thirty local file hashes', () => {
  const baseline = read('docs/qa/wiiu-more-baseline.json');
  assert.equal(baseline.apps.length, 16);
  assert.equal(baseline.files.length, 30);
  assert.equal(hash(fs.readFileSync(path.join(root, 'docs/wiiu-homebrew-catalog.json'))), baseline.catalogSha256);
  assert.equal(hash(fs.readFileSync(path.join(root, 'docs/wiiu-homebrew-downloads.json'))), baseline.downloadsSha256);
  assert.deepEqual(read('docs/wiiu-homebrew-catalog.json').apps, baseline.apps);
  const page = html('console/retro/wiiu.html');
  for (const app of baseline.apps) {
    assert.ok(page.includes(`id="${app.id}"`), 'Preserved anchor ' + app.id);
    assert.ok(page.includes(app.packageUrl), 'Preserved original package ' + app.id);
  }
  for (const file of baseline.files) {
    verifyFile(file);
    assert.ok(page.includes(file.local), 'Preserved visible download ' + file.local);
  }
});

test('additional Wii U apps retain complete original containers and real console headers, with local archive provenance', () => {
  const baseline = read('docs/wiiu-homebrew-catalog.json').apps;
  const extra = read('docs/wiiu-homebrew-extra-catalog.json');
  const downloads = read('docs/wiiu-homebrew-extra-downloads.json').apps;
  const inventory = read('docs/wiiu-more-apps-private-inventory.json');
  const store = read('docs/wiiu-homebrew-extra-repo-snapshot.json').packages;
  const page = html('console/retro/wiiu.html');
  assert.equal(extra.platform, 'Wii U');
  assert.ok(extra.apps.length >= 18, 'Substantial additional selection');
  assert.equal(new Set([...baseline, ...extra.apps].map(app => app.id)).size, baseline.length + extra.apps.length);
  for (const app of extra.apps) {
    const record = downloads.find(item => item.id === app.id);
    assert.ok(record, app.id + ' download record');
    assert.equal(record.status, 'downloaded', app.id + ' archived console build');
    assert.equal(record.version, app.version, app.id + ' pinned version');
    assert.ok(app.requirements && app.install && app.project && app.tags.length);
    assert.match(app.packageUrl, /^https:\/\/wiiu\.cdn\.fortheusers\.org\/zips\/[^/]+\.zip$/);
    assert.equal(record.package.source, app.packageUrl);
    assert.equal(record.package.version, app.version);
    assert.equal(record.package.archived, true);
    const card = page.split(`<article id="${app.id}"`)[1]?.split('</article>')[0];
    assert.ok(card, app.id + ' visible application card');
    assert.ok(card.includes(record.package.local), app.id + ' complete package available from card');
    const original = verifyFile(record.package);
    const source = store.find(item => item.name === app.id);
    assert.equal(app.version, source.version, app.id + ' captured store version');
    assert.equal(app.storeMD5, source.md5, app.id + ' captured store MD5');
    assert.equal(crypto.createHash('md5').update(original).digest('hex'), app.storeMD5.toLowerCase().padStart(32, '0'), app.id + ' original package MD5');
    const entries = inspectZip(original);
    assert.deepEqual(entries.map(({data, ...metadata}) => metadata), record.members, app.id + ' every original companion asset retained');
    const builds = entries.filter(entry => !entry.directory && /\.(?:wuhb|rpx|wps|wms|elf)$/i.test(entry.path));
    assert.ok(builds.length, app.id + ' contains console executables');
    assert.deepEqual(builds.map(entry => entry.path), record.buildPaths);
    for (const build of builds) assert.equal(isBuild(build.data, build.path), true, app.id + ': ' + build.path);
    assert.ok(!entries.some(entry => /\.nro$/i.test(entry.path)), app.id + ' excludes Switch executables');
    const archived = inventory.items.find(item => item.id === 'wiiu-more-apps-' + app.id);
    assert.equal(archived?.platform, 'Wii U', app.id + ' archive platform');
    const file = archived.files.find(file => file.local === record.package.local && file.sha256 === record.package.sha256);
    assert.ok(file, app.id + ' scoped inventory reference');
    assert.match(file.backupPath, /^F:[\\/]whatsite-backup-downloads-etc[\\/]files[\\/]Wii U[\\/]/);
    assert.equal(file.sourceUrl, app.packageUrl);
    assert.equal(file.version, app.version);
    assert.equal(file.bytes, original.length);
    assert.deepEqual(file.archiveRole, ['Builds'], app.id + ' ready console build classification');
    const backup = fs.readFileSync(file.backupPath);
    assert.equal(hash(backup), file.sha256, app.id + ' archive byte integrity');
    if (app.image) {
      assert.equal(app.iconUrl, `https://wiiu.cdn.fortheusers.org/packages/${app.id}/icon.png`, app.id + ' icon provenance');
      assert.equal(fs.readFileSync(localPath(app.image)).subarray(0, 8).toString('hex'), '89504e470d0a1a0a', app.id + ' local PNG icon');
    }
  }
});

test('Wii U pages preserve language/mobile/background integration and all local resources resolve', () => {
  for (const file of ['console/retro/wiiu.html', 'console/retro/wiiu-themes.html']) {
    const page = html(file);
    assert.match(page, /\/languages\/i18n\.js\?v=3/);
    assert.equal([...page.matchAll(/<link\b[^>]+href="\/assets\/mobile\.css\?/g)].length, 1);
    assert.match(page, /\/assets\/site-background\.css\?/);
    assert.match(page, /\/assets\/site-background\.js\?/);
    assert.doesNotMatch(page, /<(?:video|iframe)\b|youtube(?:-nocookie)?\.com\/embed/i);
    const ids = [...page.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, file + ' unique anchors');
    for (const [, attribute, url] of page.matchAll(/\b(href|src)="([^"<>]+)"/g)) {
      if (url.startsWith('#')) assert.ok(ids.includes(url.slice(1)), file + ' local anchor ' + url);
      if (!url.startsWith('/') || url.startsWith('//')) continue;
      const resolved = localPath(url.replaceAll('&amp;', '&'));
      const target = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() ? path.join(resolved, 'index.html') : resolved;
      assert.ok(fs.existsSync(target), file + ' ' + attribute + ': ' + url);
    }
  }
  const page = html('console/retro/wiiu.html');
  const expected = read('docs/wiiu-homebrew-catalog.json').apps.length + read('docs/wiiu-homebrew-extra-catalog.json').apps.length;
  assert.equal([...page.matchAll(/\bdata-wiiu-app\b/g)].length, expected, 'Every original and additional app is rendered');
  const collection = [...page.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map(match => JSON.parse(match[1])).find(item => item['@type'] === 'CollectionPage');
  assert.equal(collection.mainEntity.numberOfItems, expected, 'Structured search data reflects all apps');
  assert.equal(collection.mainEntity.itemListElement.length, expected);
});

test('curated Wii U themes retain original patch archives, embedded author/version metadata and separate ready tools', () => {
  const catalog = read('docs/themezer-wiiu-catalog.json');
  const inventory = read('docs/wiiu-themes-private-inventory.json');
  const page = html('console/retro/wiiu-themes.html');
  assert.ok(catalog.themes.length >= 6, 'At least six ready themes');
  assert.equal(new Set(catalog.themes.map(theme => theme.id)).size, catalog.themes.length);
  for (const theme of catalog.themes) {
    assert.equal(theme.platform, 'Wii U');
    assert.ok(theme.title && theme.author && theme.version && theme.requirements);
    assert.match(theme.sourceUrl, /^https:\/\/themezer\.net\/wiiu\//);
    assert.ok(fs.existsSync(localPath(theme.image)), theme.title + ' preview');
    const file = theme.download;
    assert.equal(theme.localDownload, file.local);
    assert.ok(page.includes(theme.localDownload), theme.title + ' visible downloadable theme');
    assert.ok(page.includes(theme.sourceUrl), theme.title + ' attribution source');
    assert.match(file.name, /\.utheme$/i);
    assert.equal(theme.version, file.version);
    const original = verifyFile(file);
    const entries = inspectZip(original);
    const metadata = JSON.parse(entries.find(entry => entry.path === 'metadata.json').data).Metadata;
    assert.deepEqual(metadata, theme.packageMetadata, theme.title + ' original embedded metadata');
    assert.equal(metadata.themeName, theme.title);
    assert.equal(metadata.themeVersion, theme.version);
    assert.match(metadata.themeID, /^Themezer:[0-9A-F]+$/);
    const patches = entries.filter(entry => /\.bps$/i.test(entry.path));
    assert.ok(patches.length, theme.title + ' original patches');
    assert.equal(patches.length, theme.patches.length);
    for (const patch of patches) {
      assert.equal(patch.data.subarray(0, 4).toString(), 'BPS1', theme.title + ': ' + patch.path);
      const detail = theme.patches.find(item => item.name === patch.path);
      assert.ok(detail, theme.title + ' exact patch record ' + patch.path);
      assert.equal(detail.bytes, patch.data.length);
      assert.equal(detail.sha256, hash(patch.data));
      const hex = number => number.toString(16).padStart(8, '0');
      assert.equal(detail.sourceCrc32, hex(patch.data.readUInt32LE(patch.data.length - 12)));
      assert.equal(detail.targetCrc32, hex(patch.data.readUInt32LE(patch.data.length - 8)));
      assert.equal(detail.patchCrc32, hex(zlib.crc32(patch.data.subarray(0, -4))));
      assert.equal(detail.patchCrc32, hex(patch.data.readUInt32LE(patch.data.length - 4)));
      assert.ok(detail.sourceBytes > 0 && detail.targetBytes > 0, theme.title + ' exact base size requirements retained');
    }
    assert.ok(!entries.some(entry => /\.(?:nro|pack|dol)$/i.test(entry.path)), theme.title + ' uses Wii U patch format');
    const archived = inventory.items.flatMap(item => item.files || []).find(item => item.local === file.local && item.sha256 === file.sha256);
    assert.ok(archived, theme.title + ' scoped inventory reference');
    assert.equal(archived.sourceUrl, file.sourceUrl);
    assert.equal(archived.version, theme.version);
    assert.equal(archived.bytes, original.length);
    assert.equal(hash(fs.readFileSync(archived.backupPath)), file.sha256, theme.title + ' archive byte integrity');
  }
  for (const tool of catalog.tools) {
    const file = tool.download;
    const bytes = verifyFile(file);
    assert.equal(file.sourceUrl, tool.sourceUrl);
    assert.equal(file.version, tool.version);
    assert.ok(tool.requirements && tool.installPath);
    assert.match(file.name, /\.(?:wuhb|wps|zip)$/i);
    if (/\.(?:wuhb|wps)$/i.test(file.name)) assert.equal(isBuild(bytes, file.name), true, file.name + ' Wii U build header');
    const archived = inventory.items.flatMap(item => item.files || []).find(item => item.local === file.local && item.sha256 === file.sha256);
    assert.ok(archived, file.name + ' scoped inventory reference');
    assert.equal(hash(fs.readFileSync(archived.backupPath)), file.sha256, file.name + ' archive byte integrity');
  }
  for (const id of ['themiify', 'stylemiiu']) assert.ok(catalog.tools.some(tool => tool.id === id), id + ' required ready dependency');
});

test('Wii U filters combine search/category, translate counts, clear empty results and reveal bookmarked apps', () => {
  const listeners = {}, windowListeners = {};
  function input() { return {value: '', addEventListener(name, callback) { this[name] = callback; }, focus() { this.focused = true; }}; }
  const search = input(), category = input(), clear = input(), count = {}, empty = {};
  const apps = [
    {id: 'alpha', dataset: {category: 'Homebrew games', search: 'Café Arcade WUHB'}, hidden: false, scrollIntoView() { this.scrolled = true; }},
    {id: 'beta', dataset: {category: 'Emulators', search: 'Console Emulation RPX'}, hidden: false, scrollIntoView() { this.scrolled = true; }}
  ];
  const nodes = {'[data-wiiu-search]': search, '[data-wiiu-category]': category, '[data-wiiu-clear]': clear, '[data-wiiu-count]': count, '[data-wiiu-empty]': empty};
  const location = {hash: ''};
  const window = {addEventListener(name, callback) { windowListeners[name] = callback; }, __scoobyI18n: {t(source, args) { listeners.translated = [source, args]; return 'translated ' + args.count; }}};
  vm.runInNewContext(html('assets/wiiu-homebrew.js'), {document: {querySelector: selector => nodes[selector], querySelectorAll: () => apps}, window, location});
  assert.equal(count.textContent, 'translated 2');
  search.value = 'cafe WUHB'; search.input();
  assert.deepEqual(apps.map(app => app.hidden), [false, true]);
  category.value = 'Emulators'; category.change();
  assert.deepEqual(apps.map(app => app.hidden), [true, true]);
  assert.equal(empty.hidden, false);
  clear.click();
  assert.equal(search.value, ''); assert.equal(category.value, ''); assert.equal(search.focused, true);
  assert.deepEqual(apps.map(app => app.hidden), [false, false]);
  search.value = 'nothing'; search.input(); location.hash = '#beta'; windowListeners.hashchange();
  assert.equal(apps[1].hidden, false); assert.equal(apps[1].scrolled, true); assert.equal(search.value, '');
  windowListeners['scooby:langchange']();
  assert.equal(listeners.translated[0], '{count} apps');
});
