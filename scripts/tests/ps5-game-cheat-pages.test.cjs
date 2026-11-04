const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {collect,gameURL,validateIdentity}=require('../build-ps5-game-cheats.cjs');
const root=path.resolve(__dirname,'../..');
test('native pages reject PS4 IDs and mismatched filename/update identities',()=>{
  const valid={id:'example',titleId:'PPSA10662',gameVersion:'01.001.030',format:'JSON',filename:'PPSA10662_01.001.030.json'};
  assert.doesNotThrow(()=>validateIdentity(valid));
  for(const change of [{titleId:'CUSA10662'},{filename:'PPSA10662_01.001.000.json'},{gameVersion:'01.30'},{format:'ELF'}]) assert.throws(()=>validateIdentity({...valid,...change}),/Invalid native PS5 identity/);
});
test('each backed native build has its own matching download/storage row and collapsed setup',()=>{
  const games=collect();assert.equal(games.length,17);assert.equal(games.reduce((s,g)=>s+g.files.length,0),20);
  for(const game of games){
    const html=fs.readFileSync(path.join(root,gameURL(game).slice(1),'index.html'),'utf8');
    for(const file of game.files){
      assert.ok(html.includes(file.titleId+' · '+file.gameVersion));
      assert.ok(html.includes('href="'+file.url+'" download="'+file.filename+'"'));
      assert.ok(html.includes('/console/ps5/downloads.html?file='+file.id+'#files'));
    }
    assert.match(html,/<summary>Setup &amp; source<\/summary>/);assert.doesNotMatch(html,/<details[^>]*\sopen(?:\s|>)/);
    assert.doesNotMatch(html,/\bCUSA\d{5}\b/);
  }
});
