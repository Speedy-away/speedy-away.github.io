// Read-only archive proof. Hashes bytes; never installs or executes a build.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {destinationForFile}=require('./download-archive-layout.cjs');
const root=path.resolve(__dirname,'..'),backup=path.resolve('F:/whatsite-backup-downloads-etc');
const hashBuffer=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function hashFile(file){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex')}
const inside=(base,file)=>{const relative=path.relative(base,file);return relative!==''&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep)};
const norm=file=>path.resolve(file).toLowerCase();
const version=file=>file.version||file.releaseTag||null;
const source=file=>file.sourceUrl||file.resolvedUrl||null;
const identity=(id,f)=>JSON.stringify([id,f.name,f.backupPath?norm(f.backupPath):null,source(f),version(f),f.bytes,f.sha256]);
async function main(){
 const startedAt=new Date().toISOString(),errors=[],files=[];
 const check=(condition,message)=>{if(!condition)errors.push(message);return !!condition};
 const catalogue=JSON.parse(fs.readFileSync(path.join(root,'docs/xbox-one-series-catalogue.json'),'utf8'));
 const expected=[...new Map([...catalogue.apps.flatMap(a=>a.files),...catalogue.frameworks].map(f=>[f.local,f])).values()];
 const scoped=JSON.parse(fs.readFileSync(path.join(root,'docs/xbox-one-series-private-inventory.json'),'utf8'));
 const inventoryPaths=[path.join(root,'docs/download-audit.json'),path.join(backup,'download-inventory.json')];
 const inventories=inventoryPaths.map(file=>{const bytes=fs.readFileSync(file);return{file,sha256:hashBuffer(bytes),data:JSON.parse(bytes)}});
 const archiveReal=fs.realpathSync(backup),index=fs.readFileSync(path.join(backup,'index.html'),'utf8'),checksums=fs.readFileSync(path.join(backup,'CHECKSUMS.sha256'),'utf8');
 const checksumLines=new Set(checksums.split(/\r?\n/));
 check(expected.length>=39,'Expected at least the39previously verified Xbox files');
 const archiveRows=scoped.items.flatMap(item=>(item.files||[]).map(file=>({item,file})));
 check(archiveRows.length>=expected.length,'Scoped archive retains every catalogue file and older record');
 for(const entry of expected){
  const itemId='xbox-one-series-'+entry.appId;
  const matches=archiveRows.filter(row=>row.item.id===itemId&&row.file.name===entry.name&&source(row.file)===entry.sourceUrl&&version(row.file)===entry.version&&row.file.bytes===entry.bytes&&row.file.sha256===entry.sha256);
  const result={itemId,name:entry.name,version:entry.version,sourceUrl:entry.sourceUrl,bytes:entry.bytes,sha256:entry.sha256,checks:{scopedMetadata:check(matches.length===1,'Unique exact scoped record: '+entry.local)}};
  if(matches.length!==1){files.push(result);continue}
  const {item,file}=matches[0],absolute=path.resolve(file.backupPath),relative=path.relative(backup,absolute).replaceAll('\\','/');
  result.archiveRelativePath=relative;
  result.checks.lexicalContainment=check(inside(backup,absolute),'F: path containment: '+entry.local);
  result.checks.layout=check(norm(destinationForFile(backup,item,file))===norm(absolute),'Organized layout: '+entry.local);
  if(!result.checks.lexicalContainment){files.push(result);continue}
  try{
   result.checks.realPathContainment=check(inside(archiveReal,fs.realpathSync(absolute)),'Resolved F: path containment: '+entry.local);
   if(!result.checks.realPathContainment){files.push(result);continue}
   const before=fs.statSync(absolute);
   result.checks.regularFile=check(before.isFile(),'Regular F: file: '+entry.local);
   result.actualBytes=before.size;
   result.checks.size=check(before.size===entry.bytes,'F: byte count: '+entry.local);
   result.actualSha256=await hashFile(absolute);
   const after=fs.statSync(absolute);
   result.checks.hash=check(result.actualSha256===entry.sha256,'F: SHA-256: '+entry.local);
   result.checks.fileStable=check(before.size===after.size&&before.mtimeMs===after.mtimeMs,'F: file unchanged during hashing: '+entry.local);
  }catch(error){result.checks.readable=check(false,'F: read failure: '+entry.local+' ('+error.message+')')}
  for(let i=0;i<inventories.length;i++){
   const rows=inventories[i].data.items.filter(item=>item.id===itemId).flatMap(item=>item.files||[]);
   result.checks[i===0?'workspaceInventory':'backupInventory']=check(rows.some(f=>identity(itemId,f)===identity(itemId,file)&&JSON.stringify(f.archiveRole)===JSON.stringify(file.archiveRole)),'Exact '+(i===0?'workspace':'F:')+' inventory tuple: '+entry.local);
  }
  const encoded=relative.split('/').map(encodeURIComponent).join('/');
  result.checks.archiveIndex=check(index.includes('href="'+encoded+'"'),'Archive index download link: '+entry.local);
  result.checks.checksumIndex=check(checksumLines.has(entry.sha256.toLowerCase()+'  '+relative),'Checksum index record: '+entry.local);
  result.checks.siteMirror=check(hashBuffer(fs.readFileSync(path.join(root,entry.local)))===entry.sha256,'Site mirror matches F: source hash: '+entry.local);
  files.push(result);
 }
 const original=JSON.parse(fs.readFileSync(path.join(root,'docs/qa/xbox-one-series-expansion-baseline.json'),'utf8'));
 const originalFilesPreserved=original.files.every(old=>expected.some(f=>f.local===old.local&&f.version===old.version&&f.sourceUrl===old.sourceUrl&&f.bytes===old.bytes&&f.sha256===old.sha256));
 check(originalFilesPreserved,'All16original catalogue file tuples preserved');
 let previousCatalogue=null;
 const previousCatalogueFile=path.join(root,'docs/qa/xbox-one-series-third-baseline.json');
 if(fs.existsSync(previousCatalogueFile)){
  const before=JSON.parse(fs.readFileSync(previousCatalogueFile,'utf8'));
  const preserved=before.files.filter(old=>expected.some(f=>f.local===old.local&&f.version===old.version&&f.sourceUrl===old.sourceUrl&&f.bytes===old.bytes&&f.sha256===old.sha256)).length;
  previousCatalogue={files:before.files.length,preserved,missing:before.files.length-preserved};
  check(preserved===before.files.length,'Allprevious39catalogue records preserved exactly');
 }
 let preservation=null;
 const baseline=path.join(root,'tmp/xbox-one-series/reconciliation-preservation-baseline.json');
 if(fs.existsSync(baseline)){
  const previous=JSON.parse(fs.readFileSync(baseline,'utf8')),currentKeys=new Set();
  for(const inventory of inventories)for(const item of inventory.data.items)for(const file of item.files||[]){
   currentKeys.add(identity(item.id,file));
   // Index refresh can follow a verified explicit move without losing the old
   // record. Count its saved original only when content/version and move history agree.
   for(const original of file.relocationOriginalFileRecords||[]){
    const recordedMove=original.backupPath&&(file.previousBackupPaths||[]).some(p=>norm(p)===norm(original.backupPath));
    if(recordedMove&&original.name===file.name&&original.bytes===file.bytes&&original.sha256===file.sha256&&version(original)===version(file))currentKeys.add(identity(item.id,original));
   }
  }
  const beforeKeys=[...new Set(previous.snapshots.flatMap(s=>s.items.flatMap(i=>i.files.map(f=>identity(i.id,f)))))];
  const missing=beforeKeys.filter(key=>!currentKeys.has(key));
  preservation={previousUniqueFileRecords:beforeKeys.length,preserved:beforeKeys.length-missing.length,missing:missing.length};
  check(missing.length===0,'Preserve every pre-reconciliation file/version record');
 }
 const metadataStable=inventories.every(i=>hashBuffer(fs.readFileSync(i.file))===i.sha256);
 check(metadataStable,'Both inventories unchanged during final verification');
 const report={checkedAt:new Date().toISOString(),startedAt,passed:errors.length===0,scope:'xbox-one-series',expectedFiles:expected.length,verifiedFiles:files.filter(f=>Object.values(f.checks).every(Boolean)&&f.actualSha256===f.sha256).length,bytes:expected.reduce((n,f)=>n+f.bytes,0),items:scoped.items.length,originalFilesPreserved,originalFiles:original.files.length,previousCatalogue,preservation,metadataStable,globalInventoryCounts:inventories.map(i=>({kind:i.file===inventoryPaths[0]?'workspace':'F archive',items:i.data.items.length,fileRecords:i.data.items.reduce((n,item)=>n+(item.files||[]).length,0),sha256:i.sha256})),files,errors,downloadedBuildsExecuted:false,method:'Streamed SHA-256 plus byte count, regular-file, realpath containment, layout, exact metadata, archive index and checksum index checks'};
 fs.writeFileSync(path.join(root,'docs/qa/xbox-one-series-archive-reconciliation.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,files:undefined},null,2));
 if(errors.length)process.exitCode=1;
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1});
