'use strict';
// Catalogue/markup fixtures only. Never navigate a native page or run an XML patch.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const builder=require('../build-host-game-patches.cjs'),ui=require('../../assets/host-game-patches.js'),root=path.resolve(__dirname,'../..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const first={Title:'Fixture Game',Name:'Skip Intro',AppVer:'01.00',PatchVer:'1.2',Author:'Region A author',Note:'Region A only: leave the camera unchanged.',AppElf:'eboot-a.bin',titleIds:['CUSA00001'],sourcePath:'patches/xml/Fixture.xml'};
const second={Title:'Fixture Game',Name:'Restore Debug Camera',AppVer:'mask',PatchVer:'2.0',Author:'Region B author',Note:'Region B only: pattern scan, no exact update pin.',AppElf:'eboot-b.bin',titleIds:['CUSA00002'],sourcePath:'patches/xml/Fixture.xml'};
function fixture(){return builder.catalog({repository:'https://example.test/patches',revision:'a'.repeat(40),games:[{id:'fixture-game',title:'Fixture Game',arch:'orbis',image:'/assets/images/host-catalog/games.svg',platforms:['ps4','ps5'],sourcePath:'patches/xml/Fixture.xml',options:[first,second],files:[{titleId:'CUSA00001',downloadLocal:'/downloads/fixture/region-a/CUSA00001.xml',downloadId:'exact-a',bytes:11,sha256:'a'.repeat(64),options:[first]},{titleId:'CUSA00002',downloadLocal:'/downloads/fixture/region-b/CUSA00002.xml',downloadId:'exact-b',bytes:22,sha256:'b'.repeat(64),options:[second]}]}]},'ps5')[0];}
const context=titleId=>({titleId,userAgent:'PlayStation 5/5.50'});
const identity=option=>JSON.stringify({name:option.name||'',gameVersion:option.gameVersion||'',patchVersion:option.patchVersion||'',author:option.author||'',note:option.note||'',appElf:option.appElf||'',sourcePath:option.sourcePath||''});
const expected=option=>identity({name:option.Name,gameVersion:option.AppVer,patchVersion:option.PatchVer,author:option.Author,note:option.Note,appElf:option.AppElf,sourcePath:option.sourcePath});
test('selected title ID exposes its complete non-FPS options and exact unchanged XML download',()=>{
 const game=fixture(),a=ui.detail(game,context('CUSA00001')),b=ui.detail(game,context('CUSA00002'));
 assert.match(a,/>Skip Intro<\/strong>/);assert.match(a,/Region A only/);assert.doesNotMatch(a,/Restore Debug Camera|Region B only/);
 assert.match(b,/>Restore Debug Camera<\/strong>/);assert.match(b,/Region B only/);assert.match(b,/Pattern matched \(no exact update pin\)/);assert.doesNotMatch(b,/Skip Intro|Region A only/);
 assert.match(a,/href="\/downloads\/fixture\/region-a\/CUSA00001\.xml" download="CUSA00001\.xml"/);assert.match(b,/href="\/downloads\/fixture\/region-b\/CUSA00002\.xml" download="CUSA00002\.xml"/);
 assert.equal(game.files[0].downloadId,'exact-a');assert.equal(game.files[1].downloadId,'exact-b');assert.equal(game.files[0].sha256,'a'.repeat(64));assert.equal(game.files[1].sha256,'b'.repeat(64));
 assert.equal(game.edition,'PS4 game on PS5');assert.doesNotMatch(a+b,/data-apply-patch|onclick=|<iframe|<script/);
});
test('AppElf requirements survive normalization and appear only for the selected title file',()=>{
 const game=fixture();assert.equal(game.files[0].options[0].appElf,'eboot-a.bin');assert.equal(game.files[1].options[0].appElf,'eboot-b.bin');
 assert.match(ui.detail(game,context('CUSA00001')),/eboot-a\.bin/);assert.doesNotMatch(ui.detail(game,context('CUSA00001')),/eboot-b\.bin/);
});
test('legacy unscoped records remain readable, exact empty option sets do not leak a union, and hostile text stays escaped',()=>{
 const game=fixture(),legacy={...game,files:game.files.map(({options,...file})=>file)};
 assert.match(ui.detail(legacy,context('CUSA00001')),/Skip Intro/);assert.doesNotMatch(ui.detail(legacy,context('CUSA00001')),/Restore Debug Camera/);
 const empty={...game,files:[{...game.files[0],options:[]}]};assert.doesNotMatch(ui.detail(empty,context('CUSA00001')),/Skip Intro|Restore Debug Camera/);
 const malicious={...game,files:[{...game.files[0],options:[{name:'<script>bad()</script>',author:'<img src=x onerror=bad()>',gameVersion:'01.00',patchVersion:'',appElf:'<svg/onload=bad()>',note:'<iframe src=evil> & note',titleIds:['CUSA00001']}]}]};
 const html=ui.detail(malicious,context('CUSA00001'));assert.doesNotMatch(html,/<script|<img|<svg|<iframe/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;iframe src=evil&gt; &amp; note/);assert.doesNotMatch(html,/undefined/);
});
test('all raw-source options remain reachable through exact file metadata without inventing native PS5 architecture',()=>{
 const full=read('docs/host-all-game-patches.json'),loaded=builder.loadData(root),catalogues={ps4:builder.catalog(loaded,'ps4'),ps5:builder.catalog(loaded,'ps5')};let reachable=0;
 const rawOptions=full.games.reduce((n,game)=>n+game.options.length,0),sourceOptions=full.sourceFiles.reduce((n,file)=>n+file.optionCount,0);
 assert.equal(rawOptions,sourceOptions,'Every raw source Metadata entry must remain represented');
 for(const original of full.games){
  const platform=original.platforms.includes('ps4')?'ps4':'ps5',game=catalogues[platform].find(g=>g.id===original.id);assert.ok(game,original.id);assert.equal(game.arch,original.arch);
  if(original.arch==='orbis'&&original.platforms.includes('ps5')){const onPS5=catalogues.ps5.find(g=>g.id===original.id);assert.ok(onPS5);assert.equal(onPS5.edition,'PS4 game on PS5');}
  for(const option of original.options){
   const file=game.files.find(f=>(!option.titleIds||option.titleIds.includes(f.titleId))&&(f.options||[]).some(o=>identity(o)===expected(option)));
   assert.ok(file,original.id+' '+option.Name+' '+option.AppVer+' must reach its exact title file');
   const html=ui.detail(game,context(file.titleId));assert.ok(html.includes(ui.escape(option.Name)),original.id+' visible option');if(option.Note)assert.ok(html.includes(ui.escape(option.Note)),original.id+' source note');reachable++;
  }
 }
 assert.equal(reachable,rawOptions);assert.ok(reachable>=533,'Complete pinned source option coverage');
});
test('RDR2 keeps all original non-FPS options and separate update-specific 120Hz caveat',()=>{
 const game=builder.catalog(builder.loadData(root),'ps5').find(g=>g.id==='red-dead-redemption-2');assert.ok(game);
 const html=ui.detail(game,context(game.files[0].titleId));assert.match(html,/Skip Intro/);assert.match(html,/Disable Invisible Snipers/);assert.match(html,/Game 01\.29/);assert.match(html,/Game 01\.32/);assert.match(html,/Unlock FPS 120fps/);assert.match(html,/VideoOut.*120Hz/);assert.match(html,/does not guarantee stable 120 FPS/);
 assert.ok(ui.filter([game],'Skip Intro').includes(game));assert.ok(ui.filter([game],'120Hz').includes(game));
});
