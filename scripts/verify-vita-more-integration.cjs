const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.resolve(root,p),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const identity=(i,f)=>JSON.stringify([i.id,f.name||f.filename||'',f.backupPath||'',f.version||f.releaseTag||'',f.sha256||'',f.sourceUrl||f.resolvedUrl||'']);
const inventories=['docs/download-audit.json','F:/whatsite-backup-downloads-etc/download-inventory.json'];
const sidecar=read('docs/vita-more-private-inventory.json');
const report={scope:'vita-more',checkedAt:new Date().toISOString(),hub:{},inventories:[],priorRecords:[],preservedPages:[],index:{}};
const hub=fs.readFileSync(path.join(root,'console/psvita/index.html'),'utf8');
const builder=fs.readFileSync(path.join(root,'scripts/build-vita-guides.cjs'),'utf8');
assert.ok(hub.includes('href="/console/psvita/library.html">Homebrew Library</a>'));
assert.ok(hub.includes('href="/console/psvita/library.html">Browse Vita library '));
assert.ok(builder.includes("['/console/psvita/library.html', 'Homebrew Library']"));
assert.ok(builder.includes("link('/console/psvita/library.html', 'Browse Vita library')"));
report.hub={navigationLink:true,resourceCard:true,builderPreservesBoth:true};
for(const filename of inventories){
 const inventory=read(filename),rows=[];
 for(const item of sidecar.items){
  const merged=inventory.items.find(x=>x.id===item.id);assert.ok(merged,'Missing item '+item.id);
  for(const f of item.files){
   const found=merged.files.find(x=>identity(item,f)===identity(merged,x));assert.ok(found,'Missing file/version/source '+f.name);
   assert.ok(found.sourceUrl||found.resolvedUrl);assert.ok(found.version||found.releaseTag);assert.equal(fs.statSync(found.backupPath).size,found.bytes);assert.equal(hash(found.backupPath),found.sha256);
   rows.push({id:item.id,name:f.name,bytes:f.bytes,sha256:f.sha256});
  }
 }
 report.inventories.push({path:filename,totalItems:inventory.items.length,totalFiles:inventory.items.reduce((n,i)=>n+(i.files||[]).length,0),vitaItems:sidecar.items.length,vitaFiles:rows.length,verified:true});
 const baselinePath=path.join(root,'tmp/vita-more/integration-baseline.json');
 if(fs.existsSync(baselinePath)){
  const baseline=read(baselinePath).find(x=>x.path===filename),ids=new Set(inventory.items.map(i=>i.id)),records=new Set(inventory.items.flatMap(i=>(i.files||[]).map(f=>identity(i,f))));
  assert.ok(baseline.items.every(x=>ids.has(x)),'Baseline item lost');assert.ok(baseline.files.every(x=>records.has(x)),'Baseline file/version/source lost');
  report.priorRecords.push({path:filename,itemsPreserved:baseline.items.length,fileRecordsPreserved:baseline.files.length});
 }
}
const preservedPath=path.join(root,'tmp/vita-more/preserved-pages.json');
if(fs.existsSync(preservedPath))for(const item of read(preservedPath)){assert.equal(hash(path.join(root,item.path)),item.hash,'Other Vita page changed');report.preservedPages.push(item.path);}
const index=fs.readFileSync('F:/whatsite-backup-downloads-etc/index.html','utf8'),checksums=fs.readFileSync('F:/whatsite-backup-downloads-etc/CHECKSUMS.sha256','utf8');
for(const item of sidecar.items){assert.ok(index.includes(item.title.replaceAll('&','&amp;')),'Archive index omits '+item.title);for(const f of item.files)assert.ok(checksums.includes(f.sha256),'Checksum index omits '+f.name);}
const refreshed=read('F:/whatsite-backup-downloads-etc/download-inventory.json').indexRefresh;
assert.ok(refreshed);assert.equal(refreshed.missingPaths,0);report.index={...refreshed,vitaItemsPresent:true,vitaChecksumsPresent:true};
report.passed=true;fs.writeFileSync(path.join(root,'docs/qa/vita-more-integration.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
