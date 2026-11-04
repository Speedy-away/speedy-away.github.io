const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');

function managerFixture() {
  const actions = [], messages = [];
  let submit;
  const input = {value: '', focus() { actions.push('focus'); }};
  const status = {textContent: '', replaceChildren() { messages.length = 0; }, appendChild(value) { messages.push(value); }};
  const form = {querySelector(selector) { return selector === 'input' ? input : status; }, addEventListener(name, callback) { assert.equal(name, 'submit'); submit = callback; }};
  const document = {
    querySelector() { return form; },
    createElement() { return {}; },
    createTextNode(value) { return value; }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/console-theme-manager.js'), 'utf8'), {
    document, window: {open(url, target) { actions.push({url, target}); return {}; }}
  });
  return {actions, input, status, submit(value) { input.value = value; submit({preventDefault() {}}); }};
}

test('theme service opens only after an explicit action at its documented port', () => {
  const fixture = managerFixture();
  assert.deepEqual(fixture.actions, []);
  fixture.submit('192.168.1.50');
  assert.deepEqual(fixture.actions, [{url: 'http://192.168.1.50:8095/', target: '_blank'}]);
});

test('theme service rejects malformed and unrelated addresses', () => {
  for (const value of ['https://example.com', '192.168.1.5:9021', '192.168.1.5/path', '192.168.1.999', '8.8.8.8', 'javascript:alert(1)']) {
    const fixture = managerFixture();
    fixture.submit(value);
    assert.deepEqual(fixture.actions, ['focus'], value);
    assert.match(fixture.status.textContent, /local IPv4/);
  }
});

test('new game files keep title IDs and game updates distinct and exclude videos', () => {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'docs/ps4-ps5-game-resources.json'), 'utf8'));
  const jobs = JSON.parse(fs.readFileSync(path.join(root, 'docs/ps4-ps5-customization-download-jobs.json'), 'utf8')).jobs;
  const originalIds = new Set(jobs.map(job => job.id));
  const cheats = data.resources.filter(item => originalIds.has(item.id) && item.category === 'cheat');
  assert.equal(cheats.length, 7);
  for (const cheat of cheats) {
    const job = jobs.find(job => job.id === cheat.id);
    assert.ok(job && job.expectedBytes > 0 && /^[a-f0-9]{64}$/.test(job.expectedSha256));
    assert.match(job.url, /\/3a4ca53414ed6653d091d9dcd82c838333585d2f\/json\/CUSA\d+_\d+\.\d+\.json$/);
    assert.equal(cheat.downloads[0].url, job.url);
    assert.ok(cheat.tags.includes('PS4'));
    assert.match(cheat.compatibilityText, /PS5 support has not been established/);
  }
  for (const id of ['dying-light', 'dying-light-2', 'dead-island']) {
    assert.equal(data.games.find(game => game.id === id).parent, 'other-games');
    assert.ok(data.resources.filter(item => item.gameIds.includes(id)).every(item => item.videos.length === 0));
  }
  const deadIsland = cheats.find(item => item.id.includes('cusa03291'));
  const riptide = cheats.find(item => item.id.includes('cusa03290'));
  assert.match(deadIsland.name, /^Dead Island - Definitive Edition/);
  assert.match(riptide.name, /^Dead Island: Riptide/);
});
