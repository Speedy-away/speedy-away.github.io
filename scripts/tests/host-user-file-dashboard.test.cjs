'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const ui=require('../../assets/host-dashboard.js');
const {fixture,flush,deferred}=require('./host-continuation-dom.cjs');
const data=Buffer.from([1,2,3,4]);
const action={id:'fixture-selected-bin',platform:'ps4',label:'Fixture original BIN',category:'mods',game:'Fixture source tool',gameVersion:'1.00',menuVersion:null,firmwares:['9.00'],format:'BIN',bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),downloadURL:'https://example.test/original.bin',consoleFileId:'fixture-original-bin',requirements:[],run:{type:'goldhen-http',port:9090,input:'user-file'}};
const advert={id:action.id,platform:'ps4',available:true,requiresFile:true,format:'BIN',bytes:action.bytes};
const connected=(overrides={})=>({status:'connected',capabilities:{uncertainOutcomes:true,userSelectedBIN:true},actions:[advert],...overrides});
const selected=(overrides={})=>({name:'original.bin',size:data.length,...overrides});

function pickerFixture(){
  let input,clicks=0,appends=0,removals=0,nextTimer=0;
  const windowEvents={},timers=new Map();
  const body={appendChild(node){appends++;node.parentNode=this;},removeChild(node){assert.equal(node.parentNode,this);removals++;node.parentNode=null;}};
  const document={body,createElement(tag){assert.equal(tag,'input');const handlers={};input={files:[],style:{},hidden:false,parentNode:null,addEventListener(type,fn){(handlers[type]||=[]).push(fn);},removeEventListener(type,fn){handlers[type]=(handlers[type]||[]).filter(old=>old!==fn);},setAttribute(k,v){this[k]=v;},click(){clicks++;},fire(type){for(const fn of [...handlers[type]||[]])fn({target:this});}};return input;}};
  const window={addEventListener(type,fn){(windowEvents[type]||=[]).push(fn);},removeEventListener(type,fn){windowEvents[type]=(windowEvents[type]||[]).filter(old=>old!==fn);},setTimeout(fn,ms){assert.ok(ms>=0);timers.set(++nextTimer,fn);return nextTimer;},clearTimeout(id){timers.delete(id);}};
  return{document,window,get input(){return input;},get clicks(){return clicks;},get appends(){return appends;},get removals(){return removals;},get timerCount(){return timers.size;},get focusListeners(){return(windowEvents.focus||[]).length;},focus(){for(const fn of [...windowEvents.focus||[]])fn();},runTimers(){for(const [id,fn]of [...timers]){timers.delete(id);fn();}}};
}

function appFixture(){
  const app=fixture({actions:[action],pairDeferred:true}),fileCalls=[],inputs=[],pending=[];
  const createElement=app.document.createElement.bind(app.document);
  let inLoadGesture=false;
  app.document.createElement=function(tag){const node=createElement(tag);if(tag==='input'){inputs.push(node);node.click=function(){node.clickedInLoadGesture=inLoadGesture;node.fire('click');};}return node;};
  app.window.setTimeout=setTimeout;app.window.clearTimeout=clearTimeout;
  app.window.removeEventListener=function(){};
  app.window.HostConsoleClient.runFileViaBridge=function(address,chosenAction,file,token,platform,options){const p=deferred();fileCalls.push({address,action:chosenAction,file,token,platform,options});pending.push(p);return p.promise;};
  return{...app,fileCalls,pending,inputs,loadWithGesture(){inLoadGesture=true;try{return app.load();}finally{inLoadGesture=false;}},get fileInput(){return inputs.find(node=>node.type==='file'||node.getAttribute('type')==='file');}};
}
async function pair(app,reply=connected()){
  app.pair();app.pairs[app.pairs.length-1].resolve(reply);await flush();
}

test('user-file readiness requires the exact sender capability and matching action advertisement',()=>{
  assert.equal(ui.bridgeFileReady(action,connected(),'ps4'),true);
  for(const bridge of [null,{},connected({status:'unavailable'}),connected({capabilities:{uncertainOutcomes:true}}),connected({capabilities:{userSelectedBIN:false}}),connected({actions:[{...advert,platform:'ps5'}]}),connected({actions:[{...advert,id:'other-bin'}]}),connected({actions:[{...advert,available:false}]}),connected({actions:[{...advert,requiresFile:false}]}),connected({actions:[{...advert,format:'ELF'}]}),connected({actions:[{...advert,bytes:action.bytes+1}]})])assert.equal(ui.bridgeFileReady(action,bridge,'ps4'),false);
  assert.equal(ui.bridgeFileReady(action,connected(),'ps5'),false);
  for(const changed of [{platform:'ps5'},{format:'ELF'},{run:{type:'goldhen-http',port:9090}},{run:{type:'goldhen-http',port:9020,input:'user-file'}},{run:{type:'bin-tcp',port:9021,input:'user-file'}}])assert.equal(ui.bridgeFileReady({...action,...changed},connected(),'ps4'),false);
});

test('the native chooser starts synchronously and returns one exact-size BIN without retaining its temporary input',async()=>{
  const p=pickerFixture(),chosen=selected({name:'original (1).BIN'}),promise=ui.choosePayloadFile(p.document,p.window,action);
  assert.equal(p.clicks,1,'input.click must run in the original Load gesture');assert.equal(p.appends,1);
  assert.equal(p.input.type,'file');assert.match(p.input.accept,/\.bin/i);assert.ok(!p.input.multiple);
  p.input.files=[chosen];p.input.fire('change');assert.equal(await promise,chosen);assert.equal(p.removals,1);assert.equal(p.focusListeners,0);assert.equal(p.timerCount,0);
  p.input.fire('cancel');p.focus();p.runTimers();assert.equal(p.removals,1,'Late cancellation cannot settle or clean up twice');
});

test('chooser cancellation, empty change and focus return resolve without a file and always clean up',async()=>{
  for(const mode of ['cancel','empty-change','focus']){
    const p=pickerFixture(),promise=ui.choosePayloadFile(p.document,p.window,action);
    if(mode==='cancel')p.input.fire('cancel');
    else if(mode==='empty-change')p.input.fire('change');
    else{p.focus();assert.equal(p.removals,0,'Focus fallback must allow the change event to arrive first');p.runTimers();}
    assert.equal(await promise,null,mode);assert.equal(p.removals,1,mode);assert.equal(p.focusListeners,0,mode);assert.equal(p.timerCount,0,mode);
  }
});

test('chooser rejects wrong size, unsupported extension and multiple files before any transfer helper runs',async()=>{
  for(const files of [[selected({size:data.length-1})],[selected({size:data.length+1})],[selected({name:'original.elf'})],[selected({name:'original.bin.zip'})],[selected(),selected()]]){
    const p=pickerFixture(),promise=ui.choosePayloadFile(p.document,p.window,action);p.input.files=files;p.input.fire('change');
    await assert.rejects(promise);assert.equal(p.removals,1);assert.equal(p.focusListeners,0);
  }
  const p=pickerFixture();p.document.createElement=function(){throw Error('File picker unavailable');};
  await assert.rejects(ui.choosePayloadFile(p.document,p.window,action),/unavailable/);
});

test('the rendered file Load never unlocks for an older sender or falls back to fetching the remote URL',async()=>{
  const app=appFixture();app.openMenu();assert.equal(app.loadWithGesture().disabled,true);assert.equal(app.inputs.length,0);
  await pair(app,connected({capabilities:{uncertainOutcomes:true}}));assert.equal(app.loadWithGesture().disabled,true);assert.equal(app.inputs.length,0);
  await pair(app,connected({actions:[{...advert,requiresFile:false}]}));assert.equal(app.loadWithGesture().disabled,true);assert.equal(app.inputs.length,0);
  assert.equal(app.sends.length,0);assert.equal(app.fileCalls.length,0);assert.equal(app.opened.length,0);
});

test('valid user-file Load opens its chooser in the click and sends only through the paired file route',async()=>{
  const app=appFixture();await pair(app);app.openMenu();assert.equal(app.loadWithGesture().disabled,false);
  const input=app.fileInput;assert.ok(input);assert.equal(input.clickedInLoadGesture,true);assert.equal(app.fileCalls.length,0);assert.equal(app.sends.length,0);
  const file=selected();input.files=[file];input.fire('change');await flush();
  assert.equal(app.fileCalls.length,1);assert.equal(app.sends.length,0);assert.equal(app.fileCalls[0].address,'192.168.1.40');assert.equal(app.fileCalls[0].action.id,action.id);assert.equal(app.fileCalls[0].file,file);assert.equal(app.fileCalls[0].token,'fixture-token');assert.equal(app.fileCalls[0].platform,'ps4');assert.equal(app.fileCalls[0].options.firmware,'9.00');
  app.pending[0].resolve({status:'accepted',message:'Mock exact file transfer only'});await flush();
  assert.match(app.ids['host-status'].textContent,/Mock exact file transfer only/);assert.equal(app.ids['host-version-detail'].querySelector('[data-launch]').disabled,false);
  assert.ok(!JSON.stringify([...app.storage.values()]).includes('original.bin'),'Only connection state may persist, not the selected file');
});

test('cancelled or invalid selection releases the Load lock without sending or opening another page',async()=>{
  for(const mode of ['cancel','wrong-size']){
    const app=appFixture();await pair(app);app.openMenu();app.loadWithGesture();
    assert.equal(app.opened.length,0);
    if(mode==='cancel')app.fileInput.fire('cancel');else{app.fileInput.files=[selected({size:1})];app.fileInput.fire('change');}
    await flush();assert.equal(app.fileCalls.length,0);assert.equal(app.sends.length,0);assert.equal(app.opened.length,0);assert.equal(app.ids['host-version-detail'].querySelector('[data-launch]').disabled,false,mode);
  }
});

test('selected-file loading requires a separate explicit Download when copy-on-Load is checked',async()=>{
  const app=appFixture();await pair(app);app.openMenu();app.ids['host-download-on-run'].checked=true;app.loadWithGesture();
  assert.equal(app.inputs.length,0,'Do not choose or dispatch before the incompatible copy option is resolved');assert.equal(app.opened.length,0);assert.equal(app.sends.length,0);assert.equal(app.fileCalls.length,0);
  assert.match(app.ids['host-status'].textContent,/Download separately|turn off Download/i);
  app.ids['host-download-on-run'].checked=false;assert.equal(app.loadWithGesture().disabled,false);assert.ok(app.fileInput,'Clearing the option must not leave a stale loading lock');app.fileInput.fire('cancel');await flush();
});

test('configuration changes while choosing a file prevent dispatch to a changed target or pairing session',async()=>{
  for(const change of ['address','token','bridge-url']){
    const app=appFixture();await pair(app);app.openMenu();app.loadWithGesture();
    if(change==='address')app.setAddress('192.168.1.41');
    else if(change==='token')app.ids['host-bridge-token'].value='a-new-session-token';
    else app.ids['host-bridge-url'].value='http://127.0.0.1:8767';
    app.fileInput.files=[selected()];app.fileInput.fire('change');await flush();
    assert.equal(app.fileCalls.length,0,change);assert.equal(app.sends.length,0,change);assert.equal(app.opened.length,0,change);assert.equal(app.ids['host-version-detail'].querySelector('[data-launch]').disabled,false,change);
  }
});

test('an uncertain selected-file transfer retains the existing warning lock and never retries',async()=>{
  const app=appFixture();await pair(app);app.openMenu();app.loadWithGesture();app.fileInput.files=[selected()];app.fileInput.fire('change');await flush();
  app.pending[0].resolve({status:'uncertain',mayHaveExecuted:true,message:'Check the console before trying again.'});await flush();
  assert.equal(app.fileCalls.length,1);assert.equal(app.loadWithGesture().disabled,true);assert.equal(app.fileCalls.length,1);assert.equal(app.sends.length,0);
  const stored=JSON.parse(app.storage.get(app.storageKey));assert.equal(stored.uncertainTransfers['192.168.1.40'].actionId,action.id);
});

test('the client receives a live state guard that refuses settings changes during asynchronous file verification',async()=>{
  const app=appFixture();await pair(app);app.openMenu();app.loadWithGesture();app.fileInput.files=[selected()];app.fileInput.fire('change');await flush();
  assert.equal(app.fileCalls.length,1);
  const guard=app.fileCalls[0].options.beforeDispatch;assert.equal(typeof guard,'function');assert.doesNotThrow(()=>guard());
  app.setAddress('192.168.1.41');assert.throws(()=>guard(),/settings changed|selection changed|Nothing was sent/i);
  assert.equal(app.sends.length,0);
  app.pending[0].reject(Error('Mock state guard refused before dispatch.'));await flush();
  assert.ok(!JSON.parse(app.storage.get(app.storageKey)).uncertainTransfers['192.168.1.40'],'A pre-dispatch refusal must not become an uncertain execution');
});
