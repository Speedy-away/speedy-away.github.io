'use strict';
// Exercise authored selection and authorization only. Never load a native runtime.
const test=require('node:test'),assert=require('node:assert/strict');
const dashboard=require('../../assets/host-dashboard.js'),load=require('../../assets/host-site-load.js'),registry=require('../host-firmware-placeholders.cjs'),{hostActions}=require('../build-host-selector.cjs'),{fixture}=require('./host-continuation-dom.cjs');
const expected={ps4:['14.02'],ps5:['14.00','14.10','14.20']};
function make(platform,options={}){
 const actions=options.actions||hostActions(platform),sessionStore=new Map(),app=fixture({platform,actions,catalogGrid:true,firmwareChoicesOnly:true,initialCategory:'loaders',firmwareButtons:[...dashboard.availableBrowserFirmwares(actions),...registry.versions[platform]],sessionStore,...options,dashboardApi:{install(doc,win){const node=doc.querySelector('#host-actions-data'),catalog=JSON.parse(node.textContent);catalog.placeholderFirmwares=registry.versions[platform];node.textContent=JSON.stringify(catalog);dashboard.install(doc,win);}}});
 return {...app,sessionStore};
}
function pressed(app){return app.ids['host-firmware-buttons'].querySelectorAll('[data-host-firmware]').filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.getAttribute('data-host-firmware'));}
function noDispatch(app){for(const list of [app.checks,app.sends,app.pairs,app.opened,app.anchorClicks])assert.equal(list.length,0);assert.equal(app.sessionStore.size,0);}
function empty(app,version){
 assert.equal(app.ids['host-firmware'].value,version);assert.deepEqual(pressed(app),[version]);
 const button=app.ids['host-firmware-buttons'].querySelector('[data-host-firmware="'+version+'"]');assert.ok(button);assert.equal(button.hidden,false);assert.equal(button.disabled,false);
 assert.equal(app.ids['host-empty'].hidden,false);assert.equal(app.ids['host-empty'].textContent,'No loader has been added for '+app.platform.toUpperCase()+' '+version+' yet.');
 assert.equal(app.ids['host-firmware-status'].textContent,'Firmware '+version+' · No loader added yet');assert.equal(app.ids['host-action-grid'].querySelectorAll('[data-launch],[data-choose-group],.host-firmware-family').length,0);noDispatch(app);
}
test('display-only firmware registry names exactly the requested canonical choices without extending available native routes',()=>{
 assert.deepEqual(registry.versions,expected);
 for(const platform of ['ps4','ps5']){const actions=hostActions(platform),before=JSON.stringify(actions),available=dashboard.availableBrowserFirmwares(actions);for(const version of expected[platform]){assert.equal(available.includes(version),false);assert.ok(actions.filter(a=>a.browserHost||a.nativeRoute).every(a=>!(a.firmwares||[]).includes(version)));}const app=make(platform,{actions});for(const version of expected[platform])app.selectFirmware(version);assert.equal(JSON.stringify(actions),before);assert.deepEqual(dashboard.availableBrowserFirmwares(actions),available);noDispatch(app);}
});
test('manual empty firmware choices stay selectable, persist and reopen with the accurate empty state on both hosts',()=>{
 for(const platform of ['ps4','ps5'])for(const version of expected[platform]){
  const storage=new Map(),app=make(platform,{storage});app.selectFirmware(version);empty(app,version);assert.equal(app.ids['host-firmware-source'].textContent,'Firmware selection: manual');assert.equal(JSON.parse(storage.get(app.storageKey)).firmware,version);
  const restored=make(platform,{storage});empty(restored,version);assert.equal(restored.ids['host-firmware-source'].textContent,'Firmware selection: saved choice');assert.equal(restored.ids['host-firmware-buttons'].querySelectorAll('[data-host-firmware="'+version+'"]').length,1);
 }
});
test('matching console detection selects empty firmware and Detect restores it after another manual choice',()=>{
 for(const platform of ['ps4','ps5'])for(const version of expected[platform]){
  const app=make(platform,{userAgent:'Mozilla/5.0 (PlayStation '+platform.slice(-1)+'/'+version+')'});empty(app,version);assert.equal(app.ids['host-firmware-source'].textContent,'Firmware selection: console browser');
  const supported=platform==='ps4'?'9.00':'4.51';app.selectFirmware(supported);assert.equal(app.ids['host-firmware'].value,supported);app.ids['host-detect'].click();empty(app,version);assert.equal(app.ids['host-firmware-buttons'].querySelectorAll('[data-host-firmware="'+version+'"]').length,1);assert.equal(JSON.parse(app.storage.get(app.storageKey)).firmware,version);
 }
 const alias=make('ps5',{userAgent:'Mozilla/5.0 (PlayStation 5/14.0)'});empty(alias,'14.00');assert.equal(alias.ids['host-firmware-buttons'].querySelectorAll('[data-host-firmware="14.0"]').length,0);
});
test('PS5 still rejects an undeclared firmware rather than turning arbitrary versions into placeholders',()=>{
 const app=make('ps5',{userAgent:'Mozilla/5.0 (PlayStation 5/13.90)'});assert.equal(app.ids['host-firmware'].value,'');assert.equal(app.ids['host-firmware-buttons'].querySelector('[data-host-firmware="13.90"]'),null);assert.equal(app.ids['host-action-grid'].querySelector('[data-launch]'),null);assert.match(app.ids['host-firmware-status'].textContent,/No Load route for browser firmware 13\.90/);noDispatch(app);
});
test('every existing native authorization route refuses placeholder versions before touching tickets or attempt state',()=>{
 let cases=0;
 for(const platform of ['ps4','ps5']){
  const actions=hostActions(platform),before=JSON.stringify(actions);
  for(const version of expected[platform])for(const action of actions.filter(a=>a.nativeRoute)){
   const calls=[],storage={getItem(key){calls.push(['get',key]);return null;},setItem(key){calls.push(['set',key]);},removeItem(key){calls.push(['remove',key]);}},win={navigator:{userAgent:'PlayStation '+platform.slice(-1)+'/'+version},location:new URL('https://speedy-away.github.io/hosts/'+platform+'/'),localStorage:storage,sessionStorage:storage,document:{visibilityState:'visible'}};win.self=win.top=win;
   assert.throws(()=>load.start(win,win.document,action,true),/matching console browser and firmware/);assert.deepEqual(calls,[],action.id+' '+version);cases++;
  }
  assert.equal(JSON.stringify(actions),before);
 }
 assert.ok(cases>=12);
});
test('markup adapter adds only platform placeholders once and preserves all action arrays and runtime documents',()=>{
 for(const platform of ['ps4','ps5']){
  const actions=hostActions(platform),catalog={platform,actions,firmwareChoicesOnly:true},original='<html><div id="host-firmware-buttons"><button data-host-firmware="9.00">9.00</button></div><script id="host-actions-data" type="application/json">'+JSON.stringify(catalog).replaceAll('<','\\u003c')+'</script></html>',name='hosts/'+platform+'/index.html',html=registry.apply(original,name),decoded=JSON.parse(html.match(/<script id="host-actions-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(decoded.actions,actions);assert.deepEqual(decoded.placeholderFirmwares,expected[platform]);assert.equal(registry.apply(html,name),html);for(const version of expected[platform])assert.equal((html.match(new RegExp('data-host-firmware="'+version.replace('.','\\.')+'"','g'))||[]).length,1);
  assert.equal(registry.apply(original,'hosts/runtime/pinned/web/index.html'),original);assert.equal(registry.apply(original,'hosts/'+(platform==='ps4'?'ps5':'ps4')+'/index.html').includes('placeholderFirmwares'),false);
 }
});
