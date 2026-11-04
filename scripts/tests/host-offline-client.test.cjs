'use strict';
// Authored UI in an inert DOM: no native navigation, storage or console requests.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/host-offline.js'),'utf8');
function node(){return {textContent:'Save for offline',hidden:false,disabled:false,handlers:{},addEventListener(name,fn){this.handlers[name]=fn;},removeAttribute(name){delete this[name];}};}
function fixture({appCache=null,worker=false,button=true,pathname='/offline/ps4/',manifest=true,secure=true,registerThrow=false,enhanced=false}={}){
 const nodes={'host-offline-status':node(),'host-offline-progress':node(),'host-offline-save':button?node():null},events={},registers=[],posts=[],cacheEvents={};let updates=0;
 if(enhanced){nodes['host-offline-verify']=node();nodes['host-offline-summary']=node();}
 if(appCache){appCache.addEventListener=(name,fn)=>cacheEvents[name]=fn;appCache.update=()=>{updates++;};appCache.swapCache=()=>{throw Error('Cache switching is forbidden');};}
 const active={scriptURL:'https://speedy-away.github.io/host-offline-sw.js',state:'activated',postMessage:data=>posts.push(data)};
 const service=worker?{addEventListener:(name,fn)=>events[name]=fn,getRegistration:async()=>undefined,register:(url,options)=>{if(registerThrow)throw Error('Browser policy refused registration');registers.push({url,options});return Promise.resolve({active});}}:undefined;
 const location=new URL('https://speedy-away.github.io'+pathname),doc={body:{getAttribute:name=>name==='data-host-offline-platform'?'ps4':null},documentElement:{getAttribute:()=>manifest?'/offline/ps4.manifest':null},getElementById:id=>nodes[id]||null};
 const win={location,navigator:{serviceWorker:service},applicationCache:appCache,isSecureContext:secure,setTimeout,clearTimeout,get localStorage(){throw Error('Unexpected storage');},fetch(){throw Error('Unexpected request');}};
 vm.runInNewContext(source,{window:win,document:doc,URL,Promise});
 return {nodes,events,registers,posts,cacheEvents,active,updates:()=>updates,async flush(){await new Promise(setImmediate);},click(){nodes['host-offline-save'].handlers.click();}};
}
test('browse status never registers or saves a service worker without an explicit button click',async()=>{
 const f=fixture({worker:true,button:false,pathname:'/hosts/ps4/',manifest:false});await f.flush();assert.equal(f.registers.length,0);assert.deepEqual(f.posts,[]);assert.match(f.nodes['host-offline-status'].textContent,/No saved offline copy/);
});
test('explicit save registers the bounded worker and displays progress and Cache ready messages',async()=>{
 const f=fixture({worker:true,manifest:false});await f.flush();assert.equal(f.registers.length,0);f.click();await f.flush();assert.equal(f.registers.length,1);assert.equal(f.registers[0].url,'/host-offline-sw.js');assert.equal(f.registers[0].options.scope,'/');assert.deepEqual(JSON.parse(JSON.stringify(f.posts)),[{type:'INSTALL',platform:'ps4'}]);
 f.events.message({source:f.active,data:{type:'PROGRESS',platform:'ps4',completed:3,total:9}});assert.equal(f.nodes['host-offline-progress'].value,3);assert.equal(f.nodes['host-offline-save'].disabled,true);
 f.events.message({source:f.active,data:{type:'CACHED',platform:'ps4',statusOnly:true}});assert.equal(f.nodes['host-offline-save'].disabled,true,'A stale status reply must not end a save');
 f.events.message({source:f.active,data:{type:'CACHED',platform:'ps4'}});assert.match(f.nodes['host-offline-status'].textContent,/Cache ready/);assert.equal(f.nodes['host-offline-save'].disabled,false);
});
test('legacy AppCache progress uses native cache events without worker registration or swapCache',()=>{
 const f=fixture({appCache:{status:1},worker:true});assert.match(f.nodes['host-offline-status'].textContent,/Cache ready/);assert.equal(f.registers.length,0);
 f.cacheEvents.downloading();assert.equal(f.nodes['host-offline-save'].disabled,true);f.cacheEvents.progress({loaded:4,total:10});assert.equal(f.nodes['host-offline-progress'].value,4);assert.equal(f.nodes['host-offline-progress'].max,10);
 f.cacheEvents.updateready();assert.match(f.nodes['host-offline-status'].textContent,/Cache ready.*reopen/);f.click();assert.equal(f.updates(),1);assert.equal(f.registers.length,0);f.cacheEvents.error();assert.match(f.nodes['host-offline-status'].textContent,/earlier saved copy was kept/);
});
test('unsupported browsers get an explicit message and native runtime pages remain untouched',()=>{
 const unsupported=fixture();assert.match(unsupported.nodes['host-offline-status'].textContent,/not supported/);assert.equal(unsupported.nodes['host-offline-save'].disabled,true);
 const native=fixture({worker:true,pathname:'/hosts/runtime/ps4-fixture/web/index.html'});assert.equal(native.registers.length,0);assert.equal(native.nodes['host-offline-save'].handlers.click,undefined);assert.equal(native.nodes['host-offline-status'].textContent,'Save for offline');
});
test('synchronous browser registration refusal restores the controls with an explicit status',async()=>{
 const f=fixture({worker:true,manifest:false,registerThrow:true});await f.flush();f.click();await f.flush();assert.match(f.nodes['host-offline-status'].textContent,/could not start.*policy refused/);assert.equal(f.nodes['host-offline-save'].disabled,false);assert.deepEqual(f.posts,[]);
});

test('enhanced setup shows saved identity and checks files only after an explicit click',async()=>{
 const f=fixture({worker:true,manifest:false,enhanced:true});f.click();await f.flush();f.events.message({source:f.active,data:{type:'CACHED',platform:'ps4',protocol:2,version:'verified-version',files:22,bytes:2097152}});assert.match(f.nodes['host-offline-summary'].textContent,/22 verified files.*2.0 MiB.*verified-ver/);assert.equal(f.nodes['host-offline-verify'].disabled,false);f.nodes['host-offline-verify'].handlers.click();assert.equal(f.posts.at(-1).type,'VERIFY');assert.equal(f.nodes['host-offline-save'].disabled,true);f.events.message({source:f.active,data:{type:'VERIFIED',platform:'ps4',protocol:2,version:'verified-version',files:22,bytes:2097152}});assert.match(f.nodes['host-offline-status'].textContent,/All files match their checksums/);assert.equal(f.nodes['host-offline-save'].disabled,false);
});
test('an older active worker cannot enable an unsupported file check',async()=>{
 const f=fixture({worker:true,manifest:false,enhanced:true});f.click();await f.flush();f.events.message({source:f.active,data:{type:'CACHED',platform:'ps4',version:'old'}});assert.equal(f.nodes['host-offline-verify'].disabled,true);const n=f.posts.length;f.nodes['host-offline-verify'].handlers.click();assert.equal(f.posts.length,n);
});
