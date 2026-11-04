'use strict';
// Targeted original web-host closure only. Downloads are never executed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),REPO='GamerHack/GamerHack.github.io',COMMIT='23c946a7f85f1338ea2b78163e72e0ce9bc82b68';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),blob=b=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const DEFINITIONS=[{folder:'505',id:'gamerhack-505',firmware:'5.05',cacheReopen:false},{folder:'672goldhen',id:'gamerhack-672goldhen',firmware:'6.72',cacheReopen:true}];
function preserve(root,name,bytes){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});if(fs.existsSync(file)){if(!fs.readFileSync(file).equals(bytes))throw Error('Different preserved bytes at '+name);}else fs.writeFileSync(file,bytes,{flag:'wx'});}
function plan(review){if(review.commit!==COMMIT||review.repository!==REPO)throw Error('GamerHack source pin changed.');return DEFINITIONS.flatMap(d=>{const folder=review.folders.find(f=>f.folder===d.folder);if(!folder||folder.files.length>50)throw Error('Missing targeted folder metadata.');return folder.files.map(f=>{if(f.type!=='file'||!/^[a-z0-9._-]+$/i.test(f.name)||f.bytes<0||f.bytes>32*1024*1024||!/^[a-f0-9]{40}$/.test(f.gitBlobSHA1))throw Error('Unexpected source metadata.');return {path:d.folder+'/'+f.name,bytes:f.bytes,gitBlobSHA1:f.gitBlobSHA1,url:'https://raw.githubusercontent.com/'+REPO+'/'+COMMIT+'/'+d.folder+'/'+f.name};});});}
async function response(url){const r=await fetch(url,{headers:{'User-Agent':'WWB-HOST-targeted-source-preservation'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Source HTTP '+r.status+' '+url);return r;}
function references(file,bytes){
 const text=bytes.toString('utf8'),refs=[];
 if(/\.html$/.test(file))for(const m of text.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)=["']([^"']+)["']/gi))refs.push(m[1]);
 if(/\.(?:manifest|cache)$/.test(file)){let section='CACHE';for(const raw of text.split(/\r?\n/)){const s=raw.trim();if(!s||s.startsWith('#')||s==='CACHE MANIFEST')continue;if(/^(CACHE|NETWORK|FALLBACK):$/.test(s)){section=s.slice(0,-1);continue;}if(section==='CACHE')refs.push(s.split(/\s+/)[0]);}}
 return refs.filter(r=>r&&!r.startsWith('#')&&!/^[a-z]+:|^\/\//i.test(r)).map(r=>path.posix.normalize(path.posix.join(path.posix.dirname(file),r.split(/[?#]/)[0])));
}
async function capture(root,review){
 const planned=plan(review),sourceBase='tmp/gamerhack-original-'+COMMIT,records=[];
 async function one(item){let bytes,file=path.join(root,sourceBase,item.path);if(fs.existsSync(file))bytes=fs.readFileSync(file);else bytes=Buffer.from(await response(item.url).then(r=>r.arrayBuffer()));if(bytes.length!==item.bytes||blob(bytes)!==item.gitBlobSHA1)throw Error('Original Git identity mismatch '+item.path);preserve(root,sourceBase+'/'+item.path,bytes);return {...item,sha256:sha(bytes),importPath:sourceBase+'/'+item.path};}
 for(let at=0;at<planned.length;at+=4){const batch=await Promise.allSettled(planned.slice(at,at+4).map(one));for(const result of batch){if(result.status==='rejected')throw result.reason;records.push(result.value);}}
 const known=new Set(records.map(r=>r.path));let shared=0;
 // Only actual original HTML/cache references may add shared root resources.
 for(let i=0;i<records.length;i++)if(/\.(?:html|manifest|cache)$/.test(records[i].path))for(const ref of references(records[i].path,fs.readFileSync(path.join(root,records[i].importPath)))){
  if(known.has(ref))continue;if(!/^(?:style\.css|img\.jpg|btc\.jpg|eth\.jpg)$/.test(ref))throw Error('Unclosed original dependency '+ref);if(++shared>4)throw Error('Unexpected shared dependency count');
  const metadata=await response('https://api.github.com/repos/'+REPO+'/contents/'+ref+'?ref='+COMMIT).then(r=>r.json());const item={path:ref,bytes:metadata.size,gitBlobSHA1:metadata.sha,url:'https://raw.githubusercontent.com/'+REPO+'/'+COMMIT+'/'+ref};records.push(await one(item));known.add(ref);
 }
 return {sourceBase,records};
}
function wrap(original,entry,relative,base,resources,controller,resourceGuard){
 const config=JSON.stringify({path:relative,entry,original:original.toString('utf8'),resources:{files:resources,invalid:[]},resourceGuard}).replaceAll('<','\\u003c');
 return Buffer.from('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Original GamerHack local loader</title></head><body><p id="karo-blocked">Checking the local loader entry…</p><p><a href="'+base+'">Back</a></p><script>'+controller.replace(/<\/script/gi,'<\\/script')+'\nvar config='+config+';config.base=location.pathname.slice(0,-config.path.length);config.resources.base=config.base;try{WhatsiteKaro.openOriginal(window,config);}catch(error){document.getElementById("karo-blocked").textContent=error.message;}</script></body></html>\n');
}
function packageCapture(root,captured){
 const manifest=captured.records.slice().sort((a,b)=>a.path.localeCompare(b.path)),setHash=sha(JSON.stringify(manifest.map(r=>({path:r.path,sha256:r.sha256,bytes:r.bytes})))),base='hosts/runtime/gamerhack-'+COMMIT.slice(0,12)+'-'+setHash.slice(0,12),runtime='/'+base+'/web/';
 const controller=fs.readFileSync(path.join(root,'assets/host-karo-builds.js'),'utf8'),resourceGuard=fs.readFileSync(path.join(root,'assets/host-karo-resource-guard.js'),'utf8');
 const entries=DEFINITIONS.map(d=>({id:d.id,path:d.folder+'/index.html',scope:d.folder+'/',platform:'ps4',kind:'loader',label:'GamerHack '+d.firmware,firmwares:[d.firmware],contract:'Preserved original GamerHack browser entry and native dependency closure; GoldHEN loading belongs to this exact original chain.'}));
 const files=new Map(),resources=manifest.map(r=>r.path),native=[];
 for(const record of manifest){const bytes=fs.readFileSync(path.join(root,record.importPath)),definition=DEFINITIONS.find(d=>record.path.startsWith(d.folder+'/')),entry=definition&&entries.find(e=>e.id===definition.id);preserve(root,base+'/upstream/'+record.path,bytes);const deployed=/\.html$/.test(record.path)&&entry?wrap(bytes,entry,record.path,'/hosts/ps4/exploit/'+entry.id+'/',resources,controller,resourceGuard):bytes;preserve(root,base+'/web/'+record.path,deployed);files.set(base+'/web/'+record.path,deployed);if(/\.(?:js|bin)$/.test(record.path))native.push({path:record.path,bytes:bytes.length,sha256:sha(bytes),unchanged:deployed.equals(bytes)});}
 const builder=require('./host-local-launchers.cjs'),pages=[],jobs=[];
 for(const entry of entries){const definition=DEFINITIONS.find(d=>d.id===entry.id),route={id:entry.id,label:'PS4 WebKit Exploit - '+definition.firmware,platform:'ps4',firmwares:entry.firmwares.slice(),entry:'/hosts/ps4/exploit/'+entry.id+'/',runtime,runtimeEntry:runtime+entry.path,originalEntry:entry,payloadChoice:[{id:'goldhen',label:'GoldHEN',file:'goldhen_2.4b18.12.bin'}],preferred:true,cacheReopen:definition.cacheReopen,source:{repository:'https://github.com/'+REPO,commit:COMMIT,path:entry.path},ticket:'existing-karo-guard'};
  const html=Buffer.from(builder.render(route).replace('Original KARO browser build by Karo Sharifi and contributors','Original GamerHack browser build and its credited contributors').replace('/docs/host-reviews/karo/README.md','/docs/host-gamerhack-local-build.json'));
  const page=route.entry.slice(1)+'index.html';preserve(root,page,html);pages.push(route);files.set(page,html);
 }
 for(const name of ['host-karo-builds.js','host-karo-resource-guard.js','host-karo-builds.css','host-local-launcher.js'])files.set('assets/'+name,fs.readFileSync(path.join(root,'assets',name)));
 const intro=Buffer.from('<!doctype html><meta charset="utf-8"><title>GamerHack local builds</title><h1>Choose your PS4 firmware</h1>'+pages.map(r=>'<p><a href=".'+r.entry+'">'+r.label+'</a></p>').join(''));files.set('index.html',intro);
 const inventory={schemaVersion:1,repository:REPO,commit:COMMIT,version:setHash.slice(0,12),runtime,entries,groups:pages,sourceFiles:manifest,native,sourceCodeExecuted:false,consoleContact:false};files.set('SOURCE-MANIFEST.json',Buffer.from(JSON.stringify(inventory,null,2)+'\n'));
 const {zip}=require('./package-console-payload-sender.cjs'),zipBytes=zip(files,{prefix:'gamerhack-local/'}),filename='gamerhack-ps4-505-672-'+setHash.slice(0,12)+'.zip',local='downloads/hosts/gamerhack/'+COMMIT.slice(0,12)+'/'+filename;preserve(root,local,zipBytes);
 jobs.push({id:'gamerhack-505-672-local-'+setHash.slice(0,12),title:'GamerHack original PS4 5.05 and6.72 web-host builds',platform:'PS4',category:'Tools',project:'GamerHack local web host',version:COMMIT.slice(0,12)+'-'+setHash.slice(0,12),filename,url:'https://speedy-away.github.io/WWB-HOST/'+local,importPath:local,kind:'generated',mirror:false,archiveRole:['Builds'],expectedBytes:zipBytes.length,expectedSha256:sha(zipBytes),pages:pages.map(p=>p.entry.slice(1)+'index.html')});
 const result={...inventory,base,bundle:{local:'/'+local,bytes:zipBytes.length,sha256:sha(zipBytes)},jobs};fs.writeFileSync(path.join(root,'docs/host-gamerhack-local-build.json'),JSON.stringify(result,null,2)+'\n');return result;
}
async function prepare({root=ROOT,download=false}={}){const review=JSON.parse(fs.readFileSync(path.join(root,'docs/host-gamerhack-local-route-review.json'),'utf8'));if(!download)return {status:'check-only',files:plan(review).length,bytes:plan(review).reduce((n,f)=>n+f.bytes,0),commit:COMMIT};return packageCapture(root,await capture(root,review));}
if(require.main===module)prepare({download:process.argv.includes('--download')}).then(r=>console.log(JSON.stringify({status:r.status||'prepared',files:r.sourceFiles?.length,native:r.native?.length,runtime:r.runtime,bundle:r.bundle,jobs:r.jobs?.length}))).catch(e=>{console.error(e.message);process.exitCode=1;});module.exports={COMMIT,DEFINITIONS,plan,references,wrap,packageCapture,prepare};
