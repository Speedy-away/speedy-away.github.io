/* Authored path adapter and rejection of missing/corrupt upstream files. */
(function(factory){if(typeof module==='object'&&module.exports)module.exports=factory;else factory(window,window.WHATSITE_KARO_RESOURCES);}(function(win,config){
 'use strict';if(!config||win.whatsiteKaroResourceGuard)return;win.whatsiteKaroResourceGuard=true;
 var available={},invalid={};config.files.forEach(function(p){available[p]=true;});config.invalid.forEach(function(p){invalid[p]=true;});
 function notice(message){var doc=win.document,n=doc.getElementById('whatsite-karo-file-error');if(!n){n=doc.createElement('p');n.id='whatsite-karo-file-error';n.setAttribute('role','alert');n.style.cssText='padding:16px;background:#311b1b;color:#fff;border:1px solid #c66;position:relative;z-index:2147483647';(doc.body||doc.documentElement).appendChild(n);}n.textContent=message;}
 function route(value){var url=new win.URL(String(value),win.location.href),original=/^(?:kar0218\.github\.io|karo218\.ir)$/i.test(url.hostname);if(original)url=new win.URL(config.base+url.pathname.replace(/^\//,''),win.location.href);
  if(url.origin===win.location.origin&&url.pathname.indexOf(config.base)===0){var p=decodeURIComponent(url.pathname.slice(config.base.length));if(invalid[p]||(/\.(?:bin|elf|bz2|m?js|php)$/i.test(p)&&!available[p])||/\.php$/i.test(p)){var message='Original KARO file unavailable or invalid: '+p+'. No replacement or alternate firmware was selected.';notice(message);throw Error(message);}}
  return url.href;
 }
 if(win.XMLHttpRequest){var open=win.XMLHttpRequest.prototype.open;win.XMLHttpRequest.prototype.open=function(method,url){var args=Array.prototype.slice.call(arguments);args[1]=route(url);return open.apply(this,args);};}
 if(win.fetch){var fetch=win.fetch;win.fetch=function(value,options){try{if(typeof value==='string'||value instanceof win.URL)return fetch.call(win,route(value),options);return fetch.call(win,value,options);}catch(e){return win.Promise.reject(e);}};}
 function disableInvalid(){Array.prototype.forEach.call(win.document.querySelectorAll('option,a,button,input'),function(node){var value=(node.value||'')+' '+(node.getAttribute('href')||'')+' '+(node.getAttribute('onclick')||'');for(var p in invalid)if(Object.prototype.hasOwnProperty.call(invalid,p)&&value.indexOf(p.split('/').pop())>=0){node.disabled=true;node.setAttribute('aria-disabled','true');node.title='Original file is invalid; preserved in the archive.';if(node.tagName==='A')node.removeAttribute('href');}});}
 win.document.addEventListener('DOMContentLoaded',function(){disableInvalid();if(win.MutationObserver)new win.MutationObserver(disableInvalid).observe(win.document.documentElement,{childList:true,subtree:true});});return{route:route};
}));
