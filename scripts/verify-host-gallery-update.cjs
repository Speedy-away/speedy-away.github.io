'use strict';
// Data-only integrity checks; never loads native pages or executes a payload.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function verify(root){
 const read=p=>JSON.parse(fs.readFileSync(path.join(root,p))),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 const inspect=require(path.join(root,'scripts/verify-host-menu-sender-integrity.cjs')).inspectZip;
 const sender=read('tmp/gallery-sender-final.json'),bytes=fs.readFileSync(sender.file);
 if(sha(bytes)!==sender.sha256||!bytes.equals(fs.readFileSync(sender.backupPath)))throw Error('Sender archive differs');
 const zip=inspect(bytes),prefix='whatwhatboy-console-payload-sender/',manifest=JSON.parse(zip.entries.get(prefix+'bundle-manifest.json'));
 for(const f of manifest.files){const b=zip.entries.get(prefix+f.name);if(!b||b.length!==f.bytes||sha(b)!==f.sha256)throw Error(f.name);}
 const current=require(path.join(root,'scripts/package-console-payload-sender.cjs')).collectFiles().files;
 const records=[...current].sort(([a],[b])=>a.localeCompare(b)).map(([name,b])=>({name,bytes:b.length,sha256:sha(b)}));
 if(sha(JSON.stringify(records))!==sender.snapshot)throw Error('Sender source snapshot differs');
 const tools=read('docs/host-local-tools-build.json'),audit=read('docs/download-audit.json').items.flatMap(i=>i.files||[]);
 for(const job of tools.jobs){const b=fs.readFileSync(path.join(root,job.importPath)),entry=audit.find(r=>r.sha256===sha(b)&&r.backupPath);if(!entry||!b.equals(fs.readFileSync(entry.backupPath)))throw Error('Tool archive differs: '+job.id);}
 for(const a of tools.artifacts){const z=inspect(fs.readFileSync(path.join(root,a.local)),{prefix:'whatwhatboy-local-tools/'});for(const m of a.manifest){const b=z.entries.get('whatwhatboy-local-tools/'+m.name);if(!b||b.length!==m.bytes||sha(b)!==m.sha256)throw Error('Tool member differs: '+m.name);}}
 return {verifiedAt:new Date().toISOString(),sender:{...sender,zipEntries:zip.entries.size,manifestFiles:manifest.files.length,sourceSnapshotMatches:true,archiveVerified:true},tools:tools.artifacts.map(({scope,version,local,bytes,sha256,files})=>({scope,version,local,bytes,sha256,files})),toolArchiveJobs:tools.jobs.length,ZIPCRCAndSHA256Verified:true,consoleExecutionTested:false,browserQA:'Unavailable: local browser use is disabled in Work settings. No alternate browser automation was used.'};
}
if(require.main===module){const root=path.resolve(process.argv[2]),result=verify(root);fs.writeFileSync(path.join(root,'tmp/gallery-integrity.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({verified:true,sender:result.sender.version,entries:result.sender.zipEntries,toolArchiveJobs:result.toolArchiveJobs}));}
module.exports={verify};
