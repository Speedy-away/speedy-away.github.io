/* Runtime-scoped versioned cache. Fetch/hash only; never execute payloads. */
'use strict';
const NAME='wwb-afterglow-1402-944d5aeed06f-v1',BASE=new URL('./',self.location.href).href,MARKER=BASE+'__complete__',STATE=NAME+'-active';
let running=false,cancelled=false,deleting=false,currentSave=null,requestController=null;
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
const send=(client,state,fields={})=>client.postMessage({type:'afterglow-cache',state,...fields});
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
async function network(url){
 const controller=new AbortController();requestController=controller;const timer=setTimeout(()=>controller.abort(),20000);
 try{const response=await fetch(url,{cache:'no-store',redirect:'error',signal:controller.signal});if(!response.ok)throw Error('Download failed: '+new URL(url).pathname.split('/').pop());return new Response(await response.arrayBuffer(),{headers:response.headers});}finally{clearTimeout(timer);if(requestController===controller)requestController=null;}
}
async function active(){
 const state=await caches.open(STATE),record=await state.match(MARKER);
 if(record)return record.json();
 // Preserve the previously shipped cache when upgrading this worker.
 const legacy=await caches.open(NAME),marker=await legacy.match(MARKER);
 return marker?{cache:NAME,files:await marker.json()}:null;
}
async function save(client,update){
 if(running)return;running=true;cancelled=false;let previous;
 try{
  previous=await active();send(client,'checking',{saved:!!previous,update});
  const response=await network(BASE+'offline-files.json');if(!response.ok)throw Error('File list unavailable');
  const list=await response.json();if(!Array.isArray(list)||!list.length||list.length>80)throw Error('Invalid cache list');
  for(const file of list)if(!/^[a-zA-Z0-9_.-]+$/.test(file.path)||!Number.isSafeInteger(file.bytes)||file.bytes<0||file.bytes>8*1024*1024||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Invalid cache file');
  const version=await digest(new TextEncoder().encode(JSON.stringify(list))),name=NAME+'-'+version,cache=await caches.open(name),old=previous&&await caches.open(previous.cache);
  for(let i=0;i<list.length;i++){
   if(cancelled){send(client,'stopped',{saved:!!previous});return;}
   const file=list[i],url=BASE+file.path;
   let stored=await cache.match(url)||(old&&await old.match(url)),bytes=stored&&await stored.clone().arrayBuffer();
   if(!bytes||bytes.byteLength!==file.bytes||await digest(bytes)!==file.sha256){
    const result=await network(url);if(!result.ok)throw Error('Download failed: '+file.path);
    bytes=await result.arrayBuffer();if(bytes.byteLength!==file.bytes||await digest(bytes)!==file.sha256)throw Error('Checksum mismatch: '+file.path);
    stored=new Response(bytes,{headers:result.headers});
   }
   if(cancelled){send(client,'stopped',{saved:!!previous});return;}
   await cache.put(url,stored);send(client,'progress',{loaded:i+1,total:list.length,saved:!!previous});
  }
  if(cancelled){send(client,'stopped',{saved:!!previous});return;}
  // Publish one pointer only after the entire new generation has passed hashes.
  const state=await caches.open(STATE);await state.put(MARKER,new Response(JSON.stringify({cache:name,files:list.map(f=>f.path)})));
  send(client,'ready',{updated:!!update});
 }catch(error){send(client,cancelled?'stopped':'error',{reason:error.message,saved:!!previous});}finally{running=false;}
}
async function removeCache(client){
 if(deleting)return;deleting=true;cancelled=true;if(requestController)requestController.abort();
 try{if(currentSave)await currentSave;const names=await caches.keys();for(const name of names)if(name===NAME||name.startsWith(NAME+'-'))await caches.delete(name);send(client,'deleted');}
 catch(error){send(client,'delete-error',{reason:error.message});}finally{deleting=false;}
}
self.addEventListener('message',event=>{
 if(!event.source||new URL(event.source.url).origin!==self.location.origin||!event.source.url.startsWith(BASE))return;
 if(event.data?.type==='afterglow-cache-save'||event.data?.type==='afterglow-cache-update'){if(running||deleting)return;currentSave=save(event.source,event.data.type==='afterglow-cache-update');event.waitUntil(currentSave);}
 else if(event.data?.type==='afterglow-cache-stop'){cancelled=true;if(requestController)requestController.abort();}
 else if(event.data?.type==='afterglow-cache-delete')event.waitUntil(removeCache(event.source));
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||!url.href.startsWith(BASE))return;
 event.respondWith((async()=>{const record=await active();if(record){const name=url.pathname.slice(new URL(BASE).pathname.length)||'index.html';if(record.files.includes(name)){const cache=await caches.open(record.cache),stored=await cache.match(BASE+name);if(stored)return stored;}}return fetch(event.request);})());
});
