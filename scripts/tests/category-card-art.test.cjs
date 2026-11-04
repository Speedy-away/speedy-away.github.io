const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const art = require('../category-card-art.cjs');
const builder = require('../build-category-card-art.cjs');
const scope = require('../site-public-pages.cjs');
const manifest = require('../../docs/category-card-art.json');
const fixture = '<html><head><title>Fixture</title></head><body><main><article class="guide-resource" data-search="keep"><img src="/old.png" alt="Old image"><h3>Emulators</h3><p>Exact requirements 1.73 remain here.</p><div class="guide-links"><a href="/console/psvita/emulators.html">Browse</a><a href="/downloads/pinned-v1.vpk" download>Exact ready file</a></div></article><script>const version="1.73";</script></main></body></html>';
const links = html => [...html.matchAll(/<a\b[^>]*>/g)].map(x => x[0]);

test('category composition keeps links, pins, search terms and scripts and is idempotent', () => {
  const output = art.apply('console/psvita/home.html', fixture);
  assert.match(output, /data-category-art="\/console\/psvita\/emulators.html"/);
  assert.match(output, /mGBA/);
  assert.match(output, /DaedalusX64/);
  assert.deepEqual(links(output), links(fixture));
  assert.ok(output.includes('Exact requirements 1.73 remain here.'));
  assert.ok(output.includes('data-search="keep"'));
  assert.ok(output.includes('<script>const version="1.73";</script>'));
  assert.equal(art.apply('console/psvita/home.html', output), output);
  assert.equal((output.match(/category-card-art\.css/g) || []).length, 1);
});

test('downloaded HTML, ready receivers and vendored exploit hosts retain exact bytes', () => {
  for (const page of ['console/ps4/whatsite-ps4.html', 'console/ps5/whatsite-ps5.html', 'hosts/runtime/ps4-900/upstream/index.html', 'downloads/helper/index.html']) assert.equal(art.apply(page, fixture), fixture, page);
});

test('individual apps and catalogue files keep their own artwork even when setup links lead to a category', () => {
  for (const [title, attrs, url] of [
    ['Extreme Injector', '', '/tools/injectors.html'],
    ['DolphinPS4', ' data-file-id="ps4-dolphin"', '/console/ps4/emulators.html'],
    ['Nintendo Switch 2 · Eden NS2', '', '/pc/emulators.html#switch2'],
    ['NXThemes Installer 3.0.2', '', '/console/nintendo-switch/apps.html#NXthemes_Installer']
  ]) {
    const html = fixture.replace('data-search="keep"', 'data-search="keep"' + attrs).replace('<h3>Emulators</h3>', '<h3>' + title + '</h3>').replace('/console/psvita/emulators.html', url);
    assert.equal(art.apply('pages/fixture.html', html), html, title);
  }
  const family = fixture.replace('<h3>Emulators</h3>', '<h3>Nintendo Wii U</h3>').replace('href="/console/psvita/emulators.html"', 'href="/console/wiiu/"').replace('<a href="/downloads/pinned-v1.vpk" download>', '<a href="/console/wiiu/emulators.html">');
  assert.equal(art.apply('console/index.html', family), family, 'secondary emulator link does not redefine a console card');
});

test('emulator mixes reflect each destination and preserve the first real project logo label', () => {
  const vita = manifest.destinations['/console/psvita/emulators.html'];
  assert.deepEqual(vita.images.map(image => image.label), ['mGBA', 'DaedalusX64 vitaGL']);
  const psp = manifest.destinations['/console/psp/emulators.html'];
  assert.ok(psp.images.every(image => image.sourcePage === 'console/psp/emulators.html'));
  const pc = manifest.destinations['/pc/playstation-emulators.html'];
  assert.equal(pc.images.find(image => /PCSX2\.png$/.test(image.src)).label, 'PCSX2');
  const switchEmulators = manifest.destinations['/console/nintendo-switch/apps.html?category=Emulators'];
  assert.ok(switchEmulators.images.every(image => image.sourcePage === 'console/nintendo-switch/apps.html'));
  assert.ok(switchEmulators.images.some(image => image.label === 'mGBA'));
  assert.ok(!switchEmulators.images.some(image => /jump|checkpoint|homebrew menu/i.test(image.label)));
});

test('game downloads, setup and library cards each use a distinct meaningful composition', () => {
  const keys = ['/console/psvita/game-downloads.html', '/console/psvita/jailbreak.html', '/console/psvita/library.html?view=all'];
  const configs = keys.map(key => manifest.destinations[key]);
  assert.equal(configs[0].kind, 'downloads');
  const cover=art.media(configs[0], keys[0]);
  assert.ok(cover.includes('data-merged-cover='));
  assert.equal((cover.match(/<img\b/g)||[]).length,1);
  assert.equal(new Set(configs.map(config => JSON.stringify(config.images))).size, 3);
  assert.ok(configs[0].images.some(image => image.sourcePage === 'console/psvita/games.html'));
  assert.ok(manifest.destinations['/console/psvita/cfw.html'].images.some(image => /vitadeploy/.test(image.src)));
});

test('every composed asset is a real local original with alt text and recorded provenance', () => {
  assert.ok(Object.keys(manifest.destinations).length >= 130);
  for (const [route, config] of Object.entries(manifest.destinations)) {
    assert.ok(fs.existsSync(path.join(scope.root, route.split('?')[0])), route);
    assert.ok(config.images.length >= 1 && config.images.length <= 4, route);
    assert.equal(new Set(config.images.map(image => image.src)).size, config.images.length, route);
    for (const image of config.images) {
      assert.ok(image.src.startsWith('/assets/images/') && !image.src.includes('/social/'), route);
      assert.ok(fs.existsSync(path.join(scope.root, image.src)), route + image.src);
      assert.ok(image.alt && image.label, route);
      if (image.sourcePage) assert.ok(fs.existsSync(path.join(scope.root, image.sourcePage)), route);
    }
  }
});

test('ready-download catalogue cards retain their precise per-resource images', () => {
  const catalogue = require('../../docs/console-download-catalog.json');
  const items = new Map(catalogue.items.map(item => [item.id, item]));
  for (const platform of ['ps4', 'ps5']) {
    const html = fs.readFileSync(path.join(scope.root, `console/${platform}/downloads.html`), 'utf8');
    for (const card of art.cards(html)) {
      const id = art.attribute(card.html.match(/^<[^>]*>/)[0], 'data-file-id');
      if (!id) continue;
      const item = items.get(id);
      assert.ok(item, id);
      assert.ok(!card.html.includes('data-category-art='), id);
      const tag = card.html.match(/<img\b[^>]*>/)?.[0];
      assert.equal(tag ? art.attribute(tag, 'src') : '', item.image || '', id);
    }
  }
});

test('regeneration is stable and all mapped category cards already use the native composition', () => {
  assert.deepEqual(builder.buildManifest(), manifest);
  let total = 0;
  for (const file of scope.pages()) {
    const html = fs.readFileSync(file, 'utf8');
    assert.equal(art.apply(scope.relativePath(file), html, manifest), html, scope.relativePath(file));
    total += [...html.matchAll(/data-category-art=/g)].length;
  }
  assert.ok(total >= 150);
});
