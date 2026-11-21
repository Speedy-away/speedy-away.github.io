(function(){
  'use strict';
  var client=window.HostConsoleClient,api=window.PS4Loader;
  function el(id){return document.getElementById(id);}
  var form=el('loader-form'),fileInput=el('payload-file'),select=el('loader-profile'),paired='',busy=false,prepared=null;
  var local=/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(location.origin)&&!!document.querySelector('meta[name="whatwhatboy-local-sender"]');
  var config=JSON.parse(el('loader-files').textContent),fixedFirmware=config.firmware||'';
  function syncProfiles(){
    var fw=el('firmware').value.trim();
    Array.prototype.forEach.call(select.options,function(option){var p=api.profiles[option.value];option.disabled=!!(p.firmwares&&p.firmwares.indexOf(fw)<0);});
    if(select.options[select.selectedIndex].disabled){select.value='goldhen-http';changed();say('Select a loader compatible with this firmware. No payload sent.');}
  }
  function say(text){el('loader-status').textContent=text;}
  function pending(value){busy=value;Array.prototype.forEach.call(document.querySelectorAll('input,select,button'),function(x){x.disabled=value;});}
  function reset(){prepared=null;el('compatible').checked=false;el('file-details').textContent='Choose an unpacked payload. Files stay in memory.';}
  function changed(){reset();fileInput.value='';fileInput.accept=api.profiles[select.value].format==='BIN'?'.bin':'.elf';el('profile-help').textContent=select.value==='goldhen-http'?'Enable the BIN loader in your HEN settings. Port 9090 must report ready.':select.value==='bin-tcp'?'PS4 9.00 only. Wait for the native listener on 9020. Requires the paired sender.':select.value==='elf-tcp'?'Start an ELF-compatible TCP listener on 9021. Requires the paired sender.':'On 14.02 the ELF loader starts automatically when needed. Enable your HEN BIN loader on 9090 first. Older firmware needs its matching ELF loader.';}
  function read(file){return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(new Uint8Array(r.result));};r.onerror=function(){reject(Error('Could not read the selected file.'));};r.readAsArrayBuffer(file);});}
  function safeName(name,format){var n=name.replace(/[^a-zA-Z0-9_.-]/g,'_');return n.length>100?'payload.'+format.toLowerCase():n;}
  function limitedFetch(url,init,timeout){var timer,controller=typeof AbortController!=='undefined'?new AbortController():null;if(controller)init.signal=controller.signal;return Promise.race([fetch(url,init).then(function(r){return r.json();}),new Promise(function(_,reject){timer=setTimeout(function(){if(controller)controller.abort();reject(Error('Request timed out.'));},timeout||20000);})]).then(function(x){clearTimeout(timer);return x;},function(e){clearTimeout(timer);throw e;});}
  el('pairing').hidden=!local;el('sender-setup').hidden=local;
  var detected=/PlayStation 4[ /](\d{1,2}\.\d{2})/.exec(navigator.userAgent);if(detected){el('firmware').value=detected[1];el('console-address').value='127.0.0.1';}
  var requested=/(?:^|[?&])firmware=(\d{1,2}\.\d{2})(?:&|$)/.exec(location.search||'');
  if(fixedFirmware){el('firmware').value=fixedFirmware;el('firmware').readOnly=true;}
  else if(!detected&&requested)el('firmware').value=requested[1];
  el('firmware').addEventListener('input',syncProfiles);syncProfiles();
  select.addEventListener('change',function(){changed();say('No payload sent. Select a file for this loader.');});fileInput.addEventListener('change',function(){reset();say('File selected. Confirm compatibility, then press Send payload.');});
  el('sender-token').addEventListener('input',function(){paired='';});
  el('pair-sender').addEventListener('click',function(){
    if(busy)return;var token=el('sender-token').value.trim();if(!/^[a-f0-9]{64}$/i.test(token)){say('Enter the pairing token printed by the local sender.');return;}
    pending(true);limitedFetch('/api/loader-status',{headers:{'X-Whatsite-Token':token},cache:'no-store'}).then(function(out){if(out.status!=='connected'||!out.ps4LoaderUpload||!out.ps4ELFAutostart)throw Error(out.message||'Update the local sender.');paired=token;say('Sender connected. No payload sent.');}).catch(function(e){paired='';say(e.message);}).then(function(){pending(false);});
  });
  el('prepare-elf').addEventListener('click',function(){
    if(busy)return;select.value='goldhen-http';changed();fileInput.required=false;pending(true);say('Preparing the pinned ELF-loader BIN…');
    fetch(config.bin.url,{credentials:'omit',redirect:'error'}).then(function(r){if(!r.ok)throw Error('ELF-loader download failed.');return r.arrayBuffer();}).then(function(b){var data=new Uint8Array(b);if(data.length!==config.bin.bytes||client.sha256(data)!==config.bin.sha256)throw Error('ELF-loader checksum mismatch.');prepared={data:data,name:'elfldr.bin'};el('file-details').textContent='elfldr.bin · '+data.length+' bytes · SHA-256 '+config.bin.sha256;say('ELF-loader BIN selected. Confirm compatibility, then press Send payload.');}).catch(function(e){reset();fileInput.required=true;say(e.message);}).then(function(){pending(false);});
  });
  fileInput.addEventListener('change',function(){fileInput.required=true;});
  form.addEventListener('submit',function(event){
    event.preventDefault();if(busy)return;
    var profile=select.value,p=api.profiles[profile],file=fileInput.files[0],chosen=prepared,meta;
    try{
      if(!chosen&&!file)throw Error('Choose a payload file.');
      if(!chosen&&file.size>p.max)throw Error('This file is too large for the selected loader.');
      meta={profile:profile,address:client.normalizeAddress(el('console-address').value),firmware:el('firmware').value.trim(),name:safeName(chosen?chosen.name:file.name,p.format),bytes:chosen?chosen.data.length:file.size,sha256:Array(65).join('0'),compatible:el('compatible').checked};
      if(fixedFirmware&&meta.firmware!==fixedFirmware)throw Error('This page is for PS4 '+fixedFirmware+'.');
      if(chosen&&chosen.action&&chosen.action.firmwares.indexOf(meta.firmware)<0)throw Error('This WebKitty build is pinned to 14.02. Select the correct firmware.');
      if(chosen&&chosen.action&&chosen.action.confirmBeforeLoad&&!window.confirm(chosen.action.confirmBeforeLoad))return;
      api.validate(meta);
      if(local&&!paired)throw Error('Connect using the local sender pairing token first.');
      if(!local&&(/^https:/.test(location.protocol)||p.sender))throw Error('Download and open the local sender below for this loader.');
      if(!local&&meta.address==='127.0.0.1'&&!detected)throw Error('Enter your console LAN IP. Loopback here is this computer.');
    }catch(e){say(e.message);return;}
    pending(true);say('Checking file…');
    (chosen?Promise.resolve(chosen.data):read(file)).then(function(data){
      meta.sha256=client.sha256(data);api.validate(meta,data);el('file-details').textContent=meta.name+' · '+meta.bytes+' bytes · SHA-256 '+meta.sha256;say('Sending once to '+meta.address+':'+p.port+'…');
      if(local)return limitedFetch('/api/loader-file',{method:'POST',headers:{'X-Whatsite-Token':paired,'X-Whatsite-Loader':JSON.stringify(meta),'Content-Type':'application/octet-stream'},body:data},45000).catch(function(e){throw Error('Transfer result unknown. Check the console before retrying. '+e.message);});
      return api.sendAutoELF(meta,data,{origin:location.origin,normalizeAddress:client.normalizeAddress,sha256:client.sha256,bootstrapURL:config.bin.url,fetch:window.fetch.bind(window)});
    }).then(function(out){say(out.message||'No result reported. Check the console.');}).catch(function(e){say(e.message);}).then(function(){el('compatible').checked=false;pending(false);});
  });
  var library=el('webkitty-payload'),prepareLibrary=el('prepare-webkitty');
  if(library&&prepareLibrary){
    (config.payloads||[]).forEach(function(action){var o=document.createElement('option');o.value=action.id;o.textContent=action.label+' · '+action.format;library.appendChild(o);});
    library.addEventListener('change',function(){var a=(config.payloads||[]).filter(function(x){return x.id===library.value;})[0];el('webkitty-requirements').textContent=a?a.requirements.join(' '):'';});
    prepareLibrary.addEventListener('click',function(){
      if(busy)return;
      var action=(config.payloads||[]).filter(function(x){return x.id===library.value;})[0];
      if(!action){say('Choose a library payload first.');return;}
      if(el('firmware').value.trim()!=='14.02'){say('These builds are pinned to 14.02. Set your installed firmware before selecting.');return;}
      select.value=action.format==='ELF'?'elf-http':'goldhen-http';changed();pending(true);say('Checking the pinned library file…');
      fetch(action.downloadURL,{credentials:'omit',redirect:'error'}).then(function(r){if(!r.ok)throw Error('Payload download failed.');return r.arrayBuffer();}).then(function(b){
        var data=new Uint8Array(b);if(data.length!==action.bytes||client.sha256(data)!==action.sha256)throw Error('Payload checksum mismatch. Nothing was sent.');
        prepared={data:data,name:action.downloadURL.split('/').pop(),action:action};fileInput.required=false;
        el('file-details').textContent=action.label+' · '+data.length+' bytes';say('Payload selected. Review requirements, confirm compatibility, then Send payload.');
      }).catch(function(e){reset();fileInput.required=true;say(e.message);}).then(function(){pending(false);});
    });
  }

  changed();
}());
