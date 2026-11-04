'use strict';
// Inert Element prototypes only. No browser, native script, payload or network is run.
const test=require('node:test'),assert=require('node:assert/strict');
const adapter=require('../../assets/host-offline-runtime.js');
const origin='https://speedy-away.github.io',runtime='/hosts/runtime/ps5-webkit-dd8e4e0914c5/web/';
function fixture({prefix='',pathname=prefix+runtime+'index.html',srcConfigurable=true,setAttributeWritable=true,setAttributeConfigurable=true}={}){
 const calls=[],token={};
 function Element(tag='DIV'){this.tagName=tag;this.namespaceURI='http://www.w3.org/1999/xhtml';this.attributes={};}
 Object.defineProperty(Element.prototype,'setAttribute',{value:function(){calls.push({node:this,args:[...arguments]});this.attributes[arguments[0]]=String(arguments[1]);return token;},writable:setAttributeWritable,enumerable:true,configurable:setAttributeConfigurable});
 function Script(){Element.call(this,'SCRIPT');}
 Script.prototype=Object.create(Element.prototype);
 const getter=function(){return this.attributes.src||'';},setter=function(value){calls.push({node:this,property:'src',value});this.attributes.src=String(value);};
 Object.defineProperty(Script.prototype,'src',{get:getter,set:setter,enumerable:true,configurable:srcConfigurable});
 const refuse=()=>{throw Error('The adapter must not request, execute or access storage');};
 const win={Element,HTMLScriptElement:Script,location:{href:origin+pathname},fetch:refuse,XMLHttpRequest:refuse,setTimeout:refuse,get localStorage(){return refuse();},get sessionStorage(){return refuse();}};
 return {win,Element,Script,calls,token,getter,setter};
}

test('only the pinned Relapse firmware offset cachebuster becomes a canonical same-origin URL',()=>{
 const firmwares=require('../../docs/ps5-webkit-build.json').firmwares;assert.equal(firmwares.length,33);
 for(const prefix of ['','/WWB-HOST','/wwb-host'])for(const firmware of firmwares){
  const page=origin+prefix+runtime+'index.html',path=prefix+runtime+'offsets/'+firmware+'.js';
  assert.equal(adapter.normalize('offsets/'+firmware+'.js?v=1762212345678',page),origin+path);
  assert.equal(adapter.normalize(path+'?v=0',page),origin+path);
  assert.equal(adapter.normalize(origin+path+'?v=1762212345678',page),origin+path);
 }
});

test('foreign origins, firmware gaps, unrelated paths and all other query semantics are untouched',()=>{
 const page=origin+runtime+'index.html',offset='offsets/13.60.js';
 const unchanged=[offset,offset+'?v=',offset+'?v=-1',offset+'?v=1.5',offset+'?v=NaN',offset+'?v=123&x=1',offset+'?v=1&v=2',offset+'?%76=123',offset+'?x=123',offset+'?v=123#x',
  'https://example.test'+runtime+offset+'?v=123','http://speedy-away.github.io'+runtime+offset+'?v=123','https://user:pass@speedy-away.github.io'+runtime+offset+'?v=123',
  '/WWB-HOST'+runtime+offset+'?v=123','/hosts/runtime/ps5-umtx/web/offsets/4.51.js?v=123','offsets/13.52.js?v=123','offsets/14.00.js?v=123','offsets/13.60.js/other?v=123','offsets/13%2e60.js?v=123','src/main.js?v=123','payloads/elfldr-ps5-1360.elf?v=123','javascript:alert(1)','data:text/javascript,void(0)'];
 for(const value of unchanged)assert.equal(adapter.normalize(value,page),value,value);
 for(const elsewhere of [origin+'/hosts/ps5/',origin+'/hosts/runtime/ps5-webkit-dd8e4e0914c5/index.html','file:///host'+runtime+'index.html'])assert.equal(adapter.normalize(offset+'?v=123',elsewhere),offset+'?v=123');
 for(const value of [null,undefined,123,new URL(origin+runtime+offset+'?v=123')])assert.equal(adapter.normalize(value,page),value);
});

test('setAttribute adapts only SCRIPT src while preserving original calls, receiver and return value',()=>{
 const f=fixture(),original=Object.getOwnPropertyDescriptor(f.Element.prototype,'setAttribute');assert.equal(adapter.install(f.win),true);
 const node=new f.Script();assert.equal(node.setAttribute('src','offsets/13.60.js?v=123','extra'),f.token);
 assert.equal(f.calls[0].node,node);assert.deepEqual(f.calls[0].args,['src',origin+runtime+'offsets/13.60.js','extra']);
 node.setAttribute('SRC','offsets/7.00.js?v=124');assert.equal(f.calls[1].args[1],origin+runtime+'offsets/7.00.js');
 for(const [target,name,value] of [[node,'data-source','offsets/13.60.js?v=123'],[node,'src','https://example.test/a.js?v=123'],[new f.Element('IMG'),'src','offsets/13.60.js?v=123']]){target.setAttribute(name,value);assert.equal(f.calls.at(-1).args[1],value);}
 const svg=new f.Script();svg.namespaceURI='http://www.w3.org/2000/svg';svg.setAttribute('src','offsets/13.60.js?v=123');assert.equal(f.calls.at(-1).args[1],'offsets/13.60.js?v=123');
 const descriptor=Object.getOwnPropertyDescriptor(f.Element.prototype,'setAttribute');assert.equal(descriptor.writable,original.writable);assert.equal(descriptor.enumerable,original.enumerable);assert.equal(descriptor.configurable,original.configurable);
});

test('a clean src setter is adapted without changing its getter or property flags',()=>{
 const f=fixture(),before=Object.getOwnPropertyDescriptor(f.Script.prototype,'src');assert.equal(adapter.install(f.win),true);const after=Object.getOwnPropertyDescriptor(f.Script.prototype,'src');
 assert.equal(after.get,before.get);assert.equal(after.enumerable,before.enumerable);assert.equal(after.configurable,before.configurable);assert.notEqual(after.set,before.set);
 const node=new f.Script();node.src='offsets/12.70.js?v=123';assert.equal(node.src,origin+runtime+'offsets/12.70.js');node.src='src/main.js?v=123';assert.equal(node.src,'src/main.js?v=123');
});

test('non-configurable src is left intact while the pinned setAttribute route remains covered',()=>{
 const f=fixture({srcConfigurable:false}),before=Object.getOwnPropertyDescriptor(f.Script.prototype,'src');assert.equal(adapter.install(f.win),true);assert.deepEqual(Object.getOwnPropertyDescriptor(f.Script.prototype,'src'),before);
 const node=new f.Script();node.setAttribute('src','offsets/13.60.js?v=123');assert.equal(f.calls.at(-1).args[1],origin+runtime+'offsets/13.60.js');
});

test('installation is idempotent and stays idle outside the exact execution document',()=>{
 const f=fixture();assert.equal(adapter.install(f.win),true);const first=f.Element.prototype.setAttribute,setter=Object.getOwnPropertyDescriptor(f.Script.prototype,'src').set;assert.equal(adapter.install(f.win),true);assert.equal(f.Element.prototype.setAttribute,first);assert.equal(Object.getOwnPropertyDescriptor(f.Script.prototype,'src').set,setter);
 for(const pathname of ['/hosts/ps5/','/hosts/runtime/ps5-umtx/web/index.html','/hosts/runtime/ps5-webkit-dd8e4e0914c5/index.html']){const other=fixture({pathname}),original=other.Element.prototype.setAttribute;assert.equal(adapter.install(other.win),false);assert.equal(other.Element.prototype.setAttribute,original);assert.deepEqual(other.calls,[]);}
 const locked=fixture({setAttributeConfigurable:false,setAttributeWritable:false}),original=locked.Element.prototype.setAttribute;assert.equal(adapter.install(locked.win),false);assert.equal(locked.Element.prototype.setAttribute,original);assert.deepEqual(locked.calls,[]);
});
