'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const api=require('../../assets/ps4-loader-client.js'),bridge=require('../console-payload-bridge.cjs'),client=require('../../assets/host-console-client.js');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function bytes(format){if(format==='BIN')return Buffer.from([0xe9,0,0,0,0]);const b=Buffer.alloc(80);b.set([127,69,76,70,2,1]);b[18]=62;return b;}
function metadata(profile,data=bytes(api.profiles[profile].format)){return {profile,address:'192.168.1.50',firmware:profile==='bin-tcp'?'9.00':'14.02',name:'fixture.'+api.profiles[profile].format.toLowerCase(),bytes:data.length,sha256:sha(data),compatible:true};}
function response(status=200,body={status:'ready'}){return {ok:status>=200&&status<300,status,json:async()=>body};}
test('HTTP BIN and ELF use distinct source-derived endpoints and exact bytes',async()=>{
  for(const profile of ['goldhen-http','elf-http']){const data=bytes(api.profiles[profile].format),meta=metadata(profile,data),seen=[];
    const out=await api.sendHTTP(meta,data,{origin:'http://host.test',normalizeAddress:client.normalizeAddress,fetch:async(url,init)=>{seen.push({url,init});return response();}});
    assert.equal(out.status,'accepted');assert.equal(seen.length,profile==='elf-http'?1:2);const last=seen.at(-1);assert.equal(last.url,profile==='elf-http'?'http://192.168.1.50:9021/fixture.elf?pipe=0':'http://192.168.1.50:9090/');assert.deepEqual(last.init.body,data);assert.equal(last.init.method,'POST');
  }
});
test('HTTPS, wrong formats, TCP firmware mismatch and missing acknowledgement never dispatch',()=>{
  let calls=0;const opts={origin:'https://host.test',normalizeAddress:client.normalizeAddress,fetch:()=>{calls++;}};
  assert.throws(()=>api.sendHTTP(metadata('goldhen-http'),bytes('BIN'),opts),/local sender/);
  assert.throws(()=>api.validate({...metadata('bin-tcp'),firmware:'14.02'}),/9.00/);
  assert.throws(()=>api.validate({...metadata('elf-http'),compatible:false}),/Confirm/);
  assert.throws(()=>api.validate({...metadata('goldhen-http'),bytes:80},bytes('ELF')),/unpacked flat BIN/);
  assert.throws(()=>api.validate({...metadata('elf-http'),bytes:5},bytes('BIN')),/64-bit/);
  assert.throws(()=>api.validate({...metadata('elf-http'),port:9020}),/Invalid loader/);
  assert.equal(calls,0);
});
test('busy and stalled readiness do not send a payload',async()=>{
  for(const stalled of [false,true]){let calls=0;await assert.rejects(()=>api.sendHTTP(metadata('goldhen-http'),bytes('BIN'),{origin:'http://host.test',normalizeAddress:client.normalizeAddress,timeoutMs:10,fetch:async()=>{calls++;return stalled?{ok:true,json:()=>new Promise(()=>{})}:response(200,{status:'busy'});}}));assert.equal(calls,1);}
});
test('ambiguous HTTP transfers are not retried or switched to another loader',async()=>{
  for(const failure of ['timeout','network','500']){let calls=0;await assert.rejects(()=>api.sendHTTP(metadata('elf-http'),bytes('ELF'),{origin:'http://host.test',normalizeAddress:client.normalizeAddress,timeoutMs:10,fetch:()=>{calls++;if(failure==='timeout')return new Promise(()=>{});if(failure==='network')return Promise.reject(Error('connection lost'));return Promise.resolve(response(500));}}),e=>e.mayHaveExecuted===true);assert.equal(calls,1);}
});
test('explicit loader rejection remains an error without a silent retry',async()=>{await assert.rejects(()=>api.sendHTTP(metadata('elf-http'),bytes('ELF'),{origin:'http://host.test',normalizeAddress:client.normalizeAddress,fetch:async()=>response(400)}),e=>!e.mayHaveExecuted);});
async function setup(t){const seen=[],root=path.resolve(__dirname,'../..'),token='a'.repeat(64),server=bridge.createBridge({root,actions:[],token,resolveAddress:async address=>{seen.push(['resolve',address]);return address;},sendBIN:async(address,data)=>{seen.push(['bin',address,data]);return {status:'accepted',message:'mock'};},sendELF:async(address,data)=>{seen.push(['elf',address,data]);return {status:'sent',message:'mock'};},sendRawBIN:async(address,data)=>{seen.push(['rawbin',address,data]);return {status:'sent',message:'mock'};}}).server;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const origin='http://127.0.0.1:'+server.address().port;
  function send(meta,data,headers={}){return fetch(origin+'/api/loader-file',{method:'POST',headers:{Origin:origin,'X-Whatsite-Token':token,'X-Whatsite-Loader':JSON.stringify(meta),'Content-Type':'application/octet-stream',...headers},body:data});}
  return {send,seen,origin,token};
}
test('paired selected-file route validates hashes and dispatches fixed BIN/ELF TCP transports',async t=>{
  const f=await setup(t);
  for(const [profile,transport]of [['goldhen-http','bin'],['elf-tcp','elf'],['bin-tcp','rawbin']]){const data=bytes(api.profiles[profile].format),r=await f.send(metadata(profile,data),data);assert.equal(r.status,200);assert.equal((await r.json()).sha256,sha(data));assert.equal(f.seen.at(-1)[0],transport);assert.deepEqual(f.seen.at(-1)[2],data);}
});
test('pairing, origin, checksum, format, firmware and extraneous fields fail before console contact',async t=>{
  const f=await setup(t),data=bytes('BIN'),meta=metadata('goldhen-http',data);
  for(const [m,h]of [[meta,{'X-Whatsite-Token':''}],[meta,{Origin:'https://foreign.test'}],[{...meta,sha256:'0'.repeat(64)},{}],[{...meta,compatible:false},{}],[{...meta,profile:'bin-tcp',firmware:'14.02'},{}],[{...meta,url:'https://foreign.test'},{}]]){const r=await f.send(m,data,h);assert.ok(r.status>=400);}
  assert.equal(f.seen.length,0);
});
test('new page is served by the paired sender and exposes no automatic payload execution',async t=>{
  const f=await setup(t);const r=await fetch(f.origin+'/hosts/ps4/loaders/');assert.equal(r.status,200);const html=await r.text();assert.match(html,/whatwhatboy-local-sender/);assert.match(html,/loader-form/);assert.equal(f.seen.length,0);
  const status=await fetch(f.origin+'/api/loader-status',{headers:{'X-Whatsite-Token':f.token}});assert.equal((await status.json()).ps4LoaderUpload,true);
});
test('pinned files, four preserved standalone launchers and generated links remain intact',()=>{
  const root=path.resolve(__dirname,'../..'),r=JSON.parse(fs.readFileSync(path.join(root,'docs/ps4-loader-support.json'))),html=fs.readFileSync(path.join(root,'hosts/ps4/loaders/index.html'),'utf8');
  for(const f of [...Object.values(r.files),r.sender]){const b=fs.readFileSync(path.join(root,f.url));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}
  assert.deepEqual(r.legacy.map(g=>g.firmwares[0]),['5.05','6.72','7.02','7.55']);for(const g of r.legacy){assert.ok(fs.existsSync(path.join(root,g.entry,'index.html')));assert.ok(fs.existsSync(path.join(root,g.runtimeEntry)));assert.ok(html.includes(g.entry));}
  const routes=require('../host-public-routes.cjs').routes();assert.ok(routes.some(r=>r.target==='ps4/loaders/index.html'));
});

test('both existing BIN senders accept WebKitty HTTP 202 without retrying',async()=>{
  let calls=0;const fetcher=async url=>{calls++;return url.endsWith('/status')?response():response(202);};
  assert.equal((await bridge.sendGoldHENHTTP('192.168.1.50',bytes('BIN'),{fetcher})).status,'accepted');assert.equal(calls,2);
  calls=0;const data=bytes('BIN');const out=await client.sendGoldHEN('192.168.1.50',{format:'BIN',downloadURL:'/downloads/fixture.bin',sha256:sha(data)},{origin:'http://host.test',fetch:async url=>{calls++;return url.startsWith('/downloads/')?{ok:true,arrayBuffer:async()=>data}:url.endsWith('/status')?response():response(202);}});assert.equal(out.status,'accepted');assert.equal(calls,3);
});
test('compact sender archive contains every recorded module and payload byte',()=>{
  const root=path.resolve(__dirname,'../..'),r=JSON.parse(fs.readFileSync(path.join(root,'docs/ps4-loader-support.json'))),zip=fs.readFileSync(path.join(root,r.sender.url)),entries=new Map();let pos=0;
  while(zip.readUInt32LE(pos)===0x04034b50){const method=zip.readUInt16LE(pos+8),size=zip.readUInt32LE(pos+18),nameSize=zip.readUInt16LE(pos+26),extra=zip.readUInt16LE(pos+28),name=zip.subarray(pos+30,pos+30+nameSize).toString(),start=pos+30+nameSize+extra,b=zip.subarray(start,start+size);entries.set(name.replace(/^ps4-loader-sender\//,''),method===8?require('node:zlib').inflateRawSync(b):b);pos=start+size;}
  const manifest=JSON.parse(entries.get('bundle-manifest.json'));for(const record of manifest.files){const b=entries.get(record.name);assert.ok(b,record.name);assert.equal(b.length,record.bytes);assert.equal(sha(b),record.sha256);}
  for(const name of ['scripts/ps4-loader-upload.cjs','assets/ps4-loader-client.js','hosts/ps4/loaders/index.html'])assert.ok(entries.has(name));
  assert.ok(entries.get('hosts/ps4/loaders/index.html').toString().includes('/hosts/runtime/ps4-900/web/index.html'));
});
