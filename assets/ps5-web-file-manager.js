(function(root,factory){
  var api=factory(typeof module==='object'&&module.exports?require('./host-console-client.js'):root.HostConsoleClient);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.PS5WebFileManager=api;api.bind(document,root);}
}(typeof window!=='undefined'?window:this,function(client){
  'use strict';
  function serviceURL(address,port,userAgent){
    address=client.normalizeAddress(address);
    if((/^127\./.test(address)||address==='localhost')&&!/PlayStation\s*5\b/i.test(userAgent||''))throw Error('Enter your PS5 LAN address when using another device.');
    if(!/^\d{4,5}$/.test(String(port))||Number(port)<8888||Number(port)>65535)throw Error('Enter the port shown by the PS5 notification (8888 by default).');
    return 'http://'+address+':'+Number(port)+'/';
  }
  function bind(doc,win){
    var button=doc.querySelector('#ps5-wfm-open');if(!button)return;
    var port=doc.querySelector('#ps5-wfm-port'),address=doc.querySelector('#host-console-address'),status=doc.querySelector('#ps5-wfm-status');
    try{port.value=win.localStorage.getItem('whatsite.ps5.file-manager.port')||'8888';}catch(_){}
    button.addEventListener('click',function(){
      try{
        var url=serviceURL(address.value,port.value,win.navigator.userAgent);
        try{win.localStorage.setItem('whatsite.ps5.file-manager.port',String(Number(port.value)));}catch(_){}
        win.open(url,'_blank','noopener');
        status.textContent='Opening '+url+' — keep PS5 Web File Manager running on the console.';
      }catch(error){status.textContent=error.message;}
    });
  }
  return {serviceURL:serviceURL,bind:bind};
}));
