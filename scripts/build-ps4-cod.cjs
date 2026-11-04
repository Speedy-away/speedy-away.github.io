const fs=require('node:fs');
const path=require('node:path');
const {page,section,grid,resource,note,steps,ext,link,esc}=require('./build-console-guides.cjs');
const {resources}=JSON.parse(fs.readFileSync('docs/ps4-bo3-resources.json','utf8'));
const manifestFile='downloads/ps4/BO3/manifest.json';
const localFiles=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile,'utf8')).files:[];
const base='/console/mods/ps4/call-of-duty/';
const bo3=base+'black-ops-3/';
const cover='/assets/images/covers/cod-black-ops-3.jpg';
const nav=[['/console/mods/','Console Mods'],['/console/mods/ps4/','PS4/PS5 Games'],[base,'Call of Duty'],[bo3,'Black Ops 3'],[base+'multicod/','MultiCOD · supported games']];
const importManifest='downloads/ps4-ps5/manifest.json';
const importedFiles=fs.existsSync(importManifest)?JSON.parse(fs.readFileSync(importManifest,'utf8')).files:[];
const nextFile=path.join(__dirname,'../docs/virusmike-ps4-next-resources.json');
const nextResources=fs.existsSync(nextFile)?JSON.parse(fs.readFileSync(nextFile,'utf8')).resources:[];
const nextRenderer=require('./console-resource-renderer.cjs').createResourceRenderer({root:path.resolve(__dirname,'..'),files:importedFiles});
const auditFile='docs/download-audit.json';
const archivedFiles=fs.existsSync(auditFile)?JSON.parse(fs.readFileSync(auditFile,'utf8')).items.flatMap(item=>(item.files||[]).map(file=>({...file,source:item.url,status:item.status}))):[];
const canonical=value=>{try{const url=new URL(value);if(url.hostname==='cdn.discordapp.com')url.search='';return url.href;}catch{return null;}};
const normalized=resources.map(menu=>({...menu,id:'bo3-'+menu.id,gameIds:['black-ops-3'],category:menu.group==='injector'?'injector':menu.group==='packs'?'pack':'menu',publication:'include',videos:[],
 images:menu.images||(menu.image?[{original:'/assets/images/ps4-bo3/'+menu.image,caption:menu.name+' supplied preview'}]:[]),
 downloads:menu.downloads.map((file,index)=>({...file,id:'bo3-'+menu.id+'-'+(index+1),distribution:'include'}))}));
// Match exact sources after dropping expiring Discord signatures, retaining the
// established BO3 mirrors and newer imports without replacing older files.
const mirrors=normalized.flatMap(menu=>menu.downloads.map(file=>{
 const stored=[...localFiles,...importedFiles,...archivedFiles].find(entry=>entry.status==='downloaded'&&entry.local&&canonical(entry.source)===canonical(file.url));
 return stored?{...stored,downloadId:file.id}:null;
}).filter(Boolean));
const renderer=require('./console-resource-renderer.cjs').createResourceRenderer({root:path.resolve(__dirname,'..'),files:mirrors});
const card=menu=>renderer.card(normalized.find(item=>item.id==='bo3-'+menu.id));
page('console/mods/ps4/call-of-duty/index.html','Call of Duty Mods for PS4','Browse Call of Duty mod menus for PS4. Find Black Ops 3 GSC tools, Zombies and Multiplayer menus, downloads and setup steps.',cover,nav,
 section('games','Call of Duty games',grid(resource('Call of Duty: Black Ops 3','GSC Injector setup, MuzzMan’s menu pack, Zombies menus and Multiplayer downloads.',link(bo3,'Open Black Ops 3 mods'),cover))), '#games','Browse games');
page('console/mods/ps4/call-of-duty/black-ops-3/index.html','Black Ops 3 Mods for PS4','PS4 Black Ops 3 GSC Injector setup and menu downloads: DayBreak, EnCoRe, Purple Lake, Frostbite, WhiteShadow8500, Synergy and MatrixMods.',cover,nav,
 section('browse','Choose a mode',`<nav class="guide-nav" aria-label="Black Ops 3 sections"><a href="#injector">GSC Injector</a><a href="#setup">Injector setup</a><a href="#zombies">Zombies</a><a href="#multiplayer">Multiplayer</a><a href="#both">MP &amp; ZM</a>${resources.some(menu=>menu.group==='other')?'<a href="#other">Other resources</a>':''}</nav>`)+
 section('injector','GSC Injector & menu pack',grid(...resources.filter(m=>['injector','packs'].includes(m.group)).map(card),...nextResources.map(item=>nextRenderer.card(item))))+
 section('setup','GSC Injector setup · no PC injector needed',steps([
  ['Enable GoldHEN plugin loading','Use a compatible GoldHEN release with plugin support and enable loading in the Plugins Menu. Back up your existing <code>/data/GoldHEN/plugins.ini</code> before editing it.'],
  ['Copy the injector plugin','Put <code>T7_GSC_Injector.prx</code> in <code>/data/GoldHEN/plugins/</code> using your console file manager or file-transfer method.'],
  ['Add the BO3 game entry','Under the CUSA section matching your installed Black Ops 3 title in <code>/data/GoldHEN/plugins.ini</code>, add the exact injector path shown below. Keep your existing game entries.'],
  ['Launch Black Ops 3 once','The supplied injector setup notes say the first launch creates <code>/data/T7 GSC Injector/</code>. Close the game and confirm that the folder exists.'],
  ['Copy your GSC menu files','Extract the MuzzMan pack and copy its menu files into <code>/data/T7 GSC Injector/</code>, preserving any folders required by the pack. Copy extracted scripts rather than the ZIP archive.'],
  ['Relaunch and use the matching mode','Start BO3 again and use the controls documented by your chosen menu or injector. Choose a script for Zombies or Multiplayer as appropriate and check its game-update requirements.']
 ])+`<pre class="guide-code"><code>/data/GoldHEN/plugins/T7_GSC_Injector.prx</code></pre>`+
 note('<p>The folder-creation steps follow the supplied T7 injector notes. The MuzzMan pack works with the posted injector or another compatible injector; packaged SPRX menus can have a different installation method. Follow each menu’s included instructions.</p>')+
 `<div class="guide-links">${ext('https://github.com/GoldHEN/GoldHEN_Plugins_Repository','GoldHEN plugin setup documentation')}</div>`)+
 section('zombies','Zombies mod menus',grid(...resources.filter(m=>m.group==='zombies').map(card)))+
 section('multiplayer','Multiplayer mod menus',grid(...resources.filter(m=>m.group==='multiplayer').map(card)))+
 section('both','Multiplayer & Zombies',grid(...resources.filter(m=>m.group==='both').map(card)))+
 (resources.some(menu=>menu.group==='other')?section('other','Other BO3 resources',grid(...resources.filter(m=>m.group==='other').map(card))):'')+
 normalized.map(item=>renderer.details(item)).join('\n')+nextResources.map(item=>nextRenderer.details(item)).join('\n'), '#injector','Get GSC Injector');
console.log(`Built PS4 BO3 collection: ${resources.length} resources, ${resources.reduce((count,item)=>count+item.downloads.length,0)} download links.`);
