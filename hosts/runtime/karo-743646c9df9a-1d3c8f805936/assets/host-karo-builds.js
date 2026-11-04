/* Authored KARO entry controls. Tests use inert documents, never native source. */
(function(factory){if(typeof module==='object'&&module.exports)module.exports=factory();else window.WhatsiteKaro=factory();}(function(){
 'use strict';
 var TICKET='whatsite.karo.ticket.v1',LOCK='whatsite.karo.attempt.v1';
 function consoleInfo(ua){var m=String(ua||'').match(/PlayStation (4|5)[ \/](\d{1,2}\.\d{2})(?:\D|$)/i);return m?{platform:'ps'+m[1],firmware:m[2]}:null;}
 function numeric(fw){var p=String(fw).split('.');return Number(p[0])*100+Number(p[1]);}
 function supports(entry,info){if(!info||entry.platform!==info.platform||entry.blockedReason)return false;if((entry.firmwares||[]).indexOf(info.firmware)>=0)return true;var n=numeric(info.firmware);return (entry.ranges||[]).some(function(r){return n>=numeric(r[0])&&n<=numeric(r[1]);});}
 function read(storage,key){try{return JSON.parse(storage.getItem(key)||'null');}catch(e){return null;}}
 function locked(win){try{return !!win.localStorage.getItem(LOCK);}catch(e){return true;}}
 function authorize(win,entry,base,confirmed,trusted){
  if(!trusted||!confirmed)throw Error('Confirm the selected console and original loader before Load.');
  if(!supports(entry,consoleInfo(win.navigator.userAgent)))throw Error(entry.blockedReason||'Open this entry in its matching console browser and firmware.');
  if(win.document.visibilityState&&win.document.visibilityState!=='visible')throw Error('Keep the loader page visible.');
  if(locked(win))throw Error('A previous native attempt is saved. Check and restart the console before clearing it.');
  var now=Date.now(),ticket={entry:entry.path,scope:entry.scope||entry.path.slice(0,entry.path.lastIndexOf('/')+1),platform:entry.platform,firmware:consoleInfo(win.navigator.userAgent).firmware,base:base,expires:now+600000,started:false,visited:[],nonce:String(now)+'-'+String(Math.random()).slice(2)};
  win.localStorage.setItem(LOCK,JSON.stringify({entry:entry.path,at:now}));if(!locked(win))throw Error('The browser could not save the native-attempt guard.');
  win.sessionStorage.setItem(TICKET,JSON.stringify(ticket));if(!read(win.sessionStorage,TICKET))throw Error('The browser could not save the entry ticket.');
  return base+entry.path;
 }
 function runtimeAllowed(win,config){
  var ticket=read(win.sessionStorage,TICKET),info=consoleInfo(win.navigator.userAgent);
  if(!ticket||!info||!locked(win)||ticket.expires<Date.now()||ticket.base!==config.base||info.platform!==ticket.platform||info.firmware!==ticket.firmware||!supports(config.entry,info))throw Error('Choose this original loader on the KARO builds page first.');
  if(config.path.indexOf(ticket.scope)!==0)throw Error('This entry needs a separate explicit Load action.');
  if(win.document.visibilityState&&win.document.visibilityState!=='visible')throw Error('Keep the console browser visible.');
  var topLevel=win.top===win.self;
  if(!ticket.started){if(!topLevel||config.path!==ticket.entry)throw Error('The original entry does not match its ticket.');ticket.started=true;}
  else if(topLevel&&ticket.visited.indexOf(config.path)>=0){var last=ticket.visited[ticket.visited.length-1];if(!ticket.cacheReturnUsed&&/\/cache\.html$/i.test(last)&&config.path===ticket.entry)ticket.cacheReturnUsed=true;else throw Error('A restored or repeated original entry is blocked. Restart the console before another native attempt.');}
  if(topLevel)ticket.visited.push(config.path);
  win.sessionStorage.setItem(TICKET,JSON.stringify(ticket));return ticket;
 }
 function openOriginal(win,config){
  runtimeAllowed(win,config);
  // The original HTML parser order and relative paths are retained. Native
  // scripts/payload files stay byte-identical; only this outer page is authored.
  var original=config.original;
  original=original.replace(/https?:\/\/(?:kar0218\.github\.io|karo218\.ir)\//gi,config.base);
  var safety='<script>window.WHATSITE_KARO_RESOURCES='+JSON.stringify(config.resources).replace(/</g,'\\u003c')+';'+config.resourceGuard+'<\/script>';
  if(/<head\b[^>]*>/i.test(original))original=original.replace(/<head\b[^>]*>/i,function(head){return head+safety;});else original=safety+original;
  win.document.open();win.document.write(original);win.document.close();
 }
 function clear(win,confirmed){if(!confirmed)throw Error('Confirm that you checked and restarted the console.');win.sessionStorage.removeItem(TICKET);win.localStorage.removeItem(LOCK);if(locked(win))throw Error('The saved attempt could not be cleared.');}
 function mount(win,doc,data){
  var chooser=doc.getElementById('karo-entry'),consent=doc.getElementById('karo-confirm'),load=doc.getElementById('karo-load'),status=doc.getElementById('karo-status'),details=doc.getElementById('karo-contract'),clearButton=doc.getElementById('karo-clear'),restarted=doc.getElementById('karo-restarted'),filter=doc.getElementById('karo-search');
  function selected(){return data.entries.filter(function(e){return e.id===chooser.value;})[0];}
  function update(){var e=selected(),info=consoleInfo(win.navigator.userAgent);load.disabled=!e||!consent.checked||!supports(e,info)||locked(win);details.textContent=e?e.contract:'';status.textContent=e&&e.blockedReason?e.blockedReason:locked(win)?'Previous native attempt saved. Check the console before clearing it.':info?'Detected '+info.platform.toUpperCase()+' '+info.firmware+'. Choose its exact original build.':'Downloads work on this device. Load requires the matching console browser.';}
  chooser.addEventListener('change',function(){consent.checked=false;update();});consent.addEventListener('change',update);
  load.addEventListener('click',function(event){try{var target=authorize(win,selected(),data.runtime,consent.checked,event.isTrusted===true);load.disabled=true;win.location.href=target;}catch(e){status.textContent=e.message;load.disabled=true;}});
  clearButton.addEventListener('click',function(){try{clear(win,restarted.checked);restarted.checked=false;consent.checked=false;update();}catch(e){status.textContent=e.message;}});
  win.addEventListener('pageshow',function(e){if(e.persisted){load.disabled=true;status.textContent='Restored page: open a fresh entry after checking the console.';}});
  if(filter)filter.addEventListener('input',function(){var term=filter.value.toLowerCase();Array.prototype.forEach.call(doc.querySelectorAll('[data-karo-file]'),function(row){row.hidden=row.textContent.toLowerCase().indexOf(term)<0;});});
  var query=new win.URLSearchParams(win.location.search||''),key=query.get('entry');if(data.entries.some(function(e){return e.id===key;}))chooser.value=key;update();
 }
 return{TICKET:TICKET,LOCK:LOCK,consoleInfo:consoleInfo,numeric:numeric,supports:supports,authorize:authorize,runtimeAllowed:runtimeAllowed,openOriginal:openOriginal,clear:clear,mount:mount};
}));
