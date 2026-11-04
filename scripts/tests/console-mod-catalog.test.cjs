const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {catalog, entryLink} = require('../console-mod-catalog.cjs');

test('directory guide entries open popups while resource sections keep page navigation', () => {
  assert.match(entryLink({url: '/console/mods/ps4/rdr2/#guide-rdr2-havana'}), /data-guide-open/);
  assert.match(entryLink({url: '/console/mods/ps4/call-of-duty/wwii/#guide-reference', category: 'reference'}), /data-guide-open/);
  assert.doesNotMatch(entryLink({url: '/console/mods/ps4/gta5/#v157'}), /data-guide-open/);
});
test('catalog includes all populated games and preserves older GTA resources', () => {
  const {games, entries} = catalog();
  assert.ok(games.length >= 34);
  for (const id of ['ghosts', 'advanced-warfare', 'modern-warfare-remastered', 'modern-warfare-2-remastered', 'cold-war', 'infinite-warfare', 'wwii', 'dying-light', 'dying-light-2', 'dead-island']) assert.ok(games.some(game => game.id === id));
  assert.ok(entries.some(entry => entry.name === 'Expulsion 7.0'));
  assert.ok(entries.some(entry => entry.name.includes('Scorpion')));
  assert.ok(entries.every(entry => !['source', 'fpkg', 'dlc'].includes(entry.category)));
});
test('DLC reference guides retain captured title IDs without turning them into menu downloads', () => {
  const data = JSON.parse(fs.readFileSync('docs/ps4-ps5-cod-resources.json', 'utf8'));
  const references = data.resources.filter(item => item.category === 'reference');
  assert.equal(references.length, 8);
  for (const item of references) {
    assert.deepEqual(item.downloads, []);
    assert.equal(item.publication, 'include');
    assert.ok(item.compatibilityText.includes('CUSA'));
    assert.ok(item.guideBlocks.length);
    assert.doesNotMatch(JSON.stringify(item), /mocha\.my|filecrypt|1fichier|akirabox/);
  }
  const wwii = references.find(item => item.gameIds.includes('wwii'));
  assert.match(wwii.compatibilityText, /CUSA05969.*CUSA08632.*CUSA08634/);
  assert.match(wwii.compatibilityText, /update not specified/);
  const iw = references.find(item => item.gameIds.includes('infinite-warfare'));
  assert.match(iw.compatibilityText, /CUSA04762.*1\.25/);
  assert.ok(iw.guideBlocks.some(block => block.items?.includes('Retribution')));
});
test('new HYDRA WWII support is separate from the unavailable pinned forum version', () => {
  const data = JSON.parse(fs.readFileSync('docs/ps4-ps5-cod-resources.json', 'utf8'));
  const original = data.resources.find(item => item.id === 'bo1-bo2-hydra-v1-0-0');
  const added = data.resources.find(item => item.id === 'hydra-wwii-v2-2-0');
  assert.equal(original.source.exactReleaseAvailable, false);
  assert.equal(original.name, 'HYDRA v1.0.0');
  assert.deepEqual(added.gameIds, ['wwii', 'ghosts']);
  assert.equal(added.source.type, 'upstream-release');
  assert.match(added.downloads[0].url, /\/releases\/download\/v2\.2\.0\/HydraPortable-2\.2\.0\.zip$/);
  const saved = JSON.parse(fs.readFileSync('downloads/ps4-ps5/manifest.json', 'utf8')).files.find(file => file.downloadId === added.downloads[0].id && file.status === 'downloaded');
  assert.equal(saved.sha256, added.source.sha256);
  assert.equal(saved.archived, true);
});
test('menu search combines words and game selection, and clearing restores results', () => {
  const input = {value: '', addEventListener(type, fn) {this[type] = fn;}};
  const game = {...input}; const count = {}; const empty = {};
  const type = {...input};
  const rows = ['jiggy 1.57', 'jiggy bo2', 'cyprus 1.53'].map((name, index) => ({dataset: {catalogSearch: name, catalogGame: index === 1 ? 'bo2' : 'gta5', catalogCategory: index === 1 ? 'rtm' : 'menu'}, style: {}}));
  const nodes = {modCatalogSearch: input, modCatalogGame: game, modCatalogType: type, modCatalogCount: count, modCatalogEmpty: empty};
  vm.runInNewContext(fs.readFileSync('assets/console-mod-catalog.js', 'utf8'), {document: {getElementById: id => nodes[id], querySelectorAll: () => rows}});
  input.value = ' JIGGY '; input.input(); assert.equal(count.textContent, '2 entries');
  game.value = 'gta5'; game.change(); assert.equal(count.textContent, '1 entry');
  input.value = 'jiggy 1.53'; input.input(); assert.equal(empty.hidden, false);
  assert.ok(rows.every(row => row.style.display === 'none'));
  input.value = ''; game.value = ''; input.input(); assert.equal(count.textContent, '3 entries');
  assert.ok(rows.every(row => !row.hidden && row.style.display === ''));
  type.value = 'rtm'; type.change(); assert.equal(count.textContent, '1 entry');
  game.value = 'gta5'; game.change(); assert.equal(empty.hidden, false);
  type.value = ''; game.change(); assert.equal(count.textContent, '2 entries');
  input.value = 'JÍGGY'; input.input(); assert.equal(count.textContent, '1 entry');
});
