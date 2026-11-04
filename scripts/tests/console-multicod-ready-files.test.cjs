const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {inspectElf} = require('../prepare-console-multicod-files.cjs');
const root = path.resolve(__dirname, '../..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'docs/console-multicod-ready-files.json'), 'utf8'));
const jobs = JSON.parse(fs.readFileSync(path.join(root, 'docs/console-multicod-ready-file-jobs.json'), 'utf8')).jobs;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pins = {
  'BO3_100.elf': ['black-ops-3', '1.00', 51072, 'f676ae332f20e81fc2ac31c450835e198c5d16c0bbaac7361388f9219df458ef'],
  'BO3_126.elf': ['black-ops-3', '1.26', 55520, '27ca886fb12d178c62ecedc3cb64961c60fee5f82d6e4a91ce5ae9ff6f6e815b'],
  'Ghosts_100.elf': ['ghosts', '1.00', 2162800, '11ec8f73e5965a7ed908cfa5d72d344080d4c79ab39dcfad4504172a307700ca'],
  'Ghosts_120.elf': ['ghosts', '1.20', 2162560, '794e3232e862c9f3bf0bd950dbb30e74182e0e0ce6c989ae7efcec5efca4cd6a'],
  'AW_100.elf': ['advanced-warfare', '1.00', 2162408, '4f196d7ae8271e351bfb1ce20e9a106f8857f81121168a43fb3f6841b9fc355f'],
  'AW_123.elf': ['advanced-warfare', '1.23', 2162664, '03bf6ebf4bc68c22f12fc4b2348aba05ec5323b128b287eb0ff7f3f2390ba57e'],
  'MWR_102.elf': ['modern-warfare-remastered', '1.02', 2161456, '96b858b3b5147d848488f1e31a0159c4732f9a28c6f666610d38255d8f08c231'],
  'MWR_113.elf': ['modern-warfare-remastered', '1.13', 2161336, '42bc11612c904b18df4413ab3bf2f9c466da30b1615d83d2c8daf4b266695bf8']
};

test('eight staged Matrix ELFs retain independently pinned game/update and archive provenance', () => {
  assert.equal(data.resources.length, 8);
  assert.equal(jobs.length, 8);
  assert.equal(hash(fs.readFileSync(path.join(root, data.sourceArchive.local.slice(1)))), data.sourceArchive.sha256);
  assert.equal(data.sourceArchive.sha256, '2d26c503208168dbf9bb83db9344f20519680d835038853461d191962dab4bd5');
  assert.equal(new Set(data.resources.map(item => item.id)).size, 8);
  for (const item of data.resources) {
    const [game, update, size, digest] = pins[item.filename];
    const job = jobs.find(job => job.id === item.id);
    const bytes = fs.readFileSync(path.join(root, job.importPath));
    assert.equal(item.gameId, game);
    assert.equal(item.gameUpdate, update);
    assert.deepEqual(item.platforms, ['ps4']);
    assert.equal(job.platform, 'PS4');
    assert.equal(item.category, 'mods');
    assert.equal(bytes.length, size);
    assert.equal(hash(bytes), digest);
    assert.equal(item.sha256, digest);
    assert.equal(job.expectedSha256, digest);
    assert.equal(item.expectedBytes, size);
    assert.equal(job.expectedBytes, size);
    assert.equal(item.url, `/downloads/ps4-ps5/${job.id}/${item.filename}`);
    assert.equal(item.sourceArchiveMember, 'Matrix_Menus/' + item.filename);
    assert.equal(job.provenance.archiveEntry, item.sourceArchiveMember);
    assert.equal(job.url, item.supportPackSource);
    assert.match(item.source, /^https:\/\/discord\.com\/channels\//);
    assert.match(item.page, new RegExp('/' + game + '/#resource-'));
    assert.match(item.preparation, /does not identify that loader/);
    assert.match(item.compatibility, /native PS5 support are not established/);
    assert.equal(inspectElf(bytes).machine, 'x86-64');
  }
});

test('static ELF inspection rejects corrupt identity and out-of-file program/section tables', () => {
  const valid = fs.readFileSync(path.join(root, data.resources[0].stagedPath));
  assert.throws(() => inspectElf(valid.subarray(0, 32)), /truncated/);
  const wrongMachine = Buffer.from(valid); wrongMachine.writeUInt16LE(183, 18);
  assert.throws(() => inspectElf(wrongMachine), /x86-64/);
  const wrongEndian = Buffer.from(valid); wrongEndian[5] = 2;
  assert.throws(() => inspectElf(wrongEndian), /little-endian/);
  const programBounds = Buffer.from(valid); programBounds.writeBigUInt64LE(BigInt(valid.length), 32);
  assert.throws(() => inspectElf(programBounds), /program table exceeds file bounds/);
  const sectionBounds = Buffer.from(valid); sectionBounds.writeBigUInt64LE(BigInt(valid.length), 40);
  assert.throws(() => inspectElf(sectionBounds), /section table exceeds file bounds/);
  const segmentBounds = Buffer.from(valid); segmentBounds.writeBigUInt64LE(BigInt(valid.length + 1), 64 + 8);
  assert.throws(() => inspectElf(segmentBounds), /segment exceeds file bounds/);
});

