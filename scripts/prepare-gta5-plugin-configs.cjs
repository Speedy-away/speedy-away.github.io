// Author one-menu PS4 configurations; never run or modify the preserved plugins.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),scope='gta5-plugin-configs',revision='2026-11-02.2';
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const regions=[{id:'CUSA00411',name:'Europe',short:'EU'},{id:'CUSA00419',name:'USA',short:'USA'}];
const docsUrl='https://github.com/GoldHEN/GoldHEN_Plugins_Repository#quick-start';
function preserve(local,bytes){const target=path.join(root,'.'+local);if(fs.existsSync(target)){if(sha(fs.readFileSync(target))!==sha(bytes))throw Error('Refusing to replace different bytes: '+local);}else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});}}
function preserveInputExamples(){
 const file='docs/qa/gta5-plugin-config-inputs.json',report=read(file);
 const inputFiles=report.inputFiles.map(input=>{
  const bytes=Buffer.from(input.text,'utf8');
  if(bytes.length!==input.bytes||sha(bytes)!==input.sha256)throw Error('Captured input example differs from its original identity: '+input.file);
  const snapshot='scripts/tests/fixtures/gta5-plugin-inputs/'+input.sha256+'/plugins.ini';
  preserve('/'+snapshot,bytes);
  return {...input,snapshot};
 });
 fs.writeFileSync(path.join(root,file),JSON.stringify({...report,inputFiles,notes:'Exact original input captures retained with their original paths, byte counts and SHA-256. Tests and regeneration use immutable repository snapshots; live Desktop/Downloads files are not required or modified. Blank directory-only lines are omitted from generated one-menu configurations.'},null,2)+'\n');
 return inputFiles;
}
function ini({resource,gameVersion,module,region,confirmed,dependencies=[]}){
 if(!/^[^/\\\r\n]+\.(?:prx|sprx)$/i.test(module)||!regions.some(r=>r.id===region.id))throw Error('Invalid plugin configuration');
 const clean=s=>String(s).replace(/[\r\n]/g,' ');
 for(const d of dependencies)if(!/^[^/\\\r\n]+\.(?:prx|sprx)$/i.test(d.name)||d.gameVersion!==gameVersion)throw Error('Dependency must match the selected game update');
 return '; '+clean(resource.name)+'\r\n; GTA V update: '+clean(gameVersion||'not specified by source')+'\r\n; '+region.name+' / '+region.id+'\r\n; '+(confirmed?'This title-ID entry is documented in the supplied source; console behavior is untested.':'Configuration template only: the supplied source does not confirm this regional build.')+'\r\n; Merge this section into /data/GoldHEN/plugins.ini; preserve unrelated entries.\r\n; Enable one menu at a time.'+(dependencies.length?' Keep its required GTA Reborn client enabled.\r\n; Register in GTA Reborn Discord and obtain your own /data/Reborn.txt. Live announcement: 1.57 only.':'')+'\r\n['+region.id+']\r\n'+dependencies.map(d=>'/data/GoldHEN/plugins/'+d.name+'\r\n').join('')+'/data/GoldHEN/plugins/'+module+'\r\n';
}
function known(resource,gameVersion,region){
 if(/^gta5-expulsion-v[57]-/.test(resource.id))return true;
 if(resource.id==='gta5-scorpion-v1-2b')return true;
 if(resource.id==='gta5-oxagon-1-56'||resource.id==='gta5-oxagon-lite-v1-4')return (gameVersion==='1.53'&&region.id==='CUSA00419')||(gameVersion==='1.56'&&region.id==='CUSA00411');
 return (resource.titleIds||[]).includes(region.id);
}
function prepare(){
 preserveInputExamples();
 const data=read('docs/ps4-ps5-game-resources.json'),manifest=read('downloads/ps4-ps5/manifest.json').files;
 const reviewed=read('docs/qa/ps4-gta5-menu-archive-review.json'),legacy=read('downloads/ps4/GTA5/manifest.json').files;
 const resources=data.resources.filter(x=>x.gameIds.includes('gta5')&&['menu','client'].includes(x.category)),downloads=[],jobs=[],excluded=[];
 for(const resource of resources)for(const download of resource.downloads.filter(x=>x.distribution==='include')){
  let saved=manifest.find(f=>f.downloadId===download.id&&f.status==='downloaded');
  if(!saved){excluded.push({resourceId:resource.id,downloadId:download.id,reason:'No verified ready file available.'});continue;}
  const audit=reviewed.resources.find(x=>x.id===resource.id)?.files.find(f=>f.sha256===saved.sha256);
  let local=saved.local;
  if(!local&&resource.id==='gta5-beta-rebranded'&&audit?.backupPath){
   const bytes=fs.readFileSync(audit.backupPath);if(sha(bytes)!==saved.sha256)throw Error('Beta archive identity differs');
   local='/downloads/ps4/GTA5/plugin-configs/originals/'+saved.sha256.slice(0,12)+'/'+saved.name;preserve(local,bytes);
   jobs.push({...saved,local,name:saved.name,sourceUrl:saved.sourceUrl||saved.source||audit.sourceUrl,resourceId:resource.id,project:resource.name,version:'Original beta archive - '+saved.sha256.slice(0,12),isOriginal:true});
  }
  if(!local||!fs.existsSync(path.join(root,'.'+local))){excluded.push({resourceId:resource.id,downloadId:download.id,reason:'Ready file is not locally hosted.'});continue;}
  const bytes=fs.readFileSync(path.join(root,'.'+local));if(sha(bytes)!==saved.sha256||bytes.length!==saved.bytes)throw Error('Original file identity differs: '+local);
  let modules=/\.(?:prx|sprx)$/i.test(saved.name)?[saved.name]:[];
  if(/\.(?:zip|rar|7z)$/i.test(saved.name)){
   const inspection=require('./audit-console-ready-files.cjs').inspectArchive(path.join(root,'.'+local));
   const selected=inspection.entries.filter(e=>!e.directory&&/\.(?:prx|sprx)$/i.test(e.path)&&(!download.pluginMembers||download.pluginMembers.includes(e.path)));
   if(download.pluginMembers&&selected.length!==download.pluginMembers.length)throw Error('Missing selected plugin member: '+download.id);
   modules=selected.map(e=>path.posix.basename(e.path));
  }
  modules=[...new Set(modules)];
  if(!modules.length){excluded.push({resourceId:resource.id,downloadId:download.id,reason:'BIN, settings or script file; no PRX/SPRX to configure.'});continue;}
  const variants=[];
  for(const module of modules){
   if(resource.id==='gta5-scorpion-v1-2b'&&/100US\.prx$/.test(module))continue;
   const scorpion=module.match(/ScorpionMenu-v1\.2b-(\d{3})/),oxagon=module.match(/Oxagon(?:Lite)?_(\d{3})/);
   const gameVersion=scorpion?'1.'+scorpion[1].slice(1):oxagon?'1.'+oxagon[1].slice(1):download.label.match(/\b1\.\d{2}\b/)?.[0]||(resource.gameVersions.length===1?resource.gameVersions[0]:null);
   const dependencies=(resource.requiredResources||[]).filter(r=>r.moduleDownloadId).map(r=>{
    const f=manifest.find(f=>f.downloadId===r.moduleDownloadId&&f.status==='downloaded');
    if(!f?.local||f.gameVersion!==gameVersion||r.gameVersion!==gameVersion)throw Error('Missing matching dependency: '+resource.id);
    const b=fs.readFileSync(path.join(root,'.'+f.local));if(sha(b)!==f.sha256)throw Error('Dependency identity differs');
    return {name:f.name,url:f.local,bytes:f.bytes,sha256:f.sha256,gameVersion:f.gameVersion,sourceUrl:f.sourceUrl||f.source,installPath:'data/GoldHEN/plugins/'+f.name};
   });
   const key=slug(module),configs={};
   for(const region of regions){
    const selectedModule=scorpion?.[1]==='100'?module.replace(/100EU/,region.short==='EU'?'100EU':'100US'):module;
    const confirmed=known(resource,gameVersion,region),text=ini({resource,gameVersion,module:selectedModule,region,confirmed,dependencies}),buffer=Buffer.from(text),hash=sha(buffer);
    const configLocal='/downloads/ps4/GTA5/plugin-configs/'+download.id+'/'+key+'/'+region.id+'/'+hash.slice(0,12)+'/plugins.ini';
    preserve(configLocal,buffer);
    const file={name:'plugins.ini',local:configLocal,bytes:buffer.length,sha256:hash,sourceUrl:'https://whatwhatboy.com'+configLocal,
     upstreamSource:download.url,documentation:docsUrl,resourceId:resource.id,downloadId:download.id,project:resource.name,
     module:selectedModule,modules:[...dependencies.map(d=>d.name),selectedModule],titleId:region.id,gameVersion,sourceExample:confirmed,version:revision+' - '+resource.id+' - '+key+' - '+region.id};
    jobs.push(file);configs[region.id]={url:configLocal,sha256:hash,module:selectedModule,modules:file.modules,sourceExample:confirmed};
   }
   variants.push({key,module,gameVersion,label:(gameVersion?'GTA V '+gameVersion+' · ':'')+module,configs,dependencies});
  }
  downloads.push({resourceId:resource.id,downloadId:download.id,label:download.label,name:saved.name,url:local,sha256:saved.sha256,bytes:saved.bytes,
   sourceUrl:download.url,kind:/\.(?:prx|sprx)$/i.test(saved.name)?'plugin':'package',variants});
 }
 // Both original download lists refer to identical bytes under different paths.
 for(const file of downloads)file.aliases=legacy.filter(x=>x.sha256===file.sha256).map(x=>x.local);
 const output={schemaVersion:1,revision,regions,documentation:docsUrl,downloads,excluded};
 const dir=path.join(root,'downloads/ps4/GTA5/plugin-configs');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(output,null,2)+'\n');
 fs.writeFileSync(path.join(root,'docs/qa/gta5-plugin-config-jobs.json'),JSON.stringify({scope,revision,files:jobs},null,2)+'\n');
 return {downloads:downloads.length,configurations:jobs.filter(x=>!x.isOriginal).length,pluginResources:new Set(downloads.map(x=>x.resourceId)).size};
}
async function archive(){
 const intake=require('./console-expansion-archive.cjs').createArchive(),{destinationForFile}=require('./download-archive-layout.cjs');
 const {contained}=require('./console-expansion-archive.cjs');
 const jobs=read('docs/qa/gta5-plugin-config-jobs.json').files,items=new Map(),records=[];
 for(const f of jobs){
  const itemId=scope+'-'+f.resourceId,item=items.get(itemId)||{id:itemId,title:f.project+' plugin configurations',project:f.project,url:f.upstreamSource||f.sourceUrl,platform:'PS4',category:['Games','GTA5','Configurations'],pages:['console/mods/ps4/gta5/index.html'],publication:'include',files:[]};
  const source=path.join(root,'.'+f.local),b=fs.readFileSync(source);if(sha(b)!==f.sha256||b.length!==f.bytes)throw Error('Prepared file changed');
  const metadata={...f,status:'downloaded',archiveRole:['Builds'],releaseTag:f.version,archivedAt:new Date().toISOString()};
  let target=destinationForFile(intake.backupRoot,item,metadata);contained(intake.backupRoot,target);
  if(fs.existsSync(target)&&sha(fs.readFileSync(target))!==f.sha256){target=path.join(path.dirname(target),path.basename(target,path.extname(target))+'-'+f.sha256.slice(0,12)+path.extname(target));contained(intake.backupRoot,target);}
  fs.mkdirSync(path.dirname(target),{recursive:true});
  if(!fs.existsSync(target))fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);
  if(sha(fs.readFileSync(target))!==f.sha256)throw Error('Archive bytes differ');
  const file={...metadata,backupPath:target};item.files.push(file);items.set(itemId,item);records.push(file);
 }
 await intake.appendInventory({scope,items:[...items.values()]});
 fs.writeFileSync(path.join(root,'docs/qa/gta5-plugin-config-archive.json'),JSON.stringify({scope,files:records,allFilesVerified:true,noPayloadExecution:true},null,2)+'\n');
 console.log('Archived and verified '+records.length+' configuration/source files. Merging preserved inventories.');
 await intake.mergeInventory({inventory:intake.inventoryPath(scope),verifyFiles:false});return {files:records.length};
}
if(require.main===module)(async()=>{const flag=process.argv[2];console.log(JSON.stringify(flag==='--prepare'?prepare():flag==='--archive'?await archive():(()=>{throw Error('Use --prepare or --archive');})(),null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={prepare,archive,ini,known,regions,preserveInputExamples};
