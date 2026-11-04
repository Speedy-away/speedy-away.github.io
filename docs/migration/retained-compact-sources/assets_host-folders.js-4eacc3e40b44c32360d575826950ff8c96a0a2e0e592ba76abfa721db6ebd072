(function(){
 'use strict';
 var data=document.getElementById('host-actions-data');if(!data)return;
 var platform=(window.WWB_HOST_CATALOG||JSON.parse(data.textContent)).platform,base='/hosts/'+platform+'/';
 var labels={loaders:'Choose firmware',payloads:'Payloads',mods:'Game mods',tools:'Tools',goldhen:'Goldhen PS4',connection:'Connection & setup',sender:'Desktop sender · connect from a PC'};
 var params=new URL(location.href).searchParams,selected=params.get('view')||params.get('folder')||'loaders';
 if(!Object.prototype.hasOwnProperty.call(labels,selected))selected='loaders';
 document.querySelectorAll('.host-file-tabs a').forEach(function(link){if(new URL(link.href).searchParams.get('view')===selected)link.setAttribute('aria-current','page');});
 var firmwareControl=document.querySelector('.host-firmware-control');
 if(firmwareControl)document.getElementById('host-file-firmware').appendChild(firmwareControl);
 if(firmwareControl)firmwareControl.hidden=selected==='sender';
 var fileToolbar=document.getElementById('host-file-firmware');
 ['.host-search','#host-game-filter'].forEach(function(selector){var item=document.querySelector(selector);if(item)fileToolbar.appendChild(item);});
 var search=document.querySelector('.host-search');if(search)search.hidden=selected==='connection'||selected==='sender';
 var options=document.querySelector('.host-options'),setup=document.querySelector('.host-connection-details');if(options&&setup)setup.appendChild(options);
 var warning=document.querySelector('#host-transfer-warning');if(warning)fileToolbar.parentNode.insertBefore(warning,fileToolbar.nextSibling);
 var status=document.querySelector('#host-status'),initialStatus=status.textContent;status.hidden=true;
 new MutationObserver(function(){status.hidden=status.textContent===initialStatus;}).observe(status,{childList:true,characterData:true,subtree:true});
 var library=document.getElementById('host-folder-library');
 library.hidden=!selected||selected==='connection'||selected==='sender';
 document.querySelectorAll('[data-host-folder-panel]').forEach(function(panel){panel.hidden=panel.getAttribute('data-host-folder-panel')!==selected;});
 if(selected){
  var button=document.querySelector('[data-host-category="'+selected+'"]');
  var title=document.getElementById('host-folder-title');
    title.textContent=selected==='loaders'?labels.loaders:button?button.textContent:labels[selected];
  document.getElementById('host-folder-path').textContent=' / '+title.textContent;
  var back=document.querySelector('.host-taskbar a');back.href=selected==='loaders'?'/hosts/':base;
  if(button)button.click();
  if(selected==='sender')document.querySelector('.host-sender').open=true;
 }
 var fileCount=document.getElementById('host-file-count'),sourceCount=document.getElementById('host-action-count');
 if(fileCount&&sourceCount){var countChanged=function(){if(fileCount.textContent!==sourceCount.textContent)fileCount.textContent=sourceCount.textContent;fileCount.hidden=selected==='connection'||selected==='sender';};countChanged();new MutationObserver(countChanged).observe(sourceCount,{childList:true,characterData:true,subtree:true});}
 document.addEventListener('keydown',function(event){if(event.key==='Escape'){var more=document.querySelector('.host-utility-menu');if(more)more.open=false;}});
})();
