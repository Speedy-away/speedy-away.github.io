/* Offline status and explicit save controls only; never starts a console action. */
(function(w,d){
 'use strict';
 if(/\/hosts\/runtime\//.test(w.location.pathname))return;
 var body=d.body,platform=body&&body.getAttribute('data-host-offline-platform'),status=d.getElementById('host-offline-status'),progress=d.getElementById('host-offline-progress'),button=d.getElementById('host-offline-save');
 if(platform!=='ps4'&&platform!=='ps5'||!status&&!button)return;
 var verifyButton=d.getElementById('host-offline-verify'),summary=d.getElementById('host-offline-summary'),network=d.getElementById('host-offline-network'),savedWorker=null,workerEnhanced=false;
 function size(bytes){return (Number(bytes||0)/1048576).toFixed(1)+' MiB';}
 function info(data){if(summary&&data.files)summary.textContent=data.files+' verified files · '+size(data.bytes)+' · Version '+String(data.version||'').slice(0,12)+(data.savedAt?' · Saved '+new Date(data.savedAt).toLocaleString():'');}
 function networkStatus(){if(network)network.textContent=w.navigator.onLine===false?'Device offline':'Network connected';}
 networkStatus();if(network&&w.addEventListener){w.addEventListener('online',networkStatus);w.addEventListener('offline',networkStatus);}
 var busy=false,original=button?button.textContent:'Save for offline',app=null,manifest=d.documentElement&&d.documentElement.getAttribute('manifest');
 function text(message){if(status)status.textContent=message;}
 function running(message,loaded,total){busy=true;if(verifyButton)verifyButton.disabled=true;if(button)button.disabled=true;text(message);if(progress){progress.hidden=false;if(total>0){progress.max=total;progress.value=Math.min(loaded||0,total);}else progress.removeAttribute('value');}}
 function done(message){busy=false;if(verifyButton)verifyButton.disabled=Boolean(app&&manifest)||!workerEnhanced;if(button){button.disabled=false;button.textContent='Update offline copy';}text(message);if(progress){progress.hidden=false;progress.max=1;progress.value=1;}}
 function failure(message){busy=false;if(verifyButton)verifyButton.disabled=!savedWorker||!workerEnhanced;if(button){button.disabled=false;button.textContent=original;}text(message);if(progress)progress.hidden=true;}
 try{app=w.applicationCache;}catch(_){}
 if(app&&manifest&&typeof app.addEventListener==='function'){
  if(summary)summary.textContent='Browser-managed offline cache. Your console reports when saving is complete.';if(verifyButton){verifyButton.hidden=true;}

  app.addEventListener('checking',function(){running('Checking the saved offline copy…');});
  app.addEventListener('downloading',function(){running('Saving files for offline use…');});
  app.addEventListener('progress',function(event){running(event.total?'Saving '+event.loaded+' of '+event.total+' files…':'Saving files for offline use…',event.loaded,event.total);});
  app.addEventListener('cached',function(){done('Cache ready. Reopen the host for offline use.');});
  app.addEventListener('updateready',function(){done('Cache ready. Close and reopen the host to use the saved update.');});
  app.addEventListener('noupdate',function(){done('Cache ready. The saved offline copy is up to date.');});
  app.addEventListener('error',function(){failure('Offline save did not finish. Reconnect and retry; any earlier saved copy was kept.');});
  app.addEventListener('obsolete',function(){failure('This offline copy is unavailable. Reconnect and open offline setup again.');});
  if(app.status===1)done('Cache ready. An offline copy is saved.');else if(app.status===4)done('Cache ready. Close and reopen the host to use the saved update.');else if(app.status===2||app.status===3)running('Saving files for offline use…');else text('Offline saving starts when this page opens in a supported console browser.');
  if(button)button.addEventListener('click',function(){if(busy)return;try{running('Checking the saved offline copy…');app.update();}catch(_){failure('Open offline setup again while connected to retry saving.');}});
  return;
 }
 var service=w.navigator&&w.navigator.serviceWorker;
 if(!service||button&&typeof service.register!=='function'||w.isSecureContext===false){failure('Offline saving is not supported in this browser. Try the console browser or a current browser on HTTPS.');if(button)button.disabled=true;return;}
 function ours(worker){try{return worker&&new URL(worker.scriptURL,w.location.href).origin===w.location.origin&&new URL(worker.scriptURL,w.location.href).pathname==='/host-offline-sw.js';}catch(_){return false;}}
 service.addEventListener('message',function(event){
  var data=event.data;if(!data||data.platform!==platform||event.source&&!ours(event.source)||data.statusOnly&&busy)return;
  if(data.protocol===2)workerEnhanced=true;
  if(data.type==='PROGRESS')running('Saving '+data.completed+' of '+data.total+' files'+(data.totalBytes?' · '+size(data.bytes)+' / '+size(data.totalBytes):'')+'…',data.completed,data.total);
  else if(data.type==='VERIFY_PROGRESS')running('Checking saved files · '+data.completed+' of '+data.total+'…',data.completed,data.total);
  else if(data.type==='VERIFIED'){info(data);done('Saved files verified. All files match their checksums. Close and reopen the host to use the saved copy.');}
  else if(data.type==='CACHED'){info(data);done((data.statusOnly?'Cache ready. An offline copy is saved.':'Cache ready. Close and reopen the host for offline use.')+(!workerEnhanced&&verifyButton?' Close all host tabs and reopen setup to enable file checking.':''));}
  else if(data.type==='ERROR')failure((data.operation==='verify'?'Saved file check did not finish: ':'Offline save did not finish: ')+String(data.message||'Reconnect and retry.')+' Previous saved copies were kept.');
  else if(data.type==='STATUS'&&!data.cached&&!busy)text('No saved offline copy was found. Choose Save for offline to get started.');
 });
 function readyWorker(registration){
  var worker=ours(registration.active)?registration.active:ours(registration.waiting)?registration.waiting:registration.installing;
  if(!ours(worker))return Promise.reject(Error('Offline worker is unavailable. Close other host tabs and retry.'));
  if(worker.state==='activated'||worker.state==='installed')return Promise.resolve(worker);
  return new Promise(function(resolve,reject){var timer=w.setTimeout(function(){reject(Error('Offline setup is waiting. Close other host tabs, reopen setup and retry.'));},30000);worker.addEventListener('statechange',function(){if(worker.state==='activated'||worker.state==='installed'){w.clearTimeout(timer);resolve(worker);}else if(worker.state==='redundant'){w.clearTimeout(timer);reject(Error('Offline worker could not be installed.'));}});});
 }
 text('Checking offline status…');
 if(typeof service.getRegistration==='function')service.getRegistration('/').then(function(registration){var worker=registration&&(ours(registration.active)?registration.active:ours(registration.waiting)?registration.waiting:null);if(worker){savedWorker=worker;worker.postMessage({type:'STATUS',platform:platform});}else if(!busy)text(button?'No saved offline copy was found. Choose Save for offline to get started.':'No saved offline copy was found. Open offline setup to save this console.');}).catch(function(){if(!busy)text('Offline status could not be checked. Open offline setup to retry.');});
 else text('Open offline setup to save this console.');
 if(summary)summary.textContent='Save host pages and supported files for offline use.';
 if(verifyButton)verifyButton.addEventListener('click',function(){if(busy||!savedWorker||!workerEnhanced)return;running('Checking saved files on this device…');savedWorker.postMessage({type:'VERIFY',platform:platform});});
 if(button)button.addEventListener('click',function(){
  if(busy)return;running('Preparing offline saving…');
  Promise.resolve().then(function(){return service.register('/host-offline-sw.js',{scope:'/'});}).then(readyWorker).then(function(worker){savedWorker=worker;worker.postMessage({type:'INSTALL',platform:platform});}).catch(function(error){failure('Offline save could not start: '+String(error&&error.message||error));});
 });
}(window,document));
