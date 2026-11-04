const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm'),fs=require('node:fs');
const api=require('../../assets/host-native-workspace.js'),builder=require('../host-native-workspace.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
class Form {constructor(){this.parts=[];}append(...args){this.parts.push(args);}}
function fixture(platform='ps4',options={}){
  const files=new Map(),dirs=new Set(['/data','/data/payloads','/data/whatwhatboy','/data/GoldHEN','/data/pldmgr','/data/pldmgr/payloads','/data/pldmgr/payloads/local']),calls=[];
  const config=api.settings[platform].config,initial=platform==='ps4'?'; keep this comment\r\n[Other]\r\nunknown = 7\r\n[AutoRun]\r\n/user/data/payloads/first.bin = 1\r\n':'local/first\n!2500\nrepo/second\n';files.set(config,Buffer.from(initial));
  const parent=p=>p.slice(0,p.lastIndexOf('/')),name=p=>p.slice(p.lastIndexOf('/')+1),success=()=>JSON.stringify({result:{success:true,error:null}});
  async function transport(method,route,body,type,limit,changed){
    calls.push({method,route,body,type,limit,changed});if(options.before)options.before({method,route,body,type,files,dirs,calls});
    assert.ok(!/loadpayload|\/api\/run|\/remove|\/copy|\/install|download_url/.test(route),'No executing/removing/proxy route');
    if(route.startsWith('/__local__/downloadFile?')){assert.equal(method,'GET');const p=new URL(route,'http://console').searchParams.get('path');assert.ok(files.has(p));return Uint8Array.from(files.get(p));}
    const input=typeof body==='string'?JSON.parse(body):null;
    if(route==='/__local__/list'){assert.deepEqual(Object.keys(input).sort(),['onlyFolders','path']);assert.equal(input.onlyFolders,false);const items=[];for(const p of dirs)if(parent(p)===input.path)items.push({name:name(p),type:'dir',size:''});for(const[p,b]of files)if(parent(p)===input.path)items.push({name:name(p),type:'file',size:String(b.length)});return JSON.stringify({result:items});}
    if(route==='/__local__/getContent')return JSON.stringify({result:files.get(input.item).toString('utf8')});
    if(route==='/__local__/createFolder'){if(!options.ignoreCreate)dirs.add(input.newPath);return success();}
    if(route==='/__local__/rename'){if(!options.ignoreRename){assert.ok(files.has(input.item));files.set(input.newItemPath,files.get(input.item));files.delete(input.item);}return success();}
    if(route==='/__local__/edit'){files.set(input.item,Buffer.from(input.content));if(options.corruptStage)files.set(input.item,Buffer.from('corrupt'));return success();}
    if(route==='/__local__/upload'){assert.ok(body instanceof Form);assert.deepEqual(body.parts.map(p=>p[0]),['destination','_chunkSize','_chunkNumber','_totalSize','_currentChunkSize','file']);assert.equal(body.parts[2][1],'0');const p=body.parts[0][1]+'/'+body.parts[5][2],b=Buffer.from(await body.parts[5][1].arrayBuffer());files.set(p,options.corruptUpload?Buffer.from('corrupt'):b);return success();}
    throw Error('Unexpected route '+route);
  }
  const location={protocol:'http:',hostname:'192.168.1.50',port:api.settings[platform].port,pathname:api.settings[platform].installPath};
  const client=api.createClient({platform,location,transport,formDataFactory:()=>new Form(),Blob});
  return {client,files,dirs,calls,config,initial,location,transport};
}
test('helper construction and script opening never make a console request',()=>{
  let requests=0;const client=api.createClient({platform:'ps4',location:{protocol:'https:',hostname:'whatwhatboy.com'},transport:()=>{requests++;}});assert.equal(client.isNative,false);assert.equal(requests,0);
  const context={document:{getElementById:()=>null},XMLHttpRequest:function(){requests++;},window:null};context.window=context;vm.runInNewContext(fs.readFileSync(require.resolve('../../assets/host-native-workspace.js'),'utf8'),context);assert.equal(requests,0);
});
test('public previews and wrong ports cannot call even read APIs',async()=>{
  for(const location of [{protocol:'https:',hostname:'whatwhatboy.com',port:'',pathname:api.settings.ps4.installPath},{protocol:'http:',hostname:'192.168.1.50',port:'6701',pathname:api.settings.ps4.installPath},{protocol:'http:',hostname:'8.8.8.8',port:'8080',pathname:api.settings.ps4.installPath},{protocol:'http:',hostname:'192.168.1.50',port:'8080',pathname:'/hosts/ps4/files/'}]){
    let calls=0;const c=api.createClient({platform:'ps4',location,transport:()=>{calls++;}});await assert.rejects(()=>c.list('/data'),{code:'native-origin'});assert.equal(calls,0);
  }
});
test('path scope rejects traversal, encoded tricks, guessed mounts and writes outside managed roots',()=>{
  for(const path of ['/data/../system','/data/%2e%2e/system','/data//payloads','/data\\payloads','/system','/mnt/usb0/x','/data/a?b'])assert.throws(()=>api.readPath(path));
  assert.equal(api.readPath('/mnt/usb2/my.bin',['/mnt/usb2']),'/mnt/usb2/my.bin');assert.throws(()=>api.readPath('/mnt/usb2/my.bin',['/mnt/usb1']));
  assert.throws(()=>api.writePath('ps4','/data/GoldHEN/payloads.ini'));assert.equal(api.writePath('ps4','/data/GoldHEN/payloads.ini',true),'/data/GoldHEN/payloads.ini');assert.throws(()=>api.writePath('ps4','/data/GoldHEN/payloads.ini.whatsite-backup-x/other',true));assert.throws(()=>api.writePath('ps4','/data/pldmgr/autoload.txt',true));
});
test('HTTP-compatible SHA-256 and untouched text preservation match exact bytes',()=>{
  for(const size of [0,1,55,56,64,127,8192]){const b=crypto.randomBytes(size);assert.equal(api.sha256(b),hash(b));}
  const text='\ufeff; comment\r\n[Other]\nunknown = 9\r\n[AutoRun]\r\n/data/payloads/a.bin = 1\n';assert.equal(api.preserveLines(text,text.replace(/\r\n/g,'\n')),text);
  const changed=api.preserveLines(text,text.replace(/\r\n/g,'\n').replace('a.bin = 1','a.bin = 0'));assert.match(changed,/; comment\r\n\[Other\]\nunknown = 9\r\n/);assert.equal(changed.charCodeAt(0),0xfeff);
});
test('older console WebKit fallback works without native Promise, encoders or modern Number helpers',async()=>{
  const context={module:{exports:{}},Promise:undefined,TextEncoder:undefined,TextDecoder:undefined,setTimeout,clearTimeout,Uint8Array,Uint32Array,ArrayBuffer,Blob};
  vm.runInNewContext(fs.readFileSync(require.resolve('../../assets/host-native-workspace.js'),'utf8'),context);const legacy=context.module.exports,f=fixture('ps4'),client=legacy.createClient({platform:'ps4',location:f.location,transport:f.transport,formDataFactory:()=>new Form(),Blob});
  const snapshot=await client.readConfig();assert.equal(snapshot.text,f.initial);const changed=f.initial.replace('first.bin = 1','first.bin = 0'),saved=await client.saveConfig(snapshot,changed);assert.equal(f.files.get(saved.backupPath).toString(),f.initial);assert.equal(f.files.get(f.config).toString(),changed);assert.equal(legacy.decode(legacy.encode('payload · café')),'payload · café');
});
test('actual list and bounded file reads expose native files without an execution route',async()=>{
  const f=fixture();f.files.set('/data/payloads/test.bin',Buffer.from([1,2,3]));assert.equal(f.calls.length,0);const list=await f.client.list('/data/payloads');assert.equal(list[0].name,'test.bin');const b=await f.client.readBinary('/data/payloads/test.bin');assert.deepEqual([...b],[1,2,3]);assert.ok(f.calls.every(x=>x.changed===false));
  f.files.set('/data/payloads/huge.bin',Buffer.alloc(65537));const count=f.calls.length;await assert.rejects(()=>f.client.getContent('/data/payloads/huge.bin'),{code:'text-limit'});assert.equal(f.calls.slice(count).filter(x=>x.route==='/__local__/getContent').length,0);
});
test('uploads use the exact ordered multipart contract and verify saved bytes without overwriting',async()=>{
  const f=fixture();await f.client.list('/data/payloads');const b=Buffer.from([1,2,3]);const result=await f.client.uploadPayload('/data/payloads','test.bin',b);assert.equal(result.sha256,hash(b));assert.deepEqual(f.files.get(result.path),b);const before=f.calls.filter(x=>x.changed).length;
  await assert.rejects(()=>f.client.uploadPayload('/data/payloads','test.bin',b),{code:'already-exists'});assert.equal(f.calls.filter(x=>x.changed).length,before);assert.throws(()=>f.client.uploadPayload('/data/payloads','source.zip',b),{code:'payload-format'});assert.throws(()=>f.client.uploadPayload('/data/payloads','fake.elf',b),{code:'payload-format'});
  const bad=fixture('ps4',{corruptUpload:true});await bad.client.list('/data/payloads');await assert.rejects(()=>bad.client.uploadPayload('/data/payloads','test.bin',b),e=>e.code==='verify-failed'&&e.mayHaveChanged===true);assert.equal(bad.calls.filter(x=>x.route==='/__local__/upload').length,1);
});
test('create and rename verify postconditions instead of trusting unconditional native success',async()=>{
  const f=fixture();await f.client.list('/data/payloads');await f.client.createFolder('/data/payloads/new');assert.ok(f.dirs.has('/data/payloads/new'));f.files.set('/data/payloads/old.bin',Buffer.from('bytes'));const renamed=await f.client.renameFile('/data/payloads/old.bin','new.bin');assert.equal(renamed.sha256,hash(Buffer.from('bytes')));assert.equal(f.files.has('/data/payloads/old.bin'),false);
  for(const[option,action]of [['ignoreCreate',c=>c.createFolder('/data/payloads/new')],['ignoreRename',c=>c.renameFile('/data/payloads/old.bin','new.bin')]]){const bad=fixture('ps4',{[option]:true});bad.files.set('/data/payloads/old.bin',Buffer.from('bytes'));await bad.client.list('/data/payloads');await assert.rejects(()=>action(bad.client),e=>e.code==='verify-failed'&&e.mayHaveChanged===true);}
});
test('each native autoload save retains a verified original-byte backup and preserves unknown entries',async()=>{
  for(const platform of ['ps4','ps5']){const f=fixture(platform),snapshot=await f.client.readConfig();assert.equal(snapshot.text,f.initial);const edited=f.initial.replace(platform==='ps4'?'first.bin = 1':'local/first',platform==='ps4'?'first.bin = 0':'local/changed');const out=await f.client.saveConfig(snapshot,edited);assert.equal(out.status,'saved');assert.deepEqual(f.files.get(out.backupPath),Buffer.from(f.initial));assert.equal(f.files.get(f.config).toString(),edited);assert.equal(out.sha256,hash(Buffer.from(edited)));assert.equal(f.calls.filter(x=>x.route==='/__local__/upload').length,1);assert.equal(f.calls.filter(x=>x.route==='/__local__/edit').length,1);assert.equal(f.calls.filter(x=>x.route==='/__local__/rename').length,1);assert.ok(out.backupPath.startsWith(f.config+'.whatsite-backup-'));assert.equal(f.files.has(f.config+'.bak'),false);}
});
test('an unchanged raw editor causes no write, including browser-normalized newlines',async()=>{
  const f=fixture(),snapshot=await f.client.readConfig(),before=f.calls.length;const out=await f.client.saveConfig(snapshot,snapshot.text.replace(/\r\n/g,'\n'));assert.equal(out.status,'unchanged');assert.equal(f.calls.length,before);
});
test('empty autoload files receive real zero-byte backups and clearing uses a closed multipart stage',async()=>{
  const empty=fixture('ps5');empty.files.set(empty.config,Buffer.alloc(0));const snapshot=await empty.client.readConfig();assert.equal(snapshot.bytes,0);
  const saved=await empty.client.saveConfig(snapshot,'local/new\n');assert.equal(empty.files.get(saved.backupPath).length,0);assert.equal(empty.files.get(empty.config).toString(),'local/new\n');
  const clear=fixture('ps5'),original=await clear.client.readConfig();const result=await clear.client.saveConfig(original,'');assert.equal(clear.files.get(result.backupPath).toString(),clear.initial);assert.equal(clear.files.get(clear.config).length,0);assert.equal(result.sha256,hash(Buffer.alloc(0)));assert.equal(clear.calls.filter(x=>x.route==='/__local__/edit').length,0);assert.equal(clear.calls.filter(x=>x.route==='/__local__/upload').length,2);
});
test('a concurrent native edit blocks replacement before and after the verified backup',async()=>{
  const before=fixture(),snapshot=await before.client.readConfig();before.files.set(before.config,Buffer.from('other native edit'));await assert.rejects(()=>before.client.saveConfig(snapshot,'new file'),{code:'file-changed'});assert.equal(before.calls.filter(x=>x.changed).length,0);
  const after=fixture('ps4',{before:({route,files})=>{if(route==='/__local__/edit')files.set('/data/GoldHEN/payloads.ini',Buffer.from('changed during stage'));}}),old=await after.client.readConfig();await assert.rejects(()=>after.client.saveConfig(old,'new file'),e=>e.code==='file-changed'&&e.mayHaveChanged===true);assert.equal(after.calls.filter(x=>x.route==='/__local__/rename').length,0);assert.equal(after.files.get(after.config).toString(),'changed during stage');assert.ok([...after.files.keys()].some(x=>x.includes('.whatsite-backup-')));assert.ok([...after.files.keys()].some(x=>x.includes('.whatsite-stage-')));
});
test('bad backup or staging bytes prevent replacement; retained originals are never removed',async()=>{
  for(const option of ['corruptUpload','corruptStage']){const f=fixture('ps4',{[option]:true}),snapshot=await f.client.readConfig();await assert.rejects(()=>f.client.saveConfig(snapshot,'new content'),e=>e.mayHaveChanged===true);assert.equal(f.files.get(f.config).toString(),f.initial);assert.equal(f.calls.filter(x=>x.route==='/__local__/rename').length,0);assert.equal(f.calls.filter(x=>x.route==='/__local__/upload').length,1);}
});
test('standalone artifacts contain authored assets, native boundaries and only prepared archive jobs',()=>{
  const report=builder.prepare({write:false});assert.equal(report.artifacts.length,2);assert.equal(report.jobs.length,2);
  for(const a of report.artifacts){const html=builder.render(a.platform);assert.equal(Buffer.byteLength(html),a.bytes);assert.equal(hash(Buffer.from(html)),a.sha256);assert.match(a.local,/\/downloads\/helpers\/host-native-workspace\/ps[45]\/[a-f0-9]{16}\//);assert.match(a.expectedArchivePath,/Helpers/);assert.equal(a.archiveStatus,'prepared-not-archived');assert.ok(html.includes('connect-src &#39;self&#39;')||html.includes("connect-src 'self'"));assert.ok(!/<script[^>]+src=|<link[^>]+stylesheet/.test(html));assert.ok(!/fetch\(|XMLHttpRequest\(.*?:902[01]|Origin['"]\s*:/.test(html));}
  assert.equal(report.retainedArtifacts.length,report.retainedArchiveJobs.length);
  for(const old of report.retainedArtifacts){const content=fs.readFileSync(require('node:path').resolve(__dirname,'../..','.'+old.local)),job=report.retainedArchiveJobs.find(j=>j.expectedSha256===old.sha256);assert.equal(content.length,old.bytes);assert.equal(hash(content),old.sha256);assert.ok(job);assert.equal(job.expectedBytes,old.bytes);assert.ok(job.release.includes(old.sha256.slice(0,16)));assert.ok(!report.artifacts.some(a=>a.local===old.local));}
});
