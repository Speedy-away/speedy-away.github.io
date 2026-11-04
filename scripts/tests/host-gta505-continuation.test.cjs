'use strict';
// Read-only checks of integration and archived bytes; no payload execution.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function historical(file){const local=path.join(root,file);return JSON.parse(fs.readFileSync(fs.existsSync(local)?local:path.join(process.env.WHATSITE_PROVENANCE_ROOT||path.resolve(root,'../whatsite'),file),'utf8'));}
const actions=read('docs/host-gta505-continuation-actions.json').actions,baseline=historical('docs/qa/host-gta505-baseline.json');
const catalogue=read('docs/console-download-catalog.json').items,audit=read('docs/download-audit.json').items;
const ui=require('../../assets/host-dashboard.js'),bridge=require('../console-payload-bridge.cjs');
function check(file,record){const b=fs.readFileSync(file);assert.equal(b.length,record.bytes);assert.equal(sha(b),record.sha256);return b;}
test('three exact 5.05 GTA V downloads stay grouped, original-only and unavailable to every Load path',()=>{
 assert.equal(actions.length,3);assert.deepEqual(actions.map(a=>[a.menuFamily,a.gameVersion]),[['ArabicGuy','1.00'],['WildeModz','1.33'],['WildeModz','1.46']]);
 for(const a of actions){assert.equal(a.game,'GTA V');assert.deepEqual(a.firmwares,['5.05']);assert.equal(a.menuVersion,null);assert.deepEqual(a.titleIds,[]);assert.equal(a.run,null);assert.equal(a.publicMirror,false);assert.equal(a.loaderEvidence.externalTransportVerified,false);assert.equal(ui.loadCapability(a).available,false);assert.throws(()=>bridge.userFileSpec(a),{code:'unsupported-user-file'});
  const exposed=bridge.loadActions().find(x=>x.id===a.id);assert.ok(exposed);assert.equal(exposed.sha256,a.sha256);
  const c=catalogue.find(x=>x.id===a.id);assert.ok(c);assert.deepEqual(c.platforms,['ps4']);assert.equal(c.url,a.downloadURL);assert.equal(c.sha256,a.sha256);
  const original=historical('docs/qa/host-remaining-menu-review.json').remainingDistinctCandidates.find(x=>x.path===a.sourceFile);assert.equal(a.sha256,original.sha256);assert.equal(a.bytes,original.bytes);
  const record=audit.flatMap(i=>i.files||[]).find(f=>f.sha256===a.sha256&&f.backupPath);assert.ok(record);check(record.backupPath,a);
 }
});
test('all previous catalogue pins, native helper identities and sender versions are retained',()=>{
 for(const before of baseline.catalogue){const after=catalogue.find(x=>x.id===before.id);assert.ok(after,before.id);for(const k of ['filename','sha256','platforms'])assert.deepEqual(after[k],before[k]);}
 assert.deepEqual(read('docs/host-native-workspace-build.json').artifacts,baseline.native);
 for(const a of baseline.native){check(path.join(root,a.immutablePath),a);check(a.backupPath,a);}
 const manifest=read('downloads/helpers/console-payload-sender/manifest.json');for(const before of baseline.sender.files){const after=manifest.files.find(x=>x.url===before.url);assert.ok(after,before.url);for(const key of Object.keys(before))assert.deepEqual(after[key],before[key],before.version+' '+key);if(after.publicDownloadURL&&!before.publicDownloadURL)assert.equal(require('../sender-download-url.cjs').isAllowed(after.publicDownloadURL),true,before.version+' immutable publication alias');}
});
test('activated receivers preserve prior pins and contain only the exact three new PS4 IDs',()=>{
 const build=read('docs/host-menu-companion-build.json');assert.equal(build.activated,true);
 for(const r of build.records){const b=check(path.join(root,r.path),r);check(path.join(root,r.immutablePath),r);check(r.backupPath,r);const items=JSON.parse(b.toString().match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]).items;
  assert.ok(items.length>=(r.platform==='ps4'?509:350));
  for(const a of actions){const item=items.find(x=>x.id===a.id);if(r.platform==='ps4'){assert.ok(item);assert.equal(item.sha256,a.sha256);assert.equal(item.url,a.downloadURL);}else assert.equal(item,undefined);}
 }
});
test('new requirement translations cover all twenty languages and preserve literal firmware and game updates',()=>{
 const table=require('../../i18n-tools/host-gta505-continuation-translations.cjs');
 for(const a of actions){const key=a.requirements[0];assert.ok(table[key]);assert.equal(Object.keys(table[key]).length,20);for(const [code,value]of Object.entries(table[key])){assert.ok(value.includes('5.05'));assert.ok(value.includes(a.gameVersion));const generated=fs.readFileSync(path.join(root,'languages',code+'.js'),'utf8');assert.ok(generated.includes(JSON.stringify(key)+': '+JSON.stringify(value)));}}
});
