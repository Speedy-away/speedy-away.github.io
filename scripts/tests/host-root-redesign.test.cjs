'use strict';
// Inert fixtures and file identities only. Never contact a console or run its payloads.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),patches=require('../../assets/host-game-patches.js');
test('native patch-manager handoff targets only the installed title on this console',()=>{
 assert.equal(patches.nativeURL('ps4','CUSA08519','PlayStation 4/9.00'),'http://127.0.0.1:23900/xml_orbis/CUSA08519.xml');
 assert.equal(patches.nativeURL('ps5','PPSA01234','PlayStation 5/12.70'),'http://127.0.0.1:23900/xml_prospero/PPSA01234.xml');
 for(const id of ['../CUSA08519','CUSA08519.xml','CUSA08519?x=1','CUSA08519/','PPSA01234'])assert.throws(()=>patches.nativeURL('ps4',id,'PlayStation 4/9.00'));
});
test('exact title downloads retain real file identities without a receiver or XML execution',()=>{
 const data=require('../../docs/ps4-ps5-game-patches.json'),builder=require('../build-host-game-patches.cjs'),catalog=require('../../docs/console-download-catalog.json').items;
 for(const platform of ['ps4','ps5'])for(const game of builder.catalog(data,platform))for(const f of game.files){
  const html=patches.detail(game,{titleId:f.titleId});assert.doesNotMatch(html,/data-launch|data-apply-patch|onclick=|through console receiver/);
  const native=catalog.find(i=>i.id===f.downloadId);assert.ok(native,f.downloadId);assert.equal(native.sha256,f.sha256);assert.ok(native.platforms.includes(platform));assert.ok(html.includes('href="'+f.url+'"'));assert.ok(html.includes('download="'+f.titleId+'.xml"'));
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
test('Blue Current mounts one inert scene on desktop without network, storage or recurring JavaScript',()=>{
 const source=fs.readFileSync(path.join(root,'assets/host-playstation.js'),'utf8'),nodes=[];
 const doc={body:{className:'',appendChild(n){nodes.push(n);}},createElement(){return {setAttribute(k,v){this[k]=v;}};}};
 const refuse=()=>{throw Error('Decoration must not perform work');};
 const win={location:{pathname:'/hosts/ps4/'},navigator:{userAgent:'Desktop'},matchMedia:()=>({matches:false}),fetch:refuse,get localStorage(){return refuse();}};
 vm.runInNewContext(source,{window:win,document:doc,setTimeout:refuse,setInterval:refuse,requestAnimationFrame:refuse});
 assert.equal(nodes.length,1);assert.equal(nodes[0]['aria-hidden'],'true');assert.doesNotMatch(nodes[0].innerHTML,/<(?:a|button|input|img|canvas|video|iframe)\b/);assert.equal((nodes[0].innerHTML.match(/<div/g)||[]).length,7);
});
test('console browsing has no search control and firmware Load stays text-only and gated without it',()=>{
 const {fixture}=require('./host-continuation-dom.cjs'),{hostActions}=require('../build-host-selector.cjs');
 for(const platform of ['ps4','ps5']){
  const actions=hostActions(platform),markup=require('../host-webhost-markup.cjs').dashboard(platform,actions);
  assert.doesNotMatch(markup,/id="host-search"|Search this console/);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'hosts',platform,'index.html'),'utf8'),/id="host-search"|Search this console/);
  const a=actions.find(a=>a.category==='loaders'&&a.browserHost&&a.firmwares.includes(platform==='ps4'?'14.00':'13.60'));
  assert.ok(a,platform);
  for(const consoleBrowser of [false,true]){
   const fw=a.firmwares.at(-1),app=fixture({platform,actions:[a],initialCategory:'loaders',catalogGrid:true,firmwareChoicesOnly:true,withoutSearch:true,userAgent:consoleBrowser?'PlayStation '+platform.slice(-1)+'/'+fw:'Desktop'});
   app.selectFirmware(fw);const grid=app.ids['host-action-grid'],button=grid.querySelector('[data-launch]');
   assert.ok(button);assert.equal(button.disabled,!consoleBrowser);assert.doesNotMatch(grid.innerHTML,/host-catalog-tile__media|<img\b/);assert.match(grid.innerHTML,/>Load<\/span>/);
   assert.equal(app.sends.length+app.opened.length+app.anchorClicks.length,0);
  }
 }
});
test('console headings omit repeated photos and shared navigation omits KARO and connection shortcuts without changing controls',()=>{
 const theme=require('../style-host-pages.cjs');
 for(const platform of ['ps4','ps5']){
  const html='<html><head></head><body><nav class="host-taskbar"><a href="/hosts/karo/">KARO</a><a class="host-top-settings" href="/hosts/'+platform+'/?view=connection">Setup</a></nav><main><header data-wwb-image-heading><div class="wwb-heading-copy"><h1 id="title">Console</h1><a class="host-header-connection" href="?view=connection">Connection &amp; setup</a></div><figure class="wwb-heading-art"><img src="/assets/images/host-selector/whatwhatboy-'+platform+'.jpg" alt="Console"></figure></header><button id="native-start">Load</button><script id="data" type="application/json">{"firmware":"9.00"}</script><a href="/hosts/karo/versions.html" download>Archive</a></main></body></html>';
  const result=theme.themeHTML(html,'hosts/'+platform+'/index.html');
  assert.doesNotMatch(result,/host-header-connection|host-top-settings|whatwhatboy-ps[45]\.jpg/);
  assert.doesNotMatch(result.match(/<nav class="host-taskbar">[\s\S]*?<\/nav>/)[0],/KARO|hosts\/karo/);
  assert.match(result,/data-wwb-text-heading/);assert.match(result,/href="\/hosts\/karo\/versions.html" download/);
  assert.equal(theme.contract(result),theme.contract(html));assert.equal(theme.themeHTML(result,'hosts/'+platform+'/index.html'),result);
  const fresh=theme.themeHTML('<html><head></head><body><main><h1>Console</h1></main></body></html>','hosts/'+platform+'/index.html');
  assert.doesNotMatch(fresh,/wwb-heading-art|whatwhatboy-ps[45]\.jpg/);assert.match(fresh,/data-wwb-text-heading/);
  const authored=fs.readFileSync(path.join(root,'hosts',platform,'index.html'),'utf8');
  assert.doesNotMatch(authored,/host-header-connection|host-top-settings|<img\b[^>]*src="[^\"]*whatwhatboy-ps[45]\.jpg/);
 }
 const game=theme.themeHTML('<html><head></head><body><main><h1>Game</h1></main></body></html>','hosts/ps4/gta5/index.html');
 assert.match(game,/playstation\/gta5\.jpg/);assert.match(game,/data-wwb-image-heading/);
 const home=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.equal(theme.themeHTML(home,'index.html'),home);assert.match(home,/class="console-visual"/);
});
