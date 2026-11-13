'use strict';
// Only authored UI/guards run in mocks. Upstream modules and payloads are read as bytes.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const build=JSON.parse(read('docs/afterglow-1402-build.json')),base=build.base+'/web/';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function store(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};}
function landing(ua='PlayStation 4/14.02'){
 const nodes={},events={},timers=new Map(),radios={goldhen:{value:'goldhen',checked:true},hen:{value:'hen',checked:false}},ss=store(),ls=store(),location={href:'',search:''};let cacheBusy=false,notify;
 const node=id=>nodes[id]||(nodes[id]={textContent:'',checked:false,disabled:false,addEventListener:(event,fn)=>events[id+':'+event]=fn});
 node('pick').querySelector=s=>s.includes(':checked')?(radios.hen.checked?radios.hen:radios.goldhen):radios[s.match(/value="(.*?)"/)[1]];
 const window={addEventListener:(event,fn)=>events[event]=fn,AfterglowCache:{isBusy:()=>cacheBusy,subscribe:fn=>notify=fn}};
 vm.runInNewContext(read(base+'launch.js'),{window,document:{getElementById:node},navigator:{userAgent:ua},localStorage:ls,sessionStorage:ss,location,performance:{navigation:{type:0}},Date,setInterval:fn=>{timers.set(1,fn);return 1;},clearInterval:id=>timers.delete(id)});
 return {nodes,events,ss,ls,location,radios,timers,tick(n=1){for(let i=0;i<n;i++)for(const f of [...timers.values()])f();},submit(){events['pick:submit']({preventDefault(){}});},auto(){nodes.auto.checked=true;events['pick:change']();},cache(value){cacheBusy=value;if(notify)notify();}};
}
test('new 14.02 route preserves the old firmware groups and only uses a same-origin chooser',()=>{
 const api=require('../host-compact-pages.cjs'),groups=api.groups(root),old=groups.find(g=>g.id==='ps4-afterglow'),fresh=groups.find(g=>g.id==='ps4-afterglow-1402');
 assert.deepEqual(old.firmwares,['13.52','14.00']);assert.deepEqual(fresh.firmwares,['14.02']);
 const actions=api.publicPS4Actions(require('../build-host-selector.cjs').hostActions('ps4'),root),action=actions.find(a=>a.id==='local-ps4-afterglow-1402');
 assert.equal(action.launchURL,'/'+base+'index.html');assert.equal(action.entryURL,'/ps4/14.02/');assert.equal(action.run,undefined);assert.equal(action.nativeRoute,undefined);assert.deepEqual(action.firmwares,['14.02']);
 assert.equal(require('../build-host-selector.cjs').hostActions('ps5').some(a=>a.id===action.id),false);
});
test('five-second opt-in autostart pauses for caching and cancellation prevents a queued start',()=>{
 const f=landing();assert.equal(f.nodes.auto.checked,false);assert.equal(f.timers.size,0);f.auto();assert.equal(f.nodes.count.textContent,'5');f.tick();assert.equal(f.nodes.count.textContent,'4');f.cache(true);f.tick(10);assert.equal(f.nodes.count.textContent,'4');assert.equal(f.location.href,'');f.cache(false);f.tick(3);assert.equal(f.nodes.count.textContent,'1');f.tick();assert.match(f.location.href,/jb.html\?log=1&afterglow=run&mode=goldhen/);
 const c=landing();c.cache(true);c.submit();c.events['cancel:click']();c.cache(false);assert.equal(c.location.href,'');
});
test('desktop, PS5, 14.00 and unconfirmed firmware cannot start the new runtime',()=>{
 for(const ua of ['Desktop','PlayStation 5/14.02','PlayStation 4/14.00','PlayStation 4/14.01','PlayStation 4/14.03']){const f=landing(ua);assert.equal(f.nodes.start.disabled,true);f.submit();f.auto();f.tick(6);assert.equal(f.location.href,'');assert.equal(f.ss.data.size,0);}
});
test('one-use run guard only imports for a fresh same-origin 14.02 user start',()=>{
 const html=read(base+'jb.html'),guard=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
 assert.ok(guard.includes("import('./jb.js')"));
 for(const good of [true,false]){let imports=0,redirect;const ss=store();ss.setItem('whatsite.afterglow.1402.arm.v1',String(Date.now()));vm.runInNewContext(guard.replace("import('./jb.js')",'inertImport()'),{URL,Date,sessionStorage:ss,navigator:{userAgent:good?'PlayStation 4/14.02':'PlayStation 4/14.00'},performance:{navigation:{type:0}},location:{origin:'https://host.test',pathname:'/runtime/jb.html',search:'?log=1&afterglow=run&mode=goldhen',replace:v=>redirect=v},document:{referrer:'https://host.test/runtime/index.html',body:{},getElementById:()=>({})},inertImport:()=>{imports++;return Promise.resolve();}});assert.equal(imports,good?1:0);assert.equal(ss.data.size,0);if(!good)assert.equal(redirect,'index.html?restored=1');}
});
test('all upstream modules and payloads match pinned Git and SHA identities',()=>{
 for(const file of build.original){const source=fs.readFileSync(path.join(root,build.base,'upstream',file.path));assert.equal(hash(source),file.sha256,file.path);if(/\.(?:js|bin)$/.test(file.path)&&file.path!=='launch.js')assert.deepEqual(fs.readFileSync(path.join(root,base,file.path)),source,file.path);}
 for(const file of build.files){const bytes=fs.readFileSync(path.join(root,base,file.path));assert.equal(bytes.length,file.bytes,file.path);assert.equal(hash(bytes),file.sha256,file.path);}
 const bundle=fs.readFileSync(path.join(root,build.archive.local));assert.equal(hash(bundle),build.archive.sha256);
});
test('optional cache closure includes 14.02 patchset and HENs without ads or remote resources',()=>{
 const files=JSON.parse(read(base+'offline-files.json'));for(const file of files){const bytes=fs.readFileSync(path.join(root,base,file.path));assert.equal(hash(bytes),file.sha256,file.path);assert.equal(bytes.length,file.bytes);}
 for(const name of ['patchset-1402.bin','hen.bin','goldhen.bin','index.html','jb.html','launch.js','afterglow.js','ps4_offsets.js','cache-frame.html'])assert.ok(files.some(f=>f.path===name),name);
 const manifest=read(base+'cache.appcache');for(const line of manifest.split('\n').filter(x=>x&&!/^(#|CACHE|NETWORK|\*)/.test(x))){assert.doesNotMatch(line,/https?:/);assert.ok(fs.existsSync(path.join(root,base,line.split('?')[0])),line);}
 assert.doesNotMatch(read(base+'index.html'),/\bmanifest=/);assert.doesNotMatch(read(base+'jb.html'),/\bmanifest=|bellnewyork|accountut|cache\.js|offline-sw|host-project-routing/);
});
test('cache toggle defaults off, ignores forged iframe events, and stops AppCache on disable',()=>{
 const events={},nodes={},ls=store(),frameWindow={applicationCache:{abort(){aborts++;}}};let aborts=0,appends=0,frame;
 const node=id=>nodes[id]||(nodes[id]={checked:false,disabled:false,hidden:true,textContent:'',addEventListener:(e,fn)=>events[id+':'+e]=fn,removeAttribute(){}});
 const body={appendChild(f){appends++;frame=f;f.parentNode={removeChild(){frame=null;}};}};
 const win={applicationCache:{},addEventListener:(e,fn)=>events[e]=fn};
 vm.runInNewContext(read(base+'cache.js'),{window:win,document:{getElementById:node,body,createElement:()=>({contentWindow:frameWindow})},navigator:{},localStorage:ls,location:{origin:'https://host.test'}});
 events.load();assert.equal(appends,0);assert.equal(nodes['cache-enabled'].checked,false);
 nodes['cache-enabled'].checked=true;events['cache-enabled:change']();assert.equal(appends,1);assert.equal(win.AfterglowCache.isBusy(),true);
 events.message({source:{},origin:'https://evil.test',data:{type:'afterglow-cache',state:'ready'}});assert.equal(win.AfterglowCache.isBusy(),true);
 events.message({source:frameWindow,origin:'https://host.test',data:{type:'afterglow-cache',state:'progress',loaded:2,total:10}});assert.equal(nodes['cache-progress'].value,2);
 nodes['cache-enabled'].checked=false;events['cache-enabled:change']();assert.equal(aborts,1);assert.equal(frame,null);assert.equal(win.AfterglowCache.isBusy(),false);assert.equal(ls.getItem('wwb.afterglow.1402.cache.enabled'),'false');
});
test('new page uses requested name, shared blue assets, cache controls and only native banner ads',()=>{
 const html=read(base+'index.html');assert.match(html,/<h1>WebKit Exploit<\/h1>/);assert.match(html,/id="cache-enabled"/);assert.match(html,/id="cache-now"/);assert.match(html,/5-second countdown/);assert.match(html,/bellnewyork/);assert.doesNotMatch(html,/accountut/);assert.match(read(base+'afterglow-1402.css'),/host-xmb-waves.svg/);
 assert.match(read('assets/host-dashboard.js'),/14\.02 jailbreak is here/);
});
