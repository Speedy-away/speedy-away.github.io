'use strict';
// All checks read authored metadata or immutable/archive bytes. No payload runs.
const test = require('node:test');
const assert = require('node:assert/strict');
const checks = require('../verify-host-next-batch.cjs');
const c = checks.context();

test('four Oysters 5.05 game updates and original FTP 1.08b retain exact identity and compatibility pins',()=>{
  assert.deepEqual(checks.verifyActionPins(c),{actions:5,oysters:4,ftp:1,bytes:5081280});
});

test('misnamed 5.05 ArabicGuy JavaScript is explicitly excluded from ready files and raw BIN Load',()=>{
  const result=checks.verifyExcludedJavaScript(c);assert.equal(result.readyAsset,false);assert.equal(result.rawBINLoad,false);
});

test('five original-only ready BINs have source/version/size/SHA pins and verified private F: archive bytes',()=>{
  const files=checks.verifyArchive(c);assert.equal(files.length,5);assert.equal(files.reduce((n,f)=>n+f.bytes,0),5081280);
});

test('all readers expose five PS4 additions and preserve one Oysters family while only FTP permits selected-file Load',()=>{
  const result=checks.verifyReaders(c);assert.equal(result.newActionsPresent,5);assert.equal(result.ps5NewActions,0);assert.equal(result.oystersFamilyCards,1);
});

test('577 catalogue pins, all seventeen previous sender records and both active native helpers remain unchanged',()=>{
  assert.deepEqual(checks.verifyBaseline(c),{catalogueFiles:577,senderSnapshots:17,nativeHelpers:2});
});

test('receiver 15 or its successor retains all 501 previous PS4 and 350 PS5 files and maps the five originals exactly',()=>{
  const records=checks.verifyReceivers(c);assert.equal(records.length,2);
  assert.equal(records.find(r=>r.platform==='ps4').previousItemsPreserved,501);
  assert.equal(records.find(r=>r.platform==='ps5').previousItemsPreserved,350);
});

test('all old sender ZIPs and the current sender match SHA/CRC/manifests, preserve 174 actions and exclude five original binaries',()=>{
  const result=checks.verifySenders(c);assert.equal(result.historicalSnapshotsPreserved,17);assert.ok(result.totalSnapshotsVerified>=18);
  assert.equal(result.latest.version,checks.senderVersion+'+'+result.latest.snapshot.slice(0,12));assert.equal(result.latest.originalOnlyBinaryCount,0);
  assert.equal(result.existingGoldHEN23StillBundled,true);
});
