const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const data=require('../../docs/discord-xbox360-resources.json');
const byId=id=>data.resources.find(item=>item.id===id);
test('Xbox MultiCOD games are archive-specific and keep known exclusions',()=>{
 const jimbo=byId('discord-xbox360-multicod-jimbo');assert.ok(jimbo.gameIds.includes('black-ops-2'));assert.equal(jimbo.gameIds.length,5);
 const aspire=byId('discord-xbox360-multicod-aspirece');assert.equal(aspire.gameIds.includes('cod4'),false);
 const lsb=byId('discord-xbox360-multicod-xbox360lsbest');assert.equal(lsb.gameIds.includes('modern-warfare-2'),false);
 const ninja=byId('discord-xbox360-multicod-ninja-v1');assert.equal(ninja.gameIds.includes('cod4'),false,'unresolved MW1 label must stay unresolved');
});
test('source-reported broken games remain separate from working-game claims',()=>{
 const item=byId('discord-xbox360-multicod-xecheats-v2');
 for(const id of ['black-ops-2','modern-warfare-3']){assert.ok(item.referenceGameIds.includes(id));assert.equal(item.gameIds.includes(id),false);}
 assert.match(item.note,/crash|fail|not work/i);
});

test('mislabeled source posts keep actual-game routing and unconfirmed forum associations separate',()=>{
 const myten=byId('discord-xbox360-gta5-myten-1-3');
 assert.equal(myten.gameId,'multicod');assert.equal(myten.gameIds.length,9);
 assert.equal(myten.gameIds.includes('gta-v'),false);assert.ok(myten.referenceGameIds.includes('gta-v'));
 assert.match(myten.referenceGameLabel,/without confirmed build support/);
 const vanguard=byId('discord-xbox360-gta4-vanguard');assert.deepEqual(vanguard.gameIds,['world-at-war']);assert.ok(vanguard.referenceGameIds.includes('gta-iv'));
 assert.match(vanguard.referenceGameLabel,/without confirmed build support/);
});

test('RDR download retains the actual Undead Nightmare edition and media pin',()=>{
 const item=byId('discord-xbox360-other-rdr-demonic-2-7');
 assert.deepEqual(item.gameIds,['red-dead-redemption-undead-nightmare']);
 assert.match(item.compatibility,/NON-GOTY/);assert.match(item.region,/5B48AF70/);
 assert.ok(item.referenceGameIds.includes('red-dead-redemption'));
 assert.equal(item.gameIds.includes('red-dead-redemption'),false);
});
test('repeat links inherit exact archive requirements without borrowing by menu name',()=>{
 const item=byId('discord-xbox360-mw2-tu9-supremacy-v1'),matrix=byId('discord-xbox360-multicod-matrix-v1');
 assert.equal(item.name,'Supremacy v1');assert.deepEqual(item.gameIds,matrix.gameIds);assert.match(item.note,/MatrixMods.*archive/i);
 assert.equal(item.downloads[0].url,matrix.downloads[0].url);
 assert.match(JSON.stringify(item.guideBlocks),/TU23/);assert.match(JSON.stringify(item.guideBlocks),/TU24/);
});
test('every reviewed supported game has a page and the original source anchor',()=>{
 for(const item of data.resources)for(const id of item.gameIds){const game=data.games.find(game=>game.id===id);assert.ok(game,id);const file=path.join(root,game.page.slice(1));assert.ok(fs.existsSync(file),file);assert.ok(fs.readFileSync(file,'utf8').includes('id="'+item.id+'"'),item.id+' on '+id);}
});
test('binary Fyrepit save remains a download rather than an inline image',()=>{
 const item=byId('discord-xbox360-waw-cfg-fyrepit-v2');assert.match(item.compatibility,/CON/);
 const {filesFor}=require('../build-discord-platform-resources.cjs'),inventory=require('../../docs/download-audit.json').items;
 const files=filesFor(item,inventory);assert.ok(files.some(file=>file.sha256==='dd0d8f43b27f6890f0dea3732ff9691407acabaa571fe8eae80b39204581b5b1'));
 const game=data.games.find(g=>g.id==='world-at-war'),html=fs.readFileSync(path.join(root,game.page.slice(1)),'utf8');
 assert.ok(!/<img\b[^>]*src="[^"]*savegame/i.test(html));
});

function scopedBuilder(){
 const vm=require('node:vm'),written=[];
 const gta=data.games.find(game=>game.id==='gta-v'),cod4=data.games.find(game=>game.id==='cod4');
 const resource=data.resources.find(item=>item.gameIds.includes('gta-v'));
 const fixture={games:[gta,cod4],resources:[resource,{...resource,id:'fixture-cod4',gameId:'cod4',gameIds:['cod4']}]};
 const fileSystem={
  existsSync:file=>/docs[\\/](?:discord-xbox360-resources|download-audit)\.json$/.test(file),
  readFileSync:file=>{
   if(file.endsWith('discord-xbox360-resources.json'))return JSON.stringify(fixture);
   if(file.endsWith('download-audit.json'))return JSON.stringify({items:[]});
   throw Error('Unexpected read outside selected outputs: '+file);
  },
  writeFileSync:file=>{throw Error('Unexpected metadata or unselected page write: '+file);}
 };
 const ui={
  esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
  note:value=>value,link:(url,label)=>`<a href="${url}">${label}</a>`,ext:(url,label)=>`<a href="${url}">${label}</a>`,
  section:(id,title,body)=>`<section id="${id}"><h2>${title}</h2>${body}</section>`,grid:(...cards)=>cards.join(''),
  resource:(title,description,links)=>title+description+links,
  page:(file,title,description,image,nav,body)=>written.push({file,body})
 };
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'scripts/build-discord-platform-resources.cjs'),'utf8'),{
  module,__dirname:path.join(root,'scripts'),console:{log(){}},URL,
  require:name=>{
   if(name==='node:fs')return fileSystem;
   if(name==='node:path')return path;
   if(name==='./build-console-guides.cjs')return ui;
   if(name==='./download-mirror-policy.cjs')return require('../download-mirror-policy.cjs');
   if(name==='./console-resource-renderer.cjs')return {createResourceRenderer:()=>({guideBlock:()=>'<p>Original requirements</p>'})};
   if(name==='./console-menu-media.cjs')return {createMenuMedia:()=>({figure:()=>'',details:()=>''})};
   if(name==='./build-xbox360-pages.cjs')return {xbox360nav:[]};
   if(name==='./console-mod-navigation.cjs')return require('../console-mod-navigation.cjs');
   throw Error('Unexpected builder dependency '+name);
  }
 });
 return {build:module.exports.build,written,resource};
}

test('targeted Discord builds refresh selected game and search pages without rewriting other pages or reports',()=>{
 const fixture=scopedBuilder(),selected=['console/xbox360/mods/gta-v/index.html','console/xbox360/mods/index.html'];
 fixture.build('xbox360',{onlyPages:selected});
 assert.deepEqual(fixture.written.map(output=>output.file).sort(),selected.sort());
 for(const output of fixture.written){
  assert.ok(output.body.includes('id="'+fixture.resource.id+'"'),output.file+' retains the source anchor');
  assert.ok(output.body.includes(fixture.resource.gameUpdate),output.file+' retains the exact source update');
  assert.ok(output.body.includes('No local build archived'),output.file+' does not invent an archived file');
 }
 assert.equal(fixture.written.find(output=>output.file.includes('/gta-v/')).body.includes('id="fixture-cod4"'),false);
});

test('targeted Discord builds reject unknown output paths before writing',()=>{
 for(const onlyPages of [[],['console/ps5/index.html'],['../outside.html'],'console/xbox360/mods/index.html']){
  const fixture=scopedBuilder();
  assert.throws(()=>fixture.build('xbox360',{onlyPages}),/onlyPages|Unsupported generated page/);
  assert.equal(fixture.written.length,0);
 }
});
