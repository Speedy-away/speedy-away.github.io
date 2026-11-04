'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const generator=require('../host-self-host-popup.cjs'),widget=require('../../assets/host-self-host.js');
const page='<!doctype html><html><head><title>Host</title></head><body class="host-page"><main><h1>PS4</h1></main></body></html>';

function fixture(){
 const ids={},events={},refreshes=[];
 let doc;
 function node(id){const attrs={},listeners={};return ids[id]={id,hidden:false,offsetWidth:20,offsetHeight:20,
  setAttribute(k,v){attrs[k]=v;},getAttribute(k){return attrs[k]||null;},focus(){doc.activeElement=this;},
  addEventListener(k,fn){(listeners[k]||=[]).push(fn);},fire(type,extra={}){const event={target:this,...extra};for(const fn of listeners[type]||[])fn(event);}
 };}
 const trigger=node('host-self-host-trigger'),overlay=node('host-self-host-overlay'),close=node('host-self-host-close'),source=node('source-link'),last=node('last-link');
 overlay.hidden=true;overlay.querySelectorAll=()=>[close,source,last];overlay.contains=n=>[close,source,last].includes(n);
 doc={body:{style:{overflow:'auto'}},activeElement:trigger,getElementById:id=>ids[id],addEventListener(k,fn){(events[k]||=[]).push(fn);}};
 const win={__scoobyI18n:{refresh(n){refreshes.push(n);}}};
 function key(key,shiftKey=false){let prevented=false;for(const fn of events.keydown||[])fn({key,shiftKey,preventDefault(){prevented=true;}});return prevented;}
 const api=widget.install(doc,win);
 return {doc,win,trigger,overlay,close,source,last,api,key,events,refreshes};
}

test('public host popup exposes source, fork and existing workflow instructions with a project-base-aware asset URL',()=>{
 const html=generator.apply('hosts/ps4/index.html',page,{base:'/WWB-HOST'});
 assert.match(html,/host-has-self-host/);assert.match(html,/role="dialog" aria-modal="true"/);
 assert.match(html,/aria-controls="host-self-host-overlay" aria-expanded="false"/);
 assert.match(html,/https:\/\/github\.com\/Speedy-away\/WWB-HOST\/fork/);
 assert.match(html,/https:\/\/github\.com\/Speedy-away\/WWB-HOST\/archive\/refs\/heads\/main\.zip/);
 assert.match(html,/Settings → Pages → Build and deployment/);
 assert.match(html,/Deploy WWB HOST → Run workflow/);
 assert.match(html,/scripts\/host-project-pages\.cjs/);
 assert.match(html,/\/WWB-HOST\/assets\/host-self-host\.js\?v=1/);
 assert.ok(html.includes('<main><h1>PS4</h1></main>'));
 for(const url of Object.values(generator.DOCS))assert.ok(html.includes(url));
});

test('popup insertion is idempotent and leaves native, runtime and migration-redirect documents unchanged',()=>{
 const once=generator.apply('hosts/ps5/files/index.html',page);
 assert.equal(generator.apply('hosts/ps5/files/index.html',once),once);
 for(const name of ['hosts/runtime/test/index.html','downloads/helpers/workspace.html','console/ps4/whatsite-ps4.html'])assert.equal(generator.apply(name,page),page);
 const redirect=page.replace('</head>','<meta http-equiv="refresh" content="0;url=https://example.test/"></head>');
 assert.equal(generator.apply('hosts/ps4/index.html',redirect),redirect);
 const setup=page.replace('<main>','<main class="host-native-workspace">');
 assert.notEqual(generator.apply('hosts/ps5/files/index.html',setup),setup,'A public setup page remains eligible');
});

test('caller notes and labels are escaped and unsafe link or project-base configurations are refused',()=>{
 const html=generator.markup({projectName:'<script>bad</script>',technicalNotes:['<img src=x onerror=alert(1)>'],licenseURL:'https://example.test/licenses'});
 assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));assert.match(html,/Project licenses/);
 for(const sourceURL of ['javascript:alert(1)','http://example.test/','https://user:password@example.test/'])assert.throws(()=>generator.markup({sourceURL}));
 assert.throws(()=>generator.apply('hosts/ps4/index.html',page,{base:'/../escape'}));
});

test('opening is explicit and Escape restores prior focus and page scrolling',()=>{
 const f=fixture();assert.equal(f.overlay.hidden,true);assert.equal(f.refreshes.length,0);assert.equal(f.doc.body.style.overflow,'auto');
 f.trigger.fire('click');assert.equal(f.overlay.hidden,false);assert.equal(f.doc.activeElement,f.close);assert.equal(f.doc.body.style.overflow,'hidden');assert.equal(f.trigger.getAttribute('aria-expanded'),'true');
 assert.equal(f.key('Escape'),true);assert.equal(f.overlay.hidden,true);assert.equal(f.doc.activeElement,f.trigger);assert.equal(f.doc.body.style.overflow,'auto');assert.equal(f.trigger.getAttribute('aria-expanded'),'false');
});

test('keyboard navigation wraps in both directions and recovers focus that left the open dialog',()=>{
 const f=fixture();f.api.open();f.last.focus();assert.equal(f.key('Tab'),true);assert.equal(f.doc.activeElement,f.close);
 assert.equal(f.key('Tab',true),true);assert.equal(f.doc.activeElement,f.last);
 f.trigger.focus();assert.equal(f.key('Tab'),true);assert.equal(f.doc.activeElement,f.close);
 f.source.focus();assert.equal(f.key('Tab'),false);
 f.api.close();f.last.focus();assert.equal(f.key('Tab'),false);
});

test('close control and backdrop dismiss; clicks within the guide leave it open',()=>{
 const f=fixture();f.api.open();f.overlay.fire('click',{target:f.source});assert.equal(f.overlay.hidden,false);
 f.close.fire('click');assert.equal(f.overlay.hidden,true);
 f.api.open();f.overlay.fire('click');assert.equal(f.overlay.hidden,true);assert.equal(f.doc.activeElement,f.trigger);
});

test('repeated installation and opening do not duplicate handlers or alter the saved scrolling state',()=>{
 const f=fixture();assert.equal(widget.install(f.doc,f.win),undefined);assert.equal(f.events.keydown.length,1);
 f.trigger.fire('click');f.api.open();assert.equal(f.refreshes.length,1);f.api.close();assert.equal(f.doc.body.style.overflow,'auto');
});
