// Selected original PS5 releases only. Inspect bytes and metadata, never execute them.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {inspectArchive}=require('./audit-console-ready-files.cjs');
const root=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
function preserve(file,bytes){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target)){if(hash(fs.readFileSync(target))!==hash(bytes))throw Error('Refusing to replace different file: '+file);}else fs.writeFileSync(target,bytes,{flag:'wx'});}
async function capture(asset,file){
  let bytes;
  if(fs.existsSync(path.join(root,file)))bytes=fs.readFileSync(path.join(root,file));
  else{
    const response=await fetch(asset.browser_download_url,{signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw Error('HTTP '+response.status);
    if(Number(response.headers.get('content-length'))>80*1024*1024)throw Error('Oversized release asset');
    const chunks=[];let length=0;for await(const chunk of response.body){length+=chunk.length;if(length>80*1024*1024)throw Error('Oversized release asset');chunks.push(chunk);}bytes=Buffer.concat(chunks);
  }
  if(bytes.length!==asset.size||asset.digest!=='sha256:'+hash(bytes))throw Error('Pinned publisher asset size/hash mismatch');
  preserve(file,bytes);return bytes;
}
function extract(archive,file,maxBuffer){return execFileSync('C:/Program Files/7-Zip/7z.exe',['e','-so','-spd',path.join(root,archive),file],{maxBuffer});}
async function main(){
  const baseline=read('docs/qa/console-expansion-batch4-baseline.json');
  const definitions=[
    {id:'ps5-store-prosperolight-01-000-110',title:'ProsperoLight',titleId:'PPSA99002',contentVersion:'01.000.110',releaseFile:'docs/qa/batch4-prosperolight-release.json',tag:'01.000.110',filename:'PPSA99002.zip',
      description:'Native PS5 Moonlight-style client for streaming games or a desktop from a Sunshine-compatible PC. Pair your own host; PC games are streamed, not installed on the PS5.',
      compatibility:'Native PS5 app, PPSA99002. Requires an already compatible homebrew environment and title loader plus a reachable Sunshine-compatible host. The pinned README gives no universal firmware matrix.',
      preparation:'Close the app before updating. Extract the complete PPSA99002/ folder into /data/homebrew/, keep one installation of this title and refresh title registration in your compatible loader. Start Sunshine on your PC, select or add its address in ProsperoLight and enter the pairing PIN on the host. A wired LAN is recommended. Touchpad + L1 ends a stream. Pairings/settings normally stay in /data/prosperolight.',
      source:'https://github.com/LedyBacer/ProsperoLight/releases/tag/01.000.110'},
    {id:'ps5-store-recompstore-2-7-4',title:'RecompStore',titleId:'PPSA92000',contentVersion:'02.740.000',releaseFile:'docs/qa/batch4-recompstore-release.json',tag:'v2.7.4',filename:'PPSA92000.zip',
      description:'PS5 homebrew store for native recompiled ports, emulators and apps. Game setup uses your own disc images or other required source files; no commercial game data is in this download.',
      compatibility:'Native PS5 app, PPSA92000. Publisher requires kstuff, an ELF loader on TCP 9021 and ShadowMountPlus 1.7 Beta 5 or newer. No firmware range is inferred from these prerequisites.',
      preparation:'Manual install: extract the complete PPSA92000/ directory into /data/homebrew/ and let ShadowMountPlus register the title. Alternatively use the separately archived matching RecompStore-Installer.elf. The installer fetches the newest upstream build when online, or uses its embedded copy offline; use this pinned ZIP for an exact v2.7.4 install. Keep required data, modules and included payloads together. Follow each port’s own game-input requirements.',
      source:'https://github.com/elripalda/RecompStore/releases/tag/v2.7.4'}
  ];
  const resources=[],jobs=[],inspection=[];
  for(const app of definitions){
    if(baseline.items.some(item=>item.id===app.id||item.source===app.source||item.filename===app.filename&&item.platforms.includes('ps5')))throw Error('Already listed app candidate: '+app.title);
    const release=read(app.releaseFile);if(release.tag_name!==app.tag)throw Error('Wrong release tag');
    const asset=release.assets.find(asset=>asset.name===app.filename);if(!asset)throw Error('Missing publisher asset');
    const staged=`docs/tmp/console-expansion-batch4/${app.filename}`,bytes=await capture(asset,staged);
    const layout=inspectArchive(path.join(root,staged),{readDocumentation:false});
    if(layout.entries.some(file=>file.encrypted)||layout.entries.reduce((n,file)=>n+file.bytes,0)>256*1024*1024)throw Error('Unsupported app archive');
    const param=layout.entries.find(file=>file.path===app.titleId+'/sce_sys/param.json');
    const eboot=layout.entries.find(file=>file.path===app.titleId+'/eboot.bin');
    const icon=layout.entries.find(file=>file.path===app.titleId+'/sce_sys/icon0.png');
    if(!param||!eboot||!icon||param.bytes>1024*1024||icon.bytes>8*1024*1024||eboot.bytes>128*1024*1024)throw Error('Expected complete native PS5 title layout missing');
    const metadata=JSON.parse(extract(staged,param.path,1024*1024).toString('utf8'));
    if(metadata.titleId!==app.titleId||app.contentVersion&&metadata.contentVersion!==app.contentVersion)throw Error('Native app identity/version mismatch');
    const executable=extract(staged,eboot.path,128*1024*1024),magic=executable.subarray(0,4).toString('hex');
    if(!['5414f5ee','4f153d1d'].includes(magic)||executable.length!==eboot.bytes)throw Error('Invalid native SELF executable');
    const png=extract(staged,icon.path,8*1024*1024);if(png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid app icon');
    const image=`assets/images/console-software/store/${app.id}.png`;preserve(image,png);
    const common={platforms:['ps5'],version:app.tag,source:app.source,image:'/'+image,page:'/console/ps5/apps.html#'+app.id,compatibility:app.compatibility};
    resources.push({...common,id:app.id,title:app.title,category:'apps',filename:asset.name,url:asset.browser_download_url,description:app.description,preparation:app.preparation,bytes:bytes.length,sha256:hash(bytes),packageMetadata:metadata,format:'Complete native PS5 ZIP'});
    jobs.push({id:app.id,title:app.title,platform:'PS5',category:['Apps'],project:app.title,version:app.tag,filename:asset.name,url:asset.browser_download_url,importPath:staged,expectedBytes:bytes.length,expectedSha256:hash(bytes),mirror:false,archiveRole:['Builds'],pages:['console/ps5/apps.html','console/ps5/downloads.html']});
    inspection.push({id:app.id,metadata,ebootMagic:magic,layout,icon:{source:asset.browser_download_url,archiveEntry:icon.path,bytes:png.length,sha256:hash(png)},bytes:bytes.length,sha256:hash(bytes),executed:false});
    if(app.titleId==='PPSA92000'){
      const installer=release.assets.find(asset=>asset.name==='RecompStore-Installer.elf'),file='docs/tmp/console-expansion-batch4/RecompStore-Installer.elf';
      const elf=await capture(installer,file);
      if(elf.subarray(0,4).toString('hex')!=='7f454c46'||elf[4]!==2||elf.readUInt16LE(18)!==62)throw Error('Wrong installer ELF target');
      require('./prepare-console-multicod-files.cjs').inspectElf(elf);
      const id='ps5-recompstore-installer-2-7-4';
      resources.push({...common,id,title:'RecompStore · installer ELF',category:'payloads',filename:installer.name,url:installer.browser_download_url,description:'Standalone publisher installer for the matching PS5 store, separate from the manual app ZIP.',preparation:'Requires kstuff, an active PS5 ELF loader on TCP 9021 and ShadowMountPlus 1.7 Beta 5 or newer. Explicitly send this ELF with your supported payload sender. Online, it downloads the newest upstream release; offline, it uses its embedded copy. For an exactly pinned v2.7.4 install, use the manual ZIP instead. A download link does not execute the installer.',bytes:elf.length,sha256:hash(elf),format:'PS5 installer ELF'});
      resources[resources.length-1].page='/console/ps5/apps.html#'+id;
      jobs.push({id,title:'RecompStore installer',platform:'PS5',category:['Apps','Installers'],project:'RecompStore',version:app.tag,filename:installer.name,url:installer.browser_download_url,importPath:file,expectedBytes:elf.length,expectedSha256:hash(elf),mirror:false,archiveRole:['Builds'],pages:['console/ps5/apps.html','console/ps5/downloads.html']});
    }
    console.log(app.title+': publisher digest, native title layout, embedded identity and icon verified');
  }
  for(const [file,data] of [['docs/console-batch4-apps.json',{reviewed:'2026-11-02',resources}],['docs/console-batch4-app-jobs.json',{jobs}],['docs/qa/console-batch4-app-inspection.json',{inspection}]]){
    const previous=fs.existsSync(path.join(root,file))?read(file):null;
    if(previous&&JSON.stringify(previous)!==JSON.stringify(data))throw Error('Preserving existing different batch metadata');
    fs.writeFileSync(path.join(root,file),JSON.stringify(data,null,2)+'\n');
  }
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
