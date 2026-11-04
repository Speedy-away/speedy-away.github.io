const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createHash}=require('node:crypto');
const bridge=require('../console-payload-bridge.cjs');
const client=require('../../assets/host-console-client.js');
const address='192.168.1.50';
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body,text:async()=>String(body),arrayBuffer:async()=>Uint8Array.from(body).buffer});
const bin=Buffer.from([1,2,3]),action={format:'BIN',downloadURL:'/downloads/fixture/menu.bin',sha256:createHash('sha256').update(bin).digest('hex')};

test('raw ELF failures distinguish connection refusal from bytes already offered, without reconnecting',async()=>{
  for(const started of [false,true]){
    let connects=0,writes=0;
    const socket=new EventEmitter();socket.destroy=()=>{};socket.end=()=>{writes++;queueMicrotask(()=>socket.emit('error',Error('reset')));};
    await assert.rejects(()=>bridge.sendRawELF(address,bin,{connect:()=>{connects++;queueMicrotask(()=>socket.emit(started?'connect':'error',Error('refused')));return socket;}}),error=>{assert.equal(error.mayHaveExecuted,started?true:undefined);if(started){assert.equal(error.outcome,'unknown');assert.match(error.message,/Check the console before trying again/);}return true;});
    assert.equal(connects,1);assert.equal(writes,started?1:0);
  }
  const socket=new EventEmitter();socket.destroy=()=>{};socket.end=()=>{};
  await assert.rejects(()=>bridge.sendRawELF(address,bin,{timeoutMs:5,connect:()=>{queueMicrotask(()=>socket.emit('connect'));return socket;}}),error=>error.code==='loader-timeout'&&error.mayHaveExecuted===true);
});

test('GoldHEN bridge never retries an ambiguous POST and keeps preflight failures non-executing',async()=>{
  for(const postResponse of [()=>{throw Error('lost response');},()=>new Promise(()=>{}),()=>response('',500),()=>response('',202)]){
    const seen=[];
    await assert.rejects(()=>bridge.sendGoldHENHTTP(address,bin,{timeoutMs:5,fetcher:async(url,init)=>{seen.push(init.method);return init.method==='GET'?response({status:'ready'}):postResponse();}}),error=>error.mayHaveExecuted===true&&error.outcome==='unknown');
    assert.deepEqual(seen,['GET','POST']);
  }
  let calls=0;
  await assert.rejects(()=>bridge.sendGoldHENHTTP(address,bin,{timeoutMs:5,fetcher:()=>{calls++;return new Promise(()=>{});}}),error=>error.code==='loader-timeout'&&!error.mayHaveExecuted);
  assert.equal(calls,1);
  let preflightCalls=0;
  await assert.rejects(()=>bridge.sendGoldHENHTTP(address,bin,{timeoutMs:5,fetcher:async()=>{preflightCalls++;return {ok:true,status:200,json:()=>new Promise(()=>{})};}}),error=>error.code==='loader-timeout'&&!error.mayHaveExecuted);
  assert.equal(preflightCalls,1,'Stalled readiness never proceeds to POST');
  await assert.rejects(()=>bridge.sendGoldHENHTTP(address,bin,{fetcher:async(url,init)=>init.method==='GET'?response({status:'ready'}):response('',403)}),error=>error.code==='loader-http-403'&&!error.mayHaveExecuted);
});

test('browser GoldHEN distinguishes preflight rejection from a lost execution response',async()=>{
  for(const mode of ['network','timeout','server-error','unreadable']){
    const seen=[];
    const result=await client.sendGoldHEN(address,action,{origin:'http://host',timeoutMs:5,fetch:async(url,init)=>{
      seen.push([url,init.method]);
      if(url.endsWith('/status'))return response({status:'ready'});
      if(url.startsWith('/downloads/'))return response(bin);
      if(mode==='network')throw Error('CORS response blocked');
      if(mode==='timeout')return new Promise(()=>{});
      if(mode==='server-error')return response('',500);
      return {type:'opaque'};
    }});
    assert.equal(result.status,'uncertain',mode);assert.equal(result.mayHaveExecuted,true);assert.equal(result.outcome,'unknown');
    assert.equal(seen.filter(([,method])=>method==='POST').length,1);assert.match(result.message,/Check the console before trying again/);
  }
  const preflight=await client.sendGoldHEN(address,action,{origin:'http://host',timeoutMs:5,fetch:()=>new Promise(()=>{})});
  assert.equal(preflight.status,'error');assert.equal(preflight.mayHaveExecuted,undefined);
  const rejected=await client.sendGoldHEN(address,action,{origin:'http://host',fetch:async(url)=>url.endsWith('/status')?response({status:'ready'}):url.startsWith('/downloads/')?response(bin):response('',403)});
  assert.equal(rejected.status,'error');assert.equal(rejected.code,'http-403');assert.equal(rejected.mayHaveExecuted,undefined);
});

test('ELF URL requests and paired run requests report uncertain after dispatch but inspection never does',async()=>{
  const elf={format:'ELF',downloadURL:'/downloads/fixture/app.elf',sha256:'a'.repeat(64)};
  let calls=0;
  const result=await client.sendPS5ELF(address,elf,{origin:'http://host',timeoutMs:5,fetch:()=>{calls++;return new Promise(()=>{});}});
  assert.equal(result.status,'uncertain');assert.equal(result.mayHaveExecuted,true);assert.equal(calls,1);
  const bridgeURL='http://127.0.0.1:8766',token='a'.repeat(64),options={bridgeURL,origin:bridgeURL,timeoutMs:5,fetch:()=>{calls++;return new Promise(()=>{});}};
  const run=await client.runViaBridge(address,'fixture',token,'ps5',options);
  assert.equal(run.status,'uncertain');assert.equal(run.outcome,'unknown');assert.equal(calls,2);
  const inspect=await client.inspectConsole(address,'ps5',{...options,token});
  assert.equal(inspect.status,'error');assert.equal(inspect.mayHaveExecuted,undefined);assert.equal(calls,3);
  const serverResult=await client.runViaBridge(address,'fixture',token,'ps5',{...options,fetch:async()=>response({status:'uncertain',code:'loader-timeout',message:'Check console.',mayHaveExecuted:true,outcome:'unknown'})});
  assert.equal(serverResult.status,'uncertain');assert.equal(serverResult.mayHaveExecuted,true);
});

test('paired run server errors cannot acknowledge that an execution request was harmless',async()=>{
  const bridgeURL='http://127.0.0.1:8766',token='a'.repeat(64),knownError={status:'error',code:'checksum-mismatch',message:'Nothing sent.'};
  const unreadable=status=>({ok:status>=200&&status<300,status,json:async()=>{throw new SyntaxError('HTML response');}});
  for(const received of [response(knownError,500),response({...knownError,mayHaveExecuted:false},503),unreadable(502),response({},0),unreadable(200)]){
    let calls=0;
    const result=await client.runViaBridge(address,'fixture',token,'ps5',{bridgeURL,origin:bridgeURL,fetch:async()=>{calls++;return received;}});
    assert.equal(result.status,'uncertain');assert.equal(result.mayHaveExecuted,true);assert.equal(result.outcome,'unknown');
    assert.match(result.message,/Check the console before trying again/);assert.equal(calls,1);
  }
  for(const received of [response(knownError,200),response(knownError,400),unreadable(403)]){
    let calls=0;
    const result=await client.runViaBridge(address,'fixture',token,'ps5',{bridgeURL,origin:bridgeURL,fetch:async()=>{calls++;return received;}});
    assert.equal(result.status,'error');assert.equal(result.mayHaveExecuted,undefined);assert.equal(calls,1);
  }
});

test('an acknowledgement body cannot leave a sent action pending forever',async()=>{
  const path='/data/pldmgr/payloads/local/app.elf';let calls=0;
  const manager=await client.launchInstalled(address,path,{origin:'http://'+address+':8084',timeoutMs:5,fetch:async()=>{calls++;return {ok:true,status:200,text:()=>new Promise(()=>{})};}});
  assert.equal(manager.status,'uncertain');assert.equal(manager.code,'timeout');assert.equal(manager.mayHaveExecuted,true);assert.equal(calls,1);
  const bridgeURL='http://127.0.0.1:8766',token='a'.repeat(64);
  const bridgeResult=await client.runViaBridge(address,'fixture',token,'ps5',{bridgeURL,origin:bridgeURL,timeoutMs:5,fetch:async()=>{calls++;return {ok:true,status:200,json:()=>new Promise(()=>{})};}});
  assert.equal(bridgeResult.status,'uncertain');assert.equal(bridgeResult.code,'timeout');assert.equal(calls,2);
  const preflight=await client.sendGoldHEN(address,action,{origin:'http://host',timeoutMs:5,fetch:async()=>({ok:true,status:200,json:()=>new Promise(()=>{})})});
  assert.equal(preflight.status,'error');assert.equal(preflight.code,'timeout');assert.equal(preflight.mayHaveExecuted,undefined);
});

test('a stalled local BIN body times out before an execution request is sent',async()=>{
  const seen=[];let cancellations=0;
  const result=await client.sendGoldHEN(address,action,{origin:'http://host',timeoutMs:5,fetch:async(url,init)=>{
    seen.push([url,init.method]);
    if(url.endsWith('/status'))return response({status:'ready'});
    assert.equal(url,action.downloadURL);
    return {ok:true,status:200,arrayBuffer:()=>new Promise(()=>{}),body:{cancel:async()=>{cancellations++;}}};
  }});
  assert.equal(result.status,'error');assert.equal(result.code,'timeout');assert.equal(result.mayHaveExecuted,undefined);
  assert.equal(cancellations,1);assert.deepEqual(seen,[['http://'+address+':9090/status','GET'],[action.downloadURL,'GET']]);
});
