'use strict';
// Inspect original data only. No downloaded script, ELF or BIN is ever executed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {validateELF}=require('./verify-host-payloads.cjs');
const {inspectArchive}=require('./audit-console-ready-files.cjs');
const root=path.resolve(__dirname,'..'),reportFile='docs/host-reviews/karo/dependency-audit.json';
const sevenZip='C:/Program Files/7-Zip/7z.exe',MAX_DECODED=32*1024*1024;
// Confirmed local Defender event 1116; never restore, rename, encode or refetch
// these quarantined sources to bypass protection. Other missing files are errors.
const knownLocalUnavailable=new Set(['900New/payload.js','900NM/payload.js']);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const blank=s=>s.replace(/[^\r\n]/g,' ');
function safeLocal(base,name){if(typeof name!=='string'||name.startsWith('/')||name.split('/').some(x=>x==='..'||x==='.')||/[\\\x00-\x1f]/.test(name))throw Error('Unsafe staged path');const target=path.resolve(base,name);if(!target.startsWith(base+path.sep))throw Error('Staged path escapes root');return target;}
function preserve(file,bytes){if(fs.existsSync(file)){if(!fs.readFileSync(file).equals(bytes))throw Error('Refusing to replace different derived bytes: '+file);return;}fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});}
// Preserve quoted strings and regexes while masking comments. This is a static
// reference scanner, not a JavaScript interpreter or proof of reachability.
function withoutJSComments(source){
 let out='',i=0,previous='';
 while(i<source.length){const c=source[i],n=source[i+1];
  if(c==='"'||c==="'"||c==='`'){const quote=c,start=i++;while(i<source.length){if(source[i]==='\\'){i+=2;continue;}if(source[i++]===quote)break;}out+=source.slice(start,i);previous='value';continue;}
  if(c==='/'&&n==='/'){const start=i;i+=2;while(i<source.length&&!/[\r\n]/.test(source[i]))i++;out+=blank(source.slice(start,i));continue;}
  if(c==='/'&&n==='*'){const start=i;i+=2;while(i<source.length&&!(source[i]==='*'&&source[i+1]==='/'))i++;i=Math.min(source.length,i+2);out+=blank(source.slice(start,i));continue;}
  if(c==='/'&&(!previous||/[=(:,!&|?;{\[]/.test(previous))){const start=i++;let cls=false;while(i<source.length){if(source[i]==='\\'){i+=2;continue;}if(source[i]==='[')cls=true;if(source[i]===']')cls=false;if(source[i++]==='/'&&!cls)break;if(/[\r\n]/.test(source[i-1]))break;}while(/[a-z]/i.test(source[i]||'')&&i<source.length)i++;out+=source.slice(start,i);previous='value';continue;}
  out+=c;if(!/\s/.test(c))previous=c;i++;
 }
 return out;
}
function withoutHTMLComments(source){return source.replace(/<!--[\s\S]*?-->/g,blank);}
function elfCheck(bytes){
 const checked=validateELF(bytes);
 // Validate every file-backed program segment, not only PT_LOAD segments.
 const m=checked.metadata;if(m.bits===64&&m.endianness==='little'&&m.programHeaderBytes===56&&m.programHeaderCount>0){const at=BigInt(m.programHeaderOffset),end=at+56n*BigInt(m.programHeaderCount);if(at>=64n&&end<=BigInt(bytes.length))for(let i=0;i<m.programHeaderCount;i++){const p=Number(at)+56*i,offset=bytes.readBigUInt64LE(p+8),size=bytes.readBigUInt64LE(p+32);if(size&&offset+size>BigInt(bytes.length)&&!checked.issues.some(x=>x.code==='elf-segment-bounds'&&x.segment===i))checked.issues.push({code:'elf-segment-bounds',segment:i,message:'File-backed program segment lies beyond the file.'});}}
 return checked;
}
function binaryCheck(bytes,extension){
 const issues=[];if(!bytes.length)issues.push({code:'empty-file',message:'The original file is empty.'});
 if(/^\s*(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(bytes.subarray(0,512).toString('utf8')))issues.push({code:'html-masquerading-as-payload',message:'The original response contains HTML, not the advertised binary.'});
 let metadata={bytes:bytes.length};
 if(extension==='elf'){const elf=elfCheck(bytes);metadata=elf.metadata;issues.push(...elf.issues);}
 else if(extension==='bin'&&bytes.length<256)issues.push({code:'raw-bin-too-small',message:'The original flat BIN is shorter than 256 bytes; not offered as a ready payload.'});
 return{status:issues.length?'invalid':'structurally-valid',format:extension.toUpperCase(),metadata,issues,hardwareVerified:false};
}
function audit({write=true}={}){
 const input=JSON.parse(fs.readFileSync(path.join(root,'docs/host-reviews/karo/runtime-acquisition.json'),'utf8')),source=JSON.parse(fs.readFileSync(path.join(root,'docs/host-reviews/karo/source-review.json'),'utf8'));
 if(input.commit!==source.commit||!/^[a-f0-9]{40}$/.test(input.commit))throw Error('Pinned source identity differs');
 const stage=path.join(root,'tmp/karo-review',input.commit),decodedBase=path.join(root,'tmp/karo-decoded',input.commit),tree=new Map(source.tree.filter(f=>f.type==='blob').map(f=>[f.path,f])),files=[],buffers=new Map(),invalid=[],derived=[],decodeCache=new Map(),localUnavailable=[];
 for(const record of input.files){const absolute=safeLocal(stage,record.path);if(knownLocalUnavailable.has(record.path)&&!fs.existsSync(absolute)){const unavailable={...record,status:'local-unavailable',identityVerified:false,reason:'Windows Defender Operational event 1116 quarantined this source as Trojan:JS/Cryxos.AIDB!MTB. Not restored or fetched again.'};files.push(unavailable);localUnavailable.push(unavailable);continue;}const bytes=fs.readFileSync(absolute),digest=sha(bytes);if(bytes.length!==record.bytes||digest!==record.sha256)throw Error('Staged file identity mismatch: '+record.path);const blob=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),original=tree.get(record.path);if(record.gitBlobSHA1&&(record.gitBlobSHA1!==blob||!original||original.sha!==blob||original.size!==bytes.length))throw Error('Pinned Git blob identity mismatch: '+record.path);const f={path:record.path,url:record.url,bytes:bytes.length,sha256:digest,gitBlobSHA1:record.gitBlobSHA1||null,identityVerified:true};buffers.set(record.path,bytes);
  const extension=path.extname(record.path).slice(1).toLowerCase();
  if(extension==='bin'||extension==='elf'){f.validation=binaryCheck(bytes,extension);if(f.validation.status==='invalid')invalid.push({path:f.path,...f.validation});}
  else if(extension==='bz2'){
   try{if(bytes.length<4||bytes.subarray(0,3).toString()!=='BZh'||bytes[3]<49||bytes[3]>57)throw Error('Missing BZIP2 header');let raw=decodeCache.get(digest);if(!raw){raw=execFileSync(sevenZip,['e','-tbzip2','-si','-so'],{input:bytes,maxBuffer:MAX_DECODED,windowsHide:true,timeout:60000});decodeCache.set(digest,raw);}const name=record.path.replace(/\.bz2$/i,''),rawCheck=binaryCheck(raw,path.extname(name).slice(1).toLowerCase()==='elf'?'elf':'bin'),target=safeLocal(decodedBase,name);if(write)preserve(target,raw);const item={sourcePath:record.path,filename:path.posix.basename(name),bytes:raw.length,sha256:sha(raw),local:'tmp/karo-decoded/'+input.commit+'/'+name,transformation:'BZIP2 decompression only; original compressed bytes preserved.',validation:rawCheck};derived.push(item);f.validation={status:rawCheck.status,format:'BZIP2',issues:rawCheck.issues,decoded:item};if(rawCheck.status==='invalid')invalid.push({path:f.path,...f.validation});}catch(error){f.validation={status:'invalid',format:'BZIP2',issues:[{code:'bzip2-invalid',message:error.message.split('\n')[0]}]};invalid.push({path:f.path,...f.validation});}
  }else if(extension==='zip'){
   try{if(bytes.length<22||bytes.readUInt32LE(0)!==0x04034b50)throw Error('Missing ZIP local header');const zip=inspectArchive(absolute,{readDocumentation:false});if(zip.fileCount>4096||zip.entries.reduce((n,x)=>n+x.bytes,0)>128*1024*1024||zip.entries.some(x=>x.encrypted))throw Error('Archive exceeds reviewed bounds or is encrypted');execFileSync(sevenZip,['t','-bd','-y',absolute],{maxBuffer:1024*1024,windowsHide:true,timeout:60000});f.validation={status:'structurally-valid',format:'ZIP',metadata:zip,issues:[]};}catch(error){f.validation={status:'invalid',format:'ZIP',issues:[{code:'zip-invalid',message:error.message.split('\n')[0]}]};invalid.push({path:f.path,...f.validation});}
  }
  files.push(f);
 }
 const present=new Map(files.filter(f=>f.identityVerified).map(f=>[f.path,f])),edges=[],edgeKeys=new Set(),scriptDocuments=new Map();
 for(const f of files.filter(f=>f.identityVerified&&/\.html?$/i.test(f.path))){const html=withoutHTMLComments(buffers.get(f.path).toString('utf8'));for(const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)){const ref=m[1].replace(/[?#].*$/,'');if(!ref||/^[a-z]+:|^\/\//i.test(ref))continue;const target=ref.startsWith('/')?ref.slice(1):path.posix.normalize(path.posix.join(path.posix.dirname(f.path),ref));if(!scriptDocuments.has(target))scriptDocuments.set(target,[]);scriptDocuments.get(target).push(f.path);}}
 function edge(from,raw,kind,{essential=false,dormant=false,line=null,baseFrom=from}={}){
  if(!raw||raw.length>512||/[\r\n\x00]/.test(raw)||raw.includes('${')||/^[+#]|^javascript:|^data:|^mailto:|^tel:/i.test(raw))return;
  raw=raw.replaceAll('&amp;','&');let target,external=false;
  try{if(/^(?:[a-z]+:|\/\/)/i.test(raw)){const u=new URL(raw,'https://kar0218.github.io/');if(u.hostname.toLowerCase()!=='kar0218.github.io')external=true;else target=decodeURIComponent(u.pathname.replace(/^\//,''));}else{const clean=decodeURIComponent(raw.replace(/[?#].*$/,''));if(!clean)return;target=path.posix.normalize(clean.startsWith('/')?clean.slice(1):path.posix.join(path.posix.dirname(baseFrom),clean));}}catch{return;}
  if(target&&(/(^|\/)\.\.(\/|$)/.test(target)||target.startsWith('/')))return;
  if(target&&(target.endsWith('/')||!path.posix.extname(target))&&!present.has(target))target=target.replace(/\/$/,'')+'/index.html';
  const state=external?'external':present.has(target)?(present.get(target).validation?.status==='invalid'?'invalid':'present'):tree.has(target)?'not-staged':'missing';
  const key=[from,target||raw,kind,dormant].join('|');if(edgeKeys.has(key))return;edgeKeys.add(key);edges.push({from,reference:raw,...(target?{target}:{}),kind,essential,dormant,state,...(line?{line}:{})});
 }
 function scripts(from,text,offset=0,dormant=false){const clean=dormant?text:withoutJSComments(text),lineAt=at=>offset+1+clean.slice(0,at).split('\n').length-1;let documentFrom=from;if(!/\.html?$/i.test(from)){const owners=scriptDocuments.get(from)||[];if(owners.length)documentFrom=owners[0];else{let ancestor=path.posix.dirname(from);while(ancestor!=='.'&&ancestor){const candidate=ancestor+'/index.html';if(present.has(candidate)){documentFrom=candidate;break;}const parent=path.posix.dirname(ancestor);if(parent===ancestor)break;ancestor=parent;}}}
  for(const m of clean.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g))if(/^[./]|^https?:/.test(m[1]))edge(from,m[1],'module-import',{essential:!dormant,dormant,line:lineAt(m.index)});
  for(const m of clean.matchAll(/\bnew\s+(?:Shared)?Worker\s*\(\s*['"]([^'"]+)['"]/g))edge(from,m[1],'worker',{essential:!dormant,dormant,line:lineAt(m.index),baseFrom:documentFrom});
  for(const m of clean.matchAll(/(?:\bfetch\s*\(\s*|\.open\s*\(\s*['"](?:GET|POST|PUT|DELETE)['"]\s*,\s*)['"]([^'"]+\.php(?:[?#][^'"]*)?)['"]/gi))edge(from,m[1],'server-endpoint',{dormant,line:lineAt(m.index)});
  for(const m of clean.matchAll(/(?:\b(?:fetch|loadFile|runJS|load_script|loadScript)\s*\(\s*|\b(?:PLfile|payload_location|payload_url|payloadFile)\s*=\s*|\.src\s*=\s*)['"]([^'"]+\.(?:bin|elf|bz2|js|mjs)(?:[?#][^'"]*)?)['"]/gi))edge(from,m[1],/\.(?:js|mjs)(?:[?#]|$)/i.test(m[1])?'script-control':'payload-control',{dormant,line:lineAt(m.index)});
  for(const m of clean.matchAll(/['"]([^'"<>\r\n`]{1,180}\.(?:bin|elf|bz2|js|mjs))['"]/gi)){const v=m[1];if(/[=+{}]|\s{2}|^\s|\s$/.test(v)||v.includes(' ' )&&!present.has(path.posix.join(path.posix.dirname(from),v)))continue;edge(from,v,'code-literal',{dormant,line:lineAt(m.index)});}
  if(!dormant){const comments=text.match(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm)||[];for(const part of comments)scripts(from,part.replace(/^\s*\/\//gm,'').replace(/^\/\*|\*\/$/g,''),0,true);}
 }
 for(const f of files.filter(f=>f.identityVerified)){const text=buffers.get(f.path).toString('utf8');
  if(/\.html?$/i.test(f.path)){const clean=withoutHTMLComments(text),markup=clean.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(_,open,body,close)=>open+blank(body)+close);for(const m of markup.matchAll(/<([a-z][\w-]*)\b[^>]*>/gi)){const tag=m[1].toLowerCase(),attrs=[...m[0].matchAll(/\b(src|href|manifest)\s*=\s*["']([^"']+)["']/gi)],line=1+markup.slice(0,m.index).split('\n').length-1;for(const a of attrs){const key=a[1].toLowerCase(),kind=key==='manifest'?'manifest':tag==='script'?'script':tag==='link'&&/\brel\s*=\s*["']stylesheet["']/i.test(m[0])?'stylesheet':/^(?:img|image|video|audio|source)$/.test(tag)?'decorative':tag==='iframe'?'embedded-runtime':'navigation';edge(f.path,a[2],kind,{essential:['script','stylesheet','manifest','embedded-runtime'].includes(kind),line});}}
   for(const m of clean.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))scripts(f.path,m[1],clean.slice(0,m.index).split('\n').length-1);
   for(const m of text.matchAll(/<!--[\s\S]*?-->/g)){for(const a of m[0].matchAll(/(?:src|href|manifest)\s*=\s*["']([^"']+)["']/gi))edge(f.path,a[1],'commented-reference',{dormant:true});}
   for(const m of clean.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/gi))edge(f.path,m[1],'decorative');
  }else if(/\.m?js$/i.test(f.path))scripts(f.path,text);
  else if(/\.css$/i.test(f.path)){const clean=withoutJSComments(text);for(const m of clean.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/gi))edge(f.path,m[1],'decorative');}
  else if(/\.(?:manifest|appcache)$/i.test(f.path)){let section='CACHE';for(const [i,line]of text.split(/\r?\n/).entries()){const t=line.trim();if(!t||/^#|^CACHE MANIFEST$/i.test(t))continue;if(/^(CACHE|NETWORK|FALLBACK|SETTINGS):$/i.test(t)){section=t.slice(0,-1).toUpperCase();continue;}if(section==='CACHE')edge(f.path,t,'cache-resource',{line:i+1});else if(section==='FALLBACK'){const refs=t.split(/\s+/);if(refs[1])edge(f.path,refs[1],'cache-fallback',{line:i+1});}}}
 }
 const failures=edges.filter(e=>!e.dormant&&['missing','invalid','not-staged'].includes(e.state)),defaultKinds=new Set(['script','module-import','worker','embedded-runtime']);
 const entries=files.filter(f=>f.identityVerified&&/\.html?$/i.test(f.path)).map(f=>{const visited=new Set(),todo=[f.path],blockers=[];while(todo.length){const from=todo.pop();if(visited.has(from))continue;visited.add(from);for(const e of edges.filter(e=>e.from===from&&!e.dormant&&defaultKinds.has(e.kind))){if(['missing','invalid','not-staged'].includes(e.state))blockers.push(e);else if(e.state==='present'&&e.target)todo.push(e.target);}}const manifests=edges.filter(e=>e.from===f.path&&!e.dormant&&e.kind==='manifest'),cacheFindings=manifests.flatMap(e=>e.state!=='present'?[e]:edges.filter(r=>r.from===e.target&&!r.dormant&&r.state!=='present'&&r.state!=='external'));return{entry:f.path,defaultScriptClosureFiles:visited.size,status:blockers.length?'blocked-source-dependency':'direct-script-dependencies-present',blockers,cacheFindings};});
 const report={checkedAt:new Date().toISOString(),commit:input.commit,status:'completed-with-upstream-findings',method:'Pinned size/SHA-256/Git-blob verification; data-only ELF/BIN/BZIP2/ZIP inspection and conservative static reference scanning. No downloaded code is evaluated. Literal edges can be conditional; direct script/module closure blockers are distinguished from controls, cache lists, navigation and comments.',files,derived,edges,invalidPayloads:invalid,missingReferences:failures,entries,summary:{files:files.length,gitIdentities:files.filter(f=>f.gitBlobSHA1).length,payloads:files.filter(f=>f.validation).length,invalidPayloads:invalid.length,derivedBINs:derived.length,dependencyEdges:edges.length,missingOrInvalidReferences:failures.length,blockedEntries:entries.filter(e=>e.blockers.length).length,externalReferences:edges.filter(e=>e.state==='external').length,dormantReferences:edges.filter(e=>e.dormant).length},limits:['Static reference scanning does not prove that every dynamic path is complete or compatible on hardware.','Firmware support is not inferred from folder names or ELF validity.','Flat BIN validation confirms nonempty, non-HTML bytes and a conservative minimum length, not a universal ABI.','A missing control or cache entry is an upstream defect; it does not establish that every entry in that folder is unusable.'],nativeCodeExecuted:false,consoleContact:false};
 report.localUnavailable=localUnavailable;report.summary.localUnavailable=localUnavailable.length;report.summary.verifiedFiles=files.filter(f=>f.identityVerified).length;report.summary.gitIdentities=files.filter(f=>f.identityVerified&&f.gitBlobSHA1).length;
 report.limits.push('Two pinned source paths were quarantined by Windows Defender Operational event 1116 as Trojan:JS/Cryxos.AIDB!MTB. Their expected acquisition metadata is retained, but unavailable local bytes are not reverified, restored or refetched.');
 report.invalid=invalid.map(f=>({path:f.path,reason:f.issues.map(i=>i.message).join(' '),issues:f.issues}));report.missing=failures;report.external=edges.filter(e=>e.state==='external');
 if(write)fs.writeFileSync(path.join(root,reportFile),JSON.stringify(report,null,2)+'\n');return report;
}
if(require.main===module){try{const r=audit({write:!process.argv.includes('--check')});console.log(JSON.stringify(r.summary,null,2));}catch(e){console.error(e);process.exitCode=1;}}
module.exports={audit,withoutJSComments,elfCheck,binaryCheck};
