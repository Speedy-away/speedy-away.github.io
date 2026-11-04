'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const api=require('../../assets/host-package-installer.js');
function store(){const map=new Map();return{map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
function fixture(platform='ps4',extra={}){
  const calls=[],storage=extra.storage||store(),items=[{name:'app.pkg',type:'file',size:'4096',date:'2026-11-03T00:00:00',rights:'rw'}];
  const location={protocol:'http:',hostname:'192.168.1.40',port:api.settings[platform].port,pathname:api.settings[platform].installPath};
  const transport=async(method,route,body,limit,timeout,mutation)=>{calls.push({method,route,body,limit,timeout,mutation});if(extra.before)await extra.before({calls,items,route,body,storage});if(route==='/__local__/list')return JSON.stringify({result:items});if(route==='/__local__/install'){if(extra.install) return extra.install(calls);return JSON.stringify({result:{success:true,error:null}});}throw Error('Unexpected route '+route);};
  const client=api.createClient(platform,{location,storage,transport});return{client,calls,storage,items,location};
}
test('construction and public previews never issue a native request',async()=>{
  for(const platform of ['ps4','ps5']){const f=fixture(platform);assert.equal(f.calls.length,0);assert.equal(f.client.isNative,true);const previews=[{...f.location,port:'8765'},{...f.location,protocol:'https:'},{...f.location,hostname:'example.com'},{...f.location,pathname:'/downloads/tool.html'}];for(const location of previews){const client=api.createClient(platform,{location,storage:store(),transport:()=>{throw Error('No network');}});assert.equal(client.isNative,false);await assert.rejects(()=>client.verify('/data/whatwhatboy/app.pkg','4096'),{code:'native-origin'});}}
});
test('only bounded absolute data or exact USB mount PKGs and whole-byte expectations are accepted',()=>{
  assert.equal(api.packagePath('/data/whatwhatboy/My  homebrew.pkg'),'/data/whatwhatboy/My  homebrew.pkg');
  for(const p of ['/mnt/usb0/whatwhatboy/app.pkg','/mnt/usb9/app.pkg'])assert.equal(api.packagePath(p),p);
  for(const p of ['/system/app.pkg','/data/../system/app.pkg','/data//app.pkg','/data/./app.pkg','/data/%2e%2e/app.pkg','/data/a.pkg?x','/data/a.pkg#x','/data/a.rar','/data/a.elf','/data/a.pkg\n','/data\\a.pkg','https://site/app.pkg','/data/'+ 'x'.repeat(510)+'.pkg','/DATA/app.pkg','/mnt/USB0/app.pkg','/mnt/usb/app.pkg','/mnt/usb10/app.pkg','/mnt/usb0/../app.pkg','/mnt/usb0//app.pkg','/mnt/usb0x/app.pkg','/mnt/ext0/app.pkg','/mnt/usb0/app.pkg?x','/user/data/app.pkg'])assert.throws(()=>api.packagePath(p),{code:'package-path'},p);
  for(const bytes of ['-1','4096.5','4e3','+4096','9007199254740992',0,3,[4096],{valueOf:()=>4096},true])assert.throws(()=>api.expectedSize(bytes),{code:'expected-size'});
  assert.equal(api.expectedSize('4096'),4096);assert.equal(api.expectedSize(''),null);
});

test('USB verification uses the exact existing parent and never establishes mount identity or writability',async()=>{
  for(const platform of ['ps4','ps5']){const f=fixture(platform),s=await f.client.verify('/mnt/usb1/whatwhatboy/app.pkg',4096);assert.equal(s.path,'/mnt/usb1/whatwhatboy/app.pkg');assert.deepEqual(f.calls[0].body,{path:'/mnt/usb1/whatwhatboy',onlyFolders:false});assert.equal(s.mounted,undefined);assert.equal(s.writable,undefined);const out=await f.client.install(s,true);assert.equal(out.installed,false);assert.deepEqual(f.calls[2].body,{items:['/mnt/usb1/whatwhatboy/app.pkg']});}
});
test('verification reads one exact parent, rejects absent, partial and mismatched files without installation',async()=>{
  const f=fixture(),s=await f.client.verify('/data/whatwhatboy/app.pkg','4096');assert.equal(s.bytes,4096);assert.deepEqual(f.calls[0].body,{path:'/data/whatwhatboy',onlyFolders:false});assert.equal(f.calls[0].route,'/__local__/list');assert.equal(f.calls[0].mutation,false);
  await assert.rejects(()=>f.client.verify('/data/whatwhatboy/missing.pkg'),{code:'package-missing'});
  await assert.rejects(()=>f.client.verify('/data/whatwhatboy/app.pkg','8192'),{code:'package-size-mismatch'});
  f.items[0].size=[4096];await assert.rejects(()=>f.client.verify('/data/whatwhatboy/app.pkg','4096'),{code:'package-size'});f.items[0].size='4096';
  f.items.push({name:'app.pkg.tmp',type:'file',size:'20'});await assert.rejects(()=>f.client.verify('/data/whatwhatboy/app.pkg','4096'),{code:'partial-file'});assert.ok(f.calls.every(c=>c.route==='/__local__/list'));
});
test('installation requires the actual unchanged verification object and explicit consent',async()=>{
  const f=fixture(),s=await f.client.verify('/data/whatwhatboy/app.pkg',4096);await assert.rejects(()=>f.client.install(s,false),{code:'confirmation-required'});await assert.rejects(()=>f.client.install({...s},true),{code:'verify-first'});s.path='/system/unsafe.pkg';await assert.rejects(()=>f.client.install(s,true),{code:'verify-first'});assert.equal(f.calls.length,1);assert.equal(f.storage.map.size,0);
});
test('metadata changes are caught in the fresh read before any install write or guard',async()=>{
  for(const field of ['size','date','rights']){const f=fixture(),s=await f.client.verify('/data/whatwhatboy/app.pkg');f.items[0][field]=field==='size'?'8192':'changed';await assert.rejects(()=>f.client.install(s,true),{code:'package-changed'});assert.equal(f.calls.filter(c=>c.mutation).length,0);assert.equal(f.storage.map.size,0);}
});
test('one explicit exact install request keeps a durable guard and never claims completed installation',async()=>{
  for(const platform of ['ps4','ps5']){const f=fixture(platform),s=await f.client.verify('/data/whatwhatboy/app.pkg',4096),out=await f.client.install(s,true);assert.equal(out.status,'native-reported-success');assert.equal(out.installed,false);assert.equal(out.guardRetained,true);assert.equal(f.calls.length,3);assert.deepEqual(f.calls[2].body,{items:['/data/whatwhatboy/app.pkg']});assert.equal(f.calls[2].route,'/__local__/install');assert.equal(f.calls[2].mutation,true);assert.ok(f.storage.map.size);await assert.rejects(()=>f.client.install(s,true),{code:'request-guard'});assert.throws(()=>f.client.clearGuard(false),{code:'confirmation-required'});const before=f.calls.length;f.client.clearGuard(true);assert.equal(f.calls.length,before);assert.equal(f.client.guard(),null);assert.equal(f.storage.map.size,0);}
});
test('unknown and negative native results are retained across reloads without automatic retry',async()=>{
  for(const install of [()=>Promise.reject(Error('lost response')),()=>JSON.stringify({result:{success:false,error:'Native failure'}}),()=>'{broken',()=>JSON.stringify({result:{success:'true'}}),()=>JSON.stringify({result:{success:true,error:'Contradictory error'}})]){
    const f=fixture('ps4',{install}),s=await f.client.verify('/data/whatwhatboy/app.pkg');await assert.rejects(()=>f.client.install(s,true),e=>e.mayHaveChanged===true);assert.equal(f.client.isBusy(),false);assert.equal(f.client.guard().state,'unknown');assert.equal(f.calls.filter(c=>c.mutation).length,1);
    const next=api.createClient('ps4',{location:f.location,storage:f.storage,transport:()=>{throw Error('No replay');}});assert.ok(next.guard());await assert.rejects(()=>next.install(s,true),{code:'request-guard'});assert.equal(f.calls.filter(c=>c.mutation).length,1);
  }
});
test('overlapping operations and a guard written by another window cannot send a second install',async()=>{
  let finish;const f=fixture('ps4',{install:()=>new Promise(resolve=>{finish=resolve;})}),s=await f.client.verify('/data/whatwhatboy/app.pkg');const pending=f.client.install(s,true);await assert.rejects(()=>f.client.verify('/data/whatwhatboy/app.pkg'),{code:'busy'});await assert.rejects(()=>f.client.install(s,true),{code:'busy'});await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.filter(c=>c.mutation).length,1);finish(JSON.stringify({result:{success:true}}));await pending;
  const g=fixture(),t=await g.client.verify('/data/whatwhatboy/app.pkg');g.storage.setItem('whatsite.pkg-install.ps4.192.168.1.40:8080',JSON.stringify({path:'/data/other.pkg',state:'dispatched'}));await assert.rejects(()=>g.client.install(t,true),{code:'request-guard'});assert.equal(g.calls.filter(c=>c.mutation).length,0);
});
test('a storage failure stops dispatch and the older-WebKit fallback retains native guards',async()=>{
  const f=fixture();f.storage.setItem=()=>{throw Error('Full');};const s=await f.client.verify('/data/whatwhatboy/app.pkg');await assert.rejects(()=>f.client.install(s,true),{code:'request-guard-unavailable'});assert.equal(f.calls.filter(c=>c.mutation).length,0);
  const source=fs.readFileSync(path.join(__dirname,'../../assets/host-package-installer.js'),'utf8'),sandbox={window:{setTimeout,Promise:undefined},module:{exports:{}}};vm.runInNewContext(source,sandbox);const old=sandbox.module.exports;assert.equal(old.packagePath('/data/app.pkg'),'/data/app.pkg');await assert.rejects(()=>old.createClient('ps4',{location:{protocol:'http:',hostname:'example.com',port:'8080',pathname:old.settings.ps4.installPath},storage:store()}).verify('/data/app.pkg'),{code:'native-origin'});
});
test('rendering native and public pages only preselects a path, leaving install disabled and making no requests',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../assets/host-package-installer.js'),'utf8');
  for(const platform of ['ps4','ps5'])for(const native of [true,false]){
    const ids={},nodes=[];function element(){const node={textContent:'',value:'',disabled:false,hidden:false,checked:false,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}};nodes.push(node);return node;}
    const el=element();el.getAttribute=key=>key==='data-platform'?platform:null;
    Object.defineProperty(el,'innerHTML',{set(html){for(const match of html.matchAll(/\bid="([^"]+)"/g))ids[match[1]]=element();}});
    const doc={querySelector:s=>s==='#package-installer'?el:null,getElementById:id=>ids[id]};
    const window={setTimeout,Promise,localStorage:store(),location:{protocol:'http:',hostname:'192.168.1.40',port:native?api.settings[platform].port:'8765',pathname:native?api.settings[platform].installPath:'/downloads/helper.html',search:'?path=%2Fdata%2Fwhatwhatboy%2Ftwo%20%20spaces.pkg&bytes=4096'},XMLHttpRequest:function(){throw Error('Rendering must not make a request.');}};
    const sandbox={window,module:{exports:{}}};vm.runInNewContext(source,sandbox);sandbox.module.exports.mount(doc);
    assert.equal(ids['pkg-path'].value,'/data/whatwhatboy/two  spaces.pkg');assert.equal(ids['pkg-size'].value,'4096');assert.equal(ids['pkg-confirm'].checked,false);assert.equal(ids['pkg-install'].disabled,true);assert.equal(ids['pkg-verify'].disabled,!native);assert.equal(ids['pkg-guard'].hidden,true);
  }
});
test('prepared immutable helpers contain exact authored bytes, native guards and archive jobs without external scripts',()=>{
  const builder=require('../prepare-host-package-installer.cjs'),report=builder.prepare({write:false});assert.equal(report.artifacts.length,2);assert.equal(report.jobs.length,2);
  for(const a of report.artifacts){const html=builder.render(a.platform),bytes=Buffer.from(html);assert.equal(bytes.length,a.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256);assert.match(html,/connect-src 'self'/);assert.ok(!/<script[^>]+src=|<link[^>]+stylesheet/.test(html));assert.match(a.local,/\/downloads\/helpers\/host-package-installer\/ps[45]\/[a-f0-9]{16}\//);assert.equal(a.archiveStatus,'prepared-not-archived');assert.match(a.expectedArchivePath,/Helpers/);const job=report.jobs.find(j=>j.expectedSha256===a.sha256);assert.ok(job);assert.equal(job.expectedBytes,a.bytes);assert.equal(job.mirror,false);assert.deepEqual(job.archiveRole,['Helpers']);}
  for(const old of report.retainedArtifacts){const bytes=fs.readFileSync(path.join(__dirname,'../..','.'+old.local));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),old.sha256);assert.ok(report.retainedArchiveJobs.some(j=>j.expectedSha256===old.sha256));}
});

test('generated helpers embed only exact local language keys and keep the full-width Back taskbar free of external runtime resources',()=>{
  const builder=require('../prepare-host-package-installer.cjs'),dictionary=builder.nativeDictionaries();assert.equal(Object.keys(dictionary).length,20);
  for(const row of Object.values(dictionary))assert.deepEqual(Object.keys(row).sort(),api.keys.slice().sort());
  for(const platform of ['ps4','ps5']){const html=builder.render(platform),assignment=html.match(/window\.WhatsiteWorkspaceDictionaries=(\{[^\n]+\});\n/);assert.ok(assignment);assert.deepEqual(JSON.parse(assignment[1]),dictionary);assert.match(html,/href="https:\/\/whatwhatboy\.com\/hosts\/">Back<\/a>/);assert.match(html,/main\{width:calc\(100% - 48px\);max-width:none/);assert.doesNotMatch(html,/<img\b|<iframe\b|<script[^>]+src=|adsbygoogle|advertisement/i);assert.match(html,/data-native-i18n-skip/);}
});

test('the installer translation pack covers every new UI key in all 20 languages without changing placeholders or paths',()=>{
  const table=require('../../i18n-tools/host-package-installer-translations.cjs'),adapter=require('../../assets/host-native-workspace-i18n.js'),codes=Object.keys(adapter.languages).filter(c=>c!=='en'),shared=['Language','Back','{platform} host','Choose PS4 or PS5.'];
  assert.equal(Object.keys(table).length,api.keys.length-shared.length);assert.equal(codes.length,20);
  const tokens=s=>(s.match(/\{\w+\}/g)||[]).sort();
  for(const key of api.keys.filter(k=>!shared.includes(k))){assert.ok(table[key],key);assert.deepEqual(Object.keys(table[key]).sort(),codes.slice().sort());for(const code of codes){assert.ok(table[key][code].trim(),code+' '+key);assert.notEqual(table[key][code],key,code+' untranslated '+key);assert.deepEqual(tokens(table[key][code]),tokens(key));}}
  for(const code of codes){const dict=Object.fromEntries(Object.entries(table).map(([k,row])=>[k,row[code]])),translate=adapter.createLookup({[code]:dict},code),path='/mnt/usb1/whatwhatboy/My  homebrew.pkg',url='http://192.168.1.40:8080/data/whatsite-package-installer-ps4.html';
    const preview=translate('Read-only preview. Copy this file to '+path+' and open '+url+' through the running ezRemote Client.');assert.ok(preview.includes(path));assert.ok(preview.includes(url));assert.doesNotMatch(preview,/\{path\}|\{url\}/);
    const http=translate('The native service returned HTTP 503.');assert.ok(http.includes('503'));assert.doesNotMatch(http,/\{status\}/);
    const result=translate('Installation request result unknown. Check the console before clearing the request guard. The native request lost its connection.');assert.ok(result.includes(dict['The native request lost its connection.']));
    const native=translate('Installation request result unknown. Check the console before clearing the request guard. Native error: 0x80990088');assert.ok(native.includes('Native error: 0x80990088'));
  }
});
