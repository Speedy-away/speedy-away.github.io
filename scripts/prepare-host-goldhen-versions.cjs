'use strict';
// Evidence from preserved host files only. Never downloads or evaluates a payload.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function exactFirmware(item){if(Array.isArray(item.firmwares))return item.firmwares;const match=/^PS4 firmware (\d{1,2}\.\d{2}) only\b/.exec(item.compatibility||'');return match?[match[1]]:[];}
function sameCompatibility(item,action){return item.platforms?.length===1&&item.platforms[0]==='ps4'&&item.version===action.version&&JSON.stringify(exactFirmware(item))===JSON.stringify(action.firmwares);}
function nativeURL(action,root){
 const filename=path.basename(action.downloadURL),provided=action.nativeDownloadURL||action.source;
 if(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[a-f0-9]{40}\//i.test(provided||'')&&decodeURIComponent(new URL(provided).pathname.split('/').pop())===filename)return provided;
 // The original compressed source is not a ready BIN. Pin the already committed
 // decoded file, checking Git object bytes, rather than pointing a downloader at
 // compressed bytes or a JavaScript Pages redirect.
 const relative=action.downloadURL.replace(/^\//,'');if(!/^hosts\/runtime\/karo-[a-f0-9]{12}-[a-f0-9]{12}\/web\/_decoded\/[a-z0-9_-]+\/goldhen_[a-z0-9._-]+\.bin$/i.test(relative))throw Error('A ready source-pinned BIN URL is required: '+action.id);
 const options={cwd:root,stdio:['ignore','pipe','pipe'],maxBuffer:4*1024*1024},revision=cp.execFileSync('git',['rev-parse','HEAD'],options).toString().trim();if(!/^[a-f0-9]{40}$/.test(revision))throw Error('Invalid preserved revision.');
 const bytes=cp.execFileSync('git',['show',revision+':'+relative],options);if(bytes.length!==action.bytes||hash(bytes)!==action.sha256)throw Error('Committed ready-file identity mismatch: '+action.id);
 return 'https://raw.githubusercontent.com/Speedy-away/WWB-HOST/'+revision+'/'+relative;
}
function mergeCatalogActions(previous,actions,{root=path.resolve(__dirname,'..')}={}){
 const items=previous.slice(),mappings=[],updated=[];let added=0,reused=0;
 for(const original of actions){
  if(original.platform!=='ps4'||original.category!=='goldhen'||original.firmwares?.length!==1||!/^\d{1,2}\.\d{2}$/.test(original.firmwares[0])||!/^[a-f0-9]{64}$/.test(original.sha256)||!Number.isSafeInteger(original.bytes)||original.bytes<1)throw Error('Invalid retained GoldHEN metadata.');
  const filename=path.basename(original.downloadURL),matches=items.filter(item=>item.sha256===original.sha256&&item.bytes===original.bytes&&item.filename===filename&&sameCompatibility(item,original));
  let item=matches.find(item=>item.id===original.consoleFileId)||matches[0];
  const action={...original};delete action.downloadOnDevice;
  if(item){reused++;}else{
   if(items.some(item=>item.id===original.id))throw Error('A different native catalogue file already uses '+original.id);
   item={id:original.id,name:original.label,filename,url:nativeURL(original,root),bytes:original.bytes,sha256:original.sha256,version:original.version,category:'payloads',compatibility:original.requirements.join(' '),firmwares:original.firmwares.slice(),image:original.image,page:'/hosts/ps4/?view=goldhen',platforms:['ps4'],description:'Ready retained GoldHEN BIN. Saving does not run the exploit or install GoldHEN.',source:original.source,preparation:'Choose and prepare a folder in the installed PS4 downloader. Use the exact matching browser exploit to load GoldHEN; this save action does not execute the BIN.'};items.push(item);added++;
  }
  action.consoleFileId=item.id;action.nativeDownloadURL=item.url;updated.push(action);mappings.push({actionId:action.id,consoleFileId:item.id,firmwares:action.firmwares.slice(),filename,sha256:action.sha256,url:item.url});
 }
 return {items,actions:updated,mappings,added,reused};
}
function preserve(root,label,bytes){const file=path.join(root,'docs/.console-expansion-private-inventory/goldhen-catalog-integration',label+'-'+hash(bytes)+'.snapshot.txt');fs.mkdirSync(path.dirname(file),{recursive:true});if(fs.existsSync(file)){if(!fs.readFileSync(file).equals(bytes))throw Error('Different preservation bytes.');}else fs.writeFileSync(file,bytes,{flag:'wx'});}
function integrateCatalog(root=path.resolve(__dirname,'..'),input){
 const reportFile=path.join(root,'docs/host-goldhen-retained-versions.json'),catalogFile=path.join(root,'docs/console-download-catalog.json'),beforeReport=fs.existsSync(reportFile)?fs.readFileSync(reportFile):null,beforeCatalog=fs.readFileSync(catalogFile),report=input||JSON.parse(beforeReport),catalog=JSON.parse(beforeCatalog),merged=mergeCatalogActions(catalog.items,report.actions,{root});
 require('./console-download-catalog.cjs').assertCatalogueBounds(merged.items);
 report.actions=merged.actions;report.catalogMapping={updatedAt:new Date().toISOString(),added:merged.added,reused:merged.reused,mappings:merged.mappings};catalog.items=merged.items;catalog.sources=[...new Set([...(catalog.sources||[]),'docs/host-goldhen-retained-versions.json'])];catalog.updatedAt=new Date().toISOString();
 if(!fs.readFileSync(catalogFile).equals(beforeCatalog)||beforeReport&&!fs.readFileSync(reportFile).equals(beforeReport))throw Error('Shared catalogue changed; retry without overwriting it.');
 preserve(root,'catalog-before',beforeCatalog);if(beforeReport)preserve(root,'retained-before',beforeReport);
 fs.writeFileSync(catalogFile,JSON.stringify(catalog,null,2)+'\n');fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
 return {actions:report.actions.length,added:merged.added,reused:merged.reused,ps4Items:catalog.items.filter(i=>i.platforms.includes('ps4')).length,ps5Items:catalog.items.filter(i=>i.platforms.includes('ps5')).length,nativeCompanionsChanged:false};
}
function build(root=path.resolve(__dirname,'..')){
 const b=JSON.parse(fs.readFileSync(path.join(root,'docs/host-reviews/karo/build.json'))),inv=JSON.parse(fs.readFileSync('F:/whatsite-backup-downloads-etc/download-inventory.json'));
 const archive=inv.items.flatMap(i=>(i.files||[]).map(f=>({...f,source:i.url,release:i.release}))),actions=[],evidence=[],skipped=[],keys=new Set();
 for(const d of b.downloads.filter(d=>d.format==='BIN'&&!d.invalid&&/goldhen/i.test(d.name))){
  const m=d.name.match(/^goldhen_([0-9][a-z0-9.]*)_([0-9]{3,4})\.bin$/i);if(!m){skipped.push({file:d.path,reason:'No separate unambiguous numeric version and firmware label; retained in original host.'});continue;}
  const firmware=(Number(m[2].slice(0,-2))+'.'+m[2].slice(-2)),entry=b.entries.find(e=>e.path===d.folder+'/index.html'&&e.platform==='ps4'&&(e.firmwares||[]).includes(firmware));
  if(!entry){skipped.push({file:d.path,reason:'Filename firmware is not separately confirmed by this exact source entry.'});continue;}
  const key=firmware+'|'+d.sha256;if(keys.has(key))continue;
  const local=path.join(root,d.url),archived=archive.find(f=>f.sha256===d.sha256&&(f.bytes===d.bytes||f.size===d.bytes));
  const archivePath=archived?.path||archived?.backupPath;
  if(!fs.existsSync(local)||!archivePath||!fs.existsSync(archivePath)){skipped.push({file:d.path,reason:'A ready file or matching local archive bytes are unavailable.'});continue;}
  if(hash(fs.readFileSync(local))!==d.sha256||hash(fs.readFileSync(archivePath))!==d.sha256)throw Error('Preserved GoldHEN mismatch '+d.path);
  keys.add(key);const id='ps4-goldhen-retained-'+firmware.replace('.','-')+'-'+d.sha256.slice(0,12);
  actions.push({id,platform:'ps4',category:'goldhen',label:'GoldHEN '+m[1]+' · '+firmware,version:m[1],firmwares:[firmware],format:'BIN',downloadURL:d.url,bytes:d.bytes,sha256:d.sha256,image:'/assets/images/console-software/goldhen.png',source:d.sourceURL,instructionsURL:'/hosts/karo/?entry='+entry.id+'#loader',requirements:['Preserved source-labelled GoldHEN '+m[1]+' BIN for PS4 '+firmware+'.','Use the original firmware-matching host or its documented loader. Downloading this file does not launch a jailbreak; no new generic sender ABI is asserted.','This is a retained older version. Source label and byte identity are recorded; no console execution was performed.']});
  evidence.push({id,version:m[1],firmware,entry:entry.path,source:d.sourceURL,sourceCommit:b.commit,local:d.url,bytes:d.bytes,sha256:d.sha256,archivePath,exactFileAndArchiveVerified:true});
 }
 const report={updatedAt:new Date().toISOString(),source:'https://github.com/KAR0218/KAR0218.github.io',commit:b.commit,actions,evidence,skipped,officialReferences:['https://github.com/GoldHEN/GoldHEN/releases/tag/2.3','https://github.com/GoldHEN/GoldHEN/releases'],compatibilityMethod:'Filename version/firmware labels intersected with exact original entry firmware metadata; every selected ready BIN rehashed in both current runtime and F archive. No compatibility inferred from a family label.',newFilesDownloaded:0,nativeExecution:false};
 return {...integrateCatalog(root,report),firmwares:[...new Set(actions.map(a=>a.firmwares[0]))],skipped:skipped.length};
}
if(require.main===module)console.log(JSON.stringify(process.argv.includes('--catalog-only')?integrateCatalog():build()));module.exports={build,exactFirmware,sameCompatibility,nativeURL,mergeCatalogActions,integrateCatalog};
