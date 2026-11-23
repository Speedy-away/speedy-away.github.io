'use strict';
// Save the ready host and optional source ZIP without executing any console payload.
const fs=require('node:fs'),path=require('node:path');
const {destinationForFile}=require('./download-archive-layout.cjs');
const {storePreserving,mergeAudit,writeJSON,sha}=require('./import-host-game-actions.cjs');
const root=path.resolve(__dirname,'..'),backup=path.resolve('F:/whatsite-backup-downloads-etc');
const build=JSON.parse(fs.readFileSync(path.join(root,'docs/afterglow-1402-build.json')));
const sourceURL='https://github.com/well0nez/afterglow-web/tree/'+build.commit;
const archiveVersion=build.archive.version;

function save(item,file,bytes){
 const target=destinationForFile(backup,item,{name:file.name,releaseTag:file.releaseTag,archiveRole:file.archiveRole});
 const actual=storePreserving(target,bytes,backup);
 if(sha(fs.readFileSync(actual))!==file.sha256)throw Error('Archive reread differs: '+actual);
 file.backupPath=actual;item.files=[file];return item;
}

const readyBytes=fs.readFileSync(path.join(root,build.archive.local));
if(readyBytes.length!==build.archive.bytes||sha(readyBytes)!==build.archive.sha256)throw Error('Ready host archive differs from build record');
const readyFile={name:build.archive.filename,bytes:readyBytes.length,sha256:build.archive.sha256,local:'/'+build.archive.local.replaceAll('\\','/'),sourceUrl:sourceURL,releaseTag:archiveVersion,archiveRole:['Builds']};
const ready=save({id:'afterglow-1402-'+build.archive.sha256.slice(0,12),project:'Afterglow web',title:'PS4 14.02 Afterglow · '+build.archive.filename,platform:'PS4',category:['Hosts'],archiveRole:['Builds'],release:archiveVersion,url:sourceURL,kind:'local-console-file',status:'downloaded',pages:['hosts/ps4/afterglow-1402/index.html'],files:[]},readyFile,readyBytes);

const added=[ready];
const sourcePath=process.argv[2]?path.resolve(process.argv[2]):null;
if(sourcePath){
 const sourceBytes=fs.readFileSync(sourcePath),sourceHash=sha(sourceBytes),sourceName='afterglow-web-'+build.commit+'.zip',sourceArchiveURL='https://github.com/well0nez/afterglow-web/archive/'+build.commit+'.zip';
 if(sourceBytes.length!==537409||sourceHash!=='55de4933452c66c649e314604fe433f7cb7bab80fc0820bafa4c9f34696be0a8')throw Error('Pinned upstream source archive identity mismatch');
 const sourceFile={name:sourceName,bytes:sourceBytes.length,sha256:sourceHash,local:null,sourceUrl:sourceArchiveURL,releaseTag:build.commit,archiveRole:['Source Code']};
 added.push(save({id:'afterglow-source-'+build.commit.slice(0,12)+'-'+sourceHash.slice(0,12),project:'Afterglow web',title:'Afterglow source · '+build.commit.slice(0,12),platform:'PS4',category:['Hosts'],archiveRole:['Source Code'],release:build.commit,url:sourceArchiveURL,kind:'github-source',status:'downloaded',pages:['hosts/ps4/afterglow-1402/index.html'],files:[]},sourceFile,sourceBytes));
}

// These repository packages predate the current inventory merge. Their release
// identities are recovered from embedded build metadata and the historical builder.
const old1402='944d5aeed06fdff7d2fc1ce044d5daa272d85800',oldIntegration='acf25a831725f0d44fcb64725d4ce35acbba8f9d';
const retainedSpecs=[
 ['afterglow-1402-587c00a564c4-02e6251330cb.zip','Builds',build.commit,build.commit+'-wwb-layout-v3-intermediate-20261123'],
 ['afterglow-1402-944d5aeed06f-79caa7434c8c.zip','Builds',old1402,old1402+'-wwb-1402-v1'],
 ['afterglow-1402-944d5aeed06f-8bcfeefff53a.zip','Builds',old1402,old1402+'-wwb-1402-v1'],
 ['afterglow-runtime-acf25a831725-2de0be1de887.zip','Builds',oldIntegration,oldIntegration+'-integration-v1'],
 ['afterglow-runtime-acf25a831725-d4445f4e7f3b.zip','Builds',oldIntegration,oldIntegration+'-integration-v1'],
 ['afterglow-source-acf25a831725-0a0d89695e9c.zip','Source Code',oldIntegration,oldIntegration+'-integration-v1'],
 ['afterglow-source-acf25a831725-12e56a29a5cf.zip','Source Code',oldIntegration,oldIntegration+'-integration-v1'],
];
const retained=retainedSpecs.map(([name,role,sourceCommit,version])=>{
 const local='downloads/hosts/afterglow/'+name,bytes=fs.readFileSync(path.join(root,local)),digest=sha(bytes),suffix=name.match(/-([a-f0-9]{12})\.zip$/)?.[1];
 if(!suffix||!digest.startsWith(suffix))throw Error('Retained package filename hash differs: '+name);
 const url='https://github.com/well0nez/afterglow-web/tree/'+sourceCommit,file={name,bytes:bytes.length,sha256:digest,local:'/'+local,sourceUrl:url,releaseTag:version,archiveRole:[role]};
 return save({id:'afterglow-retained-'+digest.slice(0,12),project:'Afterglow web',title:'Retained Afterglow package · '+name,platform:'PS4',category:['Hosts'],archiveRole:[role],release:version,url,kind:role==='Source Code'?'retained-source-package':'retained-ready-webhost',status:'downloaded',pages:['hosts/ps4/afterglow-1402/index.html'],provenance:'Exact repository artifact; version recovered from embedded build metadata and the contemporaneous packaging script.',files:[]},file,bytes);
});

const inventoryFile=path.join(root,'docs/afterglow-1402-private-inventory.json');
const inventory=fs.existsSync(inventoryFile)?JSON.parse(fs.readFileSync(inventoryFile,'utf8')):{schemaVersion:1,items:[]};
for(const item of [...added,...retained.filter(item=>item.release.startsWith(old1402)||item.release.includes('-wwb-layout-v3-intermediate-'))]){const existing=inventory.items.find(row=>row.id===item.id);if(existing){if(existing.files[0]?.sha256!==item.files[0].sha256)throw Error('Inventory identity conflict: '+item.id);}else inventory.items.push(item);}
inventory.updated=new Date().toISOString();inventory.backupRoot=backup;inventory.sourceCommit=build.commit;inventory.payloadsExecuted=false;
writeJSON(inventoryFile,inventory);mergeAudit({items:[...added,...retained]});

// An archive drive can be remounted without its previous contents. Restore every
// recorded Afterglow version only from an exact, hash-matching repository copy.
const audit=JSON.parse(fs.readFileSync(path.join(root,'docs/download-audit.json'),'utf8'));
const archivedItemsById=new Map();
for(const candidate of [...audit.items,...inventory.items]){
 const files=(candidate.files||[]).filter(file=>file.backupPath);
 const marker=[candidate.id,candidate.project,candidate.title,...files.flatMap(file=>[file.backupPath,file.sourceUrl])].filter(Boolean).join(' ').toLowerCase();
 if(!files.length||!marker.includes('afterglow'))continue;
 const previous=archivedItemsById.get(candidate.id)||{...candidate,files:[]};
 for(const file of files)if(!previous.files.some(old=>old.sha256===file.sha256&&old.backupPath===file.backupPath))previous.files.push(file);
 archivedItemsById.set(candidate.id,{...previous,...candidate,files:previous.files});
}
const archivedItems=[...archivedItemsById.values()];
for(const item of archivedItems)for(const file of item.files){
 const target=path.resolve(file.backupPath),relative=path.relative(backup,target);
 if(!relative||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('Recorded archive path is outside backup: '+target);
 if(fs.existsSync(target)){
  const bytes=fs.readFileSync(target);if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw Error('Recorded archive file differs: '+target);
  continue;
 }
 const candidates=[file.local&&path.join(root,file.local.replace(/^\//,'')),path.join(root,'downloads/hosts/afterglow',file.name),path.join(root,'hosts/runtime/ps4-afterglow-944d5aeed06f/web',file.name),path.join(root,'hosts/runtime/ps4-afterglow-acf25a831725/web',file.name),sourcePath].filter(Boolean);
 let source=null,bytes=null;
 for(const candidate of candidates){if(!fs.existsSync(candidate)||fs.statSync(candidate).size!==file.bytes)continue;const candidateBytes=fs.readFileSync(candidate);if(sha(candidateBytes)===file.sha256){source=candidate;bytes=candidateBytes;break;}}
 if(!source)throw Error('Missing recorded archive version and exact repository source: '+file.name);
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});
}

// Keep a bounded, project-local archive index. The global archive may be mounted
// independently, so this index must never discard or relabel records for other projects.
const scopedRoot=path.join(backup,'files','PS4','Hosts','afterglow web');
const relativeRoot=path.relative(backup,scopedRoot);
if(!relativeRoot||relativeRoot.startsWith('..'+path.sep)||path.isAbsolute(relativeRoot))throw Error('Unexpected scoped archive root');
const scopedFile=path.join(scopedRoot,'download-inventory.json');
const scoped=fs.existsSync(scopedFile)?JSON.parse(fs.readFileSync(scopedFile,'utf8')):{schemaVersion:1,items:[]};
for(const item of archivedItems){
 const existing=scoped.items.find(row=>row.id===item.id);
 if(existing){for(const file of item.files)if(!existing.files.some(old=>old.sha256===file.sha256&&old.backupPath===file.backupPath))existing.files.push(file);}
 else scoped.items.push(item);
}
scoped.updated=new Date().toISOString();scoped.backupRoot=backup;scoped.project='Afterglow web';scoped.payloadsExecuted=false;
writeJSON(scopedFile,scoped);
const scopedFiles=scoped.items.flatMap(item=>item.files.map(file=>({item,file}))).sort((a,b)=>a.file.backupPath.localeCompare(b.file.backupPath));
fs.writeFileSync(path.join(scopedRoot,'CHECKSUMS.sha256'),scopedFiles.map(({file})=>file.sha256+'  '+path.relative(scopedRoot,file.backupPath).replaceAll('\\','/')).join('\n')+'\n');
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const rows=scopedFiles.map(({item,file})=>'<tr><td>'+esc(item.title)+'</td><td><a download href="'+esc(path.relative(scopedRoot,file.backupPath).replaceAll('\\','/').split('/').map(encodeURIComponent).join('/'))+'">'+esc(file.name)+'</a></td><td>'+file.bytes+' bytes<br><code>'+file.sha256+'</code></td><td><a href="'+esc(file.sourceUrl||item.url)+'">Source</a></td></tr>').join('\n');
fs.writeFileSync(path.join(scopedRoot,'index.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Afterglow local archive</title><style>body{font:16px system-ui;margin:32px;background:#101214;color:#eee}a{color:#6fe4bb}table{border-collapse:collapse;width:100%}th,td{padding:12px;border:1px solid #444;text-align:left;overflow-wrap:anywhere}code{font-size:12px}</style><h1>Afterglow local archive</h1><p>All recorded versions remain preserved. No downloaded payload was executed.</p><table><thead><tr><th>Version</th><th>File</th><th>Integrity</th><th>Original source</th></tr></thead><tbody>'+rows+'</tbody></table></html>');

console.log(JSON.stringify({items:added.length,ready:{bytes:readyBytes.length,sha256:build.archive.sha256,backupPath:ready.files[0].backupPath},source:added[1]?.files[0]||null,payloadsExecuted:false},null,2));
