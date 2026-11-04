const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {relatedPatches,renderPatchLinks,appendPatchLinks}=require('../extra-game-patch-links.cjs');
const cheat={category:'cheat',publication:'include',gameIds:['example'],downloads:[{filename:'CUSA00135_01.15.json',distribution:'include'}]};
const patch={id:'example',title:'Example game',arch:'orbis',platforms:['ps4','ps5'],titleIds:['CUSA00135'],files:[{titleId:'CUSA00135'}],options:[{AppVer:'01.14',Name:'FPS option'}]};

test('context links require exact CUSA and PS4 patch-file support, independently of cheat update',()=>{
  const matches=relatedPatches('example',[cheat],{games:[patch]});
  assert.deepEqual(matches,[{id:'example',title:'Example game',titleIds:['CUSA00135'],url:'/console/ps4/game-patches.html#example'}]);
  for(const wrong of [
    {...patch,titleIds:['CUSA00133'],files:[{titleId:'CUSA00133'}]},
    {...patch,arch:'prospero'},
    {...patch,platforms:['ps5']},
    {...patch,files:[]}
  ])assert.deepEqual(relatedPatches('example',[cheat],{games:[wrong]}),[]);
  assert.deepEqual(relatedPatches('different-game',[cheat],{games:[patch]}),[]);
  assert.deepEqual(relatedPatches('example',[{...cheat,category:'source'}],{games:[patch]}),[]);
  const html=renderPatchLinks(matches);
  assert.match(html,/Cheat and patch update requirements are separate/);
  assert.match(html,/own game update, hardware and patch-engine requirements/);
  assert.ok(!html.includes('/console/ps5/'));
});

test('context section is idempotent and disappears when the exact title ID is removed',()=>{
  const html='<main><div>Existing cheat download and guide</div>\n<footer class="guide-footer">Footer</footer></main>';
  const matches=relatedPatches('example',[cheat],{games:[patch]});
  const once=appendPatchLinks(html,matches);
  assert.equal(appendPatchLinks(once,matches),once);
  assert.equal(appendPatchLinks(once,[]),html);
  assert.ok(once.includes('Existing cheat download and guide'));
  assert.equal((once.match(/id="related-game-patches"/g)||[]).length,1);
});

test('current context links resolve to the exact CUSA patch family and its PS4 page anchor',()=>{
  const root=path.resolve(__dirname,'../..');
  const data=JSON.parse(fs.readFileSync(path.join(root,'docs/ps4-ps5-game-resources.json'),'utf8'));
  const patches=JSON.parse(fs.readFileSync(path.join(root,'docs/ps4-ps5-game-patches.json'),'utf8'));
  let matched=0;
  for(const game of data.games.filter(game=>game.parent==='other-games')){
    for(const linked of relatedPatches(game.id,data.resources,patches)){
      matched++;
      const patch=patches.games.find(item=>item.id===linked.id);
      assert.ok(patch.platforms.includes('ps4'));
      assert.equal(patch.arch,'orbis');
      assert.ok(linked.titleIds.every(id=>patch.files.some(file=>file.titleId===id)));
      assert.equal(linked.url,'/console/ps4/game-patches.html#'+patch.id);
    }
  }
  assert.ok(matched>0);
});
