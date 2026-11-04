'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ui=require('../../assets/host-dashboard.js');
const {normalizeAddress}=require('../../assets/host-console-client.js');
const {dashboard,workspaceDashboard}=require('../host-dashboard-markup.cjs');
const {hostActions}=require('../build-host-selector.cjs');
const bridge=require('../console-payload-bridge.cjs');
const {fixture,flush}=require('./host-continuation-dom.cjs');
const root=path.resolve(__dirname,'../..');
const scopes=['gta5','rdr2','other-games'];
const data=html=>JSON.parse(html.match(/<script id="host-actions-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('three game scopes partition every real mod variant exactly once without losing pins or shared tools',()=>{
  for(const platform of ['ps4','ps5']){
    const actions=hostActions(platform),mods=actions.filter(a=>a.category==='mods'),shared=actions.filter(a=>a.category!=='mods');
    const before=JSON.stringify(actions),partition=scopes.flatMap(scope=>ui.scopeActions(actions,scope).filter(a=>a.category==='mods'));
    assert.ok(mods.length,platform);
    assert.deepEqual(partition.map(a=>a.id).sort(),mods.map(a=>a.id).sort());
    assert.equal(new Set(partition.map(a=>a.id)).size,mods.length);
    for(const action of partition)assert.ok(actions.includes(action),'Keep original object and compatibility fields: '+action.id);
    for(const scope of scopes)assert.deepEqual(ui.scopeActions(actions,scope).filter(a=>a.category!=='mods'),shared);
    assert.equal(JSON.stringify(actions),before,'Scoping must not rewrite or advance a pinned build');
    const other=ui.scopeActions(actions,'other-games').filter(a=>a.category==='mods');
    assert.ok(other.every(a=>!/^GTA\s*(?:V|5)$|^RDR\s*2$/i.test(a.game||'')));
  }
  assert.deepEqual(ui.scopeActions([{id:'gta-alias',category:'mods',game:'Grand Theft Auto 5'},{id:'rdr-alias',category:'mods',game:'Red Dead Redemption 2'}],'gta5').map(a=>a.id),['gta-alias']);
});

test('dedicated file and payload pages contain connection and native workspace controls without the hub or menu library',()=>{
  for(const platform of ['ps4','ps5'])for(const view of ['files','payloads']){
    const actions=hostActions(platform),html=workspaceDashboard(platform,actions,view);
    assert.match(html,/id="host-console-address"/);
    assert.match(html,new RegExp('Connect to your '+platform.toUpperCase()));
    assert.ok(html.includes('data-open-workspace="'+view+'"'));
    assert.match(html,/Install the console workspace/);
    assert.doesNotMatch(html,/id="host-action-grid"|class="host-tools-grid"|id="host-version-overlay"/);
    assert.equal(data(html).platform,platform);
    assert.ok(data(html).actions.every(a=>a.platform===platform));
    assert.equal(html.includes('data-open-workspace="autoload"'),view==='payloads');
    assert.equal(html.includes('id="host-load-manager"'),view==='payloads'&&platform==='ps5');
    assert.equal(html.includes('PayLoader LaunchPad'),view==='payloads'&&platform==='ps4');
    assert.equal((html.match(/id="host-status"/g)||[]).length,1);
  }
  const home=dashboard('ps4',hostActions('ps4'),{gamesLanding:true});
  assert.match(home,/href="\/hosts\/ps4\/files\/"/);
  assert.match(home,/href="\/hosts\/ps4\/payload-manager\/"/);
  assert.equal(data(home).gamesLanding,true);
});

test('native workspace links keep exact platform origins and reject unreviewed views or address injection',()=>{
  for(const platform of ['ps4','ps5'])for(const view of ['files','payloads','autoload']){
    const actual=ui.workspaceURL(platform,'192.168.1.44',view,normalizeAddress),url=new URL(actual);
    assert.equal(url.hostname,'192.168.1.44');assert.equal(url.port,platform==='ps4'?'8080':'9090');
    assert.equal(url.pathname,platform==='ps4'?'/data/whatsite-workspace-ps4.html':'/data/homebrew/ezremote-client/assets/whatsite-workspace-ps5.html');
    assert.equal(url.search,'?view='+view);assert.equal(url.hash,'');
  }
  for(const view of ['../autoload','files&execute=1','settings','','delete'])assert.throws(()=>ui.workspaceURL('ps4','192.168.1.44',view,normalizeAddress));
  assert.throws(()=>ui.workspaceURL('ps3','192.168.1.44','files',normalizeAddress));
  for(const address of ['8.8.8.8','https://evil.test','192.168.1.44:8080','192.168.1.44/path','192.168.1.44?x'])assert.throws(()=>ui.workspaceURL('ps4',address,'files',normalizeAddress));
  for(const platform of ['ps4','ps5']){
    assert.throws(()=>ui.targetAddress('127.0.0.1',platform,ui.detectBrowser('Windows NT 10.0'),normalizeAddress),/LAN address/);
    assert.equal(ui.targetAddress('127.0.0.1',platform,ui.detectBrowser('PlayStation '+platform.slice(-1)+'/9.00'),normalizeAddress),'127.0.0.1');
  }
});

test('sender serves only named game/workspace routes and exact immutable authored helper names',()=>{
  for(const platform of ['ps4','ps5']){
    for(const page of ['files','payload-manager',...scopes])assert.equal(bridge.staticPath('/hosts/'+platform+'/'+page+'/'),'/hosts/'+platform+'/'+page+'/index.html');
    const helper='/downloads/helpers/host-native-workspace/'+platform+'/0123456789abcdef/whatsite-workspace-'+platform+'.html';
    assert.equal(bridge.staticPath(helper),helper);
    assert.equal(bridge.staticPath(helper.replace('whatsite-workspace-'+platform,'whatsite-workspace-ps3')),null);
    assert.equal(bridge.staticPath(helper.replace('0123456789abcdef','latest')),null);
  }
  for(const route of ['/hosts/ps3/files/','/hosts/ps4/anything/','/hosts/ps4/files/../index.html','/downloads/random.html'])assert.equal(bridge.staticPath(route),null);
});

test('new eighteen web utilities are direct verified PS4 BIN actions and retain exact firmware exclusions',()=>{
  const utilities=JSON.parse(fs.readFileSync(path.join(root,'docs/host-web-utility-actions.json'),'utf8')).actions;
  assert.equal(utilities.length,18);assert.equal(new Set(utilities.map(a=>a.id)).size,18);
  const bridgeActions=bridge.loadActions(root),ps4=hostActions('ps4'),ps5=hostActions('ps5');
  for(const action of utilities){
    assert.equal(action.platform,'ps4');assert.equal(action.category,'payloads');assert.equal(action.format,'BIN');
    assert.equal(action.launchURL,null);assert.equal(action.run.type,'goldhen-http');assert.equal(action.run.port,9090);
    assert.ok(bridgeActions.some(a=>a.id===action.id));assert.ok(ps4.some(a=>a.id===action.id));assert.ok(!ps5.some(a=>a.id===action.id));
    assert.equal(ui.firmwareMatches(action,'14.00'),false);assert.equal(ui.firmwareMatches(action,'13.52'),false);
    if(action.id==='ps4-kme-web-ps4debug-v1-1-19'){
      assert.equal(action.firmwares.length,33);assert.equal(ui.firmwareMatches(action,'12.02'),true);assert.equal(ui.firmwareMatches(action,'13.00'),false);
    }else assert.deepEqual(action.firmwares,['13.00']);
    const bytes=fs.readFileSync(path.join(root,action.downloadURL));
    assert.equal(bytes.length,action.bytes,action.id);assert.equal(hash(bytes),action.sha256,action.id);
  }
  assert.equal(utilities.filter(a=>a.confirmBeforeLoad).length,12);
  for(const id of ['disable-updates','enable-updates','db-restore','app2usb','permanent-uart'])assert.ok(utilities.find(a=>a.id.includes(id)).confirmBeforeLoad);
});

test('declining an effect confirmation prevents both the optional copy and console transmission',async()=>{
  const action={id:'ps4-confirmation-fixture',label:'Fixture effect',platform:'ps4',category:'mods',game:'Fixture game',gameVersion:'1.57',firmwares:['9.00'],format:'BIN',run:{type:'goldhen-http',port:9090},downloadURL:'/downloads/fixture.bin',consoleFileId:'ps4-fixture',confirmBeforeLoad:'Apply fixture effect?',requirements:[]};
  const f=fixture({actions:[action]});let confirms=0;
  f.window.__scoobyI18n={t:source=>source==='Apply fixture effect?'?'Translated fixture effect?':source};
  f.window.confirm=message=>{assert.equal(message,'Translated fixture effect?');confirms++;return false;};f.ids['host-download-on-run'].checked=true;
  f.pair();await flush();f.openMenu();const button=f.load();assert.equal(button.disabled,false);await flush();
  assert.equal(confirms,1);assert.equal(f.sends.length,0);assert.equal(f.opened.length,0);assert.equal(f.anchorClicks.length,0);
  assert.match(f.ids['host-status'].textContent,/Load cancelled/);
});

test('menu images retain accessible descriptions without visible image-role badges in cards and popups',()=>{
  const action={id:'ps4-image-fixture',label:'Fixture menu',platform:'ps4',category:'mods',game:'GTA V',gameVersion:'1.57',firmwares:['9.00'],format:'BIN',run:{type:'goldhen-http',port:9090},downloadURL:'/downloads/fixture.bin',image:'/assets/images/gta52.png',imageRole:'menu cover',requirements:[]};
  const f=fixture({actions:[action]});
  assert.match(f.ids['host-action-grid'].innerHTML,/<img\b[^>]*alt="[^"]+"/);
  assert.doesNotMatch(f.ids['host-action-grid'].innerHTML,/<figcaption\b|class="[^"]*(?:image-badge|image-caption)/i);
  f.openMenu();assert.match(f.ids['host-version-detail'].innerHTML,/<img\b[^>]*alt="[^"]+"/);
  assert.doesNotMatch(f.ids['host-version-detail'].innerHTML,/<figcaption\b/i);
});

test('dedicated workspace boot tolerates absent library and modal controls without sending anything',async()=>{
  const f=fixture();
  for(const suffix of ['action-grid','action-count','search','game','show-legacy','version-overlay','version-choices','version-detail','version-status','version-title','version-game','version-close','game-filter','empty','download-on-run'])delete f.ids['host-'+suffix];
  assert.doesNotThrow(()=>ui.install(f.document,f.window));
  await flush();
  assert.equal(f.sends.length,0);assert.equal(f.opened.length,0);assert.equal(f.checks.length,0);
});
