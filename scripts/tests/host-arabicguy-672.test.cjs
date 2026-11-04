'use strict';
// Only authored controller code and inert fixture strings run in these tests.
// Original native/exploit files are read as data and are never evaluated.
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const controller=require('../../assets/host-arabicguy-672.js'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function fixture(options={}){
 const data=[Buffer.from('<script>/* inert bootstrap */</script>'),Buffer.from('function jailbreak2(){}'),Buffer.from('function PL_loader(){}; /* req.responseType="arraybuffer" */'),Buffer.from([1,2,3,4])];
 const pins={html:{n:0},kernel:{n:1},loader:{n:2},boot:{bytes:20,sha256:hash(Buffer.from('/* inert bootstrap */'))},builds:{100:{n:3,gameVersion:'1.00'}}};pins.boot.bytes=Buffer.byteLength('/* inert bootstrap */');
 const calls={fetch:[],bootstrap:[],load:[],locks:0},state={ua:'Mozilla/5.0 (PlayStation 4 6.72)',visible:true,blocked:false,ready:true,...options};
 const env={userAgent:()=>state.ua,visible:()=>state.visible,restored:()=>state.restored,blocked:()=>state.blocked,features:()=>true,reject:e=>Promise.reject(e),all:p=>Promise.all(p),fetch:p=>{calls.fetch.push(p.n);return options.fetch?options.fetch(p,data):Promise.resolve(data[p.n]);},preparePayload:b=>options.badBlob?Promise.reject(Error('inert Blob failure')):Promise.resolve(b),lock:()=>{calls.locks++;state.blocked=true;},bootstrap:(...args)=>calls.bootstrap.push(args),kernelReady:()=>state.ready,load:(...args)=>{calls.load.push(args);if(options.throwLoad)throw Error('inert native boundary failure');}};
 return {session:controller.createSession(env,pins,hash),pins,data,calls,state};
}

// Provenance staging remains in the original workspace; public runtime checks stay local.
function evidence(...parts){const root=path.resolve(__dirname,'../..');const local=path.join(root,...parts),relative=path.relative(root,local).replaceAll('\\','/');if(!fs.existsSync(local)&&/^(?:docs\/host-reviews\/|tmp\/)/.test(relative)){const original=path.join(process.env.WHATSITE_PROVENANCE_ROOT||path.resolve(root,'../whatsite'),relative);if(fs.existsSync(original))return original;}return local;}
test('actual 6.72 console is required; desktop, PS5, other firmware, unconfirmed and scripted starts fetch nothing',async()=>{
 for(const ua of ['Mozilla/5.0 Chrome','PlayStation 4 6.71','PlayStation 4 6.720','PlayStation 4 9.00','PlayStation 5 6.72']){const f=fixture({ua});await assert.rejects(f.session.prepare('100',true,true));assert.equal(f.calls.fetch.length,0);}
 for(const [confirmed,trusted]of [[false,true],[true,false]]){const f=fixture();await assert.rejects(f.session.prepare('100',confirmed,trusted));assert.equal(f.calls.fetch.length,0);}
 const prior=fixture({blocked:true});await assert.rejects(prior.session.prepare('100',true,true));assert.equal(prior.calls.fetch.length,0);
 const restored=fixture({restored:true});await assert.rejects(restored.session.prepare('100',true,true));assert.equal(restored.calls.fetch.length,0);
});
test('a verified preparation calls each original stage once and requires a separate explicit menu Load',async()=>{
 const f=fixture();await f.session.prepare('100',true,true);assert.equal(f.session.state(),'ready');assert.deepEqual(f.calls.fetch,[0,1,2,3]);assert.equal(f.calls.bootstrap.length,1);assert.equal(f.calls.load.length,0);assert.equal(f.calls.locks,1);
 assert.throws(()=>f.session.load(false));assert.equal(f.calls.load.length,0);
 assert.deepEqual(f.session.load(true),{state:'attempted',executionConfirmed:false});assert.equal(f.calls.load.length,1);assert.deepEqual(f.calls.load[0][1],f.data[3]);
 assert.throws(()=>f.session.load(true));await assert.rejects(f.session.prepare('100',true,true));assert.equal(f.calls.load.length,1);
});
test('failed verification or hiding the page prevents all native stages; it never retries automatically',async()=>{
 const bad=fixture({fetch:()=>Promise.reject(Error('hash mismatch'))});await assert.rejects(bad.session.prepare('100',true,true));assert.equal(bad.calls.bootstrap.length,0);assert.equal(bad.calls.locks,0);assert.equal(bad.session.state(),'idle');
 const hidden=fixture();const pending=hidden.session.prepare('100',true,true);hidden.state.visible=false;await assert.rejects(pending);assert.equal(hidden.calls.bootstrap.length,0);assert.equal(hidden.calls.locks,0);
 const wrongBoot=fixture();wrongBoot.pins.boot.sha256='00'.repeat(32);await assert.rejects(wrongBoot.session.prepare('100',true,true));assert.equal(wrongBoot.calls.bootstrap.length,0);
 const blob=fixture({badBlob:true});await assert.rejects(blob.session.prepare('100',true,true));assert.equal(blob.calls.bootstrap.length,0);assert.equal(blob.calls.locks,0);
});
test('kernel failure and ambiguous menu dispatch remain locked without retry or execution acknowledgement',async()=>{
 const f=fixture({ready:false});await assert.rejects(f.session.prepare('100',true,true));assert.equal(f.session.state(),'locked');assert.equal(f.calls.locks,1);assert.throws(()=>f.session.load(true));
 const ambiguous=fixture({throwLoad:true});await ambiguous.session.prepare('100',true,true);assert.throws(()=>ambiguous.session.load(true));assert.equal(ambiguous.session.state(),'attempted');assert.throws(()=>ambiguous.session.load(true));assert.equal(ambiguous.calls.load.length,1);
 const restored=fixture();await restored.session.prepare('100',true,true);restored.state.restored=true;assert.throws(()=>restored.session.load(true));assert.equal(restored.calls.load.length,0);
});
test('bounded source fetch verifies exact URLs, byte counts and SHA-256 before resolving',async()=>{
 const pin={path:'test',url:'https://raw.githubusercontent.com/GamerHack/GamerHack.github.io/'+'ab'.repeat(20)+'/672/test.js',bytes:4,sha256:hash(Buffer.from([1,2,3,4]))};
 function win(change={}){return {Promise,URL,XMLHttpRequest:class{open(method,url){this.url=url;}send(){this.status=200;this.response=Uint8Array.from([1,2,3,4]).buffer;this.responseURL=this.url;Object.assign(this,change);this.onload();}}};}
 assert.equal((await controller.fetchOriginal(win(),pin,hash)).length,4);
 await assert.rejects(controller.fetchOriginal(win(),{...pin,sha256:'00'.repeat(32)},hash));
 await assert.rejects(controller.fetchOriginal(win({status:404}),pin,hash));await assert.rejects(controller.fetchOriginal(win({responseURL:'https://example.com/wrong'}),pin,hash));
 await assert.rejects(controller.fetchOriginal(win(),{...pin,url:'https://example.com/evil.js'},hash));await assert.rejects(controller.fetchOriginal(win(),{...pin,url:pin.url+'?override=1'},hash));
});
test('all three original binaries and native source contracts match pinned data without evaluating them',()=>{
 const root=path.resolve(__dirname,'../..'),read=p=>JSON.parse(fs.readFileSync(evidence(p),'utf8')),prepared=read('docs/host-reviews/ps4/6.72/arabicguy/prepared.json'),audit=read('docs/download-audit.json').items;
 assert.equal(prepared.actions.length,3);for(const a of prepared.actions){assert.deepEqual(a.firmwares,['6.72']);assert.equal(a.menuFamily,'ArabicGuy');assert.equal(a.menuVersion,null);assert.deepEqual(a.titleIds,[]);assert.equal(a.run,null);assert.ok(a.runtimeId);assert.equal(a.loaderEvidence.externalTransportVerified,false);assert.equal(a.loaderEvidence.browserNativeContractVerified,true);assert.equal(a.loaderEvidence.hardwareVerified,false);}
 for(const j of prepared.jobs){const record=audit.flatMap(x=>x.files||[]).find(f=>f.sha256===j.expectedSha256&&f.backupPath);assert.ok(record,j.id);const b=fs.readFileSync(record.backupPath);assert.equal(b.length,j.expectedBytes);assert.equal(hash(b),j.expectedSha256);}
 const repo=read('docs/host-reviews/ps4/6.72/arabicguy/source-acquisition.json').repositories[0],base=evidence('tmp/host-672-review/GamerHack',repo.commit,'672');
 const loader=fs.readFileSync(path.join(base,'pl_loader.js'),'utf8');assert.ok(loader.includes('function PL_loader()'));assert.ok(loader.includes('req.responseType="arraybuffer"'));assert.ok(loader.includes('write_mem(window.pl_blob,payload);PL_loader();'));assert.ok(loader.includes('setTimeout(function(){pivot(ropchain);},500)'));
 const boot=fs.readFileSync(path.join(base,'index.html'),'utf8');assert.equal(hash(Buffer.from(controller.bootSource(boot,prepared.pins.boot,hash))),prepared.pins.boot.sha256);
 const ready=fs.readFileSync(evidence(prepared.entry));assert.equal(hash(ready),prepared.sha256);assert.equal(hash(fs.readFileSync(evidence(prepared.immutablePath))),prepared.sha256);
 assert.ok(!ready.includes(Buffer.from('function jailbreak2()')),'Original native code is not embedded');
});
test('catalogue, browser actions and activated receivers preserve earlier pins and keep native loading separate from senders',()=>{
 const root=path.resolve(__dirname,'../..'),read=p=>JSON.parse(fs.readFileSync(evidence(p),'utf8')),baseline=read('docs/host-reviews/ps4/6.72/arabicguy/baseline.json'),catalogue=read('docs/console-download-catalog.json').items,actions=read('docs/host-arabicguy-672-actions.json').actions;
 for(const before of baseline.catalogue){const after=catalogue.find(x=>x.id===before.id);assert.ok(after,before.id);for(const key of ['filename','sha256','platforms'])assert.deepEqual(after[key],before[key]);}
 const retainedPS4=baseline.catalogue.filter(x=>x.platforms.includes('ps4')).length,newPS4=actions.filter(a=>!baseline.catalogue.some(before=>before.id===a.id)).length;assert.ok(catalogue.filter(x=>x.platforms.includes('ps4')).length>=retainedPS4+newPS4,'All historical PS4 files and the exact new ArabicGuy builds remain present; later additions are allowed');assert.deepEqual(read('docs/host-native-workspace-build.json').artifacts,baseline.native);
 const bridge=require('../console-payload-bridge.cjs'),ui=require('../../assets/host-dashboard.js');
 for(const a of actions){assert.equal(ui.loadCapability(a).kind,'browser');assert.equal(ui.loadCapability(a).available,true);assert.throws(()=>bridge.userFileSpec(a),{code:'unsupported-user-file'});assert.equal(ui.firmwareMatches(a,'6.72'),true);for(const fw of ['5.05','6.71','9.00','14.00'])assert.equal(ui.firmwareMatches(a,fw),false);const row=catalogue.find(x=>x.id===a.id);assert.ok(row);assert.equal(row.sha256,a.sha256);assert.equal(row.url,a.downloadURL);}
 for(const r of read('docs/host-menu-companion-build.json').records){const b=fs.readFileSync(evidence(r.path));assert.equal(hash(b),r.sha256);assert.equal(hash(fs.readFileSync(r.backupPath)),r.sha256);const items=JSON.parse(b.toString().match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]).items;for(const a of actions){const item=items.find(x=>x.id===a.id);if(r.platform==='ps4'){assert.equal(item.sha256,a.sha256);assert.equal(item.url,a.downloadURL);}else assert.equal(item,undefined);}}
});
function mountedFixture(badBlob=false,selectedKey='100'){
 const nodes={},events={},requests=[],injected=[],revoked=[],data={html:Buffer.from('<script>/* inert bootstrap */</script>'),kernel:Buffer.from('function jailbreak2(){}'),loader:Buffer.from('function PL_loader(){}; /* req.responseType="arraybuffer" */'),payload:Buffer.from([1,2,3,4])};
 const byId=id=>nodes[id]||(nodes[id]={disabled:false,checked:false,value:id==='build'?'100':'',textContent:'',addEventListener(name,callback){this[name]=callback;}});
 const prefix='https://raw.githubusercontent.com/GamerHack/GamerHack.github.io/'+'ab'.repeat(20)+'/672/';
 const pin=key=>({path:key,url:prefix+key+'.js',bytes:data[key].length,sha256:hash(data[key])});
 const pins={html:pin('html'),kernel:pin('kernel'),loader:pin('loader'),boot:{path:'inert',bytes:20,sha256:hash(Buffer.from('/* inert bootstrap */'))},builds:{}};pins.boot.bytes=Buffer.byteLength('/* inert bootstrap */');
 for(const key of ['100','127','132']){data['payload-'+key]=Buffer.from([Number(key),1,2,3]);pins.builds[key]={...pin('payload-'+key),gameVersion:key.slice(0,1)+'.'+key.slice(1),filename:'pl_GTA_ArabicGuy'+key+'.bin'};}
 let blobBytes=null;const nativeURL=class extends URL{};nativeURL.createObjectURL=blob=>{blobBytes=Buffer.from(blob.parts[0]);return 'blob:https://example.test/inert-memory';};nativeURL.revokeObjectURL=u=>revoked.push(u);
 const win={URL:nativeURL,Blob:class{},Uint8Array,Promise,navigator:{userAgent:'Mozilla/5.0 (PlayStation 4 6.72)'},performance:{navigation:{type:0}},applicationCache:{addEventListener(){}},sessionStorage:{getItem(k){return this[k]||null;},setItem(k,v){this[k]=v;},removeItem(k){delete this[k];}},localStorage:{},location:{search:'?build=100',pathname:'/inert/',replace(){}},addEventListener(name,callback){events[name]=callback;}};
 win.Blob=class{constructor(parts){this.parts=parts;}};win.location.search='?build='+selectedKey;
 win.XMLHttpRequest=class{open(method,url){this.url=url;}send(){requests.push(this.url);const key=this.url.slice(prefix.length).replace('.js','');this.status=this.url.startsWith('blob:')?0:200;this.responseURL=this.url;const b=this.url.startsWith('blob:')?(badBlob?Buffer.from([9,9,9,9]):blobBytes):data[key];this.response=Uint8Array.from(b).buffer;Promise.resolve().then(()=>this.onload());}};
 const doc={hidden:false,getElementById(id){if(id==='language')return null;return byId(id);},createElement(){return {};},head:{appendChild(script){injected.push(script.text);if(injected.length===1){win.malloc=()=>{};win.write_mem=()=>{};win.pivot=()=>{};}if(injected.length===2)win.jailbreak2=()=>{win.localStorage.passcount=Number(win.localStorage.passcount)+1;};}}};
 byId('confirm').checked=true;const session=controller.mount(win,doc,pins,hash);return {win,nodes,events,requests,injected,revoked,session,pins,blobBytes:()=>blobBytes,data};
}
test('mounted controller preflights verified Blob bytes, then passes the same memory URL to the unchanged loader only on Load',async()=>{
 const f=mountedFixture();f.nodes.prepare.click({isTrusted:true});for(let i=0;i<30;i++)await Promise.resolve();
 assert.equal(f.session.state(),'ready');assert.equal(f.nodes.load.disabled,false);assert.equal(f.injected.length,2);assert.equal(f.requests.length,5);assert.equal(f.requests[4],'blob:https://example.test/inert-memory');
 f.nodes.load.click({isTrusted:true});assert.equal(f.injected.length,3);assert.equal(f.win.PLfile,f.requests[4]);assert.equal(f.session.state(),'attempted');assert.equal(f.revoked.length,0);assert.match(f.nodes.status.textContent,/execution are unconfirmed/);
});
test('mounted Blob failure stops before all native source stages; restoring a ready page blocks menu loading',async()=>{
 const bad=mountedFixture(true);bad.nodes.prepare.click({isTrusted:true});for(let i=0;i<30;i++)await Promise.resolve();assert.equal(bad.injected.length,0);assert.equal(bad.session.state(),'idle');assert.equal(bad.revoked.length,1);
 const restore=mountedFixture();restore.nodes.prepare.click({isTrusted:true});for(let i=0;i<30;i++)await Promise.resolve();restore.events.pageshow({persisted:true});assert.equal(restore.nodes.load.disabled,true);assert.throws(()=>restore.session.load(true));assert.equal(restore.injected.length,2);
});
for(const key of ['100','127','132'])test('build '+key+' keeps its Download identity and uses its own verified bytes through Prepare and one Load',async()=>{
 const f=mountedFixture(false,key),pin=f.pins.builds[key];
 assert.equal(f.nodes.build.value,key);assert.equal(f.nodes.download.href,pin.url);assert.equal(f.nodes.download.download,pin.filename);assert.equal(f.nodes['game-update'].textContent,pin.gameVersion);assert.equal(f.nodes.checksum.textContent,pin.sha256);
 f.nodes.prepare.click({isTrusted:true});for(let i=0;i<30;i++)await Promise.resolve();
 assert.equal(f.session.state(),'ready');assert.equal(f.requests[3],pin.url);assert.equal(hash(f.blobBytes()),pin.sha256);assert.equal(f.injected.length,2);
 f.nodes.load.click({isTrusted:true});assert.equal(f.win.PLfile,f.requests[4]);assert.equal(f.session.state(),'attempted');assert.equal(f.injected.length,3);assert.throws(()=>f.session.load(true));
});

test('each catalogue popup uses its exact original Download or receiver ID and opens the matching first-party Load controller',()=>{
 const {fixture}=require('./host-continuation-dom.cjs'),root=path.resolve(__dirname,'../..');
 const actions=require('../build-host-selector.cjs').hostActions('ps4').filter(a=>a.id.startsWith('ps4-arabicguy-672-'));
 assert.equal(actions.length,3);
 const settings=address=>new Map([['whatwhatboy.host.ps4',JSON.stringify({firmware:'6.72',address})]]);
 for(const a of actions){
  const desktop=fixture({actions,storage:settings('')});desktop.openMenu();desktop.choose(a.id);const link=desktop.ids['host-version-detail'].querySelector('[data-download-action]');assert.equal(link.getAttribute('href'),a.downloadURL);desktop.download();assert.match(desktop.ids['host-status'].textContent,/Download requested to this device/);assert.equal(desktop.load().disabled,true);assert.equal(desktop.sends.length,0);
  const receiver=fixture({actions,storage:settings('192.168.1.40')});receiver.openMenu();receiver.choose(a.id);receiver.download();assert.equal(receiver.opened.length,1);const url=new URL(receiver.opened[0].url,'https://whatwhatboy.com');assert.equal(url.searchParams.get('file'),a.id);assert.equal(url.origin,'http://192.168.1.40:6701');assert.equal(url.pathname,'/data/whatsite-ps4.html');assert.equal(receiver.sends.length,0);
  const consolePage=fixture({actions,storage:settings(''),userAgent:'Mozilla/5.0 (PlayStation 4 6.72)'});consolePage.openMenu();consolePage.choose(a.id);assert.equal(consolePage.load().disabled,false);assert.equal(consolePage.opened.length,1);const launch=new URL(consolePage.opened[0].url,'https://whatwhatboy.com');assert.equal(launch.pathname,new URL(a.launchURL,'https://whatwhatboy.com').pathname);assert.equal(launch.searchParams.get('build'),a.gameVersion.replace('.',''));assert.equal(consolePage.sends.length,0);
 }
});
test('the shared PS4 mods catalogue keeps one top navigation bar around its version popup',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../../hosts/ps4/index.html'),'utf8');
 assert.equal((html.match(/<nav\b[^>]*class="[^"]*\bhost-taskbar\b/g)||[]).length,1);
 assert.equal((html.match(/id="host-version-overlay"/g)||[]).length,1);
});
