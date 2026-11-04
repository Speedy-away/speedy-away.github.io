'use strict';
const fs=require('node:fs'),path=require('node:path');
const {destinationForFile}=require('./download-archive-layout.cjs');
const {storePreserving,mergeAudit,writeJSON,sha}=require('./import-host-game-actions.cjs');
const root=path.resolve(__dirname,'..'),backup=path.resolve('F:/whatsite-backup-downloads-etc');
const build=JSON.parse(fs.readFileSync(path.join(root,'docs/afterglow-build.json')));
const items=build.jobs.map(job=>{
 const bytes=fs.readFileSync(path.join(root,job.importPath));
 if(bytes.length!==job.bytes||sha(bytes)!==job.sha256)throw Error('Archive input differs');
 const item={id:job.id,project:job.project,title:job.title,platform:job.platform,category:job.category,archiveRole:job.archiveRole,release:job.version,url:job.url,kind:'local-console-file',status:'downloaded',pages:['hosts/ps4/firmware/index.html'],files:[]};
 const target=destinationForFile(backup,item,{name:job.filename,releaseTag:job.version,archiveRole:job.archiveRole});
 const actual=storePreserving(target,bytes,backup);
 if(sha(fs.readFileSync(actual))!==job.sha256)throw Error('Archive reread differs');
 item.files.push({name:job.filename,bytes:bytes.length,sha256:job.sha256,backupPath:actual,local:job.local,sourceUrl:job.url,releaseTag:job.version,archiveRole:job.archiveRole});return item;
});
const inventory={schemaVersion:1,updated:new Date().toISOString(),backupRoot:backup,sourceCommit:build.commit,payloadsExecuted:false,items};
writeJSON(path.join(root,'docs/afterglow-download-inventory.json'),inventory);
mergeAudit(inventory);
console.log(JSON.stringify({items:items.length,bytes:items.reduce((n,x)=>n+x.files[0].bytes,0),verified:true}));
