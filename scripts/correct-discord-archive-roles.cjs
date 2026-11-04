// Apply explicit static archive classifications without deleting or replacing files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {destinationForFile}=require('./download-archive-layout.cjs');
const root=path.resolve(__dirname,'..'),backup=path.resolve('F:/whatsite-backup-downloads-etc');
const write=process.argv.includes('--write');
if(process.argv.slice(2).some(arg=>!['--write','--check'].includes(arg)))throw Error('Use --check or --write');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const inside=file=>{const rel=path.relative(backup,path.resolve(file));if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Path escaped archive');return path.resolve(file);};
const auditFile=path.join(root,'docs/download-audit.json'),backupFile=inside(path.join(backup,'download-inventory.json'));
const audit=read(auditFile),backupInventory=fs.existsSync(backupFile)?read(backupFile):{items:[]};
const notes={...read(path.join(root,'docs/discord-ps3-cod4-waw-guide-research.json')),...read(path.join(root,'docs/discord-ps3-mw2-guide-research.json')),...(fs.existsSync(path.join(root,'docs/discord-xbox360-guide-research.json'))?read(path.join(root,'docs/discord-xbox360-guide-research.json')):{}),...(fs.existsSync(path.join(root,'docs/discord-pc-guide-research.json'))?read(path.join(root,'docs/discord-pc-guide-research.json')):{}),...(fs.existsSync(path.join(root,'docs/discord-xbox360-guide-notes.json'))?read(path.join(root,'docs/discord-xbox360-guide-notes.json')):{})};
const ownerId=id=>(id.startsWith('discord-xbox360-')?'xbox360-':id.startsWith('discord-pc-')?'pc-':'ps3-')+id;
const jobFiles=['ps3','xbox360','pc'].map(collection=>path.join(root,'docs/'+collection+'-download-imports.json')).filter(file=>fs.existsSync(file));
const jobs={jobs:jobFiles.flatMap(file=>read(file).jobs)};
const moves=[];
for(const [id,note] of Object.entries(notes)){
 const evidence=note.evidence;
 if(!evidence?.proposedArchiveRole || !evidence.proposedArchivePlatform)continue;
 const item=audit.items.find(item=>item.id===ownerId(id));if(!item)throw Error('Missing archive record: '+id);
 const platform=evidence.proposedArchivePlatform,role=evidence.proposedArchiveRole;
 const category=evidence.proposedArchiveCategory||item.category;
 const corrected={...item,platform,category,archiveRole:role};
 const file=item.files.find(file=>file.sha256===evidence.sha256);
 if(!file?.backupPath){
  if(item.files.length||!(moves.some(move=>move.sha256===evidence.sha256)||audit.items.some(owner=>(owner.files||[]).some(record=>record.sha256===evidence.sha256&&record.backupPath&&fs.existsSync(record.backupPath)))))throw Error('Missing preserved file: '+id);
  // A repeated source post may have a failed attempt record and use another
  // exact-archive record. Correct its metadata without inventing a second file.
  for(const report of [audit,backupInventory])for(const entry of report.items)if(entry.id===item.id)Object.assign(entry,{platform,category,archiveRole:role,archiveClassificationNote:note.compatibility});
  const job=jobs.jobs.find(job=>job.id===id);if(job)Object.assign(job,{platform,category,archiveRole:role});
  continue;
 }
 const source=inside(file.backupPath);
 let target=inside(destinationForFile(backup,corrected,{...file,archiveRole:role}));
 // A previous preservation suffix is already organized in the correct folder.
 // Keep that path stable instead of generating another suffix on every check.
 if(path.dirname(source).toLowerCase()===path.dirname(target).toLowerCase())target=source;
 if(source.toLowerCase()!==target.toLowerCase()){
  if(!fs.existsSync(source)||digest(source)!==file.sha256)throw Error('Source hash differs: '+id);
  if(fs.existsSync(target)){
   const ext=path.extname(target),stem=target.slice(0,-ext.length);let count=1;
   while(fs.existsSync(target))target=inside(stem+'-preserved-copy-'+count+++ext);
  }
  moves.push({id,source,target,sha256:file.sha256,bytes:file.bytes,platform,role});
 }
 const job=jobs.jobs.find(job=>job.id===id);if(job)Object.assign(job,{platform,category,archiveRole:role});
 for(const report of [audit,backupInventory])for(const entry of report.items){
  if(entry.id===item.id){entry.platform=platform;entry.category=category;entry.archiveRole=role;entry.archiveClassificationNote=note.compatibility;}
  for(const record of entry.files || [])if(record.backupPath && path.resolve(record.backupPath).toLowerCase()===source.toLowerCase()){
   if(record.sha256!==file.sha256)throw Error('Conflicting hash for shared backup path');
   if(source.toLowerCase()!==target.toLowerCase())record.previousBackupPaths=[...new Set([...(record.previousBackupPaths || []),source])];
   Object.assign(record,{backupPath:target,archiveRole:role});
  }
 }
}
console.log(JSON.stringify({mode:write?'write':'check',moves},null,2));
if(!write)process.exit(0);
const realRoot=fs.realpathSync(backup);
function realContained(file){let parent=file;while(!fs.existsSync(parent))parent=path.dirname(parent);const rel=path.relative(realRoot,fs.realpathSync(parent));if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Resolved path escaped archive');}
for(const move of moves){realContained(move.source);realContained(move.target);}
const history=inside(path.join(backup,'archive-history','classification-'+Date.now()));fs.mkdirSync(history,{recursive:true});
for(const [file,name] of [[auditFile,'workspace-download-audit.json'],[backupFile,'download-inventory.json'],...jobFiles.map(file=>[file,path.basename(file)])])if(fs.existsSync(file))fs.copyFileSync(file,path.join(history,name),fs.constants.COPYFILE_EXCL);
for(const move of moves){
 if(fs.existsSync(move.target))throw Error('Refusing to replace archive destination');
 fs.mkdirSync(path.dirname(move.target),{recursive:true});realContained(move.target);
 fs.renameSync(move.source,move.target);
 if(digest(move.target)!==move.sha256)throw Error('Moved file hash differs');
}
function mergeLatest(file,corrected){
 const latest=fs.existsSync(file)?read(file):{items:[]};
 for(const [id,note] of Object.entries(notes)){
  if(!note.evidence?.proposedArchiveRole || !note.evidence.proposedArchivePlatform)continue;
  const source=corrected.items.find(item=>item.id===ownerId(id)),target=latest.items.find(item=>item.id===ownerId(id));
  if(!source)continue;if(!target){latest.items.push(source);continue;}
  for(const field of ['platform','category','archiveRole','archiveClassificationNote'])target[field]=source[field];
  for(const record of target.files || []){
   const fixed=source.files.find(item=>item.sha256===record.sha256 && item.name===record.name);
   if(fixed)Object.assign(record,{backupPath:fixed.backupPath,archiveRole:fixed.archiveRole,previousBackupPaths:[...new Set([...(record.previousBackupPaths || []),...(fixed.previousBackupPaths || [])])]});
  }
 }
 fs.writeFileSync(file,JSON.stringify(latest,null,2)+'\n');
}
mergeLatest(auditFile,audit);mergeLatest(backupFile,backupInventory);
for(const jobsFile of jobFiles){
 const latestJobs=read(jobsFile);
 for(const job of latestJobs.jobs){const fixed=jobs.jobs.find(item=>item.id===job.id);if(fixed)for(const field of ['platform','archiveRole'])job[field]=fixed[field];}
 fs.writeFileSync(jobsFile,JSON.stringify(latestJobs,null,2)+'\n');
}
console.log('Corrected archive classifications; originals preserved byte-for-byte. Metadata snapshot: '+history);
