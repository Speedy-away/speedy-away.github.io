const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {validateELF, verifyHostPayloads} = require('../verify-host-payloads.cjs');

function elfFixture() {
  const bytes = Buffer.alloc(256);
  Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1]).copy(bytes);
  bytes.writeUInt16LE(3, 16); bytes.writeUInt16LE(62, 18); bytes.writeUInt32LE(1, 20);
  bytes.writeBigUInt64LE(128n, 24); bytes.writeBigUInt64LE(64n, 32);
  bytes.writeUInt16LE(64, 52); bytes.writeUInt16LE(56, 54); bytes.writeUInt16LE(1, 56);
  bytes.writeUInt32LE(1, 64); bytes.writeUInt32LE(5, 68);
  bytes.writeBigUInt64LE(128n, 72); bytes.writeBigUInt64LE(128n, 80);
  bytes.writeBigUInt64LE(32n, 96); bytes.writeBigUInt64LE(64n, 104);
  return bytes;
}
const codes = bytes => validateELF(bytes).issues.map(item => item.code);

test('ELF validation rejects incompatible identity, machine and corrupt header tables', () => {
  const good = elfFixture(), parsed = validateELF(good);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.metadata.bits, 64);
  assert.equal(parsed.metadata.machine, 'x86-64');
  assert.equal(parsed.metadata.loadSegments.length, 1);
  assert.deepEqual(codes(good.subarray(0, 63)), ['elf-header-truncated']);
  for (const [offset, value, code] of [[0, 0, 'elf-magic'], [4, 1, 'elf-class'], [5, 2, 'elf-endianness'], [6, 0, 'elf-ident-version']]) {
    const bad = Buffer.from(good); bad[offset] = value; assert.ok(codes(bad).includes(code), code);
  }
  const machine = Buffer.from(good); machine.writeUInt16LE(183, 18); assert.ok(codes(machine).includes('elf-machine'));
  const relocatable = Buffer.from(good); relocatable.writeUInt16LE(1, 16); assert.ok(codes(relocatable).includes('elf-type'));
  const huge = Buffer.from(good); huge.writeBigUInt64LE(0xffffffffffffffffn, 32); assert.ok(codes(huge).includes('elf-program-header-bounds'));
  const truncated = Buffer.from(good); truncated.writeUInt16LE(4, 56); assert.ok(codes(truncated).includes('elf-program-header-bounds'));
});

test('ELF validation catches truncated PT_LOAD bytes and impossible memory sizes', () => {
  const good = elfFixture();
  assert.ok(codes(good.subarray(0, 150)).includes('elf-load-segment-bounds'));
  const hugeOffset = Buffer.from(good); hugeOffset.writeBigUInt64LE(0xfffffffffffffff0n, 72);
  assert.ok(codes(hugeOffset).includes('elf-load-segment-bounds'));
  const tooSmall = Buffer.from(good); tooSmall.writeBigUInt64LE(16n, 104);
  assert.ok(codes(tooSmall).includes('elf-load-segment-size'));
  const noLoads = Buffer.from(good); noLoads.writeUInt32LE(2, 64);
  assert.ok(codes(noLoads).includes('elf-load-segments-missing'));
});

test('static report covers runnable files and download-only bootstrap, rejects corruption and hides absolute paths', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsite-host-integrity-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true})); // Exact test-created directory only.
  fs.mkdirSync(path.join(root, 'downloads/fixture'), {recursive: true});
  const elf = elfFixture(), sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(path.join(root, 'downloads/fixture/ready.elf'), elf);
  fs.writeFileSync(path.join(root, 'downloads/fixture/bootstrap.elf'), elf);
  const action = {id: 'ready', platform: 'ps5', format: 'ELF', bytes: elf.length,
    downloadURL: '/downloads/fixture/ready.elf', sha256: sha(elf), run: {type: 'elf-http', port: 9021}};
  const bootstrap = {...action, id: 'bootstrap', downloadURL: '/downloads/fixture/bootstrap.elf', run: null};
  const result = await verifyHostPayloads({root, actions: [action, bootstrap]});
  assert.equal(result.passed, true);
  assert.equal(result.summary.runnableValidatorPassed, 1);
  assert.equal(result.summary.elfDownloads, 2);
  assert.equal(result.files[1].runnableValidatorPassed, null);
  assert.equal(result.scope.networkRequests, false);

  const corrupted = Buffer.from(elf); corrupted[4] = 1;
  fs.writeFileSync(path.join(root, 'downloads/fixture/ready.elf'), corrupted);
  const rejected = await verifyHostPayloads({root, actions: [action, {...bootstrap, bytes: 1}, {...action, id: 'missing', downloadURL: '/downloads/fixture/missing.elf'}]});
  assert.equal(rejected.passed, false);
  assert.ok(rejected.files[0].issues.some(item => item.code === 'checksum-mismatch'));
  assert.ok(rejected.files[0].issues.some(item => item.code === 'elf-class'));
  assert.equal(rejected.files[0].sha256, sha(corrupted));
  assert.ok(rejected.files[1].issues.some(item => item.code === 'byte-count-mismatch'));
  const serialized = JSON.stringify(rejected);
  assert.ok(!serialized.includes(root));
  assert.ok(!/[A-Za-z]:\\/.test(serialized));
});
