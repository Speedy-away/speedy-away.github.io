/* Receives one explicit site Load request on the genuine Afterglow picker. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else api.install(root,root.document);}(typeof window!=='undefined'?window:this,function(){
 'use strict';var KEY='wwb.host.afterglow.load.v1';
 function install(win,doc){
  var request;try{request=JSON.parse(win.sessionStorage.getItem(KEY)||'null');win.sessionStorage.removeItem(KEY);}catch(e){return false;}
  if(!request)return false;
  try{
   var fw=/PlayStation 4[ /]+(\d+\.\d{2})/.exec(win.navigator.userAgent),ref=new URL(doc.referrer),nav=win.performance&&win.performance.getEntriesByType&&win.performance.getEntriesByType('navigation')[0],age=Date.now()-request.at;
   if(!fw||['13.52','14.00'].indexOf(fw[1])===-1||request.firmware!==fw[1]||request.origin!==win.location.origin||request.target!==win.location.pathname||!/^\/(?:(?:WWB-HOST|wwb-host)\/)?hosts\/runtime\/ps4-afterglow-[a-f0-9]{12}\/web\/index\.html$/.test(request.target)||ref.origin!==win.location.origin||!/^\/(?:(?:WWB-HOST|wwb-host)\/)?hosts\/ps4\//.test(ref.pathname)||age<0||age>30000||nav&&nav.type!=='navigate'||doc.wasDiscarded||doc.visibilityState!=='visible'||win.top!==win.self)return false;
   var form=doc.getElementById('pick'),button=doc.getElementById('start');if(!form||!button||button.disabled)return false;
   var gold=form.querySelector('input[value="goldhen"]');if(!gold)return false;gold.checked=true;
   form.dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));return true;
  }catch(e){return false;}
 }
 return {install:install,key:KEY};
}));
