// Isolated headless rendering of authored local pages; no console build is run.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),work=path.join(root,'.playwright-cli');fs.mkdirSync(work,{recursive:true});
const appCatalogue=require('../docs/3ds-more-app-research.json').apps;
const appCount=appCatalogue.length+6,themeCount=require('../docs/themezer-3ds-catalog.json').themes.length;
const gameCount=appCatalogue.filter(a=>a.group==='games').length,emulatorCount=appCatalogue.filter(a=>a.group==='emulators').length;
const extended=fs.existsSync(path.join(root,'docs/3ds-mods-online.json'))?require('../docs/3ds-mods-online.json').entries:[];
const modCount=extended.filter(e=>e.group==='mods').length,onlineCount=extended.filter(e=>e.group==='online').length;
const harness=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{display:block;border:0}pre{display:none}</style></head><body><pre id="result">pending</pre><script>
localStorage.setItem('scooby.lang','en');
var p=new URLSearchParams(location.search),frame=document.createElement('iframe');frame.style.width=p.get('width')+'px';frame.style.height=p.get('height')+'px';
frame.onload=function(){setTimeout(function(){try{
var d=frame.contentDocument,w=frame.contentWindow,failures=[],checks=[];
function check(ok,text){checks.push(text);if(!ok)failures.push(text);}
var theme=w.location.pathname.indexOf('themes.html')!==-1,mods=w.location.pathname.indexOf('3ds-mods.html')!==-1,online=w.location.pathname.indexOf('3ds-online.html')!==-1,query=d.getElementById('threeDsSearch'),category=d.getElementById('threeDsCategory'),toolbar=d.querySelector('[data-three-ds-search]'),status=toolbar.querySelector('[role="status"]'),clear=toolbar.querySelector('button');
var cards=Array.from(d.querySelectorAll(theme?'.three-ds-theme[data-three-ds-card]':'[data-three-ds-card]'));var expected=theme?${themeCount}:mods?${modCount}:online?${onlineCount}:${appCount};
var exactQuery=theme?'TabaxiD':mods?'Vapecord':online?'Nimbus':'PKSM';
function shown(){return cards.filter(function(c){return !c.hidden;});}function input(text){query.value=text;query.dispatchEvent(new w.Event('input'));}
check(shown().length===expected,'Initial resource count');check(status.textContent.indexOf(String(expected))===0,'Live result status');
input(exactQuery);check(shown().length===1,'Exact name or author search');
input('no-match-for-3ds-qa');check(shown().length===0&&!toolbar.querySelector('[data-empty]').hidden,'No-results state');
if(!theme)check(Array.from(d.querySelectorAll('[data-three-ds-group]')).every(function(g){return g.hidden;}),'Empty resource sections hide');
clear.click();check(shown().length===expected&&query.value==='','Clear restores collection');
if(category){category.value='games';category.dispatchEvent(new w.Event('change'));check(shown().length===${gameCount},'Native games category');category.value='emulators';category.dispatchEvent(new w.Event('change'));check(shown().length===${emulatorCount},'Emulators and native GBA category');clear.click();}
var first=cards[0];first.querySelectorAll('details').forEach(function(details){details.open=true;});
check(d.documentElement.scrollWidth<=w.innerWidth+1,'No horizontal overflow with file details open');
check(!d.querySelector('video,iframe'),'No embedded videos');check(!!w.__scoobyI18n&&!!d.querySelector('script[src="/languages/i18n.js?v=3"]'),'Language runtime retained');
check(d.querySelectorAll('link[href*="site-background.css"]').length===1&&d.querySelectorAll('link[href*="mobile.css"]').length===1,'Background and mobile integration singleton');
check(cards.every(function(c){return c.querySelector('a[download]')||c.getAttribute('data-three-ds-category')==='core';}),'Every additional entry has direct Download');
var urls=Array.from(d.querySelectorAll('a[download]')).map(function(a){return a.getAttribute('href');});
var hashes=Array.from(d.querySelectorAll('.three-ds-files code')).map(function(c){return c.textContent;});
if(w.__scoobyI18n){w.__scoobyI18n.register('es',{'{count} resources shown':'{count} recursos mostrados'});w.__scoobyI18n.set('es');input(exactQuery);check(status.textContent==='1 recursos mostrados','Dynamic count uses shared translation helper');check(Array.from(d.querySelectorAll('a[download]')).every(function(a,i){return a.getAttribute('href')===urls[i];})&&Array.from(d.querySelectorAll('.three-ds-files code')).every(function(c,i){return c.textContent===hashes[i];}),'Language change preserves file URLs and hashes');w.__scoobyI18n.set('en');clear.click();}
if(online){check(!!d.querySelector('a[href="https://pretendo.network/"]')&&!!d.querySelector('a[href="https://pretendo.network/docs/install/3ds"]'),'Official Pretendo links are primary');check(d.querySelector('#nimbus a[download]').textContent.indexOf('Complete')!==-1,'Complete Nimbus ZIP is the first download');check(d.body.textContent.replace(/[\u200B\u00AD]/g,'').indexOf('3ds/nimbus/update/')!==-1,'Nimbus patch dependency path is visible');}
if(online){var gameRoot=d.querySelector('[data-pretendo-games]'),gq=gameRoot.querySelector('input'),ga=gameRoot.querySelector('select'),gc=gameRoot.querySelector('button'),gr=Array.from(gameRoot.querySelectorAll('[data-pretendo-game]'));function gshown(){return gr.filter(function(r){return !r.hidden;}).length;}function gsearch(v){gq.value=v;gq.dispatchEvent(new w.Event('input'));}function gaccess(v){ga.value=v;ga.dispatchEvent(new w.Event('change'));}check(gshown()===29,'All game support rows render');gsearch('mk7');check(gshown()===1,'Game alias search');gsearch('');gaccess('tester');check(gshown()===8,'Tester access filter');gsearch('pokemon');check(gshown()===2,'Accent insensitive combined search');gaccess('public');check(gshown()===1,'Public Pokemon filter');gsearch('no-match-qa');check(gshown()===0&&!gameRoot.querySelector('[data-empty]').hidden,'Game no-results state');gc.click();check(gshown()===29&&ga.value==='all','Clear restores game table');check(shown().length===expected,'Game filter independent of downloads');}
if(mods)check(d.getElementById('restoration-versions').textContent.indexOf('v110')!==-1&&d.getElementById('restoration-versions').textContent.indexOf('v100')!==-1,'Game revision and region setup is visible');
if(w.location.hash){var anchor=d.getElementById(w.location.hash.slice(1));if(anchor){d.documentElement.style.scrollBehavior='auto';w.scrollTo(0,w.scrollY+anchor.getBoundingClientRect().top-(w.innerWidth<760?90:24));}}else{d.documentElement.style.scrollBehavior='auto';w.scrollTo(0,0);}
document.getElementById('result').textContent=JSON.stringify({title:d.title,width:w.innerWidth,height:w.innerHeight,documentWidth:d.documentElement.scrollWidth,resources:cards.length,checks:checks,failures:failures});
}catch(e){document.getElementById('result').textContent=JSON.stringify({failures:[e.message]});}},850);};frame.src=p.get('target');document.body.appendChild(frame);
</script></body></html>`;
fs.writeFileSync(path.join(work,'3ds-more-render.html'),harness);
const cases=[{name:'3ds-more-desktop',url:'/console/retro/3ds.html',width:1366,height:900},{name:'3ds-more-mobile',url:'/console/retro/3ds.html#browse',width:390,height:844},{name:'3ds-themes-desktop',url:'/console/retro/3ds-themes.html#catalogue',width:1366,height:1000},{name:'3ds-themes-mobile',url:'/console/retro/3ds-themes.html#catalogue',width:390,height:844},{name:'3ds-themes-narrow',url:'/console/retro/3ds-themes.html#catalogue',width:320,height:844},...(extended.length?[{name:'3ds-mods-desktop',url:'/console/retro/3ds-mods.html#catalogue',width:1366,height:1000},{name:'3ds-mods-mobile',url:'/console/retro/3ds-mods.html#project-restoration',width:390,height:844},{name:'3ds-online-desktop',url:'/console/retro/3ds-online.html',width:1366,height:1000},{name:'3ds-online-mobile',url:'/console/retro/3ds-online.html#downloads',width:390,height:844},{name:'3ds-online-narrow',url:'/console/retro/3ds-online.html#pretendo-setup',width:320,height:844}]:[])];
cases.push(...[1366,390,320].map(width=>({name:'3ds-pretendo-games-'+width,url:'/console/retro/3ds-online.html#supported-games',width,height:900})));
const requested=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7).split(',');const results=[];fs.mkdirSync(path.join(root,'docs/screenshots'),{recursive:true});
for(const item of cases.filter(x=>!requested||requested.includes(x.name))){
 const screenshot=path.join(root,'docs/screenshots',item.name+'.png'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'whatsite-3ds-qa-'));
 const args=['--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run','--no-default-browser-check','--user-data-dir='+profile,'--window-size='+item.width+','+item.height,'--virtual-time-budget=6500','--screenshot='+screenshot,'--dump-dom','http://127.0.0.1:8765/.playwright-cli/3ds-more-render.html?target='+encodeURIComponent(item.url)+'&width='+item.width+'&height='+item.height];
 const run=spawnSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args,{encoding:'utf8',windowsHide:true,maxBuffer:4*1024**2,timeout:45000});
 const raw=run.stdout?.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1]?.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
 let result;try{result=JSON.parse(raw);}catch{throw Error('Isolated Edge test did not finish: '+item.name+' '+(run.error?.message||run.stderr?.slice(-500)||raw));}
 if(result.width!==item.width)result.failures.push('CSS viewport differs from requested width');if(!fs.existsSync(screenshot))result.failures.push('Screenshot missing');
 results.push({...item,...result,screenshot:'/docs/screenshots/'+item.name+'.png'});console.log(JSON.stringify(results.at(-1)));
}
const file=path.join(root,'docs/qa/3ds-more-browser.json');const prior=requested&&fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).results:[];
const final=cases.map(c=>results.find(x=>x.name===c.name)||prior.find(x=>x.name===c.name)).filter(Boolean);
fs.writeFileSync(file,JSON.stringify({checkedAt:new Date().toISOString(),mode:'Isolated headless Edge rendering against existing local preview; no console executable run',results:final},null,2)+'\n');if(final.some(x=>x.failures.length))process.exitCode=1;
