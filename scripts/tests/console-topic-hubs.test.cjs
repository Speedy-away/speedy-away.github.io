const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  platforms, attribute, capture, filterArticles, normalize, hubPath, topicPath, libraryPath
} = require('../build-console-topic-hubs.cjs');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file.replace(/^\//, '')), 'utf8');
const exists = route => {
  const url = new URL(route, 'https://whatwhatboy.com');
  let file = decodeURIComponent(url.pathname).replace(/^\//, '');
  if (file.endsWith('/')) file += 'index.html';
  return fs.existsSync(path.join(root, file));
};
const openingArticles = html => [...html.matchAll(/<article\b[^>]*>/gi)].map(match => match[0]);
const articleIds = html => openingArticles(html).map(tag => attribute(tag, 'id')).filter(Boolean);
const linkDestinations = html => [...html.matchAll(/<a\b[^>]*>/gi)].map(match => attribute(match[0], 'href')).filter(Boolean);
const downloadLinks = html => [...html.matchAll(/<a\b[^>]*>/gi)]
  .filter(match => /\sdownload(?:\s|=|>)/i.test(match[0]))
  .map(match => attribute(match[0], 'href'));

test('topic capture retains nested sections and stops before a sibling', () => {
  const nested = '<section id="library"><div><section id="nested"><p>Notes</p></section><p>Download after nested content</p></div></section>';
  const html = '<main>' + nested + '<section id="other">Other topic</section></main>';
  assert.equal(capture(html, 'library'), nested);
  assert.equal(capture(html, 'nested'), '<section id="nested"><p>Notes</p></section>');
  assert.throws(() => capture(html, 'missing'), /Missing source section/);
  assert.throws(() => capture('<section id="broken"><section></section>', 'broken'), /Unclosed section/);
});

test('attribute reads exact names and decodes category entities', () => {
  const tag = '<article data-id="wrong" id="real" data-category="Saves &amp; system" data-title=\'A &quot;quote&quot; and &#39;apostrophe&#39;\'>';
  assert.equal(attribute(tag, 'id'), 'real');
  assert.equal(attribute(tag, 'data-category'), 'Saves & system');
  assert.equal(attribute(tag, 'data-title'), 'A "quote" and \'apostrophe\'');
  assert.equal(attribute(tag, 'missing'), null);
});

test('article filtering preserves complete chosen downloads and surrounding controls', () => {
  const input = '<div id="search"><input></div>' +
    '<article id="keep" data-category="Plugins &amp; mods"><div><article-note>Install first</article-note></div><a href="/downloads/keep.wps" download>Download</a></article>' +
    '<article id="remove" data-category="Homebrew games"><a href="/downloads/remove.wuhb" download>Download</a></article>' +
    '<article id="core"><p>Uncategorized system requirements</p></article><p id="count">Results</p>';
  const filtered = filterArticles(input, {attribute: 'data-category', values: ['Plugins & mods']});
  assert.deepEqual(articleIds(filtered), ['keep', 'core']);
  assert.ok(filtered.includes('<div id="search"><input></div>'));
  assert.ok(filtered.endsWith('<p id="count">Results</p>'));
  assert.deepEqual(downloadLinks(filtered), ['/downloads/keep.wps']);
  assert.deepEqual(articleIds(filterArticles(input, {attribute: 'id', values: ['remove']})), ['remove']);
});

test('moved content keeps local anchors and resolves links to omitted source sections', () => {
  const html = '<a href="#kept">Here</a><a href="#omitted">Elsewhere</a>' +
    '<a href="../wii.html#apps">Wii</a><img src="../../assets/image.png">' +
    '<a href="?category=A&amp;format=B#library">Filter</a>' +
    '<a href="https://example.com/file?a=1&amp;b=2">Original</a>';
  const output = normalize(html, 'console/retro/ps2.html', new Set(['kept']));
  assert.ok(output.includes('href="#kept"'));
  assert.ok(output.includes('href="/console/retro/ps2.html#omitted"'));
  assert.ok(output.includes('href="/console/wii.html#apps"'));
  assert.ok(output.includes('src="/assets/image.png"'));
  assert.ok(output.includes('href="/console/retro/ps2.html?category=A&amp;format=B#library"'));
  assert.ok(output.includes('href="https://example.com/file?a=1&amp;b=2"'));
});

test('all twelve console manifests identify real content, artwork and destinations', () => {
  const list = platforms();
  assert.deepEqual(list.map(platform => platform.id).sort(), [
    'ps2', 'gamecube', 'wii', 'wiiu', 'psp', '3ds', 'ds',
    'nintendo-switch', 'nintendo-switch-2', 'xbox-one-series', 'steamdeck', 'psvita'
  ].sort());
  const generatedRoutes = new Set();
  for (const platform of list) {
    assert.ok(exists('/' + platform.source), platform.id + ' complete library exists');
    assert.ok(exists(platform.image), platform.id + ' artwork exists');
    assert.ok(platform.groups.length >= 4, platform.id + ' meaningful category hub');
    assert.equal(new Set(platform.groups.map(group => group.slug)).size, platform.groups.length);
    assert.ok(exists(hubPath(platform)), platform.id + ' generated hub exists');
    for (const group of platform.groups) {
      assert.ok(exists(group.image || platform.image), platform.id + '/' + group.slug + ' artwork');
      assert.ok(exists(topicPath(platform, group)), platform.id + '/' + group.slug + ' destination');
      if (group.route) continue;
      const route = topicPath(platform, group);
      assert.ok(!generatedRoutes.has(route), 'No generated page collision: ' + route);
      generatedRoutes.add(route);
      assert.notEqual(route, '/' + platform.source, 'Topic output never replaces the full library');
      const source = read(group.source || platform.source);
      assert.ok(group.sections.length, route + ' captures original content');
      for (const id of group.sections) assert.ok(capture(source, id), route + '#' + id);
    }
  }
});

test('every hub card leads to its category and deliberately retains the full library', () => {
  for (const platform of platforms()) {
    const file = platform.hubFile || platform.base.slice(1) + 'index.html';
    const hub = read(file);
    const cards = capture(hub, 'start');
    const links = linkDestinations(cards);
    assert.equal(openingArticles(cards).length, platform.groups.length + 2, platform.id + ' categories, library and game directories');
    assert.ok(links.includes(platform.base + 'game-downloads.html'), platform.id + ' game directories reachable');
    for (const group of platform.groups) assert.ok(links.includes(topicPath(platform, group)), platform.id + '/' + group.slug);
    assert.ok(cards.includes('data-console-library'), platform.id + ' protects intentional library link');
    assert.equal(libraryPath(platform), '/' + platform.source + '?view=all');
    assert.ok(links.includes(libraryPath(platform)), platform.id + ' complete library reachable without entry redirect');
    assert.match(hub, /console-topic-page/);
    assert.match(hub, /console-topics\.css/);
    assert.doesNotMatch(hub, /<video\b|<iframe\b/i);
  }
});

test('generated category pages contain only the requested labelled articles', () => {
  for (const platform of platforms()) for (const group of platform.groups) {
    if (group.route || !group.category) continue;
    const html = read(topicPath(platform, group));
    const labelled = openingArticles(html).map(tag => attribute(tag, group.category.attribute)).filter(value => value !== null);
    assert.ok(labelled.length, platform.id + '/' + group.slug + ' retains resources');
    for (const value of labelled) assert.ok(group.category.values.includes(value), platform.id + '/' + group.slug + ' excludes ' + value);
    assert.ok(linkDestinations(html).includes(libraryPath(platform)), platform.id + '/' + group.slug + ' all downloads bypasses entry redirect');
  }
});

test('representative topics retain complete original resource downloads and exclude other categories', () => {
  const cases = [
    ['console/ps2/emulators.html', 'console/retro/ps2.html', ['fceumm', 'picodrive', 'ps2me'], ['mca', 'supertux']],
    ['console/gamecube/apps.html', 'console/retro/gamecube.html', ['swiss'], ['gcmm', 'cleanrip-gamecube']],
    ['console/gamecube/save-disc-tools.html', 'console/retro/gamecube.html', ['gcmm', 'cleanrip-gamecube'], ['swiss']],
    ['console/wii/games.html', 'console/retro/wii.html', ['wii-cavestory', 'wii-supertux', 'wii-helium'], ['wii-wiimc', 'wii-not64']],
    ['console/wiiu/plugins.html', 'console/retro/wiiu.html', ['SDCafiine_WUPS', 'Inkay', 'evWii', 'GamePadAutoStandby'], ['Connect4', 'retroarch']],
    ['console/psp/games.html', 'console/retro/psp.html', ['opensupaplex', 'ccleste', 'nzportable', 'wagic', 'crosscraft'], ['ark4', 'daedalus']],
    ['console/psvita/games.html', 'console/psvita/library.html', ['supertux', 'jumpnbump', 'enigma', 'chocolate-doom'], ['mgba', 'psvshell']]
  ];
  for (const [topic, sourceFile, keep, exclude] of cases) {
    const html = read(topic), source = read(sourceFile), ids = articleIds(html);
    for (const id of keep) {
      assert.ok(ids.includes(id), topic + ' retains ' + id);
      const original = capture(source, id), copied = capture(html, id);
      assert.deepEqual(downloadLinks(copied), downloadLinks(original), topic + '#' + id + ' keeps all ready files');
      assert.deepEqual(linkDestinations(copied).filter(link => /^https?:/.test(link)),
        linkDestinations(original).filter(link => /^https?:/.test(link)), topic + '#' + id + ' keeps publisher downloads and documentation');
      for (const link of downloadLinks(original)) assert.ok(exists(link), 'Original download exists: ' + link);
    }
    for (const id of exclude) assert.ok(!ids.includes(id), topic + ' excludes unrelated ' + id);
  }
});

test('original complete libraries retain their expanded resources and ready downloads', () => {
  const minimums = [
    ['console/retro/ps2.html', 20, 16],
    ['console/retro/gamecube.html', 3, 0],
    ['console/retro/wii.html', 17, 12],
    ['console/retro/wiiu.html', 37, 106],
    ['console/retro/psp.html', 18, 21],
    ['console/retro/3ds.html', 21, 54],
    ['console/retro/ds.html', 19, 17],
    ['console/nintendo-switch-2.html', 4, 2],
    ['console/xbox-one-series.html', 11, 19],
    ['console/psvita/library.html', 14, 20]
  ];
  for (const [file, cards, downloads] of minimums) {
    const html = read(file);
    assert.ok(openingArticles(html).length >= cards, file + ' retains expanded cards');
    assert.ok(downloadLinks(html).length >= downloads, file + ' retains ready download links');
    assert.doesNotMatch(html, /console-legacy-redirect\.js|http-equiv=["']refresh/i, file + ' remains a complete library');
  }
  assert.ok(capture(read('console/nintendo-switch.html'), 'cfw'));
  assert.ok(capture(read('console/nintendo-switch.html'), 'firmware-downloads'));
  assert.ok(capture(read('console/steamdeck.html'), 'guides'));
});
