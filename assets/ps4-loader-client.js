/* PS4 loader transports. Importing this module never contacts a console. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PS4Loader = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var profiles = {
    'goldhen-http': {label:'GoldHEN / nexHEN BIN · HTTP 9090', format:'BIN', port:9090, max:32*1024*1024},
    'elf-http': {label:'WebKitty ELF loader · HTTP 9021', format:'ELF', port:9021, max:32*1024*1024},
    'elf-tcp': {label:'ELF loader · TCP 9021', format:'ELF', port:9021, max:32*1024*1024, sender:true},
    'bin-tcp': {label:'PSFree / Lapse 9.00 BIN · TCP 9020', format:'BIN', port:9020, max:0x300000, sender:true, firmwares:['9.00']}
  };
  function fail(code, message) { var e = new Error(message); e.code=code; return e; }
  function validate(meta, data) {
    if (!meta || Object.keys(meta).some(function(k){return ['profile','address','firmware','name','bytes','sha256','compatible'].indexOf(k)<0;})) throw fail('invalid-metadata','Invalid loader selection.');
    var p = Object.prototype.hasOwnProperty.call(profiles,meta.profile) && profiles[meta.profile];
    if (!p || !/^\d{1,2}\.\d{2}$/.test(meta.firmware || '') || Number(meta.firmware)<4.71 || Number(meta.firmware)>14.02 || p.firmwares && p.firmwares.indexOf(meta.firmware)<0) throw fail('firmware-mismatch','Choose the correct firmware and a supported loader. TCP 9020 here is pinned to PS4 9.00.');
    if (meta.compatible!==true) throw fail('compatibility-required','Confirm that this file matches your firmware, game and active loader.');
    if (typeof meta.address!=='string' || !/^[a-z0-9.-]{1,253}$/i.test(meta.address)) throw fail('invalid-address','Enter a console address without a URL or port.');
    if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(meta.name||'') || meta.name.slice(-4).toLowerCase()!=='.'+p.format.toLowerCase()) throw fail('invalid-format','Select a '+p.format+' file for this loader.');
    if (typeof meta.bytes!=='number' || Math.floor(meta.bytes)!==meta.bytes || meta.bytes<1 || meta.bytes>p.max || !/^[a-f0-9]{64}$/.test(meta.sha256||'')) throw fail('invalid-file-size','The file size or SHA-256 is invalid for this loader.');
    if (data) {
      var bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      if (bytes.length!==meta.bytes) throw fail('file-size-mismatch','The file size changed. Nothing was sent.');
      var elf = bytes[0]===127 && bytes[1]===69 && bytes[2]===76 && bytes[3]===70;
      if (p.format==='ELF' && (!elf || bytes.length<64 || bytes[4]!==2 || bytes[5]!==1 || bytes[18]!==62 || bytes[19]!==0)) throw fail('invalid-elf','Select a 64-bit little-endian x86 ELF for PS4.');
      if (p.format==='BIN' && (elf || bytes[0]===80 && bytes[1]===75 || bytes[0]===82 && bytes[1]===97 && bytes[2]===114)) throw fail('invalid-bin','Select an unpacked flat BIN, not an ELF, ZIP or RAR.');
    }
    return p;
  }
  function sendHTTP(meta, data, options) {
    var p=validate(meta,data), fetcher=options.fetch, posted=false;
    if (p.sender) throw fail('sender-required','Use the paired local sender for raw TCP.');
    if (/^https:/i.test(options.origin||'')) throw fail('mixed-content','Open this page in the local sender to reach the console HTTP loader.');
    function request(url, init, json) {
      var timer, controller=typeof AbortController!=='undefined'?new AbortController():null;
      if(controller)init.signal=controller.signal;
      var pending=Promise.resolve().then(function(){return fetcher(url,init);}).then(function(r){if(json){if(!r||!r.ok)throw fail('loader-unavailable','The BIN loader status could not be read.');return r.json();}return r;});
      return Promise.race([pending,new Promise(function(_,reject){timer=setTimeout(function(){if(controller)controller.abort();reject(fail('loader-timeout','The loader request timed out.'));},options.timeoutMs||15000);})]).then(function(out){clearTimeout(timer);return out;},function(e){clearTimeout(timer);throw e;});
    }
    var base='http://'+options.normalizeAddress(meta.address)+':'+p.port;
    var readiness=meta.profile==='goldhen-http'?request(base+'/status',{method:meta.address==='127.0.0.1'?'POST':'GET',mode:'cors',credentials:'omit',redirect:'error',cache:'no-store'},true).then(function(body){
        if(!body || body.status!=='ready') throw fail('loader-busy','Enable the BIN loader and wait until it is ready.');
      }):Promise.resolve();
    return readiness.then(function(){
      var route=meta.profile==='elf-http'?'/'+encodeURIComponent(meta.name)+'?pipe=0':'/';
      posted=true;
      return request(base+route,{method:'POST',mode:'cors',credentials:'omit',redirect:'error',headers:{'Content-Type':'text/plain'},body:data});
    }).then(function(response){
      if(!response || [200,202].indexOf(response.status)<0) {
        if(response && response.status>=400 && response.status<500) posted=false;
        throw fail('loader-rejected','The loader did not acknowledge the transfer.');
      }
      return {status:'accepted',code:'loader-accepted',message:'Loader accepted the bytes. Check the console for the result.',port:p.port,bytes:meta.bytes};
    }).catch(function(e) {
      if(posted){e.mayHaveExecuted=true;e.message='Transfer result unknown. Check the console before trying again. '+e.message;}
      throw e;
    });
  }
  // Pinned flat loader; this setup transfer only happens after an explicit Load.
  var elfBootstrap = {url:'/downloads/host-payloads/webkitty/ff181af62e0c/elfldr.bin',bytes:351460,sha256:'e66bbf87e4b5cc961a6ac1ddabca22c8c7a5e965c2a31e22e435a61fe83fdcfe'};
  function boundedFetch(fetcher,url,init,timeoutMs,bodyType) {
    var timer,controller=typeof AbortController!=='undefined'?new AbortController():null;
    if(controller)init.signal=controller.signal;
    return Promise.race([Promise.resolve().then(function(){return fetcher(url,init);}).then(function(r){
      if(bodyType){if(!r||!r.ok)throw fail('download-failed','Could not read the pinned payload file.');return r[bodyType]();}return r;
    }),new Promise(function(_,reject){timer=setTimeout(function(){if(controller)controller.abort();reject(fail('loader-timeout','The loader request timed out.'));},timeoutMs);})]).then(function(r){clearTimeout(timer);return r;},function(e){clearTimeout(timer);throw e;});
  }
  function sendAutoELF(meta,data,options) {
    validate(meta,data);
    if(meta.profile!=='elf-http'||meta.firmware!=='14.02')return sendHTTP(meta,data,options);
    if(/^https:/i.test(options.origin||''))throw fail('mixed-content','Open the paired local sender to start the console ELF loader.');
    var address=options.normalizeAddress(meta.address),fetcher=options.fetch,started=false;
    var pause=options.pause||function(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});};
    function probe(){return boundedFetch(fetcher,'http://'+address+':9021/',{method:'GET',mode:'cors',credentials:'omit',redirect:'error',cache:'no-store'},options.probeTimeoutMs||1500).then(function(r){
      // An HTTP response establishes the HTTP service, never interpret a raw
      // legacy BIN port as an ELF loader. A failed probe contains no payload.
      return !!r && r.status>=200 && r.status<500;
    },function(){return false;});}
    function bootstrap(){
      var load=options.readBootstrap?options.readBootstrap():boundedFetch(fetcher,options.bootstrapURL||elfBootstrap.url,{method:'GET',credentials:'omit',redirect:'error'},options.timeoutMs||15000,'arrayBuffer');
      return Promise.resolve(load).then(function(b){
        var bytes=new Uint8Array(b);
        if(bytes.length!==elfBootstrap.bytes||!options.sha256||options.sha256(bytes)!==elfBootstrap.sha256)throw fail('checksum-mismatch','ELF-loader checksum mismatch. Nothing was sent.');
        var setup={profile:'goldhen-http',address:address,firmware:meta.firmware,name:'elfldr.bin',bytes:bytes.length,sha256:elfBootstrap.sha256,compatible:true};
        return sendHTTP(setup,bytes,options);
      }).then(function(){started=true;return pause(options.startDelayMs===undefined?3000:options.startDelayMs);});
    }
    function waitReady(left){return probe().then(function(ready){if(ready)return;if(left<=1)throw fail('elf-start-failed','The ELF loader did not become ready. The selected ELF was not sent.');return pause(500).then(function(){return waitReady(left-1);});});}
    return probe().then(function(ready){if(ready)return;return bootstrap().then(function(){return waitReady(4);});}).then(function(){
      // Never resend an ELF or restart a loader after a possibly accepted POST.
      return sendHTTP(meta,data,options);
    }).then(function(out){out.elfLoaderStarted=started;return out;});
  }
  function sendCatalogue(address,action,options){
    options=options||{};
    var url=action&&action.downloadURL;
    if(!action||action.platform!=='ps4'||action.format!=='ELF'||!/^\/downloads\/[a-zA-Z0-9_./-]+\.elf$/.test(url||'')||url.indexOf('..')>=0)throw fail('invalid-action','Choose a verified PS4 ELF.');
    if((action.firmwares||[]).length&&action.firmwares.indexOf(options.firmware)<0)throw fail('firmware-mismatch','Choose a payload matching the installed firmware.');
    var meta={profile:'elf-http',address:address,firmware:options.firmware,name:url.split('/').pop(),bytes:action.bytes,sha256:action.sha256,compatible:true};
    validate(meta);
    if(/^https:/i.test(options.origin||''))throw fail('mixed-content','Open the paired local sender to load this ELF.');
    return boundedFetch(options.fetch,url,{method:'GET',credentials:'omit',redirect:'error'},options.timeoutMs||15000,'arrayBuffer').then(function(b){
      var data=new Uint8Array(b);validate(meta,data);if(options.sha256(data)!==meta.sha256)throw fail('checksum-mismatch','The payload checksum changed. Nothing was sent.');
      return sendAutoELF(meta,data,options);
    });

  return {profiles:profiles,validate:validate,sendHTTP:sendHTTP,sendAutoELF:sendAutoELF,sendCatalogue:sendCatalogue,elfBootstrap:elfBootstrap};
}));
