'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const urls = require('../../assets/console-url-downloads.js');
const receiver = require('../../assets/console-receiver.js');
const {renderCompanion} = require('../console-download-companion.cjs');

test('custom links require an explicit HTTP(S) URL and a single safe filename', () => {
  assert.deepEqual(urls.prepare('HTTPS://Example.com/file%20name.pkg?token=one&raw=1#ignored', ''), {
    url:'https://example.com/file%20name.pkg?token=one&raw=1', filename:'file name.pkg'
  });
  assert.equal(urls.suggestFilename('https://example.com/'), 'download');
  assert.equal(urls.suggestFilename('http://[::1]:8000/a.elf'), 'a.elf');
  for (const url of ['example.com/a.pkg','//example.com/a.pkg','javascript:alert(1)','data:text/html,x','ftp://example.com/a',
    'https://user:password@example.com/a','https://example.com\\evil/a','\nhttps://example.com/a','https://example.com/a\u0000',
    'https://example.com:0/a','https://[:::]/a','http://999.1.2.3/a','https://example..com/a','https://example.com/bad%xx',
    'https://example.com/' + 'a'.repeat(4096)]) assert.throws(() => urls.prepare(url), undefined, url);
  for (const filename of ['../a.pkg','a/b.pkg','a\\b.pkg','..','.hidden','a.pkg ','a.pkg.','a%2fpkg','a:b.pkg','a\n.pkg','x'.repeat(161)]) {
    assert.throws(() => urls.prepare('https://example.com/a.pkg', filename), undefined, filename);
  }
  assert.deepEqual(urls.prepare('http://192.168.1.4:8000/a.bin', 'my file.bin'), {url:'http://192.168.1.4:8000/a.bin', filename:'my file.bin'});
});

test('custom fragments round-trip only URL and filename without claiming file metadata', () => {
  const data = urls.prepare('https://example.com/a.pkg?raw=1&token=a=b');
  const fragment = urls.fragment(data);
  assert.match(fragment, /^#download-url=/);
  assert.deepEqual(urls.fromFragment(fragment), data);
  const unicode = urls.prepare('https://example.com/' + '\u65e5'.repeat(4000) + '.bin', 'payload.bin');
  assert.deepEqual(urls.fromFragment(urls.fragment(unicode)), unicode);
  assert.equal(urls.fromFragment('#guide'), null);
  for (const hash of ['#download-url', '#download-url=bad', '#download-url=%', '#download-url=' + encodeURIComponent('{}'),
    '#download-url=' + encodeURIComponent(JSON.stringify({...data, sha256:'a'.repeat(64)})),
    '#download-url=' + encodeURIComponent(JSON.stringify({...data, filename:'../a.pkg'}))]) assert.throws(() => urls.fromFragment(hash), undefined, hash);
});

function openReceiver({platform='ps4', hash='', search='?file=custom-url', responses=[]} = {}) {
  const created = [], requests = [], timers = [];
  function element(tag) {
    const node = {tagName:tag.toUpperCase(), children:[], value:'', className:'', textContent:'', disabled:false,
      appendChild(child){this.children.push(child);return child;}, removeChild(child){this.children.splice(this.children.indexOf(child),1);},
      setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];},focus(){}};
    Object.defineProperty(node,'firstChild',{get(){return this.children[0];}});
    created.push(node);return node;
  }
  const ids={};
  for(const id of ['receiver-catalog','receiver-files','receiver-search','receiver-format','receiver-category','receiver-folder',
    'receiver-storage','receiver-message','receiver-check','receiver-setup','receiver-count','receiver-folder-confirmed',
    'receiver-url-form','receiver-url','receiver-url-filename','receiver-url-status']) ids[id]=element('div');
  ids['receiver-catalog'].textContent=JSON.stringify({platform,items:[{id:'catalogue',name:'Catalogue file',filename:'catalogue.elf',url:'https://example.com/catalogue.elf',platforms:[platform],category:'apps',bytes:1234}]});
  ids['receiver-folder'].value='/data';ids['receiver-format'].value='ready';
  const document={readyState:'complete',getElementById:id=>ids[id],createElement:element,createTextNode:text=>({textContent:String(text)}),addEventListener(){},querySelectorAll(){return[];}};
  const window={location:{protocol:'http:',hostname:'127.0.0.1',port:'6701',search,hash},
    XMLHttpRequest:function(){return {open(method,url){this.method=method;this.url=url;},setRequestHeader(){},send(body){const response=responses.shift();assert.ok(response,'Unexpected receiver request');requests.push({method:this.method,url:this.url,body});this.status=response.status;this.responseText=response.text||'';this.readyState=4;this.onreadystatechange();}};},
    setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},addEventListener(){}};
  receiver.install(document,window);
  function activeNodes() {
    const result=[];
    function walk(node){result.push(node);for(const child of node.children||[])walk(child);}
    walk(ids['receiver-files']);return result;
  }
  return {ids,requests,timers,created,nodes:activeNodes,save(){const button=activeNodes().find(node=>node.className==='receiver-save');assert.ok(button,'Expected a staged file');button.onclick();},
    stage(url,filename=''){ids['receiver-url'].value=url;ids['receiver-url-filename'].value=filename;ids['receiver-url-form'].onsubmit({preventDefault(){}});}};
}

test('an imported custom file replaces the sentinel only, stages no POST, and makes no checksum or installer claim', () => {
  const app=openReceiver({hash:urls.fragment(urls.prepare('https://example.com/a.pkg')),responses:[{status:200,text:'[]'}]});
  assert.deepEqual(app.requests.map(request=>request.method), ['GET']);
  assert.equal(app.ids['receiver-format'].value, 'all');
  const text=app.nodes().map(node=>node.textContent).join(' ');
  assert.match(text,/User-provided link/);
  assert.match(text,/no catalogue checksum or compatibility review/);
  assert.doesNotMatch(text,/Catalogue file|SHA-256 checksum|Install PKG/);
  assert.equal(app.nodes().some(node=>node.className==='receiver-hash'),false);
  assert.match(app.ids['receiver-url-status'].textContent,/No download has started/);
});

test('invalid imports and a missing custom sentinel do not expose unrelated catalogue saves', () => {
  for (const hash of ['', '#download-url=bad', urls.fragment(urls.prepare('https://example.com/a.pkg')).replace('https','javascript')]) {
    const app=openReceiver({hash,responses:[{status:200,text:'[]'}]});
    assert.equal(app.nodes().some(node=>node.className==='receiver-save'),false);
    assert.equal(app.requests.some(request=>request.method==='POST'),false);
    assert.match(app.ids['receiver-message'].textContent,/No download was queued/);
  }
});

test('a custom Save reuses exact request typing, destination checks and duplicate destination protection', () => {
  const app=openReceiver({hash:urls.fragment(urls.prepare('https://example.com/a.bin?raw=1')),responses:[
    {status:200,text:'[]'}, {status:200,text:'[]'}, {status:404}, {status:404}, {status:200}
  ]});
  app.save();
  assert.equal(app.requests.length,1,'PS4 folder confirmation is still required');
  app.ids['receiver-folder-confirmed'].checked=true;app.save();
  assert.deepEqual(app.requests.map(request=>[request.method,request.url]),[
    ['GET','/get_download_state'],['GET','/get_download_state?wwb-read=' + app.requests[1].url.split('?wwb-read=')[1]],
    ['HEAD','/data/a.bin'],['HEAD','/data/a.bin.tmp'],['POST','/download_url']
  ]);
  const body=JSON.parse(app.requests[4].body);
  assert.equal(body.type,7);assert.equal(body.url,'https://example.com');assert.equal(body.src_path,'/a.bin?raw=1');
  assert.equal(body.dest_path,'/data/a.bin');assert.equal(body.size,0);
  app.save();assert.equal(app.requests.length,5,'Same staged identity is not submitted again');
  app.stage('https://another.example.com/a.bin');app.save();
  assert.equal(app.requests.length,5,'A different link cannot reuse an active destination');
});

test('custom links retain live progress, unknown submission locks and native-file-manager guidance', () => {
  const app=openReceiver({hash:urls.fragment(urls.prepare('https://example.com/a.zip')),responses:[
    {status:200,text:'[]'}, {status:200,text:'[]'}, {status:404}, {status:404}, {status:500},
    {status:200,text:'[{"path":"/data/a.zip","state":4,"bytes_transfered":456,"file_size":456}]'}
  ]});
  app.ids['receiver-folder-confirmed'].checked=true;app.save();
  assert.match(app.ids['receiver-message'].textContent,/duplicate has not been sent/);
  app.save();
  assert.equal(app.requests.filter(request=>request.method==='POST').length,1);
  assert.match(app.ids['receiver-message'].textContent,/already submitted/);
  app.ids['receiver-check'].onclick();
  const status=app.nodes().find(node=>node.className==='receiver-file-status');
  assert.match(status.textContent,/Receiver reports complete.*100%.*native file manager/);
  assert.equal(app.nodes().some(node=>node.textContent==='Extract'||node.textContent==='Install PKG'),false);
});

test('local URL editing stages separately from Save and PS5 still uses websrv collision checks', () => {
  const app=openReceiver({platform:'ps5',search:'',responses:[{status:200,text:'[]'},{status:200,text:'[]'},
    {status:200,text:'[{"name":".","mode":"d"},{"name":"my.pkg","mode":"-"}]'}]});
  app.stage('https://example.com/my.pkg');
  assert.equal(app.requests.length,1,'Prepare does not make a write');
  app.save();
  assert.deepEqual(app.requests.slice(1).map(request=>request.method),['GET','GET']);
  assert.match(app.requests[2].url,/8080\/fs\/data\/\?fmt=json/);
  assert.match(app.ids['receiver-message'].textContent,/already exists/);
  app.stage('javascript:alert(1)');
  assert.equal(app.nodes().some(node=>node.className==='receiver-save'),false);
});

test('standalone companions embed the shared URL parser before the receiver and include a local staging form', () => {
  const html=renderCompanion('ps4',[],'2026.11.02.28');
  assert.ok(html.indexOf('root.ConsoleURLDownloads = api') < html.indexOf('root.ConsoleReceiver = api'));
  assert.match(html,/id="receiver-url-form"/);assert.match(html,/Prepare download/);
  assert.doesNotMatch(html,/<script\b[^>]+src=/i);
});
