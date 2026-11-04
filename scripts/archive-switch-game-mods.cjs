// Archive only the curated ready console files. Never execute mod/payload bytes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {once}=require('node:events');
const {spawnSync}=require('node:child_process');
const {destinationForFile,safeName}=require('./download-archive-layout.cjs');
const {inspectZip,isNro,safeMember,mergeReports}=require('./archive-switch-homebrew.cjs');
const root=path.resolve(__dirname,'..'),backup=path.resolve('F:/whatsite-backup-downloads-etc');
const publicManifest=path.join(root,'docs/switch-game-mods-downloads.json');
const auditPath=path.join(root,'docs/download-audit.json'),inventoryPath=path.join(backup,'download-inventory.json');
const read=(file,fallback)=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')):fallback;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const hosts=new Set(['github.com','raw.githubusercontent.com','release-assets.githubusercontent.com','objects.githubusercontent.com','github-releases.githubusercontent.com','drive.google.com','drive.usercontent.google.com']);
function contained(base,file){const absolute=path.resolve(file),rel=path.relative(path.resolve(base),absolute);if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Path escapes archive root');let ancestor=absolute;while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);if(fs.existsSync(base)){const realRel=path.relative(fs.realpathSync(base),fs.realpathSync(ancestor));if(realRel==='..'||realRel.startsWith('..'+path.sep)||path.isAbsolute(realRel))throw Error('Path resolves outside intended archive root');}return absolute;}
function atomic(base,file,value){contained(base,file);fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.switchmods-'+crypto.randomBytes(5).toString('hex')+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});fs.renameSync(tmp,file);}
function preserved(base,file,bytes){let target=contained(base,file);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target)){if(sha(fs.readFileSync(target))===sha(bytes))return target;const ext=path.extname(target);target=target.slice(0,-ext.length)+'-'+sha(bytes).slice(0,16)+ext;if(fs.existsSync(target)){if(sha(fs.readFileSync(target))===sha(bytes))return target;throw Error('Refusing to replace a different archived file');}}fs.writeFileSync(target,bytes,{flag:'wx'});return target;}
async function hashFile(file){const hash=crypto.createHash('sha256');for await(const bytes of fs.createReadStream(file))hash.update(bytes);return hash.digest('hex');}
function validate(job){if(!/^[a-z0-9-]+$/.test(job.id)||!job.version||!job.game)throw Error('Invalid curated job');const u=new URL(job.url);if(u.protocol!=='https:'||!hosts.has(u.hostname))throw Error('Unsupported official source');if(job.format==='ips'&&!/^https:\/\/raw\.githubusercontent\.com\/alyeri\/nextendo-mk8d-country-flags\/[a-f0-9]{40}\/.+\.ips$/.test(job.url))throw Error('IPS must be pinned to checked upstream revision');if(job.sha256&&!/^[a-f0-9]{64}$/.test(job.sha256))throw Error('Invalid captured SHA-256');}
async function request(url){for(let n=0;n<7;n++){const u=new URL(url);if(u.protocol!=='https:'||!hosts.has(u.hostname)||u.username||u.password||u.port)throw Error('Unsupported redirected source host');const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(60*60*1000),headers:{'User-Agent':'whatsite-switch-mods-archive/1.0'}});if([301,302,303,307,308].includes(r.status)){const to=r.headers.get('location');await r.body?.cancel();if(!to)throw Error('Missing redirect destination');url=new URL(to,url).href;continue;}if(!r.ok){await r.body?.cancel();throw Error('HTTP '+r.status+' at '+u.hostname);}return r;}throw Error('Too many redirects');}
async function responseFor(job){
 if(!job.driveId)return request(job.url);
 const url=new URL('https://drive.usercontent.google.com/download');url.searchParams.set('id',job.driveId);url.searchParams.set('export','download');
 const r=await request(url.href);if(!/text\/html/i.test(r.headers.get('content-type')||''))return r;
 const html=await r.text();if(html.length>200000)throw Error('Unexpected Google Drive response');
 const form=html.match(/<form\b[^>]*id="download-form"[\s\S]*?<\/form>/)?.[0];if(!form)throw Error('Publisher Drive file unavailable without authentication; no download form');
 const action=form.match(/action="([^"]+)"/)?.[1];if(action!=='https://drive.usercontent.google.com/download')throw Error('Unexpected Drive form destination');
 const confirmed=new URL(action);for(const input of form.matchAll(/<input\b[^>]*>/g)){const name=input[0].match(/name="([^"]+)"/)?.[1],value=input[0].match(/value="([^"]*)"/)?.[1];if(name&&['id','export','confirm','uuid'].includes(name))confirmed.searchParams.set(name,value||'');}
 if(confirmed.searchParams.get('id')!==job.driveId||confirmed.searchParams.get('export')!=='download')throw Error('Drive form did not preserve requested publisher file');
 // This is the publisher-linked large-file download confirmation, no login/cookie/CAPTCHA.
 return request(confirmed.href);
}
function saveInventory(item){const latest=mergeReports(read(inventoryPath,{items:[]}),read(auditPath,{items:[]}),{items:[item]});latest.updated=new Date().toISOString();latest.backupRoot=backup;atomic(root,auditPath,latest);const merged=mergeReports(latest,read(inventoryPath,{items:[]}),read(auditPath,{items:[]}),{items:[item]});atomic(backup,inventoryPath,merged);}
function largeZipMembers(file){const exe='C:/Program Files/7-Zip/7z.exe';if(!fs.existsSync(exe))return {inspection:'ZIP signature checked; 7-Zip unavailable for directory listing'};const result=spawnSync(exe,['l','-slt',file],{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:64*1024*1024});if(result.status!==0)throw Error('7-Zip could not list the downloaded container: '+String(result.stderr||result.error?.message||'').slice(0,300));const body=result.stdout.split('----------').slice(1).join('----------'),members=[];for(const block of body.split(/\r?\n\r?\n/)){const name=block.match(/^Path = (.+)$/m)?.[1]?.trim();if(!name)continue;if(!safeMember(name.replaceAll('\\','/')))throw Error('Unsafe member in large ZIP directory');members.push({path:name.replaceAll('\\','/'),bytes:Number(block.match(/^Size = (\d+)$/m)?.[1]||0),directory:/^Folder = \+$/m.test(block)});}if(!members.length)throw Error('Large ZIP had no listed files');return {inspection:'ZIP central directory listed with installed 7-Zip without extracting or executing the contents',members};}
async function archive(job,item){
 const old=item.files.find(file=>file.sourceUrl===job.url&&file.releaseTag===job.version&&file.backupPath&&fs.existsSync(contained(backup,file.backupPath)));
 if(old&&fs.statSync(old.backupPath).size===old.bytes&&await hashFile(old.backupPath)===old.sha256){const proof=read(publicManifest,{files:[]}).files.find(row=>row.id===job.id&&row.version===job.version&&row.file?.sha256===old.sha256);let inspected=proof?.inspection?{inspection:proof.inspection,members:proof.members}:job.large?largeZipMembers(old.backupPath):{};if(!inspected.inspection&&job.format==='zip'){const entries=inspectZip(fs.readFileSync(old.backupPath));inspected={inspection:'ZIP member paths, expanded sizes, CRC and NRO headers checked without execution',members:entries.map(({data,...entry})=>entry)};}return {file:old,reused:true,...inspected};}
 const response=await responseFor(job),type=response.headers.get('content-type')||'';if(/text\/html|application\/json/i.test(type)){await response.body?.cancel();throw Error('Publisher returned an HTML/JSON page instead of a console build');}
 const maximum=job.large?(job.maxBytes||5*1024**3):95*1024**2;if(Number(response.headers.get('content-length'))>maximum){await response.body?.cancel();throw Error('Download exceeds bounded size');}
 const file={name:safeName(job.name),releaseTag:job.version,version:job.version,sourceUrl:job.url,resolvedUrl:job.url,archivedAt:new Date().toISOString(),archiveRole:['Builds'],format:job.format};
 let data,memberEvidence;
 if(job.large){
  const destination=destinationForFile(backup,item,file);contained(backup,destination);fs.mkdirSync(path.dirname(destination),{recursive:true});
  const partial=contained(backup,destination+'.partial-'+crypto.randomBytes(5).toString('hex'));item.partialPath=partial;
  const stream=fs.createWriteStream(partial,{flags:'wx'}),hash=crypto.createHash('sha256');let count=0,first=Buffer.alloc(0);const streamDone=once(stream,'finish');
  try{for await(const chunk of response.body){count+=chunk.length;if(count>maximum)throw Error('Download exceeds bounded size');if(first.length<4)first=Buffer.concat([first,chunk]).subarray(0,4);hash.update(chunk);if(!stream.write(chunk))await once(stream,'drain');if(count%134217728<chunk.length)console.log('  '+job.id+': '+(count/1024**2).toFixed(0)+' MiB');}stream.end();await streamDone;}catch(error){stream.destroy();throw error;}
  if(first.readUInt32LE(0)!==0x04034b50)throw Error('Large publisher package is not ZIP');file.bytes=count;file.sha256=hash.digest('hex');
  if(job.bytes&&count!==job.bytes||job.sha256&&file.sha256!==job.sha256)throw Error('Large build differs from official release metadata');
  let target=destination;if(fs.existsSync(target)){const ext=path.extname(target);target=target.slice(0,-ext.length)+'-'+file.sha256.slice(0,16)+'-'+crypto.randomBytes(3).toString('hex')+ext;}fs.renameSync(partial,contained(backup,target));file.backupPath=target;delete item.partialPath;
  memberEvidence=largeZipMembers(target);
 }else{
  const chunks=[];let count=0;for await(const chunk of response.body){count+=chunk.length;if(count>maximum)throw Error('Download exceeds bounded size');chunks.push(chunk);}data=Buffer.concat(chunks);file.bytes=data.length;file.sha256=sha(data);
  if(job.bytes&&data.length!==job.bytes||job.sha256&&file.sha256!==job.sha256)throw Error('Build differs from checked official release metadata');
  if(job.format==='nro'&&!isNro(data))throw Error('Invalid Switch NRO header');
  if(job.format==='ips'&&!((data.subarray(0,5).toString()==='PATCH'&&data.subarray(-3).toString()==='EOF')||(data.subarray(0,5).toString()==='IPS32'&&data.subarray(-4).toString()==='EEOF')))throw Error('Invalid ready IPS patch');
  if(job.format==='zip'){const entries=inspectZip(data);memberEvidence={inspection:'ZIP member paths, expanded sizes, CRC and NRO headers checked without execution',members:entries.map(({data,...entry})=>entry)};}
  file.backupPath=preserved(backup,destinationForFile(backup,item,file),data);
  if(!job.privateOnly){const target=preserved(root,path.join(root,'downloads/nintendo-switch-mods',job.id,safeName(job.version),file.name),data);file.local='/'+path.relative(root,target).replaceAll('\\','/');}
 }
 item.files.push(file);return {file,...memberEvidence};
}
async function main(args=process.argv.slice(2)){
 const flags=new Set(args);if(args.some(a=>!['--check','--download','--large-only'].includes(a)&&!a.startsWith('--id=')))throw Error('Use --check or --download [--large-only] [--id=name]');
 const catalogue=read(path.join(root,'docs/switch-game-mods-jobs.json'),{});const legacyJobs=catalogue.jobs.filter(job=>!job.archiveScope);legacyJobs.forEach(validate);const requested=args.find(a=>a.startsWith('--id='))?.slice(5);const jobs=legacyJobs.filter(job=>!!job.large===flags.has('--large-only')&&(!requested||job.id===requested));if(!jobs.length)throw Error('No matching curated jobs');
 if(!flags.has('--download')){console.log('Validated '+jobs.length+' Switch mod jobs; no network or writes.');return;}
 if(!fs.existsSync(backup))throw Error('F archive unavailable');const history=fs.mkdtempSync(path.join(backup,'archive-history/switch-mods-'));for(const [file,name]of[[inventoryPath,'download-inventory.json'],[auditPath,'workspace-download-audit.json']])if(fs.existsSync(file))fs.copyFileSync(file,path.join(history,name),fs.constants.COPYFILE_EXCL);
 const manifest=read(publicManifest,{schemaVersion:1,files:[]});let failures=0;
 for(const job of jobs){console.log('Switch mod: '+job.title+' '+job.version);const all=mergeReports(read(inventoryPath,{items:[]}),read(auditPath,{items:[]}));const previous=all.items.find(item=>item.id==='switch-mods-'+job.id);const item={...previous,id:'switch-mods-'+job.id,title:job.title,url:job.project,project:job.title,platform:'Nintendo Switch',category:['Games',job.game,'Mods'],gameVersion:job.gameVersion,kind:'switch-game-mod',release:job.version,pages:['console/nintendo-switch/mods.html'],sourceUrls:[...new Set([...(previous?.sourceUrls||[]),job.project,job.url,job.releaseUrl].filter(Boolean))],files:previous?.files||[],attempts:previous?.attempts||[]};const attempt={at:new Date().toISOString(),sourceUrl:job.url,version:job.version};let record={id:job.id,title:job.title,version:job.version,source:job.url,privateOnly:!!job.privateOnly,game:job.game,gameVersion:job.gameVersion};
  try{const result=await archive(job,item);item.status='downloaded';delete item.error;Object.assign(attempt,{status:'downloaded',sha256:result.file.sha256,bytes:result.file.bytes});record={...record,status:'downloaded',file:{name:result.file.name,bytes:result.file.bytes,sha256:result.file.sha256,source:job.url,local:result.file.local,archived:true},inspection:result.inspection,members:result.members};console.log('  archived '+result.file.bytes+' bytes'+(result.file.local?'; public console file ready':'; private archive only'));}
  catch(error){failures++;item.status=item.files.length?'partial':'unavailable';item.error=error.message;Object.assign(attempt,{status:'unavailable',error:error.message});Object.assign(record,{status:'unavailable',error:error.message});console.error('  unavailable: '+error.message);}
  item.attempts.push(attempt);saveInventory(item);const index=manifest.files.findIndex(file=>file.id===job.id&&file.version===job.version);if(index<0)manifest.files.push(record);else manifest.files[index]={...manifest.files[index],...record};manifest.updated=new Date().toISOString();atomic(root,publicManifest,manifest);
 }
 console.log('Processed '+jobs.length+' Switch mod files; '+failures+' unavailable.');if(failures)process.exitCode=1;
}
module.exports={validate,main};if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});

