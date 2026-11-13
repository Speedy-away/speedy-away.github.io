/* Optional 14.02 cache controls. Never loads a console payload. */
(function(){
 'use strict';
 var key='wwb.afterglow.1402.cache.enabled',prefix='wwb-afterglow-1402-944d5aeed06f-v1';
 var toggle=document.getElementById('cache-enabled'),button=document.getElementById('cache-now'),update=document.getElementById('cache-update'),remove=document.getElementById('cache-delete'),stop=document.getElementById('cache-stop'),status=document.getElementById('cache-status'),progress=document.getElementById('cache-progress'),help=document.getElementById('cache-delete-help');
 var busy=false,ready=false,frame=null,worker=null,starting=false,deleting=false,listeners=[],deleteListeners=[];
 function notify(){listeners.forEach(function(fn){fn();});}
 function state(text,loading,complete){status.textContent=text;busy=loading;ready=complete;button.disabled=loading;update.disabled=loading;remove.disabled=deleting;stop.disabled=!loading||deleting;progress.hidden=!loading||deleting;notify();}
 function message(data){
  if(!data||data.type!=='afterglow-cache')return;
  if(deleting&&data.state!=='deleted'&&data.state!=='delete-error')return;
  if(data.saved)ready=true;
  if(data.state==='progress'){state('Saving files · '+data.loaded+' / '+data.total,true,ready);if(data.total){progress.max=data.total;progress.value=data.loaded;}else progress.removeAttribute('value');}
  else if(data.state==='checking')state(data.update?'Checking for cache updates…':'Checking saved files…',true,ready);
  else if(data.state==='ready')state(data.updated?'Cache updated · available offline':'Cache ready · available offline',false,true);
  else if(data.state==='empty')state('No saved offline copy yet',false,false);
  else if(data.state==='stopped')state(ready?'Caching stopped · saved copy retained':'Caching stopped · retry when ready',false,ready);
  else if(data.state==='error')state('Cache failed · '+(data.reason||'check your connection')+(ready?' · previous cache retained':''),false,ready);
  else if(data.state==='deleted'){deleting=false;state('14.02 cache deleted · automatic caching off',false,false);}
  else if(data.state==='delete-error'){deleting=false;state('Cache could not be fully deleted · '+data.reason,false,false);}
 }
 function cancel(){
  starting=false;
  if(frame){try{frame.contentWindow.applicationCache.abort();}catch(e){}frame.parentNode.removeChild(frame);frame=null;}
  if(worker)worker.postMessage({type:'afterglow-cache-stop'});
  state(ready?'Caching stopped · saved copy retained':'Caching stopped · retry when ready',false,ready);
 }
 function connect(force){
  return navigator.serviceWorker.register('offline-sw.js',{scope:'./'}).then(function(reg){
   if(force&&reg.update)return reg.update().then(function(){return reg;});return reg;
  }).then(function(reg){return new Promise(function(resolve,reject){
   var active=reg.installing||reg.waiting||reg.active;if(!active)return reject(Error('Worker unavailable'));
   if(active.state==='activated')return resolve(active);
   active.addEventListener('statechange',function(){if(active.state==='activated')resolve(active);else if(active.state==='redundant')reject(Error('Cache worker could not start'));});
  });});
 }
 function cacheNow(force){
  if(busy||starting||deleting)return;help.hidden=true;
  if(!window.applicationCache&&!(navigator.serviceWorker&&window.isSecureContext)){state('Offline caching is not supported by this browser',false,false);return;}
  starting=true;state(force?'Checking for cache updates…':'Preparing offline cache…',true,ready);
  if(window.applicationCache){
   if(frame)frame.parentNode.removeChild(frame);
   frame=document.createElement('iframe');frame.hidden=true;frame.title='Offline cache';frame.src='cache-frame.html';document.body.appendChild(frame);starting=false;return;
  }
  connect(force).then(function(active){worker=active;if(!starting)return;starting=false;worker.postMessage({type:force?'afterglow-cache-update':'afterglow-cache-save'});}).catch(function(e){starting=false;state('Cache failed · '+e.message+(ready?' · previous cache retained':''),false,ready);});
 }
 function deleteCache(){
  if(deleting)return;
  deleteListeners.forEach(function(fn){fn();});
  toggle.checked=false;try{localStorage.setItem(key,'false');}catch(e){}
  cancel();help.hidden=true;
  if(window.applicationCache){help.hidden=false;state('Automatic caching off · clear website data in PS4 browser settings to delete the saved cache',false,ready);return;}
  if(!window.caches){state('Use your browser settings to clear this site’s saved data',false,ready);return;}
  deleting=true;state('Deleting the 14.02 cache…',true,ready);
  // Let the current worker stop an in-flight save before deleting its storage.
  Promise.resolve(navigator.serviceWorker?navigator.serviceWorker.getRegistration('./'):null).then(function(reg){
   if(reg&&reg.active){worker=reg.active;worker.postMessage({type:'afterglow-cache-delete'});return;}
   return window.caches.keys().then(function(names){return Promise.all(names.filter(function(name){return name===prefix||name.indexOf(prefix+'-')===0;}).map(function(name){return window.caches.delete(name);}));}).then(function(){message({type:'afterglow-cache',state:'deleted'});});
  }).catch(function(e){message({type:'afterglow-cache',state:'delete-error',reason:e.message});});
 }
 window.addEventListener('message',function(event){if(frame&&event.source===frame.contentWindow&&event.origin===location.origin)message(event.data);});
 if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('message',function(event){if(worker&&event.source===worker)message(event.data);});
 toggle.checked=false;try{toggle.checked=localStorage.getItem(key)==='true';}catch(e){}
 toggle.addEventListener('change',function(){try{localStorage.setItem(key,String(toggle.checked));}catch(e){}if(toggle.checked)cacheNow(false);else cancel();});
 button.addEventListener('click',function(){cacheNow(false);});update.addEventListener('click',function(){cacheNow(true);});remove.addEventListener('click',deleteCache);stop.addEventListener('click',cancel);
 window.AfterglowCache={isBusy:function(){return busy;},isReady:function(){return ready;},subscribe:function(fn){listeners.push(fn);},stop:cancel,onDelete:function(fn){deleteListeners.push(fn);}};
 window.addEventListener('load',function(){if(toggle.checked)cacheNow(false);else state('Automatic caching off · use Cache now to save',false,false);});
 window.addEventListener('pagehide',function(){if(busy&&!deleting)cancel();});
}());
