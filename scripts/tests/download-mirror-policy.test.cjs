const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {MAX_MIRROR_BYTES, publicMirror} = require('../download-mirror-policy.cjs');

test('public mirrors require an existing in-root file below the size ceiling', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsite-mirrors-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  fs.mkdirSync(path.join(root, 'downloads'));
  const small = path.join(root, 'downloads', 'menu [1].zip');
  fs.writeFileSync(small, 'saved');
  assert.deepEqual(publicMirror('/downloads/menu%20%5B1%5D.zip', root), {
    local: '/downloads/menu%20%5B1%5D.zip', bytes: 5
  });
  const large = path.join(root, 'downloads', 'large.zip');
  fs.closeSync(fs.openSync(large, 'w'));
  fs.truncateSync(large, MAX_MIRROR_BYTES);
  assert.equal(publicMirror('/downloads/large.zip', root), null);
  assert.equal(publicMirror('/downloads/missing.zip', root), null);
  assert.equal(publicMirror('/downloads/', root), null);
  assert.equal(publicMirror('/downloads/../outside.zip', root), null);
  assert.equal(publicMirror('/downloads/%2e%2e%5coutside.zip', root), null);
  assert.equal(publicMirror('https://example.com/menu.zip', root), null);
});
