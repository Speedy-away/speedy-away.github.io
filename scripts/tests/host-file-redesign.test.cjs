'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./host-continuation-dom.cjs');

function action(id, overrides={}) {
  return {
    id:'ps4-redesign-'+id,label:'Fixture build '+id,menuFamily:'Fixture family',platform:'ps4',
    category:'mods',game:'Fixture game',gameVersion:id==='one'?'1.00':'1.01',menuVersion:'2.0',
    firmwares:['9.00'],format:'BIN',run:{type:'goldhen-http',port:9090},
    downloadURL:'/downloads/fixture/'+id+'.bin',consoleFileId:'ps4-redesign-file-'+id,
    requirements:['Use the exact installed game update and a compatible running loader.'],
    ...overrides
  };
}
function noDispatch(app) {
  assert.equal(app.sends.length,0,'Opening or reading metadata must not transmit a payload');
  assert.equal(app.opened.length,0,'Metadata controls must not navigate to a host or console');
  assert.equal(app.anchorClicks.length,0,'Metadata controls must not start a download');
}
function openSupport(app, id) {
  const grid=app.ids['host-action-grid'];
  const trigger=grid.querySelector('[data-support-action="'+id+'"]');
  assert.ok(trigger,'Every file, including one without numeric firmware pins, has an information action');
  trigger.focus();
  grid.fire('click',{target:trigger});
  return trigger;
}

test('file-view count describes visible files rather than grouped menu families',()=>{
  const actions=[action('one'),action('two',{firmwares:['5.05']})];
  const app=fixture({fileListView:true,actions});
  assert.equal(app.ids['host-action-count'].textContent,'2');
  assert.equal(app.ids['host-action-grid'].querySelectorAll('[data-download-action]').length,2);
  app.ids['host-search'].value='build two';app.ids['host-search'].fire('input');
  assert.equal(app.ids['host-action-count'].textContent,'1');
  assert.equal(app.ids['host-action-grid'].querySelector('[data-download-action]').getAttribute('data-download-action'),actions[1].id);
  app.ids['host-firmware'].value='14.00';app.ids['host-firmware'].fire('change');
  assert.equal(app.ids['host-action-count'].textContent,'1','Firmware selection must not hide a browseable file');
  noDispatch(app);
});

test('information popup contains requirements even without numeric firmware pins and restores keyboard focus',()=>{
  const file=action('one',{firmwares:[],requirements:['Requires an already running compatible GoldHEN loader.']});
  const app=fixture({fileListView:true,actions:[file]});
  const trigger=openSupport(app,file.id),overlay=app.ids['host-support-overlay'],close=app.ids['host-support-close'];
  assert.equal(overlay.hidden,false);
  assert.equal(app.document.activeElement,close);
  assert.match(app.ids['host-support-text'].textContent,/already running compatible GoldHEN loader/);
  assert.doesNotMatch(app.ids['host-support-text'].textContent,/all firmware/i,'Unspecified compatibility is not universal support');
  for(const shiftKey of [false,true]){
    let prevented=false;
    overlay.onkeydown({key:'Tab',shiftKey,preventDefault(){prevented=true;}});
    assert.equal(prevented,true);assert.equal(app.document.activeElement,close);
  }
  overlay.onkeydown({key:'Escape'});
  assert.equal(overlay.hidden,true);assert.equal(app.document.activeElement,trigger);
  noDispatch(app);
});

test('disabled file Load gives a reason while its information action remains usable',()=>{
  const file=action('one',{run:{type:'bin-tcp',port:9020}});
  const app=fixture({fileListView:true,actions:[file]});
  const load=app.ids['host-action-grid'].querySelector('[data-launch]');
  assert.ok(load);assert.equal(load.disabled,true);
  const reason=load.getAttribute('title');
  assert.ok(reason&&reason.trim().length>=10,'Disabled Load needs a useful reason');
  openSupport(app,file.id);
  assert.equal(app.ids['host-support-overlay'].hidden,false);
  noDispatch(app);
});

test('a mismatched file remains browseable but cannot dispatch through its Load handler',()=>{
  const file=action('one');
  const app=fixture({fileListView:true,actions:[file]});
  app.ids['host-firmware'].value='5.05';app.ids['host-firmware'].fire('change');
  const grid=app.ids['host-action-grid'],load=grid.querySelector('[data-launch]');
  assert.ok(load,'Firmware mismatch must not remove the file from the list');
  grid.fire('click',{target:load});
  assert.equal(app.ids['host-support-overlay'].hidden,false);
  assert.match(app.ids['host-support-text'].textContent,/9\.00/);
  noDispatch(app);
});
