'use strict';
// Read-only artifact checks. Never start a server, evaluate a downloaded payload,
// contact a console, extract an archive, or write to the private download backup.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {inspectZip} = require('./verify-host-menu-sender-integrity.cjs');
const senderVersion = require('./package-console-payload-sender.cjs').VERSION;
const root = path.resolve(__dirname, '..');
const reportPath = 'docs/qa/host-next-batch-integrity.json';
const prefix = 'whatwhatboy-console-payload-sender/';
const commit = '23c946a7f85f1338ea2b78163e72e0ce9bc82b68';
const actionFiles = ['docs/host-legacy-firmware-menu-actions.json', 'docs/host-next-utility-actions.json'];
const jobFiles = ['docs/host-legacy-firmware-menu-jobs.json', 'docs/host-next-utility-jobs.json'];
const excludedJavaScriptHash = '0a13d2a758869a23259b3527a956b493c8c4708c2c6a441fb133a455ebf237cc';
const oysterPins = [
  ['100','1.00','09925fe9288bd9e68f49ffaffba3e92fb6ddb1c8cf416e16251cdef53f19a67a','a658ceafd4b580c1bfd71173f9c7e6ec4ec91d4c'],
  ['113','1.13','38f847706303c2c2b5b71102073ac86fa534f1bc09b6c40129275a53b0c81718','5d14a719a814a38a9e2d3083b07e815f7760686a'],
  ['119','1.19','93fd71c737f4433f72dd594685303e23183859fa448dfafefc15bd8906676f7e','563eab1efea2447849115fb12a86d98ff6ae43a9'],
  ['124','1.24','b5566c5629c86f8860ba190537e0c2a2e220c879f469a155b924467b975ec08d','9ec99c1ae2c4133edc4f39ac90f65890598ced8f']
];
const ftpId = 'ps4-original-hippie68-ftp-1-08b-900';
const ftpHash = '695082f37c5cfdce14a06fbd567fa8651017ee2e31f3e95ae7a769b4287cb0e9';
const read = file => JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
function historical(file){const local=path.join(root,file);return JSON.parse(fs.readFileSync(fs.existsSync(local)?local:path.join(process.env.WHATSITE_PROVENANCE_ROOT||path.resolve(root,'../whatsite'),file),'utf8'));}
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blob = bytes => crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
function local(url) {
  assert.ok(typeof url === 'string' && url.startsWith('/') && !/[\\\x00-\x1f]/.test(url));
  assert.ok(!url.split('/').some(part=>part==='.'||part==='..'));
  return path.join(root,url.slice(1));
}
function check(file,record) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.length,record.bytes,file+' bytes');
  assert.equal(sha(bytes),record.sha256,file+' SHA-256');
  return bytes;
}
function insideBackup(file) {
  const relative = path.relative(path.resolve('F:/whatsite-backup-downloads-etc'),path.resolve(file));
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative),'Private file stays inside the named F: archive');
}
function receiverItems(bytes) {
  const match = bytes.toString('utf8').match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match,'Receiver catalogue JSON exists');
  return JSON.parse(match[1]).items;
}
function context() {
  return {
    baseline:historical('docs/qa/host-next-batch-baseline.json'),
    catalogue:read('docs/console-download-catalog.json').items,
    audit:read('docs/download-audit.json').items,
    actions:actionFiles.flatMap(file=>read(file).actions),
    jobs:jobFiles.flatMap(file=>read(file).jobs),
    receiver:read('docs/host-menu-companion-build.json'),
    senderManifest:read('downloads/helpers/console-payload-sender/manifest.json'),
    ui:require('../assets/host-dashboard.js'),
    bridge:require('./console-payload-bridge.cjs'),
    hostActions:require('./build-host-selector.cjs').hostActions
  };
}
function verifyActionPins(c) {
  assert.equal(c.actions.length,5);assert.equal(c.jobs.length,5);
  assert.equal(new Set(c.actions.map(a=>a.id)).size,5);
  assert.equal(new Set(c.jobs.map(j=>j.expectedSha256)).size,5);
  const older = read('docs/host-game-actions.json').actions.find(a=>a.id==='ps4-oysters-rdr2-129');
  assert.ok(older);assert.equal(older.sha256,'424f9dbf4813cd55366d446d36d0dc84aa950025a6341a47d1ac0f5f8dbf6986');
  assert.deepEqual(older.firmwares,['9.00']);
  for (const [key,gameVersion,digest,gitBlob] of oysterPins) {
    const a = c.actions.find(a=>a.id==='ps4-legacy-firmware-gamerhack-oysters505-'+key);assert.ok(a);
    assert.equal(a.game,'RDR2');assert.equal(a.gameVersion,gameVersion);assert.equal(a.menuVersion,null);assert.deepEqual(a.titleIds,[]);
    assert.equal(a.menuFamily,'Oysters');assert.equal(a.family,'Oysters');assert.equal(a.label,'Oysters');
    assert.equal(a.image,older.image);assert.ok(fs.existsSync(local(a.image)));
    assert.equal(a.bytes,1260864);assert.equal(a.sha256,digest);assert.equal(a.sourceCommit,commit);assert.equal(a.sourceGitBlobSHA1,gitBlob);
    assert.equal(a.sourceFile,'505/OystersMenu-v'+gameVersion+'.bin');
    assert.equal(a.downloadURL,`https://raw.githubusercontent.com/GamerHack/GamerHack.github.io/${commit}/${a.sourceFile}`);
    assert.equal(a.sourceURL,a.downloadURL);assert.deepEqual(a.firmwares,['5.05']);assert.equal(a.run,null);assert.equal(a.launchURL,null);
    assert.equal(c.ui.loadCapability(a).available,false);assert.throws(()=>c.bridge.userFileSpec(a),{code:'unsupported-user-file'});
    assert.equal(a.loaderEvidence.externalTransportVerified,false);
    assert.match(a.requirements.join(' '),/Menu release is unknown/);
    assert.match(c.ui.variantLabel(a),new RegExp('Game update: '+gameVersion.replace('.','\\.')));
    assert.match(c.ui.variantLabel(a),/Menu version: Not provided/);
    for (const fw of ['5.07','6.72','9.00','11.00','13.00','14.00']) assert.equal(c.ui.firmwareMatches(a,fw),false,a.id+' '+fw);
  }
  const ftp = c.actions.find(a=>a.id===ftpId);assert.ok(ftp);
  assert.equal(ftp.version,'1.08b');assert.equal(ftp.bytes,37824);assert.equal(ftp.sha256,ftpHash);
  assert.equal(ftp.sourceCommit,'c903943d93dd082b590ee747c114a8c2436aaf71');
  assert.equal(ftp.downloadURL,'https://github.com/hippie68/ps4-ftp/releases/download/v1.08b/ftp_server_v1.08b.bin');
  assert.equal(ftp.sourceURL,ftp.downloadURL);assert.deepEqual(ftp.firmwares,['9.00']);
  assert.deepEqual(ftp.run,{type:'goldhen-http',port:9090,statusPath:'/status',readyStatus:'ready',input:'user-file'});
  assert.equal(c.ui.loadCapability(ftp).available,true);
  for (const fw of ['5.05','6.72','7.55','9.03','11.00','13.00','14.00']) assert.equal(c.ui.firmwareMatches(ftp,fw),false,fw);
  assert.match(ftp.requirements.join(' '),/1337/);assert.match(ftp.requirements.join(' '),/SHUTDOWN/);
  for (const a of c.actions) {assert.equal(a.platform,'ps4');assert.equal(a.format,'BIN');assert.equal(a.publicMirror,false);assert.match(a.downloadURL,/^https:\/\//);}
  return {actions:5,oysters:4,ftp:1,bytes:c.actions.reduce((n,a)=>n+a.bytes,0)};
}
function verifyExcludedJavaScript(c) {
  const review = historical('docs/qa/host-remaining-menu-review.json');
  const excluded = review.explicitExclusions.find(a=>a.path==='505/arabic-guy127.bin');assert.ok(excluded);
  assert.equal(excluded.sha256,excludedJavaScriptHash);assert.equal(excluded.bytes,2432450);
  assert.equal(excluded.first16Hex,'766172207061796c6f6164203d205b32');assert.match(excluded.detectedFormat,/JavaScript/);
  assert.equal(excluded.builtInLoadQualified,false);
  const badURL = `/505/arabic-guy127.bin`;
  for (const a of [...c.bridge.loadActions(),...c.catalogue]) {
    assert.notEqual(a.sha256,excludedJavaScriptHash,'Misnamed JavaScript is not a ready asset');
    assert.ok(!(a.downloadURL||a.url||'').endsWith(badURL),'Misnamed source is not promoted as a ready BIN');
  }
  assert.ok(!c.jobs.some(j=>j.expectedSha256===excludedJavaScriptHash));
  return {path:excluded.path,sha256:excludedJavaScriptHash,readyAsset:false,rawBINLoad:false};
}
function verifyArchive(c) {
  assert.equal(c.jobs.reduce((n,j)=>n+j.expectedBytes,0),5081280);
  return c.jobs.map(job=>{
    assert.equal(job.mirror,false);assert.equal(job.kind,'direct');assert.deepEqual(job.archiveRole,['Builds']);assert.equal(job.platform,'PS4');
    const action = c.actions.find(a=>a.sha256===job.expectedSha256);assert.ok(action);
    assert.equal(action.bytes,job.expectedBytes);assert.equal(action.sourceURL,job.url);assert.deepEqual(action.firmwares,job.firmwareScope);
    const entry = c.audit.find(i=>i.id==='ps4-ps5-'+job.id);assert.ok(entry,'Archive intake pending: '+job.id);assert.equal(entry.status,'downloaded');
    const record = entry.files.find(f=>f.sha256===job.expectedSha256&&f.name===job.filename);assert.ok(record,job.id);
    assert.equal(record.bytes,job.expectedBytes);assert.equal(record.sourceUrl,job.url);assert.equal(record.version,job.version);
    assert.ok(!record.local,'Original file must not have a public mirror');insideBackup(record.backupPath);
    const bytes = check(record.backupPath,record);assert.equal(bytes[0],0xe9);assert.notEqual(bytes.subarray(0,4).toString('hex'),'7f454c46');
    if(job.sourceGitBlobSHA1) assert.equal(blob(bytes),job.sourceGitBlobSHA1);
    const item = c.catalogue.find(i=>i.id===action.id);assert.ok(item,action.id);assert.equal(item.url,job.url);assert.equal(item.sha256,job.expectedSha256);assert.equal(item.bytes,job.expectedBytes);
    return {id:entry.id,filename:record.name,version:record.version,sourceURL:record.sourceUrl,bytes:record.bytes,sha256:record.sha256,backupPath:record.backupPath};
  });
}
function verifyReaders(c) {
  const ps4 = c.hostActions('ps4'), ps5 = c.hostActions('ps5'), bridge = c.bridge.loadActions();
  for (const a of c.actions) {
    const host = ps4.find(x=>x.id===a.id), sender = bridge.find(x=>x.id===a.id);assert.ok(host&&sender,a.id);
    assert.equal(host.consoleFileId,a.id);assert.equal(host.sha256,a.sha256);assert.equal(sender.sha256,a.sha256);assert.equal(sender.downloadURL,a.downloadURL);
    assert.ok(!ps5.some(x=>x.id===a.id||x.sha256===a.sha256));
    const availability = c.bridge.availability(sender);
    if(a.id===ftpId) {assert.equal(availability.available,true);assert.equal(availability.requiresFile,true);assert.equal(availability.bytes,37824);assert.throws(()=>c.bridge.localFileFor(sender),{code:'user-file-required'});}
    else assert.equal(availability.available,false);
  }
  const groups = c.ui.groupActions(ps4), oysters = groups.filter(g=>g.label==='Oysters'&&g.game==='RDR2');
  assert.equal(oysters.length,1,'Existing and new Oysters variants share one family card');
  for(const id of ['ps4-oysters-rdr2-129',...c.actions.filter(a=>a.menuFamily==='Oysters').map(a=>a.id)]) assert.ok(oysters[0].actions.some(a=>a.id===id),id);
  return {newActionsPresent:5,ps5NewActions:0,oystersFamilyCards:1,oystersVariants:oysters[0].actions.length};
}
function verifyBaseline(c) {
  assert.equal(c.baseline.catalogue.length,577);assert.equal(c.baseline.senders.length,17);assert.equal(c.baseline.native.length,2);
  for(const before of c.baseline.catalogue) {
    const after = c.catalogue.find(i=>i.id===before.id);assert.ok(after,before.id);
    for(const key of ['filename','bytes','sha256','platforms']) assert.deepEqual(after[key],before[key],before.id+' '+key);
  }
  for(const before of c.baseline.senders) {
    const after = c.senderManifest.files.find(i=>i.url===before.url);assert.ok(after,before.url);
    for(const key of ['id','name','version','bytes','sha256','snapshot']) assert.equal(after[key],before[key],before.version+' '+key);
  }
  const native = read('docs/host-native-workspace-build.json').artifacts;
  assert.equal(native.length,2);
  for(const before of c.baseline.native) {
    const after = native.find(i=>i.platform===before.platform);assert.deepEqual(after,before,'Active native helper record is unchanged');
    check(local(after.downloadURL),after);check(local(after.immutablePath),after);insideBackup(after.backupPath);check(after.backupPath,after);
  }
  return {catalogueFiles:577,senderSnapshots:17,nativeHelpers:2};
}
function verifyReceivers(c) {
  assert.equal(c.receiver.activated,true);assert.match(c.receiver.version,/^2026\.11\.02\.\d+$/);assert.ok(Number(c.receiver.version.split('.').at(-1))>=15,'Receiver 15 or a retaining successor must be activated');
  return c.receiver.records.map(record=>{
    assert.equal(record.version,c.receiver.version);
    const current = receiverItems(check(path.join(root,record.path),record));check(path.join(root,record.immutablePath),record);insideBackup(record.backupPath);check(record.backupPath,record);
    const old = c.baseline.receivers.find(r=>r.platform===record.platform);assert.ok(old);
    const previous = receiverItems(check(path.join(root,old.immutablePath),old));insideBackup(old.backupPath);check(old.backupPath,old);
    assert.equal(previous.length,record.platform==='ps4'?501:350);assert.ok(current.length>=(record.platform==='ps4'?506:350));
    for(const before of previous) {const after=current.find(i=>i.id===before.id);assert.ok(after,before.id);for(const key of ['filename','bytes','sha256'])assert.equal(after[key],before[key],before.id+' '+key);}
    if(record.platform==='ps4') for(const a of c.actions) {const entry=current.find(i=>i.id===a.id);assert.ok(entry,a.id);assert.equal(entry.url,a.downloadURL);assert.equal(entry.sha256,a.sha256);assert.equal(entry.bytes,a.bytes);}
    else for(const a of c.actions) assert.ok(!current.some(i=>i.id===a.id||i.sha256===a.sha256));
    return {platform:record.platform,version:record.version,bytes:record.bytes,sha256:record.sha256,previousItemsPreserved:previous.length,items:current.length,backupPath:record.backupPath};
  });
}
function phaseIssues(c) {
  const issues = [];
  if(!c.receiver.activated||!/^2026\.11\.02\.\d+$/.test(c.receiver.version)||Number(c.receiver.version.split('.').at(-1))<15) issues.push('Receiver 2026.11.02.15 or a retaining successor is not activated.');
  const latest = c.senderManifest.files.find(f=>f.url===c.senderManifest.latest);
  if(!latest||latest.version!==senderVersion+'+'+latest.snapshot.slice(0,12)) issues.push('Current sender '+senderVersion+' is not the latest archived snapshot.');
  for(const job of c.jobs) if(!c.audit.some(i=>i.id==='ps4-ps5-'+job.id&&i.status==='downloaded')) issues.push('Archive intake is pending for '+job.id+'.');
  return issues;
}
function inspectSender(c,info,final) {
  const bytes = check(local(info.url),info);
  const records = c.audit.flatMap(i=>i.files||[]).filter(f=>f.sha256===info.sha256&&f.bytes===info.bytes&&f.backupPath);assert.ok(records.length,info.version+' archive copy');
  for(const record of records) {insideBackup(record.backupPath);check(record.backupPath,info);}
  const zip = inspectZip(bytes);
  const member = name=>{const data=zip.entries.get(prefix+name);assert.ok(data,'Missing ZIP member '+name);return data;};
  const manifest = JSON.parse(member('bundle-manifest.json'));
  assert.equal(manifest.version,info.version);assert.equal(manifest.snapshot,info.snapshot);assert.equal(sha(JSON.stringify(manifest.files)),info.snapshot);
  assert.equal(zip.entryCount,manifest.files.length+1);assert.equal(zip.entryCount,info.files);
  assert.equal(manifest.payloads.length,info.payloads);
  const names = new Set();
  for(const file of manifest.files) {assert.ok(!names.has(file.name));names.add(file.name);const data=member(file.name);assert.equal(data.length,file.bytes);assert.equal(sha(data),file.sha256);}
  const forbidden = new Set([excludedJavaScriptHash,...c.jobs.map(j=>j.expectedSha256)]);
  for(const file of zip.evidence) assert.ok(!forbidden.has(file.sha256),'Original-only and misnamed payloads are not bundled');
  for(const a of c.actions) assert.ok(!manifest.payloads.some(p=>p.id===a.id));
  let preservedActions = 0;
  if(info.version===c.baseline.senders.at(-1).version) {
    const oldActions = manifest.files.filter(f=>/^docs\/host.*actions(?:-ps[45])?\.json$/.test(f.name)).flatMap(f=>{const j=JSON.parse(member(f.name));return (j.actions||[]).map(a=>({...a,platform:a.platform||j.platform}));});
    const current = c.bridge.loadActions();assert.equal(oldActions.length,174);
    for(const before of oldActions) {const after=current.find(a=>a.id===before.id&&a.platform===before.platform);assert.ok(after,before.id);for(const key of ['sha256','downloadURL','firmwares','gameVersion','menuVersion','run'])assert.deepEqual(after[key],before[key],before.id+' '+key);}
    preservedActions = oldActions.length;
  }
  if(final) {
    assert.equal(info.version,senderVersion+'+'+info.snapshot.slice(0,12));
    assert.equal(info.name,'console-payload-sender-'+senderVersion+'-'+info.snapshot.slice(0,12)+'.zip');
    // The website can move independently of the immutable sender release.
    // Its bundled UI and translations are checked against the pinned ZIP manifest above.
    for(const file of ['assets/host-console-client.js','assets/host-dashboard.js','assets/host-dashboard.css']) assert.ok(names.has(file),file+' is present in the released sender');
    for(const file of [...actionFiles,'scripts/console-payload-bridge.cjs']) assert.equal(sha(member(file)),sha(fs.readFileSync(path.join(root,file))),file+' is final authored source');
    for(const file of actionFiles) assert.deepEqual(JSON.parse(member(file)).actions,read(file).actions);
    const html = member('hosts/ps4/index.html').toString('utf8');
    const embedded = JSON.parse(html.match(/<script id="host-actions-data" type="application\/json">([\s\S]*?)<\/script>/)[1]).actions;
    for(const a of c.actions) {const row=embedded.find(x=>x.id===a.id);assert.ok(row,a.id);for(const key of ['sha256','bytes','downloadURL','firmwares','gameVersion','menuVersion','run'])assert.deepEqual(row[key],a[key],a.id+' '+key);}
    assert.ok(![...zip.entries.keys()].some(name=>name.startsWith(prefix+'hosts/runtime/')));
    const oldGold = read('docs/host-actions-ps4.json').actions.find(a=>a.id==='ps4-goldhen-2-3-900-binloader');assert.ok(oldGold);
    assert.equal(oldGold.run.input,undefined);assert.equal(sha(member(oldGold.downloadURL.slice(1))),oldGold.sha256);assert.ok(manifest.payloads.some(p=>p.id===oldGold.id));
    assert.ok(member('assets/host-console-client.js').toString().includes('runFileViaBridge'));
    assert.ok(member('scripts/console-payload-bridge.cjs').toString().includes('/api/run-file'));
  }
  return {version:info.version,url:info.url,bytes:info.bytes,sha256:info.sha256,snapshot:info.snapshot,zipEntries:zip.entryCount,manifestFiles:manifest.files.length,payloads:manifest.payloads.length,allCRCAndSHA256Verified:true,privateArchivePaths:records.map(r=>r.backupPath),preservedActions,originalOnlyBinaryCount:0};
}
function verifySenders(c) {
  const latest = c.senderManifest.files.find(f=>f.url===c.senderManifest.latest);assert.ok(latest);
  assert.equal(latest.version,senderVersion+'+'+latest.snapshot.slice(0,12),'Current sender must be archived before verification');
  const reports = c.senderManifest.files.map(info=>inspectSender(c,info,info.url===latest.url));
  assert.ok(reports.length>=18);assert.equal(reports.reduce((n,r)=>n+r.preservedActions,0),174);
  return {latest:reports.find(r=>r.url===latest.url),historicalSnapshotsPreserved:17,totalSnapshotsVerified:reports.length,snapshots:reports,existingGoldHEN23StillBundled:true};
}
function main() {
  let report;
  try {
    const c=context(),pending=phaseIssues(c);
    if(pending.length) {report={schemaVersion:1,checkedAt:new Date().toISOString(),status:'pending',pending,downloadedCodeExecuted:false};process.exitCode=2;}
    else {
      const pins=verifyActionPins(c),excluded=verifyExcludedJavaScript(c),archive=verifyArchive(c),readers=verifyReaders(c),baseline=verifyBaseline(c),receivers=verifyReceivers(c),senders=verifySenders(c);
      report={schemaVersion:1,checkedAt:new Date().toISOString(),status:'passed',method:'Read bytes only; independent bounded ZIP central/local structure, CRC32 and SHA-256 verification, original-source archive pins, immutable receiver retention and unchanged native helper records.',pins,excluded,archive,archiveBytes:archive.reduce((n,f)=>n+f.bytes,0),readers,preserved:baseline,receivers,senders,downloadedCodeExecuted:false,archiveMutations:false,consoleContact:false,limitations:['Static integrity does not establish successful loading on physical consoles.','Historical Oysters 5.05 files retain disabled Load because their external ABI is unverified.','The five new originals are privately archived and downloaded from upstream; no original binary is publicly mirrored or bundled.']};
    }
  } catch(error) {report={schemaVersion:1,checkedAt:new Date().toISOString(),status:'failed',error:error.message,downloadedCodeExecuted:false};process.exitCode=1;}
  fs.writeFileSync(path.join(root,reportPath),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,report:reportPath,pending:report.pending,error:report.error,actions:report.pins?.actions,sender:report.senders?.latest.version},null,2));
  return report;
}
module.exports={senderVersion,context,phaseIssues,verifyActionPins,verifyExcludedJavaScript,verifyArchive,verifyReaders,verifyBaseline,verifyReceivers,verifySenders,main};
if(require.main===module) main();
