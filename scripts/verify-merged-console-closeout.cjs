// Static verification only: images, package bytes and saved inventory records.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const prefix='whatwhatboy-console-payload-sender/';
function inspectSender(info){
 const bytes=fs.readFileSync(info.file);assert.equal(bytes.length,info.bytes);assert.equal(sha(bytes),info.sha256);
 assert.equal(sha(fs.readFileSync(info.backupPath)),info.sha256,'Exact F: copy');
 const zip=require('./verify-host-menu-sender-integrity.cjs').inspectZip(bytes),member=name=>{const data=zip.entries.get(prefix+name);assert.ok(data,name);return data;};
 const manifest=JSON.parse(member('bundle-manifest.json'));
 assert.equal(sha(JSON.stringify(manifest.files)),manifest.snapshot);assert.equal(manifest.snapshot,info.snapshot);
 for(const record of manifest.files){const data=member(record.name);assert.equal(data.length,record.bytes);assert.equal(sha(data),record.sha256,record.name);}
 assert.equal(manifest.files.length+1,zip.entries.size);
 const bridge=member('scripts/console-payload-bridge.cjs').toString(),catalogueText=bridge.match(/const CATALOGUES = \[([^\]]+)\]/)[1];
 const catalogues=[...catalogueText.matchAll(/'([^']+)'/g)].map(m=>m[1]);
 assert.ok(catalogues.includes('docs/host-native-payload-actions.json'));
 const actions=catalogues.flatMap(file=>{const d=JSON.parse(member(file));return d.actions.map(a=>({...a,platform:a.platform||d.platform}));});
 for(const payload of manifest.payloads){const action=actions.find(a=>a.id===payload.id&&a.platform===payload.platform);assert.ok(action,payload.id);const data=member(decodeURIComponent(action.downloadURL.slice(1)));assert.equal(data.length,payload.bytes);assert.equal(sha(data),payload.sha256);assert.equal(action.sha256,payload.sha256);}
 const owner=read('docs/download-audit.json').items.find(item=>item.id===info.id);assert.ok(owner);assert.ok(owner.files.some(file=>file.sha256===info.sha256&&file.backupPath===info.backupPath));
 return {version:info.version,bytes:info.bytes,sha256:info.sha256,backupPath:info.backupPath,zipEntries:zip.entryCount,manifestRecords:manifest.files.length,readyFiles:manifest.payloads.length,actions:actions.length,crcAndEveryMemberSHA256Passed:true};
}
function verify(){
 const covers=read('docs/merged-category-covers.json');
 for(const item of Object.values(covers.covers)){const bytes=fs.readFileSync(path.join(root,item.path));assert.equal(bytes.length,item.bytes);assert.equal(sha(bytes),item.sha256);assert.equal(bytes.readUInt32BE(16),item.width);assert.equal(bytes.readUInt32BE(20),item.height);}
 const scope=require('./site-public-pages.cjs');let merged=0,oldTiles=0,themeSidebar=0;
 for(const file of scope.pages()){const html=fs.readFileSync(file,'utf8');merged+=(html.match(/data-merged-cover=/g)||[]).length;oldTiles+=(html.match(/category-art__item/g)||[]).length;themeSidebar+=(html.match(/data-nav-section="themes"/g)||[]).length;}
 assert.equal(oldTiles,0);assert.equal(themeSidebar,0);
 const sender=inspectSender(read('docs/qa/merged-cover-final-sender-archive.json'));
 const previous=inspectSender(read('docs/qa/merged-cover-retained-sender-archive.json'));
 const report={checkedAt:new Date().toISOString(),passed:true,generatedCovers:Object.keys(covers.covers).length,mergedCategoryCards:merged,legacyImageTiles:oldTiles,topLevelThemeItems:themeSidebar,sender,retainedInterimSender:previous,executedPayloads:0,hardwareTested:false};
 fs.writeFileSync(path.join(root,'docs/qa/merged-console-closeout-verification.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
module.exports={verify,inspectSender};
if(require.main===module)console.log(JSON.stringify(verify(),null,2));
