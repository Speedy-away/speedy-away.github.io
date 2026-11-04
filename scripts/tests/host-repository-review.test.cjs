'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ui = require('../../assets/host-dashboard.js');
const {hostActions} = require('../build-host-selector.cjs');
const {fixture,flush} = require('./host-continuation-dom.cjs');
const root = path.resolve(__dirname,'../..');
const read = file => JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
function historical(file){const local=path.join(root,file);return JSON.parse(fs.readFileSync(fs.existsSync(local)?local:path.join(process.env.WHATSITE_PROVENANCE_ROOT||path.resolve(root,'../whatsite'),file),'utf8'));}
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const menuCommit = '23c946a7f85f1338ea2b78163e72e0ce9bc82b68';
const menuBuilds = [
  ['wildemodz138','WildeModz','1.38','WildeModz-1.38.bin',593216,'e82fe24709f9155bc1c77ffa1b2318bee03b5ec7bb4d120b7aadf21b48f6adf8'],
  ['arabicguy100','ArabicGuy','1.00','arabic-guy100.bin',1055408,'80849dc10d770b5e4596b0c32774b03b156245c18f1527157d6a967854b990a8'],
  ['arabicguy127','ArabicGuy','1.27','arabic-guy127.bin',1055408,'a603fa84029a0c9bd29e3e5d6ea2f97aa668f0600403c4102f4c35b186b982f4'],
  ['arabicguy132','ArabicGuy','1.32','arabic-guy132.bin',1055408,'3dddf0161fb409e7e9711c6b53e4eaef4c34f9768e263a9821b217b1bde00daa']
];
const newMenus = read('docs/host-repository-menu-actions.json').actions;
const all = {ps4:hostActions('ps4'),ps5:hostActions('ps5')};
const preservedGoldhen=read('docs/host-actions-ps4.json').actions.find(action=>action.id==='ps4-goldhen-2-3-900-binloader');

test('the four GamerHack variants keep exact original downloads, independent game pins and disabled loading',()=>{
  assert.equal(newMenus.length,4);
  assert.equal(new Set(newMenus.map(action=>action.id)).size,4);
  assert.equal(new Set(newMenus.map(action=>action.sha256)).size,4);
  const jobs = read('docs/host-repository-menu-jobs.json').jobs;
  assert.equal(jobs.length,4);
  for (const [key,family,gameVersion,filename,bytes,sha256] of menuBuilds) {
    const action = newMenus.find(item=>item.id==='ps4-repository-gamerhack-'+key);
    assert.ok(action,key);
    assert.equal(action.platform,'ps4');assert.equal(action.game,'GTA V');
    assert.equal(action.label,family);assert.equal(action.family,family);assert.equal(action.menuFamily,family);
    assert.equal(action.gameVersion,gameVersion);assert.equal(action.menuVersion,null);
    assert.deepEqual(action.titleIds,[]);assert.deepEqual(action.firmwares,['9.00']);
    assert.equal(action.bytes,bytes);assert.equal(action.sha256,sha256);assert.equal(action.format,'BIN');
    assert.equal(action.sourceCommit,menuCommit);
    assert.equal(action.downloadURL,`https://raw.githubusercontent.com/GamerHack/GamerHack.github.io/${menuCommit}/900v3/${filename}`);
    assert.equal(action.downloadURL,action.sourceURL);assert.equal(action.publicMirror,false);
    assert.equal(action.run,null);assert.equal(action.launchURL,null);assert.equal(ui.loadCapability(action).available,false);
    assert.equal(ui.firmwareMatches(action,'9.00'),true);
    for (const firmware of ['5.05','9.03','11.00','13.52','14.00']) assert.equal(ui.firmwareMatches(action,firmware),false,action.id+' '+firmware);
    assert.match(action.requirements.join(' '),/standalone.*not been verified|built-in Load is unavailable/);
    assert.match(action.imageAlt,/Grand Theft Auto V artwork/);assert.ok(fs.existsSync(path.join(root,action.image)));
    const job = jobs.find(item=>item.expectedSha256===sha256);
    assert.ok(job,key);assert.equal(job.mirror,false);assert.equal(job.kind,'direct');assert.equal(job.url,action.downloadURL);
    assert.equal(job.filename,filename);assert.equal(job.expectedBytes,bytes);assert.ok(job.maxBytes>=bytes);
    assert.deepEqual(job.archiveRole,['Builds']);assert.deepEqual(job.firmwareScope,['9.00']);
    assert.equal(job.gameVersion,gameVersion);assert.equal(job.menuVersion,null);assert.deepEqual(job.titleIds,[]);
    assert.ok(!all.ps5.some(item=>item.id===action.id||item.sha256===sha256),'PS4 build must not enter the PS5 catalogue');
  }
});

test('new builds join the existing menu families without replacing an older build or file hash',()=>{
  const originals = ['host-game-actions','host-legacy-menu-actions'].flatMap(name=>read('docs/'+name+'.json').actions);
  const related = originals.filter(action=>action.platform==='ps4'&&['WildeModz','ArabicGuy'].includes(action.label));
  assert.ok(related.length>=10);
  for (const action of newMenus) assert.ok(!originals.some(old=>old.sha256===action.sha256),action.id+' must be a distinct build');
  const groups = ui.groupActions(ui.filterActions(all.ps4,'mods','9.00','','GTA V',true));
  for (const family of ['WildeModz','ArabicGuy']) {
    const familyGroups = groups.filter(group=>group.label===family);
    assert.equal(familyGroups.length,1,family+' must have one version chooser');
    for (const source of [...related,...newMenus].filter(action=>action.label===family)) {
      const selected = familyGroups[0].actions.find(action=>action.id===source.id);
      assert.ok(selected,source.id);assert.equal(selected.sha256,source.sha256);
      assert.equal(selected.gameVersion,source.gameVersion);assert.equal(selected.menuVersion,source.menuVersion);
    }
  }
});

test('the integrated catalogues preserve historical actions from their separate source catalogues',()=>{
  // These durable source files are the baseline. Tests do not depend on a temporary review snapshot.
  const names = ['host-modern-plugin-actions','host-current-cheat-actions','host-game-actions','host-legacy-menu-actions','host-extra-game-actions','host-native-payload-actions','host-web-utility-actions'];
  let checked = 0;
  for (const name of names) {
    const source = read('docs/'+name+'.json');
    for (const before of source.actions) {
      const platform = before.platform||source.platform;
      if (!all[platform]) continue;
      const after = all[platform].find(action=>action.id===before.id);
      assert.ok(after,name+': '+before.id);
      for (const field of ['sha256','bytes','gameVersion','menuVersion','sourceURL']) if (Object.hasOwn(before,field)) assert.deepEqual(after[field],before[field],before.id+' '+field);
      assert.deepEqual(after.firmwares,before.firmwares,before.id+' firmware');
      checked++;
    }
  }
  assert.ok(checked>100,'The preservation test must cover the historical collection');
});

test('RAW GAME source record keeps its exact external contract while active loading stays fully local',()=>{
  const raw = read('docs/host-actions-ps4.json').actions.find(action=>action.id==='raw13g-1302-1352');
  assert.ok(raw);assert.deepEqual(raw.firmwares,['13.02','13.04','13.50','13.52']);
  assert.equal(raw.launchURL,'https://raw13g.github.io/');assert.equal(raw.format,'HTML host');assert.equal(raw.automatic,true);
  assert.equal(raw.sourceCommit,'9ba2f0719591d6900d91aba6cc5291f8fff97e6d');
  assert.ok(!raw.runtimeId);assert.ok(!raw.run);assert.ok(!raw.downloadURL);
  assert.equal(ui.loadCapability(raw).available,false);
  assert.equal(all.ps4.some(action=>action.id===raw.id),false,'The external-only source record must not appear in the fully hosted active selector');
  const localLoaders=all.ps4.filter(action=>action.category==='loaders');assert.ok(localLoaders.length>0);for(const action of localLoaders){assert.equal(action.browserHost,true);assert.ok(action.nativeRoute,action.id);assert.ok(action.launchURL.startsWith('/hosts/runtime/'),action.id);}
  for (const firmware of ['13.00','13.51','14.00','12.52']) assert.equal(ui.firmwareMatches(raw,firmware),false,firmware);
  assert.ok(!all.ps5.some(action=>action.id===raw.id));
  const runtimes = read('docs/host-runtime-builds.json').runtimes;
  assert.ok(!runtimes.some(runtime=>/raw13g/i.test(JSON.stringify(runtime))));
  assert.match(raw.license,/excluded/);assert.match(raw.license,/External link only/);
  const review = historical('docs/qa/raw13g-source-review.json');
  assert.equal(review.result.completeRuntimeVendoring,'not-qualified');
  for (const file of ['core.js','mem.js','int64.js','patches/1302.bin','patches/1350.bin','patches/1352.bin','goldhen.bin','payload2.bin']) assert.ok(review.license.explicitlyExcluded.includes(file));
});

test('the BIN bootstrap keeps the existing official GoldHEN 2.3 bytes and only the 9.00 TCP9020 contract',()=>{
  const goldhen = preservedGoldhen;
  assert.ok(goldhen);assert.deepEqual(goldhen.firmwares,['9.00']);assert.equal(goldhen.version,'2.3');
  assert.equal(goldhen.bytes,282648);assert.equal(goldhen.sha256,'c9b8f33d28258af9e80465da591868dada25a1454f30f63882668d5e0dcff9c2');
  assert.equal(goldhen.sourceURL,'https://raw.githubusercontent.com/GoldHEN/GoldHEN/b5a78e1e1f6ecbc2dfdcd63b4bb5446f49e309c9/goldhen_2.3_900.bin');
  assert.equal(goldhen.run.type,'bin-tcp');assert.equal(goldhen.run.port,9020);assert.equal(goldhen.run.protocolSource,'/hosts/runtime/ps4-900/web/lapse.js');
  const bytes = fs.readFileSync(path.join(root,goldhen.downloadURL));
  assert.equal(bytes.length,goldhen.bytes);assert.equal(digest(bytes),goldhen.sha256);
  assert.ok(!all.ps5.some(action=>action.id===goldhen.id));
});

test('active receiver IDs map to the exact downloadable host bytes while retaining every earlier receiver item',()=>{
  const build = read('docs/host-menu-companion-build.json');
  assert.equal(build.activated,true);
  const catalog = read('docs/console-download-catalog.json').items;
  const parse = bytes => JSON.parse(bytes.toString('utf8').match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]).items;
  for (const record of build.records) {
    const current = fs.readFileSync(path.join(root,record.path));
    assert.equal(current.length,record.bytes);assert.equal(digest(current),record.sha256);
    assert.equal(digest(fs.readFileSync(path.join(root,record.immutablePath))),record.sha256);
    const active = parse(current), retained = fs.readFileSync(path.join(root,record.previousPublicSnapshot));
    assert.equal(digest(retained),record.previousSha256);
    for (const before of parse(retained)) {
      const after = active.find(item=>item.id===before.id);
      assert.ok(after,before.id);assert.equal(after.sha256,before.sha256);assert.equal(after.filename,before.filename);
    }
    for (const action of all[record.platform].filter(item=>item.downloadURL&&!item.downloadOnDevice)) {
      const exact = active.find(item=>item.id===action.consoleFileId);
      assert.ok(exact,action.id+' active receiver ID');
      assert.equal(exact.sha256,action.sha256,action.id);
      if (action.bytes!==undefined) assert.equal(exact.bytes,action.bytes,action.id);
      assert.equal(exact.filename,path.posix.basename(action.downloadURL),action.id);
      const publicFile = catalog.find(item=>item.id===exact.id);
      assert.ok(publicFile.platforms.includes(record.platform));assert.equal(publicFile.sha256,exact.sha256);assert.equal(publicFile.bytes,exact.bytes);
    }
  }
});

test('the rendered BIN Load stays disabled until the matching paired sender advertises the exact action',async()=>{
  const goldhen = preservedGoldhen;
  // Put the real transfer contract in the fixture's version chooser to exercise its actual DOM handler.
  const action = {...goldhen,category:'mods',game:'Fixture bootstrap',menuFamily:'Fixture bootstrap',gameVersion:'1.00'};
  const app = fixture({actions:[action],pairDeferred:true});app.openMenu();
  assert.equal(app.load().disabled,true);assert.equal(app.sends.length,0);assert.equal(app.opened.length,0);
  assert.match(app.ids['host-version-detail'].innerHTML,/Connect the paired desktop sender to load this BIN/);
  app.pair();app.pairs[0].resolve({status:'connected',actions:[{id:action.id,platform:'ps5',available:true}],capabilities:{uncertainOutcomes:true}});await flush();
  assert.equal(app.load().disabled,true);assert.equal(app.sends.length,0,'A PS5 advertisement cannot unlock the PS4 action');
  app.pair();app.pairs[1].resolve({status:'connected',actions:[{id:action.id,platform:'ps4',available:true}],capabilities:{uncertainOutcomes:true}});await flush();
  const button = app.ids['host-version-detail'].querySelector('[data-launch]');
  assert.equal(button.disabled,false);assert.equal(app.sends.length,0,'Pairing alone must not send the BIN');
  app.load();assert.equal(app.sends.length,1);assert.equal(app.sends[0].method,'bridge');assert.equal(app.sends[0].actionId,action.id);
  app.sends[0].resolve({status:'accepted',message:'Mock TCP transfer only'});await flush();
  assert.match(app.ids['host-status'].textContent,/Mock TCP transfer only/);
});

test('BIN capability rejects a wrong platform, format or loader port',()=>{
  const valid = {platform:'ps4',format:'BIN',run:{type:'bin-tcp',port:9020}};
  assert.equal(ui.loadCapability(valid).available,true);
  for (const platform of ['ps5','ps3','',undefined]) assert.equal(ui.loadCapability({...valid,platform}).available,false,String(platform));
  for (const format of ['ELF','PRX','SPRX','ZIP','']) assert.equal(ui.loadCapability({...valid,format}).available,false,format);
  for (const port of [9021,9090,8084,0,-1,'9020',undefined]) assert.equal(ui.loadCapability({...valid,run:{type:'bin-tcp',port}}).available,false,String(port));
});
