const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const {inspectZip, safeMember, isNro, crc32, mergeReports, validateApp} = require('../archive-switch-homebrew.cjs');

function fixture(files, method = 8) {
  const local = [], directory = []; let offset = 0;
  for (const [name, source] of files) {
    const data = Buffer.from(source), encoded = Buffer.from(name), compressed = method === 8 ? zlib.deflateRawSync(data) : data;
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(method, 8); header.writeUInt32LE(crc32(data), 14); header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(encoded.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(method, 10); central.writeUInt32LE(crc32(data), 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(encoded.length, 28); central.writeUInt32LE(offset, 42);
    local.push(header, encoded, compressed); directory.push(central, encoded); offset += header.length + encoded.length + compressed.length;
  }
  const listing = Buffer.concat(directory), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(listing.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, listing, end]);
}

function nro() { const bytes = Buffer.alloc(256); bytes.write('NRO0', 0x10); return bytes; }

test('reads SD layout without executing an NRO and keeps companion data', () => {
  const entries = inspectZip(fixture([['switch/player/player.nro', nro()], ['switch/player/config.ini', 'audio=1']]));
  assert.deepEqual(entries.map(entry => entry.path), ['switch/player/player.nro', 'switch/player/config.ini']);
  assert.equal(isNro(entries[0].data), true);
  assert.equal(entries[1].data.toString(), 'audio=1');
  assert.match(entries[0].sha256, /^[a-f0-9]{64}$/);
});

test('rejects traversal, absolute paths and case-colliding members', () => {
  for (const name of ['../app.nro', '/app.nro', 'switch/../../app.nro', 'C:/app.nro', 'switch\\app.nro']) {
    assert.equal(safeMember(name), false);
    assert.throws(() => inspectZip(fixture([[name, nro()]])), /Unsafe/);
  }
  assert.throws(() => inspectZip(fixture([['switch/a.nro', nro()], ['switch/A.nro', nro()]])), /duplicate/);
});

test('rejects damaged data, unexpected formats, truncation and expansion overflow', () => {
  const bad = fixture([['switch/a.nro', nro()]], 0); bad[50] ^= 1;
  assert.throws(() => inspectZip(bad), /CRC mismatch/);
  assert.throws(() => inspectZip(fixture([['switch/a.nro', 'a web page']])), /NRO/);
  assert.throws(() => inspectZip(fixture([['data', Buffer.alloc(1024)]]), 100), /expanded-size/);
  assert.throws(() => inspectZip(fixture([['data', 'valid']]).subarray(0, -5)), /end-of-directory/);
});

test('inventory merge preserves concurrent IDs, versions, paths and attempts', () => {
  const before = {scope: 'retained', items: [{id: 'switch-a', files: [{name: 'a.nro', sha256: 'old', backupPath: 'old'}], attempts: [{at: 'old'}]}, {id: 'ps3-other', files: [{name: 'other.pkg'}]}]};
  const after = mergeReports(before, {items: [{id: 'switch-a', files: [{name: 'a.nro', sha256: 'new', backupPath: 'new'}], attempts: [{at: 'new'}]}]});
  assert.equal(after.scope, 'retained');
  assert.equal(after.items.length, 2);
  assert.equal(after.items[0].files.length, 2);
  assert.equal(after.items[0].attempts.length, 2);
  assert.equal(after.items[1].files[0].name, 'other.pkg');
});

test('requires Switch store package and pinned documented official NRO', () => {
  const app = {id: 'app', title: 'App', version: '1.0', project: 'https://github.com/example/app', packageUrl: 'https://switch.cdn.fortheusers.org/zips/app.zip'};
  assert.equal(validateApp(app), app);
  assert.throws(() => validateApp({...app, packageUrl: 'https://wiiu.cdn.fortheusers.org/zips/app.zip'}), /Switch store/);
  assert.throws(() => validateApp({...app, assetUrl: 'https://github.com/example/app/releases/download/1.0/app.nro'}), /standaloneNro/);
  assert.throws(() => validateApp({...app, standaloneNro: true, assetUrl: 'https://github.com/example/app/releases/latest/download/app.nro'}), /pinned/);
});
