'use strict';
// Cache published bytes as data. Never navigate a page or run a cached script.
const PREFIX='wwb-host-offline-',MAX_FILES=4096,MAX_BYTES=80*1024*1024,MAX_DESCRIPTOR=1024*1024;
const ORIGIN=self.location.origin,COMPLETE=ORIGIN+'/offline/__wwb_complete__',PLAN=ORIGIN+'/offline/__wwb_plan__';
const installing=new Set(),clientPacks=new Map();let packList=null;
function platformOK(value){return value==='ps4'||value==='ps5';}
function safePath(pathname){
 let decoded;try{decoded=decodeURIComponent(pathname);}catch(_){return false;}
 if(!pathname.startsWith('/')||pathname.startsWith('//')||/[\\\x00-\x20]/.test(pathname)||/[\\\x00-\x1f]/.test(decoded)||/%(?:2e|2f|5c)/i.test(pathname)||/%(?:2e|2f|5c)/i.test(decoded)||decoded.split('/').some(p=>p==='.'||p==='..')||decoded.startsWith('/offline/__wwb_'))return false;
 return pathname==='/'||pathname==='/index.html'||pathname==='/style.css'||/^\/downloads\/.+\.xml$/i.test(pathname)||/^\/(?:hosts|assets|languages|console|docs|offline)\//.test(pathname)||/^\/(?:host-project-map|host-runtime-map|host-offline-sw)\.js$/.test(pathname);
}
function safeURL(value){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\x00-\x20]/.test(value))throw Error('Unsafe offline file URL');
 if(!safePath(value.split(/[?#]/)[0]))throw Error('Unsafe offline file URL');const url=new URL(value,ORIGIN);if(url.origin!==ORIGIN||url.hash||!safePath(url.pathname))throw Error('Unsafe offline file URL');return url.pathname+url.search;
}
function validate(data,platform){
 if(!data||data.platform!==platform||!platformOK(platform)||typeof data.version!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(data.version)||!Array.isArray(data.files)||!data.files.length||data.files.length>MAX_FILES)throw Error('Invalid offline pack descriptor');
 const seen=new Set();let bytes=0;
 const files=data.files.map(file=>{const url=safeURL(file.url);if(seen.has(url)||!Number.isSafeInteger(file.bytes)||file.bytes<0||file.bytes>MAX_BYTES||typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(file.sha256))throw Error('Invalid offline file identity');seen.add(url);bytes+=file.bytes;if(bytes>MAX_BYTES)throw Error('Offline pack exceeds 80 MiB');return {url,bytes:file.bytes,sha256:file.sha256.toLowerCase()};});
 return {platform,version:data.version,files,bytes};
}
const cacheName=pack=>PREFIX+pack.platform+'-'+pack.version;
function send(source,type,fields){if(source&&typeof source.postMessage==='function')source.postMessage(Object.assign({type,protocol:2},fields));}
async function bodyBytes(response,limit,expected){
 if(!response||response.status!==200||response.redirected||response.type==='opaque')throw Error('An offline file was unavailable');
 const encoding=response.headers&&response.headers.get('Content-Encoding'),length=response.headers&&response.headers.get('Content-Length');
 if((!encoding||encoding.toLowerCase()==='identity')&&length&&(!/^\d+$/.test(length)||Number(length)>limit||expected!==undefined&&Number(length)!==expected))throw Error('Offline file size mismatch');
 let bytes;
 if(response.body&&typeof response.body.getReader==='function'){
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>limit){await reader.cancel();throw Error('Offline response exceeds its byte limit');}chunks.push(next.value);}}
  finally{if(reader.releaseLock)reader.releaseLock();}
  bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 }else{bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>limit)throw Error('Offline response exceeds its byte limit');}
 if(expected!==undefined&&bytes.byteLength!==expected)throw Error('Offline file size mismatch');return bytes;
}
async function digest(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function storedJSON(cache,key){const response=await cache.match(key);return response?response.json():null;}
async function loadPacks(){
 if(packList)return packList;
 packList=(async()=>{
  const packs=[];for(const name of await caches.keys()){
   if(!/^wwb-host-offline-ps[45]-/.test(name))continue;
   try{const cache=await caches.open(name),marker=await storedJSON(cache,COMPLETE);if(!marker||marker.format!==1||!Number.isFinite(marker.savedAt))continue;const pack=validate(marker.manifest,marker.manifest.platform);if(cacheName(pack)!==name)continue;
    const keys=new Set((await cache.keys()).map(request=>request.url));if(pack.files.some(file=>!keys.has(ORIGIN+file.url)))continue;
    const exact=new Map(),paths=new Map();for(const file of pack.files){exact.set(file.url,file);const pathname=new URL(file.url,ORIGIN).pathname,previous=paths.get(pathname);paths.set(pathname,previous===false||previous&&(previous.sha256!==file.sha256||previous.bytes!==file.bytes)?false:file);}
    packs.push({name,cache,pack,savedAt:marker.savedAt,exact,paths});
   }catch(_){/* Incomplete or unrecognized caches are preserved and not served. */}
  }
  return packs.sort((a,b)=>b.savedAt-a.savedAt);
 })();return packList;
}
async function status(platform,source){
 try{const ready=(await loadPacks()).find(item=>item.pack.platform===platform);
 if(ready)send(source,'CACHED',{platform,version:ready.pack.version,files:ready.pack.files.length,bytes:ready.pack.bytes,savedAt:ready.savedAt,statusOnly:true});else send(source,'STATUS',{platform,cached:false});}
 catch(_){packList=null;send(source,'ERROR',{platform,statusOnly:true,message:'Offline storage could not be checked.'});}
}
async function install(platform,source){
 if(installing.has(platform)){send(source,'ERROR',{platform,message:'An offline save is already running.'});return;}
 installing.add(platform);
 try{
  if(!crypto||!crypto.subtle)throw Error('This browser cannot verify offline files');
  const response=await fetch('/offline/'+platform+'.json',{cache:'no-store',credentials:'same-origin',redirect:'error'}),bytes=await bodyBytes(response,MAX_DESCRIPTOR),pack=validate(JSON.parse(new TextDecoder().decode(bytes)),platform),cache=await caches.open(cacheName(pack)),existing=await storedJSON(cache,COMPLETE),plan=await storedJSON(cache,PLAN);
  if(existing&&JSON.stringify(validate(existing.manifest,platform))!==JSON.stringify(pack)||plan&&JSON.stringify(plan)!==JSON.stringify(pack))throw Error('This offline version already has a different file list');
  await cache.put(PLAN,new Response(JSON.stringify(pack),{headers:{'Content-Type':'application/json'}}));
  let completed=0,savedBytes=0;send(source,'PROGRESS',{platform,version:pack.version,completed,total:pack.files.length,bytes:savedBytes,totalBytes:pack.bytes});
  for(const file of pack.files){
   let cached=await cache.match(ORIGIN+file.url),reusable=false;
   if(cached)try{const saved=await bodyBytes(cached,file.bytes,file.bytes);reusable=await digest(saved)===file.sha256;}catch(_){/* Retry only the missing or damaged file. */}
   if(reusable){completed++;savedBytes+=file.bytes;send(source,'PROGRESS',{platform,version:pack.version,completed,total:pack.files.length,bytes:savedBytes,totalBytes:pack.bytes});continue;}
   const result=await fetch(file.url,{cache:'no-store',credentials:'same-origin',redirect:'error'}),data=await bodyBytes(result,file.bytes,file.bytes);
   if(await digest(data)!==file.sha256)throw Error('Offline file checksum mismatch: '+file.url);
   const headers=new Headers(result.headers);headers.delete('Content-Encoding');headers.delete('Transfer-Encoding');headers.set('Content-Length',String(data.byteLength));
   await cache.put(ORIGIN+file.url,new Response(data,{status:200,statusText:result.statusText,headers}));
   completed++;savedBytes+=data.byteLength;send(source,'PROGRESS',{platform,version:pack.version,completed,total:pack.files.length,bytes:savedBytes,totalBytes:pack.bytes});
  }
  await cache.put(COMPLETE,new Response(JSON.stringify({format:1,savedAt:Date.now(),manifest:pack}),{headers:{'Content-Type':'application/json'}}));packList=null;
  send(source,'CACHED',{platform,version:pack.version,files:pack.files.length,bytes:pack.bytes});
 }catch(error){send(source,'ERROR',{platform,message:error&&error.message||'Offline save failed. Previous saved copies were kept.'});}
 finally{installing.delete(platform);}
}
function queryMayMatch(url){return /\/$|\.html?$/i.test(url.pathname)||Array.from(url.searchParams.keys()).every(key=>key==='v');}
async function verify(platform,source){
 if(installing.has(platform)){send(source,'ERROR',{platform,message:'Wait for the current save to finish.'});return;}
 try{packList=null;const item=(await loadPacks()).find(p=>p.pack.platform===platform);if(!item)throw Error('No complete saved copy was found. Save an offline copy first.');let completed=0;
  for(const file of item.pack.files){const response=await item.cache.match(ORIGIN+file.url),bytes=await bodyBytes(response,file.bytes,file.bytes);if(await digest(bytes)!==file.sha256)throw Error('A saved file is damaged. Save again to repair this copy.');completed++;if(completed%20===0||completed===item.pack.files.length)send(source,'VERIFY_PROGRESS',{platform,completed,total:item.pack.files.length});}
  send(source,'VERIFIED',{platform,version:item.pack.version,files:completed,bytes:item.pack.bytes,savedAt:item.savedAt});
 }catch(error){send(source,'ERROR',{platform,operation:'verify',message:error.message||'Saved copy could not be verified.'});}
}
async function cachedResponse(event,url){
 const packs=await loadPacks(),pinned=clientPacks.get(event.clientId),platform=url.pathname.match(/^\/hosts\/(ps[45])\//)?.[1]||url.pathname.match(/^\/offline\/(ps[45])\//)?.[1];
 const candidates=pinned?packs.filter(pack=>pack.name===pinned):platform?packs.filter(pack=>pack.pack.platform===platform):packs;
 for(const item of candidates){const file=item.exact.get(url.pathname+url.search)||(queryMayMatch(url)&&item.paths.get(url.pathname));if(!file)continue;const response=await item.cache.match(ORIGIN+file.url);if(response){const id=event.resultingClientId||event.clientId;if(id)clientPacks.set(id,item.name);return response;}}
 return fetch(event.request);
}
self.addEventListener('message',event=>{
 const data=event.data,source=event.source;if(!data||!platformOK(data.platform)||event.origin&&event.origin!==ORIGIN||!source||typeof source.postMessage!=='function')return;
 if(data.type==='INSTALL')event.waitUntil(install(data.platform,source));else if(data.type==='STATUS')event.waitUntil(status(data.platform,source));else if(data.type==='VERIFY')event.waitUntil(verify(data.platform,source));
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==ORIGIN||!safePath(url.pathname))return;
 // Only saved descriptor entries can hit a cache. Unknown paths use normal network.
 event.respondWith(cachedResponse(event,url));
});
// Deliberately no skipWaiting, clients.claim, automatic install, or cache deletion.
