const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const templates=require('../host-plugin-templates.cjs'),root=path.resolve(__dirname,'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'downloads/hosts/ps4/plugin-templates/20261104/manifest.json')));
test('every game template labels all regions without activating placeholder paths or invented title IDs',()=>{
 for(const file of manifest.files){const text=fs.readFileSync(path.join(root,file.local),'utf8');for(const region of ['EU','USA','JP'])assert.ok(text.includes('; '+region+'\r\n'),file.id);assert.ok(text.split(/\r?\n/).every(line=>!line.trim()||line.startsWith(';')),file.id);assert.equal(path.basename(file.local),'plugins.ini');assert.equal(crypto.createHash('sha256').update(text).digest('hex'),file.sha256);}
 assert.equal(manifest.autoInstall,false);assert.equal(manifest.installPath,'/data/GoldHEN/plugins.ini');
});
test('supplied originals are preserved separately and links retain normal PC downloads',()=>{
 for(const file of manifest.originals){const bytes=fs.readFileSync(path.join(root,file.local));assert.equal(bytes.length,file.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);}
 const html=templates.apply('<div id="host-action-grid"></div>','hosts/ps4/index.html');assert.equal((html.match(/download="plugins.ini"/g)||[]).length,17);assert.ok(html.includes('data-no-file-options'));assert.equal(templates.apply(html,'hosts/ps4/index.html'),html);assert.equal(templates.apply('<div id="host-action-grid"></div>','hosts/ps5/index.html'),'<div id="host-action-grid"></div>');
});
