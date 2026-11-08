const test = require('node:test');
const assert = require('node:assert/strict');
const {webcrypto,createHash} = require('node:crypto');
const client = require('../../assets/host-console-client.js');
const origin = 'http://192.168.1.50:8084';
function response(body, status = 200) { return {ok:status >= 200 && status < 300,status,text:async()=>String(body),json:async()=>body,arrayBuffer:async()=>Uint8Array.from(body).buffer}; }

test('console address validation permits only private IPv4 and local hostname syntax', () => {
  for (const value of ['10.1.2.3','172.16.1.2','172.31.2.3','192.168.1.50','127.0.0.1','localhost','ps5','ps5.local']) assert.equal(client.normalizeAddress(value),value);
  assert.equal(client.normalizeAddress('  PS5.Local '),'ps5.local');
  for (const value of ['', 'http://192.168.1.50','192.168.1.50:8084','192.168.1.50/','foo@bar','example.com','999.1.1.1','8.8.8.8','172.32.1.2','192.168.1.255','192.168.1.0','file:','ps5.local?x','ps5.local.evil','-ps5','ps5-', '1.2.3']) assert.throws(()=>client.normalizeAddress(value),value);
});
test('service URLs preserve verified ports and direct manager capabilities require exact origin',()=>{
  assert.equal(client.serviceURL('ps5.local','manager'),'http://ps5.local:8084/');
  assert.equal(client.serviceURL('192.168.1.50','files'),'http://192.168.1.50:8080/fs/');
  assert.equal(client.serviceURL('192.168.1.50','ps4-files'),'http://192.168.1.50:8080/');
  assert.equal(client.capabilities('192.168.1.50',{origin}).canRunManager,true);
  for (const other of ['https://whatwhatboy.com','http://192.168.1.50:8080','http://192.168.1.50','http://192.168.1.50:8084.evil','null']) assert.equal(client.capabilities('192.168.1.50',{origin:other}).canRunManager,false);
  assert.throws(()=>client.serviceURL('ps5','shutdown'));
});
test('foreign-origin manager inspection and launch make no requests or fake success',async()=>{
  let calls = 0;
  const options = {origin:'https://whatwhatboy.com',fetch:async()=>{calls++; throw Error();}};
  assert.equal((await client.inspectManager('192.168.1.50',options)).status,'blocked');
  const out = await client.launchInstalled('192.168.1.50','/data/pldmgr/payloads/local/app.elf',options);
  assert.equal(out.status,'blocked'); assert.equal(calls,0);
});
test('manager inspection reports only the service-reported IP and leaves unknown IP unset',async()=>{
  const seen = [];
  const fetch = async(url,init)=>{seen.push([url,init]);return response(url.endsWith('/version')?'0.6.3':'192.168.1.50');};
  const out = await client.inspectManager('192.168.1.50',{origin,fetch});
  assert.equal(out.status,'connected'); assert.equal(out.version,'0.6.3'); assert.equal(out.reportedAddress,'192.168.1.50');
  assert.ok(seen.every(([,init])=>init.method === 'GET' && init.mode === 'same-origin'));
  assert.equal((await client.inspectManager('192.168.1.50',{origin,fetch:async(url)=>response(url.endsWith('/version')?'0.6.3':'0.0.0.0')})).reportedAddress,null);
  assert.equal((await client.inspectManager('192.168.1.50',{origin,fetch:async()=>response('<html>')})).status,'unavailable');
});
test('manager launch encodes an approved installed path and distinguishes transfer from execution',async()=>{
  const path = '/mnt/usb1/pldmgr/tools/ftpsrv-ps5.elf'; let call;
  const out = await client.launchInstalled('192.168.1.50',path,{origin,fetch:async(url,init)=>{call={url,init};return response('OK');}});
  assert.equal(call.url,origin+'/loadpayload:'+encodeURIComponent(path));
  assert.equal(call.init.method,'POST'); assert.deepEqual(call.init.headers,{'X-PLDMGR-Request':'1'});
  assert.equal(out.status,'accepted'); assert.match(out.message,/Check the console/); assert.doesNotMatch(out.message,/running|executed successfully/i);
  const unacknowledged=await client.launchInstalled('192.168.1.50',path,{origin,fetch:async()=>response('queued')});
  assert.equal(unacknowledged.status,'uncertain');assert.equal(unacknowledged.mayHaveExecuted,true);assert.equal(unacknowledged.outcome,'unknown');
  assert.equal((await client.launchInstalled('192.168.1.50',path,{origin,fetch:async()=>response('no',403)})).code,'http-403');
});
test('manager does not accept arbitrary paths, encoded traversal, BINs or self launch',()=>{
  for (const value of ['/data/foo.elf','/data/pldmgr/payloads/local/../secret.elf','/data/pldmgr/payloads/local/%2e%2e/secret.elf','/data/pldmgr/payloads/local/pldmgr_v0.6.3.elf','/mnt/usb8/pldmgr/a.elf','/mnt/usb0/pldmgr/a.bin','/mnt/usb0/pldmgr/a.elf?x','/mnt/usb0/pldmgr//a.elf']) assert.throws(()=>client.validatePayloadPath(value),value);
});
test('bridge requests require localhost origin and pairing, then send only an action ID and selected versions',async()=>{
  const bridgeURL = 'http://127.0.0.1:8766', token = 'a'.repeat(64); let calls = 0, captured;
  const fetch = async(url,init)=>{calls++;captured={url,init};return response({status:'sent',code:'elf-bytes-sent',message:'Bytes sent.'});};
  assert.equal((await client.inspectBridge(bridgeURL,token,{origin:'https://whatwhatboy.com',fetch})).status,'blocked');
  assert.equal(calls,0);
  const out = await client.runViaBridge('192.168.1.50','ps5-ftpsrv',token,'ps5',{bridgeURL,origin:bridgeURL,firmware:'9.00',fetch});
  assert.equal(out.status,'sent'); assert.equal(captured.url,bridgeURL+'/api/run');
  assert.deepEqual(JSON.parse(captured.init.body),{address:'192.168.1.50',actionId:'ps5-ftpsrv',platform:'ps5',firmware:'9.00',gameVersion:''});
  assert.equal(captured.init.headers['X-Whatsite-Token'],token);
  assert.equal((await client.inspectBridge(bridgeURL,'bad',{origin:bridgeURL,fetch})).code,'invalid-token');
  assert.throws(()=>client.bridgeOrigin('http://192.168.1.50:8766'));
  assert.throws(()=>client.bridgeOrigin('http://localhost:99999'));
  const error = await client.runViaBridge('192.168.1.50','ps5-ftpsrv',token,'ps5',{bridgeURL,origin:bridgeURL,fetch:async()=>response({status:'error',code:'checksum-mismatch',message:'Nothing sent.'},400)});
  assert.equal(error.code,'checksum-mismatch'); assert.equal(error.message,'Nothing sent.');
});

test('console inspection is an explicit paired read-only bridge request with no firmware guess',async()=>{
  const bridgeURL='http://127.0.0.1:8766',token='a'.repeat(64);let calls=0,captured;
  const fetch=async(url,init)=>{calls++;captured={url,init};return response({status:'connected',code:'manager-connected',message:'App responded.',service:'payload-manager',version:'0.6.3',reportedAddress:'192.168.1.50'});};
  const options={bridgeURL,token,origin:bridgeURL,fetch};
  assert.equal((await client.inspectConsole('192.168.1.50','ps5',{...options,origin:'https://whatwhatboy.com'})).status,'blocked');
  assert.equal((await client.inspectConsole('http://evil.example/','ps5',options)).status,'error');
  assert.equal((await client.inspectConsole('192.168.1.50','other',options)).code,'invalid-platform');
  assert.equal((await client.inspectConsole('192.168.1.50','ps5',{...options,token:''})).code,'invalid-token');
  assert.equal(calls,0);
  const out=await client.inspectConsole('192.168.1.50','ps5',options);
  assert.equal(captured.url,bridgeURL+'/api/inspect');assert.equal(captured.init.method,'POST');
  assert.deepEqual(JSON.parse(captured.init.body),{address:'192.168.1.50',platform:'ps5'});
  assert.equal(captured.init.headers['X-Whatsite-Token'],token);assert.equal(out.firmware,undefined);assert.equal(out.activeGame,undefined);assert.equal(out.version,'0.6.3');
});
test('GoldHEN sends verified BIN bytes only when HTTP readiness is explicit',async()=>{
  const bytes = Buffer.from([4,3,2,1]), sha256 = createHash('sha256').update(bytes).digest('hex');
  const action = {format:'BIN',downloadURL:'/downloads/fixture/menu.bin',sha256}, seen = [];
  const out = await client.sendGoldHEN('192.168.1.50',action,{origin:'http://127.0.0.1:8766',crypto:webcrypto,fetch:async(url,init)=>{
    seen.push([url,init]);
    return url.endsWith('/status')?response({status:'ready'}):url.startsWith('/downloads/')?response(bytes):response('OK');
  }});
  assert.equal(out.status,'accepted'); assert.equal(seen[0][1].method,'GET');
  assert.equal(seen[2][0],'http://192.168.1.50:9090/'); assert.equal(seen[2][1].method,'POST');
  assert.deepEqual(Buffer.from(seen[2][1].body),bytes);
  assert.equal(seen[2][1].headers,undefined); // The native API expects raw bytes, no invented framing.
});
test('GoldHEN busy, mixed-content and bad checksum never POST payload bytes, with or without WebCrypto',async()=>{
  const action = {format:'BIN',downloadURL:'/downloads/fixture/menu.bin',sha256:'0'.repeat(64)};
  let sent = 0;
  const fetch = async(url,init)=>{if(url.endsWith(':9090/'))sent++;return url.endsWith('/status')?response({status:'ready'}):response([1,2]);};
  assert.equal((await client.sendGoldHEN('192.168.1.50',action,{origin:'https://whatwhatboy.com',fetch})).code,'mixed-content');
  assert.equal((await client.sendGoldHEN('192.168.1.50',action,{origin:'http://host',crypto:{},fetch})).code,'checksum-mismatch');
  assert.equal((await client.sendGoldHEN('192.168.1.50',action,{origin:'http://host',crypto:webcrypto,fetch})).code,'checksum-mismatch');
  assert.equal((await client.inspectGoldHEN('127.0.0.1',{origin:'http://host',fetch:async(url,init)=>{assert.equal(init.method,'POST');return response({status:'busy'});}})).code,'loader-busy');
  assert.equal(sent,0);
});
test('offloaded payloads use only pinned repository URLs and keep BIN verification', async () => {
  const source = 'https://raw.githubusercontent.com/Speedy-away/whatsite/' + 'a'.repeat(40) + '/downloads/fixture/';
  const bytes = Buffer.from([9, 1, 4]);
  const action = {format:'BIN', downloadURL:source+'menu.bin', sha256:createHash('sha256').update(bytes).digest('hex')};
  const fetched = [];
  const options = {origin:'http://host', crypto:webcrypto, fetch:async (url, init) => {
    fetched.push([url, init]);
    if (url.endsWith('/status')) return response({status:'ready'});
    if (url === action.downloadURL) return response(bytes);
    return response('OK');
  }};
  assert.equal((await client.sendGoldHEN('192.168.1.50',action,options)).status,'accepted');
  assert.equal(fetched[1][0],action.downloadURL);
  assert.equal(fetched[1][1].mode,'cors');
  assert.deepEqual(Buffer.from(fetched[2][1].body),bytes);
  const elf = {...action, format:'ELF', downloadURL:source+'tool.elf'};
  const url = new URL(client.elfLaunchURL('127.0.0.1',elf,{origin:'https://speedy-away.github.io'}));
  assert.equal(url.searchParams.get('uri'),elf.downloadURL);
  assert.throws(() => client.elfLaunchURL('127.0.0.1',{...elf,downloadURL:elf.downloadURL.replace('a'.repeat(40),'main')}));
});
test('the SHA-256 console fallback matches standard hashes, padding boundaries and changed bytes',()=>{
  const inputs = [Buffer.alloc(0),Buffer.from('abc'),Buffer.from('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),Buffer.alloc(55,0x7e),Buffer.alloc(56,0x7e),Buffer.alloc(63,0x7e),Buffer.alloc(64,0x7e),Buffer.alloc(65,0x7e),Buffer.alloc(1000000,0x61)];
  for (const bytes of inputs) assert.equal(client.sha256(bytes),createHash('sha256').update(bytes).digest('hex'));
  assert.notEqual(client.sha256(Buffer.from([1,2,3])),client.sha256(Buffer.from([1,2,4])));
});
test('GoldHEN sends on an HTTP console browser using the SHA fallback when WebCrypto is absent',async()=>{
  const bytes = Buffer.from([4,3,2,1]), action = {format:'BIN',downloadURL:'/downloads/fixture/menu.bin',sha256:createHash('sha256').update(bytes).digest('hex')};
  let posts = 0;
  const out = await client.sendGoldHEN('127.0.0.1',action,{origin:'http://whatwhatboy.com',crypto:{},fetch:async(url,init)=>{
    if(url.endsWith('/status'))return response({status:'ready'});
    if(url.startsWith('/downloads/'))return response(bytes);
    posts++;return response('OK');
  }});
  assert.equal(out.status,'accepted');assert.equal(posts,1);
});
test('PS5 native HTTP ELF requests use the documented URI endpoint and report request acceptance only',async()=>{
  const action = {format:'ELF',downloadURL:'/downloads/fixture/app.elf',sha256:'a'.repeat(64)};
  const launchURL = client.elfLaunchURL('127.0.0.1',action,{origin:'http://192.168.1.2:8765'});
  assert.equal(launchURL,'http://127.0.0.1:9021/?uri='+encodeURIComponent('http://192.168.1.2:8765/downloads/fixture/app.elf'));
  let seen;
  const out = await client.sendPS5ELF('192.168.1.50',action,{origin:'http://whatwhatboy.com',fetch:async(url,init)=>{seen={url,init};return response('');}});
  assert.equal(seen.url,client.elfLaunchURL('192.168.1.50',action,{origin:'http://whatwhatboy.com'}));assert.equal(seen.init.method,'GET');assert.equal(seen.init.mode,'cors');assert.equal(seen.init.headers,undefined);
  assert.equal(out.status,'accepted');assert.equal(out.code,'elf-loader-requested');assert.match(out.message,/have not been verified/);
});
test('PS5 HTTPS native ELF requests return an explicit navigation fallback without making a request',async()=>{
  const action = {format:'ELF',downloadURL:'/downloads/fixture/app.elf',sha256:'a'.repeat(64)}; let calls = 0;
  const out = await client.sendPS5ELF('192.168.1.50',action,{origin:'https://whatwhatboy.com',fetch:async()=>{calls++;return response('');}});
  assert.equal(out.status,'blocked');assert.equal(out.code,'mixed-content');assert.equal(calls,0);assert.match(out.launchURL,/^http:\/\/192\.168\.1\.50:9021\//);
  for (const downloadURL of ['https://evil.test/app.elf','/downloads/../app.elf','/downloads/%2e%2e/app.elf','/downloads/%252e%252e/app.elf','/downloads/app.bin','/downloads/app.elf?args=x']) assert.throws(()=>client.elfLaunchURL('192.168.1.50',{...action,downloadURL},{origin:'http://192.168.1.2:8765'}));
  const failed = await client.sendPS5ELF('192.168.1.50',action,{origin:'http://whatwhatboy.com',fetch:async()=>{throw Error('CORS');}});
  assert.equal(failed.status,'uncertain');assert.equal(failed.code,'connection-failed');assert.equal(failed.mayHaveExecuted,true);
});
test('PS5 URL launching uses the actual LAN/public asset origin and refuses localhost previews',async()=>{
  const action = {format:'ELF',downloadURL:'/downloads/fixture/app.elf',sha256:'a'.repeat(64)};let calls = 0;
  for (const origin of ['http://127.0.0.1:8765','http://localhost:8765','http://preview.localhost:8765','http://0.0.0.0:8765','file:///C:/site/index.html','']) {
    const out = await client.sendPS5ELF('192.168.1.50',action,{origin,fetch:async()=>{calls++;return response('');}});
    assert.equal(out.status,'blocked',origin);assert.equal(out.code,'payload-origin-unreachable');assert.equal(out.launchURL,undefined);
  }
  assert.equal(calls,0);
  const explicit = client.elfLaunchURL('192.168.1.50',action,{origin:'http://127.0.0.1:8765',payloadOrigin:'http://192.168.1.2:8765'});
  assert.equal(new URL(explicit).searchParams.get('uri'),'http://192.168.1.2:8765/downloads/fixture/app.elf');
  const publicURL = client.elfLaunchURL('192.168.1.50',action,{origin:'https://staging.example.org'});
  assert.equal(new URL(publicURL).searchParams.get('uri'),'https://staging.example.org/downloads/fixture/app.elf');
  assert.throws(()=>client.elfLaunchURL('192.168.1.50',action,{payloadOrigin:'https://user:pass@example.com'}));
  assert.throws(()=>client.elfLaunchURL('192.168.1.50',action,{payloadOrigin:'https://example.com/another/path'}));
});
test('execution-request network errors and timeouts are uncertain, never successful or automatically retried',async()=>{
  const path = '/data/pldmgr/payloads/local/app.elf';
  let calls=0;
  const network=await client.launchInstalled('192.168.1.50',path,{origin,fetch:async()=>{calls++;throw Error('CORS');}});
  assert.equal(network.status,'uncertain');assert.equal(network.mayHaveExecuted,true);assert.equal(network.outcome,'unknown');assert.equal(calls,1);
  const timeout=await client.launchInstalled('192.168.1.50',path,{origin,timeoutMs:5,fetch:()=>{calls++;return new Promise(()=>{});}});
  assert.equal(timeout.status,'uncertain');assert.equal(timeout.code,'timeout');assert.equal(timeout.mayHaveExecuted,true);assert.equal(calls,2);
});

const selectedBytes=Uint8Array.from([1,2,3,4]);
function selectedSetup(){
  const bridgeURL='http://127.0.0.1:8766',token='a'.repeat(64),action={id:'selected-original',platform:'ps4',format:'BIN',bytes:4,sha256:createHash('sha256').update(selectedBytes).digest('hex'),firmwares:['9.00'],gameVersion:'1.38',downloadURL:'https://github.com/original/project/releases/download/pinned/original.bin',run:{type:'goldhen-http',port:9090,input:'user-file'}};
  const file={name:'original.bin',type:'application/octet-stream',size:4,arrayBuffer:async()=>selectedBytes.buffer.slice(0)};
  return{bridgeURL,token,action,file,options:{bridgeURL,origin:bridgeURL,firmware:'9.00',gameVersion:'1.38'}};
}
test('selected BIN client posts only exact checked bytes and fixed metadata to the paired same-origin sender',async()=>{
  const f=selectedSetup(),calls=[];
  const out=await client.runFileViaBridge('192.168.1.50',f.action,f.file,f.token,'ps4',{...f.options,crypto:{},fetch:async(url,init)=>{calls.push({url,init});return response({status:'accepted',message:'Bytes accepted; check console.'});}});
  assert.equal(out.status,'accepted');assert.equal(calls.length,1);
  const {url,init}=calls[0];assert.equal(url,f.bridgeURL+'/api/run-file');assert.equal(init.method,'POST');assert.equal(init.mode,'same-origin');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.deepEqual(init.body,selectedBytes);
  assert.deepEqual(JSON.parse(init.headers['X-Whatsite-Run']),{address:'192.168.1.50',actionId:f.action.id,platform:'ps4',firmware:'9.00',gameVersion:'1.38'});
  assert.equal(init.headers['Content-Type'],'application/octet-stream');assert.equal(init.headers['X-Whatsite-Token'],f.token);assert.ok(!JSON.stringify(init.headers).includes('original.bin'),'No selected name or filesystem path sent');
});
test('selected BIN identity uses checked bytes rather than browser MIME metadata',async()=>{
  const f=selectedSetup();
  for(const type of ['', 'application/octet-stream', 'application/macbinary', 'application/x-binary', 'application/zip']){
    let calls=0;
    const options={...f.options,fetch:async(url,init)=>{
      calls++;assert.equal(url,f.bridgeURL+'/api/run-file');assert.equal(init.headers['Content-Type'],'application/octet-stream');assert.deepEqual(init.body,selectedBytes);
      return response({status:'accepted',message:'Bytes accepted; check console.'});
    }};
    const accepted=await client.runFileViaBridge('192.168.1.50',f.action,{...f.file,type},f.token,'ps4',options);
    assert.equal(accepted.status,'accepted',type);assert.equal(calls,1,type);
    const changed=await client.runFileViaBridge('192.168.1.50',f.action,{...f.file,type,arrayBuffer:async()=>Uint8Array.from([4,3,2,1]).buffer},f.token,'ps4',options);
    assert.equal(changed.code,'checksum-mismatch',type);assert.equal(changed.mayHaveExecuted,undefined);assert.equal(calls,1,'Changed bytes never POST regardless of MIME metadata');
  }
});
test('selected BIN client rejects wrong action, pairing, origin, firmware and file declarations without reading or posting',async()=>{
  const f=selectedSetup();let reads=0,calls=0;
  const file={...f.file,arrayBuffer:async()=>{reads++;return selectedBytes.buffer;}};
  const fetch=async()=>{calls++;throw Error('Must not send');};
  const cases=[
    [f.action,file,f.token,'ps4',{...f.options,origin:'https://whatwhatboy.com'}],
    [f.action,file,'invalid','ps4',f.options],
    [{...f.action,platform:'ps5'},file,f.token,'ps5',f.options],
    [{...f.action,run:{type:'goldhen-http',port:9020,input:'user-file'}},file,f.token,'ps4',f.options],
    [{...f.action,run:{type:'elf-tcp',port:9021,input:'user-file'}},file,f.token,'ps4',f.options],
    [{...f.action,run:{type:'goldhen-http',port:9090}},file,f.token,'ps4',f.options],
    [{...f.action,sha256:'bad'},file,f.token,'ps4',f.options],
    [{...f.action,bytes:0x300001},file,f.token,'ps4',f.options],
    [{...f.action,firmwares:[]},file,f.token,'ps4',f.options],
    [f.action,file,f.token,'ps4',{...f.options,firmware:'13.52'}],
    [f.action,file,f.token,'ps4',{...f.options,gameVersion:'1.57'}],
    [f.action,{...file,size:3},f.token,'ps4',f.options],
    [f.action,{...file,name:'original.elf'},f.token,'ps4',f.options]
  ];
  for(const [action,selection,token,platform,options]of cases){const out=await client.runFileViaBridge('192.168.1.50',action,selection,token,platform,{...options,fetch});assert.ok(['error','blocked'].includes(out.status));assert.equal(out.mayHaveExecuted,undefined);}
  assert.equal(reads,0);assert.equal(calls,0);
});
test('selected BIN read, length, ELF and checksum failures finish before any execution request',async()=>{
  const f=selectedSetup();let calls=0;
  const options={...f.options,timeoutMs:5,fetch:async()=>{calls++;throw Error('Must not send');}};
  for(const arrayBuffer of [async()=>{throw Error('unreadable');},()=>new Promise(()=>{}),async()=>new Uint8Array([1,2,3]).buffer,async()=>new Uint8Array([4,3,2,1]).buffer,async()=>new Uint8Array([0x7f,0x45,0x4c,0x46]).buffer]){
    const out=await client.runFileViaBridge('192.168.1.50',f.action,{...f.file,arrayBuffer},f.token,'ps4',options);assert.equal(out.status,'error');assert.equal(out.mayHaveExecuted,undefined);
  }
  assert.equal(calls,0);
});
test('selected BIN acknowledgements distinguish known rejection from uncertain dispatch and never retry',async()=>{
  const f=selectedSetup();
  for(const mode of ['rejected','network','timeout','server-error','malformed','stalled-body']){
    let calls=0;const out=await client.runFileViaBridge('192.168.1.50',f.action,f.file,f.token,'ps4',{...f.options,timeoutMs:5,fetch:async()=>{
      calls++;
      if(mode==='network')throw Error('lost response');if(mode==='timeout')return new Promise(()=>{});
      if(mode==='server-error')return response('',500);if(mode==='malformed')return response({});
      if(mode==='stalled-body')return{ok:true,status:200,json:()=>new Promise(()=>{})};
      return response({status:'error',code:'checksum-mismatch',message:'Nothing was sent.'},400);
    }});
    assert.equal(calls,1);assert.equal(out.status,mode==='rejected'?'error':'uncertain',mode);assert.equal(out.mayHaveExecuted,mode==='rejected'?undefined:true,mode);
  }
});
test('selected BIN revalidates captured UI state after reading and hashing, before any dispatch',async()=>{
  const f=selectedSetup();let currentAddress='192.168.1.50',calls=0,checks=0;
  const changed={...f.file,arrayBuffer:async()=>{currentAddress='192.168.1.51';return selectedBytes.buffer.slice(0);}};
  const beforeDispatch=()=>{checks++;if(currentAddress!=='192.168.1.50')throw Error('Selection changed while reading.');};
  const options={...f.options,beforeDispatch,fetch:async()=>{calls++;return response({status:'sent',message:'Sent bytes; check console.'});}};
  const blocked=await client.runFileViaBridge('192.168.1.50',f.action,changed,f.token,'ps4',options);
  assert.equal(blocked.status,'error');assert.equal(blocked.code,'selected-file-state-changed');assert.equal(blocked.mayHaveExecuted,undefined);assert.equal(calls,0);assert.equal(checks,1);
  currentAddress='192.168.1.50';const sent=await client.runFileViaBridge(currentAddress,f.action,f.file,f.token,'ps4',options);
  assert.equal(sent.status,'sent');assert.equal(calls,1);assert.equal(checks,2);
  const badHash={...f.file,arrayBuffer:async()=>Uint8Array.from([4,3,2,1]).buffer};
  assert.equal((await client.runFileViaBridge(currentAddress,f.action,badHash,f.token,'ps4',options)).code,'checksum-mismatch');assert.equal(checks,2,'Checksum rejection happens before revalidation');assert.equal(calls,1);
  for(const beforeDispatch of [()=>false,()=>Promise.resolve(true),()=>{const error=Error('Old uncertain error object');error.mayHaveExecuted=true;throw error;}]){
    const out=await client.runFileViaBridge(currentAddress,f.action,f.file,f.token,'ps4',{...options,beforeDispatch});assert.equal(out.code,'selected-file-state-changed');assert.equal(out.mayHaveExecuted,undefined);
  }
  assert.equal(calls,1);
});
