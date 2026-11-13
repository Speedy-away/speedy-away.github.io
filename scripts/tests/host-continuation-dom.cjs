'use strict';
// Minimal controls/event fixture for the real dashboard install handlers.
// No browser, network, console connection or downloaded payload is used.
const dashboard = require('../../assets/host-dashboard.js');
const {normalizeAddress} = require('../../assets/host-console-client.js');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
function fixture({platform='ps4',firmwareChoicesOnly=false,storage=new Map(),sessionStore=new Map(),actions,pairDeferred=false,fileListView=false,catalogGrid=false,withoutSearch=false,firmwareButtons,userAgent='Fixture desktop browser',initialCategory='mods',sharedCatalogue,dashboardApi,catalogMetrics,pageURL}={}) {
  const created=[],opened=[],anchorClicks=[],checks=[],sends=[],pairs=[],windowEvents={};
  let gestureDepth=0,document;
  function matches(node, selector) {
    return selector.split(',').some(part=>{
      part=part.trim();
      const tag=part.match(/^[a-z]+/i)?.[0];
      if(tag&&node.tagName!==tag.toUpperCase())return false;
      const cls=part.replace(/\[[^\]]*\]/g,'').match(/\.([a-z0-9-]+)/i)?.[1];
      if(cls&&!String(node.className).split(/\s+/).includes(cls))return false;
      const attribute=part.match(/\[([^=\]]+)(?:="([^"]*)")?\]/);
      if(attribute&&(!node.hasAttribute(attribute[1])||attribute[2]!==undefined&&node.getAttribute(attribute[1])!==attribute[2]))return false;
      return !!(tag||cls||attribute);
    });
  }
  function element(tag='div') {
    const listeners={},attributes={};
    const node={tagName:tag.toUpperCase(),children:[],parentNode:null,value:'',textContent:'',className:'',hidden:false,disabled:false,checked:false,options:[],offsetWidth:1,offsetHeight:1,
      classList:{add(){},remove(){}},
      addEventListener(type,listener){(listeners[type]||=[]).push(listener);},
      appendChild(child){if(child.parentNode)child.parentNode.removeChild(child);child.parentNode=this;this.children.push(child);return child;},
      insertBefore(child,next){if(child.parentNode)child.parentNode.removeChild(child);child.parentNode=this;this.children.splice(this.children.indexOf(next),0,child);return child;},
      removeChild(child){this.children.splice(this.children.indexOf(child),1);child.parentNode=null;return child;},
      setAttribute(name,value=''){attributes[name]=String(value);if(name==='class')this.className=String(value);if(name==='disabled')this.disabled=true;},
      getAttribute(name){return Object.prototype.hasOwnProperty.call(attributes,name)?attributes[name]:null;},
      hasAttribute(name){return Object.prototype.hasOwnProperty.call(attributes,name);},
      removeAttribute(name){delete attributes[name];if(name==='disabled')this.disabled=false;},
      querySelectorAll(selector){return this.children.flatMap(child=>[...(matches(child,selector)?[child]:[]),...child.querySelectorAll(selector)]);},
      querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
      contains(child){return child===this||this.children.some(node=>node.contains(child));},
      focus(){document.activeElement=this;},
      fire(type,extra={}){if(this.disabled&&type==='click')return;gestureDepth++;try{const event={type,target:this,currentTarget:this,preventDefault(){this.defaultPrevented=true;},...extra};for(const listener of listeners[type]||[])listener(event);return event;}finally{gestureDepth--; }},
      click(){if(this.tagName==='A')anchorClicks.push({url:this.href,duringGesture:gestureDepth>0});return this.fire('click');}
    };
    let markup='';
    function parseMarkup(html){for(const match of String(html).matchAll(/<(button|a|select|input|summary)\b([^>]*)>/gi)){const child=element(match[1]);for(const attribute of match[2].matchAll(/([a-z0-9_-]+)(?:="([^"]*)")?/gi))child.setAttribute(attribute[1],attribute[2]||'');node.appendChild(child);}}
    node.htmlWrites=0;node.htmlAppends=0;
    Object.defineProperty(node,'innerHTML',{get(){return markup;},set(html){node.htmlWrites++;markup=String(html);node.children=[];parseMarkup(markup);}});
    node.insertAdjacentHTML=function(position,html){if(position!=='beforeend')throw Error('Unsupported fixture position');node.htmlAppends++;markup+=String(html);parseMarkup(html);};
    created.push(node);return node;
  }
  const ids={};
  const names=['actions-data','firmware','firmware-buttons','firmware-status','search','game','show-legacy','firmware-source','console-address','status','action-grid','action-count','version-overlay','version-choices','version-detail','bridge-url','bridge-token','service-status','service-checks','check-services','version-status','version-title','version-game','firmware-note','game-filter','empty','transfer-warning','transfer-warning-target','download-on-run','version-close','address-form','address-display','loopback','detect','detected-device','browser-firmware','other-console','clear-transfer-warning','connect-bridge','open-bridge'];
  for(const name of names)ids['host-'+name]=element(/(?:check-services|version-close|loopback|detect|clear-transfer-warning|connect-bridge|open-bridge)$/.test(name)?'button':'div');
  for(const name of ['support-overlay','support-title','support-text','support-close'])ids['host-'+name]=element(name==='support-close'?'button':'div');
  ids['host-support-overlay'].hidden=true;
  ids['host-version-overlay'].hidden=true;
  ids['host-firmware'].options=[{value:platform==='ps4'?'9.00':'4.51'}];
  const firmwareVersions=firmwareButtons|| (platform==='ps4'?['5.05','9.00','13.52','14.00']:['1.00','4.51','7.61','13.60']);
  for(const version of firmwareVersions){const button=element('button');button.setAttribute('data-host-firmware',version);button.setAttribute('aria-pressed','false');button.textContent=version;ids['host-firmware-buttons'].appendChild(button);}
  ids['host-firmware-status'].setAttribute('role','status');
  ids['host-show-legacy'].checked=true;
  ids['host-bridge-url'].value='http://127.0.0.1:8766';ids['host-bridge-token'].value='fixture-token';
  const defaultAction={id:platform+'-fixture-menu-157',label:'Fixture menu',menuFamily:'Fixture menu',platform,category:'mods',game:'Fixture game',gameVersion:'1.57',menuVersion:'2.0',firmwares:[platform==='ps4'?'9.00':'4.51'],format:platform==='ps4'?'BIN':'ELF',run:{type:platform==='ps4'?'goldhen-http':'elf-http',port:platform==='ps4'?9090:9021},downloadURL:'/downloads/fixture/menu.'+(platform==='ps4'?'bin':'elf'),consoleFileId:platform+'-exact-file-157',requirements:[]};
  actions=actions||[defaultAction];
  ids['host-actions-data'].textContent=JSON.stringify({platform,actions:sharedCatalogue?undefined:actions,actionsKey:sharedCatalogue?sharedCatalogue.expectedKey||sharedCatalogue.key:undefined,fileListView,catalogGrid,initialCategory,firmwareChoicesOnly});
  const storageKey='whatwhatboy.host.'+platform;
  if(!storage.has(storageKey))storage.set(storageKey,JSON.stringify({address:'192.168.1.40',firmware:platform==='ps4'?'9.00':'4.51'}));
  if(withoutSearch)delete ids['host-search'];
  const sender=element('details'),info=element('div');
  document={visibilityState:'visible',wasDiscarded:false,body:element('body'),activeElement:null,querySelector(selector){if(selector[0]==='#')return ids[selector.slice(1)]||null;if(selector==='.host-sender')return sender;if(selector==='.host-connection-info')return info;return null;},querySelectorAll(){return[];},createElement:element};
  for(const node of Object.values(ids))document.body.appendChild(node);
  document.documentElement=document.body;
  const queue=(list,record)=>{const pending=deferred();list.push({...record,...pending});return pending.promise;};
  const client={normalizeAddress,
    inspectBridge(url,token){return pairDeferred?queue(pairs,{url,token}):Promise.resolve({status:'connected',message:'Fixture paired',actions:[]});},
    inspectConsole(address,platform){return queue(checks,{address,platform});},
    sendGoldHEN(address,action){return queue(sends,{method:'goldhen',address,actionId:action.id});},
    sendPS5ELF(address,action){return queue(sends,{method:'elf',address,actionId:action.id});},
    runViaBridge(address,actionId){return queue(sends,{method:'bridge',address,actionId});},
    launchInstalled(address,itemPath){return queue(sends,{method:'installed',address,itemPath});}
  };
  const window={HostConsoleClient:client,navigator:{userAgent},location:{href:pageURL||'http://127.0.0.1:8766/hosts/'+platform+'/',origin:pageURL?new URL(pageURL).origin:'http://127.0.0.1:8766'},sessionStorage:{getItem(key){return sessionStore.get(key)||null;},setItem(key,value){sessionStore.set(key,value);},removeItem(key){sessionStore.delete(key);}},localStorage:{getItem(key){return storage.get(key)||null;},setItem(key,value){storage.set(key,value);}},open(url,target,features){opened.push({url,target,features,duringGesture:gestureDepth>0});return{};},addEventListener(type,handler){(windowEvents[type]||=[]).push(handler);}};
  if(pageURL)window.history={replaceState(state,title,value){window.location.href=new URL(value,window.location.href).href;}};
  if(catalogGrid&&require('node:fs').existsSync(require('node:path').join(__dirname,'../../assets/host-catalog-grid.js'))){const api=require('../../assets/host-catalog-grid.js');window.HostCatalogGrid={...api};if(catalogMetrics)for(const name of ['tileMarkup','gameGroups'])window.HostCatalogGrid[name]=function(...args){catalogMetrics[name]=(catalogMetrics[name]||0)+1;return api[name](...args);};}
  if(sharedCatalogue)window.WWB_HOST_ACTION_DATA=sharedCatalogue;
  window.document=document;window.top=window;window.self=window;window.HostSiteLoad=require('../../assets/host-site-load.js');window.WhatsiteKaro=require('../../assets/host-karo-builds.js');
  (dashboardApi||dashboard).install(document,window);
  function clickWithin(container,selector){const target=container.querySelector(selector);if(!target)throw Error('Missing fixture control '+selector);return container.fire('click',{target});}
  return {platform,actions,ids,storage,storageKey,checks,sends,pairs,opened,anchorClicks,document,window,created,
    selectFirmware(version){clickWithin(ids['host-firmware-buttons'],'[data-host-firmware="'+version+'"]');},
    setAddress(value){ids['host-console-address'].value=value;ids['host-console-address'].fire('input');},
    pair(){ids['host-connect-bridge'].click();},
    check(){ids['host-check-services'].click();},
    openMenu(){clickWithin(ids['host-action-grid'],'[data-choose-group]');},
    choose(id){clickWithin(ids['host-version-choices'],'[data-version-id="'+id+'"]');},
    load(){const button=ids['host-version-detail'].querySelector('[data-launch]');if(!button)throw Error('Missing Load');if(!button.disabled)clickWithin(ids['host-version-detail'],'[data-launch]');return button;},
    download(){clickWithin(ids['host-version-detail'],'[data-download-action]');},
    emitStorage(value){for(const fn of windowEvents.storage||[])fn({key:storageKey,newValue:JSON.stringify(value)});}
  };
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
module.exports={fixture,deferred,flush};
