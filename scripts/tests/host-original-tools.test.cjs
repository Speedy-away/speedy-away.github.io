'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ui=require('../../assets/host-dashboard.js'),bridge=require('../console-payload-bridge.cjs'),{hostActions}=require('../build-host-selector.cjs');
const actions=read('docs/host-original-tool-actions.json').actions,jobs=read('docs/host-original-tool-jobs.json').jobs;
const catalogue=read('docs/console-download-catalog.json').items,baseline=JSON.parse(fs.readFileSync(fs.existsSync(path.join(root,'docs/qa/host-original-tool-baseline.json'))?path.join(root,'docs/qa/host-original-tool-baseline.json'):path.join(process.env.WHATSITE_PROVENANCE_ROOT||path.resolve(root,'../whatsite'),'docs/qa/host-original-tool-baseline.json'),'utf8'));
const builds=[
  ['505','5.05',626472,'657aad360767ce7f9cef3c374f8ea448870df8d3cf6534a582930bbec0b400ce'],
  ['672','6.72',626504,'c19e3f0d549b241aa31febd5a5223d0bf0156bdc4e419e1083f795ea90d5ce30'],
  ['702','7.02',626664,'9f8a34ff2ab3918f3a01e3126817c3c0afd4671c3f0613e05cef540cf7d79a3c'],
  ['755','7.55',626664,'421131368229e986385a5a5cf4a65d1be8a5835d7ba018720b8764e00153871c'],
  ['900','9.00',626392,'466d816ad26393deb6476c90acda77cb80a6e2c7a15ed70cf588c9447b0a7835']
];
const goldHash='eb9fee5e9e3618c0a144a6fc6b8fc1ec7e89cf06483ad64ae7c1085efc9525a3';
function receiverItems(bytes){return JSON.parse(bytes.toString().match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]).items;}

test('original Orbis builds preserve separate exact firmware files and the HEN-first retail prerequisite',()=>{
  assert.equal(actions.length,6);assert.equal(new Set(actions.map(a=>a.id)).size,6);
  for(const [suffix,fw,bytes,digest]of builds){
    const action=actions.find(a=>a.id==='ps4-original-orbis-toolbox-1-0-1190-'+suffix);assert.ok(action);
    assert.equal(action.platform,'ps4');assert.equal(action.format,'BIN');assert.equal(action.version,'1.0.1190 Alpha');assert.deepEqual(action.firmwares,[fw]);
    assert.equal(action.bytes,bytes);assert.equal(action.sha256,digest);
    assert.equal(action.sourceCommit,'83c935231d664ee9d523edf32a1c1aecaac1a92a');
    assert.equal(action.downloadURL,'https://github.com/OSM-Made/Orbis-Toolbox/releases/download/1.0.1190/Orbis-Toolbox-'+suffix+'.bin');
    assert.equal(action.sourceURL,action.downloadURL);assert.equal(action.publicMirror,false);assert.match(action.requirements.join(' '),/HEN.*before/);
    assert.match(action.requirements.join(' '),/retail executables/);assert.match(action.requirements.join(' '),/Hybrid Flasher/);assert.match(action.requirements.join(' '),/rest-mode/);
    if(['505','672','900'].includes(suffix))assert.deepEqual(action.run,{type:'goldhen-http',port:9090,statusPath:'/status',readyStatus:'ready',input:'user-file'});
    else {assert.equal(action.run,null);assert.equal(ui.loadCapability(action).available,false);assert.match(action.requirements.join(' '),/download-only/);}
    for(const other of ['5.07','6.71','9.03','11.00','13.00','13.52','14.00'])assert.equal(ui.firmwareMatches(action,other),false,action.id+' '+other);
    assert.ok(fs.existsSync(path.join(root,action.image)));assert.match(action.imageAlt,/PS4 console/);
  }
});

test('official GoldHEN 2.4b18 exposes only the reviewed 9.00 raw BIN route and retains its release-wide evidence separately',()=>{
  const action=actions.find(a=>a.id==='ps4-original-goldhen-2-4b18-900');assert.ok(action);
  assert.equal(action.version,'2.4b18');assert.equal(action.bytes,260160);assert.equal(action.sha256,goldHash);
  assert.equal(action.downloadURL,'https://raw.githubusercontent.com/GoldHEN/GoldHEN/f2cd6f8ec51b6291ef961dc6aa721c96556dbeb4/goldhen.bin');
  assert.deepEqual(action.firmwares,['9.00']);assert.deepEqual(action.run,{type:'bin-tcp',port:9020,input:'user-file'});
  assert.deepEqual(action.originalReleaseFirmwares,['5.05','6.71','6.72','9.00','9.60','10.00','10.01','10.50','10.70','10.71','11.00']);
  assert.equal(action.extraction.archiveSHA256,'d0c84c79f65df5afc79a00c578f33ab1aa70aeb9c205f1e789895dc7d4fca38d');assert.equal(action.extraction.member,'goldhen.bin');
  assert.match(action.requirements.join(' '),/stage2/);assert.match(action.requirements.join(' '),/2\.4b18\.12/);
  for(const other of ['5.05','9.60','11.00','13.00','13.52','14.00'])assert.equal(ui.firmwareMatches(action,other),false,other);
  assert.equal(action.publicMirror,false);assert.match(action.imageAlt,/GoldHEN/);
});

test('all seven archived release jobs have exact source, version, size and hash without a public mirror',()=>{
  const audit=read('docs/download-audit.json').items;assert.equal(jobs.length,7);
  assert.equal(new Set(jobs.map(j=>j.expectedSha256)).size,7);assert.equal(jobs.reduce((n,j)=>n+j.expectedBytes,0),3650921);
  for(const job of jobs){
    assert.equal(job.kind,'direct');assert.equal(job.mirror,false);assert.deepEqual(job.archiveRole,['Builds']);assert.equal(job.platform,'PS4');
    assert.match(job.url,/^https:\/\/(?:github\.com\/(?:OSM-Made\/Orbis-Toolbox|GoldHEN\/GoldHEN)\/releases\/download\/|raw\.githubusercontent\.com\/GoldHEN\/GoldHEN\/[a-f0-9]{40}\/)/);
    const item=audit.find(i=>i.id==='ps4-ps5-'+job.id);assert.ok(item,job.id);assert.equal(item.status,'downloaded');
    const file=item.files.find(f=>f.sha256===job.expectedSha256&&f.name===job.filename);assert.ok(file,job.id);
    assert.equal(file.sourceUrl,job.url);assert.equal(file.version,job.version);assert.equal(file.bytes,job.expectedBytes);assert.ok(!file.local,job.id+' must not publicly mirror the original');
    const relative=path.relative(path.resolve('F:/whatsite-backup-downloads-etc'),path.resolve(file.backupPath));assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
    const bytes=fs.readFileSync(file.backupPath);assert.equal(bytes.length,job.expectedBytes);assert.equal(sha(bytes),job.expectedSha256);
  }
});

test('readers retain original releases while the active selector uses the separately reviewed current GoldHEN listing',()=>{
  const selected=hostActions('ps4'),loaded=bridge.loadActions();
  for(const action of actions){
    const normalized=selected.find(a=>a.id===action.id),sender=loaded.find(a=>a.id===action.id);assert.ok(sender);
    if(action.id==='ps4-original-goldhen-2-4b18-900'){assert.equal(normalized,undefined);for(const current of read('docs/host-goldhen-current.json').actions){const visible=selected.find(a=>a.id===current.id);assert.ok(visible);assert.equal(visible.sha256,current.sha256);assert.equal(visible.downloadURL,current.downloadURL);}}else{assert.ok(normalized);assert.equal(normalized.sha256,action.sha256);assert.equal(normalized.consoleFileId,action.id);}
    assert.equal(sender.downloadURL,action.downloadURL);
    const file=catalogue.find(i=>i.id===action.id);assert.ok(file);assert.equal(file.sha256,action.sha256);assert.equal(file.url,action.downloadURL);assert.equal(file.filename,path.posix.basename(action.downloadURL));assert.deepEqual(file.platforms,['ps4']);
    const availability=bridge.availability(sender);
    if(action.run){assert.equal(availability.available,true);assert.equal(availability.requiresFile,true);assert.equal(availability.bytes,action.bytes);assert.throws(()=>bridge.localFileFor(sender),{code:'user-file-required'});}
    else assert.equal(availability.available,false);
    assert.ok(!hostActions('ps5').some(a=>a.id===action.id||a.sha256===action.sha256));
  }
  for(const old of read('docs/host-repository-menu-actions.json').actions){assert.equal(old.run,null);assert.equal(ui.loadCapability(old).available,false);assert.throws(()=>bridge.userFileSpec(old),{code:'unsupported-user-file'});}
});

test('the 571-file baseline and all sixteen earlier sender snapshots retain their identity pins',()=>{
  assert.equal(baseline.catalogue.length,571);assert.equal(baseline.senders.length,16);
  for(const before of baseline.catalogue){const after=catalogue.find(a=>a.id===before.id);assert.ok(after,before.id);for(const key of ['filename','bytes','sha256','platforms'])assert.deepEqual(after[key],before[key],before.id+' '+key);}
  const sender=read('downloads/helpers/console-payload-sender/manifest.json');
  for(const before of baseline.senders){const after=sender.files.find(a=>a.url===before.url);assert.ok(after,before.url);for(const key of ['version','bytes','sha256','snapshot'])assert.equal(after[key],before[key]);}
});

test('active immutable receivers retain the prior 495 PS4 files and map all six new original downloads exactly',()=>{
  const report=read('docs/host-menu-companion-build.json');assert.equal(report.activated,true);
  for(const record of report.records){
    const current=fs.readFileSync(path.join(root,record.path));assert.equal(current.length,record.bytes);assert.equal(sha(current),record.sha256);
    assert.equal(sha(fs.readFileSync(path.join(root,record.immutablePath))),record.sha256);assert.equal(sha(fs.readFileSync(record.backupPath)),record.sha256);
    const old=baseline.receivers.find(r=>r.platform===record.platform),oldBytes=fs.readFileSync(path.join(root,old.immutablePath));assert.equal(sha(oldBytes),old.sha256);
    const items=receiverItems(current),previous=receiverItems(oldBytes);assert.equal(previous.length,record.platform==='ps4'?495:350);
    for(const before of previous){const after=items.find(i=>i.id===before.id);assert.ok(after,before.id);for(const key of ['filename','bytes','sha256'])assert.equal(after[key],before[key],before.id);}
    if(record.platform==='ps4'){assert.ok(items.length>=501);for(const action of actions){const exact=items.find(i=>i.id===action.id);assert.ok(exact);assert.equal(exact.sha256,action.sha256);assert.equal(exact.url,action.downloadURL);assert.equal(exact.bytes,action.bytes);}}
  }
});
