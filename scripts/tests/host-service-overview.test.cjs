const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectConsoleServices}=require('../console-payload-bridge.cjs');
const address='192.168.1.50';
function fetcherFor(receiver,other){
  return async(url,init)=>{
    const parsed=new URL(url);
    assert.equal(parsed.hostname,address);
    assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');
    assert.equal(init.body,undefined);assert.equal(init.headers,undefined);
    assert.ok(![9020,9021].includes(Number(parsed.port)),'No potentially executing TCP/ELF probe');
    if(parsed.port==='6701')return receiver(url,init);
    if(other)return other(url,init);
    return new Response(parsed.pathname==='/version'?'0.6.3':parsed.pathname==='/getip'?address:parsed.pathname==='/status'?'{"status":"ready"}':'<html><title>File manager</title></html>',{headers:{'content-type':parsed.pathname==='/'||parsed.pathname==='/fs/'?'text/html':'text/plain'}});
  };
}
const receiverCheck=result=>result.checks.find(check=>check.service==='downloader');

test('overview returns queue count only and keeps native file-manager probes independent of core availability',async()=>{
  const seen=[];
  const fetcher=fetcherFor(async url=>{seen.push(url);return new Response(JSON.stringify([{path:'/data/private-name.pkg',status:'active'},{path:'/mnt/usb0/another-name.elf'}]));},async url=>{seen.push(url);return url.includes(':8084/')?new Response('Blocked',{status:403}):new Response('<html><title>Native page</title></html>',{headers:{'content-type':'text/html'}});});
  const result=await inspectConsoleServices(address,'ps5',{fetcher});
  assert.equal(result.status,'unavailable','Legacy top-level manager semantics retained');
  assert.equal(result.checks[0].status,'blocked');
  const queue=receiverCheck(result);assert.equal(queue.status,'connected');assert.equal(queue.queueCount,2);assert.equal(queue.companionVerified,false);
  assert.deepEqual(Object.keys(queue).sort(),['code','companionVerified','message','path','port','queueCount','service','status'].sort());
  assert.equal(result.checks.find(check=>check.service==='files').status,'connected');
  assert.equal(result.checks.find(check=>check.service==='ezremote').status,'connected');
  assert.equal(result.checks.find(check=>check.service==='files').identityVerified,false);
  assert.ok(seen.includes('http://'+address+':8080/fs/'));assert.ok(seen.includes('http://'+address+':9090/'));
  assert.doesNotMatch(JSON.stringify(result),/private-name|another-name|\/mnt\/usb0|\/data\//);
  assert.equal(result.firmware,undefined);assert.equal(result.activeGame,undefined);
});

test('receiver count requires the bounded native array shape rather than HTTP200 alone',async()=>{
  for(const body of ['{}','null','<html>login</html>','[null]','[{}]','[[{"path":"/secret"}]]','[{"path":"relative"}]','[{"path":"/bad\\u0000name"}]']){
    const result=await inspectConsoleServices(address,'ps4',{fetcher:fetcherFor(async()=>new Response(body))});
    const queue=receiverCheck(result);assert.equal(queue.status,'unknown',body);assert.equal(queue.queueCount,undefined);assert.equal(queue.code,'unexpected-response');
  }
  const result=await inspectConsoleServices(address,'ps4',{fetcher:fetcherFor(async()=>new Response('[]'))});
  assert.equal(receiverCheck(result).queueCount,0);
  assert.deepEqual(result.checks.map(check=>check.service),['goldhen','downloader','ps4-files']);
});

test('receiver responses cannot exceed64KiB or rely on an unbounded text fallback',async()=>{
  const exact='[]'+' '.repeat(65534);
  const accepted=await inspectConsoleServices(address,'ps5',{fetcher:fetcherFor(async()=>new Response(exact))});
  assert.equal(receiverCheck(accepted).status,'connected');
  const oversized=await inspectConsoleServices(address,'ps5',{fetcher:fetcherFor(async()=>new Response(exact+' '))});
  assert.equal(receiverCheck(oversized).status,'unknown');assert.equal(receiverCheck(oversized).queueCount,undefined);
  let read=0,cancelled=0;
  const declared=await inspectConsoleServices(address,'ps5',{fetcher:fetcherFor(async()=>({ok:true,status:200,headers:new Headers({'content-length':'65537'}),body:{cancel(){cancelled++;}},text:async()=>{read++;return '[]';}}))});
  assert.equal(receiverCheck(declared).status,'unknown');assert.equal(read,0);assert.equal(cancelled,1);
  const unbounded=await inspectConsoleServices(address,'ps5',{fetcher:fetcherFor(async()=>({ok:true,status:200,text:async()=>{read++;return '[]';}}))});
  assert.equal(receiverCheck(unbounded).status,'unknown');assert.equal(read,0,'Unknown-length non-streaming bodies are never buffered');
});

test('stalled metadata bodies time out and do not infer that the console is absent',async()=>{
  let cancellations=0;
  const result=await inspectConsoleServices(address,'ps4',{timeoutMs:5,fetcher:fetcherFor(async()=>({ok:true,status:200,headers:new Headers(),body:{getReader(){return {read:()=>new Promise(()=>{}),cancel(){cancellations++;},releaseLock(){}};}}}))});
  const queue=receiverCheck(result);assert.equal(queue.status,'unknown');assert.equal(queue.code,'service-timeout');assert.equal(cancellations,1);
  assert.match(queue.message,/availability is unknown/);assert.equal(result.status,'connected');
});

test('blocked and missing endpoints stay distinct from unverified network failures',async()=>{
  for(const [failure,expected] of [[()=>new Response('Denied',{status:403}),'blocked'],[()=>new Response('Missing',{status:404}),'unavailable'],[()=>{throw Error('network policy');},'unknown']]){
    const result=await inspectConsoleServices(address,'ps5',{fetcher:fetcherFor(async()=>failure())});
    assert.equal(receiverCheck(result).status,expected);
    assert.doesNotMatch(receiverCheck(result).message,/console (?:is absent|does not exist)|device (?:is absent|does not exist)/i);
  }
});

test('file-manager checks accept only bounded HTML responses and expose no directory contents',async()=>{
  const result=await inspectConsoleServices(address,'ps5',{fetcher:fetcherFor(async()=>new Response('[]'),async url=>url.includes(':8080/')?new Response('{"files":["private.pkg"]}',{headers:{'content-type':'application/json'}}):url.includes(':9090/')?new Response('<html><body>private.pkg</body></html>',{headers:{'content-type':'text/html'}}):new Response(url.endsWith('/version')?'0.6.3':address))});
  assert.equal(result.checks.find(check=>check.service==='files').status,'unknown');
  assert.equal(result.checks.find(check=>check.service==='ezremote').status,'connected');
  assert.doesNotMatch(JSON.stringify(result),/private\.pkg/);
});
