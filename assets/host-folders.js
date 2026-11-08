(function(){
 'use strict';
 var data=document.getElementById('host-actions-data');if(!data)return;
 var platform=(window.WWB_HOST_CATALOG||JSON.parse(data.textContent)).platform;
 var shortPath=location.pathname.indexOf('/'+platform+'/')===0;
 var base=(shortPath?'/':'/hosts/')+platform+'/';
 var labels={loaders:'Choose firmware',payloads:'Payloads',mods:'Mods / Mod Menus',tools:'Tools',goldhen:'Goldhen PS4',connection:'Connection & setup',sender:'Desktop sender · connect from a PC'};
 var params=new URL(location.href).searchParams;
 var fixedView=document.documentElement.getAttribute('data-host-view');
 var selected=fixedView||params.get('view')||params.get('folder')||'loaders';
 if(!Object.prototype.hasOwnProperty.call(labels,selected))selected='loaders';
 document.querySelectorAll('.host-file-tabs a').forEach(function(link){
  var linkView=link.getAttribute('data-host-view')||new URL(link.href).searchParams.get('view');
  if(linkView===selected)link.setAttribute('aria-current','page');
 });
 var firmwareControl=document.querySelector('.host-firmware-control');
 if(firmwareControl)document.getElementById('host-file-firmware').appendChild(firmwareControl);
 var fileToolbar=document.getElementById('host-file-firmware');
 fileToolbar.hidden=selected==='connection'||selected==='sender';
 if(firmwareControl&&selected!=='loaders'){
  var firmwareSettings=document.createElement('details');
  firmwareSettings.className='wwb-firmware-settings';
  var firmwareSummary=document.createElement('summary');
  firmwareSummary.textContent='Installed firmware for Load';
  firmwareSettings.appendChild(firmwareSummary);
  firmwareSettings.appendChild(firmwareControl);
  fileToolbar.appendChild(firmwareSettings);
 }
 ['#host-game-filter'].forEach(function(selector){var item=document.querySelector(selector);if(item)fileToolbar.appendChild(item);});
 var options=document.querySelector('.host-options'),setup=document.querySelector('.host-connection-details');if(options&&setup)setup.appendChild(options);
 // Keep the firmware heading above Load, and alternative hosts below the choices.
 var actionGrid=document.getElementById('host-action-grid');
 if(selected==='loaders'&&actionGrid&&actionGrid.parentNode)actionGrid.parentNode.insertBefore(fileToolbar,actionGrid.nextSibling);
 if(selected==='loaders'&&firmwareControl&&actionGrid){
  var heading=document.createElement('div');heading.className='host-firmware-control';
  var headingRow=firmwareControl.querySelector('.host-firmware-heading'),firmwareStatus=document.getElementById('host-firmware-status');
  if(headingRow)heading.appendChild(headingRow);if(firmwareStatus)heading.appendChild(firmwareStatus);
  actionGrid.parentNode.insertBefore(heading,actionGrid);
  var firmwareFocus=null;
  window.WWB_HOST_LAYOUT=function(beforeRender){
   if(beforeRender){firmwareFocus=fileToolbar.contains(document.activeElement)?document.activeElement:null;if(fileToolbar.parentNode===actionGrid)actionGrid.parentNode.insertBefore(fileToolbar,actionGrid.nextSibling);return;}
   var other=actionGrid.querySelector('.host-other-hosts');
   if(other){other.querySelector('summary').textContent='Other';fileToolbar.style.gridColumn='1 / -1';fileToolbar.style.width='100%';fileToolbar.style.maxWidth='none';firmwareControl.style.maxWidth='none';firmwareControl.style.flex='1 1 100%';actionGrid.insertBefore(fileToolbar,other);}
   if(firmwareFocus&&document.documentElement.contains(firmwareFocus))firmwareFocus.focus();firmwareFocus=null;
   document.querySelectorAll('.host-other-directory > summary').forEach(function(summary){summary.textContent='Other';});
  };
  window.WWB_HOST_LAYOUT(false);
 }
 var warning=document.querySelector('#host-transfer-warning');if(warning)fileToolbar.parentNode.insertBefore(warning,fileToolbar.nextSibling);
 var status=document.querySelector('#host-status'),initialStatus=status.textContent;status.hidden=status.getAttribute('data-host-catalog-error')!=='true';
 new MutationObserver(function(){status.hidden=status.textContent===initialStatus&&status.getAttribute('data-host-catalog-error')!=='true';}).observe(status,{childList:true,characterData:true,subtree:true});
 var library=document.getElementById('host-folder-library');
 var pluginTemplates=document.getElementById('host-plugin-templates');if(pluginTemplates)pluginTemplates.hidden=selected!=='mods'&&selected!=='goldhen';
 if(selected==='mods'&&platform==='ps4'){var trainer=document.createElement('a');trainer.className='host-trainer-shortcut';trainer.href='/hosts/tools/ps4-trainer/';trainer.innerHTML='<img src="/assets/images/home/ps4-offline-trainer-cover-v1.jpg" width="144" height="90" alt=""><span><strong>PS4 Offline Trainer</strong><span>Browse games and exact updates →</span></span>';library.parentNode.insertBefore(trainer,library);}
 library.hidden=!selected||selected==='connection'||selected==='sender';
 document.querySelectorAll('[data-host-folder-panel]').forEach(function(panel){panel.hidden=panel.getAttribute('data-host-folder-panel')!==selected;});
 if(selected){
  var button=document.querySelector('[data-host-category="'+selected+'"]');
  var title=document.getElementById('host-folder-title');
    title.textContent=labels[selected];
  document.getElementById('host-folder-path').textContent=' / '+title.textContent;
  var back=document.querySelector('.host-taskbar a');back.href=selected==='loaders'?'/':base;
  if(button)button.click();
  if(selected==='sender')document.querySelector('.host-sender').open=true;
 }
 var fileCount=document.getElementById('host-file-count'),sourceCount=document.getElementById('host-action-count');
 if(fileCount&&sourceCount){var countChanged=function(){if(fileCount.textContent!==sourceCount.textContent)fileCount.textContent=sourceCount.textContent;fileCount.hidden=selected==='connection'||selected==='sender';};countChanged();new MutationObserver(countChanged).observe(sourceCount,{childList:true,characterData:true,subtree:true});}
 document.addEventListener('keydown',function(event){if(event.key==='Escape'){var more=document.querySelector('.host-utility-menu');if(more)more.open=false;}});
})();
