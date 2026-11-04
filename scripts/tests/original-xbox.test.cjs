const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspectXbe,inspectZip}=require('../prepare-original-xbox.cjs');
const root=path.resolve(__dirname,'../..');
const data=require('../../docs/original-xbox-catalogue.json');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('original Xbox releases contain verified native XBEs, and keep archive and mirror bytes exact',()=>{
 const inventory=require('../../docs/original-xbox-private-inventory.json');
 assert.equal(data.resources.length,3);
 for(const item of data.resources){
  const bytes=fs.readFileSync(path.join(root,item.file.local.slice(1)));
  assert.equal(bytes.length,item.file.bytes);assert.equal(hash(bytes),item.file.sha256);
  assert.deepEqual(inspectZip(path.join(root,item.file.local.slice(1))),item.inspection);
  const archived=inventory.items.find(entry=>entry.id===item.file.itemId).files.find(file=>file.sha256===item.file.sha256);
  assert.equal(hash(fs.readFileSync(archived.backupPath)),item.file.sha256);
  assert.equal(archived.version,item.version);assert.equal(archived.sourceUrl,item.file.sourceUrl);
  assert.ok(archived.backupPath.includes('Original Xbox'));
 }
 assert.equal(data.resources.find(item=>item.id==='nevolutionx').inspection.container,'Xbox ISO inside ZIP');
 assert.match(data.resources.find(item=>item.id==='nevolutionx').setup,/XISO-aware/);
});
test('native XBE validation rejects other runtimes and truncated section data',()=>{
 assert.throws(()=>inspectXbe(Buffer.from('MZnot-original-xbox')),/XBE/);
 const buffer=Buffer.alloc(0x200);buffer.write('XBEH');buffer.writeUInt32LE(0x10000,0x104);buffer.writeUInt32LE(0x1b0,0x108);buffer.writeUInt32LE(1,0x11c);buffer.writeUInt32LE(0x10178,0x120);buffer.writeUInt32LE(0x1b0,0x178+12);buffer.writeUInt32LE(0x50,0x178+16);
 assert.equal(inspectXbe(buffer).sections,1);
 assert.throws(()=>inspectXbe(buffer.subarray(0,0x1f0)),/Truncated XBE/);
 buffer.writeUInt32LE(0xfffffff0,0x120);assert.throws(()=>inspectXbe(buffer),/header bounds/);
});
test('native page has exact local downloads and separates source projects and PC emulation',()=>{
 const html=fs.readFileSync(path.join(root,'console/retro/xbox.html'),'utf8');
 for(const item of data.resources){assert.ok(html.includes(item.file.local));assert.ok(html.includes(item.file.sha256));}
 assert.ok(html.includes('Source project only'));assert.ok(html.includes('/pc/emulators.html#emu-xemu'));
 assert.ok(!/<(?:video|iframe)\b/.test(html));assert.ok(!/F:[\\/]|private-inventory/.test(html));
 for(const marker of ['languages/i18n.js?v=3','mobile.css','site-background.js'])assert.ok(html.includes(marker));
});
