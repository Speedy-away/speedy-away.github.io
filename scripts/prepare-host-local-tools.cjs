'use strict';
// Pinned public files as data only. Does not run payloads, flash hardware or write F:.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {zip}=require('./package-console-payload-sender.cjs');
const {destinationForFile}=require('./download-archive-layout.cjs');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const TRAINER='56f7c588162d3d869f592d2adf3d78e5c20189ee',ESP='5.1.4';
const trainerBase='https://raw.githubusercontent.com/kmeps4/PS4OfflineTrainer/'+TRAINER+'/';
function preserve(relative,bytes){const file=path.join(root,relative);fs.mkdirSync(path.dirname(file),{recursive:true});if(fs.existsSync(file)){if(!fs.readFileSync(file).equals(bytes))throw Error('Different immutable local tool file: '+relative);}else fs.writeFileSync(file,bytes,{flag:'wx'});}
async function get(url,max=2*1024*1024){let last;for(let n=0;n<3;n++)try{const r=await fetch(url,{headers:{'User-Agent':'whatwhatboy-local-tools-review'},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('HTTP'+r.status+' '+url);const b=Buffer.from(await r.arrayBuffer());if(!b.length||b.length>max)throw Error('Source file outside byte bounds: '+url);return b;}catch(e){last=e;}throw last;}
async function fetchSources(){
  const tree=JSON.parse(await get('https://api.github.com/repos/kmeps4/PS4OfflineTrainer/git/trees/'+TRAINER+'?recursive=1'));
  if(tree.truncated||tree.sha!==TRAINER)throw Error('Unexpected trainer source tree');
  const files=tree.tree.filter(e=>e.type==='blob'&&(e.path==='LICENSE'||/^[A-Z0-9_.-]+\.json$/i.test(e.path)));
  const records=[],pending=files.slice();let count=0;
  async function worker(){while(pending.length){const item=pending.shift(),local=item.path==='LICENSE'?'hosts/tools/ps4-trainer/LICENSE.txt':'hosts/tools/ps4-trainer/data/'+TRAINER+'/'+item.path,cached=fs.existsSync(path.join(root,local))?fs.readFileSync(path.join(root,local)):null,blob=b=>crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex'),bytes=cached&&blob(cached)===item.sha?cached:await get(trainerBase+item.path);if(bytes.length!==item.size||blob(bytes)!==item.sha)throw Error('Trainer source bytes changed');let invalidJSON=false;if(/\.json$/.test(item.path))try{JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));}catch(_){invalidJSON=true;}preserve(local,bytes);records.push({path:local,upstreamPath:item.path,source:trainerBase+item.path,bytes:bytes.length,sha256:sha(bytes),...(invalidJSON?{invalidJSON:true}:{})});if(++count%100===0)console.log('Trainer definitions read: '+count+'/'+files.length);}}
  await Promise.all(Array.from({length:12},worker));
  const list=JSON.parse(fs.readFileSync(path.join(root,'hosts/tools/ps4-trainer/data',TRAINER,'list.json'))),seen=new Set(),games=[],unavailable=[],repairs=[];
  for(const item of list.games){if(seen.has(item.url))continue;seen.add(item.url);let source=item.url;if(!files.some(f=>f.path===source)&&source.startsWith('.games/')){const corrected=source.slice(7);if(files.some(f=>f.path===corrected)){source=corrected;repairs.push({original:item.url,local:source,reason:'Source index references missing .games/ directory; exact pinned root file is checked against title/version.'});}}
    if(!/^[A-Z0-9_.-]+\.json$/i.test(source)||!files.some(f=>f.path===source)){unavailable.push({...item,reason:'Pinned index target is unavailable.'});continue;}
    let d;try{d=JSON.parse(fs.readFileSync(path.join(root,'hosts/tools/ps4-trainer/data',TRAINER,source),'utf8').replace(/^\uFEFF/,''));}catch(_){unavailable.push({...item,reason:'Pinned source filename does not contain valid JSON.'});continue;}
    if(d.id!==item.title||!/^0*\d{1,2}\.\d{1,2}$/.test(d.version)||!require('../assets/host-trainer.js').sameVersion(d.version,item.version)||!Array.isArray(d.mods)){unavailable.push({...item,reason:'Pinned definition identity/version differs from index or its schema is invalid.'});continue;}
    games.push({name:item.name,title:item.title,version:item.version,definitionVersion:d.version,file:TRAINER+'/'+source,source:trainerBase+source,bytes:records.find(r=>r.upstreamPath===source).bytes,sha256:records.find(r=>r.upstreamPath===source).sha256});
  }
  games.sort((a,b)=>a.name.localeCompare(b.name)||a.title.localeCompare(b.title)||a.version.localeCompare(b.version));
  fs.writeFileSync(path.join(root,'hosts/tools/ps4-trainer/catalog.json'),JSON.stringify({schemaVersion:1,source:'https://github.com/kmeps4/PS4OfflineTrainer',commit:TRAINER,license:'GPL-3.0',games,unavailable,repairs},null,2)+'\n');
  fs.writeFileSync(path.join(root,'hosts/tools/ps4-trainer/source-manifest.json'),JSON.stringify({schemaVersion:1,source:'https://github.com/kmeps4/PS4OfflineTrainer',commit:TRAINER,license:'GPL-3.0',records:records.sort((a,b)=>a.path.localeCompare(b.path)),scope:'Pinned trainer JSON data and GPL license only. Original source code available at the pinned upstream URL. No images or upstream executable UI are used.'},null,2)+'\n');
  const meta=JSON.parse(await get('https://unpkg.com/esp-web-flasher@'+ESP+'/?meta'));
  const espRecords=[];
  for(const item of meta.files.filter(e=>/^\/dist\/web\/[^/]+\.js$/.test(e.path)||e.path==='/license.md')){const bytes=await get('https://unpkg.com/esp-web-flasher@'+ESP+item.path);if(bytes.length!==item.size)throw Error('ESP library size mismatch');const digest='sha256-'+crypto.createHash('sha256').update(bytes).digest('base64');if(item.integrity&&digest!==item.integrity)throw Error('ESP registry integrity mismatch');const local='hosts/tools/esp-flasher/vendor/esp-web-flasher-'+ESP+'/'+path.basename(item.path);preserve(local,bytes);espRecords.push({path:local,source:'https://unpkg.com/esp-web-flasher@'+ESP+item.path,bytes:bytes.length,sha256:sha(bytes),registryIntegrity:item.integrity});}
  if(espRecords.filter(r=>r.path.endsWith('.js')).length!==6||!espRecords.some(r=>r.path.endsWith('/license.md')))throw Error('Incomplete ESP browser dependency set');
  for(const record of espRecords.filter(r=>r.path.endsWith('.js'))){const js=fs.readFileSync(path.join(root,record.path),'utf8');for(const match of js.matchAll(/import\(['"]([^'"]+)['"]\)/g)){const target=path.posix.normalize(path.posix.join(path.posix.dirname(record.path),match[1]));if(!espRecords.some(r=>r.path===target))throw Error('Unresolved ESP browser dependency '+match[1]);}if(/https?:\/\//.test(js.replace(/\/\*[\s\S]*?\*\//g,'')))throw Error('Unexpected remote runtime dependency');}
  fs.writeFileSync(path.join(root,'hosts/tools/esp-flasher/source-manifest.json'),JSON.stringify({schemaVersion:1,source:'https://github.com/nabucasa/ESP-Web-flasher',version:ESP,license:'MIT',records:espRecords},null,2)+'\n');
  return{trainer:{files:records.length,games:games.length,unavailable,repairs},esp:{files:espRecords.length}};
}
function packageTools(){
  const trainerEntry=fs.readFileSync(path.join(root,'hosts/tools/ps4-trainer/index.html'),'utf8');
  if(!trainerEntry.includes('id="host-trainer"'))throw Error('This checkout redirects hosts to WWB-HOST. Build local tool packages in the independent host repository, preserving the main-site redirect.');
  require('./build-host-trainer-art.cjs').build();
  const previous=fs.existsSync(path.join(root,'docs/host-local-tools-build.json'))?JSON.parse(fs.readFileSync(path.join(root,'docs/host-local-tools-build.json'))):null,artifacts=[],jobs=[];
  for(const scope of ['ps4-trainer','esp-flasher']){
    const base='hosts/tools/'+scope,files=new Map();
    // These authored site entry points use the shared backdrop. Keep the ZIP's
    // local dependencies complete without touching vendor code or older ZIPs.
    const entry=base+'/index.html',entryPath=path.join(root,entry),before=fs.readFileSync(entryPath,'utf8');
    const after=require('./apply-site-background.cjs').improve(before,entry);
    if(after!==before)fs.writeFileSync(entryPath,after);
    function walk(relative){for(const item of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){if(item.name==='downloads.json')continue;const name=relative+'/'+item.name;if(item.isDirectory())walk(name);else files.set(name,fs.readFileSync(path.join(root,name)));}}
    walk(base);for(const asset of ['assets/host-trainer.css','assets/host-webhost.css','assets/site-ads.css','assets/site-ads.js','assets/site-background.css','assets/site-background.js',...(scope==='ps4-trainer'?['assets/host-trainer.js']:['assets/host-esp-flasher.js'])])files.set(asset,fs.readFileSync(path.join(root,asset)));
    if(scope==='ps4-trainer')for(const record of Object.values(JSON.parse(fs.readFileSync(path.join(root,base,'tile-art.json'),'utf8')).covers)){const asset=record.image.replace(/^\//,'');files.set(asset,fs.readFileSync(path.join(root,asset)));}
    for(const name of fs.readdirSync(path.join(root,'languages')).filter(name=>/^(?:i18n|[a-z-]+)\.js$/.test(name)))files.set('languages/'+name,fs.readFileSync(path.join(root,'languages',name))); 
    files.set('README.md',Buffer.from('# '+scope+' web tool\n\nServe this folder as the web root using a static HTTP server, then open /'+base+'/. HTTPS or localhost is required for Web Serial. Do not open index.html through file://. No application contacts a console or serial device merely by opening. Trainer requires a compatible already-running WebRTE on PS4 HTTP771 and the exact game/title/update. All firmware-dependent services are separate. Flasher requires your own compatible ESP hardware and user-selected BINs/offsets. Original licenses and hash manifests are included. The existing site advertising provider requires Internet; ads are optional to the local tool operation and cannot make a hardware or console request by themselves.\n'));
    const manifest=[...files].map(([name,b])=>({name,bytes:b.length,sha256:sha(b)})).sort((a,b)=>a.name.localeCompare(b.name)),snapshot=sha(Buffer.from(JSON.stringify(manifest))),bytes=zip(files,{prefix:'whatwhatboy-local-tools/'}),hash=sha(bytes),filename=scope+'-'+snapshot.slice(0,16)+'.zip',relative='downloads/helpers/host-local-tools/'+scope+'/'+filename;
    preserve(relative,bytes);const version='2026.11.03.1+'+snapshot.slice(0,16),platform=scope==='ps4-trainer'?'PS4':'PC';
    const job={id:'whatsite-'+scope+'-'+snapshot.slice(0,16),title:'whatwhatboy '+(scope==='ps4-trainer'?'PS4 local WebRTE trainer':'local ESP Web Flasher'),platform,category:'Tools',project:'whatsite Local Host Tools',version,release:version,filename,url:(fs.existsSync(path.join(root,'docs/migration/status.json'))?'https://raw.githubusercontent.com/Speedy-away/speedy-away.github.io/main/':'https://whatwhatboy.com/')+relative,importPath:relative,kind:'generated',archiveRole:['Helpers'],mirror:false,pages:[base+'/index.html'],expectedBytes:bytes.length,expectedSha256:hash};
    const artifact={scope,version,local:'/'+relative,bytes:bytes.length,sha256:hash,files:files.size,manifest,expectedArchivePath:destinationForFile('F:/whatsite-backup-downloads-etc',job,{name:filename,version,archiveRole:['Helpers']})};artifacts.push(artifact);jobs.push(job);fs.writeFileSync(path.join(root,base,'downloads.json'),JSON.stringify({version,download:'/'+relative,bytes:bytes.length,sha256:hash},null,2)+'\n');
  }
  const retainedArtifacts=[...(previous?.artifacts||[]),...(previous?.retainedArtifacts||[])].filter((item,index,all)=>!artifacts.some(current=>current.sha256===item.sha256)&&all.findIndex(other=>other.sha256===item.sha256)===index);
  const retainedJobs=[...(previous?.jobs||[])].filter((item,index,all)=>!jobs.some(current=>current.expectedSha256===item.expectedSha256)&&all.findIndex(other=>other.expectedSha256===item.expectedSha256)===index);
  jobs.push(...retainedJobs);
  const report={schemaVersion:1,retainedArtifacts,preparedAt:new Date().toISOString(),status:'Prepared locally; archive import and root integration remain required. No console or hardware execution.',artifacts,jobs};fs.writeFileSync(path.join(root,'docs/host-local-tools-build.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(root,'docs/host-local-tools-jobs.json'),JSON.stringify({jobs},null,2)+'\n');return report;
}
function writeTrainerPage(){const entry='hosts/tools/ps4-trainer/index.html',before=fs.readFileSync(path.join(root,entry),'utf8');if(!before.includes('id="host-trainer"'))throw Error('Preserve the main-site redirect; write trainer UI in WWB-HOST.');fs.writeFileSync(path.join(root,entry),fs.readFileSync(path.join(root,'scripts/templates/host-trainer.html')));}
async function main(){if(process.argv.includes('--trainer-ui'))writeTrainerPage();if(process.argv.includes('--artwork'))console.log(JSON.stringify(require('./build-host-trainer-art.cjs').build()));if(process.argv.includes('--fetch'))console.log(JSON.stringify(await fetchSources()));if(process.argv.includes('--package'))console.log(JSON.stringify(packageTools().artifacts.map(a=>({scope:a.scope,local:a.local,bytes:a.bytes,sha256:a.sha256}))));}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={TRAINER,ESP,fetchSources,packageTools,writeTrainerPage};
