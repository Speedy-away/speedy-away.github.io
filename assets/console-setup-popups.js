(function(global,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(!global.document)return;const start=()=>api.install(global.document,global);if(global.document.readyState==='loading')global.document.addEventListener('DOMContentLoaded',start,{once:true});else start();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const skipPath=path=>!path.startsWith('/console/')||path==='/console/retro/ps2.html'||/\/mods\//.test(path)||/whatsite-ps[45]\.html$/.test(path);
  function setupPage(path){return !skipPath(path)&&/\/(?:setup|install|storage|dev-mode|device-portal|cfw|jailbreak|hen|enso|bdj|umtx2|relapse|y2jb|atmosphere|hekate|app-store)\.html$/.test(path);}
  function candidates(doc){
    const chosen=[];
    for(const section of doc.querySelectorAll('main section[id]')){
      if(section.closest('[data-guide-panel],dialog')||section.querySelector('input,select,textarea,form,video,iframe'))continue;
      const steps=[...section.querySelectorAll('ol')].filter(ol=>!ol.closest('article,details'));
      const hasCards=section.querySelector('article,.games-grid,.game-card,.steamdeck-setup-guides');
      if(hasCards){for(const ol of steps)chosen.push({node:ol,title:section.querySelector('h2')?.textContent.trim()||'Setup guide',partial:true});continue;}
      const storage=/^(?:storage|emulator-setup|skin-setup|theme-setup|app-setup)$/.test(section.id)&&section.querySelector('p,pre,ol');
      if(steps.length||storage)chosen.push({node:section,title:section.querySelector('h2')?.textContent.trim()||'Setup guide',partial:false});
    }
    for(const details of doc.querySelectorAll('main details[id]')){
      const summary=details.querySelector(':scope > summary');
      if(summary&&details.querySelector('ol')&&/setup|install|guide/i.test(details.className+' '+summary.textContent))chosen.push({node:details,title:summary.textContent.trim().replace(/\s*\d+\s+steps?$/i,''),details:true});
    }
    return chosen;
  }
  function install(document,window){
    if(skipPath(window.location.pathname)||!window.HTMLDialogElement?.prototype.showModal||document.querySelector('.console-setup-dialog'))return null;
    const dialog=document.createElement('dialog');dialog.className='console-setup-dialog';dialog.id='console-setup-dialog';dialog.setAttribute('aria-labelledby','console-setup-title');
    dialog.innerHTML='<header class="console-setup-header"><h2 id="console-setup-title" tabindex="-1"></h2><button type="button" aria-label="Close setup guide">Close</button></header><div class="console-setup-body"></div>';
    document.body.append(dialog);const body=dialog.querySelector('.console-setup-body'),title=dialog.querySelector('h2'),panels=new Map();
    let restore=null,opener=null,request=null,sequence=0;
    const reset=()=>{request?.abort();request=null;if(restore)restore();restore=null;body.replaceChildren();};
    const show=(label,trigger)=>{title.textContent=label;opener=trigger||document.activeElement;body.scrollTop=0;if(!dialog.open)dialog.showModal();document.documentElement.classList.add('console-setup-open');title.focus({preventScroll:true});window.__scoobyI18n?.refresh();};
    dialog.querySelector('button').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{++sequence;reset();document.documentElement.classList.remove('console-setup-open');if(opener?.isConnected)opener.focus({preventScroll:true});});
    let outsideDown=false;const outside=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
    dialog.addEventListener('pointerdown',e=>{outsideDown=e.target===dialog&&outside(e);});dialog.addEventListener('click',e=>{if(outsideDown&&e.target===dialog&&outside(e))dialog.close();outsideDown=false;});
    for(const entry of candidates(document)){
      const node=entry.node,heading=entry.details?node.querySelector(':scope > summary'):entry.partial?null:node.querySelector(':scope > .container > .section-header, :scope > .section-header');
      const source=entry.details?node:entry.partial?document.createElement('div'):node.querySelector(':scope > .container')||node;
      const button=entry.details?heading:document.createElement('button');if(!button)continue;
      let stored;
      if(entry.partial){node.before(button,source);source.append(node);stored=[node];}
      else stored=[...source.childNodes].filter(n=>n!==heading);
      if(!entry.details){button.type='button';button.className='console-setup-trigger btn btn-outline';button.textContent='Open setup guide';if(!entry.partial)source.insertBefore(button,heading?.nextSibling||source.firstChild);}
      const stash=document.createElement('div');stash.hidden=true;source.append(stash);for(const n of stored)stash.append(n);
      button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',dialog.id);button.setAttribute('aria-expanded','false');
      const open=()=>{++sequence;reset();for(const n of [...stash.childNodes])body.append(n);restore=()=>{while(body.firstChild)stash.append(body.firstChild);button.setAttribute('aria-expanded','false');};button.setAttribute('aria-expanded','true');show(entry.title,button);};
      button.addEventListener('click',e=>{e.preventDefault();open();});
      const id=entry.partial?node.closest('section')?.id:node.id;if(id&&!panels.has(id))panels.set(id,open);
    }
    function internalURL(href){try{const u=new URL(href,window.location.href);return u.origin===window.location.origin&&['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u:null;}catch{return null;}}
    for(const a of document.querySelectorAll('a[href]')){const u=internalURL(a.getAttribute('href'));if(u&&setupPage(u.pathname)&&a.target!=='_blank'&&!a.hasAttribute('download')){a.setAttribute('aria-haspopup','dialog');a.setAttribute('aria-controls',dialog.id);}}
    // Remote setup pages contribute instruction sections, not their live catalogues.
    async function remote(url,trigger){reset();const token=++sequence;body.textContent=window.__scoobyI18n?.t('Loading guide…')||'Loading guide…';show(trigger.textContent.trim(),trigger);request=new window.AbortController();try{
      const response=await window.fetch(url.href,{signal:request.signal,credentials:'same-origin'});const resolved=new URL(response.url||url.href);if(!response.ok||resolved.origin!==window.location.origin||!setupPage(resolved.pathname))throw Error('Guide unavailable');
      const parsed=new window.DOMParser().parseFromString(await response.text(),'text/html');if(token!==sequence||!dialog.open)return;
      const items=candidates(parsed);if(!items.length)throw Error('No standalone setup instructions');body.replaceChildren();
      const description=parsed.querySelector('.guide-hero p');if(description)body.append(description.cloneNode(true));
      // Keep prerequisite notes with the workflow, without pulling in download grids.
      const prerequisites=[...parsed.querySelectorAll('section[id]')].filter(s=>/^(requirements|compatibility|before)$/.test(s.id)&&!s.querySelector('article,input,select,form'));
      const selected=[...prerequisites,...items.map(e=>e.node)];
      for(const node of [...new Set(selected)])body.append(node.cloneNode(true));
      for(const el of body.querySelectorAll('script,iframe,video,audio,object,embed,form,.site-ad'))el.remove();
      for(const el of body.querySelectorAll('*')){
        el.removeAttribute('id');for(const a of [...el.attributes])if(/^on/i.test(a.name)||['srcdoc','autofocus','aria-controls','aria-labelledby','aria-describedby','for'].includes(a.name))el.removeAttribute(a.name);
        for(const attr of ['href','src','poster'])if(el.hasAttribute(attr)){try{const u=new URL(el.getAttribute(attr),response.url||url.href);if(!['http:','https:','mailto:','tel:'].includes(u.protocol))el.removeAttribute(attr);else el.setAttribute(attr,u.href);}catch{el.removeAttribute(attr);}}
      }
      const full=document.createElement('a');full.href=url.href;full.textContent='Open full setup page';full.dataset.consoleSetupFull='';body.append(full);title.textContent=parsed.querySelector('h1')?.textContent||trigger.textContent;window.__scoobyI18n?.refresh();
    }catch(error){if(error.name==='AbortError'||token!==sequence||!dialog.open)return;body.replaceChildren();const note=document.createElement('p');note.textContent='Open the full page to view this guide.';const a=document.createElement('a');a.href=url.href;a.textContent='Open full setup page';a.dataset.consoleSetupFull='';body.append(note,a);}}
    document.addEventListener('click',e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;const a=e.target.closest('a[href]');if(!a||a.hasAttribute('download')||a.target==='_blank'||a.hasAttribute('data-console-setup-full'))return;const u=internalURL(a.getAttribute('href'));if(!u)return;
      const local=u.pathname===window.location.pathname&&u.search===window.location.search;let id;try{id=decodeURIComponent(u.hash.slice(1));}catch{return;}
      if(local&&panels.has(id)){e.preventDefault();e.stopImmediatePropagation();panels.get(id)();}
      else if(!local&&setupPage(u.pathname)){e.preventDefault();e.stopImmediatePropagation();remote(u,a);}
      else if(dialog.open&&dialog.contains(a)&&local)dialog.close();
    },true);
    const hash=()=>{let id;try{id=decodeURIComponent(window.location.hash.slice(1));}catch{return;}if(panels.has(id)&&!dialog.open)panels.get(id)();};window.addEventListener('hashchange',hash);window.__scoobyI18n?.refresh();hash();
    return {dialog,panels};
  }
  return {skipPath,setupPage,candidates,install};
});
