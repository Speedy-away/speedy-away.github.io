'use strict';
// Bounded data/hash/ZIP checks only. Never starts a sender or evaluates payloads.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function check(file,record){const b=fs.readFileSync(file);assert.equal(b.length,record.bytes,file);assert.equal(sha(b),record.sha256,file);return b;}
function main(){
  const baseline=read('docs/qa/host-repository-baseline.json'),catalogue=read('docs/console-download-catalog.json').items,audit=read('docs/download-audit.json').items;
  for(const before of baseline.catalogue){const after=catalogue.find(a=>a.id===before.id);assert.ok(after,before.id);for(const key of ['filename','bytes','sha256','platforms'])assert.deepEqual(after[key],before[key],before.id+' '+key);}
  const actions=read('docs/host-repository-menu-actions.json').actions,jobs=read('docs/host-repository-menu-jobs.json').jobs;
  const menuFiles=actions.map(action=>{
    const job=jobs.find(j=>j.expectedSha256===action.sha256);assert.ok(job);assert.equal(job.mirror,false);assert.equal(action.run,null);assert.deepEqual(action.firmwares,['9.00']);
    const record=audit.flatMap(i=>i.files||[]).find(f=>f.sha256===action.sha256&&f.bytes===action.bytes&&f.name===path.basename(action.downloadURL));assert.ok(record?.backupPath,action.id);check(record.backupPath,action);
    const entry=catalogue.find(i=>i.id===action.id);assert.equal(entry.url,action.downloadURL);assert.equal(entry.sha256,action.sha256);assert.ok(!record.local,action.id+' must retain original-only public Download');
    return {id:action.id,version:record.version||record.releaseTag,sourceURL:action.downloadURL,bytes:action.bytes,sha256:action.sha256,backupPath:record.backupPath};
  });
  const receiver=read('docs/host-menu-companion-build.json');assert.equal(receiver.activated,true);
  for(const record of receiver.records){const bytes=check(path.join(root,record.path),record);check(record.backupPath,record);const parse=b=>JSON.parse(b.toString().match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]).items;
    const current=parse(bytes),previous=parse(fs.readFileSync(path.join(root,record.previousPublicSnapshot)));
    for(const before of previous){const after=current.find(i=>i.id===before.id);assert.ok(after);for(const key of ['filename','bytes','sha256'])assert.equal(after[key],before[key]);}
    if(record.platform==='ps4')for(const action of actions)assert.equal(current.find(i=>i.id===action.id)?.sha256,action.sha256);
  }
  const sender=read('downloads/helpers/console-payload-sender/manifest.json'),native=read('docs/host-native-workspace-build.json');
  for(const before of baseline.sender)assert.ok(sender.files.some(after=>after.url===before.url&&after.sha256===before.sha256&&after.bytes===before.bytes));
  const retainedSenders=sender.files.map(info=>{check(path.join(root,info.url),info);const saved=audit.flatMap(i=>i.files||[]).find(f=>f.sha256===info.sha256&&f.backupPath);assert.ok(saved);check(saved.backupPath,info);return {version:info.version,bytes:info.bytes,sha256:info.sha256,backupPath:saved.backupPath};});
  for(const before of baseline.native){const after=native.artifacts.find(a=>a.local===before.local);assert.ok(after);assert.equal(after.sha256,before.sha256);check(path.join(root,after.local),after);check(after.backupPath,after);}
  const latest=sender.files.find(f=>f.url===sender.latest);assert.ok(latest.version.startsWith('1.7.0+'));
  const zip=require('./verify-host-menu-sender-integrity.cjs').inspectZip(check(path.join(root,latest.url),latest)),prefix='whatwhatboy-console-payload-sender/';
  const manifest=JSON.parse(zip.entries.get(prefix+'bundle-manifest.json'));assert.equal(sha(JSON.stringify(manifest.files)),manifest.snapshot);assert.equal(manifest.snapshot,latest.snapshot);
  for(const record of manifest.files){const data=zip.entries.get(prefix+record.name);assert.ok(data,record.name);assert.equal(data.length,record.bytes);assert.equal(sha(data),record.sha256);}
  assert.equal(zip.entryCount,manifest.files.length+1);assert.ok(![...zip.entries.keys()].some(n=>n.startsWith(prefix+'hosts/runtime/')));
  const goldhen=read('docs/host-actions-ps4.json').actions.find(a=>a.id==='ps4-goldhen-2-3-900-binloader');assert.deepEqual(goldhen.run.type,'bin-tcp');assert.equal(goldhen.run.port,9020);assert.deepEqual(goldhen.firmwares,['9.00']);check(path.join(root,goldhen.downloadURL),goldhen);assert.equal(sha(zip.entries.get(prefix+goldhen.downloadURL.slice(1))),goldhen.sha256);
  for(const action of actions)assert.ok(!manifest.payloads.some(p=>p.id===action.id));
  const translations=require('../i18n-tools/host-repository-translations.cjs'),codes=Object.keys(Object.values(translations)[0]);
  for(const code of codes){const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'languages',code+'.js'),'utf8'),context);const dictionary=context.window.__scoobyI18nQueue.find(pair=>pair[0]===code)[1];for(const [key,values]of Object.entries(translations))assert.equal(dictionary[key],values[code],code+' '+key);}
  const report={checkedAt:new Date().toISOString(),status:'passed',previousCatalogueFilesPreserved:baseline.catalogue.length,newMenuFiles:menuFiles,receivers:receiver.records.map(({platform,version,items,previousItems,bytes,sha256})=>({platform,version,items,previousItems,bytes,sha256})),sender:{...latest,zipEntries:zip.entryCount,manifestFiles:manifest.files.length,payloads:manifest.payloads.length},retainedSenders,unchangedNativeHelpers:baseline.native.length,languages:{count:codes.length,newKeys:Object.keys(translations).length,exactGeneratedEntriesVerified:codes.length*Object.keys(translations).length},downloadedCodeExecuted:false,consoleContact:false,limitations:['Physical PS4/PS5 execution, receiver saving and native installation remain untested.','Four original-only menu variants do not have a verified standalone Load ABI.','Complete GamerHack/RAW GAME runtimes were not vendored because redistribution permissions for required components were not established.']};
  fs.writeFileSync(path.join(root,'docs/qa/host-repository-integrity.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,preservedCatalogueFiles:report.previousCatalogueFilesPreserved,menus:menuFiles.length,sender:latest.version,zipEntries:zip.entryCount,retainedSenderSnapshots:retainedSenders.length,languages:codes.length},null,2));return report;
}
if(require.main===module)main();
module.exports={main};
