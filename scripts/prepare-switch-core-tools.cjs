// Official Switch builds only. Read/archive containers; never execute payloads.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Readable}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {spawnSync}=require('node:child_process');
const {createArchive}=require('./console-expansion-archive.cjs');
const {inspectZip}=require('./archive-switch-homebrew.cjs');
const root=path.resolve(__dirname,'..'),scope='switch-core-tools';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function hashFile(file){const h=crypto.createHash('sha256');let size=0;for await(const b of fs.createReadStream(file)){size+=b.length;h.update(b);}return {bytes:size,sha256:h.digest('hex')};}
async function fetchFile(url,file){
 if(fs.existsSync(file))return;
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const r=await fetch(url,{signal:AbortSignal.timeout(600000)});if(!r.ok)throw Error('HTTP '+r.status+' '+url);
 const expected=Number(r.headers.get('content-length'));if(expected>1024**3)throw Error('Bundle exceeds 1 GiB limit');
 const temp=file+'.partial-'+Date.now();await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(temp,{flags:'wx'}));
 if(expected&&fs.statSync(temp).size!==expected)throw Error('Incomplete transfer retained: '+temp);
 if(fs.existsSync(file))throw Error('Destination appeared during download; partial preserved');
 fs.renameSync(temp,file);
}
async function main(){
 const old=JSON.parse(fs.readFileSync(path.join(root,'docs/download-audit.json'),'utf8'));
 const archive=createArchive(),catalog={schemaVersion:1,checkedAt:new Date().toISOString(),platform:'Nintendo Switch',tools:[]};
 for(const config of [{id:'atmosphere',legacy:'1babafe06d1f',title:'Atmosphère',version:'1.12.1',names:[/^atmosphere-.*\.zip$/, /^fusee\.bin$/],source:'https://github.com/Atmosphere-NX/Atmosphere/releases/tag/1.12.1'}, {id:'hekate',legacy:'7c0da63f4531',title:'Hekate + Nyx',version:'6.5.4 + Nyx 1.9.4',names:[/^hekate_ctcaer_6\.5\.4\.bin$/, /^hekate_ctcaer_6\.5\.4_Nyx_1\.9\.4\.zip$/],source:'https://github.com/CTCaer/hekate/releases/tag/v6.5.4'}]){
  const original=old.items.find(i=>i.id===config.legacy);if(!original)throw Error('Missing existing archive item');
  const tool={id:scope+'-'+config.id,slug:config.id,title:config.title,version:config.version,sourceUrl:config.source,files:[]};
  for(const pattern of config.names){
   const existing=original.files.find(f=>pattern.test(f.name));if(!existing)throw Error('Missing pinned asset');
   const data=fs.readFileSync(existing.backupPath);if(data.length!==existing.bytes||sha(data)!==existing.sha256)throw Error('Existing archive hash differs');
   const local='/downloads/nintendo-switch/core-tools/'+config.id+'/'+config.version.replaceAll(' ','_')+'/'+existing.name;
   const target=path.join(root,local);fs.mkdirSync(path.dirname(target),{recursive:true});
   if(fs.existsSync(target)&&sha(fs.readFileSync(target))!==existing.sha256)throw Error('Refusing different public destination');
   if(!fs.existsSync(target))fs.writeFileSync(target,data,{flag:'wx'});
   const result=await archive.archiveFile({scope,item:{id:tool.id,title:tool.title,url:tool.sourceUrl,platform:'Nintendo Switch',category:['Tools',config.id==='atmosphere'?'Custom Firmware':'Bootloaders'],pages:['console/nintendo-switch/'+config.id+'.html']},file:{name:existing.name,version:config.version,sourceUrl:existing.sourceUrl||existing.resolvedUrl,local,archiveRole:['Builds'],expectedBytes:existing.bytes,expectedSha256:existing.sha256},sourceFile:target});
   const file={...result.publicFile,archived:true,publisherSha256:existing.sha256};
   if(/\.zip$/i.test(file.name)){const members=inspectZip(data,128*1024*1024);file.memberCount=members.length;file.layout=members.map(({data,...entry})=>entry);if(config.id==='atmosphere'&&!members.some(m=>m.path==='atmosphere/package3'))throw Error('Missing Atmosphere package3');if(config.id==='hekate'&&!members.some(m=>m.path==='bootloader/sys/nyx.bin'))throw Error('Missing Nyx runtime');}
   tool.files.push(file);console.log('Archived',config.id,file.name,file.bytes);
  }
  catalog.tools.push(tool);
 }
 const retro={id:scope+'-retroarch',slug:'retroarch',title:'RetroArch',version:'1.22.2',sourceUrl:'https://docs.libretro.com/guides/install-libnx/',files:[]};
 const url='https://buildbot.libretro.com/stable/1.22.2/nintendo/switch/libnx/RetroArch.7z';
 const local='/downloads/nintendo-switch/core-tools/retroarch/1.22.2/RetroArch.7z',target=path.join(root,local);
 console.log('Fetching official RetroArch Switch bundle');await fetchFile(url,target);const actual=await hashFile(target);
 const zip='C:/Program Files/7-Zip/7z.exe';
 const listing=spawnSync(zip,['l','-slt',target],{encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true});
 if(listing.status!==0)throw Error('7z listing failed');
 const members=[...listing.stdout.matchAll(/^Path = (.+)\r?$/gm)].map(m=>m[1].trim()).slice(1);
 if(members.some(n=>/^(?:[\\/]|[A-Za-z]:)|(?:^|[\\/])\.\.(?:[\\/]|$)/.test(n)))throw Error('Unsafe RetroArch member path');
 const nro=members.find(n=>/^switch[\\/]retroarch_switch\.nro$/i.test(n));
 if(!nro||!members.some(n=>/^retroarch[\\/]cores[\\/].+\.nro$/i.test(n)))throw Error('Missing Switch frontend or cores');
 const test=spawnSync(zip,['t',target],{encoding:'utf8',maxBuffer:1024*1024,windowsHide:true});if(test.status!==0)throw Error('RetroArch archive integrity test failed');
 const frontend=spawnSync(zip,['e','-so',target,nro],{encoding:null,maxBuffer:64*1024*1024,windowsHide:true});
 if(frontend.status!==0||frontend.stdout.toString('ascii',16,20)!=='NRO0')throw Error('Switch NRO signature missing');
 const imageDir=path.join(root,'assets/images/switch-core-tools');fs.mkdirSync(imageDir,{recursive:true});
 const nroSize=frontend.stdout.readUInt32LE(24);
 if(frontend.stdout.toString('ascii',nroSize,nroSize+4)==='ASET'){
  const start=nroSize+Number(frontend.stdout.readBigUInt64LE(nroSize+8)),size=Number(frontend.stdout.readBigUInt64LE(nroSize+16));
  if(start+size>frontend.stdout.length||size>4*1024*1024)throw Error('Invalid frontend icon bounds');
  const icon=frontend.stdout.subarray(start,start+size);if(icon[0]!==255||icon[1]!==216)throw Error('Expected JPEG frontend icon');
  fs.writeFileSync(path.join(imageDir,'retroarch-icon.jpg'),icon);
  retro.image={local:'/assets/images/switch-core-tools/retroarch-icon.jpg',sourceUrl:url,member:nro+' embedded ASET icon',credit:'Libretro / RetroArch project',bytes:icon.length,sha256:sha(icon)};
 }
 const saved=await archive.archiveFile({scope,item:{id:retro.id,title:retro.title,url:retro.sourceUrl,platform:'Nintendo Switch',category:['Emulators'],pages:['console/nintendo-switch/retroarch.html']},file:{name:'RetroArch.7z',version:retro.version,sourceUrl:url,local,archiveRole:['Builds'],expectedBytes:actual.bytes,expectedSha256:actual.sha256},sourceFile:target});
 retro.files.push({...saved.publicFile,archived:true,memberCount:members.length,frontend:{path:nro,bytes:frontend.stdout.length,sha256:sha(frontend.stdout),format:'NRO0'},coreCount:members.filter(n=>/^retroarch[\\/]cores[\\/].+\.nro$/i.test(n)).length,integrity:'7-Zip test passed'});catalog.tools.push(retro);
 fs.mkdirSync(path.join(root,'assets/images/switch-core-tools'),{recursive:true});
 const imageUrl='https://raw.githubusercontent.com/Atmosphere-NX/Atmosphere/master/img/banner.png';
 const imageLocal='/assets/images/switch-core-tools/atmosphere-banner.png';await fetchFile(imageUrl,path.join(root,imageLocal));const img=fs.readFileSync(path.join(root,imageLocal));
 catalog.images=[{local:imageLocal,sourceUrl:imageUrl,credit:'Atmosphère project; graphical resources credited to jaames',bytes:img.length,sha256:sha(img)}];
 fs.writeFileSync(path.join(root,'docs/switch-core-tools.json'),JSON.stringify(catalog,null,2)+'\n');
 console.log('Prepared',catalog.tools.length,'tools; RetroArch',actual.bytes,'bytes; cores',retro.files[0].coreCount);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
