const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {applyStoreAppOverrides} = require('../console-store-app-overrides.cjs');
const root = path.resolve(__dirname, '../..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('per-app setup overrides preserve release identities and reject unrelated changes', () => {
  const overrides = read('docs/console-store-app-overrides.json').resources;
  const data = read('docs/console-ready-software.json');
  assert.equal(data.resources.length, 10);
  for (const app of data.resources) {
    assert.deepEqual(app, applyStoreAppOverrides(app, overrides[app.id]));
    assert.ok(app.requirements.length && app.installationSteps.length && app.primaryDocumentation.length);
    assert.ok(app.primaryDocumentation.every(source => source.url.startsWith('https://github.com/')));
    assert.match(app.installDirectory, /^\/data\/homebrew\/(?:PPSA\d{5}|PRWB00001)$/);
  }
  assert.throws(() => applyStoreAppOverrides({id: 'original'}, {id: 'changed'}), /Unsupported/);
  assert.throws(() => applyStoreAppOverrides({sha256: 'original'}, {sha256: 'changed'}), /Unsupported/);
});

test('inspected native app layouts and actual dependencies stay specific', () => {
  const inspection = read('docs/console-store-app-inspection.json').items;
  const resources = read('docs/console-ready-software.json').resources;
  assert.equal(inspection.length, resources.length);
  for (const item of inspection) {
    assert.ok(['5414f5ee', '4f153d1d'].includes(item.ebootMagic));
    assert.equal(item.titleId.toLowerCase(), item.id.replace('ps5-store-', ''));
    assert.match(item.contentVersion, /^\d{2}\.\d{3}\.\d{3}$/);
    assert.ok(item.runtimeModules.some(file => file.endsWith('sce_module/libc.prx')));
  }
  assert.equal(inspection.find(item => item.id === 'ps5-store-ppsa99109').archiveTopFolder, null);
  assert.match(resources.find(item => item.id === 'ps5-store-ppsa99109').preparation, /root.*folder such as PPSA99109/);
  assert.match(resources.find(item => item.id === 'ps5-store-ppsa99110').compatibility, /unjail/);
  assert.match(resources.find(item => item.id === 'ps5-store-ppsa98766').compatibility, /kstuff/);
  assert.deepEqual(resources.find(item => item.id === 'ps5-store-ppsa96024').firmwareSupport.tested, ['13.60']);
  assert.match(resources.find(item => item.id === 'ps5-store-ppsa98427').compatibility, /external USB optical drive/);
  const browser = resources.find(item => item.id === 'ps5-store-prwb00001');
  assert.deepEqual(browser.firmwareSupport.tested, ['13.42']);
  assert.match(browser.preparation, /invisible background browser/);
  assert.match(browser.compatibility, /32 MiB/);
});
