'use strict';
// Download/decompress compiled host files as data. Never execute a console payload.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {destinationForFile} = require('./download-archive-layout.cjs');
const {storePreserving} = require('./import-host-game-actions.cjs');
const root = path.resolve(__dirname, '..');
const backup = path.resolve('F:/whatsite-backup-downloads-etc');
const evidenceFile = path.join(root,'docs/qa/host-legacy-research.json');
const inventoryFile = path.join(root,'docs/host-legacy-menu-download-inventory.json');
const catalogFile = path.join(root,'docs/host-legacy-menu-actions.json');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const sevenZip = 'C:/Program Files/7-Zip/7z.exe';
const definitions = [
  ['nazky-bq134','BeefQueefMod','1.34',null,'Nazky/PSFree','payloads/Bins/GTA/BeefQueefMod-1.34.bin','payloads/payloads.js','load_GTABQ134',true],
  ['nazky-bq138','BeefQueefMod','1.38',null,'Nazky/PSFree','payloads/Bins/GTA/BeefQueefMod-1.38.bin','payloads/payloads.js','load_GTABQ138',true],
  ['nazky-wilde132','WildeModz','1.32',null,'Nazky/PSFree','payloads/Bins/GTA/WildeModz-1.32.bin','payloads/payloads.js','load_GTAWM132',true],
  ['nazky-wilde138','WildeModz','1.38',null,'Nazky/PSFree','payloads/Bins/GTA/WildeModz-1.38.bin','payloads/payloads.js','load_GTAWM138',true],
  ['kameleon-bq138-thief','BeefQueefMod','1.38',null,'kmeps4/psfree900a','pl_BeefQueefMod138.bin.bz2','index.html','load_gtavbeefqueef138',false,'Thief Edition'],
  ['kameleon-bq146','BeefQueefMod','1.46',null,'kmeps4/psfree900a','pl_BeefQueefMod146.bin.bz2','index.html','load_gtavbeefqueef146',false],
  ['kameleon-bq147','BeefQueefMod','1.47',null,'kmeps4/psfree900a','pl_BeefQueefMod147.bin.bz2','index.html','load_gtavbeefqueef147',false],
  ['kameleon-wilde132','WildeModz','1.32',null,'kmeps4/psfree900a','pl_WildeModz_132.bin.bz2','index.html','load_gtavwildemodz132',false,'Source lists menu 1.2 and 1.3 inconsistently; menu version unconfirmed'],
  ['kameleon-wilde133','WildeModz','1.33',null,'kmeps4/psfree900a','pl_WildeModz_133.bin.bz2','index.html','load_gtavwildemodz133',false,'Source lists menu 1.2 and 1.3 inconsistently; menu version unconfirmed'],
  ['kameleon-wilde146','WildeModz','1.46',null,'kmeps4/psfree900a','pl_WildeModz_146.bin.bz2','index.html','load_gtavwildemodz146',false],
  ['kameleon-wilde147','WildeModz','1.47',null,'kmeps4/psfree900a','pl_WildeModz_147.bin.bz2','index.html','load_gtavwildemodz147',false],
  ['kameleon-expulsion138','Expulsion','1.38','4.0','kmeps4/psfree900a','pl_LushModz40_138.bin.bz2','index.html','load_gtavexpulsion138',false],
  ['karo-expulsion135','Expulsion','1.35',null,'KAR0218/KAR0218.github.io','900New/LushModz-1.0-9.00.bin.bz2','900New/index.html','load_expul',false],
  ['karo-menubase127','Menu Base','1.27',null,'KAR0218/KAR0218.github.io','900New/gtavmb127.bin.bz2','900New/index.html','load_GTAVMB',false],
  ['karo-lts127','LTS','1.27',null,'KAR0218/KAR0218.github.io','900New/gtavLTS127.bin.bz2','900New/index.html','load_GTAVLTS',false]
].map(([id,family,gameVersion,menuVersion,repo,file,dispatchFile,fn,http,note])=>({id,family,gameVersion,menuVersion,repo,file,dispatchFile,fn,http,note}));

async function fetchData(url) {
  const r = await fetch(url,{headers:{'User-Agent':'whatsite-compiled-host-menu-import'},signal:AbortSignal.timeout(60000)});
  if(!r.ok) throw Error(r.status+' '+url);
  const bytes=Buffer.from(await r.arrayBuffer());
  if(!bytes.length||bytes.length>25*1024*1024)throw Error('Unexpected host binary size');
  return bytes;
}
function functionBody(source, name) {
  const start=source.indexOf('function '+name+'(');
  if(start<0)throw Error('Dispatch function missing: '+name);
  const next=source.indexOf('\n}',start);
  if(next<0)throw Error('Dispatch function end missing: '+name);
  return source.slice(start,next+2);
}
function mergeAudit(items) {
  const file=path.join(root,'docs/download-audit.json');
  for(let attempt=0;attempt<6;attempt++){
    const before=fs.readFileSync(file), current=JSON.parse(before);
    for(const item of items){
      const prior=current.items.find(x=>x.id===item.id);
      if(!prior)current.items.push(item);
      else for(const f of item.files)if(!prior.files.some(x=>x.name===f.name&&x.sha256===f.sha256))prior.files.push(f);
    }
    current.updated=new Date().toISOString();
    if(sha(fs.readFileSync(file))!==sha(before))continue;
    fs.writeFileSync(file,JSON.stringify(current,null,2)+'\n');return;
  }
  throw Error('Shared inventory changed repeatedly; files are retained, retry --merge-audit.');
}
async function download() {
  const source=JSON.parse(fs.readFileSync(evidenceFile,'utf8'));
  const existing=JSON.parse(fs.readFileSync(path.join(root,'docs/host-game-actions.json'),'utf8')).actions;
  const at=new Date().toISOString(), items=[], actions=[], inaccessible=[];
  for(const d of definitions){
    const repo=source.repositories.find(x=>x.repo===d.repo), dispatch=repo.sources.find(x=>x.file===d.dispatchFile);
    const body=functionBody(dispatch.text,d.fn), basename=path.posix.basename(d.file);
    if(!body.includes(basename))throw Error('Exact file mapping missing: '+d.id);
    const sourceURL=`https://raw.githubusercontent.com/${d.repo}/${repo.commit}/${d.file}`;
    let original;try{original=await fetchData(sourceURL);}catch(error){inaccessible.push({id:d.id,url:sourceURL,error:error.message});continue;}
    const compressed=basename.endsWith('.bz2');
    if(compressed&&!original.subarray(0,3).equals(Buffer.from('BZh')))throw Error('Not BZIP2: '+d.id);
    const data=compressed?execFileSync(sevenZip,['e','-tbzip2','-si','-so'],{input:original,maxBuffer:32*1024*1024,windowsHide:true}):original;
    if(data.length<4096||data.length>20*1024*1024||/^\s*<!|^\s*<html/i.test(data.subarray(0,64).toString()))throw Error('Invalid compiled menu size/content: '+d.id);
    const digest=sha(data);
    if(existing.some(x=>x.platform==='ps4'&&x.game==='GTA V'&&x.gameVersion===d.gameVersion&&x.sha256===digest)){inaccessible.push({id:d.id,status:'already-present-identical',sha256:digest});continue;}
    const dispatchURL=`https://github.com/${d.repo}/blob/${repo.commit}/${d.dispatchFile}`;
    const host=d.repo.startsWith('Nazky/')?'Nazky':d.repo.startsWith('kmeps4/')?'Kameleon':'Karo';
    const hostURL=host==='Nazky'?'https://nazky.github.io/PSFree/':host==='Kameleon'?'https://www.kmeps4.site/':'https://karo218.ir/900New/index.html';
    const release=(d.menuVersion?'menu '+d.menuVersion+' - ':'')+'game '+d.gameVersion+' - PS4 9.00 - '+host+' '+repo.commit.slice(0,12);
    const item={id:'host-legacy-'+d.id,project:d.family,title:d.family+' · GTA V '+d.gameVersion+' · '+host+' legacy build',platform:'PS4',category:['Games','GTA5',d.gameVersion],url:hostURL,sourceUrls:[sourceURL,dispatchURL],kind:'pinned-host-menu-build',status:'downloaded',release,sourceCommit:repo.commit,gameVersion:d.gameVersion,firmware:'9.00',pages:['hosts/ps4/index.html'],files:[]};
    if(compressed){const f={name:basename,bytes:original.length,sha256:sha(original),resolvedUrl:sourceURL,releaseTag:release,archivedAt:at,archiveRole:['Builds'],archiveAvailability:'present'};f.backupPath=storePreserving(destinationForFile(backup,item,f),original,backup);item.files.push(f);}
    const f={name:d.id+'-game-'+d.gameVersion+'-ps4-900.bin',bytes:data.length,sha256:digest,resolvedUrl:sourceURL,releaseTag:release,archivedAt:at,archiveRole:['Builds'],archiveAvailability:'present'};
    if(compressed){f.transformation='BZIP2 decompression only. Payload bytes never executed.';f.sourceArchiveSHA256=sha(original);}
    f.backupPath=storePreserving(destinationForFile(backup,item,f),data,backup);
    const local=storePreserving(path.join(root,'downloads/hosts/ps4/legacy-menus',repo.commit.slice(0,12),f.name),data,path.join(root,'downloads'));
    f.local='/'+path.relative(root,local).split(path.sep).join('/');item.files.push(f);items.push(item);
    actions.push({id:'ps4-legacy-'+d.id,label:d.family,family:d.family,menuFamily:d.family==='LTS'?'LTS / LRS':d.family,platform:'ps4',category:'mods',game:'GTA V',gameVersion:d.gameVersion,menuVersion:d.menuVersion,titleIds:[],firmwares:['9.00'],legacy:true,format:'BIN',bytes:f.bytes,sha256:f.sha256,downloadURL:f.local,run:d.http?{type:'goldhen-http',port:9090,statusPath:'/status',readyStatus:'ready'}:null,launchURL:d.http?null:hostURL,launchLabel:d.http?'Load on PS4':'Open menu host',hostURL,hostVariant:host,variantLabel:d.note||host+' host build',source:dispatchURL,sourceURL,sourceCommit:repo.commit,firmwareEvidence:'The reviewed original '+host+' host maps this exact file to GTA V '+d.gameVersion+'. This entry is pinned to PS4 firmware 9.00; no PS5 or other-firmware support is inferred.',loaderEvidence:d.http?{sourceURL:dispatch.url,payloadPath:'./'+d.file,transport:'Raw BIN ArrayBuffer POST to GoldHEN HTTP port9090 after its status reports ready.'}:null,license:'No menu-specific redistribution licence declared for this compiled build. Original host/author attribution is preserved.',image:'/assets/images/gta52.png',imageRole:'Game artwork; not a screenshot of this menu build.',requirements:['PS4 firmware9.00 and GTA V game update '+d.gameVersion+'; game update and console firmware are separate requirements.','The original host supplies no regional CUSA list; confirm the exact region and executable before using this build.',d.http?'Requires a running compatible GoldHEN BinLoader HTTP service on port9090. Acceptance confirms transport only; verify the effect on the console.':'The exact variant is loaded by the original host exploit path. Native GoldHEN HTTP compatibility was not established; use Open menu host rather than a guessed Send button.',d.note||'Menu version is '+(d.menuVersion?'source-confirmed as '+d.menuVersion:'not independently established; do not substitute the game update for the menu version')+'.','Use one compatible menu at a time in offline/story mode. No downloaded payload was executed during import.'],tags:['PS4','GTA V',d.family,'older game updates',d.gameVersion,'BIN','ready-to-use',host],versionEvidence:{dispatchSource:dispatchURL,function:d.fn,file:basename,menuVersion:d.menuVersion,note:d.note||null}});
    console.log(d.id+': '+f.bytes+' bytes, '+f.sha256);
  }
  const inv={schemaVersion:1,updated:at,backupRoot:backup,method:'Selected compiled files from pinned original host repositories, not a repository/source archive. Originals and decompressed files preserved; nothing executed.',items,inaccessible};
  fs.writeFileSync(inventoryFile,JSON.stringify(inv,null,2)+'\n');
  fs.writeFileSync(catalogFile,JSON.stringify({schemaVersion:1,updated:at,notes:['Legacy GTA V host builds, source-confirmed exact game updates. Menu version is separate and remains null when undocumented or contradictory.','Source-host loading is not assumed interchangeable with GoldHEN HTTP; only exact mapped Nazky variants expose native Run.','Old and duplicate host builds remain separate immutable downloads; never execute these files on the computer.'],sources:source.repositories.map(x=>({repo:x.repo,commit:x.commit})),actions,inaccessible},null,2)+'\n');
  if(process.argv.includes('--merge-audit'))mergeAudit(items);
  console.log(JSON.stringify({actions:actions.length,archiveFiles:items.reduce((n,x)=>n+x.files.length,0),inaccessible,bytes:items.reduce((n,x)=>n+x.files.reduce((m,f)=>m+f.bytes,0),0)},null,2));
}
function verify(){
  const inv=JSON.parse(fs.readFileSync(inventoryFile,'utf8')),cat=JSON.parse(fs.readFileSync(catalogFile,'utf8'));
  for(const item of inv.items)for(const f of item.files){const bytes=fs.readFileSync(f.backupPath);if(bytes.length!==f.bytes||sha(bytes)!==f.sha256)throw Error('Archive mismatch: '+f.name);if(f.local){const local=fs.readFileSync(path.join(root,f.local));if(sha(local)!==f.sha256)throw Error('Mirror mismatch: '+f.name);}}
  for(const a of cat.actions){if(a.platform!=='ps4'||a.game!=='GTA V'||a.firmwares.join()!=='9.00')throw Error('Unexpected platform/firmware scope');if(a.run&&a.hostVariant!=='Nazky')throw Error('Unproven transport');if(!inv.items.some(i=>i.files.some(f=>f.local===a.downloadURL&&f.sha256===a.sha256)))throw Error('Action not in inventory');}
  if(process.argv.includes('--merge-audit'))mergeAudit(inv.items);
  console.log(JSON.stringify({verified:true,actions:cat.actions.length,files:inv.items.reduce((n,i)=>n+i.files.length,0),payloadsExecuted:false}));
}
if(require.main===module)(process.argv.includes('--download')?download():Promise.resolve().then(verify)).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={definitions,functionBody,verify};
