/* Local chooser preferences. Does not import any console runtime. */
(function(){
 'use strict';
 var key='wwb.afterglow.1402.settings.v1',defaults={advanced:true,retry:true,reload:true,barebone:false},values={},nodes={};
 var panel=document.getElementById('settings-panel'),button=document.getElementById('settings-open'),close=document.getElementById('settings-close');
 try{values=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(e){}
 function apply(){document.getElementById('advanced-payloads').hidden=!nodes.advanced.checked;}
 Object.keys(defaults).forEach(function(name){var node=nodes[name]=document.getElementById('setting-'+name);node.checked=typeof values[name]==='boolean'?values[name]:defaults[name];node.addEventListener('change',function(){var saved={};Object.keys(nodes).forEach(function(k){saved[k]=nodes[k].checked;});try{localStorage.setItem(key,JSON.stringify(saved));}catch(e){}apply();});});
 var auto=document.getElementById('setting-auto');
 window.AfterglowSettingsUpdated=function(){auto.checked=window.AfterglowLanding.isAuto();auto.disabled=document.getElementById('auto').disabled;};
 auto.addEventListener('change',function(){window.AfterglowLanding.setAuto(auto.checked);});
 function show(open){panel.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open){window.AfterglowLanding.stop();close.focus();}else button.focus();}
 button.addEventListener('click',function(){show(panel.hidden);});close.addEventListener('click',function(){show(false);});
 document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!panel.hidden)show(false);});
 window.AfterglowSettingsUpdated();apply();
}());
