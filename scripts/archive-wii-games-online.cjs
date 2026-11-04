const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createArchive}=require('./console-expansion-archive.cjs');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'docs/tmp/wii-games-online');
const notes=require('./wii-games-online-notes.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const archive=createArchive();
 if(process.argv.includes('--art')){
  const art=[['ctgp.png','https://www.chadsoft.co.uk/img/banner-text.png','CTGP Revolution / ChadSoft'],['newer.png','https://newerteam.com/wii/img/newerLogo.png','Newer Team'],...['falling-leaf','summer-sun','holiday-special','another-smbw'].map((id,i)=>[id+'.png','https://newerteam.com/wii/img/'+['sp_leaf.png','sp_summer.png','sp_holiday.png','sp_another.png'][i],'Newer Team']),['wiilink.webp','https://wiilink.ca/img/logo.webp','WiiLink'],['mkw-sp.png','https://raw.githubusercontent.com/mkw-sp/mkw-sp/v0.1.12/www/assets/11-ghosts.png','MKW-SP project · official 11-ghosts screenshot']];
  const previousArt=fs.existsSync(path.join(root,'docs/wii-games-online-art.json'))?JSON.parse(fs.readFileSync(path.join(root,'docs/wii-games-online-art.json'))).images:[];
  const images=[];
  for(const [name,url,credit] of art){const old=previousArt.find(x=>x.sourceUrl===url);if(old&&fs.existsSync(path.join(root,old.path))&&hash(fs.readFileSync(path.join(root,old.path)))===old.sha256){images.push(old);continue;}const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Artwork HTTP '+r.status);const bytes=Buffer.from(await r.arrayBuffer());const target=path.join(root,'assets/images/wii-games-online',name);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target)&&hash(fs.readFileSync(target))!==hash(bytes))throw Error('Artwork bytes changed; preserve and version before replacement');if(!fs.existsSync(target))fs.writeFileSync(target,bytes,{flag:'wx'});await archive.archiveFile({scope:'wii-games-online',item:{id:'wii-games-online-art-'+name.split('.')[0],title:credit+' · '+name,url,platform:'Wii',category:['Artwork','Game Mods'],pages:['console/retro/wii.html']},file:{name,sourceUrl:url,version:'official-art-snapshot-2026-11-02',archiveRole:['Metadata'],expectedBytes:bytes.length,expectedSha256:hash(bytes)},sourceFile:target});images.push({path:'/assets/images/wii-games-online/'+name,sourceUrl:url,credit,bytes:bytes.length,sha256:hash(bytes)});console.log('Archived art '+name);}
  fs.writeFileSync(path.join(root,'docs/wii-games-online-art.json'),JSON.stringify({images},null,2)+'\n');
 }
 if(process.argv.includes('--packages')){
  const jobs=JSON.parse(fs.readFileSync(path.join(root,'docs/wii-games-online-jobs.json'))).jobs;
  const inspected=JSON.parse(fs.readFileSync(path.join(root,'docs/wii-games-online-package-verification.json'))).records;
  const receipts=fs.readdirSync(stage).filter(x=>/^downloads.*\.json$/.test(x)).flatMap(x=>JSON.parse(fs.readFileSync(path.join(stage,x))).results||[]);
  const previous=fs.existsSync(path.join(root,'docs/wii-games-online-catalog.json'))?JSON.parse(fs.readFileSync(path.join(root,'docs/wii-games-online-catalog.json'))).entries:[];
  const entries=[];
  for(const job of jobs){const note=notes[job.id],verified=inspected.find(x=>x.id===job.id);
   if(!note)throw Error('Editorial notes missing '+job.id);
   const old=previous.find(x=>x.id===job.id&&x.file?.sha256===verified?.sha256&&x.file?.version===job.version&&x.format===verified?.format);
   if(old){entries.push({...old,...note,version:job.version,image:note.image?{path:'/assets/images/wii-games-online/'+note.image,credit:note.credit}:verified.image||old.image});continue;}
   if(!verified){entries.push({...job,...note,status:'source-only',reason:'Official transfer did not complete; no verified ready archive is claimed.'});continue;}
   if(!receipts.some(x=>x.id===job.id&&x.status==='downloaded'&&x.bytes===verified.bytes&&x.sha256===verified.sha256))throw Error('Inspected package differs from completed source-transfer receipt: '+job.id);
   const local=verified.bytes<=64*1024**2?'/downloads/wii-games-online/'+job.filename:null;
   const pages=['console/retro/wii.html','console/retro/wii/game-mods.html',...(job.game==='Mario Kart Wii'?['console/retro/wii/mario-kart-wii.html']:job.game==='New Super Mario Bros. Wii'?['console/retro/wii/new-super-mario-bros-wii.html']:['console/retro/wii/online.html'])];
   const result=await archive.archiveFile({scope:'wii-games-online',item:{id:'wii-games-online-'+job.id,title:job.title,url:job.source,platform:'Wii',category:job.kind==='mod'?['Games',job.game,'Mods']:['Tools',note.group],pages},file:{name:job.originalName||job.filename,sourceUrl:job.url,version:job.version,expectedBytes:verified.bytes,expectedSha256:verified.sha256,format:verified.format,archiveRole:job.kind==='windows-helper'?['Helpers','Windows']:['Builds'],...(local?{local}:{})},sourceFile:path.join(stage,job.filename)});
   if(local){const target=path.join(root,local);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target)&&hash(fs.readFileSync(target))!==verified.sha256)throw Error('Public mirror conflict');if(!fs.existsSync(target))fs.copyFileSync(path.join(stage,job.filename),target,fs.constants.COPYFILE_EXCL);}
   entries.push({id:job.id,title:job.title,kind:job.kind,version:job.version,...note,status:'ready',file:result.publicFile,format:verified.format,uncompressedBytes:verified.uncompressedBytes,roots:verified.roots,bootFiles:verified.nativeFiles?.map(x=>({path:x.path,headerPassed:x.headerPassed,format:x.format,note:x.note})),patchSelectors:verified.patchXml?.filter(x=>x.discs?.length||x.regions?.length).map(x=>({path:x.path,discs:x.discs,regions:x.regions})),image:note.image?{path:'/assets/images/wii-games-online/'+note.image,credit:note.credit}:verified.image});
   console.log('Archived package '+job.id);
  }
  fs.writeFileSync(path.join(root,'docs/wii-games-online-catalog.json'),JSON.stringify({scope:'wii-games-online',checkedAt:new Date().toISOString(),entries},null,2)+'\n');
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
