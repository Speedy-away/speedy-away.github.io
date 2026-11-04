const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ui = require('../../assets/host-dashboard.js');
const root = path.resolve(__dirname,'../..');
const load = file => JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const actions = ['host-modern-plugin-actions','host-game-actions','host-legacy-menu-actions','host-extra-game-actions'].flatMap(name=>load('docs/'+name+'.json').actions);
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

test('menu families consolidate builds without losing exact files, releases or game pins',()=>{
  const before = JSON.stringify(actions);
  const groups = ui.groupActions(ui.filterActions(actions.filter(a=>a.platform==='ps4'),'mods','9.00','','',true));
  const family = name => groups.filter(g=>g.label===name);
  assert.equal(family('Expulsion').length,1);
  assert.deepEqual(family('Expulsion')[0].actions.map(a=>a.menuVersion),['7.0','5.0','4.0',null]);
  assert.equal(family('Cyprus').length,1);assert.equal(family('Cyprus')[0].actions.length,2);
  assert.equal(family('Oysters').length,1);assert.equal(family('Oysters')[0].actions.length,5);
  assert.deepEqual(family('Oysters')[0].actions.map(a=>a.gameVersion),['1.29','1.24','1.19','1.13','1.00']);
  for(const group of groups) {
    assert.equal(new Set(group.actions.map(a=>a.id)).size,group.actions.length);
    assert.ok(group.actions.every(a=>a.platform==='ps4'&&a.game===group.game));
  }
  assert.equal(JSON.stringify(actions),before);
});

test('firmware/search filters apply before grouping and unknown menu versions stay unknown',()=>{
  const legacy = load('docs/host-legacy-menu-actions.json').actions;
  assert.equal(ui.groupActions(ui.filterActions(legacy,'mods','14.00','','',true)).length,0);
  const cyprus=actions.find(a=>a.menuFamily==='Cyprus');
  assert.match(ui.variantLabel(cyprus),/Game update: 1\.5[67] · Menu version: Not provided/);
  assert.ok(!ui.variantLabel(cyprus).includes('Menu version: '+cyprus.gameVersion));
  const expulsion=ui.filterActions(actions,'mods','9.00','7.0','GTA V',true);
  assert.ok(expulsion.some(a=>a.menuVersion==='7.0'));
  const builds=legacy.filter(a=>a.gameVersion==='1.38'&&a.menuFamily==='BeefQueefMod');
  assert.ok(builds.length>=2);assert.equal(new Set(builds.map(ui.variantLabel)).size,builds.length);
});

test('menu covers, actual RDR2 previews and cheat data retain honest distinct roles',()=>{
  const oysters=actions.filter(a=>a.menuFamily==='Oysters');
  assert.ok(oysters.every(a=>a.image.includes('oyster')&&ui.imageCaption(a)==='Menu preview'));
  const explosive=actions.find(a=>a.menuFamily==='Explosive');
  assert.equal(ui.imageCaption(explosive),'Menu cover');assert.equal(explosive.menuVersion,null);
  const trainers=load('docs/host-extra-game-actions.json').actions;
  assert.equal(trainers.length,40);
  for(const a of trainers) {assert.equal(a.run,null);assert.equal(a.format,'JSON');assert.ok(a.titleIds.length);assert.equal(ui.imageCaption(a),'Game artwork');assert.ok(fs.existsSync(path.join(root,a.image)));}
});

test('new receiver snapshots preserve previous files and resolve every host Save action to the exact hash',()=>{
  const report=load('docs/host-menu-companion-build.json');assert.equal(report.activated,true);
  for(const record of report.records) {
    const current=fs.readFileSync(path.join(root,record.path));assert.equal(digest(current),record.sha256);
    assert.equal(digest(fs.readFileSync(record.backupPath)),record.sha256);
    const retained=fs.readFileSync(path.join(root,record.previousPublicSnapshot));assert.equal(digest(retained),record.previousSha256);
    const parse=bytes=>JSON.parse(bytes.toString().match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]).items;
    const items=parse(current);
    for(const old of parse(retained)){const after=items.find(a=>a.id===old.id);assert.ok(after,old.id);assert.equal(after.sha256,old.sha256);assert.equal(after.filename,old.filename);}
    const html=fs.readFileSync(path.join(root,'hosts',record.platform,'index.html'),'utf8');
    const host=JSON.parse(html.match(/<script id="host-actions-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    for(const action of host.actions.filter(a=>a.consoleFileId)) {const item=items.find(a=>a.id===action.consoleFileId);assert.ok(item,action.id);assert.equal(item.sha256,action.sha256,action.id);}
  }
});
