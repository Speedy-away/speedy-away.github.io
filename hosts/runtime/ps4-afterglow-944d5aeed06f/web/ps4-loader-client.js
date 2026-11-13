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
  return {profiles:profiles,validate:validate,sendHTTP:sendHTTP};
}));
