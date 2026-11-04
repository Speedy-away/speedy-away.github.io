const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const {safeArchivePath} = require('../audit-console-ready-files.cjs');
const {writePreserving, contained} = require('../prepare-console-ready-files.cjs');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

test('archive extraction rejects absolute paths and traversal', () => {
  for (const value of ['../file.prx', 'data/../../file.prx', 'data\\..\\file.prx', '/absolute.bin', 'C:\\absolute.bin', '\\server\\share']) assert.equal(safeArchivePath(value), false, value);
  assert.equal(safeArchivePath('data/GoldHEN/plugins/menu.prx'), true);
  assert.throws(() => contained(root, '../outside.bin'), /escapes/);
});

test('extracting the same file preserves it and a changed file cannot replace it', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsite-ready-files-'));
  const target = path.join(directory, 'preserve.txt');
  try {
    writePreserving(target, Buffer.from('old'));
    writePreserving(target, Buffer.from('old'));
    assert.throws(() => writePreserving(target, Buffer.from('new')), /Refusing to overwrite/);
    assert.equal(fs.readFileSync(target, 'utf8'), 'old');
  } finally { fs.unlinkSync(target); fs.rmdirSync(directory); }
});

test('ready extracted files match their jobs and retain distinct versions and dependencies', () => {
  const plan = read('docs/new-console-ready-files.json');
  const output = read('docs/console-ready-file-descriptors.json');
  const jobs = read('docs/new-console-ready-file-jobs.json').jobs;
  assert.equal(jobs.length, 24);
  for (const job of jobs) {
    const file = fs.readFileSync(path.join(root, job.importPath));
    assert.equal(file.length, job.expectedBytes, job.id);
    assert.equal(hash(file), job.expectedSha256, job.id);
    assert.ok(!/\.(?:exe|dll|bat|cmd|ps1|py)$/i.test(job.filename));
  }
  const plugins = output.entries.filter(entry => entry.format === 'PRX');
  assert.equal(plugins.length, 2);
  assert.ok(plugins.every(entry => entry.replacementOnly && entry.requiresSupportArchive && entry.description.includes('not a complete')));
  assert.notEqual(plugins[0].url, plugins[1].url);
  for (const pack of output.packs) assert.ok(pack.licenseLocal && fs.existsSync(path.join(root, pack.licenseLocal.slice(1))));
  for (const source of [...plan.packs, plan.officialDirectBins]) assert.equal(hash(fs.readFileSync(path.join(root, source.archive.slice(1)))), source.archiveSha256);
  for (const bin of output.entries.filter(entry => entry.format === 'BIN')) {
    assert.equal(bin.publicMirror, false);
    assert.match(bin.url, /raw\.githubusercontent\.com\/GoldHEN\/GoldHEN\/b5a78e1e1f6ecbc2dfdcd63b4bb5446f49e309c9\//);
    assert.ok(['5.05', '6.72', '9.00'].includes(bin.firmware));
  }
});

test('broader PS4 catalogue accounts for every independently sourced pinned ready file', () => {
  const source = read('docs/ps4-extra-game-cheats.json');
  const data = read('docs/ps4-ps5-game-resources.json');
  const jobs = read('docs/ps4-extra-game-download-jobs.json').jobs;
  assert.ok(source.files.length > 0);
  assert.equal(jobs.length, source.files.length);
  assert.deepEqual(jobs.map(job=>job.filename).sort(),source.files.map(file=>file.filename).sort());
  // A game may have source-confirmed regional title IDs and multiple exact
  // updates. Each pinned ready-build identity must still occur only once.
  assert.equal(new Set(source.files.map(file => JSON.stringify([file.game,file.titleId,file.version]))).size, source.files.length, 'duplicate game/title-ID/update ready build');
  for (const file of source.files) {
    const game = data.games.find(game => game.id === file.game);
    const job = jobs.find(job => job.filename === file.filename);
    assert.ok(job,file.filename);
    const resource = data.resources.find(item => item.id === job.id);
    assert.equal(game.parent, 'other-games');
    assert.equal(resource.category, 'cheat');
    assert.deepEqual(resource.videos, []);
    assert.equal(resource.downloads[0].url, file.url);
    assert.match(resource.compatibilityText, /PS4 GoldHEN/);
    assert.match(resource.compatibilityText, /Native PS5 support has not been established/);
    assert.ok(resource.compatibilityText.includes(file.titleId) && resource.compatibilityText.includes(file.version));
    assert.equal(file.sha256, job.expectedSha256);
    assert.equal(file.bytes, job.expectedBytes);
    assert.equal(file.url, job.url);
    assert.ok(file.url.includes('/'+source.commit+'/json/'));
    assert.ok(fs.existsSync(path.join(root, game.cover.slice(1))));
  }
  const coverage = read('docs/ps4-source-coverage.json');
  const independent = coverage.gameCoverage.independentExpansion;
  assert.equal(independent.repository,source.repository);
  assert.equal(independent.commit,source.commit);
  assert.deepEqual(independent.games,source.files.map(file=>({game:file.title,sourceLabel:file.sourceName,titleId:file.titleId,gameUpdate:file.version,file:file.filename})));
  assert.match(independent.note, /not represented as content scraped/);
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  for (const file of source.files) assert.ok(sitemap.includes('<loc>https://whatwhatboy.com/console/mods/ps4/' + file.game + '/</loc>'));
});

test('Other Games chooser filters titles, exact title IDs and empty results', () => {
  let update;
  const input = {value: '', addEventListener(event, callback) { assert.equal(event, 'input'); update = callback; }};
  const status = {}, empty = {};
  const cards = ['Assassin’s Creed Origins GoldHEN CUSA05625 01.44', 'God of War Ragnarök GoldHEN CUSA34386 06.02'].map(text => ({getAttribute() { return text; }, hidden: false}));
  const grid = {querySelectorAll() { return cards; }};
  const document = {getElementById(id) { return {extraGameSearch: input, extraGameCount: status, extraGameEmpty: empty}[id]; }, querySelector() { return grid; }};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/console-extra-games.js'), 'utf8'), {document});
  assert.equal(status.textContent, '2 game collections');
  input.value = 'assassins origins'; update(); assert.equal(cards[0].hidden, false); assert.equal(cards[1].hidden, true);
  input.value = 'ragnarok'; update(); assert.equal(cards[1].hidden, false);
  input.value = 'CUSA05625 01.44'; update(); assert.equal(cards[0].hidden, false); assert.equal(status.textContent, '1 game collection');
  input.value = 'missing game'; update(); assert.ok(cards.every(card => card.hidden)); assert.equal(empty.hidden, false);
});
