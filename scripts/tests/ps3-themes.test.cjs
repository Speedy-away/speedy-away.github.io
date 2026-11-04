const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {p3tHeader}=require('../import-ps3-themes.cjs');
const root=path.resolve(__dirname,'../..');
const catalogue=require('../../docs/themezer-ps3-catalog.json');
const read=t=>fs.readFileSync(path.join(root,t.localDownload.slice(1)));
test('curated themes retain actual P3T containers and recorded hashes',()=>{
 assert.ok(catalogue.themes.length>=10);
 assert.deepEqual(catalogue.failures,[]);
 for(const theme of catalogue.themes) {
  const bytes=read(theme), container=p3tHeader(bytes);
  assert.equal(bytes.length,theme.bytes,theme.id);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),theme.sha256,theme.id);
  assert.ok(container.themeRoot&&container.embeddedFiles>0,theme.id);
 }
});
test('rejects disguised non-theme content',()=>{
 assert.throws(()=>p3tHeader(Buffer.from('<html>Not found</html>')),/Not a P3T/);
 const bytes=Buffer.from(read(catalogue.themes[0])); bytes.write('PK\x03\x04');
 assert.throws(()=>p3tHeader(bytes),/Not a P3T/);
});
test('rejects a truncated embedded file table',()=>{
 const bytes=read(catalogue.themes[0]);
 assert.throws(()=>p3tHeader(bytes.subarray(0,bytes.length-1)),/section exceeds container/);
});
test('rejects cyclic element links without traversing indefinitely',()=>{
 const bytes=Buffer.from(read(catalogue.themes[0])), tree=bytes.readUInt32BE(8);
 bytes.writeInt32BE(0,tree+20);
 assert.throws(()=>p3tHeader(bytes),/cyclic/);
});
test('rejects out-of-range string references',()=>{
 const bytes=Buffer.from(read(catalogue.themes[0])), tree=bytes.readUInt32BE(8);
 bytes.writeUInt32BE(0xffffffff,tree);
 assert.throws(()=>p3tHeader(bytes),/string pointer outside/);
});
