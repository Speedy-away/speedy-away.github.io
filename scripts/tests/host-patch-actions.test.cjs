'use strict';
// Authored UI and inert navigation records only. No sockets, console or native execution.
const test=require('node:test'),assert=require('node:assert/strict');
const ui=require('../../assets/host-game-patches.js');
const ua=(platform,firmware)=>'Mozilla/5.0 (PlayStation; PlayStation '+platform.slice(-1)+'/'+firmware+')';

function fixture({platform='ps4',firmware='9.00',userAgent=ua(platform,firmware),titleIds=['CUSA08519','CUSA03041'],navigationError=false}={}){
 let doc;const nodes={},navigations=[],requests=[],timers=[];
 class Element{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.attrs={};this.events={};this.disabled=false;this.hidden=false;this.value='';this.textContent='';this.markup='';}
  appendChild(n){n.parentNode=this;this.children.push(n);return n;}
  get innerHTML(){return this.markup;}set innerHTML(html){this.markup=String(html);this.children=[];this.parse(html);}
  parse(html){for(const m of String(html).matchAll(/<(button|a|select|p|summary|option|img)\b([^>]*)>/g)){const child=new Element(m[1]);for(const a of m[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))child.setAttribute(a[1],a[2]||'');this.appendChild(child);}}
  insertAdjacentHTML(position,html){assert.equal(position,'beforeend');this.markup+=html;this.parse(html);}
  hasAttribute(k){return Object.hasOwn(this.attrs,k);}getAttribute(k){return this.attrs[k]??null;}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='disabled')this.disabled=true;}
  addEventListener(k,f){this.events[k]=f;}focus(){doc.activeElement=this;}
  querySelectorAll(selector){const match=n=>selector.split(',').some(s=>{const attr=s.match(/^\[([^\]]+)\]$/);if(attr)return n.hasAttribute(attr[1]);return s==='button:not(:disabled)'?n.tagName==='button'&&!n.disabled:s==='a[href]'?n.tagName==='a'&&n.hasAttribute('href'):n.tagName===s;});return this.children.flatMap(n=>[...(match(n)?[n]:[]),...n.querySelectorAll(selector)]);}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
 }
 const game={id:'fixture-game',platform,title:'Fixture game',edition:platform==='ps4'?'PS4 game':'PS4 game on PS5',image:'/assets/images/game.jpg',updates:['01.29','01.32'],files:titleIds.map((titleId,i)=>({titleId,url:'/downloads/exact-'+i+'/'+titleId+'.xml'})),options:[{name:'Unlock FPS',gameVersion:'01.32',patchVersion:'1.0',author:'Pinned author'}],source:'https://github.com/example/repo/blob/pinned/patch.xml'};
 for(const id of ['host-patches-data','host-patch-grid','host-patch-search','host-patch-more','host-patch-overlay','host-patch-close','host-patch-title','host-patch-detail','host-patch-count'])nodes[id]=new Element(id.endsWith('close')||id.endsWith('more')?'button':'div');
 nodes['host-patches-data'].textContent=JSON.stringify({platform,games:[game]});nodes['host-patch-overlay'].hidden=true;nodes['host-patch-overlay'].appendChild(nodes['host-patch-close']);nodes['host-patch-overlay'].appendChild(nodes['host-patch-detail']);
 doc={visibilityState:'visible',wasDiscarded:false,activeElement:null,body:{style:{overflow:''}},getElementById:id=>nodes[id],events:{},addEventListener(k,f){this.events[k]=f;}};
 const refuse=(kind)=>{requests.push(kind);throw Error('Unexpected '+kind+' during patch browsing');};
 const win={navigator:{userAgent},fetch(){return refuse('fetch');},XMLHttpRequest(){return refuse('XHR');},setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(id){timers[id-1]=null;},get localStorage(){return refuse('storage');},get sessionStorage(){return refuse('session storage');},location:{}};
 win.top=win.self=win;Object.defineProperty(win.location,'href',{set(value){navigations.push(value);if(navigationError)throw Error('Navigation blocked');}});
 ui.install(win,doc);
 const panel=nodes['host-patch-detail'];
 return {nodes,game,doc,win,navigations,requests,panel,
  open(){const tile=nodes['host-patch-grid'].querySelector('[data-game]');nodes['host-patch-grid'].events.click({target:tile,isTrusted:true});return tile;},
  select(titleId){const picker=panel.querySelector('[data-patch-title]');picker.value=titleId;panel.events.change({target:picker});},
  load(isTrusted=true){const button=panel.querySelector('[data-patch-load]');panel.events.click({target:button,isTrusted});return button;},
  status(){return panel.querySelector('[data-patch-status]').textContent;}
 };
}

test('native patch routes use fixed loopback origin and preserve PS4/PS5 title architecture',()=>{
 for(const [platform,fw,titleId,directory] of [['ps4','9.00','CUSA08519','xml_orbis'],['ps4','12.52','CUSA03041','xml_orbis'],['ps5','3.00','CUSA08519','xml_orbis'],['ps5','12.70','PPSA01341','xml_prospero']]){
  const target=new URL(ui.nativeURL(platform,titleId,ua(platform,fw)));
  assert.equal(target.origin,'http://127.0.0.1:23900');assert.equal(target.pathname,'/'+directory+'/'+titleId+'.xml');assert.equal(target.search,'');assert.equal(target.hash,'');assert.equal(target.username,'');assert.equal(target.password,'');
 }
});

test('Load refuses wrong console, unsupported firmware and forged title paths',()=>{
 for(const [platform,agent] of [['ps4','Desktop'],['ps5',ua('ps4','9.00')],['ps4',ua('ps5','4.51')],['ps4',ua('ps4','8.52')],['ps4',ua('ps4','12.53')],['ps4',ua('ps4','14.00')],['ps5',ua('ps5','2.70')],['ps5',ua('ps5','12.71')],['ps5',ua('ps5','13.60')],['ps3',ua('ps4','9.00')]]){
  assert.equal(ui.availability(platform,agent).available,false);assert.throws(()=>ui.nativeURL(platform,'CUSA08519',agent));
 }
 for(const id of ['',null,undefined,'CUSA1','CUSA000000','cusa08519','CUSA08519.xml','../CUSA08519','CUSA08519/../../','CUSA08519?x=1','CUSA08519#x','%43USA08519','CUSA08519%2f..','http://example.test/CUSA08519','CUSA08519\n'])assert.throws(()=>ui.nativeURL('ps4',id,ua('ps4','9.00')),String(id));
 assert.throws(()=>ui.nativeURL('ps4','PPSA01341',ua('ps4','9.00')));
});

test('native target requires an explicit trusted click from a visible top-level page',()=>{
 const w={navigator:{userAgent:ua('ps4','9.00')}};w.self=w.top=w;
 const d={visibilityState:'visible',wasDiscarded:false};
 for(const event of [undefined,null,{}, {isTrusted:false},{isTrusted:1}])assert.throws(()=>ui.loadTarget(w,d,'ps4','CUSA08519',event),/Choose Load/);
 for(const changed of [{visibilityState:'hidden'},{visibilityState:'prerender'},{wasDiscarded:true}])assert.throws(()=>ui.loadTarget(w,{...d,...changed},'ps4','CUSA08519',{isTrusted:true}),/visible/);
 assert.throws(()=>ui.loadTarget({...w,top:{}},d,'ps4','CUSA08519',{isTrusted:true}),/visible/);
 assert.equal(ui.loadTarget(w,d,'ps4','CUSA08519',{isTrusted:true}),'http://127.0.0.1:23900/xml_orbis/CUSA08519.xml');
});

test('browsing and title selection do no console work and keep exact Download and Load identities together',()=>{
 for(const platform of ['ps4','ps5']){
  const f=fixture({platform,firmware:platform==='ps4'?'9.00':'4.51'});const tile=f.open();
  assert.equal(f.nodes['host-patch-overlay'].hidden,false);assert.equal(f.panel.querySelector('[data-patch-download]').getAttribute('href'),f.game.files[0].url);
  f.select('CUSA03041');const link=f.panel.querySelector('[data-patch-download]');
  assert.equal(link.getAttribute('href'),f.game.files[1].url);assert.equal(link.getAttribute('download'),'CUSA03041.xml');assert.match(f.panel.innerHTML,/<option value="CUSA03041" selected>/);assert.equal(f.doc.activeElement,f.panel.querySelector('[data-patch-title]'));
  f.select('CUSA99999');assert.equal(f.panel.querySelector('[data-patch-download]').getAttribute('href'),f.game.files[1].url);
  f.panel.events.click({target:f.panel.querySelector('[data-patch-download]'),isTrusted:true});assert.deepEqual(f.navigations,[]);assert.deepEqual(f.requests,[]);
  f.load();assert.deepEqual(f.navigations,['http://127.0.0.1:23900/xml_orbis/CUSA03041.xml']);assert.deepEqual(f.requests,[]);
  f.nodes['host-patch-close'].events.click();assert.equal(f.doc.activeElement,tile);
 }
});

test('native PS5 selections use PPSA paths while unsupported browsers keep Downloads usable',()=>{
 const native=fixture({platform:'ps5',firmware:'4.51',titleIds:['PPSA01341','PPSA01342']});native.open();native.select('PPSA01342');native.load();assert.deepEqual(native.navigations,['http://127.0.0.1:23900/xml_prospero/PPSA01342.xml']);
 for(const options of [{userAgent:'Desktop'},{userAgent:ua('ps5','4.51')},{firmware:'14.00'}]){
  const f=fixture(options);f.open();assert.equal(f.panel.querySelector('[data-patch-load]').disabled,true);assert.equal(f.panel.querySelector('[data-patch-download]').getAttribute('href'),f.game.files[0].url);f.load();assert.deepEqual(f.navigations,[]);assert.deepEqual(f.requests,[]);
 }
});

test('Load handoff is one-use and reports opening rather than installation or patch application',()=>{
 const f=fixture();f.open();f.load(false);assert.match(f.status(),/Choose Load/);assert.deepEqual(f.navigations,[]);
 const button=f.load();assert.equal(button.disabled,true);assert.equal(button.getAttribute('aria-busy'),'true');assert.match(f.status(),/Opening installed patches/);assert.doesNotMatch(f.status(),/installed successfully|installation complete|applied|download complete/i);
 f.load();f.load(false);f.select('CUSA03041');assert.equal(f.navigations.length,1);assert.equal(f.panel.querySelector('[data-patch-download]').getAttribute('href'),f.game.files[0].url);assert.deepEqual(f.requests,[]);
});

test('hidden or framed UI and failed navigation never claim success or retry native handoff',()=>{
 for(const mode of ['hidden','discarded','frame']){
  const f=fixture();f.open();if(mode==='hidden')f.doc.visibilityState='hidden';else if(mode==='discarded')f.doc.wasDiscarded=true;else f.win.top={};
  f.load();assert.deepEqual(f.navigations,[]);assert.match(f.status(),/visible/);assert.deepEqual(f.requests,[]);
 }
 const blocked=fixture({navigationError:true});blocked.open();const button=blocked.load();assert.equal(button.disabled,true);assert.equal(blocked.status(),'Navigation blocked');blocked.load();assert.equal(blocked.navigations.length,1);assert.deepEqual(blocked.requests,[]);
});

test('reopening a game after handoff or blocked navigation keeps Load locked and Download available',()=>{
 for(const navigationError of [false,true]){
  const f=fixture({navigationError});f.open();const firstButton=f.load(),message=f.status();assert.equal(f.navigations.length,1);
  f.nodes['host-patch-close'].events.click();assert.equal(f.nodes['host-patch-overlay'].hidden,true);f.open();assert.equal(f.nodes['host-patch-overlay'].hidden,false);
  const reopened=f.panel.querySelector('[data-patch-load]');assert.notEqual(reopened,firstButton);assert.equal(reopened.disabled,true);assert.equal(reopened.getAttribute('aria-disabled'),'true');assert.ok(f.panel.innerHTML.includes(message));
  const download=f.panel.querySelector('[data-patch-download]');assert.equal(download.getAttribute('href'),f.game.files[0].url);f.load();f.panel.events.click({target:download,isTrusted:true});assert.equal(f.navigations.length,1);assert.deepEqual(f.requests,[]);
 }
});

test('Download rejects external URLs, executable substitutions and encoded traversal',()=>{
 for(const url of ['https://example.test/a.xml','//example.test/a.xml','javascript:alert(1)','/downloads/a.elf','/downloads/a.xml?x=1','/downloads/%2e%2e/a.xml','/downloads/a/../b.xml','/downloads/a.xml#x']){
  assert.equal(ui.fileURL({url}),'');const html=ui.detail({platform:'ps4',edition:'PS4 game',files:[{titleId:'CUSA08519',url}],options:[]},{userAgent:ua('ps4','9.00')});assert.match(html,/Download unavailable/);assert.match(html,/data-patch-load disabled/);assert.doesNotMatch(html,/data-patch-download/);
 }
});
