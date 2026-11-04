const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createArchive}=require('./console-expansion-archive.cjs');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'docs/tmp/wii-brawl-galaxy');
const notes=require('./wii-brawl-galaxy-notes.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const archive=createArchive();
 if(process.argv.includes('--art')){
  const art=[['project-plus.webp','https://projectplusgame.com/_next/static/media/logo.37e5965b.webp','Project+ development team'],['brawl-minus.png','https://static.tumblr.com/20ab2283e0b6611dcbe9e89618b1f603/yt9gwre/hfwnyuzp9/tumblr_static_e87v5863mtwsggk8k4c84wgwg.png','Brawl Minus team'],['galaxy-daredevil.webp','https://aurumsmods.com/daredevil/logo.webp','Aurum · Daredevil Mode'],['neo.webp','https://aurumsmods.com/nmg/assets/logo.webp','Aurum · Neo Mario Galaxy'],['lillie.jpg','https://images.gamebanana.com/img/ss/mods/662f1340d59f0.jpg','Camyoshi · Super Lillie Galaxy creator screenshot'],['green-stars.jpg','https://images.gamebanana.com/img/ss/mods/6100979b56818.jpg','Laurozz · The New Green Stars creator screenshot']];
  const previousArt=fs.existsSync(path.join(root,'docs/wii-brawl-galaxy-art.json'))?JSON.parse(fs.readFileSync(path.join(root,'docs/wii-brawl-galaxy-art.json'))).images:[];
  const images=[];
  async function fetchArt(url){let error;for(let i=0;i<3;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('Artwork HTTP '+r.status);return r;}catch(e){error=e;}}throw error;} 
  for(const [name,url,credit] of art){const old=previousArt.find(x=>x.sourceUrl===url);if(old&&fs.existsSync(path.join(root,old.path))&&hash(fs.readFileSync(path.join(root,old.path)))===old.sha256){images.push(old);continue;}const r=await fetchArt(url);const bytes=Buffer.from(await r.arrayBuffer());const target=path.join(root,'assets/images/wii-brawl-galaxy',name);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target)&&hash(fs.readFileSync(target))!==hash(bytes))throw Error('Artwork bytes changed; preserve and version before replacement');if(!fs.existsSync(target))fs.writeFileSync(target,bytes,{flag:'wx'});await archive.archiveFile({scope:'wii-brawl-galaxy',item:{id:'wii-brawl-galaxy-art-'+name.split('.')[0],title:credit+' · '+name,url,platform:'Wii',category:['Artwork','Game Mods'],pages:['console/retro/wii.html']},file:{name,sourceUrl:url,version:'official-art-snapshot-2026-11-02',archiveRole:['Metadata'],expectedBytes:bytes.length,expectedSha256:hash(bytes)},sourceFile:target});images.push({path:'/assets/images/wii-brawl-galaxy/'+name,sourceUrl:url,credit,bytes:bytes.length,sha256:hash(bytes)});fs.writeFileSync(path.join(root,'docs/wii-brawl-galaxy-art.json'),JSON.stringify({images},null,2)+'\n');console.log('Archived art '+name);}
  fs.writeFileSync(path.join(root,'docs/wii-brawl-galaxy-art.json'),JSON.stringify({images},null,2)+'\n');
 }
 if(process.argv.includes('--packages')){
  const jobs=JSON.parse(fs.readFileSync(path.join(root,'docs/wii-brawl-galaxy-jobs.json'))).jobs;
  const inspected=JSON.parse(fs.readFileSync(path.join(root,'docs/wii-brawl-galaxy-package-verification.json'))).records;
  const receipts=fs.readdirSync(stage).filter(x=>/^downloads.*\.json$/.test(x)).flatMap(x=>JSON.parse(fs.readFileSync(path.join(stage,x))).results||[]);
  const previous=fs.existsSync(path.join(root,'docs/wii-brawl-galaxy-catalog.json'))?JSON.parse(fs.readFileSync(path.join(root,'docs/wii-brawl-galaxy-catalog.json'))).entries:[];
  const entries=[];
  for(const job of jobs){const note=notes[job.id],verified=inspected.find(x=>x.id===job.id);
   if(!note)throw Error('Editorial notes missing '+job.id);
   const old=previous.find(x=>x.id===job.id&&x.file?.sha256===verified?.sha256&&x.file?.version===job.version&&x.format===verified?.format);
   if(old){entries.push({...old,...note,title:job.title,version:job.version,image:note.image?{path:'/assets/images/wii-brawl-galaxy/'+note.image,credit:note.credit}:verified.image||old.image});continue;}
   if(!verified){entries.push({...job,...note,image:note.image?{path:'/assets/images/wii-brawl-galaxy/'+note.image,credit:note.credit}:undefined,status:'source-only',reason:'Official transfer did not complete; no verified ready archive is claimed.'});continue;}
   if(!receipts.some(x=>x.id===job.id&&x.status==='downloaded'&&x.bytes===verified.bytes&&x.sha256===verified.sha256))throw Error('Inspected package differs from completed source-transfer receipt: '+job.id);
   const local=verified.bytes<=64*1024**2?'/downloads/wii-brawl-galaxy/'+job.filename:null;
   const slugs={"Super Smash Bros. Brawl":"super-smash-bros-brawl","Super Mario Galaxy":"super-mario-galaxy","Super Mario Galaxy 2":"super-mario-galaxy-2"};const pages=["console/retro/wii.html","console/retro/wii/game-mods.html","console/retro/wii/"+slugs[job.game]+".html"];
   const result=await archive.archiveFile({scope:'wii-brawl-galaxy',item:{id:'wii-brawl-galaxy-'+job.id,title:job.title,url:job.source,platform:'Wii',category:job.kind==='mod'?['Games',job.game,'Mods']:['Tools',note.group],pages},file:{name:job.originalName||job.filename,sourceUrl:job.url,version:job.version,expectedBytes:verified.bytes,expectedSha256:verified.sha256,format:verified.format,archiveRole:job.kind==='windows-helper'?['Helpers','Windows']:['Builds'],...(local?{local}:{})},sourceFile:path.join(stage,job.filename)});
   if(local){const target=path.join(root,local);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target)&&hash(fs.readFileSync(target))!==verified.sha256)throw Error('Public mirror conflict');if(!fs.existsSync(target))fs.copyFileSync(path.join(stage,job.filename),target,fs.constants.COPYFILE_EXCL);}
   entries.push({id:job.id,title:job.title,kind:job.kind,version:job.version,...note,status:'ready',file:result.publicFile,format:verified.format,uncompressedBytes:verified.uncompressedBytes,roots:verified.roots,bootFiles:verified.nativeFiles?.map(x=>({path:x.path,headerPassed:x.headerPassed,format:x.format,note:x.note})),patchSelectors:verified.patchXml?.filter(x=>x.discs?.length||x.regions?.length).map(x=>({path:x.path,discs:x.discs,regions:x.regions})),image:note.image?{path:'/assets/images/wii-brawl-galaxy/'+note.image,credit:note.credit}:verified.image});
   console.log('Archived package '+job.id);
  }
  fs.writeFileSync(path.join(root,'docs/wii-brawl-galaxy-catalog.json'),JSON.stringify({scope:'wii-brawl-galaxy',checkedAt:new Date().toISOString(),entries},null,2)+'\n');
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
