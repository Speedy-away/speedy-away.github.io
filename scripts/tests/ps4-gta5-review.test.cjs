const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const data=()=>read('docs/ps4-ps5-game-resources.json');
const item=id=>data().resources.find(x=>x.id===id);
test('PS4 GTA V review preserves every prior resource, download ID, original file and older release',()=>{
 const before=read('docs/qa/ps4-gta5-review-baseline.json');
 const resources=data().resources,manifest=read('downloads/ps4-ps5/manifest.json').files;
 for(const old of before.resources){const next=resources.find(x=>x.id===old.id);assert.ok(next,old.id);for(const file of old.downloads||[])assert.ok(next.downloads.some(x=>x.id===file.id&&x.url===file.url),file.id);}
 for(const old of before.files){assert.ok(manifest.some(x=>x.downloadId===old.downloadId&&x.sha256===old.sha256&&x.local===old.local),old.downloadId);}
 assert.deepEqual(read('downloads/ps4/GTA5/manifest.json').files,before.legacyFiles);
 for(const id of ['gta5-expulsion-v5-1-57','gta5-expulsion-v7-1-57','gta5-velora-1-57','gta5-velora-v1-5-1-57'])assert.ok(item(id));
});
test('Archive-derived update labels keep distinct module identities and missing Lite key visible',()=>{
 assert.deepEqual(item('gta5-scorpion-v1-2b').gameVersions,['1.00','1.38','1.43','1.46','1.48','1.49','1.50']);
 assert.deepEqual(item('gta5-beach-legacy').gameVersions,['1.46','1.47','1.48','1.49','1.50','1.51','1.52','1.53']);
 assert.deepEqual(item('gta5-oxagon-1-56').gameVersions,['1.53','1.56']);
 const lite=item('gta5-oxagon-lite-v1-4');assert.deepEqual(lite.gameVersions,['1.53','1.56']);
 assert.match(JSON.stringify(lite.guideBlocks),/Oxagon\.key/);assert.match(JSON.stringify(lite.guideBlocks),/contains no \.key/);
 assert.match(lite.description,/missing/);
 for(const id of ['gta5-oxagon-1-56','gta5-oxagon-lite-v1-4']){
  const r=item(id),files=read('downloads/ps4-ps5/manifest.json').files.filter(x=>r.downloads.some(d=>x.downloadId===d.id)&&x.memberPath);
  assert.equal(files.length,2);assert.notEqual(files[0].sha256,files[1].sha256);
 }
 assert.ok(!JSON.stringify(data().resources.filter(x=>x.gameIds.includes('gta5')).map(x=>x.titleIds)).includes('CUSA12345'));
});
test('Every reviewed GTA V entry has a written guide and verified images keep their true scope',()=>{
 const resources=data().resources.filter(x=>x.gameIds.includes('gta5')&&x.category!=='source');assert.ok(resources.length>=26);
 for(const r of resources){assert.ok(r.guideBlocks.length,r.id);assert.deepEqual(r.platforms,['ps4']);}
 for(const id of ['gta5-ozark-1-56','gta5-ozark-1-57'])assert.equal(item(id).images[0].display,'/assets/images/ps4-gta5/ozark-user-preview-2026-11-02.png');
 assert.equal(sha(fs.readFileSync(path.join(root,'assets/images/ps4-gta5/ozark-user-preview-2026-11-02.png'))),'244b08a29d89a5eb6be821280c72b86ba04cb3d705767dc06407ca8dc920dae2');
 assert.equal(item('gta5-serendipity-1-57').images[0].display,'/assets/images/ps4-gta5/serendipity.png');
 assert.equal(item('gta5-beta-rebranded').images.length,0);
 assert.equal(item('gta5-cyprus').controls[0].input,'R1 + D-pad Left');
 assert.deepEqual(item('gta5-beta-rebranded').gameVersions,[]);
});
test('Every newly exposed module and reconciled legacy file matches its public and F: bytes',()=>{
 const jobs=read('docs/qa/ps4-gta5-review-jobs.json').files,saved=read('docs/qa/ps4-gta5-review-archive.json').files;
 assert.equal(jobs.length,22);assert.equal(jobs.filter(x=>x.memberPath).length,7);
 for(const f of jobs){const bytes=fs.readFileSync(path.join(root,'.'+f.local));assert.equal(sha(bytes),f.sha256);assert.equal(bytes.length,f.bytes);
  const backup=saved.find(x=>x.sha256===f.sha256);assert.ok(backup,f.name);assert.equal(sha(fs.readFileSync(backup.backupPath)),f.sha256);
  if(f.downloadId)assert.ok(read('downloads/ps4-ps5/manifest.json').files.some(x=>x.downloadId===f.downloadId&&x.sha256===f.sha256));
 }
});
test('Generated GTA V page has unique anchors, working per-menu guides and no accidental broad rebuild',()=>{
 const html=fs.readFileSync(path.join(root,'console/mods/ps4/gta5/index.html'),'utf8');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);
 for(const r of data().resources.filter(x=>x.gameIds.includes('gta5')&&x.category!=='source'))assert.ok(ids.includes('guide-'+r.id),r.id);
 assert.match(html,/ozark-user-preview-2026-11-02\.png/);
 assert.ok(!html.includes('src="/assets/images/ps4-gta5/ozark.png"'));
 assert.match(fs.readFileSync(path.join(root,'scripts/build-ps4-mods.cjs'),'utf8'),/--gta5-only/);
 assert.match(fs.readFileSync(path.join(root,'console/mods/ps4/gta5/install.html'),'utf8'),/does not contain that file/);
});
