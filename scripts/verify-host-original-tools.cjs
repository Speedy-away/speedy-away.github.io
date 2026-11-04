'use strict';
// Data-only verification: SHA-256, immutable receiver records and bounded ZIP
// structure/CRC inspection. Does not start a sender, load browser code, evaluate
// downloaded payloads, connect to a console or depend on temporary review files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const prefix='whatwhatboy-console-payload-sender/';
function check(file,record){const bytes=fs.readFileSync(file);assert.equal(bytes.length,record.bytes,file);assert.equal(sha(bytes),record.sha256,file);return bytes;}
function local(url){assert.ok(url.startsWith('/')&&!url.split('/').some(p=>p==='.'||p==='..'));return path.join(root,url);}
function receiverItems(bytes){return JSON.parse(bytes.toString().match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]).items;}
function main(){
  const baseline=read('docs/qa/host-original-tool-baseline.json'),catalogue=read('docs/console-download-catalog.json').items,audit=read('docs/download-audit.json').items;
  assert.equal(baseline.catalogue.length,571);assert.equal(baseline.senders.length,16);
  for(const before of baseline.catalogue){const after=catalogue.find(a=>a.id===before.id);assert.ok(after,before.id);for(const key of ['filename','bytes','sha256','platforms'])assert.deepEqual(after[key],before[key],before.id+' '+key);}
  const actions=read('docs/host-original-tool-actions.json').actions,jobs=read('docs/host-original-tool-jobs.json').jobs,evidence=read('docs/qa/host-original-tool-source-review.json');
  assert.equal(actions.length,6);assert.equal(jobs.length,7);assert.equal(new Set(jobs.map(j=>j.expectedSha256)).size,7);
  const archived=jobs.map(job=>{
    assert.equal(job.mirror,false);assert.deepEqual(job.archiveRole,['Builds']);assert.equal(job.kind,'direct');assert.equal(job.platform,'PS4');
    const item=audit.find(i=>i.id==='ps4-ps5-'+job.id);assert.ok(item,job.id);assert.equal(item.status,'downloaded');
    const record=item.files.find(f=>f.sha256===job.expectedSha256&&f.name===job.filename);assert.ok(record,job.id);assert.equal(record.bytes,job.expectedBytes);assert.equal(record.sourceUrl,job.url);assert.equal(record.version,job.version);assert.ok(!record.local);
    const relative=path.relative(path.resolve('F:/whatsite-backup-downloads-etc'),path.resolve(record.backupPath));assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
    const bytes=check(record.backupPath,record);
    if(/\.bin$/i.test(job.filename)){assert.equal(bytes[0],0xe9,'Flat x64 jump entry');assert.notEqual(bytes.subarray(0,4).toString('hex'),'7f454c46');}
    else assert.equal(bytes.subarray(0,6).toString('hex'),'377abcaf271c');
    assert.ok(evidence.files.some(f=>f.sha256===record.sha256&&f.bytes===record.bytes&&f.sourceURL===job.url));
    return {id:item.id,filename:record.name,version:record.version,sourceURL:record.sourceUrl,bytes:record.bytes,sha256:record.sha256,backupPath:record.backupPath};
  });
  const {hostActions}=require('./build-host-selector.cjs'),bridge=require('./console-payload-bridge.cjs'),ui=require('../assets/host-dashboard.js');
  const normalized=hostActions('ps4'),senderActions=bridge.loadActions();
  for(const action of actions){
    assert.equal(action.platform,'ps4');assert.equal(action.publicMirror,false);assert.equal(action.format,'BIN');assert.ok(action.firmwares.length===1&&!/^1[134]\./.test(action.firmwares[0]));
    const file=catalogue.find(i=>i.id===action.id),host=normalized.find(i=>i.id===action.id),sender=senderActions.find(i=>i.id===action.id);
    assert.ok(file&&host&&sender,action.id);assert.equal(file.sha256,action.sha256);assert.equal(file.url,action.downloadURL);assert.equal(file.filename,path.posix.basename(action.downloadURL));assert.deepEqual(file.platforms,['ps4']);assert.equal(host.consoleFileId,action.id);
    const availability=bridge.availability(sender);
    if(action.run){assert.equal(action.run.input,'user-file');assert.equal(availability.available,true);assert.equal(availability.requiresFile,true);assert.equal(availability.bytes,action.bytes);assert.throws(()=>bridge.localFileFor(sender),{code:'user-file-required'});}
    else {assert.equal(availability.available,false);assert.equal(ui.loadCapability(action).available,false);}
    assert.ok(!hostActions('ps5').some(i=>i.id===action.id||i.sha256===action.sha256));
  }
  const receivers=read('docs/host-menu-companion-build.json');assert.equal(receivers.activated,true);
  const receiverReport=receivers.records.map(record=>{
    const bytes=check(path.join(root,record.path),record);check(path.join(root,record.immutablePath),record);check(record.backupPath,record);
    const before=baseline.receivers.find(r=>r.platform===record.platform),previous=receiverItems(check(path.join(root,before.immutablePath),before)),current=receiverItems(bytes);
    assert.equal(previous.length,record.platform==='ps4'?495:350);
    for(const old of previous){const after=current.find(i=>i.id===old.id);assert.ok(after,old.id);for(const key of ['filename','bytes','sha256'])assert.equal(after[key],old[key],old.id);}
    if(record.platform==='ps4'){assert.ok(current.length>=501);for(const action of actions){const file=current.find(i=>i.id===action.id);assert.ok(file);assert.equal(file.sha256,action.sha256);assert.equal(file.bytes,action.bytes);assert.equal(file.url,action.downloadURL);}}
    return {platform:record.platform,version:record.version,bytes:record.bytes,sha256:record.sha256,items:current.length,previousItemsPreserved:previous.length,backupPath:record.backupPath};
  });
  const senderManifest=read('downloads/helpers/console-payload-sender/manifest.json');
  for(const before of baseline.senders){const after=senderManifest.files.find(f=>f.url===before.url);assert.ok(after,before.url);for(const key of ['version','bytes','sha256','snapshot'])assert.equal(after[key],before[key]);}
  const retained=senderManifest.files.map(info=>{check(local(info.url),info);const matches=audit.flatMap(i=>i.files||[]).filter(f=>f.sha256===info.sha256&&f.bytes===info.bytes&&f.backupPath);assert.ok(matches.length,info.version);const record=matches[0];check(record.backupPath,record);return {version:info.version,bytes:info.bytes,sha256:info.sha256,publicURL:info.url,backupPath:record.backupPath};});
  const latest=senderManifest.files.find(f=>f.url===senderManifest.latest);assert.ok(/^1\.8\./.test(latest.version),'Archive final sender1.8 before running this verifier.');
  const zip=require('./verify-host-menu-sender-integrity.cjs').inspectZip(check(local(latest.url),latest));
  const member=name=>{const data=zip.entries.get(prefix+name);assert.ok(data,'Missing ZIP member '+name);return data;};
  const manifest=JSON.parse(member('bundle-manifest.json'));assert.equal(sha(JSON.stringify(manifest.files)),manifest.snapshot);assert.equal(manifest.snapshot,latest.snapshot);assert.equal(manifest.version,latest.version);
  assert.equal(zip.entryCount,manifest.files.length+1);const names=new Set();
  for(const record of manifest.files){assert.ok(!names.has(record.name));names.add(record.name);const data=member(record.name);assert.equal(data.length,record.bytes);assert.equal(sha(data),record.sha256);}
  for(const file of ['docs/host-original-tool-actions.json','assets/host-console-client.js','assets/host-dashboard.js','scripts/console-payload-bridge.cjs'])assert.equal(sha(member(file)),sha(fs.readFileSync(path.join(root,file))),file+' must match final source');
  const packaged=JSON.parse(member('docs/host-original-tool-actions.json')).actions;
  assert.deepEqual(packaged,actions);assert.ok(member('assets/host-console-client.js').toString().includes('runFileViaBridge'));assert.ok(member('scripts/console-payload-bridge.cjs').toString().includes('/api/run-file'));
  for(const file of ['assets/host-console-client.js','assets/host-dashboard.js','scripts/console-payload-bridge.cjs'])new vm.Script(member(file).toString(),{filename:'packaged-'+file}); // Syntax parsing of authored code only.
  const oldMenus=read('docs/host-repository-menu-actions.json').actions;
  for(const action of oldMenus){assert.equal(action.run,null);assert.equal(ui.loadCapability(action).available,false);}
  const excludedHashes=new Set([...jobs.map(j=>j.expectedSha256),...oldMenus.map(a=>a.sha256)]);
  assert.ok(manifest.files.every(f=>!excludedHashes.has(f.sha256)),'No selected original binaries/archives or previous unsupported menu binaries may be bundled.');
  for(const action of [...actions,...oldMenus])assert.ok(!manifest.payloads.some(p=>p.id===action.id));
  assert.ok(![...zip.entries.keys()].some(name=>name.startsWith(prefix+'hosts/runtime/')));
  const oldGold=read('docs/host-actions-ps4.json').actions.find(a=>a.id==='ps4-goldhen-2-3-900-binloader');assert.ok(oldGold);assert.equal(oldGold.run.input,undefined);assert.equal(sha(member(oldGold.downloadURL.slice(1))),oldGold.sha256);assert.ok(manifest.payloads.some(p=>p.id===oldGold.id));
  const embedded=JSON.parse(member('hosts/ps4/index.html').toString().match(/<script id="host-actions-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  for(const action of actions){const row=embedded.actions.find(a=>a.id===action.id);assert.ok(row);assert.equal(row.downloadURL,action.downloadURL);assert.deepEqual(row.firmwares,action.firmwares);assert.deepEqual(row.run,action.run);}
  const report={schemaVersion:1,checkedAt:new Date().toISOString(),status:'passed',method:'Independent bounded ZIP central/local/CRC reader plus SHA-256 rehashing of public, archived and manifest files. No payload execution or console connection.',
    preservedCatalogueFiles:baseline.catalogue.length,newOriginalActions:actions.length,archiveFiles:archived,archiveBytes:archived.reduce((n,f)=>n+f.bytes,0),receivers:receiverReport,
    sender:{...latest,zipEntries:zip.entryCount,manifestFiles:manifest.files.length,payloads:manifest.payloads.length,allCRCAndSHA256Verified:true,selectedBinaryCountInZIP:0,earlierUnsupportedMenuBinaryCountInZIP:0,existingGoldHEN23StillBundled:true,allRequiredAuthoredSourceBytesMatch:true},
    historicalSenderSnapshotsPreserved:baseline.senders.length,allSenderSnapshotsVerified:retained.length,retainedSenders:retained,
    boundaries:{PS4Only:true,orbisSelectedFileFirmwares:['5.05','6.72','9.00'],orbisDownloadOnlyFirmwares:['7.02','7.55'],goldhen24LoadFirmware:['9.00'],noPS513xx14Claims:true},
    downloadedCodeExecuted:false,consoleContact:false,limitations:['No physical console loading, native installation, receiver saving or execution verified.','Selected BINs remain original-only downloads; the sender reads chosen exact bytes in memory only.','The four earlier GamerHack menu files retain disabled Load because their standalone ABI remains unverified.']};
  fs.writeFileSync(path.join(root,'docs/qa/host-original-tool-integrity.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,preservedCatalogueFiles:baseline.catalogue.length,actions:actions.length,archivedFiles:archived.length,sender:latest.version,zipEntries:zip.entryCount,retainedSenderSnapshots:retained.length,selectedBinariesBundled:0},null,2));return report;
}
module.exports={main};
if(require.main===module)main();
