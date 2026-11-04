'use strict';
// Inert publishing fixtures: no native console code or external requests.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const publisher=require('../host-project-pages.cjs');
test('project publishing resolves the home consoles, keeps original native bytes, and offloads exact preserved ZIP paths',()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'wwb-project-fixture-')),root=path.join(base,'source'),out=path.join(base,'output');function write(p,text){const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
 write('docs/host-reviews/karo/build.json',JSON.stringify({runtime:'/hosts/runtime/karo-fixture/web/'}));write('index.html','<!doctype html><h1>Choose your console.</h1><a href="./hosts/ps4/">PS4</a><a href="./hosts/ps5/">PS5</a><a href="https://whatwhatboy.com/">Main site</a>');
 write('hosts/ps4/index.html','<a href="/downloads/hosts/old.zip">old</a><script src="/assets/fixture.js?v=2"></script><script src="/assets/host-karo-builds.js"></script><script type="application/json">{"launchURL":"/hosts/runtime/karo-fixture/web/index.html?build=100#start"}</script>');write('hosts/ps5/index.html','<h1>PS5 fixture</h1>');write('assets/host-karo-builds.js','/* inert script */');write('assets/fixture.js','var x="/hosts/ps4/";var runtime="https://whatwhatboy.com/hosts/runtime/karo-fixture/web/without-index/";');write('hosts/runtime/karo-fixture/web/without-index/505/index.html','inert nested entry');write('hosts/runtime/karo-fixture/web/original.js','/* inert exact original fixture */\r\n');write('hosts/runtime/karo-fixture/web/index.html','<html><head></head><body>inert</body></html>');write('downloads/hosts/old.zip',Buffer.from([80,75,3,4,1,2,3,4]));
 const result=publisher.build(out,'a'.repeat(40),root),home=fs.readFileSync(path.join(out,'index.html'),'utf8');for(const platform of ['ps4','ps5']){const href=home.match(new RegExp('href="([^"]*hosts/'+platform+'/)"'))[1];assert.equal(new URL(href,'https://speedy-away.github.io/').pathname,'/hosts/'+platform+'/');}
 assert.ok(!/http-equiv="refresh"/.test(home));assert.ok(home.includes('https://whatwhatboy.com/'));assert.equal(fs.readFileSync(path.join(out,'hosts/runtime/karo-fixture/web/original.js'),'utf8'),'/* inert exact original fixture */\r\n');const consolePage=fs.readFileSync(path.join(out,'hosts/ps4/index.html'),'utf8');assert.match(consolePage,/https:\/\/raw\.githubusercontent\.com\/Speedy-away\/speedy-away\.github\.io\/a{40}\/downloads\/hosts\/old\.zip/);assert.ok(consolePage.includes('/assets/fixture.js?v=2'));assert.ok(consolePage.includes('/assets/host-karo-builds.js?v='+publisher.ASSET_VERSION));assert.ok(consolePage.includes('/hosts/runtime/karo-fixture/web/index.html?build=100#start'));assert.ok(fs.readFileSync(path.join(out,'host-project-map.js'),'utf8').includes('"/hosts/ps4/":"/hosts/ps4/"'));for(const m of fs.readFileSync(path.join(out,'404.html'),'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g))new (require('vm').Script)(m[1]);assert.ok(fs.readFileSync(path.join(out,'assets/fixture.js'),'utf8').includes('https://speedy-away.github.io/hosts/runtime/karo-fixture/web/without-index/'));assert.equal(result.offloadedFiles,1);assert.equal(result.nativeScriptsUnchanged,1);assert.ok(!fs.existsSync(path.join(out,'downloads/hosts/old.zip')));
});
test('original cache files get exact MIME aliases in direct and guarded HTML without changing source files',()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'wwb-cache-fixture-')),root=path.join(base,'source'),out=path.join(base,'output'),prefix='hosts/runtime/karo-fixture/web/';function write(p,text){const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
 const original='<html manifest="offline.cache"><head></head><body>inert</body></html>',manifest='CACHE MANIFEST\nCACHE:\nindex.html\noriginal.js\n';
 write('docs/host-reviews/karo/build.json',JSON.stringify({runtime:'/hosts/runtime/karo-fixture/web/'}));write('index.html','<h1>Choose your console.</h1>');write(prefix+'index.html',original);write(prefix+'guarded.html','<html><head></head><body><script>var config='+JSON.stringify({original})+';</script></body></html>');write(prefix+'offline.cache',manifest);write(prefix+'original.js','/* inert */\r\n');
 const result=publisher.build(out,'b'.repeat(40),root),direct=fs.readFileSync(path.join(out,prefix+'index.html'),'utf8'),guarded=fs.readFileSync(path.join(out,prefix+'guarded.html'),'utf8');assert.equal(result.cacheManifestAliases,1);assert.equal(fs.readFileSync(path.join(out,prefix+'offline.manifest'),'utf8'),manifest);assert.equal(fs.readFileSync(path.join(out,prefix+'offline.cache'),'utf8'),manifest);assert.equal(fs.readFileSync(path.join(root,prefix+'index.html'),'utf8'),original);assert.match(direct,/<html manifest="\/hosts\/runtime\/karo-fixture\/web\/offline\.manifest">/);const parsed=JSON.parse(guarded.match(/"original":("(?:\\.|[^"\\])*")/)[1]);assert.match(parsed,/manifest="\/hosts\/runtime\/karo-fixture\/web\/offline\.manifest"/);assert.ok(publisher.cacheResources(root,[prefix+'offline.cache']).has(prefix+'original.js'));
});

test('sender release aliases work both with a retained local ZIP and without its ignored working copy',t=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'wwb-release-fixture-')),root=path.join(base,'source');assert.equal(path.dirname(base),path.resolve(os.tmpdir()));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 function write(name,data){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);}
 const local='/downloads/helpers/console-payload-sender/console-payload-sender-fixture.zip',release='https://github.com/Speedy-away/WWB-HOST/releases/download/sender-fixture/console-payload-sender-fixture.zip';
 write('docs/host-reviews/karo/build.json',JSON.stringify({runtime:'/hosts/runtime/karo-fixture/web/'}));write('index.html','<a href="'+local+'">Download sender</a>');write(local.slice(1),Buffer.from([80,75,3,4]));write('downloads/helpers/console-payload-sender/manifest.json',JSON.stringify({files:[{url:local,publicDownloadURL:release}]}));
 for(let attempt=0;attempt<2;attempt++){const out=path.join(base,'out-'+attempt),result=publisher.build(out,'a'.repeat(40),root);assert.ok(fs.readFileSync(path.join(out,'index.html'),'utf8').includes(release));assert.equal(result.downloadMap[local],release);assert.equal(fs.existsSync(path.join(out,local)),false);assert.ok(fs.readFileSync(path.join(out,'host-project-map.js'),'utf8').includes(release));if(attempt===0)fs.unlinkSync(path.join(root,local));}
});

test('authored runtime receipts retain the canonical project prefix without changing native script text',()=>{
 const data={launchURL:'/hosts/runtime/karo-aaaaaaaaaaaa-bbbbbbbbbbbb/web/g2all/index.html',nativeRoute:{kind:'karo',runtime:'https://whatwhatboy.com/hosts/runtime/karo-aaaaaaaaaaaa-bbbbbbbbbbbb/web/',entry:{path:'g2all/index.html',scope:'g2all/'}}};
 const native='<script>var nativePath="/hosts/runtime/original/";</script>';
 const source=native+'<script id="site-load-data" type="application/json">'+JSON.stringify(data)+'</script>';
 const html=publisher.runtimeConfigHTML(source),out=JSON.parse(html.match(/id="site-load-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
 assert.ok(html.startsWith(native));assert.equal(out.launchURL,data.launchURL);assert.equal(out.nativeRoute.runtime,'/hosts/runtime/karo-aaaaaaaaaaaa-bbbbbbbbbbbb/web/');assert.deepEqual(out.nativeRoute.entry,data.nativeRoute.entry);
 for(const prefix of ['/WWB-HOST','/wwb-host'])assert.ok(publisher.runtimeConfigHTML('<script id="site-load-data">'+JSON.stringify({launchURL:prefix+data.launchURL})+'</script>').includes('"launchURL":"/hosts/runtime/'));
});

test('public launcher JSON remains canonical and private download inventories never enter output',()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'wwb-local-config-fixture-')),root=path.join(base,'source'),out=path.join(base,'out');
 function write(name,data){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);}
 const runtime='/hosts/runtime/karo-aaaaaaaaaaaa-bbbbbbbbbbbb/web/';
 write('docs/host-reviews/karo/build.json',JSON.stringify({runtime}));write('index.html','<h1>Choose your console.</h1>');write(runtime.slice(1)+'ps5/UMTX/index.html','<html><head></head><body>inert</body></html>');
 const config={runtime,entry:{platform:'ps5',path:'ps5/UMTX/index.html',scope:'ps5/UMTX/',firmwares:['5.50']}};
 write('hosts/ps5/exploit/fixture/index.html','<script id="host-local-data" type="application/json">'+JSON.stringify(config)+'</script>');
 for(const privateName of ['host-goldhen-current-private-inventory','host-compact-download-inventory','host-game-patch-file-import'])write('docs/'+privateName+'.json','{"private":"F:/local-only"}');
 publisher.build(out,'a'.repeat(40),root);
 const html=fs.readFileSync(path.join(out,'hosts/ps5/exploit/fixture/index.html'),'utf8'),data=JSON.parse(html.match(/id="host-local-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
 assert.equal(data.runtime,runtime);require('../../assets/host-local-launcher.js').config(data,new URL('https://speedy-away.github.io/hosts/ps5/exploit/fixture/'));
 for(const privateName of ['host-goldhen-current-private-inventory','host-compact-download-inventory','host-game-patch-file-import'])assert.equal(fs.existsSync(path.join(out,'docs/'+privateName+'.json')),false);
});
