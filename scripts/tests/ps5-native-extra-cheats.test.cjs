const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {validateCheat, selected, commit} = require('../prepare-ps5-native-extra-cheats.cjs');
const root = path.resolve(__dirname, '../..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

test('six native PPSA JSON definitions retain exact source bytes, game versions and creator credits', () => {
  const output = read('docs/ps5-native-extra-cheats.json');
  const jobs = read('docs/ps5-native-extra-cheats-jobs.json').jobs;
  assert.equal(output.resources.length, 6);
  assert.equal(new Set(output.resources.map(item => item.gameSlug)).size, 6);
  assert.equal(jobs.length, 9);
  assert.equal(output.resources.reduce((sum, item) => sum + item.cheatCount, 0), 18);
  assert.equal(output.resources.filter(item => item.sourceIdBlank).length, 5);
  for (const item of output.resources) {
    const pin = selected.find(pin => pin.titleId === item.titleId);
    const job = jobs.find(job => job.id === item.id);
    const bytes = fs.readFileSync(path.join(root, job.importPath));
    const validation = validateCheat(bytes, pin);
    assert.equal(item.sha256, sha(bytes));
    assert.equal(job.expectedSha256, item.sha256);
    assert.equal(item.bytes, bytes.length);
    assert.equal(job.expectedBytes, item.bytes);
    assert.equal(item.gameVersion, pin.gameVersion);
    assert.equal(item.filename, `${item.titleId}_${pin.gameVersion}.json`);
    assert.deepEqual(item.platforms, ['ps5']);
    assert.equal(item.gamePlatform, 'native-ps5');
    assert.deepEqual(item.credits, validation.data.credits);
    assert.deepEqual(item.cheats, validation.data.mods.map(mod => mod.name));
    assert.match(job.url, new RegExp(commit + '/json/'));
    assert.equal(item.url, `/downloads/ps4-ps5/${item.id}/${item.filename}`);
    assert.equal(item.page, `/console/ps5/game-cheats/${item.gameSlug}/`);
    assert.equal(item.installationPath, '/data/etaHEN/cheats/json/' + item.filename);
    assert.match(item.preparation, /only one cheat format per title ID and game version/);
    if (item.sourceIdBlank) {
      assert.equal(validation.data.id.trim(), '');
      assert.match(item.metadataValidation, /original JSON id field is blank/);
      assert.match(validation.data.name, new RegExp('^' + item.titleId + '_'));
    }
  }
});

test('game-specific validation rejects wrong versions/processes, unrelated IDs and arbitrary JSON option labels', () => {
  const pin = selected[0];
  const source = read('docs/tmp/ps5-native-extra-cheats/PPSA10662_01.001.030.json');
  const altered = change => {
    const data = JSON.parse(JSON.stringify(source));
    change(data);
    const bytes = Buffer.from(JSON.stringify(data));
    return () => validateCheat(bytes, {...pin, bytes: bytes.length, sha256: sha(bytes)});
  };
  assert.throws(altered(data => { data.version = '01.001.031'; }), /version\/process mismatch/);
  assert.throws(altered(data => { data.process = 'unrelated.elf'; }), /version\/process mismatch/);
  assert.throws(altered(data => { data.id = 'CUSA00001'; }), /PPSA identity missing/);
  assert.throws(altered(data => { data.mods = [{name: 'Just a JSON label'}]; }), /Invalid JSON cheat option/);
  assert.throws(altered(data => { data.mods[0].memory[0].on = 'arbitrary text'; }), /Invalid JSON memory definition/);
  assert.throws(altered(data => { data.mods[0].memory[0].offset = '../file'; }), /Invalid JSON memory definition/);
  assert.throws(altered(data => { data.credits = []; }), /creator credits missing/);
});

test('licence and naming instructions accompany ready files while all six prior host cheats remain unchanged', () => {
  const output = read('docs/ps5-native-extra-cheats.json');
  const jobs = read('docs/ps5-native-extra-cheats-jobs.json').jobs;
  for (const job of jobs.filter(job => job.archiveRole.includes('Metadata'))) {
    const bytes = fs.readFileSync(path.join(root, job.importPath));
    assert.equal(bytes.length, job.expectedBytes);
    assert.equal(sha(bytes), job.expectedSha256);
    assert.equal(job.version, commit);
  }
  const licence = fs.readFileSync(path.join(root, 'docs/tmp/ps5-native-extra-cheats/LICENSE.txt'), 'utf8');
  const instructions = fs.readFileSync(path.join(root, 'docs/tmp/ps5-native-extra-cheats/README-upstream.md'), 'utf8');
  assert.match(licence, /GNU GENERAL PUBLIC LICENSE[\s\S]*Version 3/);
  assert.match(instructions, /\{titleid\}_\{version\}\.\{format\}/);
  assert.match(instructions, /\/data\/etaHEN\/cheats\/json\//);
  const previous = read('docs/host-current-cheat-actions.json').actions;
  assert.deepEqual(output.existingNativeHostResourcesPreserved, previous.map(item => ({id: item.id, sha256: item.sha256, titleIds: item.titleIds, gameVersion: item.gameVersion})));
  assert.ok(output.resources.every(item => !previous.some(old => old.titleIds.includes(item.titleId) && old.gameVersion === item.gameVersion)));
});
