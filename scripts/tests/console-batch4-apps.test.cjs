const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const apps=read('docs/console-batch4-apps.json').resources;
test('new PS5 app releases keep exact publisher digests, complete native layouts and platform scopes',()=>{
  const jobs=read('docs/console-batch4-app-jobs.json').jobs,baseline=read('docs/qa/console-expansion-batch4-baseline.json');
  assert.equal(apps.length,3);
  for(const app of apps){
    const job=jobs.find(job=>job.id===app.id),bytes=fs.readFileSync(path.join(root,job.importPath));
    assert.ok(!baseline.items.some(item=>item.id===app.id));
    assert.deepEqual(app.platforms,['ps5']);
    assert.equal(bytes.length,job.expectedBytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),job.expectedSha256);
    const release=read(app.id.includes('prosperolight')?'docs/qa/batch4-prosperolight-release.json':'docs/qa/batch4-recompstore-release.json');
    const asset=release.assets.find(asset=>asset.name===app.filename);
    assert.equal(asset.digest,'sha256:'+app.sha256);
    assert.equal(asset.browser_download_url,app.url);
    assert.equal(app.bytes,asset.size);
  }
  const inspection=read('docs/qa/console-batch4-app-inspection.json').inspection;
  assert.equal(inspection.length,2);
  for(const app of inspection){
    assert.equal(app.executed,false);
    assert.ok(['5414f5ee','4f153d1d'].includes(app.ebootMagic));
    assert.ok(app.layout.entries.some(file=>file.path===app.metadata.titleId+'/sce_sys/param.json'));
    assert.ok(app.layout.entries.some(file=>file.path===app.metadata.titleId+'/eboot.bin'));
  }
  assert.equal(apps.find(app=>app.title==='ProsperoLight').packageMetadata.contentVersion,'01.000.110');
  assert.equal(apps.find(app=>app.title==='RecompStore').packageMetadata.contentVersion,'02.740.000');
  const installer=apps.find(app=>app.category==='payloads');
  require('../prepare-console-multicod-files.cjs').inspectElf(fs.readFileSync(path.join(root,jobs.find(job=>job.id===installer.id).importPath)));
});
test('new app instructions distinguish host pairing, full bundles and installer update behavior',()=>{
  const light=apps.find(app=>app.title==='ProsperoLight'),store=apps.find(app=>app.title==='RecompStore'),installer=apps.find(app=>app.category==='payloads');
  assert.match(light.preparation,/Sunshine/);assert.match(light.preparation,/pairing PIN/);assert.match(light.preparation,/\/data\/homebrew/);
  for(const app of [store,installer]){
    assert.match(app.compatibility,/kstuff/);assert.match(app.compatibility,/9021/);assert.match(app.compatibility,/ShadowMountPlus 1\.7 Beta 5/);
    assert.match(app.preparation,/newest upstream/);assert.match(app.preparation,/v2\.7\.4/);
  }
  const anchors=apps.map(app=>app.page.split('#')[1]);assert.equal(new Set(anchors).size,apps.length);
});
