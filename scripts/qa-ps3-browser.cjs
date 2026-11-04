// Isolated headless rendering of the local preview; no downloaded tools are run.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const catalogueGames=require('./build-ps3-catalog.cjs').games;
const topCategoryCount=catalogueGames.filter(game=>!game.parent&&game.kind!=='collection').length+1;
const codGameCount=catalogueGames.filter(game=>game.parent==='call-of-duty').length;
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const work=path.join(root,'.playwright-cli');
fs.mkdirSync(work,{recursive:true});
fs.mkdirSync(path.join(root,'docs/screenshots'),{recursive:true});
const harness=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{display:block;width:100%;height:100%;border:0}pre{display:none}</style></head><body><pre id="result">pending</pre><script>
localStorage.setItem('scooby.lang','en');
var frame=document.createElement('iframe'),params=new URLSearchParams(location.search);
// Edge can clamp its outer window width. Fix the test frame to the requested
// CSS viewport so narrow screenshots exercise the actual mobile layout.
frame.style.width=params.get('width')+'px';frame.style.height=params.get('height')+'px';
frame.onload=function(){setTimeout(function(){
 var d=frame.contentDocument,w=frame.contentWindow,failures=[],checks=[];
 function check(ok,text){checks.push(text);if(!ok)failures.push(text);}
 check(d.documentElement.scrollWidth<=w.innerWidth+1,'No horizontal overflow');
 check(!d.querySelector('video,iframe[src*="youtube"],embed'),'No embedded video');
 if(d.body.classList.contains('ps3-catalog')){
  var ad=d.getElementById('page-advertisement');
  if(ad){check(!ad.parentElement.closest('article,.guide-resource,.games-grid'),'Advertisement sits outside download cards and grids');check(ad.getBoundingClientRect().width>w.innerWidth*.55,'Advertisement has a full content-width placement');}
  var cards=Array.from(d.querySelectorAll('[data-ps3-entry]'));
  if(cards.length){check(cards.every(function(card){return !!card.querySelector('.ps3-mod-figure img');}),'Every resource has source imagery or labelled game artwork');check(w.getComputedStyle(cards[0].parentElement).alignItems==='start','Resource cards keep natural heights');check(!Array.from(d.querySelectorAll('.ps3-meta dd')).some(function(dd){return /^Match your title ID;? not specified/i.test(dd.textContent);}), 'Generic title-ID placeholder rows are omitted');}
 }
 check(Array.from(d.querySelectorAll('a[href^="/console/ps3/mods/"]')).every(function(a){return a.target==='_blank'&&!a.hasAttribute('data-guide-open');}),'Game catalogue links open full tabs');
 if(w.location.pathname==='/console/ps3/mods.html')check(d.querySelectorAll('#games .ps3-game-card').length===${topCategoryCount},'Top overview has the current game categories');
 if(w.location.pathname==='/console/ps3/mods/call-of-duty/')check(d.querySelectorAll('#games .ps3-game-card').length===${codGameCount},'Call of Duty category contains each supported PS3 title');
 var search=d.getElementById('ps3Search');
 if(search){search.value=d.getElementById('gta-v-semjase-remastered')?'Semjase':d.getElementById('gta-iv-texture-installer-v2')?'Texture Installer':d.querySelector('[data-ps3-entry] h3').textContent;search.dispatchEvent(new w.Event('input'));check(Array.from(d.querySelectorAll('[data-ps3-entry]')).filter(function(a){return !a.hidden;}).length===1,'Menu-name search returns the exact entry');search.value='';search.dispatchEvent(new w.Event('input'));var type=d.getElementById('ps3Type');if(type&&Array.from(type.options).some(function(o){return o.value==='rtm';})){type.value='rtm';type.dispatchEvent(new w.Event('change'));check(Array.from(d.querySelectorAll('[data-ps3-entry]')).filter(function(a){return !a.hidden;}).every(function(a){return a.getAttribute('data-type')==='rtm';}),'Resource type filter selects RTM helpers');type.value='';type.dispatchEvent(new w.Event('change'));}}
 var incomplete=d.getElementById('ghosts-daydream-116');if(incomplete)check(!incomplete.querySelector('.ps3-ready-files')&&incomplete.textContent.indexOf('Incomplete source distribution')!==-1,'Incomplete source pack is labelled and has no ready-build section');
 if(d.getElementById('ps3DownloadForm')){d.getElementById('ps3Host').value='192.168.1.50';d.getElementById('ps3FileBase').value='http://192.168.1.20:8765';d.getElementById('ps3DownloadForm').dispatchEvent(new w.Event('submit',{cancelable:true}));var links=Array.from(d.querySelectorAll('[data-webman-file][href]'));check(links.length>0&&links.every(function(a){return a.getAttribute('href').indexOf('http://192.168.1.50/xmb.ps3/download.ps3?url=http://192.168.1.20:8765/downloads/')===0;}),'Prepared webMAN URLs retain literal schemes and download-only endpoint');check(!d.querySelector('a[href*="install.ps3"],a[href*="install_ps3"]'),'No automatic installation action');}
 if(d.getElementById('ps3DownloadForm')){
  var api=w.__scoobyI18n,protectedNodes=Array.from(d.querySelectorAll('[data-i18n-skip][translate="no"]')),before=protectedNodes.map(function(n){return n.textContent;}),hrefs=Array.from(d.querySelectorAll('a')).map(function(a){return a.getAttribute('href');});
  check(!!api&&!!d.querySelector('.i18n-selector,.i18n-float,#i18n-selector,[aria-label*="language" i]'),'Language runtime and controls are available');
  if(api){var dictionary={'PS3 console file list':'Lista de archivos PS3'};before.forEach(function(text){dictionary[text.trim()]='MUTATED FILE DATA';});api.register('es',dictionary);api.set('es');check(d.querySelector('h1').textContent==='Lista de archivos PS3','Language switching translates page UI');check(protectedNodes.every(function(node,i){return node.textContent===before[i];})&&Array.from(d.querySelectorAll('a')).every(function(a,i){return a.getAttribute('href')===hrefs[i];}),'Translation preserves filenames, paths, hashes and file URLs');api.set('en');}
 }
 if(d.getElementById('ps3ArchiveAccess')){d.getElementById('ps3ArchiveHost').value='192.168.1.20';d.getElementById('ps3ArchiveAccess').dispatchEvent(new w.Event('submit',{cancelable:true}));check(d.getElementById('ps3ArchiveOpen').getAttribute('href')==='http://192.168.1.20:8766/?resource=gta-iv-texture-installer-v2','Archive link retains the selected PS3 resource and private computer address');}
 if(w.location.hash){var anchor=d.getElementById(decodeURIComponent(w.location.hash.slice(1)));if(anchor){var reserve=w.innerWidth<=760?88:24;d.documentElement.style.scrollBehavior='auto';w.scrollTo(0,w.scrollY+anchor.getBoundingClientRect().top-reserve);var rect=anchor.getBoundingClientRect(),top=rect.top;check(anchor.id==='page-advertisement'?top>=0&&rect.bottom<=w.innerHeight:top>=0&&top<=reserve+3,'Requested resource is visible in the saved screenshot');}}
 document.getElementById('result').textContent=JSON.stringify({title:d.title,width:w.innerWidth,height:w.innerHeight,checks:checks,failures:failures});
},600);};
frame.src=params.get('target');document.body.appendChild(frame);
</script></body></html>`;
fs.writeFileSync(path.join(work,'ps3-render.html'),harness);
const cases=[
 {name:'ps3-mods-final',url:'/console/ps3/mods.html',width:1366,height:1000},
 {name:'ps3-mods-mobile',url:'/console/ps3/mods.html',width:390,height:844},
 {name:'ps3-menu-search',url:'/console/ps3/mods/menus.html',width:1366,height:1000},
 {name:'ps3-browser-downloads',url:'/console/ps3/browser-downloads.html',width:1024,height:900},
 {name:'ps3-texture-installer',url:'/console/ps3/mods/gta-iv/#gta-iv-texture-installer-v2',width:1366,height:1000},
 {name:'ps3-archive-downloads',url:'/console/ps3/archive-server.html?resource=gta-iv-texture-installer-v2#open-archive',width:1024,height:900},
 {name:'ps3-cod-games',url:'/console/ps3/mods/call-of-duty/#games',width:1366,height:1000},
 {name:'ps3-bo3-spectre',url:'/console/ps3/mods/call-of-duty/black-ops-3/#bo3-spectre-engine-v1',width:1366,height:1000},
 {name:'ps3-ghosts-rebound',url:'/console/ps3/mods/call-of-duty/ghosts/#ghosts-rebound-digital',width:1366,height:1000},
 {name:'ps3-mw3-resurgence',url:'/console/ps3/mods/call-of-duty/modern-warfare-3/#mw3-resurgence',width:390,height:844},
 {name:'ps3-legacy-pkg',url:'/console/ps3/apps.html#legacy-customization',width:1024,height:900},
 {name:'ps3-dead-island-installer',url:'/console/ps3/mods/dead-island/#dead-island-dev-installer-v2',width:1366,height:1000},
 {name:'ps3-dead-island-riptide',url:'/console/ps3/mods/dead-island-riptide/#dead-island-dev-installer-v2',width:390,height:844},
 {name:'ps3-gta-ultimate-v2',url:'/console/ps3/mods/gta-iv/#gta-iv-ultimate-mod-v2',width:390,height:844},
 {name:'ps3-aw-salvation',url:'/console/ps3/mods/call-of-duty/advanced-warfare/#aw-salvation-hen-digital',width:1366,height:1000},
 {name:'ps3-cod4-texture',url:'/console/ps3/mods/call-of-duty/cod4/#cod4-texture-installer-super-lite',width:1366,height:1000},
 {name:'ps3-mw2-black-ice',url:'/console/ps3/mods/call-of-duty/modern-warfare-2/#mw2-black-ice-v2',width:390,height:844},
 {name:'ps3-waw-paradise',url:'/console/ps3/mods/call-of-duty/world-at-war/#waw-paradise-hen',width:1366,height:1000},
 {name:'ps3-waw-layout',url:'/console/ps3/mods/call-of-duty/world-at-war/#discord-ps3-waw-nightfire',width:1366,height:1000},
 {name:'ps3-waw-layout-mobile',url:'/console/ps3/mods/call-of-duty/world-at-war/#discord-ps3-waw-nightfire',width:390,height:844},
 {name:'ps3-waw-advertisement',url:'/console/ps3/mods/call-of-duty/world-at-war/#page-advertisement',width:1366,height:1000}
];
const results=[];
const requested=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7).split(',');
if(requested?.some(name=>!cases.some(item=>item.name===name)))throw Error('Unknown PS3 browser check selection');
for(const item of cases.filter(item=>!requested||requested.includes(item.name))){
 const screenshot=path.join(root,'docs/screenshots',item.name+'.png');
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'whatsite-ps3-qa-'));
 const args=['--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run','--no-default-browser-check','--user-data-dir='+profile,'--window-size='+item.width+','+item.height,'--virtual-time-budget=5000','--screenshot='+screenshot,'--dump-dom','http://127.0.0.1:8765/.playwright-cli/ps3-render.html?target='+encodeURIComponent(item.url)+'&width='+item.width+'&height='+item.height];
 const run=spawnSync(edge,args,{encoding:'utf8',windowsHide:true,maxBuffer:3*1024**2,timeout:45000});
 const raw=run.stdout?.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1]?.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
 let result;try{result=JSON.parse(raw);}catch{throw Error('Headless page test did not complete for '+item.name+': '+(run.error?.message||run.stderr?.slice(-600)||raw));}
 if(!fs.existsSync(screenshot))throw Error('Screenshot was not saved: '+item.name);
 if(result.width!==item.width||result.height!==item.height)result.failures.push('Rendered viewport differs from requested size');
 results.push({name:item.name,url:item.url,screenshot:'/docs/screenshots/'+item.name+'.png',...result});
 console.log(JSON.stringify(results[results.length-1]));
}
const reportPath=path.join(root,'docs/ps3-browser-qa.json');
const previous=requested&&fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,'utf8')).results:[];
const finalResults=cases.map(item=>results.find(result=>result.name===item.name)||previous.find(result=>result.name===item.name)).filter(Boolean);
fs.writeFileSync(reportPath,JSON.stringify({reviewed:'2026-11-02',mode:'Isolated headless Edge against local preview; no PS3 hardware execution',results:finalResults},null,2)+'\n');
if(finalResults.some(result=>result.failures.length))process.exitCode=1;
