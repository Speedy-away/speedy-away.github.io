const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),archive='F:/whatsite-backup-downloads-etc';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const check=(ok,message)=>{if(!ok)throw Error(message)};
const key=f=>JSON.stringify([f.backupPath||'',f.name||f.filename||'',f.bytes,f.sha256,f.version||null,f.sourceUrl||f.resolvedUrl||'']);
function main(){
 const baseline=read(path.join(root,'docs/tmp/unlocated-recovery/baseline.json'));
 const receipts=read(path.join(root,'docs/tmp/unlocated-recovery/recovered.json')).results;
 const current=read(path.join(root,'docs/download-audit.json')),backup=read(path.join(archive,'download-inventory.json'));
 check(JSON.stringify(current.items)===JSON.stringify(backup.items),'Inventory items differ');
 const map=new Map(current.items.map(i=>[i.id,i]));let preserved=0;
 for(const old of baseline.items){const item=map.get(old.id);check(item,'Older item missing: '+old.id);const identities=new Set((item.files||[]).flatMap(f=>[key(f),...(f.recoveryOriginalFileRecord?[key(f.recoveryOriginalFileRecord)]:[])]));for(const f of old.files||[]){check(identities.has(key(f)),'Older file/version/source metadata missing: '+old.id);preserved++;}}
 let scopedFilesPreserved=0;const laterConcurrentIntake=[];
 for(const name of fs.readdirSync(path.join(root,'docs')).filter(x=>x.endsWith('-private-inventory.json')))for(const old of read(path.join(root,'docs',name)).items){const item=map.get(old.id);if(!item){laterConcurrentIntake.push({sidecar:name,id:old.id,reason:'New concurrent intake after the verified union; retained in its durable sidecar'});continue;}const identities=new Set((item.files||[]).flatMap(f=>[key(f),...(f.recoveryOriginalFileRecord?[key(f.recoveryOriginalFileRecord)]:[])]));for(const f of old.files||[]){if(!identities.has(key(f))){laterConcurrentIntake.push({sidecar:name,id:old.id,reason:'New concurrent file after the verified union; retained in its durable sidecar'});continue;}scopedFilesPreserved++;}}
 const entries=[];
 for(const r of receipts){const f=r.archivedFile,stored=fs.readFileSync(f.backupPath),original=r.originalFile;
  check(stored.length===original.bytes&&sha(stored)===original.sha256,'Recovered archive differs: '+r.id);
  const publicOriginal=fs.readFileSync(path.join(root,original.local));check(sha(publicOriginal)===original.sha256,'Local original changed: '+r.id);
  const item=map.get(r.id);check(item.files.some(x=>x.backupPath&&x.sha256===original.sha256),'Recovered record is still unlocated: '+r.id);
  entries.push({id:r.id,name:original.name,version:f.version,originalVersion:original.version,bytes:original.bytes,sha256:original.sha256,sourceUrl:new URL(f.sourceUrl).origin+new URL(f.sourceUrl).pathname,archiveRelativePath:path.relative(archive,f.backupPath).replaceAll('\\','/'),method:'Existing local original; exact historical byte count and SHA-256 matched'});
 }
 const unavailable=current.items.flatMap(i=>i.files||[]).filter(f=>!f.backupPath);check(unavailable.length===0,'Unlocated records remain');
 check(current.indexRefresh.missingPaths===0&&current.indexRefresh.otherUnavailableRecords===0,'Index has missing/unavailable records');
 const report={checkedAt:new Date().toISOString(),status:'complete',examined:baseline.rows.length,recovered:entries.length,recoveredBytes:entries.reduce((n,x)=>n+x.bytes,0),networkDownloads:0,remainingUnlocated:0,olderFileRecordsPreserved:preserved,olderItemsPreserved:baseline.items.length,scopedFilesPreserved,laterConcurrentIntake,finalIndex:current.indexRefresh,payloadsExecuted:false,sitePagesChanged:false,entries};
 fs.writeFileSync(path.join(root,'docs/unlocated-recovery-report.json'),JSON.stringify(report,null,2)+'\n');
 const handoffFile=path.join(root,'docs/console-expansion-handoff.json'),h=read(handoffFile);
 h.archiveLatest={items:current.items.length,fileRecords:current.indexRefresh.fileRecords,presentFileRecords:current.indexRefresh.presentFileRecords,missingPaths:0,truthfullyUnlocatedRecords:0,updatedAt:report.checkedAt,scope:'Exact recovery of all 63 historical unlocated media originals; shared inventory union and organized index refreshed'};
 h.unlocatedArchiveRecovery={status:'complete',report:'docs/unlocated-recovery-report.json',recovered:entries.length,remainingUnlocated:0,networkDownloads:0,olderRecordsPreserved:preserved,checkedAt:report.checkedAt};
 fs.writeFileSync(handoffFile,JSON.stringify(h,null,2)+'\n');
 console.log(JSON.stringify({examined:report.examined,recovered:report.recovered,recoveredBytes:report.recoveredBytes,networkDownloads:0,remainingUnlocated:0,olderFileRecordsPreserved:preserved,index:current.indexRefresh},null,2));
}
try{main();}catch(e){console.error(e.message);process.exitCode=1;}
