'use strict';
// Evaluate authored UI only. Console scripts and binaries are never executed.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function store(){const data=new Map();return{data,getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
function worker(){
 const all=new Map(),events={},messages=[],base='https://test.invalid/runtime/',prefix='wwb-afterglow-1402-944d5aeed06f-v1';
 const caches={async open(name){if(!all.has(name))all.set(name,new Map());const m=all.get(name);return{async match(url){return m.get(String(url))?.clone();},async put(url,r){m.set(String(url),r.clone());}};},async keys(){return [...all.keys()];},async delete(n){return all.delete(n);}};
 let files={'index.html':'old inert page','settings.js':'inert preference bytes'},bad=false,pending=false,started;
 const startedPromise=new Promise(r=>started=r);
 const context={URL,Response,TextEncoder,AbortController,setTimeout,clearTimeout,crypto:crypto.webcrypto,caches,self:{location:new URL(base+'offline-sw.js'),addEventListener:(e,f)=>events[e]=f,skipWaiting:async()=>{},clients:{claim:async()=>{}}},fetch:async(url,options)=>{
  if(url.endsWith('offline-files.json'))return new Response(JSON.stringify(Object.entries(files).map(([path,b])=>({path,bytes:Buffer.byteLength(b),sha256:hash(b)}))));
  if(pending){started();return new Response(new ReadableStream({start(c){options.signal.addEventListener('abort',()=>c.error(Error('Aborted')));}}));}
  return new Response(bad?'wrong':files[url.slice(base.length)]);
 }};
 vm.runInNewContext(read('assets/afterglow-offline-sw.js'),context);
 const source={url:base+'index.html',postMessage:m=>messages.push(m)};
 return{all,caches,events,messages,base,prefix,startedPromise,change(value){files={'index.html':value,'settings.js':'inert preference bytes'};},bad(){bad=true;},pending(){pending=true;},async send(type,client=source){let task;events.message({data:{type:'afterglow-cache-'+type},source:client,waitUntil:p=>task=p});await task;},async page(){let task;events.fetch({request:{url:base+'index.html',method:'GET'},respondWith:p=>task=p});return(await task).text();}};
}
test('verified cache update switches a complete generation and serves the new page',async()=>{const w=worker();await w.send('save');assert.equal(await w.page(),'old inert page');w.change('new inert page');await w.send('update');assert.equal(await w.page(),'new inert page');assert.equal(w.messages.at(-1).updated,true);});
test('failed update preserves the complete old cache and reports its retention',async()=>{const w=worker();await w.send('save');w.change('new inert page');w.bad();await w.send('update');assert.equal(await w.page(),'old inert page');assert.equal(w.messages.at(-1).state,'error');assert.equal(w.messages.at(-1).saved,true);});
test('stop aborts an unfinished response body and retains the previous cache',async()=>{const w=worker();await w.send('save');w.change('new');w.pending();const save=w.send('update');await w.startedPromise;await w.send('stop');await save;assert.equal(w.messages.at(-1).state,'stopped');assert.equal(await w.page(),'old inert page');});
test('delete stops an active download, removes only this runtime caches, and reports completion',async()=>{const w=worker();await w.send('save');await w.caches.open('unrelated');w.change('new');w.pending();const save=w.send('update');await w.startedPromise;await w.send('delete');await save;assert.deepEqual(await w.caches.keys(),['unrelated']);assert.equal(w.messages.at(-1).state,'deleted');});
test('cache ignores cross-origin and other-runtime commands',async()=>{const w=worker();await w.send('save',{url:'https://evil.invalid/runtime/index.html',postMessage(){throw Error('foreign');}});await w.send('delete',{url:'https://test.invalid/other/index.html',postMessage(){throw Error('foreign');}});assert.equal(w.all.size,0);});
function run(options={}){
 const ls=store(),ss=store(),nodes={out:{textContent:''},'bare-status':{textContent:''}},timers=[];let observer,redirect;
 ls.setItem('wwb.afterglow.1402.settings.v1',JSON.stringify(options));
 const document={documentElement:{className:''},body:{className:'log'},getElementById:id=>nodes[id]};
 vm.runInNewContext(read('assets/afterglow-1402-run-options.js'),{localStorage:ls,sessionStorage:ss,document,Date,location:{replace:s=>redirect=s},setTimeout:fn=>timers.push(fn),MutationObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){}}});
 return{ss,document,nodes,timers,get redirect(){return redirect;},log(s,fail=false){nodes.out.textContent=s;if(fail)document.body.className='fail';observer?.();}};
}
test('retry requires explicit pre-kernel failure, is bounded to once, and never uses a timeout',()=>{
 for(const text of ['', 'exploit failed - please retry (reopen browser)','AG  kernel starting\nJB-THREW  error','AG-FAIL  error']){const r=run();r.log(text,true);assert.equal(r.redirect,undefined);assert.equal(r.timers.length,0);}
 const r=run();r.log('JB-THREW  primitive failed');assert.equal(r.redirect,'index.html?restored=1&retry=1');assert.equal(r.ss.getItem('wwb.afterglow.1402.retry.used'),'1');
 const used=run();used.ss.setItem('wwb.afterglow.1402.retry.used','1');used.log('JB-THREW  error');assert.equal(used.redirect,undefined);
 const off=run({retry:false});off.log('JB-THREW  error');assert.equal(off.redirect,undefined);
});
test('reload needs explicit completion and defused handles, then returns without rearming',()=>{
 const unsafe=run({reload:true});unsafe.log('AG  the handles are NOT defused\nAG  done');assert.equal(unsafe.timers.length,0);
 const r=run({reload:true});r.log('AG  handles defused\nAG  done');assert.equal(r.timers.length,1);r.timers[0]();assert.equal(r.redirect,'index.html?restored=1&result=success');
 const off=run({reload:false});off.log('AG  handles defused\nAG  done');assert.equal(off.timers.length,0);
});
test('barebone hides detailed output and still displays a terminal result',()=>{const r=run({barebone:true});assert.match(r.document.documentElement.className,/barebone/);r.log('AG  done');assert.equal(r.nodes['bare-status'].textContent,'Jailbreak complete');});
test('settings persist, advanced tools hide, and Auto Jailbreak uses the landing countdown',()=>{
 const nodes={},events={},ls=store();let stopped=0,auto=false;
 const node=id=>nodes[id]||(nodes[id]={hidden:id==='settings-panel',checked:false,disabled:false,setAttribute(k,v){this[k]=v;},focus(){},addEventListener:(e,fn)=>events[id+':'+e]=fn});
 const window={AfterglowLanding:{stop(){stopped++;},isAuto:()=>auto,setAuto(v){auto=v;window.AfterglowSettingsUpdated();}}};
 vm.runInNewContext(read('assets/afterglow-1402-settings.js'),{window,document:{getElementById:node,addEventListener:(e,fn)=>events[e]=fn},localStorage:ls});
 assert.equal(nodes['setting-advanced'].checked,true);assert.equal(nodes['setting-retry'].checked,true);events['settings-open:click']();assert.equal(nodes['settings-panel'].hidden,false);assert.equal(stopped,1);
 nodes['setting-advanced'].checked=false;events['setting-advanced:change']();assert.equal(nodes['advanced-payloads'].hidden,true);assert.equal(JSON.parse(ls.getItem('wwb.afterglow.1402.settings.v1')).advanced,false);
 nodes['setting-auto'].checked=true;events['setting-auto:change']();assert.equal(auto,true);events.keydown({key:'Escape'});assert.equal(nodes['settings-panel'].hidden,true);
});
test('offline closure includes every local loader and settings dependency; 14.02 excludes the old 9.00 listener',()=>{
 const b=JSON.parse(read('docs/afterglow-1402-build.json')),base=b.base+'/web/';
 const files=JSON.parse(read(base+'offline-files.json')).map(f=>f.path);
 for(const f of ['settings.js','loaders.html','ps4-loaders.js','ps4-loaders.css','ps4-loader-client.js','host-console-client.js','elfldr.bin','elfldr.elf','ps4-loader-sender.zip'])assert.ok(files.includes(f),f);
 const html=read(base+'loaders.html');assert.doesNotMatch(html,/value="bin-tcp"|src="https?:|href="\/assets/);assert.match(html,/"firmware":"14.02"/);assert.match(html,/value="14.02" readonly/);
});
test('PS4 delete disables caching and gives manual browser steps without claiming deletion',()=>{
 const events={},nodes={},ls=store();const node=id=>nodes[id]||(nodes[id]={hidden:true,checked:false,addEventListener:(e,fn)=>events[id+':'+e]=fn,removeAttribute(){}});
 const window={applicationCache:{},addEventListener:(e,fn)=>events[e]=fn};
 vm.runInNewContext(read('assets/afterglow-cache.js'),{window,document:{getElementById:node},navigator:{},localStorage:ls});
 events['cache-delete:click']();assert.equal(nodes['cache-delete-help'].hidden,false);assert.match(nodes['cache-status'].textContent,/PS4 browser settings/);assert.doesNotMatch(nodes['cache-status'].textContent,/cache deleted/);assert.equal(ls.getItem('wwb.afterglow.1402.cache.enabled'),'false');
});
test('modern deletion sends to the active worker without needing an online update',async()=>{
 const events={},nodes={},ls=store(),sent=[];let updates=0;
 const worker={postMessage:m=>sent.push(m)},sw={addEventListener:(e,f)=>events['sw:'+e]=f,getRegistration:async()=>({active:worker}),register:async()=>{updates++;throw Error('offline');}};
 const node=id=>nodes[id]||(nodes[id]={hidden:true,checked:false,addEventListener:(e,fn)=>events[id+':'+e]=fn,removeAttribute(){}});
 vm.runInNewContext(read('assets/afterglow-cache.js'),{window:{caches:{},addEventListener:(e,f)=>events[e]=f},document:{getElementById:node},navigator:{serviceWorker:sw},localStorage:ls});
 events['cache-delete:click']();await new Promise(r=>setImmediate(r));assert.equal(updates,0);assert.equal(sent.at(-1).type,'afterglow-cache-delete');events['sw:message']({source:worker,data:{type:'afterglow-cache',state:'deleted'}});assert.match(nodes['cache-status'].textContent,/cache deleted/);
});
