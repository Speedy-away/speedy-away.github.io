const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {load, gameUrl, readyFileLinks, indexUrl} = require('../console-multicod.cjs');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('MultiCOD mappings resolve to each supported game and its own existing resource anchor', () => {
  const context = load();
  assert.equal(context.data.families.length, 5);
  assert.ok(!context.games.has('multicod'));
  for (const family of context.data.families) {
    assert.ok(family.games.length >= 2);
    for (const mapping of family.games) {
      const [url, anchor] = gameUrl(mapping, context).split('#');
      const html = read(url.slice(1) + 'index.html');
      assert.ok(html.includes(`id="${anchor}"`), `${family.id}: missing ${mapping.gameId} resource`);
      assert.notEqual(url, indexUrl);
    }
  }
});

test('Matrix four-game mappings match inspected filenames, source updates and preserved archive bytes', () => {
  const context = load();
  const matrix = context.data.families.find(family => family.id === 'matrix-menus-ps4');
  const audit = JSON.parse(read('docs/console-archive-readiness-audit.json')).archives;
  const inspected = audit.find(item => item.id === 'ps4-ps5-ghosts-matrixmods');
  const exact = {
    'black-ops-3': ['1.00', '1.26'], ghosts: ['1.00', '1.20'],
    'advanced-warfare': ['1.00', '1.23'], 'modern-warfare-remastered': ['1.02', '1.13']
  };
  assert.equal(matrix.games.length, 4);
  for (const mapping of matrix.games) {
    assert.deepEqual(mapping.updates, exact[mapping.gameId]);
    assert.equal(mapping.archiveFiles.length, 2);
    for (const file of mapping.archiveFiles) assert.ok(inspected.consoleFiles.some(entry => entry.path === file));
    const item = mapping.legacy ? context.legacy.find(item => 'bo3-' + item.id === mapping.resourceId) : context.resources.get(mapping.resourceId);
    for (const update of mapping.updates) assert.ok(item.compatibilityText.includes(update));
  }
  for (const file of ['downloads/ps4/BO3/both/MatrixMenusPS4.rar', ...audit.filter(item => /-(ghosts|aw|mwr)-matrixmods$/.test(item.id)).map(item => item.local.slice(1))]) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), matrix.archiveSha256);
  }
});

test('Windows tools preserve per-version and partial-function compatibility', () => {
  const {data, resources} = load();
  const hydra = data.families.find(family => family.id === 'hydra-v2-2-0');
  assert.deepEqual(hydra.games.map(mapping => mapping.gameId), ['wwii', 'ghosts']);
  assert.ok(hydra.games.every(mapping => /\/tag\/v2\.2\.0$/.test(mapping.source)));
  assert.equal(resources.get('bo1-bo2-hydra-v1-0-0').source.exactReleaseAvailable, false);
  const ials = data.families.find(family => family.id === 'ials96-v1-2-0');
  assert.equal(ials.type, 'desktop-helper');
  assert.match(ials.games.find(mapping => mapping.gameId === 'black-ops-1').support, /LAN Fix and Lobby Modded Classes only/);
  assert.ok(!data.families.some(family => family.id === 'bo1-bo2-payload-injector-debug'));
});

test('archived Matrix ELF links select the exact game and preserve PS4-only download routes', () => {
  const context = load();
  assert.equal(context.readyFiles.length, 8);
  for (const gameId of ['black-ops-3', 'ghosts', 'advanced-warfare', 'modern-warfare-remastered']) {
    const files = context.readyFiles.filter(file => file.gameId === gameId);
    assert.equal(files.length, 2);
    const html = readyFileLinks(gameId, context);
    for (const file of files) {
      assert.ok(html.includes(`href="${file.url}" download="${file.filename}"`));
      assert.ok(html.includes('data-game-update="' + file.gameUpdate + '"'));
      assert.ok(html.includes('/console/ps4/downloads.html?file=' + file.id + '#files'));
    }
    assert.doesNotMatch(html, /\/console\/ps5\//);
  }
  assert.equal(readyFileLinks('black-ops-1', context), '');
});

test('new index and seven expanded pages have full-page cross-links and no video players', () => {
  const index = read('console/mods/ps4/call-of-duty/multicod/index.html');
  assert.match(index, /does not become a native PS5 build/);
  for (const slug of ['black-ops-1', 'black-ops-2', 'wwii', 'ghosts', 'black-ops-3', 'advanced-warfare', 'modern-warfare-remastered']) {
    const html = read(`console/mods/ps4/call-of-duty/${slug}/index.html`);
    assert.match(html, /id="multicod-support"/);
    const section = html.match(/<section[^>]*id="multicod-support"[\s\S]*?<\/section>/)[0];
    for (const tag of section.match(/<a\b[^>]*>/g)) {
      if (/\sdownload=/.test(tag)) {
        assert.match(tag, /href="\/downloads\/ps4-ps5\/matrix-ps4-/);
        assert.doesNotMatch(tag, /target="_blank"/);
        continue;
      }
      if (/href="\/console\/ps4\/downloads\.html\?file=matrix-ps4-/.test(tag)) {
        assert.doesNotMatch(tag, /data-guide-open/);
        continue;
      }
      assert.match(tag, /target="_blank"/);
      assert.match(tag, /rel="noopener noreferrer"/);
      assert.doesNotMatch(tag, /data-guide-open/);
    }
    assert.doesNotMatch(html, /<video\b|<iframe\b[^>]*youtube|youtube-nocookie/);
  }
  assert.doesNotMatch(index, /<video\b|<iframe\b|data-guide-open|\b(?:DEX|HEN) variants\b/);
  for (const card of index.matchAll(/<article class="guide-resource multicod-card">([\s\S]*?)<\/article>/g)) {
    const visible = card[1].replace(/<details\b[\s\S]*?<\/details>/g, '');
    assert.doesNotMatch(visible, /Archive files:|Firmware and title-ID ranges|Direct PS4 ELF builds/);
    assert.match(card[1], /<summary>Setup &amp; source<\/summary>/);
  }
});
