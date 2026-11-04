'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const build=JSON.parse(read('docs/afterglow-build.json'));
const arm='whatsite.afterglow.arm.v1',choice='whatsite.afterglow.choice.v1';
function store(init={}){const data={...init};return {getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=v,removeItem:k=>delete data[k],data};}
function fixture({ua='Mozilla/5.0 (PlayStation 4/14.00)',saved=null,cacheStatus=0,storageFails=false,search='',nav=0}={}){
 const events={},nodes={},timers=new Map();let next=0;
 const radios={hen:{value:'hen',checked:false},goldhen:{value:'goldhen',checked:true}};
 function node(id){return nodes[id]||(nodes[id]={checked:false,disabled:false,textContent:'',addEventListener:(n,f)=>events[id+':'+n]=f});}
 const form=node('pick');form.querySelector=q=>q.includes(':checked')?Object.values(radios).find(r=>r.checked):radios[q.match(/value="(.*?)"/)[1]];
 // Browser radio groups uncheck the previous choice automatically.
 for(const [key,r]of Object.entries(radios)){let checked=key==='goldhen';Object.defineProperty(r,'checked',{get:()=>checked,set:v=>{if(v)for(const other of Object.values(radios))if(other!==r)other.checked=false;checked=v;}});}
 const ls=store(saved?{[choice]:JSON.stringify(saved)}:{}),ss=store();if(storageFails)ss.setItem=()=>{throw Error('disabled');};
 const cache={status:cacheStatus,addEventListener:(n,f)=>events['cache:'+n]=f};
 const window={applicationCache:cache,addEventListener:(n,f)=>events['window:'+n]=f};
 const location={href:'',search};
 const ctx={window,document:{getElementById:node},navigator:{userAgent:ua},localStorage:ls,sessionStorage:ss,location,performance:{navigation:{type:nav}},Date,setInterval:f=>{timers.set(++next,f);return next;},clearInterval:id=>timers.delete(id)};
 vm.runInNewContext(read('assets/afterglow-entry.js'),ctx);
 return {nodes,events,ss,ls,cache,location,radios,timers,tick(n=1){for(let i=0;i<n;i++)for(const fn of [...timers.values()])fn();},changeAuto(value){node('auto').checked=value;events['pick:change']({target:node('auto')});},submit(){events['pick:submit']({preventDefault(){}});}};
}
test('autostart starts off, persists opt-in, counts five seconds and selects exact HEN target',()=>{
 const f=fixture();assert.equal(f.nodes.auto.checked,false);assert.equal(f.timers.size,0);f.changeAuto(true);assert.equal(f.nodes.count.textContent,'5');f.tick(4);assert.equal(f.location.href,'');f.tick();assert.equal(f.location.href,'jb.html?log=1&afterglow=run&mode=goldhen');assert.ok(f.ss.getItem(arm));assert.equal(JSON.parse(f.ls.getItem(choice)).autostart,true);
 const h=fixture({saved:{payload:'hen',autostart:true}});h.tick(5);assert.equal(h.location.href,'jb.html?log=1&afterglow=run&payload=hen.bin');
});
test('cancel and uncheck clear both countdown and appcache-queued starts',()=>{
 for(const cancel of ['button','uncheck']){const f=fixture({cacheStatus:3});f.submit();assert.match(f.nodes.count.textContent,/cache/);if(cancel==='button')f.events['cancel:click']();else f.changeAuto(false);f.cache.status=1;f.events['cache:cached']();f.tick(6);assert.equal(f.location.href,'');assert.equal(f.timers.size,0);}
 const f=fixture({cacheStatus:2});f.submit();f.cache.status=1;f.events['cache:noupdate']();assert.match(f.location.href,/jb.html/);
});
test('cache update, storage refusal and unsupported browsers never navigate or arm',()=>{
 for(const options of [{cacheStatus:4},{storageFails:true},{ua:'PC'},{ua:'PlayStation 5/14.00'},{ua:'PlayStation 4/13.50'},{ua:'PlayStation 4/14.01'}]){const f=fixture(options);f.submit();f.changeAuto(true);f.tick(5);assert.equal(f.location.href,'');assert.equal(f.ss.getItem(arm),null);}
});
test('payload change restarts countdown; pagehide, BFCache and restored entry cannot silently rearm',()=>{
 const f=fixture({saved:{payload:'goldhen',autostart:true}});f.tick(3);f.radios.hen.checked=true;f.events['pick:change']({target:{name:'payload'}});assert.equal(f.nodes.count.textContent,'5');f.tick(4);assert.equal(f.location.href,'');f.events['window:pagehide']();f.tick(5);assert.equal(f.location.href,'');f.events['window:pageshow']({persisted:true});assert.equal(f.ss.getItem(arm),null);
 for(const options of [{nav:1},{nav:2},{search:'?restored=1'}]){const g=fixture({...options,saved:{payload:'hen',autostart:true}});g.tick(6);assert.equal(g.location.href,'');}
});
function runGate({ua='PlayStation 4/14.00',ref='http://test/host/index.html',ticket=Date.now(),nav=0,query='?log=1&afterglow=run&mode=goldhen'}={}){
 let imports=0,redirect=null;const ss=store(ticket?{[arm]:String(ticket)}:{});
 const source=read('assets/afterglow-run-guard.js');assert.ok(source.includes("import('./jb.js')"));
 const mock=source.replace("import('./jb.js')",'inertImport()');
 vm.runInNewContext(mock,{URL,Date,navigator:{userAgent:ua},sessionStorage:ss,performance:{navigation:{type:nav}},location:{origin:'http://test',pathname:'/host/jb.html',search:query,replace:s=>redirect=s},document:{referrer:ref,body:{},getElementById:()=>({})},inertImport:()=>{imports++;return Promise.resolve();}});
 return {imports,redirect,ss};
}
test('run guard consumes one-use entry ticket before mocked import; refuses reload, stale, missing and cross-origin entry',()=>{
 const good=runGate();assert.equal(good.imports,1);assert.equal(good.ss.getItem(arm),null);
 for(const options of [{ticket:0},{ticket:Date.now()-31000},{ticket:Date.now()+10000},{ref:''},{ref:'http://evil/host/index.html'},{ref:'http://test/other/index.html'},{ref:'http://test/host/jb.html'},{nav:1},{nav:2},{ua:'PC'},{ua:'PlayStation 5/14.00'},{ua:'PlayStation 4/13.50'},{query:'?afterglow=probe'},{query:'?log=1&afterglow=run&payload=unknown.bin'}]){const f=runGate(options);assert.equal(f.imports,0,JSON.stringify(options));assert.equal(f.redirect,'index.html?restored=1');assert.equal(f.ss.getItem(arm),null);}
});
test('every pinned original and deployed file matches recorded bytes; kernel code and payloads are untouched',()=>{
 for(const f of build.files){const b=fs.readFileSync(path.join(root,build.base,f.path));assert.equal(b.length,f.bytes,f.path);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),f.sha256,f.path);}
 for(const name of ['jb.js','core.js','mem.js','int64.js','ps4_offsets.js','afterglow.js','hen.bin','goldhen.bin','patchset-1352.bin','patchset-1400.bin'])assert.deepEqual(fs.readFileSync(path.join(root,build.base,'web',name)),fs.readFileSync(path.join(root,build.base,'upstream',name)));
 const manifest=read(build.base+'/web/cache.appcache');for(const line of manifest.split('\n').filter(l=>/^[a-z]/.test(l))){const [file,hash]=line.split(' #');assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,build.base,'web',file))).digest('hex'),hash);}
});
test('runtime isolation, dependency closure, honest firmware pins and ad separation',()=>{
 const run=read(build.base+'/web/jb.html');assert.doesNotMatch(run,/src=|site-ads|i18n|analytics|invoke\.js/);assert.match(run,/import\('\.\/jb.js'\)/);
 for(const f of build.files.filter(f=>f.path.startsWith('web/')&&/\.js$/.test(f.path))){const text=read(build.base+'/'+f.path);for(const m of text.matchAll(/(?:from\s+|import\s*\(\s*)["']\.\/([^"']+)["']/g))assert.ok(fs.existsSync(path.join(root,build.base,'web',m[1])),m[1]);}
 for(const page of ['firmware','afterglow']){const html=read('hosts/ps4/'+page+'/index.html');assert.match(html,/BEGIN SITE AD/);assert.match(html,/Advertisement/);assert.doesNotMatch(html,/<(?:video|iframe)\b/);}
 const routes=JSON.parse(read('docs/ps4-firmware-routes.json'));assert.deepEqual(routes.routes.find(r=>r.id==='afterglow').firmwares,['13.52','14.00']);assert.equal(routes.routes.filter(r=>r.firmwares.includes('14.00')).length,1);assert.equal(routes.versions.includes('13.51'),false);
 const action=require('../build-host-selector.cjs').hostActions('ps4').find(a=>a.id==='built-in-ps4-afterglow');assert.deepEqual(action.firmwares,['13.52','14.00']);assert.equal(action.run,undefined);assert.equal(require('../build-host-selector.cjs').hostActions('ps5').some(a=>a.id==='built-in-ps4-afterglow'),false);
});
test('runtime ZIPs use their own folder; sender ZIP default stays unchanged',()=>{
 const {zip}=require('../package-console-payload-sender.cjs');
 const files=new Map([['web/index.html',Buffer.from('inert')]]);
 for(const [options,prefix]of [[undefined,'whatwhatboy-console-payload-sender/'],[{prefix:'afterglow/'},'afterglow/']]){
  const bytes=zip(files,options),length=bytes.readUInt16LE(26);
  assert.equal(bytes.subarray(30,30+length).toString(),prefix+'web/index.html');
 }
});
test('firmware folders cover each exact supported version and use full-page top navigation',()=>{
 const html=read('hosts/ps4/firmware/index.html');
 const routes=JSON.parse(read('docs/ps4-firmware-routes.json'));
 assert.deepEqual([...html.matchAll(/data-folder="([^"]+)"/g)].map(m=>m[1]),[...routes.versions].reverse());
 assert.match(html,/class="firmware-taskbar"/);assert.doesNotMatch(html,/id="sidebar"|<header class="guide-hero">/);
 for(const r of routes.routes)assert.ok(html.includes('href="'+r.url.replaceAll('&','&amp;')+'"'),r.id);
 assert.match(read('assets/ps4-firmware.js'),/searchParams.get\('fw'\)/);
 assert.match(read('assets/ps4-firmware.js'),/firmware-back/);
});
test('landing gains local top navigation and responsive layout without modifying the execution document',()=>{
 const landing=read(build.base+'/web/index.html');assert.match(landing,/id="brand"><nav/);assert.match(landing,/landing-layout.css/);
 assert.doesNotMatch(read(build.base+'/web/jb.html'),/landing-layout|firmware-taskbar|Page navigation/);
 assert.match(read(build.base+'/web/landing-layout.css'),/@media\(max-width:680px\)/);
});
test('all twenty generated dictionaries and isolated landing translation subset contain new controls',()=>{
 const table=require('../../i18n-tools/afterglow-translations.cjs');for(const [key,row]of Object.entries(table)){assert.equal(Object.keys(row).length,20);for(const [lang,value]of Object.entries(row)){assert.ok(value);assert.ok(read('languages/'+lang+'.js').includes(JSON.stringify(key)+': '+JSON.stringify(value)));}}
 const script=read(build.base+'/web/entry-i18n.js');assert.ok(script.includes('scooby.lang'));assert.doesNotMatch(script,/fetch\(|https?:|script\.src/);
});
