const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('Crystalis remains PS4 GTA V 1.57 with the source title ID and data-folder requirements',()=>{
 const item=read('docs/ps4-ps5-game-resources.json').resources.find(x=>x.id==='gta5-crystalis-1-57');
 assert.ok(item);assert.deepEqual(item.platforms,['ps4']);assert.deepEqual(item.gameVersions,['1.57']);assert.deepEqual(item.titleIds,['CUSA00419']);
 assert.equal(item.downloads.length,2);assert.deepEqual(item.videos,[]);
 const guide=JSON.stringify(item.guideBlocks);assert.match(guide,/not included/);assert.match(guide,/LSOPlugin\.prx/);assert.match(guide,/\/data\/Crystalis\/imgs\/icon\.png/);assert.match(guide,/instead of replacing the whole file/);
 assert.equal(item.version,'GTA V 1.57');assert.equal(item.menuVersion,null);assert.equal(item.controls[0].input,'L1 + Circle');
});
test('Crystalis hosted files match the preserved archive and PS4 SELF module identities',()=>{
 const files=read('downloads/ps4-ps5/manifest.json').files.filter(x=>x.downloadId?.startsWith('gta5-crystalis-1-57-'));
 assert.equal(files.length,2);
 const saved=read('docs/qa/crystalis-ps4-157-archive.json').files;
 for(const file of files){const bytes=fs.readFileSync(path.join(root,'.'+file.local));assert.equal(bytes.length,file.bytes);assert.equal(sha(bytes),file.sha256);const backup=saved.find(x=>x.sha256===file.sha256);assert.ok(backup);assert.equal(sha(fs.readFileSync(backup.backupPath)),file.sha256);}
 const plugin=fs.readFileSync(path.join(root,'.'+files.find(x=>x.name==='Crystalis.sprx').local));
 assert.equal(plugin.readUInt32LE(0),0x1d3d154f);const elf=plugin.indexOf(Buffer.from([127,69,76,70]));assert.equal(elf,352);assert.equal(plugin.readUInt16LE(elf+18),62);
 assert.ok(plugin.includes(Buffer.from('Welcome to Crystalis SPRX!- 1.57')));
});
test('Crystalis appears in the game page and menu directory with both verified downloads',()=>{
 const html=fs.readFileSync(path.join(root,'console/mods/ps4/gta5/index.html'),'utf8');
 assert.ok(html.includes('id="resource-gta5-crystalis-1-57"'));assert.ok(html.includes('id="guide-gta5-crystalis-1-57"'));
 for(const file of read('downloads/ps4-ps5/manifest.json').files.filter(x=>x.downloadId?.startsWith('gta5-crystalis-1-57-')))assert.ok(html.includes('href="'+file.local+'"'));
 assert.ok(fs.readFileSync(path.join(root,'console/mods/ps4/menus.html'),'utf8').includes('Crystalis'));
});
