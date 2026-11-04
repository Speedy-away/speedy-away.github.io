const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const api = require('../../assets/console-receiver.js');
const receiver = {protocol:'http:',hostname:'127.0.0.1',port:'6701'};
const ps4Manager = {...receiver,port:'8080'};
const ps5Manager = {...receiver,port:'9090'};
const listing = entries => ({status:200,text:JSON.stringify({result:entries})});
const dir = name => ({name,type:'dir',size:''});
const file = (name,size=3) => ({name,type:'file',size:String(size)});
const success = {status:200,text:'{"result":{"success":true,"error":null}}'};
const bytes = Uint8Array.from(Buffer.from('abc')).buffer;
const digest = crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
const reviewed = {id:'archive',name:'Reviewed archive',filename:'menu.zip',bytes:3,sha256:digest,platforms:['ps4'],category:'mods',archiveSafety:{reviewed:true,noLinks:true,relativePaths:true,noDevices:true,noAlternateStreams:true,noEncryptedEntries:true,sha256:digest,bytes:3,entryCount:1,expandedBytes:3}};
function transport(responses) {
  const requests=[];
  function factory() {return {
    open(method,url){this.method=method;this.url=url;},setRequestHeader(){},
    send(body){const response=responses.shift();if(!response)throw Error('Unexpected request '+this.url);requests.push({method:this.method,url:this.url,body:body===null?null:JSON.parse(body)});this.status=response.status;this.responseText=response.text||'';this.response=response.binary;this.readyState=4;this.onreadystatechange();}
  };}
  return {requests,factory};
}
function ui({platform='ps4',items=[],search='',folder='/data/whatwhatboy',responses=[]}={}) {
  const created=[];
  function element(tag){const node={tagName:tag.toUpperCase(),children:[],value:'',className:'',textContent:'',disabled:false,hidden:false,appendChild(child){this.children.push(child);return child;},removeChild(child){this.children.splice(this.children.indexOf(child),1);},setAttribute(name,value){this[name]=value;},focus(){}};Object.defineProperty(node,'firstChild',{get(){return this.children[0];}});created.push(node);return node;}
  const ids={};for(const id of ['receiver-catalog','receiver-files','receiver-search','receiver-category','receiver-format','receiver-folder','receiver-storage','receiver-message','receiver-check','receiver-setup','receiver-count','receiver-folder-confirmed','receiver-detect','receiver-storage-status','receiver-browse','receiver-connection','receiver-queue','receiver-folder-status','receiver-prepare-open','receiver-manager-open','receiver-preparation','receiver-download-ui','receiver-title','receiver-intro'])ids[id]=element('div');
  ids['receiver-catalog'].textContent=JSON.stringify({platform,items});ids['receiver-folder'].value=folder;ids['receiver-format'].value='ready';
  const document={readyState:'complete',getElementById(id){return ids[id];},createElement:element,createTextNode(value){return {textContent:value};},addEventListener(){},querySelectorAll(){return[];}};
  const mock=transport(responses);
  const location={...receiver,search};if(search.includes('prepare=1'))location.port=platform==='ps4'?'8080':'9090';
  const window={location,XMLHttpRequest:function(){return mock.factory();},setTimeout(){return 1;},clearTimeout(){},addEventListener(){}};
  api.install(document,window);return {ids,created,mock};
}

test('file links scope the installed receiver to one exact ID even when menu names match',()=>{
  for(const platform of ['ps4','ps5']) for(const key of ['file','id']) {
    const first={...reviewed,id:'first-version',name:'Same menu',filename:'first.prx',platforms:[platform],version:'1.0'};
    const second={...first,id:'second-version',filename:'second.prx',version:'2.0'};
    const app=ui({platform,items:[first,second],search:'?'+key+'=second-version',responses:[{status:200,text:'[]'}]});
    const articles=()=>app.ids['receiver-files'].children.filter(node=>node.tagName==='ARTICLE');
    const filenames=()=>articles().flatMap(node=>node.children.filter(child=>child.className==='receiver-filename').map(child=>child.children[0].textContent));
    assert.deepEqual(filenames(),['second.prx']);
    app.ids['receiver-search'].value='';app.ids['receiver-search'].oninput();
    app.ids['receiver-format'].value='all';app.ids['receiver-format'].onchange();
    assert.deepEqual(filenames(),['second.prx'],'clearing filters must not widen a file link to other versions');
    assert.deepEqual(app.mock.requests.map(request=>[request.method,request.url]),[['GET','/get_download_state']]);
  }
});

test('unknown, empty, malformed and wrong-platform file IDs show unavailable without unrelated Save actions',()=>{
  for(const platform of ['ps4','ps5']) {
    const unrelated={...reviewed,id:'unrelated',filename:'unrelated.prx',platforms:[platform]};
    const wrongPlatform={...unrelated,id:'other-console',platforms:[platform==='ps4'?'ps5':'ps4']};
    for(const search of ['?file=unknown','?id=unknown','?file=','?file','?file=%E0%A4%A','?file=other-console']) {
      const app=ui({platform,items:[unrelated,wrongPlatform],search,responses:[{status:200,text:'[]'}]});
      assert.match(app.ids['receiver-message'].textContent,/requested file is unavailable/i,platform+' '+search);
      assert.match(app.ids['receiver-message'].textContent,/No download was queued/);
      assert.equal(app.ids['receiver-files'].children.some(node=>node.tagName==='ARTICLE'),false);
      app.ids['receiver-search'].value='';app.ids['receiver-search'].oninput();
      assert.equal(app.ids['receiver-files'].children.some(node=>node.tagName==='ARTICLE'),false);
      assert.deepEqual(app.mock.requests.map(request=>[request.method,request.url]),[['GET','/get_download_state']]);
    }
  }
});

test('folder preparation uses the exact client origin, independently from receiver and PS5 websrv ports',()=>{
  assert.equal(api.managerOrigin('ps4',ps4Manager),true);assert.equal(api.managerOrigin('ps5',ps5Manager),true);
  assert.equal(api.managerOrigin('ps4',ps5Manager),false);assert.equal(api.managerOrigin('ps5',ps4Manager),false);
  assert.equal(api.managerOrigin('ps4',receiver),false);assert.equal(api.managerOrigin('ps5',{...ps5Manager,hostname:'example.com'}),false);
  assert.equal(api.preparationURL(receiver,'ps4','/data/whatwhatboy'),'http://127.0.0.1:8080/data/whatsite-ps4.html?prepare=1&folder=%2Fdata%2Fwhatwhatboy');
  assert.equal(api.preparationURL(receiver,'ps5','/mnt/usb1/whatwhatboy','/mnt/usb1/whatwhatboy/menu.zip'),'http://127.0.0.1:9090/data/homebrew/ezremote-client/assets/whatsite-ps5.html?prepare=1&folder=%2Fmnt%2Fusb1%2Fwhatwhatboy&archive=%2Fmnt%2Fusb1%2Fwhatwhatboy%2Fmenu.zip');
  assert.equal(api.receiverURL(ps5Manager,'ps5','/data/whatwhatboy'),'http://127.0.0.1:6701/whatsite-ps5.html?folder=%2Fdata%2Fwhatwhatboy');
  assert.equal(api.downloadFolder('ps4','/data'),'/data/whatwhatboy');assert.equal(api.downloadFolder('ps5','/mnt/ext0/whatwhatboy'),'/mnt/ext0/whatwhatboy');
});

test('mkdir creates only a missing directory, verifies its postcondition and preserves an existing directory',()=>{
  const mock=transport([listing([dir('data')]),listing([]),success,listing([dir('whatwhatboy')])]);let result,error;
  api.createManagerClient('ps4',ps4Manager,mock.factory).prepareFolder('/data/whatwhatboy',false,(err,value)=>{error=err;result=value;});
  assert.equal(error,null);assert.deepEqual(result,{folder:'/data/whatwhatboy',created:true});
  assert.deepEqual(mock.requests.filter(request=>request.url!=='/__local__/list'),[{method:'POST',url:'/__local__/createFolder',body:{newPath:'/data/whatwhatboy'}}]);
  const existing=transport([listing([dir('data')]),listing([dir('whatwhatboy')])]);let existingResult;
  api.createManagerClient('ps4',ps4Manager,existing.factory).prepareFolder('/data/whatwhatboy',false,(err,value)=>{assert.equal(err,null);existingResult=value;});
  assert.equal(existingResult.created,false);assert.ok(existing.requests.every(request=>request.url==='/__local__/list'));
});

test('mkdir refuses a colliding file, missing storage root, unverified creation and unsupported origin',()=>{
  for(const [responses,pattern] of [
    [[listing([dir('data')]),listing([file('whatwhatboy')])],/Nothing was replaced/],
    [[listing([])],/storage root/],
    [[listing([dir('data')]),listing([]),success,listing([])],/did not verify the new directory/]
  ]){
    const mock=transport(responses);let error;api.createManagerClient('ps4',ps4Manager,mock.factory).prepareFolder('/data/whatwhatboy',false,err=>{error=err;});assert.match(error.message,pattern);
    assert.ok(mock.requests.every(request=>!/(remove|rename|edit|copy|install)/.test(request.url)));
  }
  const unsupported=transport([]);let error;api.createManagerClient('ps4',receiver,unsupported.factory).prepareFolder('/data/whatwhatboy',false,err=>{error=err;});assert.match(error.message,/running ezRemote Client/);assert.equal(unsupported.requests.length,0);
});

test('external creation requires a real PS5 mount or explicit PS4 native mount confirmation',()=>{
  const ps4=transport([]);let ps4Error;api.createManagerClient('ps4',ps4Manager,ps4.factory).prepareFolder('/mnt/usb1/whatwhatboy',false,error=>{ps4Error=error;});assert.match(ps4Error.message,/Confirm the actual mounted USB/);assert.equal(ps4.requests.length,0);
  const ps5=transport([{status:200,text:'[{"name":"usb1","mode":"d"}]'}]);let ps5Error;api.createManagerClient('ps5',ps5Manager,ps5.factory).prepareFolder('/mnt/usb1/whatwhatboy',false,error=>{ps5Error=error;});assert.match(ps5Error.message,/not currently reported as mounted/);assert.deepEqual(ps5.requests.map(request=>request.method),['GET']);
});

test('browser SHA-256 matches Node crypto for padding boundaries, binary input and a one-million-byte vector',()=>{
  for(const length of [0,1,55,56,63,64,65,127,128,129,1024,1000000]){const input=Buffer.alloc(length,0xa5);assert.equal(api.sha256Bytes(input),crypto.createHash('sha256').update(input).digest('hex'),'length '+length);}
  assert.equal(api.sha256Bytes(Uint8Array.from([0,255,1,128,64])),crypto.createHash('sha256').update(Buffer.from([0,255,1,128,64])).digest('hex'));
});

function extractionResponses({collision=false,outputEmpty=false,extractResult=success,binary=bytes}={}){
  return [listing([file('menu.zip')]),{status:200,binary},listing([dir('data')]),listing([dir('whatwhatboy')]),listing([dir('extracted')]),listing(collision?[dir('menu-new')]:[]),...(collision?[]:[extractResult,listing([dir('menu-new')]),listing(outputEmpty?[]:[file('plugin.prx')])])];
}
test('reviewed extraction verifies saved bytes, rejects reused output and sends only the documented extraction request',()=>{
  const mock=transport(extractionResponses());let result,error;
  api.createManagerClient('ps4',ps4Manager,mock.factory).extractArchive('/data/whatwhatboy/menu.zip','/data/whatwhatboy/extracted','menu-new',false,reviewed,(err,value)=>{error=err;result=value;});
  assert.equal(error,null);assert.deepEqual(result,{folder:'/data/whatwhatboy/extracted/menu-new',entries:1});
  assert.deepEqual(mock.requests.filter(request=>request.url!=='/__local__/list'),[{method:'GET',url:'/data/whatwhatboy/menu.zip',body:null},{method:'POST',url:'/__local__/extract',body:{item:'/data/whatwhatboy/menu.zip',destination:'/data/whatwhatboy/extracted',folderName:'menu-new'}}]);
  const collision=transport(extractionResponses({collision:true}));let collisionError;
  api.createManagerClient('ps4',ps4Manager,collision.factory).extractArchive('/data/whatwhatboy/menu.zip','/data/whatwhatboy/extracted','menu-new',false,reviewed,err=>{collisionError=err;});assert.match(collisionError.message,/destination already exists/);assert.ok(collision.requests.every(request=>request.url!=='/__local__/extract'));
});

test('unreviewed, oversized, changed and missing archives never cause extraction or mkdir',()=>{
  for(const item of [{...reviewed,archiveSafety:null},{...reviewed,bytes:32*1024*1024+1},{...reviewed,archiveSafety:{...reviewed.archiveSafety,noLinks:false}}]){
    const mock=transport([]);let error;api.createManagerClient('ps4',ps4Manager,mock.factory).extractArchive('/data/whatwhatboy/menu.zip','/data/whatwhatboy/extracted','menu-new',false,item,err=>{error=err;});assert.match(error.message,/reviewed site archives/);assert.equal(mock.requests.length,0);
  }
  for(const responses of [[listing([])],[listing([file('menu.zip',2)])],[listing([file('menu.zip')]),{status:200,binary:Uint8Array.from([97,98,100]).buffer}]]){
    const mock=transport(responses);let error;api.createManagerClient('ps4',ps4Manager,mock.factory).extractArchive('/data/whatwhatboy/menu.zip','/data/whatwhatboy/extracted','menu-new',false,reviewed,err=>{error=err;});assert.ok(error);assert.ok(mock.requests.every(request=>request.url!=='/__local__/extract'&&request.url!=='/__local__/createFolder'));
  }
});

test('extraction reports native failures and empty output without deleting originals or retrying',()=>{
  for(const options of [{outputEmpty:true},{extractResult:{status:200,text:'{"result":{"success":false,"error":"Unsupported compressed file format"}}'}}]){
    const mock=transport(extractionResponses(options));let error;api.createManagerClient('ps4',ps4Manager,mock.factory).extractArchive('/data/whatwhatboy/menu.zip','/data/whatwhatboy/extracted','menu-new',false,reviewed,err=>{error=err;});assert.ok(error);assert.match(error.message,/empty|Unsupported/);assert.equal(mock.requests.filter(request=>request.url==='/__local__/extract').length,1);assert.ok(mock.requests.every(request=>!/(remove|rename|edit|copy|install)/.test(request.url)));
  }
});

test('preparation page makes no API requests until its explicit action and returns the verified folder',()=>{
  const view=ui({search:'?prepare=1&folder=%2Fdata%2Fwhatwhatboy',responses:[listing([dir('data')]),listing([dir('whatwhatboy')])]});
  assert.equal(view.mock.requests.length,0);assert.equal(view.ids['receiver-download-ui'].hidden,true);
  const action=view.created.find(node=>node.className==='receiver-prepare-action');assert.ok(action);action.onclick();
  assert.ok(view.mock.requests.every(request=>request.url==='/__local__/list'));
  const use=view.created.find(node=>node.className==='receiver-guide'&&node.hidden===false&&String(node.href).includes(':6701/'));assert.ok(use);assert.equal(use.href,'http://127.0.0.1:6701/data/whatsite-ps4.html?folder=%2Fdata%2Fwhatwhatboy');
  const count=view.mock.requests.length;action.onclick();assert.equal(view.mock.requests.length,count);
});

test('ready/archive/patch filters retain preparation instructions and explicit archive deep links',()=>{
  assert.equal(api.matches(reviewed,'ps4','mods','','ready'),false);assert.equal(api.matches(reviewed,'ps4','mods','','archives'),true);
  const patch={...reviewed,filename:'CUSA00001.xml',category:'patches',preparation:'Use this exact reviewed patch engine path.'};
  assert.equal(api.matches(patch,'ps4','patches','CUSA00001','ready'),true);assert.equal(api.preparation(patch),patch.preparation);assert.match(api.preparation({...patch,preparation:''}),/not a payload or game executable/);
  const view=ui({items:[reviewed],search:'?file=archive',responses:[{status:200,text:'[]'}]});assert.equal(view.ids['receiver-format'].value,'archives');assert.equal(view.mock.requests.length,1);assert.equal(view.mock.requests[0].method,'GET');
});

test('a fresh queue read catches an existing destination before any download is posted',()=>{
  const item={...reviewed,id:'app',filename:'app.pkg',category:'apps',url:'/downloads/app.pkg'};
  const view=ui({items:[item],responses:[{status:200,text:'[]'},{status:200,text:'[{"path":"/data/whatwhatboy/app.pkg","state":1}]'}]});view.ids['receiver-folder-confirmed'].checked=true;
  const save=view.created.find(node=>node.className==='receiver-save');save.onclick();assert.deepEqual(view.mock.requests.map(request=>request.method),['GET','GET']);assert.match(view.ids['receiver-message'].textContent,/No duplicate was queued/);assert.equal(save.disabled,true);
});

test('an uncertain submission stays locked and a later receiver check recovers its state without a duplicate',()=>{
  const item={...reviewed,id:'app',filename:'app.pkg',category:'apps',url:'/downloads/app.pkg'};
  const view=ui({items:[item],responses:[{status:200,text:'[]'},{status:200,text:'[]'},{status:404},{status:404},{status:500},{status:200,text:'[{"path":"/data/whatwhatboy/app.pkg","state":1,"file_size":3,"bytes_transfered":1}]'}]});view.ids['receiver-folder-confirmed'].checked=true;
  const save=view.created.find(node=>node.className==='receiver-save');save.onclick();assert.equal(save.disabled,true);assert.match(view.ids['receiver-message'].textContent,/may have reached/);
  save.onclick();view.ids['receiver-check'].onclick();assert.equal(view.mock.requests.filter(request=>request.url==='/download_url').length,1);
  assert.ok(view.created.some(node=>node.className==='receiver-file-status'&&/Downloading/.test(node.textContent)));
});

test('PS5 refresh invalidates an absent external destination without changing it or sending a download',()=>{
  const item={...reviewed,id:'app',filename:'app.elf',platforms:['ps5'],category:'payloads',url:'/downloads/app.elf'};
  const view=ui({platform:'ps5',items:[item],folder:'/mnt/usb1/whatwhatboy',responses:[{status:200,text:'[]'},{status:200,text:'[{"name":"usb1","mode":"m"}]'},{status:200,text:'[{"name":"usb1","mode":"d"}]'}]});
  const save=view.created.find(node=>node.className==='receiver-save');view.ids['receiver-detect'].onclick();assert.equal(save.disabled,false);view.ids['receiver-detect'].onclick();assert.equal(save.disabled,true);assert.equal(view.ids['receiver-prepare-open'].hidden,true);assert.equal(view.ids['receiver-folder'].value,'/mnt/usb1/whatwhatboy');
  save.onclick();assert.ok(view.mock.requests.every(request=>request.method==='GET'));
});
