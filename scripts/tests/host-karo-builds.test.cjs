'use strict';
// Authored controls and original bytes inspected as data; never native execution.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../../assets/host-karo-builds.js'),guard=require('../../assets/host-karo-resource-guard.js'),contracts=require('../karo-loader-contracts.cjs');
const root=path.resolve(__dirname,'../..'),read=p=>JSON.parse(fs.readFileSync(evidence(p))),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function storage(){const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),m};}
function win(fw='9.00',platform='4'){const writes=[],w={navigator:{userAgent:'Mozilla/5.0 (PlayStation '+platform+'/'+fw+')'},localStorage:storage(),sessionStorage:storage(),document:{visibilityState:'visible',open(){},write:s=>writes.push(s),close(){}},location:{href:'http://127.0.0.1/hosts/karo/',pathname:'/hosts/karo/',origin:'http://127.0.0.1'},URL,Promise};w.top=w;w.self=w;return{w,writes};}

// Provenance staging remains in the original workspace; public runtime checks stay local.
function evidence(...parts){const local=path.join(root,...parts),relative=path.relative(root,local).replaceAll('\\','/');if(!fs.existsSync(local)&&/^(?:docs\/host-reviews\/|tmp\/)/.test(relative)){const original=path.join(process.env.WHATSITE_PROVENANCE_ROOT||path.resolve(root,'../whatsite'),relative);if(fs.existsSync(original))return original;}return local;}
test('all 29 source folders have independent source-confirmed contracts, with restore variants separate',()=>{
 const all=read('docs/host-reviews/karo/build.json').entries,folders=read('docs/host-reviews/karo/source-review.json').folders;assert.equal(all.length,71);assert.equal(new Set(all.map(e=>e.id)).size,all.length);assert.deepEqual([...new Set(all.map(e=>e.folder))].sort(),[...folders].sort());
 for(const e of all){assert.ok(e.contract.includes('browser-native'));assert.ok(e.firmwares.length||e.ranges?.length||e.blockedReason);if(/^restore/.test(e.folder))assert.equal(e.kind,'restore');}
 assert.deepEqual(all.find(e=>e.folder==='G755').firmwares,['7.55']);assert.deepEqual(all.find(e=>e.folder==='702').firmwares,['7.02']);
 const pro=all.find(e=>e.folder==='g2allpro');for(const fw of ['5.05','5.07','7.00','9.60','11.50','12.02','12.50','13.52'])assert.ok(api.supports(pro,{platform:'ps4',firmware:fw}),fw);for(const fw of ['5.06','6.72','9.61','11.03','12.03','13.01','13.53','14.00'])assert.equal(api.supports(pro,{platform:'ps4',firmware:fw}),false,fw);
});
test('every entry rejects desktop, wrong console, absent confirmation and synthetic activation before native dispatch',()=>{
 for(const e of read('docs/host-reviews/karo/build.json').entries){const fw=e.firmwares[0]||e.ranges?.[0]?.[0]||'9.00',{w,writes}=win(fw,e.platform.slice(-1));for(const [confirmed,trusted]of [[false,true],[true,false]])assert.throws(()=>api.authorize(w,e,'/native/web/',confirmed,trusted));w.navigator.userAgent='Mozilla/5.0 Windows NT 10.0';assert.throws(()=>api.authorize(w,e,'/native/web/',true,true));assert.equal(writes.length,0);assert.equal(w.localStorage.m.size,0);}
});
test('each matching original entry gets exactly one scoped ticket and an attempt lock',()=>{
 for(const e of read('docs/host-reviews/karo/build.json').entries){if(e.blockedReason)continue;const {w,writes}=win(e.firmwares[0]||e.ranges[0][0],e.platform.slice(-1)),base='/native/web/',target=api.authorize(w,e,base,true,true);assert.equal(target,base+e.path);assert.equal(writes.length,0);assert.ok(api.runtimeAllowed(w,{entry:e,path:e.path,base}));assert.throws(()=>api.authorize(w,e,base,true,true),/previous native attempt/);assert.throws(()=>api.runtimeAllowed(w,{entry:e,path:e.path,base}),/repeated original entry/);assert.throws(()=>api.clear(w,false));api.clear(w,true);assert.equal(w.localStorage.m.size,0);}
});
test('expiry, storage failure, altered firmware, hidden page and another directory refuse the original stage',()=>{
 const e=read('docs/host-reviews/karo/build.json').entries.find(e=>e.folder==='900N');for(const alter of [w=>{w.navigator.userAgent='PlayStation 4/6.72';},w=>{w.document.visibilityState='hidden';},w=>{const t=JSON.parse(w.sessionStorage.getItem(api.TICKET));t.expires=0;w.sessionStorage.setItem(api.TICKET,JSON.stringify(t));},w=>{const t=JSON.parse(w.sessionStorage.getItem(api.TICKET));t.scope='672/';w.sessionStorage.setItem(api.TICKET,JSON.stringify(t));}]){const{w,writes}=win();api.authorize(w,e,'/native/web/',true,true);alter(w);assert.throws(()=>api.openOriginal(w,{entry:e,path:e.path,base:'/native/web/',original:'INERT FIXTURE'}));assert.equal(writes.length,0);}
 const {w}=win();w.localStorage.setItem=()=>{throw Error('storage denied');};assert.throws(()=>api.authorize(w,e,'/native/web/',true,true));
 const blocked={...e,blockedReason:'Original source unavailable'};assert.equal(api.supports(blocked,api.consoleInfo('PlayStation 4/9.00')),false);
});
test('one original cache round trip is allowed, while repeated or restored entry attempts stop',()=>{
 const e=read('docs/host-reviews/karo/build.json').entries.find(e=>e.folder==='900N'),{w}=win(),base='/native/web/';api.authorize(w,e,base,true,true);api.runtimeAllowed(w,{entry:e,path:e.path,base});api.runtimeAllowed(w,{entry:e,path:'900N/cache.html',base});api.runtimeAllowed(w,{entry:e,path:e.path,base});assert.throws(()=>api.runtimeAllowed(w,{entry:e,path:e.path,base}),/repeated/);
});
test('the document parser receives only inert fixture text after its explicit matching ticket',()=>{
 const e=read('docs/host-reviews/karo/build.json').entries.find(e=>e.folder==='900N'),{w,writes}=win(),config={entry:e,path:e.path,base:'/native/web/',original:'<html><head></head><body>INERT FIXTURE</body></html>',resources:{files:[],invalid:[]},resourceGuard:'/* inert guard fixture */'};assert.throws(()=>api.openOriginal(w,config));assert.equal(writes.length,0);api.authorize(w,e,config.base,true,true);api.openOriginal(w,config);assert.equal(writes.length,1);assert.ok(writes[0].includes('INERT FIXTURE'));assert.ok(writes[0].includes('WHATSITE_KARO_RESOURCES'));
});
test('known corrupt, absent and PHP resources are blocked without changing valid native bytes or selecting alternatives',()=>{
 const messages=[],nodes={},doc={getElementById:k=>nodes[k],createElement:()=>({setAttribute(){},style:{},set textContent(v){messages.push(v);}}),documentElement:{appendChild(n){nodes['whatsite-karo-file-error']=n;}},addEventListener(){}};
 const w={URL,Promise,document:doc,location:{href:'https://whatwhatboy.com/native/web/900N/index.html',origin:'https://whatwhatboy.com'},XMLHttpRequest:function(){},fetch:()=>Promise.resolve('fixture')};w.XMLHttpRequest.prototype.open=function(){};
 const g=guard(w,{base:'/native/web/',files:['900N/goldhen.bin','900N/loader.js'],invalid:['900N/bad.elf']});assert.equal(g.route('goldhen.bin'),'https://whatwhatboy.com/native/web/900N/goldhen.bin');assert.equal(g.route('https://kar0218.github.io/900N/loader.js'),'https://whatwhatboy.com/native/web/900N/loader.js');for(const p of ['bad.elf','missing.bin','api/payload.php'])assert.throws(()=>g.route(p),/unavailable or invalid/);assert.equal(messages.length,3);
});
test('current downloads and derived BINs retain their recorded bytes, quarantine paths stay absent and invalid files have no enabled Download',()=>{
 const b=read('docs/host-reviews/karo/build.json'),audit=read('docs/host-reviews/karo/dependency-audit.json');assert.equal(b.folders.length,29);assert.equal(b.artifacts.length,33);
 for(const f of b.downloads){const bytes=fs.readFileSync(evidence(f.url));assert.equal(bytes.length,f.bytes,f.path);assert.equal(sha(bytes),f.sha256,f.path);if(f.invalid)assert.ok(f.url.includes('/_unavailable/'));}
 assert.equal(audit.invalidPayloads.length,4);assert.equal(audit.derived.length,407);for(const f of audit.localUnavailable){assert.ok(!fs.existsSync(evidence('tmp/karo-review',b.commit,f.path)));assert.ok(!fs.existsSync(evidence(b.runtime,f.path)));}
 const html=fs.readFileSync(evidence('hosts/karo/index.html'),'utf8');assert.ok(html.includes('Download saves to this device'));assert.equal((html.match(/id="karo-load" disabled/g)||[]).length,1);assert.ok(html.includes('Restore entries can change console data'));
});
test('every offered package is immutable and every original native script is unchanged',()=>{
 const b=read('docs/host-reviews/karo/build.json'),a=read('docs/host-reviews/karo/runtime-acquisition.json'),unavailable=new Set(read('docs/host-reviews/karo/dependency-audit.json').localUnavailable.map(f=>f.path));for(const f of b.artifacts){const bytes=fs.readFileSync(evidence(f.url));assert.equal(sha(bytes),f.sha256);assert.equal(bytes.length,f.bytes);assert.ok(bytes.length<100*1024*1024);}
 for(const f of a.files.filter(f=>/\.m?js$/i.test(f.path)&&!unavailable.has(f.path))){const bytes=fs.readFileSync(evidence(b.runtime,f.path));assert.equal(sha(bytes),f.sha256,f.path);}
});

test('the extracted-build server serves module/cache MIME types and never executes PHP or accepts uploads',async t=>{
 const http=require('node:http'),os=require('node:os'),serverAPI=require('../karo-static-server.cjs');const temp=fs.mkdtempSync(evidence('tmp/karo-server-fixture-'));for(const [name,text]of [['index.html','Inert authored fixture'],['module.mjs','/* inert */'],['Cache.manifest','CACHE MANIFEST\n'],['api.php','DO NOT EXECUTE']])fs.writeFileSync(path.join(temp,name),text);
 const server=serverAPI.createServer(temp);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base='http://127.0.0.1:'+server.address().port;
 assert.match((await fetch(base+'/module.mjs',{method:'HEAD'})).headers.get('content-type'),/^text\/javascript/);assert.equal((await fetch(base+'/Cache.manifest',{method:'HEAD'})).headers.get('content-type'),'text/cache-manifest');assert.equal((await fetch(base+'/api.php')).status,403);assert.equal((await fetch(base+'/',{method:'POST',body:'fixture'})).status,405);assert.equal((await fetch(base+'/missing.bin')).status,404);
});

test('ZIP validation accepts only the explicit package root and still rejects traversal or a wrong root',()=>{
 const {zip}=require('../package-console-payload-sender.cjs'),{inspectZip}=require('../verify-host-menu-sender-integrity.cjs'),bytes=zip(new Map([['fixture.txt',Buffer.from('inert fixture')]]),{prefix:'karo-fixture/'});assert.throws(()=>inspectZip(bytes));assert.equal(inspectZip(bytes,{prefix:'karo-fixture/'}).entryCount,1);assert.throws(()=>inspectZip(bytes,{prefix:'../karo-fixture/'}));assert.throws(()=>inspectZip(bytes,{prefix:'wrong/'}));
});

test('verified original repairs retain exact identities and online-only entries preserve the original native chain',()=>{
 const b=read('docs/host-reviews/karo/build.json'),r=read('docs/host-reviews/karo/original-payload-repairs.json');assert.equal(b.repairs.length,3);assert.equal(b.entries.filter(e=>e.blockedReason).length,0);assert.equal(b.entries.filter(e=>e.onlineOnly).length,3);
 for(const f of r.repairs){const target=fs.readFileSync(evidence(b.runtime,f.originalPath));assert.equal(target.length,f.bytes);assert.equal(sha(target),f.sha256);assert.ok(b.downloads.some(d=>d.repaired&&d.sha256===f.sha256&&d.sourceURL===f.url));assert.ok(b.downloads.some(d=>d.invalid&&d.path===f.originalPath));}
 for(const e of b.entries.filter(e=>e.onlineOnly)){assert.ok(e.notes.some(n=>n.includes('Online loading only')));const source=fs.readFileSync(evidence('tmp/karo-review',b.commit,e.path),'utf8');assert.match(source,/<body[^>]*onload=["']go\(\)/i);}
 const unresolved=r.unresolved[0];assert.equal(unresolved.status,'unmapped-placeholder-not-renamed');assert.ok(b.downloads.find(d=>d.path===unresolved.originalPath).invalid);
});
