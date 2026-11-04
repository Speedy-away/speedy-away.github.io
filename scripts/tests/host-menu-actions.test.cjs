const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ui = require('../../assets/host-dashboard.js');
const normalize = require('../../assets/host-console-client.js').normalizeAddress;
const root = path.resolve(__dirname,'../..');
const read = name => JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));

test('merged Download keeps device and console destinations distinct without silent fallback',()=>{
  const action = {downloadURL:'/downloads/example.bin',consoleFileId:'ps4-example'};
  const pc = ui.detectBrowser('Windows NT 10.0');
  assert.deepEqual(ui.downloadPlan(action,'ps4','',pc,normalize),{destination:'device',address:'',url:action.downloadURL});
  assert.deepEqual(ui.downloadPlan(action,'ps4','192.168.1.42',pc,normalize),{destination:'console',address:'192.168.1.42',url:'http://192.168.1.42:6701/data/whatsite-ps4.html?file=ps4-example'});
  assert.throws(()=>ui.downloadPlan(action,'ps4','localhost',pc,normalize),/LAN address/);
  assert.throws(()=>ui.downloadPlan(action,'ps4','8.8.8.8',pc,normalize));
  assert.throws(()=>ui.downloadPlan({...action,consoleFileId:null},'ps4','192.168.1.42',pc,normalize),/catalogue/);
  assert.throws(()=>ui.downloadPlan({},'ps4','',pc,normalize),/downloadable file/);
  const ps5 = ui.detectBrowser('PlayStation 5/4.51');
  const native = ui.downloadPlan({...action,consoleFileId:'ps5-example'},'ps5','',ps5,normalize);
  assert.equal(native.destination,'console');assert.equal(native.url,'http://127.0.0.1:6701/whatsite-ps5.html?file=ps5-example');
  assert.equal(ui.downloadPlan(action,'ps4','',ps5,normalize).destination,'device');
});

test('Load capabilities never present plugin installation or an external host as a direct transfer',()=>{
  for(const type of ['goldhen-http','elf-http','elf-tcp','ps5-manager']) assert.equal(ui.loadCapability({run:{type}}).available,true);
  for(const format of ['PRX','SPRX','JSON','MC4','XML','SHN']) assert.equal(ui.loadCapability({format,launchURL:'https://example.test/'}).available,false);
  assert.equal(ui.loadCapability({format:'BIN',launchURL:'https://example.test/'}).available,false);
  assert.equal(ui.loadCapability({runtimeId:'verified',launchURL:'https://external.test/'}).available,false);
  assert.equal(ui.loadCapability({runtimeId:'verified',launchURL:'/hosts/runtime/verified/'}).kind,'browser');
});

test('every downloadable host action has an exact native file ID without broadening duplicate-byte compatibility',()=>{
  const {hostActions} = require('../build-host-selector.cjs');
  const catalogue=read('docs/console-download-catalog.json').items;
  for(const platform of ['ps4','ps5']) for(const action of hostActions(platform).filter(a=>a.downloadURL)) {
    if(action.downloadOnDevice){if(action.id==='ps4-goldhen-user-supplied')assert.equal(action.browserHost,true);else{const retained=read('docs/host-goldhen-retained-versions.json').actions.find(a=>a.id===action.id);assert.ok(retained,action.id);assert.equal(retained.sha256,action.sha256);assert.deepEqual(retained.firmwares,action.firmwares);assert.equal(action.category,'goldhen');assert.equal(Boolean(action.browserHost),false);}assert.deepEqual(ui.downloadPlan(action,platform,'192.168.1.42',ui.detectBrowser('Windows NT 10.0'),normalize),{destination:'device',address:'',url:action.downloadURL});continue;}
    assert.ok(action.consoleFileId,action.id);
    const file=catalogue.find(f=>f.id===action.consoleFileId);
    assert.equal(file.sha256,action.sha256,action.id);
    assert.equal(file.filename,path.basename(action.downloadURL),action.id);
    assert.ok(file.platforms.includes(platform));
    if(action.id.startsWith('ps4-goldhen-retained-')){assert.equal(action.downloadOnDevice,undefined);assert.deepEqual(file.platforms,['ps4']);assert.deepEqual(require('../prepare-host-goldhen-versions.cjs').exactFirmware(file),action.firmwares);assert.equal(file.version,action.version);assert.match(file.url,/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[a-f0-9]{40}\//);const plan=ui.downloadPlan(action,platform,'192.168.1.42',ui.detectBrowser('Windows NT 10.0'),normalize);assert.equal(plan.destination,'console');assert.ok(plan.url.endsWith('?file='+action.consoleFileId));}
  }
  assert.equal(hostActions('ps4').filter(a=>a.id.startsWith('ps4-goldhen-retained-')).length,33);
  const legacy=read('docs/host-legacy-menu-actions.json').actions;
  const conflict=legacy.find(a=>a.id==='ps4-legacy-kameleon-bq138-thief');
  assert.equal(conflict.gameVersion,'1.38');assert.equal(conflict.run,null);
  assert.ok(catalogue.find(f=>f.id===conflict.id));
});

test('generated chooser has separate categories and button choices instead of a version select',()=>{
  for(const platform of ['ps4','ps5']) {
    const html=fs.readFileSync(path.join(root,'hosts',platform,'index.html'),'utf8');
    assert.ok(!html.includes('data-host-category="all"'));
    assert.ok(html.includes('"catalogGrid":true'));
    assert.ok(html.includes('?view=mods'));
    assert.ok(html.includes('id="host-version-choices"'));
    assert.ok(!html.includes('id="host-version-select"'));
    assert.ok(html.includes('Download a copy when pressing Load'));
  }
});

test('GoldHEN device download stays explicit with a configured console and never offers an unsupported receiver route',()=>{const action=require('../build-host-selector.cjs').hostActions('ps4').find(a=>a.id==='ps4-goldhen-user-supplied');assert.equal(action.downloadOnDevice,true);for(const ua of ['Windows NT 10.0','PlayStation 4/13.52'])assert.deepEqual(ui.downloadPlan(action,'ps4','192.168.1.42',ui.detectBrowser(ua),normalize),{destination:'device',address:'',url:action.downloadURL});const {fixture}=require('./host-continuation-dom.cjs'),app=fixture({actions:[action],initialCategory:'goldhen',userAgent:'PlayStation 4/13.52'});assert.match(app.ids['host-action-grid'].innerHTML,/Download on PC \/ mobile/);assert.doesNotMatch(app.ids['host-action-grid'].innerHTML,/data-download-action=/);assert.equal(app.sends.length,0);});
