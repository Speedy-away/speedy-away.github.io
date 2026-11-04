/* Authored controller only. Original native code is fetched as data, hash checked,
   and opened only after an explicit action on an actual PS4 6.72 browser. */
(function (factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else window.WhatsiteArabic672 = factory();
}(function () {
  'use strict';
  var KEY = 'whatsite.arabicguy672.attempt.v1';
  function actualConsole(ua) { return /PlayStation 4[\/ ]6\.72(?:\D|$)/i.test(String(ua || '')) && !/PlayStation 5/i.test(ua); }
  function text(data) { var out=''; for(var i=0;i<data.length;i+=8192)out+=String.fromCharCode.apply(null,data.subarray(i,Math.min(i+8192,data.length)));return decodeURIComponent(escape(out)); }
  function verify(data,pin,hash) { if(!pin||data.length!==pin.bytes||hash(data)!==pin.sha256)throw Error('File identity mismatch: '+(pin&&pin.path||'unknown'));return data; }
  function bootSource(html,pin,hash) { var match=html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);if(!match)throw Error('Original bootstrap missing');var b=unescape(encodeURIComponent(match[1])),bytes=new Uint8Array(b.length);for(var i=0;i<b.length;i++)bytes[i]=b.charCodeAt(i);verify(bytes,pin,hash);return match[1]; }
  function fetchOriginal(win,pin,hash) {
    return new win.Promise(function(resolve,reject){
      var url=new win.URL(pin.url);if(url.protocol!=='https:'||url.hostname!=='raw.githubusercontent.com'||!/^\/GamerHack\/GamerHack\.github\.io\/[a-f0-9]{40}\/672\//.test(url.pathname)||url.search||url.hash){reject(Error('Unapproved source URL'));return;}
      var x=new win.XMLHttpRequest(),done=false;
      function fail(message){if(done)return;done=true;reject(Error(message));}
      x.open('GET',pin.url,true);x.responseType='arraybuffer';x.timeout=30000;
      x.onprogress=function(e){if(e.loaded>pin.bytes){x.abort();fail('Original file exceeds its exact size');}};
      x.onerror=function(){fail('Original source unavailable; no native code started');};x.ontimeout=x.onerror;x.onabort=function(){fail('Original request stopped');};
      x.onload=function(){if(done)return;try{if(x.status!==200||!x.response||x.responseURL&&x.responseURL!==pin.url)throw Error('Original source response rejected');var bytes=verify(new Uint8Array(x.response),pin,hash);done=true;resolve(bytes);}catch(e){fail(e.message);}};
      x.send();
    });
  }
  function createSession(env,pins,hash) {
    var state='idle',prepared=null,selected=null,nativeStarted=false;
    function allowed(){if(!actualConsole(env.userAgent())||!env.visible()||env.restored&&env.restored())throw Error('Open a fresh page on PS4 firmware 6.72');if(env.blocked())throw Error('Previous native attempt: restart the console before another attempt');}
    function prepare(key,confirmed,trusted){
      if(state!=='idle')return env.reject(Error('A preparation is already active'));
      try{allowed();if(!trusted||!confirmed||!pins.builds[key])throw Error('Confirm the exact game update before preparing');if(!env.features())throw Error('Original browser prerequisites are unavailable');}catch(e){return env.reject(e);}
      state='fetching';selected=pins.builds[key];
      return env.all([env.fetch(pins.html),env.fetch(pins.kernel),env.fetch(pins.loader),env.fetch(selected)]).then(function(files){
        allowed(); // Never execute after changing browser, hiding or restoring the page.
        var boot=bootSource(text(files[0]),pins.boot,hash),kernel=text(files[1]),loader=text(files[2]);
        // The source bytes have been verified by fetch; the native stages never run in tests.
        if(!/function jailbreak2\(\)/.test(kernel)||loader.indexOf('function PL_loader()')<0||loader.indexOf('req.responseType="arraybuffer"')<0)throw Error('Original loader contract changed');
        return env.preparePayload(files[3],selected).then(function(memory){
          allowed();prepared={loader:loader,payload:memory};env.lock();nativeStarted=true;state='native-preparation';
          env.bootstrap(boot,kernel); // One original WebKit + jb2 preparation; no retry.
          if(!env.kernelReady())throw Error('Original kernel stage did not report its success branch');
          state='ready';return {state:state,gameVersion:selected.gameVersion};
        });
      }).catch(function(e){state=nativeStarted?'locked':'idle';throw e;});
    }
    function load(trusted){
      if(state!=='ready'||!trusted||!actualConsole(env.userAgent())||!env.visible()||env.restored&&env.restored())throw Error('Prepare the original loader on this console first');
      // Mark before crossing the native boundary. Every error remains uncertain.
      state='attempted';env.lock();env.load(prepared.loader,prepared.payload,selected);prepared=null;
      return {state:state,executionConfirmed:false};
    }
    return {prepare:prepare,load:load,state:function(){return state;}};
  }
  function mount(win,doc,pins,hash) {
    var byId=function(id){return doc.getElementById(id);},prepare=byId('prepare'),load=byId('load'),select=byId('build'),confirm=byId('confirm'),status=byId('status'),nativeError=false,passBefore=0,failBefore=0,restored=false;
    try{restored=win.performance.navigation.type===2;}catch(_){}
    var language=byId('language');
    function translate(){var code=language.value,table=win.ARABIC672_I18N||{};doc.documentElement.lang=code;doc.documentElement.dir=['ar','he'].indexOf(code)>=0?'rtl':'ltr';var nodes=doc.querySelectorAll('[data-i18n]');for(var n=0;n<nodes.length;n++){var key=nodes[n].getAttribute('data-i18n');nodes[n].textContent=table[key]&&table[key][code]||key;}try{win.localStorage.setItem('scooby.lang',code);}catch(_){}}
    if(language){try{var saved=win.localStorage.getItem('scooby.lang');if(saved&&language.querySelector('option[value="'+saved.replace(/[^a-z]/g,'')+'"]'))language.value=saved;}catch(_){}language.addEventListener('change',translate);translate();}
    var say=function(value){status.textContent=value;};
    var blocked=function(){try{return !!win.sessionStorage.getItem(KEY);}catch(_){return true;}};
    function inject(code){var script=doc.createElement('script');script.text=code;doc.head.appendChild(script);if(nativeError)throw Error('Original runtime reported an error; restart the console');}
    function lock(){win.sessionStorage.setItem(KEY,'attempted');}
    var env={userAgent:function(){return win.navigator.userAgent;},visible:function(){return !doc.hidden;},restored:function(){return restored;},blocked:blocked,features:function(){return !!(win.applicationCache&&win.applicationCache.addEventListener&&win.XMLHttpRequest&&win.Blob&&win.URL&&win.URL.createObjectURL&&win.Uint8Array&&win.Promise);},reject:function(e){return win.Promise.reject(e);},all:function(p){return win.Promise.all(p);},fetch:function(pin){return fetchOriginal(win,pin,hash);},lock:lock,
      preparePayload:function(bytes,pin){return new win.Promise(function(resolve,reject){
        var url=win.URL.createObjectURL(new win.Blob([bytes],{type:'application/octet-stream'})),x=new win.XMLHttpRequest(),done=false;
        function fail(){if(done)return;done=true;win.URL.revokeObjectURL(url);reject(Error('The original Blob/ArrayBuffer input path is unavailable; no native code started'));}
        x.open('GET',url,true);x.responseType='arraybuffer';x.timeout=10000;x.onerror=fail;x.ontimeout=fail;x.onabort=fail;
        x.onload=function(){if(done)return;try{if(!x.response||x.status!==0&&x.status!==200)throw Error('Blob read failed');verify(new Uint8Array(x.response),pin,hash);done=true;resolve({url:url});}catch(_){fail();}};x.send();
      });},
      bootstrap:function(boot,kernel){
        ['msgs','msgs2','msgs3','passCounter','failCounter'].forEach(function(id){win[id]=byId(id);});
        if(win.localStorage.passcount==null)win.localStorage.passcount=0;if(win.localStorage.failcount==null)win.localStorage.failcount=0;
        passBefore=Number(win.localStorage.passcount);failBefore=Number(win.localStorage.failcount);
        if(!isFinite(passBefore)||!isFinite(failBefore)||Math.floor(passBefore)!==passBefore||passBefore<0||passBefore>1000000000)throw Error('Original counters are invalid');
        win.LoadedMSG='Original kernel preparation returned; check the console.';
        inject(boot);if(typeof win.malloc!=='function'||typeof win.write_mem!=='function'||typeof win.pivot!=='function')throw Error('Original WebKit primitives unavailable');
        inject(kernel);if(typeof win.jailbreak2!=='function')throw Error('Original kernel entry unavailable');win.jailbreak2();
      },
      kernelReady:function(){return !nativeError&&Number(win.localStorage.passcount)===passBefore+1&&Number(win.localStorage.failcount)===failBefore;},
      load:function(loader,memory){
        win.PLfile=memory.url;
        win.LoadedMSG='Menu dispatched to the original native loader. Execution is unconfirmed; check the console.';
        inject(loader); // Original loader reads the already verified bytes through a Blob URL.
        // Do not revoke the Blob or permit another menu while original XHR/pivot is pending.
      }};
    var session=createSession(env,pins,hash),key=win.location.search.match(/^\?build=(100|127|132)$/);if(key)select.value=key[1];
    function updateDownload(){var p=pins.builds[select.value];byId('download').href=p.url;byId('download').download=p.filename;byId('game-update').textContent=p.gameVersion;byId('checksum').textContent=p.sha256;}
    select.addEventListener('change',updateDownload);updateDownload();load.disabled=true;
    function refresh(){prepare.disabled=!actualConsole(win.navigator.userAgent)||blocked()||restored||!confirm.checked;select.disabled=blocked()||restored;}
    confirm.addEventListener('change',refresh);refresh();
    if(!actualConsole(win.navigator.userAgent))say('Console-only: PS4 firmware 6.72 is required. No upstream runtime was requested or executed.');
    else if(blocked())say('Previous native attempt detected. Restart the console before clearing this warning.');
    prepare.addEventListener('click',function(e){
      prepare.disabled=true;select.disabled=true;confirm.disabled=true;say('Verifying original files before preparing the native loader…');
      session.prepare(select.value,confirm.checked,e.isTrusted!==false).then(function(){load.disabled=false;say('Original kernel stage reported ready. Choose Load once, then check the console.');},function(error){say(error.message);if(session.state()==='idle'){select.disabled=false;confirm.disabled=false;refresh();}});
    });
    load.addEventListener('click',function(e){load.disabled=true;try{session.load(e.isTrusted!==false);say('Load attempted once. Delivery and execution are unconfirmed; inspect the console.');}catch(error){say(error.message);}});
    win.addEventListener('error',function(){if(session.state()==='native-preparation'||session.state()==='ready'||session.state()==='attempted'){nativeError=true;prepare.disabled=true;load.disabled=true;say('Original runtime error. No retry was sent; restart the console.');}});
    win.addEventListener('pagehide',function(){if(session.state()!=='idle'&&session.state()!=='fetching')lock();});
    win.addEventListener('pageshow',function(e){if(e.persisted){restored=true;prepare.disabled=true;load.disabled=true;select.disabled=true;say('Restored page blocked. Restart the console and open a fresh page.');}});
    byId('clear').addEventListener('click',function(e){if(e.isTrusted===false||!byId('restarted').checked)return;win.sessionStorage.removeItem(KEY);win.location.replace(win.location.pathname+win.location.search);});
    return session;
  }
  return {actualConsole:actualConsole,verify:verify,bootSource:bootSource,fetchOriginal:fetchOriginal,createSession:createSession,mount:mount};
}));
