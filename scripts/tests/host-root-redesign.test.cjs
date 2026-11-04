'use strict';
// Inert fixtures and file identities only. Never contact a console or run its payloads.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),patches=require('../../assets/host-game-patches.js');
test('native patch-manager handoff accepts only private IPv4 addresses and fixes its port and path',()=>{
 for(const ip of ['10.0.0.4','172.16.1.8','172.31.255.2','192.168.1.42'])assert.equal(patches.managerURL(ip),'http://'+ip+':23900/');
 for(const ip of ['example.com','127.0.0.1','192.168.1.999','172.32.1.1','192.168.1.4:8080','http://192.168.1.4','192.168.1.4/x','192.168.01.4'])assert.throws(()=>patches.managerURL(ip));
});
test('exact title-ID receiver links retain real file IDs and do not offer XML execution',()=>{
 const data=require('../../docs/ps4-ps5-game-patches.json'),builder=require('../build-host-game-patches.cjs'),catalog=require('../../docs/console-download-catalog.json').items;
 for(const platform of ['ps4','ps5'])for(const game of builder.catalog(data,platform)){
  const html=patches.detail(game);assert.doesNotMatch(html,/data-launch|data-apply-patch|onclick=/);
  for(const f of game.files){const native=catalog.find(i=>i.id===f.downloadId);assert.ok(native,f.downloadId);assert.equal(native.sha256,f.sha256);assert.ok(native.platforms.includes(platform));assert.ok(html.includes('?file='+encodeURIComponent(f.downloadId)));}
 }
});
test('decorative code performs no storage, request or native action and stays idle on console and reduced motion',()=>{
 const source=fs.readFileSync(path.join(root,'assets/host-playstation.js'),'utf8');
 for(const [ua,reduced,pathname] of [['PlayStation 4/9.00',false,'/hosts/ps4/'],['PlayStation 5/4.51',false,'/hosts/ps5/'],['Desktop',true,'/'],['Desktop',false,'/hosts/runtime/native/web/']]){
  let created=0;const doc={body:{className:'',appendChild(){created++;}},createElement(){created++;throw Error('Decoration must stay idle');}};
  const win={location:{pathname},navigator:{userAgent:ua},matchMedia:()=>({matches:reduced}),get localStorage(){throw Error('Unexpected storage');},fetch(){throw Error('Unexpected request');}};
  vm.runInNewContext(source,{window:win,document:doc});assert.equal(created,0);
 }
});
test('authored pages get Credits and presentation while native documents remain unchanged by the theme adapter',()=>{
 const theme=require('../style-host-pages.cjs'),html='<html><head></head><body><main><h1>Fixture</h1></main></body></html>';
 const result=theme.themeHTML(html,'hosts/ps5/index.html');assert.ok(result.includes('href="/hosts/credits/"'));assert.ok(result.includes('host-playstation.css'));assert.equal(theme.themeHTML(result,'hosts/ps5/index.html'),result);
 assert.equal(theme.themeHTML(html,'hosts/runtime/native/web/index.html'),html);
});
