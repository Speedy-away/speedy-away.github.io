// Read-only catalogue/provenance/byte verification. Never executes downloads.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),backup=path.resolve('F:/whatsite-backup-downloads-etc');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const errors=[],unavailable=[],hashed=new Map();
const check=(condition,message)=>{if(!condition)errors.push(message);return condition;};
const inside=(base,file)=>{const relative=path.relative(base,file);return !relative.startsWith('..')&&!path.isAbsolute(relative);};
async function verifyFile(file,bytes,sha,base){
 const absolute=path.resolve(file);
 if(!check(inside(base,absolute),'File outside expected root: '+absolute))return;
 if(!check(fs.existsSync(absolute),'Missing recorded file: '+absolute))return;
 if(!check(inside(fs.realpathSync(base),fs.realpathSync(absolute)),'File resolves outside expected root: '+absolute))return;
 if(!check(fs.statSync(absolute).size===bytes,'Size differs: '+absolute))return;
 if(!hashed.has(absolute)){
  const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(absolute))hash.update(chunk);
  hashed.set(absolute,hash.digest('hex'));
 }
 check(hashed.get(absolute)===sha,'SHA-256 differs: '+absolute);
}
async function main(){
 const inventory=read('docs/download-audit.json').items,counts={};
 for(const collection of ['xbox360','pc']){
  const data=read('docs/discord-'+collection+'-resources.json'),games=new Map(data.games.map(g=>[g.id,g]));
  let files=0;
  for(const item of data.resources){
   check(/^https:\/\/discord\.com\/channels\/\d+\/\d+$/.test(item.source),'Missing source permalink: '+item.id);
   check(Array.isArray(item.tags)&&item.tags.length>0,'Missing tags: '+item.id);
   check(Array.isArray(item.guideBlocks)&&item.guideBlocks.length>0,'Missing guide: '+item.id);
   for(const id of new Set([item.gameId,...item.gameIds,...(item.indexIds||[]),...(item.referenceGameIds||[])])){
    const game=games.get(id);if(!check(Boolean(game),'Unknown game route: '+item.id+' / '+id))continue;
    const page=path.join(root,game.page.slice(1));if(!check(fs.existsSync(page),'Missing game page: '+game.page))continue;
    check(fs.readFileSync(page,'utf8').includes('id="'+item.id+'"'),'Missing resource cross-list: '+item.id+' / '+id);
   }
   const owners=inventory.filter(owner=>owner.id===collection+'-'+item.id);
   for(const owner of owners)for(const file of owner.files||[]){
    files++;check(/^[a-f0-9]{64}$/i.test(file.sha256),'Missing hash: '+item.id);
    check(Boolean(file.sourceUrl)&&Boolean(file.bytes),'Missing source or bytes: '+item.id);
    check(Boolean(file.backupPath),'Missing F: backup metadata: '+item.id);
    if(file.local)await verifyFile(path.join(root,file.local.replace(/^\//,'')),file.bytes,file.sha256,root);
    if(file.backupPath)await verifyFile(file.backupPath,file.bytes,file.sha256,backup);
   }
  }
  for(const job of read('docs/'+collection+'-download-imports.json').jobs){
   const owner=inventory.find(x=>x.id===collection+'-'+job.id);
   if(!owner?.files?.length)unavailable.push({collection,id:job.id,status:owner?.status||'not-attempted',source:job.url?.split('?')[0]});
  }
  counts[collection]={resources:data.resources.length,gamesAndCollections:data.games.length,archivedFileRecords:files};
 }
 const vault=read('docs/console-vault-resources.json');check(vault.source.fullPostCaptureComplete,'Vault post captures incomplete');check(vault.resources.length===6,'Vault resource count differs');
 for(const item of vault.resources)check(Boolean(item.source)&&Boolean(item.guide)&&Boolean(item.tags?.length),'Vault provenance/guide missing: '+item.id);
 const report={checkedAt:new Date().toISOString(),mode:'full-streamed-sha256',counts,vaultReferences:vault.resources.length,hashedPaths:hashed.size,unavailable,errors,noDownloadedCodeExecuted:true};
 fs.writeFileSync(path.join(root,'docs/qa/discord-platform-final-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 if(errors.length)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
