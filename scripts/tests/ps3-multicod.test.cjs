const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../..');
const routing = require('../ps3-multicod-metadata.cjs');
const catalog = require('../build-ps3-catalog.cjs');
const read = filename => fs.readFileSync(path.join(root,filename),'utf8');
const article = (html,id) => html.split(`id="${id}"`)[1]?.split('</article>')[0] || '';

test('repeat source posts inherit confirmed game routing only from exact reviewed download URLs',()=>{
  const entry=routing.metadata.resources['discord-ps3-mw2-inphect-package'];
  const duplicate={id:'another-source-post',gameId:'modern-warfare-2',downloads:[{url:entry.variants[0].sourceUrl}]};
  const enhanced=routing.enhanceResource(duplicate);
  assert.deepEqual(enhanced.gameIds,entry.supportedGameIds);
  assert.ok(enhanced.indexIds.includes('multicod'));
  assert.equal(routing.variantForFile(duplicate,{sha256:entry.variants[0].sha256}),entry.variants[0]);
  const unconfirmed={id:'unknown-multicod',name:'Multicod',gameId:'modern-warfare-2',downloads:[{url:'https://example.com/other.rar'}]};
  assert.equal(routing.enhanceResource(unconfirmed),unconfirmed);
});

test('reviewed routing adds missing games without replacing existing definitions or compatibility pins',()=>{
  const aw={id:'advanced-warfare',title:'An existing definition',url:'/existing/'};
  const before=[aw];
  const merged=routing.mergeGameDefinitions(before);
  assert.equal(merged.find(game=>game.id===aw.id),aw);
  assert.deepEqual(before,[aw]);
  const source={id:'discord-ps3-mw2-inphect-package',gameId:'modern-warfare-2',gameIds:['existing-game'],version:'pinned',compatibility:'source pin',downloads:[{url:'https://example.com/original'}]};
  const updated=routing.enhanceResource(source);
  assert.equal(updated.version,source.version);
  assert.equal(updated.compatibility,source.compatibility);
  assert.equal(updated.downloads,source.downloads);
  assert.deepEqual(source.gameIds,['existing-game']);
  assert.ok(updated.gameIds.includes('existing-game'));
  assert.ok(updated.gameIds.includes('ghosts'));
  assert.ok(updated.indexIds.includes('multicod'));
});

test('each archive-confirmed supported game has a page, resource and reciprocal resource link',()=>{
  const resources=catalog.data().resources;
  for(const [id,evidence] of Object.entries(routing.metadata.resources)) {
    const resource=resources.find(item=>item.id===id);
    assert.ok(resource,id);
    const card=catalog.card(resource);
    for(const gameId of evidence.supportedGameIds) {
      const game=catalog.games.find(game=>game.id===gameId);
      assert.equal(game?.parent,'call-of-duty',gameId);
      assert.ok(resource.gameIds.includes(gameId));
      const target=game.url.slice(1)+'index.html';
      const entry=article(read(target),id);
      assert.ok(entry,`${id} missing from ${target}`);
      assert.ok(card.includes(`href="${game.url}#${id}"`),`${id} missing ${gameId} link`);
      assert.ok(entry.includes(`href="${game.url}#${id}"`));
    }
    assert.ok(article(read('console/ps3/mods/multicod/index.html'),id));
  }
});

test('Jimbo originals remain visible as distinct hash-identified DEX and HEN downloads',()=>{
  const item=catalog.data().resources.find(item=>item.id==='discord-ps3-jimbo');
  const files=catalog.archivedFor(item);
  const html=catalog.card(item);
  for(const variant of routing.metadata.resources[item.id].variants) {
    const file=files.find(file=>file.sha256===variant.sha256);
    assert.ok(file,variant.label);
    assert.equal(file.bytes,variant.bytes);
    assert.ok(html.includes(`<h5>${variant.label}</h5>`));
    assert.ok(html.includes(`href="${file.local}"`));
    assert.ok(html.includes(`data-sha256="${variant.sha256}"`));
    assert.ok(!html.split(`href="${file.local}"`)[0].includes('<summary>More extracted files'));
  }
  assert.equal(routing.variantForFile(item,{name:'Jimbo-PS3HEN.rar',sha256:'0'.repeat(64)}),undefined);
  const viridian=catalog.data().resources.find(item=>item.id==='bo1-viridian');
  assert.match(viridian.compatibility,/CEX and HEN are not supported/);
  assert.equal(routing.variantForFile(viridian,files[1]),undefined);
});

test('MultiCOD remains a collection and new AW canonical is merged into the sitemap',()=>{
  assert.equal(catalog.games.find(game=>game.id==='multicod').kind,'collection');
  const chooser=catalog.chooser();
  assert.ok(!chooser.split('id="directory"')[0].includes('/mods/multicod/'));
  assert.ok(chooser.includes('Call of Duty multi-game collection'));
  const directory=read('console/ps3/mods/menus.html');
  assert.match(directory,/<optgroup label="Collections"><option value="multicod">Multi-game packs<\/option>/);
  assert.ok(!directory.match(/<optgroup label="Games">[\s\S]*?<\/optgroup>/)[0].includes('value="multicod"'));
  const aw=read('console/ps3/mods/call-of-duty/advanced-warfare/index.html');
  assert.ok(aw.includes('https://whatwhatboy.com/console/ps3/mods/call-of-duty/advanced-warfare/'));
  assert.ok(read('sitemap.xml').includes('<loc>https://whatwhatboy.com/console/ps3/mods/call-of-duty/advanced-warfare/</loc>'));
});

test('synonymous COD4 resources share one game option and the old URL retains all resource anchors',()=>{
  assert.equal(catalog.games.filter(game=>/^cod4(?:-|$)/.test(game.id)).length,1);
  const source={id:'source-labelled-cod4',gameId:'cod4-modern-warfare',gameIds:['cod4-modern-warfare','cod4'],version:'pinned',compatibility:'source pin'};
  const item=routing.enhanceResource(source);
  assert.equal(item.gameId,'cod4');
  assert.deepEqual(item.gameIds,['cod4']);
  assert.equal(source.gameId,'cod4-modern-warfare');
  assert.equal(item.compatibility,source.compatibility);
  const canonical=read('console/ps3/mods/call-of-duty/cod4/index.html');
  const alias=read('console/ps3/mods/call-of-duty/cod4-modern-warfare/index.html');
  assert.ok(alias.includes('<link rel="canonical" href="https://whatwhatboy.com/console/ps3/mods/call-of-duty/cod4/">'));
  assert.ok(alias.includes('<meta name="robots" content="noindex, follow">'));
  assert.deepEqual([...alias.matchAll(/<article[^>]*id="([^"]+)"/g)].map(match=>match[1]),[...canonical.matchAll(/<article[^>]*id="([^"]+)"/g)].map(match=>match[1]));
  const directory=read('console/ps3/mods/menus.html');
  assert.equal((directory.match(/<option value="cod4"/g)||[]).length,1);
  assert.ok(!directory.includes('<option value="cod4-modern-warfare"'));
});

test('Call of Duty chooser images and game destinations exist',()=>{
  const html=read('console/ps3/mods/call-of-duty/index.html');
  for(const match of html.matchAll(/(?:href|src)="(\/(?:assets\/images\/|console\/ps3\/mods\/call-of-duty\/)[^"#]*)"/g)){
    const file=match[1]+(match[1].endsWith('/')?'index.html':'');
    assert.ok(fs.existsSync(path.join(root,file.slice(1))),file);
  }
  const waw=catalog.games.find(game=>game.id==='world-at-war');
  assert.ok(fs.existsSync(path.join(root,waw.image.slice(1))));
  assert.ok(!html.includes('/assets/images/covers/cod-world-at-war.jpg'));
  assert.equal((html.match(/href="\/console\/ps3\/mods\/call-of-duty\/cod4\/"/g)||[]).length,1);
});
