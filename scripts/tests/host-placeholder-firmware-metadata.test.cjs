'use strict';
// Metadata fixtures only; this does not add or execute a loader, payload or route.
const test=require('node:test'),assert=require('node:assert/strict'),metadata=require('../host-page-metadata.cjs');
test('PS4 search terms describe the built-in 14.02 Afterglow loader',()=>{
 for(const file of ['hosts/ps4/index.html','hosts/ps4/firmware/index.html']){
  const data=metadata.descriptor(file);for(const term of ['PS4 14.02 jailbreak','PS4 14.02 WebKit','PS4 14.02 firmware'])assert.ok(data.keywords.includes(term),file+' '+term);
  assert.match(data.description,/14\.02.*built-in Afterglow/);assert.match(data.description,/optional offline caching/);assert.doesNotMatch(data.description,/working|fully supported/i);
 }
 assert.ok(metadata.descriptor('hosts/ps4/index.html').keywords.includes('GoldHEN'));
});
test('PS5 normal and14.00 alias terms identify only the requested empty firmware choices',()=>{
 for(const file of ['hosts/ps5/index.html','hosts/ps5/firmware/index.html']){
  const data=metadata.descriptor(file);for(const version of ['14.0','14.00','14.10','14.20'])for(const kind of ['jailbreak','WebKit','firmware'])assert.ok(data.keywords.includes('PS5 '+version+' '+kind),file+' '+version+' '+kind);
  assert.match(data.description,/14\.00 \(14\.0\), 14\.10 and 14\.20.*empty firmware choices/);assert.match(data.description,/no exploit or payload provided/);assert.doesNotMatch(data.keywords.join(' '),/14\.01|14\.03|14\.11|15\.00/);
 }
});
test('home metadata retains broad host terms and clearly qualifies the placeholder versions',()=>{
 const data=metadata.descriptor('index.html');for(const term of ['PS4 host','PS5 host','payloads','mod menus','game patches','PS4 14.02 jailbreak','PS5 14.0 jailbreak','PS5 14.00 jailbreak','PS5 14.10 WebKit','PS5 14.20 WebKit'])assert.ok(data.keywords.includes(term));
 assert.match(data.description,/PS4 14\.02 Afterglow/);assert.match(data.description,/PS5 14\.00, 14\.10 and 14\.20 remain empty firmware choices/);
 assert.ok(data.description.length<=165);assert.doesNotMatch(metadata.descriptor('hosts/ps4/patches/index.html').keywords.join(' '),/14\.02/);assert.doesNotMatch(metadata.descriptor('hosts/ps5/patches/index.html').keywords.join(' '),/14\.20/);
});
test('metadata application changes no visible controls, action JSON or executable scripts',()=>{
 const source='<html><head><title>Old</title><script>window.fixture="inert";</script></head><body><script id="host-actions-data" type="application/json">{"firmwares":["9.00"],"actions":[]}</script><button>Load</button></body></html>';
 for(const file of ['index.html','hosts/ps4/index.html','hosts/ps5/index.html','hosts/ps4/firmware/index.html','hosts/ps5/firmware/index.html']){
  const result=metadata.apply(source,file);assert.equal(result.slice(result.indexOf('<body>')),source.slice(source.indexOf('<body>')));assert.ok(result.includes('<script>window.fixture="inert";</script>'));assert.equal(metadata.apply(result,file),result);assert.ok(metadata.descriptor(file).description.length<=165);
 }
});
