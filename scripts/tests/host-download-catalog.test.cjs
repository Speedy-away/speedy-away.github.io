const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'../..'),{collect}=require('../host-download-catalog.cjs');
test('host catalogue rebuild works without private legacy manifests and preserves every other version',()=>{
 const before=JSON.parse(fs.readFileSync(root+'/docs/console-download-catalog.json')),after=collect();
 assert.deepEqual(after.items.filter(x=>x.id!=='ps5-web-file-manager'),before.items.filter(x=>x.id!=='ps5-web-file-manager'));
 const manager=after.items.filter(x=>x.id==='ps5-web-file-manager');assert.equal(manager.length,1);assert.match(manager[0].url,/\/releases\/download\/v1\.14\/web-file-mgr-v1\.14\.elf$/);
 assert(!after.items.some(x=>x.filename==='wfm-7zip-helper.elf'));
});
test('changed executable bytes fail before any catalogue can be written',()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ps5-manager-catalog-'));
 try{for(const name of ['docs/console-download-catalog.json','docs/ps5-web-file-manager.json','docs/host-actions-ps5.json']){fs.mkdirSync(path.dirname(path.join(temporary,name)),{recursive:true});fs.copyFileSync(path.join(root,name),path.join(temporary,name));}
 const asset=require('../../docs/ps5-web-file-manager.json').assets[0],target=path.join(temporary,asset.local.slice(1));fs.mkdirSync(path.dirname(target),{recursive:true});const bytes=fs.readFileSync(root+asset.local);bytes[100]^=1;fs.writeFileSync(target,bytes);assert.throws(()=>collect({root:temporary}),/release bytes differ/);
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});
