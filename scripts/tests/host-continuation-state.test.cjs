const test = require('node:test');
const assert = require('node:assert/strict');
const {fixture,flush} = require('./host-continuation-dom.cjs');
const A='192.168.1.40', B='192.168.1.41';
const connected=(message,address)=>({status:'connected',service:'GoldHEN',version:message,message,reportedAddress:address,checks:[{service:'goldhen',status:'connected',message}]});

test('real service-check handlers discard old target replies, including an A to B to A edit',async()=>{
  for(const returnToA of [false,true]) {
    const app=fixture();app.pair();await flush();app.check();
    assert.equal(app.checks.length,1);assert.equal(app.checks[0].address,A);
    app.setAddress(B);if(returnToA)app.setAddress(A);
    app.checks[0].resolve(connected('STALE A',A));await flush();
    assert.equal(app.ids['host-service-status'].textContent,'Service: not verified');
    assert.equal(app.ids['host-service-checks'].hidden,true);
    assert.ok(!app.ids['host-status'].textContent.includes('STALE A'));
    assert.equal(app.ids['host-check-services'].disabled,false);
  }
});

test('a newer real service check wins over an older reply or rejection for the same address',async()=>{
  for(const rejectOld of [false,true]) {
    const app=fixture();app.pair();await flush();app.check();
    app.setAddress(A);app.check();assert.equal(app.checks.length,2);
    app.checks[1].resolve(connected('LATEST',A));await flush();
    if(rejectOld)app.checks[0].reject(new Error('STALE ERROR'));else app.checks[0].resolve(connected('STALE SUCCESS',A));
    await flush();
    assert.equal(app.ids['host-status'].textContent,'LATEST');
    assert.equal(app.ids['host-service-status'].textContent,'Service: GoldHEN LATEST');
    assert.ok(app.ids['host-service-checks'].innerHTML.includes('LATEST'));
    assert.ok(!app.ids['host-service-checks'].innerHTML.includes('STALE'));
  }
});

test('Load with copy opens the exact same-console file during the click and never retargets on completion',async()=>{
  for(const platform of ['ps4','ps5']) {
    const app=fixture({platform});app.ids['host-download-on-run'].checked=true;app.openMenu();app.load();
    assert.equal(app.sends.length,1);assert.equal(app.sends[0].address,A);
    assert.equal(app.opened.length,1);assert.equal(app.opened[0].duringGesture,true);
    assert.equal(app.opened[0].url,'http://'+A+':6701/'+(platform==='ps4'?'data/':'')+'whatsite-'+platform+'.html?file='+platform+'-exact-file-157');
    assert.equal(app.anchorClicks.length,0,'A console copy must not become a hidden viewing-device download');
    app.setAddress(B);app.sends[0].resolve({status:'accepted',message:'Fixture transfer accepted'});await flush();
    assert.equal(app.opened.length,1);assert.equal(app.sends.length,1);
    assert.ok(!app.opened[0].url.includes(B));assert.equal(app.anchorClicks.length,0);
  }
});

test('uncertain results and mayHaveExecuted errors persist a target lock across reload until explicit clear',async()=>{
  for(const outcome of ['uncertain','may-have-executed','rejected-after-write']) {
    const storage=new Map(),app=fixture({storage});app.openMenu();app.load();
    if(outcome==='rejected-after-write')app.sends[0].reject(Object.assign(new Error('Socket outcome unknown'),{mayHaveExecuted:true}));
    else app.sends[0].resolve({status:outcome==='uncertain'?'uncertain':'error',mayHaveExecuted:outcome!=='uncertain',message:'Socket outcome unknown'});
    await flush();
    assert.equal(app.ids['host-transfer-warning'].hidden,false);
    assert.ok(JSON.parse(storage.get(app.storageKey)).uncertainTransfers[A]);
    assert.equal(app.load().disabled,true);assert.equal(app.sends.length,1);
    const reload=fixture({storage});reload.openMenu();
    assert.equal(reload.load().disabled,true);assert.equal(reload.sends.length,0);
    assert.equal(reload.opened.length,0);assert.equal(reload.anchorClicks.length,0);
    reload.ids['host-clear-transfer-warning'].click();
    assert.equal(reload.ids['host-transfer-warning'].hidden,true);
    assert.equal(reload.sends.length,0,'Clearing a warning is not an automatic retry');
    assert.match(reload.ids['host-status'].textContent,/Nothing was sent or retried/);
    assert.ok(!JSON.parse(storage.get(reload.storageKey)).uncertainTransfers[A]);
    reload.load();assert.equal(reload.sends.length,1);assert.equal(reload.sends[0].address,A);
  }
});

test('an uncertain A or a busy reply for A cannot lock a different B target',async()=>{
  for(const uncertain of [false,true]) {
    const app=fixture();app.openMenu();app.load();app.setAddress(B);
    app.sends[0].resolve({status:uncertain?'uncertain':'unavailable',code:uncertain?'unknown':'goldhen-busy',message:uncertain?'Unknown A outcome':'A loader is busy'});await flush();
    assert.equal(app.ids['host-transfer-warning'].hidden,true);
    assert.equal(app.load().disabled,false);assert.equal(app.sends.length,2);assert.equal(app.sends[1].address,B);
    if(uncertain)assert.ok(JSON.parse(app.storage.get(app.storageKey)).uncertainTransfers[A]);
  }
});

test('the real chooser retains two stable popup actions and changes the exact download with its version button',()=>{
  const seed=fixture().actions[0];
  const older={...seed,id:'ps4-fixture-menu-156',gameVersion:'1.56',menuVersion:'1.0',consoleFileId:'ps4-exact-file-156',downloadURL:'/downloads/fixture/menu-old.bin'};
  const app=fixture({actions:[seed,older]});
  assert.equal(app.ids['host-action-grid'].querySelectorAll('[data-choose-group]').length,1);
  app.openMenu();
  assert.equal(app.ids['host-version-choices'].querySelectorAll('button').length,2);
  assert.equal(app.ids['host-version-choices'].querySelectorAll('select').length,0);
  for(const id of [older.id,seed.id,older.id]) {
    app.choose(id);
    const panel=app.ids['host-version-detail'];
    assert.equal(panel.querySelectorAll('[data-download-action], [data-launch]').length,2);
    assert.equal(panel.querySelectorAll('a,button').length,2,'The variant has exactly two controls, without a third Save/file-manager action');
    assert.equal(panel.querySelector('[data-download-action]').getAttribute('data-download-action'),id);
    assert.equal(panel.querySelector('[data-launch]').getAttribute('data-launch'),id);
    assert.equal(panel.querySelector('[data-download-action]').hasAttribute('data-no-file-options'),true);
    assert.equal(panel.querySelectorAll('[data-save], [data-open-service]').length,0);
  }
  app.download();assert.equal(app.opened[0].url,'http://'+A+':6701/data/whatsite-ps4.html?file=ps4-exact-file-156');
  assert.equal(app.sends.length,0,'Choosing/downloading a build must not load it');
});

test('stale pairing replies cannot restore a bridge after its token changes away and back',async()=>{
  const app=fixture({pairDeferred:true});app.pair();assert.equal(app.pairs.length,1);
  app.ids['host-bridge-token'].value='changed';app.ids['host-bridge-token'].fire('input');
  app.ids['host-bridge-token'].value='fixture-token';app.ids['host-bridge-token'].fire('input');
  app.pairs[0].resolve({status:'connected',message:'OLD PAIR',actions:[]});await flush();app.check();
  assert.equal(app.checks.length,0);assert.match(app.ids['host-status'].textContent,/Connect the local sender/);
  app.pair();app.pairs[1].resolve({status:'connected',message:'NEW PAIR',actions:[]});await flush();app.check();
  assert.equal(app.checks.length,1);assert.equal(app.checks[0].address,A);
});

test('a paired older sender without uncertain-outcome support is blocked before copy or any transfer',async()=>{
  for(const capabilities of [undefined,{}, {uncertainOutcomes:false}]) {
    const app=fixture({pairDeferred:true});
    const advertised={id:app.actions[0].id,platform:'ps4',available:true};
    app.pair();app.pairs[0].resolve({status:'connected',message:'Older sender paired',actions:[advertised],capabilities});await flush();
    app.ids['host-download-on-run'].checked=true;app.openMenu();app.load();
    assert.match(app.ids['host-status'].textContent,/Update the desktop sender before loading/);
    assert.equal(app.ids['host-status'].getAttribute('data-error'),'true');
    assert.equal(app.opened.length,0,'The copy must not open before the sender capability gate');
    assert.equal(app.anchorClicks.length,0,'The viewing device must not receive a fallback download');
    assert.equal(app.sends.length,0,'Neither the paired sender nor a native transfer may be called');
    app.pair();app.pairs[1].resolve({status:'connected',message:'Updated sender paired',actions:[advertised],capabilities:{uncertainOutcomes:true}});await flush();app.load();
    assert.equal(app.opened.length,1);assert.equal(app.opened[0].duringGesture,true);
    assert.equal(app.sends.length,1);assert.equal(app.sends[0].method,'bridge');
  }
});
