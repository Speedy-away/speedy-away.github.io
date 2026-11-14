'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),api=require('../../assets/ps4-loader-client.js'),client=require('../../assets/host-console-client.js'),bridge=require('../console-payload-bridge.cjs');
const data=Buffer.alloc(80);data.set([127,69,76,70,2,1]);data[18]=62;
const meta={profile:'elf-http',address:'192.168.1.50',firmware:'14.02',name:'fixture.elf',bytes:data.length,sha256:client.sha256(data),compatible:true};
const setup=fs.readFileSync(path.join(root,api.elfBootstrap.url));
const response=(status=200,body={status:'ready'})=>({status,ok:status>=200&&status<300,json:async()=>body});
function fixture(options={}){
 const calls=[];let probes=0;
 const fetcher=async(url,init)=>{calls.push({url,init});if(url.endsWith(':9021/')&&init.method==='GET'){probes++;if(options.ready||probes>1&&!options.neverReady)return response();throw Error('No listener');}if(url.endsWith('/status'))return response(200,{status:options.busy?'busy':'ready'});if(init.method==='POST'){if(options.failBIN&&url.includes(':9090/')||options.failELF&&url.includes(':9021/'))throw Error('Connection lost after POST');return response(202);}throw Error('Unexpected '+url);};
 return {calls,fetcher,opts:{origin:'http://host.test',normalizeAddress:client.normalizeAddress,sha256:client.sha256,readBootstrap:async()=>options.corrupt?Buffer.from([1]):setup,fetch:fetcher,pause:async()=>{},probeTimeoutMs:5,timeoutMs:10}};
}
test('running ELF service receives one exact ELF and no bootstrap',async()=>{const f=fixture({ready:true}),r=await api.sendAutoELF(meta,data,f.opts);assert.equal(r.elfLoaderStarted,false);assert.equal(f.calls.length,2);assert.equal(f.calls[1].url,'http://192.168.1.50:9021/fixture.elf?pipe=0');assert.deepEqual(f.calls[1].init.body,data);});
test('missing service starts the pinned BIN then sends the selected ELF once',async()=>{const f=fixture(),r=await api.sendAutoELF(meta,data,f.opts),posts=f.calls.filter(c=>c.init.method==='POST');assert.equal(r.elfLoaderStarted,true);assert.deepEqual(posts.map(c=>c.url),['http://192.168.1.50:9090/','http://192.168.1.50:9021/fixture.elf?pipe=0']);assert.deepEqual(Buffer.from(posts[0].init.body),setup);assert.deepEqual(posts[1].init.body,data);});
test('bad bootstrap and busy HEN never send payload bytes',async()=>{for(const options of [{corrupt:true},{busy:true}]){const f=fixture(options);await assert.rejects(()=>api.sendAutoELF(meta,data,f.opts));assert.equal(f.calls.filter(c=>c.init.method==='POST').length,0);}});
test('unresponsive service after startup never receives selected ELF',async()=>{const f=fixture({neverReady:true});await assert.rejects(()=>api.sendAutoELF(meta,data,f.opts),/did not become ready/);assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);});
test('ambiguous bootstrap response stops without ELF transfer or retries',async()=>{const f=fixture({failBIN:true});await assert.rejects(()=>api.sendAutoELF(meta,data,f.opts),e=>e.mayHaveExecuted===true);assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);});
test('ambiguous selected ELF response never restarts or resends',async()=>{const f=fixture({ready:true,failELF:true});await assert.rejects(()=>api.sendAutoELF(meta,data,f.opts),e=>e.mayHaveExecuted===true);assert.equal(f.calls.length,2);});
test('older firmware retains its explicit loader route',async()=>{const f=fixture();await api.sendAutoELF({...meta,firmware:'9.00'},data,f.opts);assert.equal(f.calls.length,1);assert.equal(f.calls[0].init.method,'POST');});
test('HTTPS, invalid format and absent acknowledgement stop before network access',()=>{const f=fixture();assert.throws(()=>api.sendAutoELF(meta,data,{...f.opts,origin:'https://host.test'}),/local sender/);assert.throws(()=>api.sendAutoELF({...meta,compatible:false},data,f.opts));assert.throws(()=>api.sendAutoELF(meta,Buffer.alloc(80),f.opts));assert.equal(f.calls.length,0);});
test('catalogue verifies bytes before contacting the console',async()=>{const f=fixture({ready:true}),action={platform:'ps4',format:'ELF',firmwares:['14.02'],downloadURL:'/downloads/fixture.elf',bytes:data.length,sha256:meta.sha256};const opts={...f.opts,firmware:'14.02',fetch:async(url,init)=>url.startsWith('/downloads/')?{ok:true,arrayBuffer:async()=>data}:f.fetcher(url,init)};assert.equal((await api.sendCatalogue(meta.address,action,opts)).status,'accepted');f.calls.length=0;await assert.rejects(()=>api.sendCatalogue(meta.address,{...action,sha256:'0'.repeat(64)},opts),/checksum/);assert.equal(f.calls.length,0);});
test('all imported actions preserve 14.02 pins, exact files and old firmware restrictions',()=>{const inventory=require('../../docs/webkitty-payload-inventory.json'),actions=require('../../docs/host-webkitty-payload-actions.json').actions;assert.equal(actions.length,35);for(const a of actions){assert.deepEqual(a.firmwares,['14.02']);const b=fs.readFileSync(path.join(root,a.downloadURL));assert.equal(client.sha256(b),a.sha256);assert.equal(b.length,a.bytes);assert.equal(a.run.type,a.format==='ELF'?'elf-http':'goldhen-http');assert.ok(inventory.files.some(f=>f.id===a.id&&f.sha256===a.sha256));}const older=bridge.loadActions(root).find(a=>a.id==='ps4-kme-web-app2usb-1300');assert.deepEqual(older.firmwares,['13.00']);assert.ok(!actions.some(a=>['BinLoader','EnableBrowser','WebRTE'].includes(a.upstreamId)));});
test('paired catalogue and selected-file routes both use automatic ELF startup',async t=>{
 const actions=bridge.loadActions(root),action=actions.find(a=>a.id==='ps4-webkitty-1402-npfakesignin'),f=fixture({ready:true}),token='a'.repeat(64);
 const {server}=bridge.createBridge({root,actions,token,resolveAddress:async a=>a,elfOptions:{fetcher:f.fetcher,pause:async()=>{},timeoutMs:10}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const origin='http://127.0.0.1:'+server.address().port;
 const r=await fetch(origin+'/api/run',{method:'POST',headers:{Origin:origin,'X-Whatsite-Token':token,'Content-Type':'application/json'},body:JSON.stringify({platform:'ps4',actionId:action.id,address:meta.address,firmware:'14.02'})});assert.equal((await r.json()).status,'accepted');assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);
 f.calls.length=0;const r2=await fetch(origin+'/api/loader-file',{method:'POST',headers:{Origin:origin,'X-Whatsite-Token':token,'X-Whatsite-Loader':JSON.stringify(meta),'Content-Type':'application/octet-stream'},body:data});assert.equal((await r2.json()).status,'accepted');assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);
 f.calls.length=0;const bad=await fetch(origin+'/api/run',{method:'POST',headers:{Origin:origin,'X-Whatsite-Token':token,'Content-Type':'application/json'},body:JSON.stringify({platform:'ps4',actionId:action.id,address:meta.address,firmware:'13.00'})});assert.equal(bad.status,400);assert.equal(f.calls.length,0);
});

test('all 35 catalogue buttons dispatch the selected transport on 14.02',async()=>{
 const {fixture,flush}=require('./host-continuation-dom.cjs');
 for(const action of require('../../docs/host-webkitty-payload-actions.json').actions){
  const storage=new Map([['whatwhatboy.host.ps4',JSON.stringify({address:'192.168.1.50',firmware:'14.02'})]]);
  const f=fixture({actions:[action],storage,initialCategory:'payloads',fileListView:true});let elfCalls=0;
  f.window.fetch=async()=>{};f.window.confirm=()=>true;f.window.PS4Loader={sendCatalogue:async(address,selected,opts)=>{assert.equal(selected.id,action.id);assert.equal(opts.firmware,'14.02');elfCalls++;return {status:'accepted',message:'Fixture transfer'};}};
  const button=f.ids['host-action-grid'].querySelector('[data-launch]');assert.ok(button,action.id);assert.equal(button.disabled,false,action.id);f.ids['host-action-grid'].fire('click',{target:button});await flush();
  if(action.format==='ELF')assert.equal(elfCalls,1,action.id);else {assert.equal(f.sends.length,1,action.id);assert.equal(f.sends[0].method,'goldhen');f.sends[0].resolve({status:'accepted',message:'Fixture transfer'});await flush();}
 }
});
test('updated compact ZIP contains the autostart module and every WebKitty file',()=>{
 const r=require('../../docs/ps4-loader-support.json'),zip=fs.readFileSync(path.join(root,r.sender.url)),entries=new Map();let pos=0;
 while(zip.readUInt32LE(pos)===0x04034b50){const method=zip.readUInt16LE(pos+8),size=zip.readUInt32LE(pos+18),n=zip.readUInt16LE(pos+26),extra=zip.readUInt16LE(pos+28),name=zip.subarray(pos+30,pos+30+n).toString().replace(/^ps4-loader-sender\//,''),start=pos+30+n+extra,b=zip.subarray(start,start+size);entries.set(name,method===8?require('node:zlib').inflateRawSync(b):b);pos=start+size;}
 assert.ok(entries.has('scripts/ps4-elf-autostart.cjs'));
 for(const a of require('../../docs/host-webkitty-payload-actions.json').actions)assert.equal(client.sha256(entries.get(a.downloadURL.slice(1))),a.sha256);
 assert.match(entries.get('hosts/ps4/loaders/index.html').toString(),/webkitty-payload/);
});

test('offline 14.02 cache and download catalogue include all imported files',()=>{
 const build=require('../../docs/afterglow-1402-build.json'),offline=JSON.parse(fs.readFileSync(path.join(root,build.base,'web/offline-files.json'))),downloads=require('../../docs/console-download-catalog.json').items;
 for(const a of require('../../docs/host-webkitty-payload-actions.json').actions){const filename='webkitty-'+path.basename(a.downloadURL),entry=offline.find(x=>x.path===filename);assert.equal(entry.sha256,a.sha256);assert.equal(entry.bytes,a.bytes);assert.equal(client.sha256(fs.readFileSync(path.join(root,build.base,'web',filename))),a.sha256);assert.ok(downloads.some(x=>x.id===a.id&&x.sha256===a.sha256));}
});
