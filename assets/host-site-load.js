/* Authored same-origin launch handoff. Never evaluates an exploit or payload. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HostSiteLoad=api;}(typeof window!=='undefined'?window:this,function(){
 'use strict';
 var AFTERGLOW='wwb.host.afterglow.load.v1';
 function save(win,key,request){var value=JSON.stringify(request);win.sessionStorage.setItem(key,value);if(win.sessionStorage.getItem(key)!==value)throw Error('Browser session storage is unavailable. Nothing was started.');}
 function firmware(ua){var m=/PlayStation\s*(4|5)[ /]+(\d+)\.(\d+)/i.exec(String(ua||''));return m?{platform:'ps'+m[1],firmware:Number(m[2])+'.'+(m[3]+'0').slice(0,2)}:null;}
 function local(win,value){var u=new URL(value,win.location.href);if(u.origin!==win.location.origin||!/^https?:$/.test(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('Load must stay on this site.');return u;}
 function start(win,doc,action,trusted){
  var info=firmware(win.navigator.userAgent),route=action&&action.nativeRoute;
  if(!trusted||!route||!info||info.platform!==action.platform||(action.firmwares||[]).indexOf(info.firmware)===-1)throw Error('Use Load in the matching console browser and firmware.');
  if(doc.wasDiscarded||doc.visibilityState&&doc.visibilityState!=='visible'||win.top&&win.self&&win.top!==win.self)throw Error('Keep the console host visible before Load.');
  if(route.kind==='karo'){
   var runtime=local(win,route.runtime),entry=route.entry,guard=win.WhatsiteKaro;
   if(!/^\/(?:(?:WWB-HOST|wwb-host)\/)?hosts\/runtime\/(?:karo|gamerhack)-[a-f0-9]{12}-[a-f0-9]{12}\/web\/$/.test(runtime.pathname)||!entry||!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\/index\.html$/i.test(entry.path)||entry.scope!==entry.path.slice(0,-10)||!guard||typeof guard.authorize!=='function')throw Error('The local loader entry is unavailable.');
   var selected={platform:action.platform,path:entry.path,scope:entry.scope,firmwares:action.firmwares.slice(),ranges:[],blockedReason:entry.blockedReason};
   var target=guard.authorize(win,selected,runtime.pathname,true,true);
   if(route.autorun==='umtx2'){win.sessionStorage.setItem('on_load_autorun','kernel');if(win.sessionStorage.getItem('on_load_autorun')!=='kernel')throw Error('Browser session storage is unavailable. Nothing was started.');}
   return local(win,target).href;
  }
  var target=local(win,route.target);
  if(route.kind==='afterglow'){
   if(info.platform!=='ps4'||['13.52','14.00'].indexOf(info.firmware)===-1||!/^\/(?:(?:WWB-HOST|wwb-host)\/)?hosts\/runtime\/ps4-afterglow-[a-f0-9]{12}\/web\/index\.html$/.test(target.pathname))throw Error('The local GoldHEN loader is unavailable.');
   save(win,AFTERGLOW,{origin:win.location.origin,target:target.pathname,firmware:info.firmware,at:Date.now(),payload:'goldhen'});return target.href;
  }
  if(route.kind==='ps5-native'){
   var m=/^\/(?:(?:WWB-HOST|wwb-host)\/)?hosts\/runtime\/ps5-webkit-([a-f0-9]{12})\/web\/index\.html$/.exec(target.pathname);
   if(info.platform!=='ps5'||!m)throw Error('The local PS5 loader is unavailable.');
   save(win,'wwb.ps5-webkit.'+m[1]+'.start',{origin:win.location.origin,runPath:target.pathname,firmware:info.firmware,at:Date.now()});return target.href;
  }
  throw Error('The selected local Load route is unavailable.');
 }
 return {start:start,firmware:firmware,afterglowKey:AFTERGLOW};
}));
