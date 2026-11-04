// Merge a completed scoped PS3 import into the latest shared metadata only.
// Existing IDs, files and versions are retained. Run once other import writers idle.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),backup=path.resolve('F:/whatsite-backup-downloads-etc');
const auditPath=path.join(root,'docs/download-audit.json'),backupPath=path.join(backup,'download-inventory.json');
const scoped=JSON.parse(fs.readFileSync(path.join(root,'docs/ps3-expansion-download-inventory.json'),'utf8'));
if(path.resolve(scoped.backupRoot)!==backup)throw Error('Unexpected archive root');
function merge(...reports){
 const items=new Map(),unique=values=>[...new Set(values.filter(Boolean))];
 for(const report of reports)for(const row of report.items||[]){
  const old=items.get(row.id)||{},files=new Map();
  for(const file of [...(old.files||[]),...(row.files||[])]){
   if(file.backupPath){const rel=path.relative(backup,path.resolve(file.backupPath));if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('File record escapes archive');}
   const key=[file.backupPath||'',file.sha256||'',file.name||''].join('|');files.set(key,{...files.get(key),...file});
  }
  const item={...old,...row,files:[...files.values()],pages:unique([...(old.pages||[]),...(row.pages||[])]),labels:unique([...(old.labels||[]),...(row.labels||[])]),sourceUrls:unique([...(old.sourceUrls||[]),old.url,...(row.sourceUrls||[]),row.url])};
  // Failed attempts remain in history; a successful current PS3 import must
  // not inherit the old size-bound/network error from an earlier audit row.
  if(row.id.startsWith('ps3-expansion-')&&row.status==='downloaded'){delete item.error;delete item.reason;}
  items.set(row.id,item);
 }
 return Object.assign({},...reports,{items:[...items.values()]});
}
const imported={items:scoped.items.map(item=>({...item,id:'ps3-expansion-'+item.id,importInventory:'docs/ps3-expansion-download-inventory.json',labels:['Download','PS3']}))};
const archived=JSON.parse(fs.readFileSync(backupPath,'utf8')),latest=JSON.parse(fs.readFileSync(auditPath,'utf8'));
const next=merge(archived,latest,imported);next.backupRoot=backup;next.updated=new Date().toISOString();
const write=process.argv.includes('--write');
console.log(JSON.stringify({mode:write?'write':'check',importedItems:imported.items.length,importedFiles:imported.items.reduce((s,i)=>s+i.files.length,0),previousItems:latest.items.length,mergedItems:next.items.length},null,2));
if(write){const json=JSON.stringify(next,null,2)+'\n';for(const file of [auditPath,backupPath]){const temp=file+'.ps3-merge-'+crypto.randomBytes(6).toString('hex')+'.tmp';fs.writeFileSync(temp,json,{flag:'wx'});fs.renameSync(temp,file);}}
module.exports={merge};
