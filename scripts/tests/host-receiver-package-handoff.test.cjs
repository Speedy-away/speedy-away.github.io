'use strict';
// Authored receiver DOM and native helper contracts only. All requests below are
// in-memory fixtures; no socket, console, download, install or filesystem write.
const test=require('node:test'),assert=require('node:assert/strict');
const receiver=require('../../assets/console-receiver.js'),native=require('../../assets/host-package-installer.js');
const local={protocol:'http:',hostname:'192.168.1.40',port:'6701'};

function fixture(platform='ps4',{filename='app.pkg',folder='/data/whatwhatboy',location=local,bytes=4096,reviewed=false}={}){
  const created=[],requests=[],timers=[],ids={};let records=[],queued=null;
  function element(tag){
    const node={tagName:tag.toUpperCase(),children:[],value:'',className:'',disabled:false,hidden:false,checked:false,appendChild(child){this.children.push(child);return child;},removeChild(child){this.children.splice(this.children.indexOf(child),1);},setAttribute(key,value){this[key]=value;},removeAttribute(key){delete this[key];},focus(){}};
    Object.defineProperty(node,'firstChild',{get(){return this.children[0];}});
    Object.defineProperty(node,'textContent',{get(){return this.children.map(c=>c.textContent||'').join('');},set(value){this.children=[{textContent:String(value)}];}});
    created.push(node);return node;
  }
  for(const id of ['receiver-catalog','receiver-files','receiver-search','receiver-category','receiver-format','receiver-folder','receiver-storage','receiver-message','receiver-check','receiver-setup','receiver-count','receiver-folder-confirmed','receiver-connection','receiver-queue','receiver-folder-status'])ids[id]=element('div');
  const item={id:'fixture-app',name:'Fixture app',filename,url:'https://example.invalid/'+filename,bytes,category:'apps',platforms:[platform]};
  if(reviewed){
    item.sha256='a'.repeat(64);
    item.archiveSafety={reviewed:true,noLinks:true,relativePaths:true,noDevices:true,noAlternateStreams:true,noEncryptedEntries:true,sha256:item.sha256,bytes,entryCount:1,expandedBytes:bytes};
  }
  ids['receiver-catalog'].textContent=JSON.stringify({platform,items:[item]});ids['receiver-folder'].value=folder;ids['receiver-format'].value='all';
  const document={readyState:'complete',getElementById:id=>ids[id]||null,createElement:element,createTextNode:text=>({textContent:String(text)}),addEventListener(){},querySelectorAll(){return[];}};
  function XHR(){this.open=(method,url)=>{this.method=method;this.url=url;};this.setRequestHeader=()=>{};this.send=body=>{
    requests.push({method:this.method,url:this.url,body:body&&JSON.parse(body)});this.status=200;
    if(this.method==='GET'&&this.url==='/get_download_state')this.responseText=JSON.stringify(records);
    else if(this.method==='HEAD'){this.status=404;this.responseText='';}
    else if(this.method==='GET'&&this.url.includes('/fs/mnt/?fmt=json'))this.responseText=JSON.stringify([{name:'usb1',mode:'m'},{name:'ext0',mode:'m'}]);
    else if(this.method==='GET'&&this.url.includes('/fs/'))this.responseText=JSON.stringify([{name:'.',mode:'d'}]);
    else if(this.method==='POST'&&this.url==='/download_url'){queued=JSON.parse(body);this.responseText='';}
    else throw Error('Unexpected inert request: '+this.method+' '+this.url);
    this.readyState=4;this.onreadystatechange();
  };}
  const window={location:{...location,search:''},XMLHttpRequest:XHR,setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},addEventListener(){}};
  receiver.install(document,window);
  const link=(label='Install PKG')=>created.find(n=>n.tagName==='A'&&n.textContent===label),save=()=>created.find(n=>n.className==='receiver-save');
  return{requests,ids,created,link,save,queued:()=>queued,setRecords(value){records=value;},queue(){ids['receiver-folder-confirmed'].checked=true;save().onclick();},poll(value){records=value;const fn=timers.shift();assert.ok(fn,'No scheduled inert poll');fn();}};
}

test('receiver PKG links round-trip only exact native origins, saved paths and expected byte sizes',()=>{
  for(const platform of ['ps4','ps5'])for(const hostname of ['127.0.0.1','localhost','192.168.1.40'])for(const file of ['/data/app.pkg','/data/whatwhatboy/My  app.pkg','/mnt/usb1/whatwhatboy/app.pkg','/mnt/usb9/app.PKG']){
    const url=new URL(receiver.packageInstallerURL({...local,hostname},platform,file,4096));
    assert.equal(url.protocol,'http:');assert.equal(url.hostname,hostname);assert.equal(url.port,native.settings[platform].port);assert.equal(url.pathname,native.settings[platform].installPath);assert.equal(native.nativeOrigin(platform,url),true);
    assert.deepEqual([...url.searchParams.keys()],['path','bytes']);assert.equal(native.packagePath(url.searchParams.get('path')),file);assert.equal(native.expectedSize(url.searchParams.get('bytes')),4096);assert.equal(url.hash,'');assert.equal(url.username,'');assert.equal(url.password,'');
  }
});

test('PKG handoff refuses unsupported native hosts while IPv6 receiver downloading remains available',()=>{
  for(const location of [{...local,protocol:'https:'},{...local,port:'8080'},{...local,hostname:'whatwhatboy.com'},{...local,hostname:'127.0.0.1.evil.example'},{...local,hostname:'0.0.0.0'},{...local,hostname:'192.168.1.999'}])assert.throws(()=>receiver.packageInstallerURL(location,'ps4','/data/app.pkg',4096));
  for(const hostname of ['::1','[::1]','fd12::1','fe80::1']){assert.equal(receiver.receiverOrigin({...local,hostname}),true);for(const platform of ['ps4','ps5'])assert.throws(()=>receiver.packageInstallerURL({...local,hostname},platform,'/data/app.pkg',4096));}
});

test('PKG handoff rejects archives, ext mounts, traversal, aliases and native-incompatible sizes',()=>{
  for(const platform of ['ps4','ps5']){
    for(const file of ['/data/app.rar','/data/app.elf','/data/app.pkg.tmp','/mnt/ext0/app.pkg','/mnt/usb10/app.pkg','/mnt/usb/app.pkg','/mnt/USB0/app.pkg','/DATA/app.pkg','/system/app.pkg','/user/data/app.pkg','/data/../app.pkg','/data//app.pkg','/data/%2e%2e/app.pkg','/data/app.pkg?x','/data/app.pkg#x','/data/whatwhatboy/'+ 'x'.repeat(510)+'/app.pkg',' /data/app.pkg'])assert.throws(()=>receiver.packageInstallerURL(local,platform,file,4096),undefined,file);
    for(const bytes of [0,1,2,3,-1,4.5,Infinity,NaN,9007199254740992,'4096',[4096],null,undefined])assert.throws(()=>receiver.packageInstallerURL(local,platform,'/data/app.pkg',bytes),undefined,String(bytes));
  }
});

test('submission, full transfer, failure and unrelated completion cannot expose install preparation',()=>{
  for(const platform of ['ps4','ps5']){
    const f=fixture(platform);assert.equal(f.link().hidden,true);assert.ok(f.requests.every(r=>r.method==='GET'));f.queue();assert.equal(f.link().hidden,true);assert.ok(f.queued());const path=f.queued().dest_path;
    for(const records of [[],[{path,state:1,bytes_transfered:4096,file_size:4096}],[{path: '/data/other.pkg',state:4,bytes_transfered:4096,file_size:4096}],[{path,state:3,bytes_transfered:4096,file_size:4096}],[{path,state:99,bytes_transfered:4096,file_size:4096}]]){f.poll(records);assert.equal(f.link().hidden,true,JSON.stringify(records));}
    f.poll([{path,state:4,bytes_transfered:4096,file_size:4096}]);assert.equal(f.link().hidden,false);assert.equal(new URL(f.link().href).searchParams.get('path'),path);assert.match(f.ids['receiver-message'].textContent,/Receiver reports saved to:/);assert.doesNotMatch(f.ids['receiver-message'].textContent,/installation (?:finished|complete)|installed successfully/i);
    assert.equal(f.requests.filter(r=>r.method==='POST').length,1);assert.equal(f.requests.find(r=>r.method==='POST').url,'/download_url');assert.equal(f.link().onclick,undefined);assert.equal(f.link().target,'_blank');assert.match(f.link().rel,/noopener/);
  }
});

test('both console queues show real progress and expose only the matching completed archive or PKG',()=>{
  for(const platform of ['ps4','ps5']) for(const filename of ['app.pkg','archive.zip']){
    const archive=filename.endsWith('.zip'), f=fixture(platform,{filename,reviewed:archive});
    const action=f.link(archive?'Extract':'Install PKG');
    const bar=f.created.find(n=>n.tagName==='PROGRESS');
    const status=f.created.find(n=>n.className==='receiver-file-status');
    assert.equal(action.hidden,true);
    f.queue();
    assert.equal(bar.hidden,false);
    assert.equal(bar.value,undefined);
    const path=f.queued().dest_path;
    f.poll([{path,state:1,bytes_transfered:1024,file_size:4096}]);
    assert.equal(bar.value,25);
    assert.match(status.textContent,/Downloading · 25%/);
    assert.match(f.ids['receiver-queue'].textContent,/Downloading · 25%/);
    assert.equal(action.hidden,true);
    f.poll([{path,state:4,bytes_transfered:2048,file_size:2048}]);
    assert.equal(action.hidden,true);
    f.ids['receiver-folder'].value='/data/another-folder';
    f.ids['receiver-folder'].onchange();
    f.poll([{path,state:4,bytes_transfered:4096,file_size:4096}]);
    assert.equal(action.hidden,false);
    assert.equal(bar.value,100);
    assert.equal(new URL(action.href).searchParams.get(archive?'archive':'path'),path);
    f.poll([]);
    assert.equal(action.hidden,true);
    assert.equal(bar.hidden,true);
    assert.equal(f.requests.filter(r=>r.method==='POST').length,1);
  }
  assert.equal(fixture('ps4',{filename:'unreviewed.zip'}).link('Extract'),undefined);
});

test('completed downloads on unsupported native mount paths keep installation preparation hidden',()=>{
  for(const folder of ['/mnt/ext0/whatwhatboy','/mnt/usb10/whatwhatboy']){
    // Existing ext downloads remain valid PS5 receiver operations. The stricter
    // native helper contract must prevent only the subsequent install shortcut.
    const f=fixture('ps5',{folder});if(folder.includes('usb10')){f.setRecords([{path:folder+'/app.pkg',state:4,bytes_transfered:4096,file_size:4096}]);}f.queue();
    if(!f.queued()){assert.equal(f.requests.filter(r=>r.method==='POST').length,0);assert.equal(f.link().hidden,true);continue;}
    f.poll([{path:f.queued().dest_path,state:4,bytes_transfered:4096,file_size:4096}]);assert.equal(f.link().hidden,true);assert.equal(f.requests.filter(r=>r.method==='POST').length,1);
  }
});

test('non-PKG downloads and public previews cannot dispatch installation requests',()=>{
  const payload=fixture('ps4',{filename:'payload.elf'});payload.queue();payload.poll([{path:payload.queued().dest_path,state:4,bytes_transfered:4096,file_size:4096}]);assert.equal(payload.link(),undefined);assert.equal(payload.requests.filter(r=>r.method==='POST').length,1);
  const preview=fixture('ps4',{location:{protocol:'http:',hostname:'127.0.0.1',port:'8765'}});assert.equal(preview.requests.length,0);assert.equal(preview.save().disabled,true);preview.queue();assert.equal(preview.requests.length,0);assert.equal(preview.link().hidden,true);
});
