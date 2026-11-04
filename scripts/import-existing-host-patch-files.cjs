'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=process.argv[2],target=process.argv[3];if(!source||!target)throw Error('Supply source and target repository paths.');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const data=JSON.parse(fs.readFileSync(path.join(source,'docs/ps4-ps5-game-patches.json'))),inventory=JSON.parse(fs.readFileSync('F:/whatsite-backup-downloads-etc/download-inventory.json'));
const archiveFiles=(inventory.items||[]).flatMap(i=>(i.files||[]).map(f=>({...f,source:i.url,version:i.version||f.releaseTag||i.release})));
const records=[];for(const r of data.resources.filter(r=>/\.xml$|game_patch\.prx$/.test(r.local))){
 const original=path.join(source,r.local),destination=path.join(target,r.local),bytes=fs.readFileSync(original);if(bytes.length!==r.bytes||hash(bytes)!==r.sha256)throw Error('Original mismatch '+r.id);
 const archived=archiveFiles.find(f=>f.sha256===r.sha256&&(f.bytes===r.bytes||f.size===r.bytes));if(!archived)throw Error('Existing F archive record missing '+r.id);
 let archivePath=archived.path||archived.backupPath||archived.localPath||archived.archivedPath;if(archivePath&&!path.isAbsolute(archivePath))archivePath=path.join('F:/whatsite-backup-downloads-etc',archivePath);if(!archivePath||!fs.existsSync(archivePath)||hash(fs.readFileSync(archivePath))!==r.sha256)throw Error('Existing F archive bytes missing '+r.id+' '+archivePath);
 if(fs.existsSync(destination)){if(hash(fs.readFileSync(destination))!==r.sha256)throw Error('Refuse overwrite '+destination);}else{fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes,{flag:'wx'});}
 records.push({id:r.id,local:r.local,bytes:r.bytes,sha256:r.sha256,archivePath,source:r.source,version:r.version});
}
const report={updatedAt:new Date().toISOString(),count:records.length,totalBytes:records.reduce((s,r)=>s+r.bytes,0),allFArchiveBytesReverified:true,existingBytesPreserved:true,newDownloads:0,records};fs.writeFileSync(path.join(target,'docs/host-game-patch-file-import.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,records:undefined}));
