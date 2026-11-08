'use strict';
// Inert publishing fixtures: no native console code or external requests.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const publisher=require('../host-project-pages.cjs');
const locales=require('../host-locales.cjs');
const metadata=require('../host-page-metadata.cjs');

function fixture(t,label){
 const temp=fs.realpathSync(os.tmpdir());
 const base=fs.realpathSync(fs.mkdtempSync(path.join(temp,'wwb-'+label+'-fixture-')));
 assert.equal(path.dirname(base),temp);
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const root=path.join(base,'source');
 function write(name,data){
  const file=path.join(root,name);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,data);
 }
 // Locales are mandatory inputs. Stub visible content while running the real
 // dictionary, metadata, locale, sitemap and publisher pipeline.
 for(const code of locales.codes.filter(code=>code!=='en')){
  write('languages/'+code+'.js','window.__scoobyI18n.register('+JSON.stringify(code)+',{});');
 }
 const pages=Object.entries(metadata.pages).filter(([,data])=>data.index!==false).map(([name])=>name);
 for(const name of [...pages,'offline/ps4/index.html','offline/ps5/index.html']){
  write(name,'<!doctype html><html lang="en"><head><title>Fixture</title></head><body>Inert fixture</body></html>');
 }
 return {base,root,out:path.join(base,'output'),write};
}

test('project publishing resolves the home consoles, keeps original native bytes, and offloads exact preserved ZIP paths',t=>{
 const {root,out,write}=fixture(t,'project');
 write('docs/host-reviews/karo/build.json',JSON.stringify({runtime:'/hosts/runtime/karo-fixture/web/'}));write('index.html','<!doctype html><h1>Choose your console.</h1><a href="./hosts/ps4/">PS4</a><a href="./hosts/ps5/">PS5</a><a href="https://whatwhatboy.com/">Main site</a>');
 write('hosts/ps4/index.html','<html><head></head><body><a href="/downloads/hosts/old.zip">old</a><a href="/hosts/runtime/karo-fixture/web/payload old.bin">old payload</a><a href="/hosts/ps4/?view=mods&amp;game=gta5#actions">Mods</a><a href="/hosts/ps4/?view=loaders">Loaders</a><script src="../../assets/fixture.js?v=2"></script><script src="/assets/host-karo-builds.js"></script><script type="application/json">{"launchURL":"/hosts/runtime/karo-fixture/web/index.html?build=100#start"}</script></body></html>');write('hosts/ps5/index.html','<h1>PS5 fixture</h1>');write('assets/host-karo-builds.js','/* inert script */');write('assets/fixture.js','var x="/hosts/ps4/";var runtime="https://whatwhatboy.com/hosts/runtime/karo-fixture/web/without-index/";');write('hosts/runtime/karo-fixture/web/without-index/505/index.html','inert nested entry');write('hosts/runtime/karo-fixture/web/original.js','/* inert exact original fixture */\r\n');write('hosts/runtime/karo-fixture/web/index.html','<html><head></head><body>inert</body></html>');write('downloads/hosts/old.zip',Buffer.from([80,75,3,4,1,2,3,4]));
 write('hosts/runtime/karo-fixture/web/payload old.bin',Buffer.from([1,2,3]));
 write('hosts/index.html','<h1>Original loopback host chooser</h1>');
 write('robots.txt','User-agent: *\nDisallow: /docs/\nSitemap: https://speedy-away.github.io/sitemap.xml\n');
 write('sitemap.xml','<urlset><url><loc>https://speedy-away.github.io/hosts/ps4/</loc></url></urlset>');
 const result=publisher.build(out,'a'.repeat(40),root),home=fs.readFileSync(path.join(out,'index.html'),'utf8');
 for(const platform of ['ps4','ps5']){
  assert.ok(home.includes('href="/'+platform+'/"'));
  assert.ok(fs.existsSync(path.join(out,platform,'index.html')));
 }
 const modShelf=fs.readFileSync(path.join(out,'ps4/mods/index.html'),'utf8');
 assert.match(modShelf,/<a href="https:\/\/raw\.githubusercontent\.com\//);
 assert.match(modShelf,/<html data-host-view="mods"/);
 assert.match(modShelf,/<a href="\/hosts\/runtime\/karo-fixture\/web\/payload(?:%20| )old\.bin">old payload<\/a>/);
 assert.match(modShelf,/<a href="\/ps4\/mods\/\?game=gta5#actions" data-host-view="mods">/);
 assert.match(modShelf,/<a href="\/ps4\/" data-host-view="loaders">/);
 assert.match(modShelf,/<script src="\/assets\/fixture\.js\?v=2">/);
 assert.doesNotMatch(modShelf,/http-equiv="refresh"|location\.replace/);
 const shortPatches=fs.readFileSync(path.join(out,'ps5/patches/index.html'),'utf8');
 assert.match(shortPatches,/<link rel="canonical" href="https:\/\/speedy-away\.github\.io\/hosts\/ps5\/patches\/">/);
 assert.equal(result.legacyHomePages,2);for(const legacy of ['hosts/index.html','WWB-HOST/index.html','WWB-HOST/hosts/index.html'])assert.ok(fs.readFileSync(path.join(out,legacy),'utf8').includes('location.replace("/"+location.search+location.hash)'));assert.equal(fs.readFileSync(path.join(root,'hosts/index.html'),'utf8'),'<h1>Original loopback host chooser</h1>');
 assert.equal(fs.readFileSync(path.join(out,'robots.txt'),'utf8'),fs.readFileSync(path.join(root,'robots.txt'),'utf8'));
 const sitemap=fs.readFileSync(path.join(out,'sitemap.xml'),'utf8');
 assert.match(sitemap,/<loc>https:\/\/speedy-away\.github\.io\/hosts\/ps4\/<\/loc>/);
 assert.match(sitemap,/<loc>https:\/\/speedy-away\.github\.io\/es\/hosts\/ps4\/<\/loc>/);
 assert.ok(fs.existsSync(path.join(out,'es/hosts/ps4/index.html')));
 assert.ok(!/http-equiv="refresh"/.test(home));assert.ok(home.includes('https://whatwhatboy.com/'));assert.equal(fs.readFileSync(path.join(out,'hosts/runtime/karo-fixture/web/original.js'),'utf8'),'/* inert exact original fixture */\r\n');const consolePage=fs.readFileSync(path.join(out,'hosts/ps4/index.html'),'utf8');assert.match(consolePage,/https:\/\/raw\.githubusercontent\.com\/Speedy-away\/speedy-away\.github\.io\/a{40}\/downloads\/hosts\/old\.zip/);assert.ok(consolePage.includes('/assets/fixture.js?v=2'));assert.ok(consolePage.includes('/assets/host-karo-builds.js?v='+publisher.ASSET_VERSION));assert.ok(consolePage.includes('/hosts/runtime/karo-fixture/web/index.html?build=100#start'));const map=fs.readFileSync(path.join(out,'host-project-map.js'),'utf8');assert.ok(map.includes('"/hosts/ps4/":"/hosts/ps4/"'));assert.ok(map.includes('"/ps4/mods/":"/ps4/mods/"'));for(const m of fs.readFileSync(path.join(out,'404.html'),'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g))new (require('vm').Script)(m[1]);assert.ok(fs.readFileSync(path.join(out,'assets/fixture.js'),'utf8').includes('https://speedy-away.github.io/hosts/runtime/karo-fixture/web/without-index/'));assert.equal(result.offloadedFiles,1);assert.equal(result.nativeScriptsUnchanged,1);assert.ok(!fs.existsSync(path.join(out,'downloads/hosts/old.zip')));
});
test('original cache files get exact MIME aliases in direct and guarded HTML without changing source files',t=>{
 const {root,out,write}=fixture(t,'cache'),prefix='hosts/runtime/karo-fixture/web/';
 const original='<html manifest="offline.cache"><head></head><body>inert</body></html>',manifest='CACHE MANIFEST\nCACHE:\nindex.html\noriginal.js\n';
 write('docs/host-reviews/karo/build.json',JSON.stringify({runtime:'/hosts/runtime/karo-fixture/web/'}));write('index.html','<h1>Choose your console.</h1>');write(prefix+'index.html',original);write(prefix+'guarded.html','<html><head></head><body><script>var config='+JSON.stringify({original})+';</script></body></html>');write(prefix+'offline.cache',manifest);write(prefix+'original.js','/* inert */\r\n');
 const result=publisher.build(out,'b'.repeat(40),root),direct=fs.readFileSync(path.join(out,prefix+'index.html'),'utf8'),guarded=fs.readFileSync(path.join(out,prefix+'guarded.html'),'utf8');assert.equal(result.cacheManifestAliases,1);assert.equal(fs.readFileSync(path.join(out,prefix+'offline.manifest'),'utf8'),manifest);assert.equal(fs.readFileSync(path.join(out,prefix+'offline.cache'),'utf8'),manifest);assert.equal(fs.readFileSync(path.join(root,prefix+'index.html'),'utf8'),original);assert.match(direct,/<html manifest="\/hosts\/runtime\/karo-fixture\/web\/offline\.manifest">/);const parsed=JSON.parse(guarded.match(/"original":("(?:\\.|[^"\\])*")/)[1]);assert.match(parsed,/manifest="\/hosts\/runtime\/karo-fixture\/web\/offline\.manifest"/);assert.ok(publisher.cacheResources(root,[prefix+'offline.cache']).has(prefix+'original.js'));
});

test('sender release aliases work both with a retained local ZIP and without its ignored working copy',t=>{
 const {base,root,write}=fixture(t,'release');
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

test('public launcher JSON remains canonical and private download inventories never enter output',t=>{
 const {root,out,write}=fixture(t,'local-config');
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
