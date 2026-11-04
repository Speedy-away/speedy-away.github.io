'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./host-continuation-dom.cjs');
const root=path.resolve(__dirname,'../..');
test('both main hubs use gallery navigation with a top taskbar and preserve every current action',()=>{
 for(const platform of ['ps4','ps5']){
  const html=fs.readFileSync(path.join(root,'hosts',platform,'index.html'),'utf8');
  assert.match(html,/class="host-file-tabs"/);assert.match(html,/class="host-taskbar"/);
  assert.doesNotMatch(html,/id="sidebar"|class="host-folder-row"|<header class="guide-hero">/);
  const data=JSON.parse(html.match(/id="host-actions-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.catalogGrid,true);assert.equal(data.platform,platform);
  assert.deepEqual(data.actions,require('../build-host-selector.cjs').hostActions(platform));
  for(const view of ['loaders','mods','payloads','tools','connection','sender'])assert.ok(html.includes('?view='+view));
 }
});
test('file rows remain visible across firmware changes and preserve exact filename and download ID',()=>{
 const app=fixture({fileListView:true});
 for(const firmware of ['5.05','9.00','14.00']){
  app.ids['host-firmware'].value=firmware;app.ids['host-firmware'].fire('change');
  assert.match(app.ids['host-action-grid'].innerHTML,/menu.bin/);
  assert.match(app.ids['host-action-grid'].innerHTML,/data-download-action="ps4-fixture-menu-157"/);
 }
 assert.equal(app.sends.length,0);assert.equal(app.opened.length,0);
});
test('firmware check opens a requirement popup, and mismatched Load cannot transmit',()=>{
 const app=fixture({fileListView:true});app.ids['host-firmware'].value='5.05';app.ids['host-firmware'].fire('change');
 const grid=app.ids['host-action-grid'];
 grid.fire('click',{target:grid.querySelector('[data-support-action]')});
 assert.equal(app.ids['host-support-overlay'].hidden,false);
 assert.match(app.ids['host-support-text'].textContent,/PS4 · 9.00/);
 app.ids['host-support-close'].onclick();assert.equal(app.ids['host-support-overlay'].hidden,true);
 grid.fire('click',{target:grid.querySelector('[data-launch]')});
 assert.equal(app.ids['host-support-overlay'].hidden,false);assert.equal(app.sends.length,0);assert.equal(app.opened.length,0);
});
