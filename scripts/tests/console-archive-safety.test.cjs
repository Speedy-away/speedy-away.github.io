const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {reviewZip, reviewRar5, checkedPath} = require('../build-console-archive-safety.cjs');
const root = path.resolve(__dirname, '../..');
function zipFixture(name = 'data/test.bin', mode = 0x81a4, extra = Buffer.alloc(0)) {
  const filename = Buffer.from(name), payload = Buffer.from('test');
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt32LE(payload.length, 18); local.writeUInt32LE(payload.length, 22); local.writeUInt16LE(filename.length, 26); local.writeUInt16LE(extra.length, 28);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(0x314, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt32LE(payload.length, 20); central.writeUInt32LE(payload.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt16LE(extra.length, 30); central.writeUInt32LE((mode * 65536) >>> 0, 38);
  const start = Buffer.concat([local, filename, extra, payload]);
  const directory = Buffer.concat([central, filename, extra]);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(directory.length, 12); eocd.writeUInt32LE(start.length, 16);
  return Buffer.concat([start, directory, eocd]);
}
function rarFixture(overrides = {}) {
  const fields = {'Path':'data/test.bin','Folder':'-','Size':'4','Packed Size':'4','Modified':'','Created':'','Accessed':'','Attributes':'A','Alternate Stream':'-','Encrypted':'-','Solid':'-','Split Before':'-','Split After':'-','CRC':'','Host OS':'Windows','Method':'','Characteristics':'','Symbolic Link':'','Hard Link':'','Copy Link':'','Volume Index':'','Checksum':'','NT Security':'', ...overrides};
  return 'Type = Rar5\nMultivolume = -\nEncrypted = -\n----------\n' + Object.entries(fields).map(([key, value]) => key + ' = ' + value).join('\n') + '\n';
}

test('ZIP safety checks actual Unix file types, raw paths and local-header agreement', () => {
  assert.equal(reviewZip(zipFixture()).entryCount, 1);
  for (const mode of [0xa1ff, 0x21a4, 0x61a4, 0x11a4, 0xc1a4]) assert.throws(() => reviewZip(zipFixture('file', mode)), /link|device|reparse/);
  for (const name of ['../outside.bin', '/absolute.bin', 'C:\\outside.bin', 'safe/../../outside', 'safe\n/../../outside', 'safe\0name']) assert.throws(() => reviewZip(zipFixture(name)));
  const disagreement = zipFixture(); disagreement[30] = 'x'.charCodeAt(0);
  assert.throws(() => reviewZip(disagreement), /disagreement/);
});

test('ZIP unknown/link extra fields and unsafe Unicode override paths are not approved', () => {
  const unknown = Buffer.alloc(4); unknown.writeUInt16LE(0x9999); assert.throws(() => reviewZip(zipFixture('safe', 0x81a4, unknown)), /Unverified ZIP extra/);
  const pathBytes = Buffer.from('../outside.bin'), unicode = Buffer.alloc(9 + pathBytes.length);
  unicode.writeUInt16LE(0x7075); unicode.writeUInt16LE(5 + pathBytes.length, 2); unicode[4] = 1; pathBytes.copy(unicode, 9);
  assert.throws(() => reviewZip(zipFixture('safe', 0x81a4, unicode)), /Absolute, parent/);
  const link = Buffer.alloc(17); link.writeUInt16LE(0x000d); link.writeUInt16LE(13, 2);
  assert.throws(() => reviewZip(zipFixture('safe', 0x81a4, link)), /may carry link/);
});

test('RAR5 safety requires complete negative link, stream and special-file metadata', () => {
  assert.equal(reviewRar5(rarFixture()).entryCount, 1);
  for (const change of [{'Symbolic Link':'../../outside'}, {'Hard Link':'file'}, {'Copy Link':'file'}, {'Alternate Stream':'+'}, {'Attributes':' brw-r--r--'}, {'Attributes':' crw-r--r--'}, {'Attributes':' prw-r--r--'}, {'Attributes':' lrwxrwxrwx'}, {'Path':'../outside'}]) assert.throws(() => reviewRar5(rarFixture(change)));
  assert.throws(() => reviewRar5(rarFixture({'Path':'safe\nPath = ../../outside'})), /ambiguous/);
  assert.throws(() => reviewRar5(rarFixture().replace('Symbolic Link = \n', '')), /incomplete/);
  assert.throws(() => checkedPath('data:stream'));
});

test('published allowlist keeps uncertain formats unapproved and matches audited hashes', () => {
  const safety = JSON.parse(fs.readFileSync(path.join(root, 'docs/console-archive-safety.json'), 'utf8'));
  const audit = JSON.parse(fs.readFileSync(path.join(root, 'docs/console-archive-readiness-audit.json'), 'utf8'));
  assert.equal(safety.items.length, audit.archives.length);
  assert.ok(safety.items.length >= 62);
  for (const item of safety.items.filter(item => item.reviewed)) {
    assert.ok(item.noLinks && item.relativePaths && item.noDevices && item.noAlternateStreams && item.noEncryptedEntries);
    assert.ok(item.bytes <= safety.maxArchiveBytes && item.expandedBytes <= safety.maxExpandedBytes);
    assert.ok(['zip', 'Rar5'].includes(item.type));
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
  }
  assert.ok(safety.items.filter(item => /\.7z$/i.test(item.filename)).every(item => !item.reviewed));
});
