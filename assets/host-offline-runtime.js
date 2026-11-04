/* Authored AppCache URL adapter only. No native execution, requests or storage. */
(function(root,factory){
 'use strict';var api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else{root.HostOfflineRuntime=api;api.install(root);}
}(typeof window!=='undefined'?window:this,function(){
 'use strict';
 var firmwares=['13.60','13.42','13.40','13.20','13.00','12.70','12.60','12.40','12.20','12.02','12.00','11.60','11.20','11.00','10.60','10.40','10.20','10.01','10.00','9.60','9.40','9.20','9.00','8.60','8.40','8.20','8.00','7.61','7.60','7.40','7.20','7.01','7.00'];
 var installed=[];
 function runtimeBase(href){
  try{var url=new URL(href),match=/^(\/(?:(?:WWB-HOST|wwb-host)\/)?hosts\/runtime\/ps5-webkit-dd8e4e0914c5\/web\/)(?:index\.html)?$/.exec(url.pathname);return /^https?:$/.test(url.protocol)&&!url.username&&!url.password&&match?{url:url,path:match[1]}:null;}catch(_){return null;}
 }
 function normalize(value,documentURL){
  if(typeof value!=='string')return value;
  var base=runtimeBase(documentURL);if(!base)return value;
  try{
   var url=new URL(value,base.url.href),prefix=base.path+'offsets/';
   if(url.origin!==base.url.origin||url.username||url.password||url.hash||!/^\?v=[0-9]+$/.test(url.search)||url.pathname.indexOf(prefix)!==0)return value;
   var file=url.pathname.slice(prefix.length),firmware=file.slice(0,-3);
   if(file!==firmware+'.js'||firmwares.indexOf(firmware)===-1)return value;
   return url.origin+url.pathname;
  }catch(_){return value;}
 }
 function script(node){return !!node&&typeof node.tagName==='string'&&node.tagName.toUpperCase()==='SCRIPT'&&(!node.namespaceURI||node.namespaceURI==='http://www.w3.org/1999/xhtml');}
 function install(win){
  if(!win||!win.location||!runtimeBase(win.location.href)||!win.Element||!win.Element.prototype)return false;
  if(installed.indexOf(win)!==-1)return true;
  var proto=win.Element.prototype,descriptor=Object.getOwnPropertyDescriptor(proto,'setAttribute');
  if(!descriptor||typeof descriptor.value!=='function'||!descriptor.configurable&&!descriptor.writable)return false;
  var original=descriptor.value;
  var wrapped=function(name,value){
   var args=arguments;
   if(script(this)&&typeof name==='string'&&name.toLowerCase()==='src'){
    var next=normalize(value,win.location.href);
    if(next!==value){args=Array.prototype.slice.call(arguments);args[1]=next;}
   }
   return original.apply(this,args);
  };
  try{Object.defineProperty(proto,'setAttribute',{value:wrapped,writable:descriptor.writable,enumerable:descriptor.enumerable,configurable:descriptor.configurable});}catch(_){return false;}
  // Older WebKit may expose a non-configurable src descriptor. The native
  // pinned runtime uses setAttribute(), so it remains covered in that case.
  var scriptProto=win.HTMLScriptElement&&win.HTMLScriptElement.prototype,source=scriptProto&&Object.getOwnPropertyDescriptor(scriptProto,'src');
  if(source&&source.configurable&&typeof source.get==='function'&&typeof source.set==='function'){
   try{Object.defineProperty(scriptProto,'src',{get:source.get,set:function(value){return source.set.call(this,script(this)?normalize(value,win.location.href):value);},enumerable:source.enumerable,configurable:source.configurable});}catch(_){}
  }
  installed.push(win);return true;
 }
 return {normalize:normalize,install:install};
}));
