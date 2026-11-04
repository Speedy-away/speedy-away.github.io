'use strict';
// Independent static artifact verification. No archive extraction or execution.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {inspectZip}=require('./verify-host-menu-sender-integrity.cjs');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function check(p,r){const b=fs.readFileSync(p);assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);return b;}
function main(){
 const actions=read('docs/host-gta505-continuation-actions.json').actions,baseline=read('docs/qa/host-gta505-baseline.json'),audit=read('docs/download-audit.json').items,catalogue=read('docs/console-download-catalog.json').items;
 const archived=actions.map(a=>{const f=audit.flatMap(i=>i.files||[]).find(f=>f.sha256===a.sha256&&f.backupPath);assert.ok(f);check(f.backupPath,a);const c=catalogue.find(x=>x.id===a.id);assert.equal(c.url,a.downloadURL);assert.equal(c.sha256,a.sha256);assert.deepEqual(c.platforms,['ps4']);return {id:a.id,filename:f.name,sourceURL:a.sourceURL,version:a.version,bytes:a.bytes,sha256:a.sha256,backupPath:f.backupPath};});
 for(const before of baseline.catalogue){const after=catalogue.find(x=>x.id===before.id);assert.ok(after);for(const k of ['filename','sha256','platforms'])assert.deepEqual(after[k],before[k]);}
 assert.deepEqual(read('docs/host-native-workspace-build.json').artifacts,baseline.native);
 const senders=read('downloads/helpers/console-payload-sender/manifest.json');
 const retained=baseline.sender.files.map(before=>{assert.deepEqual(senders.files.find(x=>x.url===before.url),before);check(path.join(root,before.url),before);const copies=audit.flatMap(i=>i.files||[]).filter(x=>x.sha256===before.sha256&&x.backupPath);assert.ok(copies.length);for(const f of copies)check(f.backupPath,before);return before.version;});
 const latest=senders.files.find(x=>x.url===senders.latest),b=check(path.join(root,latest.url),latest),zip=inspectZip(b),prefix='whatwhatboy-console-payload-sender/';
 const archive=audit.flatMap(i=>i.files||[]).find(f=>f.sha256===latest.sha256&&f.backupPath);assert.ok(archive);check(archive.backupPath,latest);
 const manifest=JSON.parse(zip.entries.get(prefix+'bundle-manifest.json'));assert.equal(sha(JSON.stringify(manifest.files)),latest.snapshot);assert.equal(zip.entryCount,manifest.files.length+1);
 for(const f of manifest.files){const bytes=zip.entries.get(prefix+f.name);assert.ok(bytes);assert.equal(bytes.length,f.bytes);assert.equal(sha(bytes),f.sha256);}
 for(const a of actions){assert.ok(!zip.evidence.some(f=>f.sha256===a.sha256));assert.ok(!manifest.payloads.some(p=>p.id===a.id));}
 for(const f of ['docs/host-gta505-continuation-actions.json','scripts/console-payload-bridge.cjs','assets/host-dashboard.js','assets/host-dashboard.css',...manifest.files.filter(f=>/^languages\//.test(f.name)).map(f=>f.name)])assert.equal(sha(zip.entries.get(prefix+f)),sha(fs.readFileSync(path.join(root,f))),f+' current packaged source');
 const report={checkedAt:new Date().toISOString(),status:'passed',archived,previousCataloguePinsPreserved:baseline.catalogue.length,retainedSenderVersions:retained,sender:{...latest,backupPath:archive.backupPath,zipEntries:zip.entryCount,manifestFiles:manifest.files.length,allCRCAndSHA256Verified:true,originalOnlyBinaryCount:0},receivers:read('docs/host-menu-companion-build.json'),nativeHelpersUnchanged:baseline.native.length,payloadsExecuted:false,consoleContact:false,published:false};
 fs.writeFileSync(path.join(root,'docs/qa/host-gta505-integrity.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,newFiles:archived.length,baselineFiles:baseline.catalogue.length,oldSenderVersions:retained.length,latestSender:latest.version,zipEntries:zip.entryCount}));
}
if(require.main===module)main();module.exports={main};
