// Import only explicitly reviewed native-UI captures; no downloaded code is run.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir='docs/discord-ps4-ps5-raw/platforms/';
const read=(file,fallback)=>fs.existsSync(path.join(root,file))?JSON.parse(fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,'')):fallback;
const write=(file,data)=>fs.writeFileSync(path.join(root,file),JSON.stringify(data,null,2)+'\n');
const gameDefinitions=[
 ['left-4-dead-2','Left 4 Dead 2','left-4-dead-2'],
 ['red-dead-redemption','Red Dead Redemption','red-dead-redemption'],
 ['red-dead-redemption-undead-nightmare','Red Dead Redemption: Undead Nightmare','red-dead-redemption'],
 ['black-ops-3','Black Ops 3','cod-black-ops-3'],
 ['gta-san-andreas','Grand Theft Auto: San Andreas','gta-san-andreas'],
 ['quantum-of-solace','James Bond 007: Quantum of Solace','quantum-of-solace'],
 ['cod4','Call of Duty 4: Modern Warfare','cod4'],['world-at-war','Call of Duty: World at War','cod-world-at-war'],['modern-warfare-2','Modern Warfare 2 (2009)','cod-mw2-2009'],['modern-warfare-3','Modern Warfare 3','cod-mw3-2011'],['black-ops-1','Black Ops 1','cod-black-ops-1'],['black-ops-2','Black Ops 2','cod-black-ops-2'],['ghosts','Call of Duty: Ghosts','cod-ghosts'],['advanced-warfare','Call of Duty: Advanced Warfare','cod-advanced-warfare'],['gta-iv','Grand Theft Auto IV','gta-iv'],['gta-v','Grand Theft Auto V','gta-v']
];
function game(collection,id){
 const def=gameDefinitions.find(g=>g[0]===id);
 const base=collection==='xbox360'?'/console/xbox360/mods/':'/pc/discord-mods/';
 const special={tools:'Console tools & services',multicod:'Call of Duty multi-game packs',other:'Other games'};
 const title=def?.[1]||special[id];if(!title)throw Error('Register source-confirmed game: '+id);
 const image=def&&fs.existsSync(path.join(root,'assets/images/covers/'+def[2]+'.jpg'))?'/assets/images/covers/'+def[2]+'.jpg':collection==='xbox360'?'/assets/images/consoles/xbox360.png':'/assets/images/covers/cod4.jpg';
 const callOfDuty=['cod4','world-at-war','modern-warfare-2','modern-warfare-3','black-ops-1','black-ops-2','black-ops-3','ghosts','advanced-warfare'].includes(id);
 return {id,title,page:base+(callOfDuty?'call-of-duty/':'')+id+'/index.html',image,kind:id==='multicod'?'collection':id==='tools'?'tools':'game'};
}
function canonical(url){const u=new URL(url);return u.hostname.endsWith('mediafire.com')?'mediafire:'+u.pathname.match(/^\/(?:file|download|file_premium)\/([^/]+)/)?.[1]:u.hostname==='cdn.discordapp.com'?u.origin+u.pathname:url;}
function importCollection(collection){
 if(!['xbox360','pc'].includes(collection))throw Error('Unsupported collection');
 const previous=read('docs/discord-'+collection+'-resources.json',{resources:[]}),map=new Map(previous.resources.map(x=>[x.id,x]));
 const jobsFile='docs/'+collection+'-download-imports.json',jobs=read(jobsFile,{jobs:[]});
 for(const spec of read(dir+'reviewed-posts-log.json',[]).filter(s=>s.collection===collection)){
  const capture=read(dir+spec.capture+'.json');if(capture.postTitle!==spec.title||!/^https:\/\/discord\.com\/channels\/\d+\/\d+$/.test(capture.postUrl||''))throw Error('Unverified capture '+spec.capture);
  const seen=new Set(),urls=(capture.urls||[]).filter(url=>/^https?:\/\/(?:www\.)?mediafire\.com\/(?:file|download)\//.test(url)||/^https:\/\/mega\.nz\/file\/[^#]+#[A-Za-z0-9_-]{43}$/.test(url)||/^https:\/\/cdn\.discordapp\.com\/attachments\/.+\.(?:zip|rar|7z|xex|elite|ff|cfg|gsc|rpf|sco|csc|xsc)(?:\?|$)/i.test(url)).filter(url=>{const key=canonical(url);if(seen.has(key))return false;seen.add(key);return true;});
  const downloads=urls.map(url=>({url:url.startsWith('https://cdn.discordapp.com/')?url.split('?')[0]:url.replace(/^http:\/\/(www\.)?mediafire\.com\//,'https://$1mediafire.com/'),label:'Original source file'}));
  const references=(spec.references||[]).concat((capture.urls||[]).filter(url=>/^https:\/\//.test(url)&&!urls.includes(url)&&!/(?:youtube|youtu\.be|cdn\.discordapp|media\.discordapp)/.test(url)&&(!url.includes('mega.nz')||url.includes('#'))).map(url=>({url,label:'Publisher source & requirements'}))).filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i);
  const item={id:spec.id,name:spec.title,platforms:[collection],gameId:spec.gameId,gameIds:spec.gameIds||(!['multicod','tools','other'].includes(spec.gameId)?[spec.gameId]:[]),category:spec.category||'mod-menu',version:spec.version||'',gameUpdate:spec.gameUpdate||'Not specified by source',compatibility:spec.compatibility||'Exact title update, region, media ID and required environment are not specified in the captured post.',region:spec.region||'',source:capture.postUrl,description:spec.description||spec.title+' · source-listed '+(collection==='xbox360'?'Xbox 360':'PC')+' resource.',tags:[collection==='xbox360'?'Xbox 360':'PC','Discord source',...(spec.tags||[])],keywords:spec.keywords||[],downloads,references,note:spec.note||'',...(spec.readiness?{readiness:spec.readiness}:{}),guideBlocks:spec.guideBlocks||[{type:'list',title:'Source requirements',items:[spec.gameUpdate?'Game update: '+spec.gameUpdate+'.':'Game update not specified.',spec.compatibility||'Check the original post and archive documentation for the required environment, region and media ID.','Preserve the original archive and game files. File destinations and controls are unverified unless the source explicitly supplies them.']}]};
  map.set(item.id,item);
  for(const [index,download] of downloads.entries()){
   const id=item.id+(downloads.length>1?'-'+(index+1):'');if(jobs.jobs.some(x=>x.id===id))continue;
   const parsed=new URL(download.url),name=decodeURIComponent(parsed.pathname.replace(/\/file\/?$/,'').split('/').pop());
   const filename=/\.(?:zip|rar|7z|xex|elite|ff|cfg|gsc|rpf|sco|csc|xsc)$/i.test(name)?name:undefined;
   const target=game(collection,item.gameId);jobs.jobs.push({id,resource:item.id,title:item.name,platform:collection==='xbox360'?'Xbox 360':'PC',category:item.gameId==='tools'?['Tools']:['Games',target.title],project:item.name,version:item.version||'Unversioned',archiveRole:['Builds'],url:urls[index].replace(/^http:/,'https:'),filename,maxBytes:300000000,pages:[target.page.slice(1)],...(spec.downloadJob||{})});
  }
 }
 for(const notesFile of ['docs/discord-'+collection+'-guide-research.json','docs/discord-'+collection+'-guide-notes.json']){
 const notes=read(notesFile,{});
 for(const item of map.values()){
  let record=notes[item.id],reused=false;
  if(!record){const urls=new Set(item.downloads.map(x=>canonical(x.url)));record=Object.values(notes).find(note=>note.evidence?.exactSourceUrl&&urls.has(canonical(note.evidence.exactSourceUrl)));reused=Boolean(record);}
  if(!record)continue;const {evidence,...publicNotes}=record;Object.assign(item,publicNotes);
  if(reused)item.note=[item.note,'This post links the same original archive as another reviewed source. Its archive requirements are preserved here; the post title alone does not establish a different build.'].filter(Boolean).join(' ');
 }
 }
 const resources=[...map.values()],ids=[...new Set(resources.flatMap(x=>[x.gameId,...x.gameIds,...(x.indexIds||[]),...(x.referenceGameIds||[])]))];
 write('docs/discord-'+collection+'-resources.json',{schemaVersion:1,reviewed:'2026-11-02',scope:'Additive reviewed sources; live audit remains in progress.',games:ids.map(id=>game(collection,id)),resources});write(jobsFile,jobs);console.log(collection+': '+resources.length+' reviewed resources, '+jobs.jobs.length+' explicit archive jobs.');
}
if(require.main===module)for(const collection of process.argv.slice(2).length?process.argv.slice(2):['xbox360','pc'])importCollection(collection);
module.exports={game,canonical,importCollection};
