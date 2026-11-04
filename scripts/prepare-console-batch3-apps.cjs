// Inspect original release containers and make explicit backup jobs. Nothing is executed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {entry,sfo}=require('./prepare-ps4-store-apps.cjs');
const {inspectArchive}=require('./audit-console-ready-files.cjs');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function preserve(file,bytes){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target)){if(hash(fs.readFileSync(target))!==hash(bytes))throw Error('Preserving different existing file: '+file);}else fs.writeFileSync(target,bytes,{flag:'wx'});}
function main(){
  const definitions=[
    {id:'ps4-store-orbisshelf-0-2-0',title:'OrbisShelf · PS4',version:'v0.2.0',releaseRecord:'docs/qa/batch3-orbisshelf-release.json',filename:'OrbisShelf-v0.2.0.pkg',stagedPath:'docs/qa/batch3-OrbisShelf-v0.2.0.pkg',expectedTitleId:'ORBS00001',expectedAppVer:'0.20',
      description:'Small homebrew catalogue, downloader and local PKG installer. Version 0.2.0 is the publisher’s stability test build and retains downloaded packages after installation.',
      compatibility:'PS4 PKG for an existing homebrew-enabled console. Publisher reports that runtime behavior still needs target-console testing; no firmware test matrix is supplied. No PS5-native compatibility is claimed.',
      preparation:'Install the PKG through your supported PS4 package installer, then launch OrbisShelf. The initial catalogue is empty: add only your own or authorized homebrew with size/hash metadata. Select with D-pad and Cross; Triangle refreshes the catalogue and Circle exits when no job runs. Downloads are staged in /data/OrbisShelf/downloads. Unlike the older README flow, v0.2.0 keeps the downloaded PKG after install; its stage log is /data/OrbisShelf/install_stage.txt.',
      source:'https://github.com/apexlions16/OrbisShelf/releases/tag/v0.2.0',documentation:'https://github.com/apexlions16/OrbisShelf/blob/v0.2.0/README.md'},
    {id:'ps4-store-pplay-3-8',title:'pPlay · PS4 media player',version:'v3.8',releaseRecord:'docs/qa/batch3-pplay-release.json',filename:'pplay-3.8_ps4.zip',stagedPath:'docs/qa/batch3-pplay-3.8_ps4.zip',expectedTitleId:'PPLA00001',expectedAppVer:'3.8',
      description:'Media player with subtitle support and HTTP/FTP streaming. Complete original PS4 release ZIP contains its installable PKG and required subtitle font data. Version 3.8 fixes PS4 playback clock/synchronization.',
      compatibility:'PS4 release bundle; install in an already compatible homebrew environment. The pinned release supplies no firmware matrix. Nintendo Switch controls and CPU-clock advice in the shared README do not apply to PS4.',
      preparation:'Download the complete ZIP and extract it on your computer. Inside pplay/, install IV0001-PPLA00001_00-PPLA000013080000.pkg with your PS4 package installer. Copy the included data/pplay/ tree to /data/pplay/ on the console, retaining mpv/subfont.ttf. The PKG by itself omits this companion font. Use your own media; network streaming requires a reachable HTTP directory listing or FTP server configured in pplay.cfg. No browser link launches the app.',
      source:'https://github.com/Cpasjuste/pplay/releases/tag/v3.8',documentation:'https://github.com/Cpasjuste/pplay/blob/v3.8/README.MD'}
  ];
  const resources=[],jobs=[],inspection=[];
  for(const app of definitions){
    const release=read(app.releaseRecord),asset=release.assets.find(asset=>asset.name===app.filename);
    if(release.tag_name!==app.version||!asset)throw Error('Publisher release identity mismatch');
    const bytes=fs.readFileSync(path.join(root,app.stagedPath));
    if(bytes.length!==asset.size||asset.digest&&asset.digest!=='sha256:'+hash(bytes))throw Error('Publisher size/hash mismatch');
    let pkg=bytes,layout;
    if(app.filename.endsWith('.zip')){
      layout=inspectArchive(path.join(root,app.stagedPath));
      const selected=layout.consoleFiles.filter(file=>file.path.endsWith('.pkg'));
      if(selected.length!==1||selected[0].bytes>64*1024*1024||!layout.entries.some(file=>file.path==='pplay/data/pplay/mpv/subfont.ttf'&&file.bytes>0))throw Error('Required complete pPlay layout missing');
      pkg=execFileSync('C:/Program Files/7-Zip/7z.exe',['e','-so','-spd',path.join(root,app.stagedPath),selected[0].path],{maxBuffer:64*1024*1024});
      if(pkg.length!==selected[0].bytes)throw Error('Truncated PKG extraction');
    }
    if(!require('./console-package-format.cjs').consolePackageFormat(pkg))throw Error('Invalid PS4 package structure');
    const metadata=sfo(pkg);
    if(metadata.TITLE_ID!==app.expectedTitleId||metadata.APP_VER!==app.expectedAppVer)throw Error('Wrong title/version: '+JSON.stringify(metadata));
    const icon=entry(pkg,0x1200);
    if(!icon||icon.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Expected embedded PNG icon');
    const image=`assets/images/ps4-store-apps/${app.id}.png`;preserve(image,icon);
    resources.push({...app,platforms:['ps4'],category:'apps',format:app.filename.endsWith('.zip')?'PS4 complete ZIP':'PS4 PKG',url:asset.browser_download_url,bytes:bytes.length,sha256:hash(bytes),image:'/'+image,page:'/console/ps4/apps.html#'+app.id,packageMetadata:metadata,mirror:false,distribution:'Publisher download with preserved local backup; original release container retained.',imageProvenance:{source:asset.browser_download_url,embeddedEntry:'icon0.png',bytes:icon.length,sha256:hash(icon)}});
    jobs.push({id:app.id,title:app.title,platform:'PS4',category:['Apps'],project:app.title.split(' · ')[0],version:app.version,filename:app.filename,url:asset.browser_download_url,sourceUrls:[app.source,app.documentation],importPath:app.stagedPath,expectedBytes:bytes.length,expectedSha256:hash(bytes),archiveRole:['Builds'],mirror:false,pages:['console/ps4/apps.html','console/ps4/downloads.html']});
    inspection.push({id:app.id,source:asset.browser_download_url,version:app.version,bytes:bytes.length,sha256:hash(bytes),publisherDigest:asset.digest||null,metadata,layout,executed:false});
  }
  const file='docs/ps4-store-apps.json',current=read(file);
  for(const app of resources){const old=current.resources.find(item=>item.id===app.id);if(old&&old.sha256!==app.sha256)throw Error('Conflicting existing app');if(!old)current.resources.push(app);}
  fs.writeFileSync(path.join(root,file),JSON.stringify(current,null,2)+'\n');
  const jobFile='docs/ps4-store-apps-jobs.json',oldJobs=read(jobFile);
  for(const job of jobs)if(!oldJobs.jobs.some(old=>old.id===job.id))oldJobs.jobs.push(job);
  fs.writeFileSync(path.join(root,jobFile),JSON.stringify(oldJobs,null,2)+'\n');
  fs.writeFileSync(path.join(root,'docs/qa/console-batch3-app-inspection.json'),JSON.stringify({checkedAt:new Date().toISOString(),inspection},null,2)+'\n');
  console.log(JSON.stringify({apps:resources.length,jobs:jobs.length,packageMetadata:inspection.map(item=>item.metadata)}));
}
if(require.main===module)main();
