'use strict';
// Execute only the authored cache worker with inert network/cache doubles.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(path.resolve(__dirname,'../../host-offline-sw.js'),'utf8'),origin='https://speedy-away.github.io';
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
function pack(files,version='test-1',platform='ps4'){return {platform,version,files:Object.entries(files).map(([url,data])=>({url,bytes:Buffer.byteLength(data),sha256:sha(data)}))};}
function fixture(){
 const listeners={},stores=new Map(),routes=new Map(),calls=[],messages=[],writes=[],deletes=[];let clock=0;
 const key=value=>new URL(typeof value==='string'?value:value.url,origin).href;
 const caches={keys:async()=>[...stores.keys()],open:async name=>{if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {match:async value=>store.get(key(value))?.clone(),put:async(value,response)=>{writes.push({name,url:key(value)});store.set(key(value),response.clone());},keys:async()=>[...store.keys()].map(url=>({url}))};},delete:async name=>{deletes.push(name);throw Error('Cache deletion is forbidden');}};
 const fetch=async value=>{const url=key(value);calls.push(url);if(!routes.has(url))throw Error('Network unavailable: '+url);const data=routes.get(url);return typeof data==='function'?data():data instanceof Response?data.clone():new Response(data,{status:200});};
 const context=vm.createContext({URL,Request,Response,Headers,TextDecoder,Uint8Array,crypto:crypto.webcrypto,caches,fetch,Date:{now:()=>++clock},self:{location:{origin},addEventListener:(name,fn)=>listeners[name]=fn,skipWaiting(){throw Error('Activation is forbidden');},clients:{claim(){throw Error('Claiming clients is forbidden');}}}});
 vm.runInContext(source,context);
 function setPack(manifest,files){routes.set(origin+'/offline/'+manifest.platform+'.json',JSON.stringify(manifest));for(const [url,data]of Object.entries(files))routes.set(key(url),data);}
 async function message(type,platform='ps4'){const waits=[],start=messages.length,client={id:'installer',url:origin+'/offline/'+platform+'/',postMessage:data=>messages.push(data)};listeners.message({data:{type,platform},source:client,origin,waitUntil:p=>waits.push(p)});await Promise.all(waits);return messages.slice(start);}
 function request(url,{method='GET',clientId='tab',resultingClientId=''}={}){let response;listeners.fetch({request:new Request(new URL(url,origin),{method}),clientId,resultingClientId,respondWith:value=>{response=value;}});return response;}
 return {listeners,stores,routes,calls,messages,writes,deletes,setPack,message,request,validate(value){context.testDescriptor=value;return vm.runInContext('validate(testDescriptor,"ps4")',context);}};
}
test('explicit save verifies bytes as data, reports progress, and serves only a complete exact pack',async()=>{
 const f=fixture(),files={'/hosts/ps4/':'<html>Inert shell</html>','/assets/native.js?v=1':'throw Error("Never execute cached bytes");','/hosts/runtime/ps4-fixture/web/payload.bin':'pinned bytes','/downloads/patches/exact.xml':'<patch/>','/style.css':'body{}'};
 f.setPack(pack(files),files);assert.equal(f.calls.length,0);assert.equal(f.listeners.install,undefined);assert.equal(f.listeners.activate,undefined);
 const events=await f.message('INSTALL');assert.equal(events.at(-1).type,'CACHED');assert.equal(events.at(-1).files,5);assert.equal(events.filter(e=>e.type==='PROGRESS').at(-1).completed,5);
 assert.equal(await (await f.request('/hosts/ps4/?view=mods&game=gta5')).text(),files['/hosts/ps4/']);
 assert.equal(await (await f.request('/assets/native.js?v=2')).text(),files['/assets/native.js?v=1']);assert.equal(await (await f.request('/downloads/patches/exact.xml')).text(),'<patch/>');
 const before=f.calls.length;for(const [url,method]of [['http://192.168.1.4:9021/payload.bin','GET'],['https://other.invalid/hosts/ps4/','GET'],['/__local__/load','GET'],['/downloads/payload.bin','GET'],['/hosts/ps4/','POST']])assert.equal(f.request(url,{method}),undefined,url);assert.equal(f.calls.length,before);
 await assert.rejects(f.request('/assets/not-saved.js',{clientId:'new-tab'}),/Network unavailable/);assert.deepEqual(f.deletes,[]);
});
test('failed new saves retain the previous ready pack and do not expose partial replacement files',async()=>{
 const f=fixture(),old={'/hosts/ps4/':'old complete shell','/assets/exact.js':'old exact'};f.setPack(pack(old,'old'),old);await f.message('INSTALL');
 const next={'/hosts/ps4/':'new incomplete shell','/assets/exact.js':'new exact'},manifest=pack(next,'new');manifest.files[1].sha256='0'.repeat(64);f.setPack(manifest,next);
 const events=await f.message('INSTALL');assert.equal(events.at(-1).type,'ERROR');assert.match(events.at(-1).message,/checksum/);assert.equal((await f.message('STATUS')).at(-1).version,'old');
 assert.equal(await (await f.request('/hosts/ps4/',{clientId:'fresh-tab'})).text(),'old complete shell');assert.deepEqual(f.deletes,[]);
});
test('compressed transport lengths are not confused with decoded hashes and cached encoding headers are corrected',async()=>{
 const f=fixture(),files={'/hosts/ps4/':'decoded content is longer than the wire header'};f.setPack(pack(files),files);
 f.routes.set(origin+'/hosts/ps4/',()=>new Response(files['/hosts/ps4/'],{headers:{'Content-Encoding':'gzip','Content-Length':'2','Transfer-Encoding':'chunked','Content-Type':'text/html'}}));
 assert.equal((await f.message('INSTALL')).at(-1).type,'CACHED');const response=await f.request('/hosts/ps4/');assert.equal(await response.text(),files['/hosts/ps4/']);assert.equal(response.headers.get('Content-Encoding'),null);assert.equal(response.headers.get('Transfer-Encoding'),null);assert.equal(response.headers.get('Content-Length'),String(Buffer.byteLength(files['/hosts/ps4/'])));
});
test('a tab already using a pack stays on its version while a newly opened tab uses the completed update',async()=>{
 const f=fixture(),old={'/hosts/ps4/':'old shell','/assets/exact.js?v=1':'old script'};f.setPack(pack(old,'old'),old);await f.message('INSTALL');await f.request('/hosts/ps4/',{clientId:'existing-tab'});
 const next={'/hosts/ps4/':'new shell','/assets/exact.js?v=2':'new script'};f.setPack(pack(next,'new'),next);await f.message('INSTALL');
 assert.equal(await (await f.request('/assets/exact.js?v=2',{clientId:'existing-tab'})).text(),'old script');assert.equal(await (await f.request('/hosts/ps4/',{clientId:'new-tab'})).text(),'new shell');assert.equal(await (await f.request('/assets/exact.js?v=2',{clientId:'new-tab'})).text(),'new script');assert.deepEqual(f.deletes,[]);
});
test('descriptor limits reject unsafe routes, identities and oversized plans before any resource fetch',async()=>{
 const f=fixture(),base=pack({'/style.css':'a'});
 for(const url of ['//evil.invalid/a','http://192.168.1.4/a','/api/probe','/downloads/payload.bin','/assets/../hosts/ps4/','/assets/%2e%2e/hosts/ps4/','/assets/%252e%252e/a','/assets/a%2fb.js','/offline/__wwb_complete__','/assets/a.js#x'])assert.throws(()=>f.validate({...base,files:[{...base.files[0],url}]}),/Unsafe/,url);
 assert.throws(()=>f.validate({...base,files:Array.from({length:4097},(_,i)=>({...base.files[0],url:'/assets/'+i+'.js'}))}),/descriptor/);
 assert.throws(()=>f.validate({...base,files:[{...base.files[0],bytes:80*1024*1024+1}]}),/identity/);
 const maximum={...base,files:Array.from({length:4096},(_,i)=>({url:'/assets/'+i+'.txt',bytes:0,sha256:sha('')}))};assert.equal(f.validate(maximum).files.length,4096);assert.equal(f.calls.length,0);
});
test('unknown HTML aliases and non-version asset queries use the network and never receive a different cached page',async()=>{
 const f=fixture(),files={'/hosts/ps4/index.html':'exact index','/assets/exact.js?v=1':'exact asset'};f.setPack(pack(files),files);await f.message('INSTALL');
 await assert.rejects(f.request('/hosts/ps4/',{clientId:'directory-not-listed'}),/Network unavailable/);
 await assert.rejects(f.request('/assets/exact.js?build=unlisted',{clientId:'unknown-query'}),/Network unavailable/);
 assert.equal(await (await f.request('/hosts/ps4/index.html?view=payloads',{clientId:'listed-index'})).text(),'exact index');
});

test('saved copy verification checks cached checksums without making network requests',async()=>{
 const f=fixture(),files={'/hosts/ps4/':'inert shell','/assets/safe.js':'inert data'};f.setPack(pack(files),files);await f.message('INSTALL');const calls=f.calls.length;f.routes.clear();const events=await f.message('VERIFY');assert.equal(events.at(-1).type,'VERIFIED');assert.equal(events.at(-1).files,2);assert.equal(f.calls.length,calls);const cache=[...f.stores.values()][0];cache.set(origin+'/assets/safe.js',new Response('damaged'));const bad=await f.message('VERIFY');assert.equal(bad.at(-1).type,'ERROR');assert.equal(bad.at(-1).operation,'verify');assert.match(bad.at(-1).message,/damaged|size mismatch/);assert.equal(f.calls.length,calls);
});
test('retry reuses only checksum-verified cached files and repairs corrupt files',async()=>{
 const f=fixture(),files={'/hosts/ps4/':'inert shell','/assets/first.js':'first inert bytes','/assets/last.js':'last inert bytes'},manifest=pack(files);f.setPack(manifest,files);f.routes.delete(origin+'/assets/last.js');assert.equal((await f.message('INSTALL')).at(-1).type,'ERROR');const cache=[...f.stores.values()][0];cache.set(origin+'/assets/first.js',new Response('broken'));f.setPack(manifest,files);const start=f.calls.length;assert.equal((await f.message('INSTALL')).at(-1).type,'CACHED');const retry=f.calls.slice(start);assert.equal(retry.includes(origin+'/hosts/ps4/'),false);assert.ok(retry.includes(origin+'/assets/first.js'));assert.ok(retry.includes(origin+'/assets/last.js'));assert.equal((await f.message('VERIFY')).at(-1).type,'VERIFIED');assert.equal(f.deletes.length,0);
});

test('declared translated host pages are served from the matching console pack while native paths stay canonical',async()=>{
 const f=fixture(),files={'/es/hosts/ps4/':'host traducido','/ar/offline/ps4/':'offline traducido','/es/':'selector traducido'};f.setPack(pack(files,'locale-1'),files);assert.equal((await f.message('INSTALL')).at(-1).type,'CACHED');f.routes.clear();assert.equal(await(await f.request('/es/hosts/ps4/?view=mods')).text(),'host traducido');assert.equal(await(await f.request('/ar/offline/ps4/')).text(),'offline traducido');assert.equal(f.request('/es/hosts/runtime/payload.bin'),undefined);assert.equal(f.request('/zz/hosts/ps4/'),undefined);
});
