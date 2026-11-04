'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const builder=require('../build-host-game-patches.cjs'),ui=require('../../assets/host-game-patches.js');
const root=process.env.HOST_ROOT||path.resolve(__dirname,'../..'),data=JSON.parse(fs.readFileSync(path.join(root,'docs/ps4-ps5-game-patches.json')));
test('PS4 and PS5 keep architecture and backward-compatibility labels distinct',()=>{const ps4=builder.catalog(data,'ps4'),ps5=builder.catalog(data,'ps5');assert.equal(ps4.length,98);assert.equal(ps5.length,101);assert.ok(ps4.every(g=>g.arch==='orbis'));assert.ok(ps5.some(g=>g.arch==='prospero'&&g.edition==='Native PS5'));assert.ok(ps5.some(g=>g.id==='red-dead-redemption-2'&&g.edition==='PS4 game on PS5'));});
test('RDR2 retains exact game updates and separate 120Hz source note',()=>{const rdr=builder.catalog(data,'ps5').find(g=>g.id==='red-dead-redemption-2');assert.deepEqual(rdr.updates,['01.29','01.32']);assert.ok(rdr.options.some(o=>o.name==='Unlock FPS 120fps'&&o.gameVersion==='01.32'&&/120Hz/.test(o.note)));assert.match(ui.detail(rdr),/does not guarantee stable 120 FPS/);assert.equal(rdr.files.length,3);});
test('every existing patch resource matches its source-pinned size and SHA256',()=>{assert.equal(builder.verify(root,data).length,281);});
test('pages provide simple exact-title Load and Download without console connection or setup panels',()=>{for(const p of ['ps4','ps5']){
 const html=builder.render(data,p);assert.match(html,/id="host-patch-overlay"/);assert.match(html,/Game patches/);assert.ok(html.includes(data.tools.find(t=>t.id==='fps-'+p+'-patch-system-'+data.engine.release).source));
 assert.doesNotMatch(html,/host-patch-manager-form|host-patch-address|host-patch-setup|host-patch-handoff|Console IPv4 address|through console receiver|data-apply-patch|onclick=/);
 assert.doesNotMatch(html,/data-wwb-image-heading|class="wwb-heading-art"/);assert.match(html,/data-wwb-text-heading/);
 assert.equal(ui.availability(p,'Desktop').available,false);assert.equal(ui.availability(p,p==='ps4'?'PlayStation 4/14.00':'PlayStation 5/13.60').available,false);
}});
test('embedded patch metadata round trips hostile text without executable HTML',()=>{
 const game={...data.games[0],title:'<img src=x onerror=evil()> & text'};
 const html=builder.render({...data,games:[game]},'ps4'),json=html.match(/<script id="host-patches-data"[^>]*>([\s\S]*?)<\/script>/)[1];
 assert.equal(JSON.parse(json).games[0].title,game.title);assert.doesNotMatch(json,/<img/);
});
test('popup escapes hostile metadata and search matches title IDs and exact updates',()=>{const games=builder.catalog(data,'ps4');assert.ok(ui.filter(games,'CUSA03041').some(g=>g.id==='red-dead-redemption-2'));assert.ok(ui.filter(games,'01.32').some(g=>g.id==='red-dead-redemption-2'));assert.equal(ui.filter(games,'not-a-real-game-29374').length,0);const evil={id:'x',edition:'<img>',files:[{url:'/a" onclick="bad',titleId:'<svg>'}],options:[{name:'<script>',gameVersion:'"',patchVersion:'1',author:'<x>',note:'<x>'}],source:'https://example.com/"'};assert.doesNotMatch(ui.detail(evil),/<script>|onclick="bad|<svg>/);});
test('artwork is contained and tiles grow from two to five columns without cropped covers',()=>{const css=fs.readFileSync(path.join(root,'assets/host-game-patches.css'),'utf8');assert.match(css,/object-fit:contain/);assert.doesNotMatch(css,/object-fit:cover/);assert.match(css,/repeat\(5,minmax\(0,1fr\)\)/);});
test('every selected game cover is present in the independent site',()=>{for(const game of data.games)assert.ok(fs.existsSync(path.join(root,game.image)),game.image);});
