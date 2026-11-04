// Import explicitly reviewed captures. This reads text, never executes archive members.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,''));
const write=(file,data)=>fs.writeFileSync(path.join(root,file),JSON.stringify(data,null,2)+'\n');
const captureRoot='docs/discord-ps4-ps5-raw/platforms/';
const registryFile=captureRoot+'ps3-reviewed-posts.json';
const registry=read(registryFile);
const previous=fs.existsSync(path.join(root,'docs/discord-ps3-resources.json'))?read('docs/discord-ps3-resources.json'):{resources:[]};
const jobs=read('docs/ps3-download-imports.json');
const resources=new Map(previous.resources.map(item=>[item.id,item]));
for(const spec of registry.posts){
 const capture=read(captureRoot+spec.capture+'.json');
 if(capture.postTitle!==spec.title || !/^https:\/\/discord\.com\/channels\/\d+\/\d+$/.test(capture.postUrl || ''))throw Error('Capture title or provenance mismatch: '+spec.capture);
 const seen=new Set();
 const capturedUrls=[...(capture.urls || []),...[...capture.accessibility.matchAll(/Value: (https?:\/\/[^\s]+)/g)].map(match=>match[1])];
 const urls=capturedUrls.filter(url=>/^https?:\/\/(?:www\.)?mediafire\.com\//.test(url) || /^https:\/\/mega\.nz\/file\/[^#]+#[A-Za-z0-9_-]{43}$/.test(url) || /^https:\/\/cdn\.discordapp\.com\/attachments\/.+\.(?:rar|zip|7z|sprx|bin|pkg|ff|cfg|gsc|rpf|sco|self)(?:\?|$)/i.test(url)).filter(url=>{
  const parsed=new URL(url),key=parsed.hostname.endsWith('mediafire.com')?'mediafire:'+parsed.pathname.match(/^\/(?:file|download|file_premium)\/([^/]+)/)?.[1]:parsed.hostname==='cdn.discordapp.com'?parsed.origin+parsed.pathname:url;
  if(seen.has(key))return false;seen.add(key);return true;
 });
 const downloads=[];
 for(const [index,url] of urls.entries()){
  const id=spec.id+(urls.length>1?'-'+(index+1):'');
  let filename=spec.filename || decodeURIComponent(new URL(url).pathname.replace(/\/file\/?$/,'').split('/').pop());
  if(!/\.(?:rar|zip|7z|sprx|bin|pkg|ff|cfg|gsc|rpf|sco|self)$/i.test(filename) && !url.startsWith('https://mega.nz/')){
   if(/^https?:\/\/(?:www\.)?mediafire\.com\/(?:download|file)\/[a-z0-9]+(?:\/|$)/i.test(url))filename=undefined;
   else throw Error('Missing filename: '+spec.id);
  }
  const secure=url.replace(/^http:\/\/(www\.)?mediafire\.com\//,'https://$1mediafire.com/');
  downloads.push({url:secure.startsWith('https://cdn.discordapp.com/')?secure.split('?')[0]:secure,label:spec.downloadLabel || 'Original '+spec.title+' file',...(secure!==url?{capturedUrl:url}:{})});
  if(!jobs.jobs.some(job=>job.id===id))jobs.jobs.push({id,resource:spec.id,title:spec.title,platform:'PS3',category:['Games',...(['gta-v','gta-iv','minecraft','skate-3','red-dead-redemption','dead-rising-2'].includes(spec.gameId)?[]:['Call of Duty']),spec.gameName || 'COD4',spec.category==='sprx'?'SPRX Menus':spec.category==='loader'?'Mod Loaders':'Patch Menus'],project:spec.title,version:spec.version || 'Unversioned',archiveRole:['Builds'],url:secure,capturedUrl:url,filename,maxBytes:300000000,pages:[(registry.games.find(game=>game.id===spec.gameId)?.url || read('docs/ps3-mod-resources.json').games?.find(game=>game.id===spec.gameId)?.url || '/console/ps3/mods/call-of-duty/'+spec.gameId+'/').slice(1)+'index.html'],...(spec.downloadJob || {})});
 }
 const category=spec.category || 'script';
 const status=urls.length?'source-captured':/Original message was deleted|Download:\s*N\/A/i.test(capture.accessibility)?'source-marks-down':'source-reference';
 const sourceRequirements=[];
 if(spec.gameUpdate && spec.gameUpdate!=='Not specified by source')sourceRequirements.push('Game update: '+spec.gameUpdate+'. Keep this requirement when choosing a build.');
 if(spec.compatibility)sourceRequirements.push(spec.compatibility);
 if(spec.tags?.includes('Oldschool'))sourceRequirements.push('This is an Oldschool resource. Do not substitute a patch from a different game update.');
 const guideBlocks=spec.guideBlocks?.length?spec.guideBlocks:sourceRequirements.length?[{type:'list',title:'Requirements recorded in the source',items:sourceRequirements},{type:'text',title:'Before replacing game files',text:'Check the original post and the archive instructions for your title ID, region and console environment. Preserve your original game files. Installation paths and menu controls are not specified by this captured post.'}]:[];
 resources.set(spec.id,{id:spec.id,name:spec.title,gameId:spec.gameId,category,version:spec.version || '',gameUpdate:spec.gameUpdate || 'Not specified by source',compatibility:spec.compatibility || 'PS3 forum resource; CEX, DEX and HEN support not specified.',description:spec.description || spec.title+' from the PS3 '+(category==='sprx'?'SPRX menu':'patch menu')+' forum. Match the archive’s requirements before use.',status,source:capture.postUrl,downloads,tags:['Discord source',category==='sprx'?'SPRX':category.includes('reference')?'Reference':'Patch',...(spec.tags || [])],keywords:spec.keywords || [],guideBlocks,...(spec.readiness?{readiness:spec.readiness}:{}),...(spec.region?{region:spec.region}:{}),...(spec.references?.length?{references:spec.references}:{}),...(spec.note?{note:spec.note}:{})});
 }
const notesFile='docs/discord-ps3-guide-notes.json';
if(fs.existsSync(path.join(root,notesFile)))for(const [id,notes] of Object.entries(read(notesFile)))if(resources.has(id))Object.assign(resources.get(id),notes);
for(const researchFile of ['docs/discord-ps3-cod4-waw-guide-research.json','docs/discord-ps3-mw2-guide-research.json'])if(fs.existsSync(path.join(root,researchFile))){
 for(const [id,notes] of Object.entries(read(researchFile))){
  if(!resources.has(id))continue;
  const {evidence,...publicNotes}=notes;
  Object.assign(resources.get(id),publicNotes);
 }
}
write('docs/discord-ps3-resources.json',{schemaVersion:1,reviewed:'2026-11-02',scope:'Additive Discord captures; platform audit remains in progress.',games:registry.games,resources:[...resources.values()]});
write('docs/ps3-download-imports.json',jobs);
console.log('Imported '+registry.posts.length+' reviewed posts; '+resources.size+' additive resources.');
