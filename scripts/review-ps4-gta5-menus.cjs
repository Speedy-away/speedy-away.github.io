// Apply the captured-post/file review without running any downloaded console code.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),scope='ps4-gta5-menu-review';
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const write=(f,d)=>fs.writeFileSync(path.join(root,f),JSON.stringify(d,null,2)+'\n');
const unique=a=>[...new Set(a)];
const legacyIds={
 'Expulsion 7.0':'gta5-expulsion-v7-1-57','Velora 1.5':'gta5-velora-v1-5-1-57',
 'LTS':'gta5-lts-1-57','Serendipity':'gta5-serendipity-1-57',
 'Oxagon Lite':'gta5-oxagon-lite-v1-4','Script Loader':'gta5-script-loader-pack',
 'FCLoader':'gta5-fcloader-csc','GTA Fucker':'gta5-gta-fucker-csc','Random Scripts Pack':'gta5-random-scripts-pack'
};
const p=(title,text)=>({type:'paragraph',title,text});
const code=(title,text)=>({type:'code',title,text});
const list=(title,items)=>({type:'list',title,items});
const steps=(title,items)=>({type:'steps',title,items:items.map(([title,text])=>({title,text}))});
function prepare(){
 const baseline='docs/qa/ps4-gta5-review-baseline.json';
 if(!fs.existsSync(path.join(root,baseline)))write(baseline,{
  capturedAt:new Date().toISOString(),resources:read('docs/ps4-ps5-game-resources.json').resources,
  files:read('downloads/ps4-ps5/manifest.json').files,legacyFiles:read('downloads/ps4/GTA5/manifest.json').files
 });
 const review=read('docs/qa/ps4-gta5-menu-archive-review.json'),jobs=[];
 for(const f of read('downloads/ps4/GTA5/manifest.json').files){
  const gameVersion=f.group==='scripts'?null:'1.'+f.group.slice(1);
  jobs.push({...f,name:f.filename,displayName:f.name,sourceUrl:f.source,
   downloadId:legacyIds[f.name]?legacyIds[f.name]+'-legacy-file':null,
   resourceId:legacyIds[f.name]||null,gameVersion,
   version:(f.name==='Velora 1.5'?'Menu 1.5 (legacy label)':f.name==='Expulsion 7.0'?'Menu 7.0':f.name==='Oxagon Lite'?'Lite v1.4':'Menu release unspecified')+(gameVersion?' - GTA V '+gameVersion:' - GTA V update unspecified')});
 }
 for(const f of review.extractionCandidates){
  const gameVersion='1.'+f.memberPath.match(/(\d{3})\.prx$/)[1].slice(1);
  const resourceId=f.resourceId||'gta5-oxagon-lite-v1-4',name=path.posix.basename(f.memberPath);
  const local='/downloads/ps4/GTA5/reviewed-variants/'+resourceId+'/'+name;
  const source=path.join(root,'.'+f.parentLocal),original=fs.readFileSync(source);
  if(sha(original)!==f.parentSHA256)throw Error('Parent archive changed: '+source);
  const bytes=execFileSync('C:/Program Files/7-Zip/7z.exe',['e','-so','-spd',source,f.memberPath],{maxBuffer:8*1024*1024});
  if(sha(bytes)!==f.sha256||bytes.length!==f.bytes)throw Error('Extracted variant differs: '+name);
  const target=path.join(root,'.'+local);
  if(fs.existsSync(target)){if(sha(fs.readFileSync(target))!==f.sha256)throw Error('Refusing to replace '+target);}
  else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});}
  jobs.push({...f,name,local,resourceId,downloadId:resourceId+'-module-'+gameVersion.replace('.','-'),
   displayName:resourceId.includes('scorpion')?'Scorpion':resourceId.includes('lite')?'Oxagon Lite':'Oxagon Full',
   gameVersion,version:(resourceId.includes('scorpion')?'v1.2b':resourceId.includes('lite')?'Lite v1.4':'Full v1.0')+' - GTA V '+gameVersion,
   derivedFrom:f.parentSHA256});
 }
 for(const f of jobs){const bytes=fs.readFileSync(path.join(root,'.'+f.local));if(bytes.length!==f.bytes||sha(bytes)!==f.sha256)throw Error('File changed: '+f.local);}
 write('docs/qa/ps4-gta5-review-jobs.json',{scope,files:jobs,noPayloadExecution:true});
 return jobs;
}
async function archive(){
 const jobs=prepare(),intake=require('./console-expansion-archive.cjs').createArchive(),records=[];
 for(const f of jobs){const item={id:scope+'-'+(f.downloadId||f.group+'-'+f.filename.toLowerCase().replace(/[^a-z0-9]+/g,'-')),
  title:f.displayName,project:f.displayName,url:f.sourceUrl,platform:'PS4',category:['Games','GTA5',f.gameVersion||'Scripts'],
  gameVersion:f.gameVersion,pages:['console/mods/ps4/gta5/index.html'],publication:'include'};
  const result=await intake.archiveFile({scope,item,file:{...f,source:f.sourceUrl,resolvedUrl:f.sourceUrl,archiveRole:['Builds'],
   expectedBytes:f.bytes,expectedSha256:f.sha256,format:path.extname(f.name).slice(1).toUpperCase(),
   compatibility:f.missingDependency||'PS4 GTA V '+(f.gameVersion||'update unspecified')+'; preserve source-specific dependencies.'},
   sourceFile:path.join(root,'.'+f.local)});
  records.push(result.file);
 }
 console.log('Verified '+records.length+' PS4 GTA V files; merging preserved inventory metadata.');
 await intake.mergeInventory({inventory:intake.inventoryPath(scope),verifyFiles:false});
 const result={archivedAt:new Date().toISOString(),scope,files:records,noPayloadExecution:true};
 write('docs/qa/ps4-gta5-review-archive.json',result);return {files:records.length};
}
function reviewBlocks(id){
 const standard=p('PS4 plugin setup','Check the installed GTA V update and regional title ID before choosing a file. Close GTA V, back up plugins.ini and use your existing compatible GoldHEN plugin environment. Merge only this menu’s entry under the matching title ID. Enable one menu at a time.');
 const blocks={
 'gta5-beta-rebranded':[
  p('Package identity and compatibility','The post labels this a 2TAKE1 PS4 beta test. Its actual module is VOID_Beta_419.prx; an official 2Take1 release is not established. The included configuration names CUSA00419, but supplies no GTA V update. Confirm that missing requirement with the source before installing.'),
  p('Included files','Keep the supplied data folder with the beta module. Preserve your plugins.ini and merge only its VOID entry; the sample also contains unrelated games and plugins.')],
 'gta5-scorpion-v1-2b':[
  p('Choose the matching update','Menu v1.2b includes separate modules for GTA V 1.00 EU/US, 1.38, 1.43, 1.46, 1.48, 1.49 and 1.50. Keep /data/Scorpion from the full archive. A module-only download omits that data folder. Use the exact selected filename in plugins.ini; the README’s 1.50 line is an example, not a universal build.')],
 'gta5-cyprus':[standard,
  p('Choose a Cyprus module','Each download is a separate CyprusMenu.prx for GTA V 1.53, 1.54, 1.55, 1.56 or 1.57. Keep the selected update label when saving files. The modules identify this as Cyprus Lite; no numeric menu release, title-ID list or firmware range was supplied.'),
  p('Menu data','The modules reference /data/Cyprus, /data/Cyprus/Textures and /data/Cyprus/CustomVehicles.ini. These standalone PRX downloads do not supply those extra assets. Obtain matching data from the source for features that need it.')],
 'gta5-serendipity-1-57':[standard,
  steps('Install the supplied package',[
   ['Choose the full archive','The GTA V 1.57 package contains Seren.prx and its serendipity folder. The separate Seren.prx download is byte-identical to the archive’s module and omits the supporting data.'],
   ['Keep the data together','Preserve the folder at /data/serendipity, including settings.ini, outfits and menyoo/Spooner resources. Place Seren.prx at /data/GoldHEN/plugins/Seren.prx and use your matching title-ID section.']]),
  p('Release and controls','The module contains both Serendipity and Velora 1.4 text. A separate Serendipity release number is not established. L3 + R3 refers to No Clip; the main menu’s opening shortcut and title-ID mapping are not documented.')],
 'gta5-beach-1-56':[standard,p('Standalone Beach 1.56 module','Use BeachMenu156.prx for the source-labelled GTA V 1.56 download. It references /data/BeachXml and /mnt/usb0/BeachXml for XML features, but includes no XML folder. Embedded “Beach v1.72” startup text is a menu/build string, not a different GTA V update. No title-ID mapping or clear opening shortcut was supplied.')],
 'gta5-beach-1-57':[standard,p('Standalone Beach 1.57 module','Use BeachMenu157.prx for GTA V 1.57, separately from BeachMenu156.prx. Its configuration path is /data/BeachConf.ini. No independent menu release, title-ID mapping or clear opening shortcut was supplied.')],
 'gta5-explosive-1-52-1-53':[p('Keep update-specific files separate','Explosive152.sprx and Explosive153.sprx are different game-update builds. Preserve the source’s design.ini.txt and selfoptions.ini.txt with its instructions; do not assume that renaming another menu or using an Expulsion configuration makes it compatible.')],
 'gta5-beach-legacy':[p('Older game-update selection','The source folder also includes explicit GTA V 1.46, 1.52 and 1.53 files. Read each download’s game-update and menu-release label separately. The separate gtav_60fps.prx has no precise game-update pin established by its filename. Retained 30/60 FPS labels do not establish independently tested frame-rate behavior.')],
 'gta5-lts-1-57':[standard,p('Choose the preserved LRS file','The LTS source names the menu LRS in its screenshot. The earlier collection supplies LRS.prx for GTA V 1.57; that exact original is available here alongside the captured-post link. A separate menu release and title-ID mapping are not established.'),
  p('Script and configuration folders','The inspected LRS.prx references /data/LRS_csc/ for CSC scripts, plus configs, outfit, maps and car subfolders, and /data/LRS_csc/settings.ini. This standalone module does not bundle those folders. The embedded button strings do not clearly identify a menu-opening shortcut.')],
 'gta5-oxagon-1-56':[
  steps('Oxagon Full v1.0 installation',[
   ['Select the actual module','The archive contains Oxagon_153.prx for GTA V 1.53 and Oxagon_156.prx for GTA V 1.56. Choose the matching file; they are separate binaries.'],
   ['Transfer the supporting folder','Copy the archive’s Oxagon folder to /data/Oxagon and the selected PRX to /data/GoldHEN/plugins/. The module-only links omit the data folder.'],
   ['Merge the matching configuration','Back up plugins.ini. The README pairs CUSA00419 with the 1.53 module and CUSA00411 with the 1.56 module. These are the supplied examples; other region/update combinations are not established.']]),
  code('Supplied title-ID examples','[CUSA00419]\n/data/GoldHEN/plugins/Oxagon_153.prx\n\n[CUSA00411]\n/data/GoldHEN/plugins/Oxagon_156.prx')],
 'gta5-explosive-1-57':[standard,p('Explosive 1.57 module','This download is explosive_temp.sprx for the source-labelled GTA V 1.57 entry. Use its original name in the plugin path. No README, title-ID mapping or opening shortcut was supplied. Explosive and Expulsion remain separate menu families.')],
 'gta5-velora-1-56':[standard,p('Velora 1.56 download','This is a standalone Velora.sprx for the source-labelled GTA V 1.56 entry. The module references /data/Velora/maps, vehicles, outfits, music, lua and velora_profile.ini. Matching support files are not included in this direct download; compatibility with the separate 1.57 package’s data is not established.')],
 'gta5-velora-1-57':[standard,p('Velora 1.4 package','The full ZIP contains Velora.sprx and its Velora data folder. Preserve /data/Velora, including Lua compatibility files and speedometer DDS resources, with /data/GoldHEN/plugins/Velora.sprx. Menu release 1.4 and GTA V update 1.57 are separate labels. The older list’s distinct 1.5 module remains available. No title-ID mapping or fixed opening shortcut was supplied.')],
 'gta5-wildemodz-1-27':[p('BIN download requirements','The captured post labels GTA V 1.27 and supplies a WildeModz BIN. It is not a PRX/SPRX plugin. Keep the original file and use only the loader documented for that build. The filename’s 1.1 and 4.55 do not establish support for another game update or firmware. No complete loader setup or unambiguous opening shortcut was captured.')],
 'gta5-lotus-1-27':[p('Lotus menu and game versions','The source supplies a Lotus 1.03 BIN for its GTA V 1.27 entry; the preview displays menu 1.02. Keep those labels separate. This file is not installed through plugins.ini. A matching loader, firmware matrix and unambiguous controller shortcut were not documented in the captured source.')]
 };
 for(const update of ['1.56','1.57'])blocks['gta5-ozark-'+update.replace('.','-')]=[standard,
  steps('Ozark package setup',[
   ['Choose your GTA V update','Use the full '+update+' package. The 1.56 RAR and 1.57 ZIP contain different Ozark.sprx builds; the shared filename does not make them interchangeable.'],
   ['Keep the data folder','Extract the wrapper folder, preserve its ozark folder at /data/ozark, and place the paired Ozark.sprx in /data/GoldHEN/plugins/. Keep the location, outfit and menyoo resources together.'],
   ['Use the matching game entry','The package does not supply a title-ID mapping or a clear menu-opening shortcut. Confirm these with the source; do not copy another menu’s title-ID or key combination.']]),
  p('Screenshot','The Ozark image is the screenshot supplied by the user. It previews the menu family without establishing the selected download’s game update.')];
 return blocks[id]||[];
}
function legacyResource(f){
 const id=legacyIds[f.name],scripts=f.group==='scripts';
 const versions=scripts?[]:f.name==='Oxagon Lite'?['1.53','1.56']:['1.'+f.group.slice(1)];
 const entry={id,gameIds:['gta5'],category:scripts?(['FCLoader','GTA Fucker'].includes(f.name)?'script':'pack'):'menu',publication:'include',name:f.name,
  version:scripts?'CSC resources · game update unspecified':f.name==='Oxagon Lite'?'Menu Lite v1.4 · GTA V 1.53 / 1.56':f.name==='Expulsion 7.0'?'Menu 7.0 · GTA V 1.57':'Menu 1.5 (legacy label) · GTA V 1.57',
  gameVersions:versions,platforms:['ps4'],source:{forumTitle:'Preserved PS4 GTA V download list',postTitle:f.name,postUrl:f.source,
   capturedAt:'2026-11-02',captureFile:'docs/ps4-gta5-sources.json',originalDownloadUrls:[f.source]},
  downloads:[{id:id+'-legacy-file',label:scripts?'Download CSC resources':f.name==='Oxagon Lite'?'Full package · key not included':f.name==='Expulsion 7.0'?'Full package · menu 7.0':'Velora.sprx · menu 1.5 label',filename:f.filename,url:f.source,distribution:'include'}],
  images:[],videos:[],controls:[],guideBlocks:[],tags:['PS4',scripts?'CSC':'GoldHEN'],keywords:[f.filename,f.name,'PS4 GTA 5']};
 const image=read('docs/qa/ps4-gta5-image-audit.json').legacy.find(x=>x.name===f.name&&x.group===f.group);
 if(image?.image)entry.images=[{original:image.recommendedImage||image.image,caption:image.caption}];
 if(f.name==='Expulsion 7.0')Object.assign(entry,{menuVersion:'7.0',titleIds:['CUSA00419','CUSA00411'],
  description:'Full PS4 GTA V 1.57 package with menu data, scripts, outfits and installation notes.',
  controls:[{input:'Square + D-pad Right',action:'Default menu shortcut from INSTALL.txt; saved custom bindings take precedence.'}],
  guideBlocks:[steps('Expulsion 7.0 setup',[
   ['Check the game','INSTALL.txt specifies GTA V 1.57 with CUSA00419 or CUSA00411 using the same supplied module. Menu 7.0 is the release number, not the game update.'],
   ['Merge the supplied folders','Close GTA V. Back up settings and custom files. Merge Expulsion V7.0/PS4/data/ into /data/ and PS4/user/ into /user/, retaining the provided folder names. Resolve settings conflicts deliberately rather than replacing your custom files.'],
   ['Enable the plugin','Merge the supplied LushModz-Expulsion-1.57.prx entry into the matching title-ID section of plugins.ini. Preserve unrelated entries and test one menu at a time.']]),
   code('Supplied plugin path','/data/GoldHEN/plugins/LushModz-Expulsion-1.57.prx'),
   p('Preview and older build','The family screenshot shows menu v5.0; this preserved package is v7.0. The separate v5.0 package remains available with its own requirements.')]});
 if(f.name==='Velora 1.5')Object.assign(entry,{menuVersion:'1.5 (legacy label)',description:'Standalone Velora module from the earlier GTA V 1.57 collection; supporting data is not bundled.',
  guideBlocks:[...reviewBlocks('gta5-velora-1-56').slice(0,1),p('Standalone 1.5-labelled build','The earlier list labels this GTA V 1.57 module Velora 1.5. Its strings also contain Version: 1.5, while the captured forum package is separately labelled 1.4. Preserve both originals. Place this module at /data/GoldHEN/plugins/Velora.sprx only with a matching game configuration. It references /data/Velora, Lua compatibility files and speedometer assets that are not bundled here; do not assume the 1.4 data folder is interchangeable. No title-ID mapping or resolved opening chord was supplied.')]});
 if(f.name==='Oxagon Lite')Object.assign(entry,{menuVersion:'Lite v1.4',description:'Separate GTA V 1.53/1.56 modules with the Oxagon folder. The key required by its README is missing from the ZIP.',
  guideBlocks:[steps('Oxagon Lite v1.4 requirements',[
   ['Check the missing dependency','The README requires /data/Oxagon.key, but the preserved ZIP contains no .key member. Obtain the matching required file from the source before treating this as a complete installation. The module-only links do not fix the missing dependency.'],
   ['Choose the module','Use OxagonLite_153.prx for GTA V 1.53 or OxagonLite_156.prx for GTA V 1.56. Keep the package’s Oxagon folder at /data/Oxagon and place the selected PRX in /data/GoldHEN/plugins/.'],
   ['Preserve configuration','Back up plugins.ini and merge the matching source entry for your installed game. Full v1.0 and Lite v1.4 are separate distributions; do not mix their modules or assume the same key requirement.']])]});
 if(scripts){entry.description='CSC resources requiring a separate compatible script loader. The source does not specify a GTA V update.';
  entry.guideBlocks=[p('Choose a compatible script loader','These CSC/CTD resources are scripts, not GoldHEN PRX/SPRX plugins. Use a loader that explicitly supports the script and your GTA V update. Put scripts in that loader’s documented script directory and open them through its interface; do not add CSC files to plugins.ini. No compatible loader binary or game-update matrix is supplied by this download.')];
  if(f.name==='Script Loader')entry.guideBlocks.push(list('Included menu resources',[
   'Destroy v3 English/Spanish, TerraModz, MoonShine v3, Insanity Ultra, Inimitable v6.5.1, Revolution, Alien Script v3, KolaKao, Brodator Beta and GTA Fucker.',
   'The ZIP contains CSC/CTD files and notes, with no PRX/SPRX loader. Per-menu filenames give different shortcuts and stack-size notes; preserve them.',
   'KolaKao’s README specifies stack size 1024 and R1 + D-pad Right. This applies to KolaKao, not to every script in the archive.'
  ]));
  if(f.name==='Random Scripts Pack')entry.guideBlocks.push(list('Included scripts',['iLLuminate, JRrecovery, krank1, Recovery v3, rock_menu2, Tgsaudoiz, ArabicGuy, Godly and NotYourDope.','The archive provides no installation README, game-update pin or separate PRX/SPRX loader.']));
  if(f.name==='FCLoader')entry.guideBlocks.push(p('FCLoader file type','FCLoader.csc is itself a CSC script. Its name alone does not establish that it can replace the separate plugin needed to run CSC files. Opening controls and dependencies were not documented.'));
  if(f.name==='GTA Fucker')entry.guideBlocks.push(p('Standalone script','This download is GTAFUCKER.csc. Keep it separate from the other menus’ modules and use the matching script loader’s requirements. The supplied image shows the named menu with a V1.3 footer; that is not a GTA V game-update label. No shortcut is assigned from a different archive’s similarly named script.'));
 }
 entry.compatibilityText='PS4 · '+(versions.length?'GTA V '+versions.join(' / '):'GTA V update unspecified')+(f.name==='Oxagon Lite'?' · required key absent':'');
 return entry;
}
function mergeJson(file,update){const target=path.join(root,file),before=fs.readFileSync(target,'utf8'),data=JSON.parse(before);update(data);if(fs.readFileSync(target,'utf8')!==before)throw Error('Concurrent change: '+file);fs.writeFileSync(target,JSON.stringify(data,null,2)+'\n');}
function integrate(){
 const jobs=prepare(),saved=read('docs/qa/ps4-gta5-review-archive.json'),review=read('docs/qa/ps4-gta5-menu-archive-review.json');
 for(const f of jobs){const row=saved.files.find(x=>x.sha256===f.sha256);if(!row||sha(fs.readFileSync(row.backupPath))!==f.sha256)throw Error('Required backup unverified: '+f.name);}
 const images=read('docs/qa/ps4-gta5-image-audit.json').recommendations;
 const legacy=read('downloads/ps4/GTA5/manifest.json').files;
 mergeJson('docs/ps4-ps5-game-resources.json',data=>{
  for(const f of legacy.filter(f=>legacyIds[f.name]&&!['LTS','Serendipity'].includes(f.name))){const entry=legacyResource(f);if(!data.resources.some(x=>x.id===entry.id))data.resources.push(entry);}
  for(const r of data.resources.filter(x=>x.gameIds.includes('gta5')&&x.category!=='source')){
   r.platforms=unique([...(r.platforms||[]),'ps4']);r.guideLabel='Guide & requirements';
   r.tags=unique([...(r.tags||[]),'PS4']);r.keywords=unique([...(r.keywords||[]),r.name,'PS4 GTA 5','Grand Theft Auto V',...(r.gameVersions||[])]);
   const rec=review.resources.find(x=>x.id===r.id)?.recommendations;
   if(rec?.archiveGameVersions?.length)r.gameVersions=unique([...(r.gameVersions||[]),...rec.archiveGameVersions]).sort();
   if(rec?.titleIds)r.titleIds=unique([...(r.titleIds||[]),...rec.titleIds]);
   if(rec?.controls?.length)for(const c of rec.controls){r.controls||=[];if(!r.controls.some(x=>x.input===c.input))r.controls.push({input:c.input,action:'Open the menu; documented by the inspected module text.'});}
   for(const block of reviewBlocks(r.id)){r.guideBlocks||=[];const i=r.guideBlocks.findIndex(x=>x.title===block.title);if(i<0)r.guideBlocks.push(block);else r.guideBlocks[i]=block;}
   const image=images[r.id];if(image?.image)r.images=[{original:image.image,display:image.image,caption:image.caption}];
   if(r.id==='gta5-oxagon-1-56'){r.name='Oxagon Full v1.0';r.menuVersion='Full v1.0';r.version='Menu Full v1.0 · GTA V 1.53 / 1.56';r.compatibilityText='PS4 · separate GTA V 1.53 / 1.56 modules; see the README title-ID examples.';}
   if(r.id==='gta5-scorpion-v1-2b'){r.menuVersion='v1.2b';r.version='Menu v1.2b · GTA V 1.00 / 1.38 / 1.43 / 1.46 / 1.48 / 1.49 / 1.50';r.compatibilityText='PS4 · separate archive-labelled modules for GTA V '+r.gameVersions.join(', ')+'. Keep the Scorpion data folder.';}
   if(r.id==='gta5-beach-legacy')r.compatibilityText='PS4 · source-labelled GTA V '+r.gameVersions.join(', ')+'. Choose each download by its own game update and menu release.';
   if(r.id==='gta5-cyprus')r.menuVersion='Lite (numeric release unspecified)';
   if(r.id==='gta5-lotus-1-27')r.menuVersion='1.03 (filename)';
   if(r.id==='gta5-velora-1-57')r.menuVersion='1.4';
   if(r.id==='gta5-beta-rebranded')r.guideBlocks[0]=p('Captured beta label','The captured post supplies a PS4 beta package without a GTA V update pin. File inspection identifies VOID_Beta_419.prx and the CUSA00419 example below.');
   // Previously generic buttons now describe the format and exact game pin.
   for(const d of r.downloads||[])if(d.label==='Download'){
    const full=/scorpion|serendipity|expulsion|ozark|oxagon|velora-1-57|beta-rebranded/.test(r.id);
    d.label=(full?'Full package':'Menu file')+(r.gameVersions?.length===1?' · GTA V '+r.gameVersions[0]:'');
   }
  }
  for(const f of jobs.filter(f=>f.downloadId)){
   const r=data.resources.find(r=>r.id===f.resourceId);if(!r)throw Error('Resource missing: '+f.resourceId);
   if(!r.downloads.some(d=>d.id===f.downloadId))r.downloads.push({id:f.downloadId,
    label:f.memberPath?'GTA V '+f.gameVersion+' · module only':f.name==='Seren.prx'?'Seren.prx · plugin only':f.name==='LRS.prx'?'LRS.prx · GTA V 1.57':'Download',
    filename:f.name,url:f.memberPath?'https://whatwhatboy.com'+f.local:f.sourceUrl,distribution:'include'});
  }
 });
 mergeJson('downloads/ps4-ps5/manifest.json',data=>{
  for(const f of jobs.filter(f=>f.downloadId)){
   const row={name:f.name,downloadId:f.downloadId,bytes:f.bytes,sha256:f.sha256,local:f.local,source:f.sourceUrl,sourceUrl:f.sourceUrl,
    status:'downloaded',version:f.version,platform:'PS4',gameVersion:f.gameVersion,archiveRole:['Builds'],archived:true,
    ...(f.memberPath?{memberPath:f.memberPath,derivedFrom:f.derivedFrom}:{})};
   const old=data.files.find(x=>x.downloadId===row.downloadId);
   if(old&&old.sha256!==row.sha256)throw Error('Preserve prior different download: '+row.downloadId);
   if(!old)data.files.push(row);
  }
 });
 mergeJson('docs/seo/search-editorial-overrides.json',data=>{
  const page='console/mods/ps4/gta5/index.html',old=data[page]||{};
  data[page]={...old,keywords:unique([...(old.keywords||[]),'PS4 GTA V mod menus','GTA 5 PS4 downloads','Ozark','Crystalis','Serendipity','Cyprus Lite','Scorpion v1.2b','Oxagon Full v1.0','Oxagon Lite v1.4','Expulsion 7.0','Expulsion V5.0','Velora 1.4','Velora 1.5','LTS','LRS','Beach','Explosive','WildeModz','Lotus','CSC scripts','GTA V 1.53','GTA V 1.56','GTA V 1.57','GoldHEN plugins'] )};
 });
 const data=read('docs/ps4-ps5-game-resources.json'),items=data.resources.filter(x=>x.gameIds.includes('gta5')&&x.category!=='source');
 const result={updatedAt:new Date().toISOString(),sourceMode:'Captured posts and exact existing files; user chose captured posts instead of a live Discord check.',
  resources:items.length,newCatalogueEntries:items.filter(x=>!read('docs/qa/ps4-gta5-review-baseline.json').resources.some(y=>x.id===y.id)).map(x=>x.id),
  detailedGuides:items.filter(x=>x.guideBlocks?.length).length,addedExtractedVariants:jobs.filter(x=>x.memberPath).length,
  verifiedArchiveFiles:saved.files.length,ozarkImage:'/assets/images/ps4-gta5/ozark-user-preview-2026-11-02.png',
  limitations:['Beta has no verified preview.','Oxagon Lite README requires a key absent from its ZIP.','No console execution or physical compatibility tests.'],noPayloadExecution:true};
 write('docs/qa/ps4-gta5-review-result.json',result);return result;
}
if(require.main===module)(async()=>{const flag=process.argv[2];const result=flag==='--prepare'?{files:prepare().length}:flag==='--archive'?await archive():flag==='--integrate'?integrate():null;if(!result)throw Error('Use --prepare, --archive or --integrate');console.log(JSON.stringify(result,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={prepare,archive,integrate,legacyResource,reviewBlocks};
