'use strict';
// Authored presentation transforms and inert DOM fixtures only. No server,
// network, console operation, native module or downloaded payload is executed.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pack=require('../package-console-payload-sender.cjs'),ui=require('../../assets/host-dashboard.js'),{fixture}=require('./host-continuation-dom.cjs');
const root=path.resolve(__dirname,'../..'),origin='https://speedy-away.github.io',legacyOrigin='https://speedy-away.github.io/WWB-HOST';
function html(actions,extra=''){return '<!doctype html><html><head><meta name="whatwhatboy-public-host" content="https://untrusted.example"></head><body>'+extra+'<script id="host-actions-data" type="application/json">'+JSON.stringify({platform:'ps4',actions})+'</script></body></html>';}
function embedded(text){return JSON.parse(text.match(/<script id="host-actions-data" type="application\/json">([\s\S]*?)<\/script>/)[1]).actions;}
function senderFixture(action,publicOrigin,options={}){
 const f=fixture({actions:[action],initialCategory:action.category,...options}),query=f.document.querySelector;
 const marker=f.document.createElement('meta'),meta=f.document.createElement('meta');marker.setAttribute('content','true');if(publicOrigin!==undefined)meta.setAttribute('content',publicOrigin);
 f.document.querySelector=selector=>selector==='meta[name="whatwhatboy-local-sender"]'?marker:selector==='meta[name="whatwhatboy-public-host"]'?(publicOrigin===undefined?null:meta):query.call(f.document,selector);
 ui.install(f.document,f.window);return f;
}

test('package host metadata and dynamic public-only URLs use a fixed trusted origin without changing native contracts',()=>{
 const actions=[
  {id:'local-launcher',platform:'ps4',localLauncher:true,launchURL:'/hosts/ps4/exploit/example/?hen=goldhen#load',instructionsURL:'/hosts/ps4/afterglow/',source:'/docs/review.md',run:undefined,sha256:'a'.repeat(64)},
  {id:'retained',downloadURL:'/hosts/runtime/preserved/goldhen.bin',sourceURL:'https://upstream.example/pinned.bin',run:null,bytes:4,sha256:'b'.repeat(64)},
  {id:'device-download',downloadURL:'/downloads/ps4/goldhen/supplied/goldhen.bin',downloadOnDevice:true,bytes:4,sha256:'c'.repeat(64)},
  {id:'local-transport',downloadURL:'/downloads/fixture/ready.bin',instructionsURL:'/docs/transport.md',firmwares:['9.00'],run:{type:'bin-tcp',port:9020,input:'user-file'},sha256:'d'.repeat(64)},
  {id:'native-route',downloadURL:'/hosts/runtime/native/original.bin',run:{type:'goldhen-http',port:9090},sha256:'e'.repeat(64)},
  {id:'literal',label:'<retain>',downloadURL:'https://upstream.example/file.bin'}
 ];
 const baseline=JSON.parse(JSON.stringify(actions)),output=pack.packagedHTML(html(actions,'<a href="/hosts/ps4/">Local</a><a href="/hosts/ps5/new-public-tool/">Public</a><a href="/downloads/fixture/ready.bin">BIN</a>'));
 assert.equal((output.match(/name="whatwhatboy-public-host"/g)||[]).length,1);assert.ok(output.includes('name="whatwhatboy-public-host" content="'+origin+'"'));assert.doesNotMatch(output,/untrusted\.example/);
 const rows=embedded(output),expected=structuredClone(baseline);expected[0].launchURL=origin+baseline[0].launchURL;expected[0].instructionsURL=origin+baseline[0].instructionsURL;expected[1].downloadURL=origin+baseline[1].downloadURL;expected[2].downloadURL=origin+baseline[2].downloadURL;
 assert.deepEqual(rows,expected);assert.deepEqual(JSON.parse(JSON.stringify(actions)),baseline);assert.match(output,/\\u003cretain>/);assert.ok(output.includes('href="/hosts/ps4/"'));assert.ok(output.includes('href="'+origin+'/hosts/ps5/new-public-tool/"'));assert.ok(output.includes('href="/downloads/fixture/ready.bin"'));assert.equal(pack.packagedHTML(output),output);
});

test('package public route mapping rejects protocol-relative, traversal, encoded path and control overrides',()=>{
 for(const route of ['//evil.example/x','/\\evil.example/x','/hosts/../outside/','/hosts/%2e%2e/x','/hosts/%2fx/','/hosts/%5cx/','/hosts/line\nbreak/'])assert.throws(()=>pack.packagedHTML(html([{localLauncher:true,launchURL:route}])),/Invalid public host route/,route);
 const malformed='<head></head><script id="host-actions-data" type="application/json">{broken}</script>';assert.throws(()=>pack.packagedHTML(malformed),SyntaxError);
});

test('sender dynamic navigation uses only predetermined public hosts and leaves local helper pages and payload links local',()=>{
 const action={id:'source-fixture',label:'Source fixture',platform:'ps4',category:'payloads',format:'BIN',firmwares:['9.00'],downloadURL:'/downloads/fixture/ready.bin',run:null,source:'/hosts/runtime/preserved/?source=1#read',instructionsURL:'/hosts/ps4/unknown-instructions/',requirements:[]};
 for(const supplied of [origin,legacyOrigin,'https://whatwhatboy.com','https://evil.example','https://speedy-away.github.io/wwb-host.evil',undefined]){
  const expected=supplied==='https://whatwhatboy.com'||supplied===legacyOrigin?supplied:origin,f=senderFixture(action,supplied);const output=f.ids['host-action-grid'].innerHTML;
  assert.ok(output.includes('href="'+expected+'/hosts/runtime/preserved/?source=1#read"'));assert.ok(output.includes('href="'+expected+'/hosts/ps4/unknown-instructions/"'));assert.ok(output.includes('href="http://127.0.0.1:8766/downloads/fixture/ready.bin"'));assert.doesNotMatch(output,/https:\/\/evil\.example/);assert.equal(f.sends.length+f.opened.length+f.checks.length,0);
  const launcher={id:'launcher-fixture',label:'Local launcher',platform:'ps4',category:'loaders',format:'HTML host',localLauncher:true,launchURL:'/hosts/ps4/exploit/new/',firmwares:['9.00'],requirements:[]};
  const catalogue=senderFixture(launcher,supplied,{catalogGrid:true});assert.ok(catalogue.ids['host-action-grid'].innerHTML.includes('href="'+expected+'/hosts/ps4/exploit/new/"'));assert.equal(catalogue.sends.length+catalogue.opened.length+catalogue.checks.length,0);
  launcher.launchURL='/hosts/ps4/files/';const local=senderFixture(launcher,supplied,{catalogGrid:true});assert.ok(local.ids['host-action-grid'].innerHTML.includes('href="http://127.0.0.1:8766/hosts/ps4/files/"'));
 }
});

test('real PS4/PS5 embedded catalogues keep all transfer and file identity pins after helper routing',()=>{
 for(const platform of ['ps4','ps5']){
  const source=fs.readFileSync(path.join(root,'hosts',platform,'index.html'),'utf8'),before=embedded(source),after=embedded(pack.packagedHTML(source));assert.equal(after.length,before.length);
  for(const original of before){const mapped=after.find(a=>a.id===original.id);assert.ok(mapped,original.id);for(const key of ['platform','run','bytes','sha256','firmwares','source','sourceURL','sourceCommit','consoleFileId'])assert.deepEqual(mapped[key],original[key],original.id+' '+key);if(original.run&&original.downloadURL?.startsWith('/downloads/'))assert.equal(mapped.downloadURL,original.downloadURL);if(original.localLauncher&&original.launchURL.startsWith('/'))assert.equal(mapped.launchURL,origin+original.launchURL);if(!original.run&&original.downloadURL?.startsWith('/hosts/runtime/'))assert.equal(mapped.downloadURL,origin+original.downloadURL);}
 }
});
