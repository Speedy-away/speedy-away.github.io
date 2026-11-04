/* Selected official Windows packages. Never executes a downloaded program.
   Existing original archive files and every older version are retained. */
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {createArchive,hashFile,contained}=require('./console-expansion-archive.cjs');
const root=path.resolve(__dirname,'..'),scope='pc-emulators';
const catalogFile=path.join(root,'docs/pc-emulator-catalog.json');
const catalog=JSON.parse(fs.readFileSync(catalogFile));
const evidence=JSON.parse(fs.readFileSync(path.join(root,'docs/pc-emulator-source-evidence.json')));
const reportFile=path.join(root,'docs/pc-emulator-downloads.json');
const sevenZip='C:/Program Files/7-Zip/7z.exe';
const selections={
 'ps5-sharpemu':['sharpemu/sharpemu',/win-x64\.zip$/],
 'ps5-kyty':['KytyPS5/KytyPS5',/Windows-x64\.zip$/],
 'ps4-shadps4':['shadps4-emu/shadPS4',/win64-sdl.*\.zip$/],
 pcsx2:['PCSX2/pcsx2',/windows-x64-Qt\.7z$/],
 rpcs3:['RPCS3/rpcs3-binaries-win',/_win64_msvc\.7z$/],
 duckstation:['stenzek/duckstation',/windows-x64-release\.zip$/],
 cemu:['cemu-project/Cemu',/windows-x64\.zip$/],
 azahar:['azahar-emu/azahar',/windows-mxe-[\d.]+\.zip$/],
 desmume:['TASEmulators/desmume',/win64\.zip$/],
 mupen64plus:['mupen64plus/mupen64plus-core',/bundle-win64-.*\.zip$/],
 snes9x:['snes9xgit/snes9x',/win32-x64\.zip$/],
 xemu:['xemu-project/xemu',/xemu-[\d.]+-windows-x86_64\.zip$/],
 xenia:['xenia-project/release-builds-windows',/xenia_master\.zip$/],
 'xenia-canary':['xenia-canary/xenia-canary',/xenia_canary_windows\.7z$/],
 'cxbx-reloaded':['Cxbx-Reloaded/Cxbx-Reloaded',/CxbxReloaded-Release\.zip$/]
};
const fixed={
 play:{url:'https://purei.org/downloads/play/stable/0.70/Play-x86-64.exe',version:'0.70',format:'PE installer'},
 dolphin:{url:'https://dl.dolphin-emu.org/releases/2609a/dolphin-2609a-x64.7z',version:'2609a'},
 ppsspp:{url:'https://www.ppsspp.org/files/1_20_4/ppsspp_win.zip',version:'1.20.4'},
 mgba:{url:'https://github.com/mgba-emu/mgba/releases/download/0.10.5/mGBA-0.10.5-win64.7z',version:'0.10.5'},
 epsxe:{url:'https://www.epsxe.com/files/ePSXe2018.zip',version:'Windows 2.0.18'},
 project64:{url:'https://www.pj64-emu.com/file/project64-3-0-1-5664-2df3434/',name:'Project64-3.0.1-5664-2df3434.zip',version:'3.0.1-5664-2df3434'},
 retroarch:{url:'https://buildbot.libretro.com/stable/1.22.2/windows/x86_64/RetroArch.7z',name:'RetroArch-1.22.2-Windows-x64.7z',version:'1.22.2'}
};
function jobs(){
 const output=[];
 for(const [appId,[repo,re]]of Object.entries(selections)){
  const source=evidence.repositories.find(r=>r.repo===repo)?.renderedRelease;
  const matches=source?.assets?.filter(u=>re.test(u))||[];
  if(matches.length!==1)throw Error('Expected one selected release asset for '+appId);
  const app=catalog.apps.find(a=>a.id===appId);output.push({appId,url:matches[0],name:decodeURIComponent(new URL(matches[0]).pathname.split('/').pop()),version:app.version});
 }
 for(const [appId,info]of Object.entries(fixed))output.push({appId,...info,name:info.name||decodeURIComponent(new URL(info.url).pathname.split('/').pop())});
 return output;
}
function cleanPublicReport(report){
 for(const attempt of report.attempts||[]){if(attempt.resolvedUrl){const url=new URL(attempt.resolvedUrl);url.search='';url.hash='';attempt.resolvedUrl=url.href;}if(attempt.error)attempt.error=attempt.error.replaceAll(root,'[workspace]').replace(/F:[/\\][^\r\n]*/gi,'[local archive]');}
 for(const file of report.files||[])if(['epsxe','project64','ppsspp'].includes(file.appId))file.osLabel='Windows';
 return report;
}
function inspect(file){
 const fd=fs.openSync(file,'r'),head=Buffer.alloc(64);fs.readSync(fd,head);fs.closeSync(fd);
 if(/\.exe$/i.test(file)){
  if(head.toString('ascii',0,2)!=='MZ')throw Error('Not a PE installer');
  const offset=head.readUInt32LE(60),fd=fs.openSync(file,'r'),signature=Buffer.alloc(4);fs.readSync(fd,signature,0,4,offset);fs.closeSync(fd);
  if(signature.toString('hex')!=='50450000')throw Error('Missing PE signature');
  return {format:'PE installer',validation:'MZ and PE signatures; installer not executed'};
 }
 const format=head.subarray(0,4).equals(Buffer.from([0x50,0x4b,3,4]))?'ZIP':head.subarray(0,6).equals(Buffer.from([0x37,0x7a,0xbc,0xaf,0x27,0x1c]))?'7z':null;
 if(!format)throw Error('Unexpected archive signature');
 if(!fs.existsSync(sevenZip))throw Error('7-Zip required for archive integrity checks');
 const test=spawnSync(sevenZip,['t','-y','--',file],{encoding:'utf8',timeout:90000,maxBuffer:2*1024*1024,windowsHide:true});
 if(test.status!==0)throw Error('Archive integrity check failed: '+(test.stderr||test.stdout).slice(-500));
 const list=spawnSync(sevenZip,['l','-slt','--',file],{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024,windowsHide:true});
 if(list.status!==0)throw Error('Cannot inspect archive file list');
 const entries=[...list.stdout.split('----------').slice(1).join('----------').matchAll(/^Path = (.+)\r?$/gm)].map(m=>m[1].trim());
 if(!entries.length||entries.some(p=>/^(?:[A-Za-z]:|[/\\])/.test(p)||p.split(/[/\\]/).includes('..')))throw Error('Empty or unsafe archive file list');
 if(!entries.some(p=>/\.exe$/i.test(p)))throw Error('No ready Windows executable in package');
 return {format,entries:entries.length,validation:'7-Zip integrity test and path list; ready EXE present; no program executed'};
}
async function download(url,destination){
 const response=await fetch(url,{redirect:'follow',headers:{'User-Agent':'whatsite-PC-emulator-archive/1.0'},signal:AbortSignal.timeout(180000)});
 if(!response.ok)throw Error('HTTP '+response.status+' '+response.statusText);
 if(/text\/html|application\/json/i.test(response.headers.get('content-type')||''))throw Error('Unexpected response content type');
 const max=384*1024*1024;
 if(Number(response.headers.get('content-length'))>max)throw Error('Selected file exceeds 384 MiB bound');
 const handle=await fsp.open(destination,'wx');let bytes=0;
 try{for await(const chunk of response.body){bytes+=chunk.length;if(bytes>max)throw Error('Selected file exceeds 384 MiB bound');await handle.write(chunk);}}finally{await handle.close()}
 const resolved=new URL(response.url);resolved.search='';resolved.hash='';
 return {resolvedUrl:resolved.href,contentType:response.headers.get('content-type')};
}
async function run(){
 let selected=jobs();
 const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
 if(only)selected=selected.filter(j=>only.includes(j.appId));
 if(!process.argv.includes('--download')){console.log(JSON.stringify({scope,selected,sourceOnly:['eden-ns2'],notArchived:['lakka hardware selector','recalbox hardware selector','genesis-plus-gx core selector']},null,2));return;}
 const archive=createArchive();
 const existing=JSON.parse(fs.readFileSync('F:/whatsite-backup-downloads-etc/download-inventory.json'));
 const oldFiles=(existing.items||[]).flatMap(i=>i.files||[]);
 // Reuse exact, checksum-verified archived URLs before making new network calls.
 selected.sort((a,b)=>Number(oldFiles.some(f=>f.sourceUrl===b.url||f.resolvedUrl===b.url))-Number(oldFiles.some(f=>f.sourceUrl===a.url||f.resolvedUrl===a.url)));
 const report=fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile)):{schemaVersion:1,scope,files:[],attempts:[]};
 const staging=path.join(root,'docs/tmp/pc-emulator-staging');await fsp.mkdir(staging,{recursive:true});
 for(const job of selected){
  const app=catalog.apps.find(a=>a.id===job.appId),now=new Date().toISOString();
  console.log('Checking '+job.appId+' '+job.version);
  try{
   const previous=report.files.find(f=>f.appId===job.appId&&f.sourceUrl===job.url&&f.version===job.version);
   if(previous){const record=JSON.parse(fs.readFileSync(path.join(root,'docs/pc-emulators-private-inventory.json'))).items.flatMap(i=>i.files||[]).find(f=>f.sha256===previous.sha256);if(record&&fs.existsSync(record.backupPath)&&(await hashFile(record.backupPath)).sha256===previous.sha256){console.log('Already archived '+job.appId);continue;}}
   const old=oldFiles.find(f=>(f.sourceUrl===job.url||f.resolvedUrl===job.url)&&fs.existsSync(f.backupPath));
   let sourceFile,network={};
   if(old&&(await hashFile(old.backupPath)).sha256===old.sha256){sourceFile=old.backupPath;network={reusedEarlierArchive:true};}
   else{sourceFile=path.join(staging,crypto.randomBytes(6).toString('hex')+'-'+job.name);network=await download(job.url,sourceFile);}
   const validation=inspect(sourceFile);
   const result=await archive.archiveFile({scope,item:{id:scope+'-'+job.appId,title:app.title,url:app.project,platform:'PC',category:['Emulators'],pages:['pc/emulators.html',...(app.family==='Nintendo'?['pc/nintendo-emulators.html']:app.family==='PlayStation'?['pc/playstation-emulators.html']:app.family==='Xbox'?['pc/xbox-emulators.html']:[])],status:'ready'},file:{name:job.name,sourceUrl:job.url,version:job.version,archiveRole:['Builds','Windows'],...validation},sourceFile});
   let local;
   if(result.file.bytes<95*1024*1024){
    const folder=path.join(root,'downloads/archive/pc-emulators',job.appId,result.file.sha256.slice(0,12));await fsp.mkdir(folder,{recursive:true});
    const dest=path.join(folder,job.name);if(fs.existsSync(dest)){if((await hashFile(dest)).sha256!==result.file.sha256)throw Error('Different public file already exists');}else await fsp.copyFile(result.file.backupPath,dest,fs.constants.COPYFILE_EXCL);
    if((await hashFile(dest)).sha256!==result.file.sha256)throw Error('Public mirror checksum differs');local='/'+path.relative(root,dest).replaceAll('\\','/');
   }
   const osLabel=['epsxe','project64','ppsspp'].includes(job.appId)?'Windows':'Windows x64';
   const row={appId:job.appId,...result.publicFile,os:'windows',osLabel,local,...validation};
   if(!report.files.some(f=>f.appId===row.appId&&f.sha256===row.sha256&&f.sourceUrl===row.sourceUrl))report.files.push(row);
   report.attempts.push({appId:job.appId,url:job.url,checkedAt:now,status:'ready',...network,bytes:result.file.bytes,sha256:result.file.sha256});
   console.log('Archived '+job.appId+' '+result.file.bytes+' bytes'+(local?' + public mirror':''));
  }catch(error){
   const attempt={appId:job.appId,url:job.url,checkedAt:now,status:'unavailable',error:error.message};
   report.attempts.push(attempt);
   await archive.appendInventory({scope,items:[{id:scope+'-'+job.appId,title:app.title,url:app.project,platform:'PC',category:['Emulators'],pages:['pc/emulators.html'],status:'unavailable',files:[],attempts:[attempt]}]});
   console.error(job.appId+': '+error.message);
  }
  report.updatedAt=new Date().toISOString();await fsp.writeFile(reportFile,JSON.stringify(cleanPublicReport(report),null,2)+'\n');
 }
 // Persist failed attempts too, even when an earlier transfer was retried and
 // its later ready build is now present. Never replace the ready file record.
 const failedItems=(report.attempts||[]).filter(a=>a.status==='unavailable').map(attempt=>{const app=catalog.apps.find(a=>a.id===attempt.appId);return{id:scope+'-'+app.id,title:app.title,url:app.project,platform:'PC',category:['Emulators'],pages:['pc/emulators.html'],status:report.files.some(f=>f.appId===app.id)?'ready':'unavailable',files:[],attempts:[attempt]};});
 if(failedItems.length)await archive.appendInventory({scope,items:failedItems});
 report.updatedAt=new Date().toISOString();await fsp.writeFile(reportFile,JSON.stringify(cleanPublicReport(report),null,2)+'\n');
 console.log(JSON.stringify({selected:selected.length,ready:report.files.length,failedAttempts:report.attempts.filter(a=>a.status==='unavailable').length,unresolved:selected.filter(j=>!report.files.some(f=>f.appId===j.appId)).length}));
}
if(require.main===module)run().catch(error=>{console.error(error.stack);process.exitCode=1});
module.exports={jobs,inspect,cleanPublicReport};
