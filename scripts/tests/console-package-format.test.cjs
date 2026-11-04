const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {consolePackageFormat} = require('../console-package-format.cjs');
const build = require('../../docs/ps4-ps5-launcher-build.json');
const pkg = fs.readFileSync(path.join(__dirname,'../../downloads/ps4-ps5/whatsite-ps5-site-launcher-2026-11-02',build.filename));
test('recognizes the generated full PS5 FIH shortcut and preserves existing signatures',()=>{
  assert.equal(consolePackageFormat(pkg),'PS5 FIH debug');
  assert.equal(consolePackageFormat(Buffer.from('7f504b47','hex')),'PKG container');
  assert.equal(consolePackageFormat(Buffer.from('7f434e54','hex')),'CNT package');
});
test('rejects web pages, truncated FIH and invalid embedded-image offsets',()=>{
  assert.equal(consolePackageFormat(Buffer.from('<!doctype html>')),null);
  assert.equal(consolePackageFormat(pkg.subarray(0,500)),null);
  for(const offset of [0x10,0x18,0x58]) {const broken=Buffer.from(pkg);broken.writeBigUInt64LE(BigInt(pkg.length+1),offset);assert.equal(consolePackageFormat(broken),null);}
});
