'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const {hostActions}=require('../build-host-selector.cjs'),load=require('../../assets/host-site-load.js'),receipt=require('../../assets/host-site-load-receipt.js');
function consoleWindow(platform,firmware){const values=new Map(),loc=new URL('https://speedy-away.github.io/WWB-HOST/hosts/'+platform+'/');const win={location:loc,navigator:{userAgent:'Mozilla/5.0 (PlayStation '+platform.slice(-1)+'/'+firmware+')'},applicationCache:{status:1},sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)},performance:{getEntriesByType:()=>[{type:'navigate'}]},Event:class{constructor(type){this.type=type;}}};win.localStorage=win.sessionStorage;win.document={visibilityState:'visible'};win.self=win.top=win;win.WhatsiteKaro=require('../../assets/host-karo-builds.js');return win;}
test('every exact console firmware route authorizes only after Load and stays on this origin',()=>{for(const p of ['ps4','ps5'])for(const a of hostActions(p).filter(a=>a.category==='loaders'&&a.nativeRoute))for(const f of a.firmwares){const win=consoleWindow(p,f),doc={visibilityState:'visible'};assert.throws(()=>load.start(win,doc,a,false));const url=new URL(load.start(win,doc,a,true));assert.equal(url.origin,win.location.origin);assert.ok(url.pathname.startsWith('/WWB-HOST/hosts/runtime/')||url.pathname.startsWith('/hosts/runtime/'));assert.ok(fs.existsSync(require('path').resolve(__dirname,'../..',url.pathname.replace(/^\/(?:WWB-HOST\/)?/,''))));}});
test('a repeat KARO attempt retains the original restart guard',()=>{const a=hostActions('ps4').find(a=>a.runtimeId==='karo-g2all'),win=consoleWindow('ps4','9.00'),doc={visibilityState:'visible'};load.start(win,doc,a,true);assert.throws(()=>load.start(win,doc,a,true));assert.throws(()=>load.start(win,doc,{...a,nativeRoute:{...a.nativeRoute,runtime:'https://example.com/'}},true));});
test('cache-required GamerHack Load refuses unready caches before reading or changing saved attempt state',()=>{
 const action=hostActions('ps4').find(a=>a.runtimeId==='gamerhack-g2all');assert.ok(action);assert.equal(action.nativeRoute.entry.cacheRequired,true);
 for(const cache of [undefined,{status:0},{status:2},{status:3},{status:5},{status:'unavailable'}]){
  const win=consoleWindow('ps4','14.00'),calls=[],guard=win.WhatsiteKaro,local=new Map([[guard.LOCK,'existing attempt'],['unrelated','keep local']]),session=new Map([[guard.TICKET,'existing ticket'],['unrelated','keep session']]);
  function watched(name,values){return{getItem(key){calls.push([name,'get',key]);return values.get(key)||null;},setItem(key,value){calls.push([name,'set',key]);values.set(key,String(value));},removeItem(key){calls.push([name,'remove',key]);values.delete(key);}};}
  win.applicationCache=cache;win.localStorage=watched('local',local);win.sessionStorage=watched('session',session);const location=win.location.href;
  assert.throws(()=>load.start(win,win.document,action,true),/Cache ready/,String(cache&&cache.status));
  assert.deepEqual(calls,[]);assert.deepEqual([...local],[[guard.LOCK,'existing attempt'],['unrelated','keep local']]);assert.deepEqual([...session],[[guard.TICKET,'existing ticket'],['unrelated','keep session']]);assert.equal(win.location.href,location);
 }
});
test('a ready cache permits one explicit GamerHack handoff and preserves the existing restart lock',()=>{
 const action=hostActions('ps4').find(a=>a.runtimeId==='gamerhack-g2all');
 for(const status of [1,4]){
  const win=consoleWindow('ps4','14.00'),guard=win.WhatsiteKaro;win.applicationCache.status=status;
  assert.throws(()=>load.start(win,win.document,action,false));assert.equal(win.localStorage.getItem(guard.LOCK),null);assert.equal(win.sessionStorage.getItem(guard.TICKET),null);
  const target=new URL(load.start(win,win.document,action,true));assert.equal(target.origin,win.location.origin);assert.equal(target.pathname,action.nativeRoute.runtime+action.nativeRoute.entry.path);
  const savedTicket=win.sessionStorage.getItem(guard.TICKET),savedLock=win.localStorage.getItem(guard.LOCK),ticket=JSON.parse(savedTicket);assert.equal(ticket.firmware,'14.00');assert.equal(ticket.entry,'g2all/index.html');assert.equal(ticket.started,false);assert.deepEqual(ticket.visited,[]);
  assert.throws(()=>load.start(win,win.document,action,true),/previous native attempt/);assert.equal(win.sessionStorage.getItem(guard.TICKET),savedTicket);assert.equal(win.localStorage.getItem(guard.LOCK),savedLock);
 }
});
function received(overrides={}){const win=consoleWindow('ps4','14.00');win.location=new URL('https://speedy-away.github.io/WWB-HOST/hosts/runtime/ps4-afterglow-acf25a831725/web/index.html');let submits=0;const radio={},form={querySelector:()=>radio,dispatchEvent:()=>{submits++;}},button={disabled:false};const doc={visibilityState:'visible',referrer:'https://speedy-away.github.io/WWB-HOST/hosts/ps4/',getElementById:id=>id==='pick'?form:button};const ticket={origin:win.location.origin,target:win.location.pathname,firmware:'14.00',at:Date.now(),payload:'goldhen',...overrides};win.sessionStorage.setItem(receipt.key,JSON.stringify(ticket));return {win,doc,radio,get submits(){return submits;}};}
test('GoldHEN receipt starts the genuine form exactly once and selects the supplied payload',()=>{const a=received();assert.equal(receipt.install(a.win,a.doc),true);assert.equal(a.radio.checked,true);assert.equal(a.submits,1);assert.equal(receipt.install(a.win,a.doc),false);});
test('stale, cross-origin, hidden, restored and mismatched GoldHEN receipts remain inert',()=>{for(const mutate of [a=>a.doc.referrer='https://example.com/',a=>a.doc.visibilityState='hidden',a=>a.win.performance.getEntriesByType=()=>[{type:'reload'}],a=>a.doc.wasDiscarded=true]){const a=received();mutate(a);assert.equal(receipt.install(a.win,a.doc),false);assert.equal(a.submits,0);}for(const ticket of [{at:Date.now()-31000},{firmware:'13.52'},{origin:'https://example.com'}]){const a=received(ticket);assert.equal(receipt.install(a.win,a.doc),false);assert.equal(a.submits,0);}});
test('PS4 and PS5 keep the firmware picker open on the loader tab and collapse it elsewhere',()=>{
 const source=fs.readFileSync(require('path').resolve(__dirname,'../../assets/host-folders.js'),'utf8');
 for(const platform of ['ps4','ps5'])for(const view of ['loaders','payloads','mods','tools']){
  const nodes={};
  function element(tagName){return{tagName,textContent:'',children:[],parentNode:{insertBefore(){}},getAttribute:()=>null,querySelector:()=>null,
   appendChild(child){if(child.parentNode.children)child.parentNode.children=child.parentNode.children.filter(node=>node!==child);this.children.push(child);child.parentNode=this;},click(){}};}
  const node=id=>nodes[id]||(nodes[id]=element('div'));
  const control=node('firmware-control'),toolbar=node('host-file-firmware');
  const doc={documentElement:element('html'),getElementById:id=>id==='host-actions-data'?{textContent:JSON.stringify({platform})}:node(id),
   querySelector:s=>s==='.host-firmware-control'?control:s==='.host-taskbar a'?node('back'):s==='#host-status'?node('status'):null,
   querySelectorAll:()=>[],addEventListener(){},createElement:element};
  const location=new URL('https://example.com/hosts/'+platform+'/?view='+view);
  vm.runInNewContext(source,{window:{WWB_HOST_CATALOG:{platform}},document:doc,location,URL,MutationObserver:class{observe(){}}});
  if(view==='loaders')assert.equal(control.parentNode,toolbar);
  else{
   assert.equal(control.parentNode.tagName,'details');
   assert.equal(control.parentNode.parentNode,toolbar);
   assert.equal(control.parentNode.open,undefined);
  }
 }
});



test('GoldHEN one-use receipt works on the renamed lowercase Pages path',()=>{const a=received();a.win.location=new URL(a.win.location.href.replace('/WWB-HOST/','/wwb-host/'));a.doc.referrer=a.doc.referrer.replace('/WWB-HOST/','/wwb-host/');const ticket=JSON.parse(a.win.sessionStorage.getItem(receipt.key));ticket.target=a.win.location.pathname;a.win.sessionStorage.setItem(receipt.key,JSON.stringify(ticket));assert.equal(receipt.install(a.win,a.doc),true);assert.equal(a.submits,1);});


test('only builtin PS5 UMTX uses its own trusted dashboard ticket, with every exact firmware pinned',()=>{
 const {fixture}=require('./host-continuation-dom.cjs'),all=['ps4','ps5'].flatMap(p=>hostActions(p).filter(a=>a.category==='loaders'&&!a.nativeRoute));assert.deepEqual(all.map(a=>a.id),['built-in-ps5-umtx']);const action=all[0];assert.equal(action.platform,'ps5');assert.equal(action.runtimeId,'ps5-umtx');assert.equal(action.firmwares.length,23);assert.equal(action.launchURL,'/hosts/runtime/ps5-umtx/web/index.html');
 for(const firmware of action.firmwares){
  const win=consoleWindow('ps5',firmware);assert.throws(()=>load.start(win,{visibilityState:'visible'},action,true),'The nativeRoute controller must not invent the separate builtin contract');
  const f=fixture({platform:'ps5',actions:[action],initialCategory:'loaders',catalogGrid:true,userAgent:'PlayStation 5/'+firmware}),grid=f.ids['host-action-grid'],button=grid.querySelector('[data-launch="built-in-ps5-umtx"]');assert.ok(button,firmware);assert.equal(button.disabled,false);
  grid.fire('click',{target:button,isTrusted:false});assert.equal(f.window.sessionStorage.getItem('wwb.ps5.load.request.v1'),null);assert.ok(!f.window.location.href.includes('/hosts/runtime/'));
  grid.fire('click',{target:button,isTrusted:true});const ticket=f.window.sessionStorage.getItem('wwb.ps5.load.request.v1');assert.equal(JSON.parse(ticket).firmware,firmware);assert.ok(f.window.location.href.endsWith(action.launchURL));assert.equal(button.disabled,true);grid.fire('click',{target:button,isTrusted:true});assert.equal(f.window.sessionStorage.getItem('wwb.ps5.load.request.v1'),ticket);assert.equal(f.sends.length+f.opened.length+f.checks.length,0);
 }
});
