'use strict';
// Static source identities and catalogue contracts. No cheat or console code runs.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8')),{pins,COMMIT,validate}=require('../expand-host-ps4-on-ps5.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('six upstream etaHEN CUSA definitions keep exact versions, bytes and creators for five PS4-on-PS5 games',()=>{
 const actions=read('docs/host-extra-game-actions.json').actions.filter(a=>pins.some(p=>p.id===a.id));assert.equal(actions.length,6);assert.equal(new Set(actions.map(a=>a.game)).size,5);
 for(const a of actions){const p=pins.find(p=>p.id===a.id),b=fs.readFileSync(path.join(root,a.downloadURL)),d=validate(b,p);assert.equal(a.sourceCommit,COMMIT);assert.deepEqual(a.credits,d.credits);assert.deepEqual(a.titleIds,[d.id]);assert.equal(a.gameVersion,d.version);assert.equal(a.gamePlatform,'ps4-on-ps5');assert.equal(a.platform,'ps5');assert.equal(a.run,null);assert.equal(a.launchURL,null);assert.equal(a.format,'JSON');assert.deepEqual(a.firmwares,[]);assert.match(a.installPath,/^\/data\/etaHEN\/cheats\/json\/CUSA/);assert.match(a.sourceURL,new RegExp('etaHEN/PS5_Cheats/'+COMMIT+'/json/'));assert.ok(fs.existsSync(path.join(root,a.image)));}
});
test('modified source data is rejected before use and no firmware or BIN/ELF transport is inferred',()=>{
 const p=pins[0],a=read('docs/host-extra-game-actions.json').actions.find(a=>a.id===p.id),b=fs.readFileSync(path.join(root,a.downloadURL));const broken=Buffer.from(b);broken[0]^=1;assert.throws(()=>validate(broken,p));const d=JSON.parse(b);d.version='99.99';const altered=Buffer.from(JSON.stringify(d));assert.throws(()=>validate(altered,{...p,bytes:altered.length,sha256:sha(altered)}));
 const ui=require('../../assets/host-dashboard.js');assert.equal(ui.loadCapability(a).available,false);
});
test('receiver 21 preserves every old entry and the exact receiver engine while adding six scoped PS5 IDs',()=>{
 const old=read('docs/qa/ps4-on-ps5-receiver20-retained.json'),current=read('docs/host-menu-companion-build.json');assert.equal(current.version,'2026.11.02.21');assert.equal(current.activated,true);
 const json=s=>JSON.parse(s.match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]);const engine=s=>s.replace(/(<script id="receiver-catalog" type="application\/json">)[\s\S]*?(<\/script>)/,'$1{}$2');
 for(const previous of old.records){const now=current.records.find(r=>r.platform===previous.platform),a=fs.readFileSync(path.join(root,previous.immutablePath),'utf8'),b=fs.readFileSync(path.join(root,now.immutablePath),'utf8');assert.equal(engine(a),engine(b));const before=json(a).items,after=json(b).items;assert.deepEqual(after.slice(0,before.length),before);assert.equal(after.length-before.length,now.platform==='ps5'?6:0);if(now.platform==='ps5')for(const p of pins){const item=after.find(i=>i.id===p.id);assert.ok(item);assert.equal(item.sha256,p.sha256);assert.deepEqual(item.platforms,['ps5']);}}
});
test('all new exact file IDs resolve through the real console download catalogue and the PS5 host pages',()=>{
 const catalog=read('docs/console-download-catalog.json').items,actions=require('../build-host-selector.cjs').hostActions('ps5');
 for(const p of pins){const item=catalog.find(i=>i.id===p.id),action=actions.find(a=>a.id===p.id);assert.equal(item.sha256,p.sha256);assert.equal(action.consoleFileId,p.id);assert.equal(action.run,null);for(const name of ['hosts/ps5/index.html','hosts/ps5/other-games/index.html'])assert.ok(fs.readFileSync(path.join(root,name),'utf8').includes(p.id));}
});
