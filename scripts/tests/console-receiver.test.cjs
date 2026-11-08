const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const api = require('../../assets/console-receiver.js');
const {renderCompanion} = require('../console-download-companion.cjs');
const receiver = {protocol:'http:', hostname:'127.0.0.1', port:'6701'};
const file = {id:'homebrew', name:'Example app', filename:'app.pkg', url:'/downloads/archive/example/app.pkg', bytes:1234, category:'apps', version:'1.0', compatibility:'Prepared console'};
function transport(responses) {
  const requests = [];
  function factory() {
    return {
      open(method,url) { this.method=method; this.url=url; },
      setRequestHeader(name,value) { (this.headers ||= {})[name]=value; },
      send(body) { const response=responses.shift(); assert.ok(response, 'Unexpected request'); requests.push({method:this.method,url:this.url,body,headers:this.headers}); this.status=response.status;this.responseText=response.text||'';this.response=response.binary;this.readyState=4;this.onreadystatechange(); }
    };
  }
  return {factory, requests};
}
test('only private or loopback HTTP receivers on port 6701 can write', () => {
  for (const hostname of ['127.0.0.1','127.12.3.4','10.1.2.3','172.16.0.1','172.31.255.2','192.168.1.40','169.254.1.2','localhost','[::1]','fd12:3456::1','fe80::1']) assert.equal(api.receiverOrigin({...receiver,hostname}),true,hostname);
  for (const location of [{...receiver,protocol:'https:'},{...receiver,port:'8080'},{...receiver,hostname:'whatwhatboy.com'},{...receiver,hostname:'127.0.0.1.evil.example'},{...receiver,hostname:'172.32.0.1'},{...receiver,hostname:'192.168.1.999'},{...receiver,hostname:'0.0.0.0'}]) assert.equal(api.receiverOrigin(location),false,JSON.stringify(location));
});
test('requests use the exact platform-specific FILEHOST enum and complete destination filename', () => {
  const ps4=api.makeRequest('ps4',file,'/data/homebrew',123);
  assert.deepEqual(ps4,{type:7,url:'https://whatwhatboy.com',username:'',password:'',http_server_type:'',src_path:'/downloads/archive/example/app.pkg',dest_path:'/data/homebrew/app.pkg',size:1234,id:123});
  const ps5=api.makeRequest('PS5',{...file,url:'https://github.com/example/repo/releases/download/v1/app.elf?raw=1#ignored',filename:'app.elf'},'/mnt/ext0/Apps',124);
  assert.equal(ps5.type,6); assert.equal(ps5.url,'https://github.com');assert.equal(ps5.src_path,'/example/repo/releases/download/v1/app.elf?raw=1'); assert.equal(ps5.dest_path,'/mnt/ext0/Apps/app.elf');
});
test('destination validation excludes system paths, traversal and encoded or ambiguous path segments', () => {
  for (const folder of ['/system','/user','/database','/data/../system','/data/%2e%2e/system','/data\\..\\system','/mnt/usb0/../../system','/data/a//b','relative/data','/mnt/ext0']) assert.throws(()=>api.safeFolder('ps4',folder),undefined,folder);
  for (const folder of ['/data','/data/My Apps','/mnt/usb0','/mnt/usb1/Homebrew']) assert.equal(api.safeFolder('ps4',folder),folder);
  assert.equal(api.safeFolder('ps5','/mnt/ext0/downloads'),'/mnt/ext0/downloads');
  assert.equal(api.safeFilename('../../folder/../payload.bin'),'payload.bin');
  assert.equal(api.safeFilename('..%2f..%2fdata.bin').includes('/'),false);
  assert.throws(()=>api.safeFilename('..'));
});
test('only usable HTTP(S) sources without credentials enter requests', () => {
  for (const url of ['javascript:alert(1)','data:application/octet-stream,a','ftp://example.org/file.pkg','https://user:secret@example.org/file.pkg','//example.org/file.pkg','https://example.org\\evil/file.pkg']) assert.throws(()=>api.makeRequest('ps4',{...file,url},'/data',1),undefined,url);
  assert.equal(api.parseUrl('downloads/app.pkg').url,'https://whatwhatboy.com/downloads/app.pkg');
});
test('an empty 200 acknowledges submission, never completion; explicit rejection remains failure', () => {
  assert.deepEqual(api.submission(''),{accepted:true,complete:false});
  assert.deepEqual(api.submission('{"result":{"success":true}}'),{accepted:true,complete:false});
  assert.throws(()=>api.submission('{"result":{"success":false,"error":"Disk unavailable"}}'),/Disk unavailable/);
  assert.throws(()=>api.submission('<html>Error</html>'));
  assert.throws(()=>api.submission('{"unexpected":true}'));
});
test('100% transferred does not become complete until receiver state 4; failures stay failed', () => {
  for (const state of [0,1,2,3]) assert.equal(api.progress({state,bytes_transfered:100,file_size:100}).complete,false);
  assert.equal(api.progress({state:3,bytes_transfered:100,file_size:100}).phase,'failed');
  assert.equal(api.progress({state:4,bytes_transfered:100,file_size:100}).label,'Receiver reports complete');
  assert.equal(api.progress({state:4,bytes_transfered:100,file_size:100}).complete,true);
  assert.equal(api.progress({state:99,bytes_transfered:100,file_size:100}).complete,false);
});
test('public preview client sends no receiver requests', () => {
  let calls=0;const client=api.createClient({protocol:'https:',hostname:'whatwhatboy.com',port:''},()=>{calls++;});
  client.queue(api.makeRequest('ps4',file,'/data',1),error=>assert.match(error.message,/console receiver/));
  client.states(error=>assert.ok(error));assert.equal(calls,0);
});
test('PS4 checks real filesystem paths for destination and partial file before a caller queues', () => {
  const mock=transport([{status:404},{status:404},{status:200}]);const client=api.createClient(receiver,mock.factory);const body=api.makeRequest('ps4',file,'/data',1);
  client.checkDestination('ps4','/data','app.pkg',error=>{assert.equal(error,null);client.queue(body,(queueError,result)=>{assert.equal(queueError,null);assert.equal(result.complete,false);});});
  assert.deepEqual(mock.requests.map(r=>[r.method,r.url]),[['HEAD','/data/app.pkg'],['HEAD','/data/app.pkg.tmp'],['POST','/download_url']]);
  assert.deepEqual(JSON.parse(mock.requests[2].body),body);
  const existing=transport([{status:200}]);api.createClient(receiver,existing.factory).checkDestination('ps4','/data','app.pkg',error=>assert.match(error.message,/already exists/));assert.equal(existing.requests.length,1);
});
test('PS5 checks websrv filesystem listing rather than HEAD against its assets mount', () => {
  const mock=transport([{status:200,text:'[{"name":"ext0","mode":"m"}]'},{status:200,text:'[{"name":".","mode":"d"},{"name":"other.elf","mode":"-"}]'}]);
  let destinationError;api.createClient(receiver,mock.factory).checkDestination('ps5','/mnt/ext0/My Apps','app.pkg',error=>{destinationError=error;});assert.equal(destinationError,null);
  assert.deepEqual(mock.requests.map(r=>r.url),['http://127.0.0.1:8080/fs/mnt/?fmt=json','http://127.0.0.1:8080/fs/mnt/ext0/My%20Apps/?fmt=json']);
  const collision=transport([{status:200,text:'[{"name":".","mode":"d"},{"name":"app.pkg.tmp","mode":"-"}]'}]);api.createClient(receiver,collision.factory).checkDestination('ps5','/data','app.pkg',error=>assert.match(error.message,/partial download/));
  const unavailable=transport([{status:404}]);api.createClient(receiver,unavailable.factory).checkDestination('ps5','/data','app.pkg',error=>assert.match(error.message,/Start PS5 websrv/));
});
test('PS5 discovery uses websrv mount evidence, not numbered folder guesses or USB-port labels', () => {
  const entries = [{name:'.',mode:'d'},{name:'usb0',mode:'d'},{name:'usb1',mode:'m'},{name:'ext0',mode:'m'},{name:'usb1',mode:'m'},{name:'usb2',mode:'-'},{name:'usb3/../../data',mode:'m'},{name:'system',mode:'m'}];
  assert.deepEqual(api.mountedStorage(entries), [{path:'/mnt/ext0',kind:'External mount'},{path:'/mnt/usb1',kind:'USB file storage'}]);
  assert.throws(()=>api.mountedStorage({usb0:true}), /folder listing/);
  const mock=transport([{status:200,text:JSON.stringify(entries)}]);
  api.createClient(receiver,mock.factory).detectStorage('ps5',(error,mounts)=>{assert.equal(error,null);assert.equal(mounts.length,2);});
  assert.deepEqual(mock.requests.map(r=>[r.method,r.url]),[['GET','http://127.0.0.1:8080/fs/mnt/?fmt=json']]);
  assert.equal(mock.requests.some(r=>r.method==='POST'),false);
  const unsupported=transport([]);
  api.createClient(receiver,unsupported.factory).detectStorage('ps4',error=>assert.match(error.message,/no storage-enumeration API/));
  assert.equal(unsupported.requests.length,0);
  const unavailable=transport([{status:404}]);api.createClient(receiver,unavailable.factory).detectStorage('ps5',error=>assert.match(error.message,/websrv on port 8080/));
});
test('filesystem browser links preserve the console host and encode the selected validated path', () => {
  assert.equal(api.filesystemURL(receiver,'/mnt/usb1/My Apps',false),'http://127.0.0.1:8080/fs/mnt/usb1/My%20Apps/');
  assert.equal(api.filesystemURL({...receiver,hostname:'::1'},'/data',true),'http://[::1]:8080/fs/data/?fmt=json');
});
test('polling is a read and unknown/invalid responses never report completion', () => {
  const mock=transport([{status:200,text:'[{"path":"/data/app.pkg","state":1,"file_size":1234,"bytes_transfered":1234}]'}]);
  api.createClient(receiver,mock.factory).states((error,states)=>{assert.equal(error,null);assert.equal(api.progress(states[0]).complete,false);});assert.equal(mock.requests[0].method,'GET');assert.equal(mock.requests[0].url,'/get_download_state');
});
test('companion is standalone and safely embeds untrusted metadata', () => {
  const hostile={...file,name:'</script><script>alert(1)</script>',description:'<img src=x onerror=alert(1)>'};
  const html=renderCompanion('ps4',[hostile]);
  assert.match(html,/noindex,nofollow/);assert.doesNotMatch(html,/<script\b[^>]+src=/i);assert.doesNotMatch(html,/<link[^>]+stylesheet/i);
  const json=html.match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1];assert.equal(JSON.parse(json).items[0].name,hostile.name);assert.equal(json.includes('<'),false);
  new vm.Script(fs.readFileSync(require.resolve('../../assets/console-receiver.js'),'utf8'));
  assert.match(html,/http:\/\/127\.0\.0\.1:6701\/data\/whatsite-ps4\.html/);assert.match(renderCompanion('ps5',[]),/http:\/\/127\.0\.0\.1:6701\/whatsite-ps5\.html/);
  assert.match(html,/id="receiver-folder-confirmed"/);assert.doesNotMatch(html,/<option[^>]*value="\/mnt\/(?:usb|ext)\d+"/);
  assert.match(renderCompanion('ps5',[]),/id="receiver-detect"/);assert.match(renderCompanion('ps5',[]),/id="receiver-browse"/);
});
test('loading or preselecting a file only reads status; Save click is required before any POST', () => {
  const created=[];
  function element(tag) {
    const node={tagName:tag.toUpperCase(),children:[],value:'',className:'',textContent:'',disabled:false,appendChild(child){this.children.push(child);return child;},removeChild(child){this.children.splice(this.children.indexOf(child),1);},setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];},focus(){}};
    Object.defineProperty(node,'firstChild',{get(){return this.children[0];}});created.push(node);return node;
  }
  const ids={};for(const id of ['receiver-catalog','receiver-files','receiver-search','receiver-category','receiver-folder','receiver-storage','receiver-message','receiver-check','receiver-setup','receiver-count','receiver-folder-confirmed'])ids[id]=element('div');
  ids['receiver-catalog'].textContent=JSON.stringify({platform:'ps4',items:[file]});ids['receiver-folder'].value='/data';
  const document={readyState:'complete',getElementById(id){return ids[id];},createElement:element,createTextNode(value){return {textContent:value};},addEventListener(){},querySelectorAll(){return[];}};
  const mock=transport([{status:200,text:'[]'},{status:200,text:'[]'},{status:404},{status:404},{status:200}]);
  const window={location:{...receiver,search:'?file=homebrew'},XMLHttpRequest:function(){return mock.factory();},setTimeout(){return 1;},clearTimeout(){},addEventListener(){}};
  api.install(document,window);
  assert.deepEqual(mock.requests.map(r=>r.method),['GET']);assert.equal(ids['receiver-search'].value,'Example app');
  const save=created.find(n=>n.className==='receiver-save');assert.ok(save);save.onclick();
  assert.deepEqual(mock.requests.map(r=>r.method),['GET']);assert.match(ids['receiver-message'].textContent,/Confirm this existing save folder/);
  ids['receiver-folder-confirmed'].checked=true;save.onclick();
  assert.deepEqual(mock.requests.map(r=>r.method),['GET','GET','HEAD','HEAD','POST']);
  assert.match(ids['receiver-message'].textContent,/submission does not mean the file is saved/);
  ids['receiver-folder-confirmed'].checked=true;ids['receiver-folder'].value='/mnt/usb1';ids['receiver-folder'].oninput();
  assert.equal(ids['receiver-folder-confirmed'].checked,false);
});
test('Detect mounted storage populates only current mounts without changing the folder or queuing files', () => {
  function element(tag) {
    const node={tagName:tag.toUpperCase(),children:[],value:'',className:'',textContent:'',disabled:false,appendChild(child){this.children.push(child);return child;},removeChild(child){this.children.splice(this.children.indexOf(child),1);},setAttribute(name,value){this[name]=value;},focus(){}};
    Object.defineProperty(node,'firstChild',{get(){return this.children[0];}});return node;
  }
  const ids={};for(const id of ['receiver-catalog','receiver-files','receiver-search','receiver-category','receiver-folder','receiver-storage','receiver-message','receiver-check','receiver-setup','receiver-count','receiver-detect','receiver-storage-status','receiver-browse'])ids[id]=element('div');
  ids['receiver-catalog'].textContent=JSON.stringify({platform:'ps5',items:[file]});ids['receiver-folder'].value='/data';
  const document={readyState:'complete',getElementById(id){return ids[id];},createElement:element,createTextNode(value){return {textContent:value};},addEventListener(){},querySelectorAll(){return[];}};
  const mock=transport([{status:200,text:'[]'},{status:200,text:'[{"name":"usb0","mode":"d"},{"name":"usb1","mode":"m"}]'},{status:404}]);
  const window={location:{...receiver,search:''},XMLHttpRequest:function(){return mock.factory();},setTimeout(){return 1;},clearTimeout(){},addEventListener(){}};
  api.install(document,window);
  ids['receiver-detect'].onclick();
  assert.deepEqual(ids['receiver-storage'].children.map(option=>option.value),['/data/whatwhatboy','/mnt/usb1/whatwhatboy','']);
  assert.equal(ids['receiver-folder'].value,'/data');assert.equal(ids['receiver-browse'].href,'http://127.0.0.1:8080/fs/data/');
  assert.match(ids['receiver-storage-status'].textContent,/1 mounted device path detected/);
  assert.deepEqual(mock.requests.map(r=>r.method),['GET','GET']);
  ids['receiver-detect'].onclick();
  assert.deepEqual(ids['receiver-storage'].children.map(option=>option.value),['/data/whatwhatboy','']);
  assert.match(ids['receiver-storage-status'].textContent,/save folder has not changed/);
  assert.equal(ids['receiver-folder'].value,'/data');assert.deepEqual(mock.requests.map(r=>r.method),['GET','GET','GET']);
});
