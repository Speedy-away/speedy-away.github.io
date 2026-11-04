const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const source=read('docs/ps4-extra-game-cheats.json');
const jobs=read('docs/ps4-extra-game-download-jobs.json').jobs;
const descriptors=read('docs/ps4-extra-game-downloads.json');
const catalog=read('docs/ps4-ps5-game-resources.json');
const tree=read('docs/ps4-ps5-research/goldhen-full-tree.json');
const idFor=file=>'goldhen-'+file.filename.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-json$/,'');
const hash=(bytes,algorithm='sha256')=>crypto.createHash(algorithm).update(bytes).digest('hex');

test('ready cheat definitions exactly match their title ID, update, labels and pinned official bytes',()=>{
  assert.equal(source.commit,tree.sha);
  assert.equal(new Set(source.files.map(file=>file.filename)).size,source.files.length);
  for(const file of source.files){
    const id=idFor(file),job=jobs.find(job=>job.id===id);
    assert.ok(job,id);
    const saved=file.stagedPath||'downloads/ps4-ps5/'+id+'/'+file.filename;
    const bytes=fs.readFileSync(path.join(root,saved));
    assert.equal(bytes.length,file.bytes,id);
    assert.equal(hash(bytes),file.sha256,id);
    const official=tree.tree.find(item=>item.path==='json/'+file.filename);
    assert.ok(official,id);
    assert.equal(hash(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes]),'sha1'),official.sha,id);
    const json=JSON.parse(bytes.toString('utf8'));
    assert.equal(json.id,file.titleId,id);
    assert.equal(json.version,file.version,id);
    assert.equal(json.name,file.sourceName,id);
    assert.equal(json.process,file.process,id);
    assert.equal(file.filename,json.id+'_'+json.version+'.json',id);
    assert.ok(json.mods.length>0,id);
    assert.deepEqual(file.cheats,json.mods.map(mod=>mod.name),id);
    assert.deepEqual(file.credits,json.credits,id);
    assert.equal(job.expectedBytes,bytes.length,id);
    assert.equal(job.expectedSha256,hash(bytes),id);
    assert.equal(job.platform,'PS4',id);
    assert.equal(job.url,file.url,id);
    assert.ok(file.url.includes('/'+source.commit+'/json/'),id);
  }
});

test('each definition has its own game, PS4-only descriptor, guide conditions and verified local artwork',()=>{
  assert.equal(new Set(jobs.map(job=>job.id)).size,jobs.length);
  assert.equal(new Set(catalog.games.map(game=>game.id)).size,catalog.games.length);
  assert.equal(new Set(catalog.resources.map(resource=>resource.id)).size,catalog.resources.length);
  for(const file of source.files){
    const id=idFor(file),resource=catalog.resources.find(item=>item.id===id),game=catalog.games.find(item=>item.id===file.game),descriptor=descriptors.resources.find(item=>item.id===id);
    assert.ok(resource&&game&&descriptor,id);
    assert.equal(game.parent,'other-games',id);
    assert.deepEqual(descriptor.platforms,['ps4'],id);
    assert.equal(descriptor.page,'/console/mods/ps4/'+file.game+'/',id);
    assert.ok(resource.compatibilityText.includes(file.titleId),id);
    assert.ok(resource.compatibilityText.includes(file.version),id);
    assert.ok(resource.compatibilityText.includes('Native PS5 support has not been established'),id);
    assert.deepEqual(resource.videos,[],id);
    assert.deepEqual(resource.guideBlocks.find(block=>block.title==='Cheat labels and conditions from this exact file').items,file.cheats.map(name=>name.trim()),id);
    assert.ok(fs.existsSync(path.join(root,descriptor.image.slice(1))),id);
    const provenance=descriptors.imageSources.find(image=>image.file===descriptor.image);
    assert.ok(/^https:\/\//.test(provenance?.source||'') ||
      (provenance?.source==='Original site title illustration' &&
       provenance.type==='Original typeset illustration, not publisher artwork or game screenshot' &&
       file.artwork?.source===provenance.source),id);
    if(file.artwork){
      const image=fs.readFileSync(path.join(root,descriptor.image.slice(1)));
      assert.equal(image.length,file.artwork.bytes,id);
      assert.equal(hash(image),file.artwork.sha256,id);
      assert.equal(provenance.source,file.artwork.source,id);
    }
  }
});

test('multiple title-ID builds stay distinguishable in game cards, introductions and download listings',()=>{
  for(const gameId of new Set(source.files.map(file=>file.game))){
    const variants=source.files.filter(file=>file.game===gameId);
    if(variants.length<2)continue;
    const game=catalog.games.find(game=>game.id===gameId);
    const html=fs.readFileSync(path.join(root,'console/mods/ps4',game.slug,'index.html'),'utf8');
    const names=[];
    for(const file of variants){
      const id=idFor(file),resource=catalog.resources.find(item=>item.id===id),descriptor=descriptors.resources.find(item=>item.id===id);
      assert.ok(game.intro.includes(file.titleId+' · '+file.version),id);
      assert.ok(resource.name.includes(file.titleId),id);
      assert.ok(descriptor.title.includes(file.titleId),id);
      assert.ok(html.includes('Download '+file.filename),id);
      assert.ok(game.sourceLinks.some(([url])=>url.endsWith('/'+file.filename)),id);
      names.push(resource.name);
    }
    assert.equal(new Set(names).size,names.length,gameId);
  }
});
