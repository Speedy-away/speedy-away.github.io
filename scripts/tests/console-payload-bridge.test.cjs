const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {EventEmitter} = require('node:events');
const bridge = require('../console-payload-bridge.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'whatsite-sender-test-'));
  fs.mkdirSync(path.join(root,'downloads/fixture'),{recursive:true});
  fs.mkdirSync(path.join(root,'hosts/ps5'),{recursive:true});
  fs.mkdirSync(path.join(root,'docs'),{recursive:true});
  fs.writeFileSync(path.join(root,'hosts/ps5/index.html'),'<h1>Fixture only</h1><a href="/docs/host-payload-sender.md">Instructions</a><a href="/hosts/ps4/">PS4</a>');
  fs.writeFileSync(path.join(root,'AGENTS.md'),'private workspace instructions');
  const elf = Buffer.alloc(80); Buffer.from([0x7f,0x45,0x4c,0x46]).copy(elf);
  const bin = Buffer.from([1,2,3,4]);
  fs.writeFileSync(path.join(root,'downloads/fixture/payload.elf'),elf);
  fs.writeFileSync(path.join(root,'downloads/fixture/menu.bin'),bin);
  const sha = data => crypto.createHash('sha256').update(data).digest('hex');
  const actions = [
    {id:'fixture-ps5',platform:'ps5',firmwares:['9.00'],format:'ELF',downloadURL:'/downloads/fixture/payload.elf',sha256:sha(elf),run:{type:'elf-http',port:9021}},
    {id:'fixture-mod',platform:'ps4',firmwares:['9.00'],gameVersion:'1.38',format:'BIN',downloadURL:'/downloads/fixture/menu.bin',sha256:sha(bin),run:{type:'goldhen-http',port:9090}}
  ];
  t.after(()=>fs.rmSync(root,{recursive:true,force:true})); // Only the exact mkdtemp test directory.
  return {root,elf,bin,actions};
}
async function startFixture(t, options) {
  const token = 'b'.repeat(64), setup = bridge.createBridge({...options,token});
  await new Promise(resolve=>setup.server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>setup.server.close(resolve)));
  const base = 'http://127.0.0.1:'+setup.server.address().port;
  async function request(route,body,headers = {}) {
    return fetch(base+route,{method:body ? 'POST':'GET',headers:{Origin:base,'X-Whatsite-Token':token,...(body ? {'Content-Type':'application/json'}:{}),...headers},...(body ? {body:JSON.stringify(body)}:{})});
  }
  return {...setup,base,request};
}
test('DNS targets are resolved once and every result must be a private IPv4',async()=>{
  let lookups = 0;
  assert.equal(await bridge.resolveConsoleAddress('ps5.local',async(name,options)=>{lookups++;assert.equal(name,'ps5.local');assert.equal(options.all,true);return [{family:4,address:'192.168.1.50'}];}),'192.168.1.50');
  assert.equal(lookups,1);
  for (const value of ['127.0.0.1','8.8.8.8','192.168.1.255','http://ps5.local','ps5.local:9021']) await assert.rejects(()=>bridge.resolveConsoleAddress(value));
  await assert.rejects(()=>bridge.resolveConsoleAddress('ps5.local',async()=>[{family:4,address:'192.168.1.50'},{family:4,address:'8.8.8.8'}]));
  await assert.rejects(()=>bridge.resolveConsoleAddress('ps5.local',async()=>[{family:6,address:'::1'}]));
});
test('curated files must be ready builds with an exact hash, extension, magic and approved transport',async t=>{
  const {root,actions,elf} = fixture(t), action = actions[0];
  assert.deepEqual((await bridge.readVerifiedFile(action,root)).data,elf);
  for (const change of [
    {downloadURL:'https://example.com/a.elf'}, {downloadURL:'/downloads/../AGENTS.md'}, {downloadURL:'/downloads/%2e%2e/AGENTS.md'},
    {downloadURL:'/downloads/fixture/payload.elf?x'}, {format:'RAR'}, {sha256:''}, {run:{type:'elf-tcp',port:9020}}, {run:{type:'ps5-manager',port:8084}}
  ]) assert.throws(()=>bridge.localFileFor({...action,...change},root));
  await assert.rejects(()=>bridge.readVerifiedFile({...action,sha256:'0'.repeat(64)},root),{code:'checksum-mismatch'});
  const invalid = Buffer.alloc(80); fs.writeFileSync(path.join(root,'downloads/fixture/payload.elf'),invalid);
  await assert.rejects(()=>bridge.readVerifiedFile({...action,sha256:crypto.createHash('sha256').update(invalid).digest('hex')},root),{code:'invalid-elf'});
});
test('static dashboard whitelist excludes arbitrary files, backups and traversal',()=>{
  for (const value of ['/hosts/ps5/','/hosts/ps4/index.html','/hosts/ps4/payload-manager/','/hosts/ps5/payload-manager/index.html','/assets/host-console-client.js','/assets/images/logo.png','/languages/fr.js','/languages/i18n.js','/style.css','/docs/host-actions-ps5.json']) assert.ok(bridge.staticPath(value),value);
  for (const value of ['/AGENTS.md','/.git/config','/scripts/console-payload-bridge.cjs','/assets/../AGENTS.md','/assets/%2e%2e/AGENTS.md','/assets//x.js','/assets/nested/secret.js','/docs/private.json','/console/ps3/index.html']) assert.equal(bridge.staticPath(value),null,value);
});

test('plugins and cheat data can be downloaded but never become raw payload actions', async t=>{
  const {root} = fixture(t);
  for (const format of ['PRX','SPRX','JSON','SHN','XML','MC4']) {
    const data = Buffer.from('download-only fixture');
    const local = '/downloads/fixture/file.' + format.toLowerCase();
    fs.writeFileSync(path.join(root,local),data);
    const action = {format,downloadURL:local,sha256:crypto.createHash('sha256').update(data).digest('hex'),platform:'ps5',run:{type:'elf-http',port:9021}};
    assert.equal(bridge.localFileFor(action,root,{forRun:false}).bytes,data.length);
    assert.throws(()=>bridge.localFileFor(action,root),{code:'unsupported-format'});
  }
});
test('bridge requires pairing and its own origin before any action or readable status',async t=>{
  const setup = fixture(t); let sent = 0;
  const {request} = await startFixture(t,{...setup,resolveAddress:async()=>{throw Error('Must not resolve');},sendELF:async()=>{sent++;}});
  let r = await request('/api/status',null,{'X-Whatsite-Token':''}); assert.equal(r.status,401);
  r = await request('/api/status',null,{Origin:'https://evil.example'}); assert.equal(r.status,403);
  r = await request('/api/status'); assert.equal(r.status,200);
  const status = await r.json(); assert.equal(status.status,'connected'); assert.equal(status.actions[0].available,true);
  assert.equal(status.protocolVersion,2);assert.deepEqual(status.capabilities,{serviceOverview:true,uncertainOutcomes:true,userSelectedBIN:true});
  r = await request('/api/run',{actionId:'fixture-ps5',platform:'ps5',address:'192.168.1.50',firmware:'9.00'},{Origin:'null'}); assert.equal(r.status,403);
  assert.equal(sent,0);
});

test('read-only service inspection uses only fixed GET metadata routes without Origin spoofing',async()=>{
  const seen=[];
  const fetcher=async(url,init)=>{seen.push({url,init});return new Response(url.endsWith('/version')?'0.6.3':url.endsWith('/getip')?'192.168.1.50':url.endsWith('/status')?'{"status":"ready"}':url.endsWith('/get_download_state')?'[]':'<html><title>File manager</title></html>');};
  const ps5=await bridge.inspectConsoleServices('192.168.1.50','ps5',{fetcher});
  assert.equal(ps5.status,'connected');assert.equal(ps5.version,'0.6.3');assert.equal(ps5.reportedAddress,'192.168.1.50');
  assert.equal(ps5.firmware,undefined);assert.equal(ps5.activeGame,undefined);assert.equal(ps5.service,'payload-manager');
  assert.deepEqual(seen.map(s=>s.url),['http://192.168.1.50:8084/version','http://192.168.1.50:8084/getip','http://192.168.1.50:6701/get_download_state','http://192.168.1.50:8888/','http://192.168.1.50:9090/']);
  assert.deepEqual(ps5.checks.map(check=>check.service),['payload-manager','downloader','files','ezremote']);
  assert.equal(ps5.checks[1].queueCount,0);assert.equal(ps5.checks[1].companionVerified,false);
  const ps4=await bridge.inspectConsoleServices('192.168.1.50','ps4',{fetcher});
  assert.equal(ps4.status,'connected');assert.equal(ps4.connection,'ready');assert.equal(ps4.version,null);assert.equal(ps4.reportedAddress,null);
  assert.deepEqual(seen.slice(5).map(s=>s.url),['http://192.168.1.50:9090/status','http://192.168.1.50:6701/get_download_state','http://192.168.1.50:8080/']);
  assert(seen.every(({init})=>init.method==='GET'&&init.redirect==='error'&&init.headers===undefined&&init.body===undefined&&init.signal));
});

test('service metadata failures and unknown values never become firmware or game detection',async()=>{
  const text=value=>new Response(value);
  const unknown=await bridge.inspectConsoleServices('192.168.1.50','ps5',{fetcher:async url=>text(url.endsWith('/version')?'0.6.3':'0.0.0.0')});
  assert.equal(unknown.status,'connected');assert.equal(unknown.reportedAddress,null);
  for(const fetcher of [async()=>({ok:false,status:403}),async()=>{throw Error('blocked');},async()=>text('<html>'),async()=>text('x'.repeat(2049))]){
    const out=await bridge.inspectConsoleServices('192.168.1.50','ps5',{fetcher});
    assert.equal(out.status,'unavailable');assert.equal(out.version,null);assert.equal(out.reportedAddress,null);assert.equal(out.firmware,undefined);
  }
  const streamed=await bridge.inspectConsoleServices('192.168.1.50','ps4',{fetcher:async()=>new Response('x'.repeat(2049))});
  assert.equal(streamed.status,'unavailable');assert.equal(streamed.code,'unexpected-response');
  const busy=await bridge.inspectConsoleServices('192.168.1.50','ps4',{fetcher:async()=>text('{"status":"busy"}')});
  assert.equal(busy.status,'connected');assert.equal(busy.connection,'busy');
  let calls=0;
  await assert.rejects(()=>bridge.inspectConsoleServices('127.0.0.1','ps4',{fetcher:async()=>{calls++;}}));
  await assert.rejects(()=>bridge.inspectConsoleServices('192.168.1.50','other',{fetcher:async()=>{calls++;}}));
  assert.equal(calls,0);
});

test('paired inspect route pins the LAN address and accepts no URL, port, path or payload request',async t=>{
  const setup=fixture(t), checks=[];let sends=0,resolves=0;
  const {request}=await startFixture(t,{...setup,resolveAddress:async input=>{resolves++;assert.equal(input,'ps5.local');return '192.168.1.50';},inspectServices:async(address,platform)=>{checks.push({address,platform});return {status:'connected',code:'manager-connected',message:'Read-only metadata.',service:'payload-manager',version:'0.6.3',reportedAddress:'192.168.1.50'};},sendELF:async()=>{sends++;},sendBIN:async()=>{sends++;}});
  const body={address:'ps5.local',platform:'ps5'};
  let r=await request('/api/inspect',body,{'X-Whatsite-Token':''});assert.equal(r.status,401);
  r=await request('/api/inspect',body,{Origin:'https://evil.example'});assert.equal(r.status,403);
  for(const changed of [{url:'http://192.168.1.50:80/'},{path:'/shutdown'},{port:80},{actionId:'fixture-ps5'},{platform:'other'}]){r=await request('/api/inspect',{...body,...changed});assert.equal(r.status,400);}
  assert.equal(checks.length,0);assert.equal(resolves,0);
  r=await request('/api/inspect',body);assert.equal(r.status,200);assert.equal((await r.json()).version,'0.6.3');
  assert.deepEqual(checks,[{address:'192.168.1.50',platform:'ps5'}]);assert.equal(resolves,1);assert.equal(sends,0);
});
test('sender uses only a curated action with matching platform, firmware and game update',async t=>{
  const setup = fixture(t); const sent = [];
  const {request} = await startFixture(t,{...setup,resolveAddress:async(address)=>{assert.equal(address,'192.168.1.50');return address;},sendELF:async(address,data)=>{sent.push({address,data});return {status:'sent',code:'elf-bytes-sent',message:'Bytes sent, execution not verified.'};},sendBIN:async(address,data)=>{sent.push({address,data});return {status:'accepted',code:'goldhen-accepted',message:'Accepted, check the game.'};}});
  const valid = {actionId:'fixture-ps5',platform:'ps5',address:'192.168.1.50',firmware:'9.00'};
  for (const changed of [{actionId:'unknown'},{platform:'ps4'},{firmware:'13.60'},{url:'https://evil.example/payload.elf'},{port:9020}]) {
    const r = await request('/api/run',{...valid,...changed}); assert.equal(r.status,400); assert.equal((await r.json()).status,'error');
  }
  assert.equal(sent.length,0);
  let r = await request('/api/run',valid); assert.equal(r.status,200); assert.equal((await r.json()).status,'sent'); assert.deepEqual(sent[0].data,setup.elf);
  r = await request('/api/run',{...valid,actionId:'fixture-mod',platform:'ps4'}); assert.equal((await r.json()).code,'game-version-mismatch');
  r = await request('/api/run',{...valid,actionId:'fixture-mod',platform:'ps4',gameVersion:'1.38'}); assert.equal((await r.json()).status,'accepted'); assert.deepEqual(sent[1].data,setup.bin);
});
test('sender enforces firmware ranges and upper limits before a mocked transfer',async t=>{
 const setup=fixture(t);let sends=0;
 setup.actions[0].firmwares=['3.00–12.70'];setup.actions[0].firmwareMax='12.70';
 const {request}=await startFixture(t,{...setup,resolveAddress:async()=> '192.168.1.50',sendELF:async()=>{sends++;return {status:'sent',message:'Fixture transfer only'};}});
 for(const firmware of ['', '2.70','13.00']){const r=await request('/api/run',{actionId:'fixture-ps5',platform:'ps5',address:'192.168.1.50',firmware});assert.equal((await r.json()).code,'firmware-mismatch');}
 assert.equal(sends,0);
 const r=await request('/api/run',{actionId:'fixture-ps5',platform:'ps5',address:'192.168.1.50',firmware:'12.70'});assert.equal((await r.json()).status,'sent');assert.equal(sends,1);
});
test('file checksum failure prevents any network payload transfer',async t=>{
  const setup = fixture(t); let sends = 0;
  setup.actions[0].sha256 = '0'.repeat(64);
  const {request} = await startFixture(t,{...setup,resolveAddress:async()=> '192.168.1.50',sendELF:async()=>{sends++;}});
  const r = await request('/api/run',{actionId:'fixture-ps5',platform:'ps5',address:'192.168.1.50',firmware:'9.00'});
  assert.equal((await r.json()).code,'checksum-mismatch'); assert.equal(sends,0);
});
test('paired run reports uncertain transport outcomes without claiming failure or retrying',async t=>{
  const setup=fixture(t);let sends=0;
  const {request}=await startFixture(t,{...setup,resolveAddress:async()=> '192.168.1.50',sendELF:async()=>{sends++;const error=new Error('The transfer result is unknown. Check the console before trying again.');error.code='loader-timeout';error.mayHaveExecuted=true;throw error;}});
  const response=await request('/api/run',{actionId:'fixture-ps5',platform:'ps5',address:'192.168.1.50',firmware:'9.00'});
  assert.equal(response.status,200);const result=await response.json();
  assert.equal(result.status,'uncertain');assert.equal(result.code,'loader-timeout');assert.equal(result.mayHaveExecuted,true);assert.equal(result.outcome,'unknown');assert.equal(sends,1);
});
test('simultaneous transfers do not remove another transfer console lock',async t=>{
  const setup = fixture(t); let release, entered;
  const started = new Promise(resolve=>{entered=resolve;});
  const pending = new Promise(resolve=>{release=resolve;});
  const {request} = await startFixture(t,{...setup,resolveAddress:async()=> '192.168.1.50',sendELF:async()=>{entered();await pending;return {status:'sent',message:'Bytes sent.'};}});
  const body = {actionId:'fixture-ps5',platform:'ps5',address:'192.168.1.50',firmware:'9.00'};
  const first = request('/api/run',body); await started;
  for (let i=0;i<2;i++) assert.equal((await (await request('/api/run',body)).json()).code,'console-busy');
  release(); assert.equal((await (await first).json()).status,'sent');
});
test('bridge serves only its dashboard and curated payloads, without disclosing its token',async t=>{
  const setup = fixture(t);
  delete setup.actions[0].run; // A bootstrap loader may be downloadable without being runnable by this sender.
  const {base,token} = await startFixture(t,setup);
  const html = await (await fetch(base+'/hosts/ps5/')).text();
  assert.match(html,/Fixture only/);
  assert.match(html,/<meta name="whatwhatboy-local-sender" content="true">/);
  assert.match(html,/href="https:\/\/speedy-away\.github\.io\/docs\/host-payload-sender.md"/);
  assert.match(html,/href="\/hosts\/ps4\/"/);
  assert.ok(!html.includes(token));
  assert.equal((await fetch(base+'/AGENTS.md')).status,404);
  assert.equal((await fetch(base+'/downloads/fixture/menu.bin')).status,200);
  assert.equal((await fetch(base+'/downloads/fixture/payload.elf')).status,200);
  assert.equal((await fetch(base+'/downloads/fixture/unknown.bin')).status,404);
  const r = await fetch(base+'/api/status'); assert.equal(r.status,401); assert.equal(r.headers.get('access-control-allow-origin'),null);
});
test('raw ELF sender uses raw bytes on fixed TCP9021 and reports only transport completion',async()=>{
  const data = Buffer.from([0x7f,0x45,0x4c,0x46]);
  const socket = new EventEmitter(); let captured, destroyed = false;
  socket.end = bytes => {assert.deepEqual(bytes,data);queueMicrotask(()=>socket.emit('finish'));}; socket.destroy = ()=>{destroyed=true;};
  const out = await bridge.sendRawELF('192.168.1.50',data,{connect:options=>{captured=options;queueMicrotask(()=>socket.emit('connect'));return socket;}});
  assert.deepEqual(captured,{host:'192.168.1.50',port:9021}); assert.equal(out.status,'sent'); assert.match(out.message,/Check the console/); assert.equal(destroyed,true);
});

test('raw PS4 BIN transport requires the fixed port, platform, flat format and bounded verified file',async t=>{
  const {root,actions,bin,elf} = fixture(t);
  const action = {...actions[1],run:{type:'bin-tcp',port:9020}};
  assert.deepEqual((await bridge.readVerifiedFile(action,root)).data,bin);
  for (const change of [
    {platform:'ps5'}, {run:{type:'bin-tcp',port:9090}}, {run:{type:'bin-tcp',port:9021}}, {run:{type:'bin-tcp'}},
    {format:'ELF',downloadURL:'/downloads/fixture/payload.elf',sha256:actions[0].sha256},
    {run:{type:'elf-tcp',port:9020}}, {run:{type:'elf-tcp',port:9021}}
  ]) assert.throws(()=>bridge.localFileFor({...action,...change},root),{code:'unsupported-transport'});
  await assert.rejects(()=>bridge.readVerifiedFile({...action,sha256:'0'.repeat(64)},root),{code:'checksum-mismatch'});
  fs.writeFileSync(path.join(root,'downloads/fixture/menu.bin'),elf);
  await assert.rejects(()=>bridge.readVerifiedFile({...action,sha256:crypto.createHash('sha256').update(elf).digest('hex')},root),{code:'invalid-bin'});
  fs.writeFileSync(path.join(root,'downloads/fixture/menu.bin'),Buffer.alloc(0x300000));
  assert.equal(bridge.localFileFor(action,root).bytes,0x300000);
  fs.writeFileSync(path.join(root,'downloads/fixture/menu.bin'),Buffer.alloc(0x300001));
  assert.throws(()=>bridge.localFileFor(action,root),{code:'invalid-file-size'});
  assert.equal(bridge.localFileFor(action,root,{forRun:false}).bytes,0x300001,'Download limits do not invent raw loader compatibility');
});

test('raw PS4 BIN sender makes one fixed TCP9020 connection with exact bytes and EOF, without a readiness probe',async()=>{
  const data = Buffer.from([1,2,3,4]), socket = new EventEmitter();
  const connections = [], writes = []; let destroyed = false;
  socket.end = bytes => {writes.push(bytes);queueMicrotask(()=>socket.emit('finish'));};
  socket.destroy = ()=>{destroyed=true;};
  const out = await bridge.sendRawBIN('192.168.1.50',data,{connect:options=>{connections.push(options);queueMicrotask(()=>socket.emit('connect'));return socket;}});
  assert.deepEqual(connections,[{host:'192.168.1.50',port:9020}]);assert.deepEqual(writes,[data]);assert.equal(destroyed,true);
  assert.equal(out.status,'sent');assert.equal(out.code,'bin-bytes-sent');assert.equal(out.port,9020);assert.equal(out.bytes,data.length);
  assert.match(out.message,/Check the console/);assert.doesNotMatch(out.message,/accepted|running|executed successfully/i);
});

test('raw PS4 BIN failures preserve uncertainty after bytes are offered and never reconnect',async()=>{
  for (const mode of ['refused','reset','disconnect','throw','timeout']) {
    const socket = new EventEmitter();let connects=0,writes=0;
    socket.destroy=()=>{};
    socket.end=()=>{writes++;if(mode==='throw')throw Error('write threw');if(mode==='reset')queueMicrotask(()=>socket.emit('error',Error('reset')));if(mode==='disconnect')queueMicrotask(()=>socket.emit('close'));};
    await assert.rejects(()=>bridge.sendRawBIN('192.168.1.50',Buffer.from([1,2,3]),{timeoutMs:5,connect:()=>{connects++;queueMicrotask(()=>socket.emit(mode==='refused'?'error':'connect',Error('refused')));return socket;}}),error=>{
      assert.equal(error.mayHaveExecuted,mode==='refused'?undefined:true,mode);
      if(mode!=='refused'){assert.equal(error.outcome,'unknown');assert.match(error.message,/Check the console before trying again/);}
      return true;
    });
    assert.equal(connects,1);assert.equal(writes,mode==='refused'?0:1);
  }
  let connects=0;
  for(const bytes of [Buffer.alloc(0),Buffer.alloc(0x300001),Buffer.from([0x7f,0x45,0x4c,0x46])])
    await assert.rejects(()=>bridge.sendRawBIN('192.168.1.50',bytes,{connect:()=>{connects++;throw Error('Must not connect');}}));
  assert.equal(connects,0);
});

test('paired raw BIN action reuses firmware, pairing, address and hash checks without HTTP or ELF fallback',async t=>{
  const setup=fixture(t), sent=[];let otherTransports=0,probes=0,resolves=0;
  setup.actions[1]={...setup.actions[1],run:{type:'bin-tcp',port:9020}};
  const {request}=await startFixture(t,{...setup,resolveAddress:async address=>{resolves++;assert.equal(address,'ps4.local');return '192.168.1.50';},sendRawBIN:async(address,data)=>{sent.push({address,data});return {status:'sent',code:'bin-bytes-sent',message:'Bytes sent; check the console.',port:9020};},sendBIN:async()=>{otherTransports++;},sendELF:async()=>{otherTransports++;},inspectServices:async()=>{probes++;throw Error('Must not probe');}});
  const body={actionId:'fixture-mod',platform:'ps4',address:'ps4.local',firmware:'9.00',gameVersion:'1.38'};
  const status=await (await request('/api/status')).json();assert.equal(status.actions.find(a=>a.id==='fixture-mod').available,true);
  assert.equal(resolves,0);assert.equal(sent.length,0);
  assert.equal((await request('/api/run',body,{'X-Whatsite-Token':''})).status,401);
  for(const change of [{platform:'ps5'},{firmware:'13.52'},{gameVersion:'1.57'},{port:9020}])assert.equal((await request('/api/run',{...body,...change})).status,400);
  assert.equal(resolves,0);assert.equal(sent.length,0);
  const out=await (await request('/api/run',body)).json();assert.equal(out.status,'sent');assert.equal(out.port,9020);
  assert.deepEqual(sent,[{address:'192.168.1.50',data:setup.bin}]);assert.equal(resolves,1);assert.equal(probes,0);assert.equal(otherTransports,0);
  setup.actions[1].sha256='0'.repeat(64);
  assert.equal((await (await request('/api/run',body)).json()).code,'checksum-mismatch');assert.equal(sent.length,1);
});
test('GoldHEN bridge honors readiness and HTTP200 rather than faking a TCP result',async()=>{
  const seen = [], data = Buffer.from([1,2,3]);
  const out = await bridge.sendGoldHENHTTP('192.168.1.50',data,{fetcher:async(url,init)=>{seen.push([url,init]);return {ok:true,status:200,json:async()=>({status:'ready'})};}});
  assert.equal(out.status,'accepted'); assert.equal(seen[0][0],'http://192.168.1.50:9090/status'); assert.equal(seen[0][1].method,'GET'); assert.equal(seen[1][0],'http://192.168.1.50:9090/'); assert.equal(seen[1][1].body,data);
  let calls = 0;
  await assert.rejects(()=>bridge.sendGoldHENHTTP('192.168.1.50',data,{fetcher:async()=>{calls++;return {ok:true,status:200,json:async()=>({status:'busy'})};}}),{code:'loader-busy'});
  assert.equal(calls,1);
});

function selectedAction(bin,overrides={}) {
  return {id:'selected-fixture',platform:'ps4',format:'BIN',bytes:bin.length,sha256:crypto.createHash('sha256').update(bin).digest('hex'),firmwares:['9.00'],gameVersion:'1.38',downloadURL:'https://github.com/original/project/releases/download/pinned/original.bin',run:{type:'goldhen-http',port:9090,input:'user-file'},...overrides};
}
async function selectedFixture(t,options={}) {
  const data=fixture(t),action=selectedAction(data.bin),setup=await startFixture(t,{...data,actions:[action],...options});
  const metadata={actionId:action.id,platform:'ps4',address:'ps4.local',firmware:'9.00',gameVersion:'1.38'};
  function upload(bytes=data.bin,changes={},headers={}) {return fetch(setup.base+'/api/run-file',{method:'POST',headers:{Origin:setup.base,'X-Whatsite-Token':setup.token,'Content-Type':'application/octet-stream','X-Whatsite-Run':JSON.stringify({...metadata,...changes}),...headers},body:bytes});}
  return {...data,...setup,action,metadata,upload};
}
test('selected-file capability requires an explicit bounded PS4 BIN contract and never treats an original URL as a local payload',async t=>{
  let sends=0,resolves=0;
  const f=await selectedFixture(t,{sendBIN:async()=>{sends++;},resolveAddress:async()=>{resolves++;return '192.168.1.50';}});
  const status=await(await f.request('/api/status')).json();
  assert.equal(status.capabilities.userSelectedBIN,true);
  assert.deepEqual(status.actions,[{id:f.action.id,platform:'ps4',available:true,requiresFile:true,format:'BIN',bytes:f.bin.length}]);
  assert.equal((await(await f.request('/api/run',f.metadata)).json()).code,'user-file-required');
  assert.throws(()=>bridge.localFileFor(f.action,f.root),{code:'user-file-required'});
  for(const change of [{platform:'ps5'},{format:'ELF'},{bytes:0},{bytes:0x300001},{sha256:'bad'},{firmwares:[]},{firmwares:['9.00–11.00']},{run:{type:'goldhen-http',port:9090}},{run:{type:'goldhen-http',port:9020,input:'user-file'}},{run:{type:'elf-tcp',port:9021,input:'user-file'}}]) {
    const candidate={...f.action,...change};assert.throws(()=>bridge.userFileSpec(candidate));
    if(candidate.run.input==='user-file')assert.equal(bridge.availability(candidate,f.root).available,false);
  }
  assert.equal(sends,0);assert.equal(resolves,0);
});
test('selected-file requests transfer exact memory-only verified bytes through only their curated transport',async t=>{
  const sent=[],resolved=[],f=await selectedFixture(t,{resolveAddress:async address=>{resolved.push(address);return '192.168.1.50';},sendBIN:async(address,bytes)=>{sent.push(['http',address,bytes]);return {status:'accepted',message:'Accepted bytes; check the console.'};},sendRawBIN:async(address,bytes)=>{sent.push(['tcp',address,bytes]);return {status:'sent',message:'Sent bytes; check the console.'};},sendELF:async()=>{throw Error('Must not use ELF');}});
  const before=fs.readdirSync(f.root,{recursive:true});
  const first=await(await f.upload()).json();assert.equal(first.status,'accepted');assert.equal(first.sha256,f.action.sha256);
  f.action.run={type:'bin-tcp',port:9020,input:'user-file'};
  const second=await(await f.upload()).json();assert.equal(second.status,'sent');
  assert.deepEqual(sent,[['http','192.168.1.50',f.bin],['tcp','192.168.1.50',f.bin]]);assert.deepEqual(resolved,['ps4.local','ps4.local']);
  assert.deepEqual(fs.readdirSync(f.root,{recursive:true}),before,'Selected bytes are never written into the sender folder');
  assert.deepEqual(fs.readFileSync(path.join(f.root,'downloads/fixture/menu.bin')),f.bin,'Existing local files remain unchanged');
});
test('selected-file header and compatibility failures are rejected before resolving or sending',async t=>{
  let resolves=0,sends=0;const f=await selectedFixture(t,{resolveAddress:async()=>{resolves++;return '192.168.1.50';},sendBIN:async()=>{sends++;}});
  for(const changes of [{actionId:'unknown'},{platform:'ps5'},{firmware:'13.52'},{gameVersion:'1.57'},{path:'C:/secret.bin'},{url:'http://evil/'},{port:9090},{address:['ps4.local']}]) {
    const r=await f.upload(f.bin,changes);assert.equal(r.status,400);assert.equal((await r.json()).mayHaveExecuted,undefined);
  }
  for(const headers of [{'X-Whatsite-Token':''},{Origin:'https://unrelated.example'},{Origin:''},{'Content-Type':'application/json'},{'Content-Encoding':'gzip'},{'X-Whatsite-Run':'{broken'},{'X-Whatsite-Run':'x'.repeat(4097)},{'X-Whatsite-Run':'[]'}]) {
    const r=await f.upload(f.bin,{},headers);assert.ok(r.status>=400&&r.status<500);assert.equal((await r.json()).mayHaveExecuted,undefined);
  }
  f.action.run=null;assert.equal((await(await f.upload()).json()).code,'unsupported-user-file');
  assert.equal(resolves,0);assert.equal(sends,0);
});
test('selected-file size, hash and ELF rejection happen before any console address resolution',async t=>{
  let resolves=0,sends=0;const f=await selectedFixture(t,{resolveAddress:async()=>{resolves++;return '192.168.1.50';},sendBIN:async()=>{sends++;}});
  for(const bytes of [Buffer.alloc(0),Buffer.from([1,2,3]),Buffer.from([1,2,3,4,5]),Buffer.from([5,6,7,8])]) {
    const out=await(await f.upload(bytes)).json();assert.ok(['selected-file-size','checksum-mismatch'].includes(out.code));assert.equal(out.mayHaveExecuted,undefined);
  }
  const elf=Buffer.from([0x7f,0x45,0x4c,0x46]);f.action.sha256=crypto.createHash('sha256').update(elf).digest('hex');
  assert.equal((await(await f.upload(elf)).json()).code,'invalid-bin');assert.equal(resolves,0);assert.equal(sends,0);
});
test('selected-file stream bound handles chunked overflow, truncation, abort and deadline without keeping bytes',async()=>{
  for(const mode of ['overflow','truncated','aborted','error','timeout']){
    const req=new EventEmitter();let resumed=0;req.resume=()=>{resumed++;};
    const pending=bridge.readSelectedBIN(req,4,5);
    if(mode==='overflow')req.emit('data',Buffer.alloc(5));
    else if(mode==='truncated'){req.emit('data',Buffer.alloc(3));req.emit('end');}
    else if(mode!=='timeout')req.emit(mode,Error('fixture'));
    await assert.rejects(()=>pending,error=>{assert.ok(error.code.startsWith('selected-file-'));assert.equal(error.mayHaveExecuted,undefined);return true;});
    if(mode==='aborted')assert.doesNotThrow(()=>req.emit('error',Error('late stream error')));
    assert.equal(resumed,1);assert.equal(req.listenerCount('data'),0);assert.equal(req.listenerCount('end'),0);
  }
  const req=new EventEmitter();req.resume=()=>{};const pending=bridge.readSelectedBIN(req,4);req.emit('data',Buffer.from([1,2]));req.emit('data',Buffer.from([3,4]));req.emit('end');assert.deepEqual(await pending,Buffer.from([1,2,3,4]));
  for(const size of [0,0x300001,1.5])await assert.rejects(()=>bridge.readSelectedBIN(req,size),{code:'invalid-user-file-pin'});
});
test('selected-file transfer uncertainty and busy locks preserve the existing no-retry contract',async t=>{
  let resolveFirst,sends=0;const f=await selectedFixture(t,{resolveAddress:async()=> '192.168.1.50',sendBIN:async()=>{sends++;if(sends===1)return new Promise(resolve=>{resolveFirst=resolve;});const error=Error('Lost acknowledgement');error.mayHaveExecuted=true;throw error;}});
  const first=f.upload();while(!resolveFirst)await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await(await f.upload()).json()).code,'console-busy');assert.equal(sends,1);
  resolveFirst({status:'accepted',message:'Bytes accepted; check console.'});assert.equal((await(await first).json()).status,'accepted');
  const uncertain=await(await f.upload()).json();assert.equal(uncertain.status,'uncertain');assert.equal(uncertain.mayHaveExecuted,true);assert.equal(uncertain.outcome,'unknown');assert.equal(sends,2);
});
