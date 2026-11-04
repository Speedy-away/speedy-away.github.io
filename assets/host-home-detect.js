/* Browser information only. No console requests, storage, redirects or loaders. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.WWBHomeDetect=api;api.mount(root.document,root);}}(typeof window!=='undefined'?window:this,function(){
 'use strict';
 function detect(userAgent){var ua=String(userAgent||''),consoleMatch=ua.match(/PlayStation\s*(4|5)(?:[\/;\s)]|$)/i),version=ua.match(/PlayStation\s*[45][\/\s]+(\d{1,2}\.\d{1,2})(?=[\s;)\]]|$)/i);return{console:consoleMatch?'PS'+consoleMatch[1]:null,firmware:consoleMatch&&version?version[1]:null};}
 function mount(doc,win){var consoleNode=doc&&doc.getElementById('home-detected-console'),firmwareNode=doc&&doc.getElementById('home-detected-firmware');if(!consoleNode||!firmwareNode)return;var result=detect(win.navigator&&win.navigator.userAgent);
  function text(source){return win.__scoobyI18n&&win.__scoobyI18n.t?win.__scoobyI18n.t(source):source;}
  function render(){consoleNode.textContent=result.console||text('Not detected');firmwareNode.textContent=result.firmware||text('Not detected');consoleNode.setAttribute('data-i18n-skip','');firmwareNode.setAttribute('data-i18n-skip','');var cards=doc.querySelectorAll('[data-home-console]');for(var i=0;i<cards.length;i++){var card=cards[i],matches=result.console&&card.getAttribute('data-home-console')===result.console.toLowerCase();if(matches)card.setAttribute('data-browser-console','true');else card.removeAttribute('data-browser-console');}}
  render();if(win.addEventListener)win.addEventListener('scooby:langchange',render);return result;
 }
 return{detect:detect,mount:mount};
}));
