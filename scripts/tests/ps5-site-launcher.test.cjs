const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {inspectPackage} = require('../prepare-ps5-site-launcher.cjs');
const build = require('../../docs/ps4-ps5-launcher-build.json');
const pkg = fs.readFileSync(path.join(__dirname,'../../downloads/ps4-ps5/whatsite-ps5-site-launcher-2026-11-02',build.filename));
test('saved PS5 shortcut contains the intended URL, Media category and original icon',()=>{
  const info=inspectPackage(pkg);
  assert.equal(info.titleId,'WHAT00001');
  assert.equal(info.deeplinkUri,'https://whatwhatboy.com/console/ps5/');
  assert.equal(info.mediaCategory,65536);
  assert.equal(info.iconSha256,build.icon.sha256);
  assert.equal(crypto.createHash('sha256').update(pkg).digest('hex'),build.sha256);
  assert.equal(pkg.length,build.bytes);
});
test('shortcut inspection rejects truncated or corrupt containers',()=>{
  assert.throws(()=>inspectPackage(pkg.subarray(0,500)),/CNT/);
  const broken=Buffer.from(pkg);broken.writeBigUInt64LE(BigInt(pkg.length+1),0x58);
  assert.throws(()=>inspectPackage(broken),/CNT/);
});
