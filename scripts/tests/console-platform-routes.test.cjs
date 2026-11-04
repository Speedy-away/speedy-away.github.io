const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {platforms, routesFor, migrateUrl} = require('../console-platform-routes.cjs');
const root = path.resolve(__dirname, '../..');

test('moves relative and same-site console links to the correct topic', () => {
  assert.equal(migrateUrl('../../console/ps3.html#save-tools', 'games/cod/index.html'), '/console/ps3/save-tools.html#save-tools');
  assert.equal(migrateUrl('xbox360.html#jtag-rgh', 'console/index.html'), '/console/xbox360/hardware.html#jtag-rgh');
  assert.equal(migrateUrl('https://whatwhatboy.com/console/ps3.html?from=retro#hen', 'index.html'), '/console/ps3/hen.html?from=retro#hen');
  assert.equal(migrateUrl('https://example.com/console/ps3.html#hen', 'index.html'), 'https://example.com/console/ps3.html#hen');
});

test('legacy bookmarks route by decoded fragment and fall back safely', () => {
  const script = fs.readFileSync(path.join(root, 'assets/console-legacy-redirect.js'), 'utf8');
  function target(platform, hash) {
    let result;
    const context = {document: {getElementById: () => ({textContent: JSON.stringify(routesFor(platform))})}, window: {location: {hash, replace: value => {result = value;}}}};
    vm.runInNewContext(script, context);
    return result;
  }
  assert.equal(target('ps3', '#save%2Dtools'), '/console/ps3/save-tools.html#save-tools');
  assert.equal(target('xbox360', '#homebrew'), '/console/xbox360/apps.html#homebrew');
  assert.equal(target('xbox360', '#jtag-rgh'), '/console/xbox360/hardware.html#jtag-rgh');
  assert.equal(target('ps3', '#unknown'), '/console/ps3/');
  assert.equal(target('ps3', '#%E0%A4%A'), '/console/ps3/');
});

test('every migrated bookmark resolves to a real page and anchor', () => {
  for (const platform of Object.keys(platforms)) {
    for (const target of Object.values(routesFor(platform).anchors)) {
      const url = new URL(target, 'https://whatwhatboy.com');
      const file = path.join(root, url.pathname);
      assert.ok(fs.existsSync(file), target);
      const html = fs.readFileSync(file, 'utf8');
      assert.ok(html.includes('id="' + url.hash.slice(1) + '"'), target);
    }
  }
});
