// Isolated installed-Edge rendering of the local site. Does not run Wii builds.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const preview=process.env.WII_PREVIEW_BASE || 'http://127.0.0.1:8765';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const work=path.join(root,'.playwright-cli');
fs.mkdirSync(work,{recursive:true});
fs.mkdirSync(path.join(root,'docs/screenshots'),{recursive:true});
const harness=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{display:block;border:0}pre{display:none}</style></head><body><pre id="result">pending</pre><script>
localStorage.setItem('scooby.lang','en');
var params=new URLSearchParams(location.search),frame=document.createElement('iframe');
frame.style.width=params.get('width')+'px';frame.style.height=params.get('height')+'px';
frame.onload=function(){frame.contentDocument.querySelectorAll('[data-wii-card] img').forEach(function(img){img.loading='eager';});setTimeout(function(){try{
var d=frame.contentDocument,w=frame.contentWindow,checks=[],failures=[];
function check(ok,label){checks.push(label);if(!ok)failures.push(label);}
var cards=Array.from(d.querySelectorAll('[data-wii-card]')),search=d.getElementById('wii-more-search'),model=d.getElementById('wii-more-model');
function visible(){return cards.filter(function(x){return w.getComputedStyle(x).display!=='none';});}
function input(value){search.value=value;search.dispatchEvent(new w.Event('input'));}
check(cards.length===12&&visible().length===12,'Twelve visible native packages');
d.querySelector('[data-wii-filter="games"]').click();check(visible().length===3,'Games filter visibly shows three cards');
d.querySelector('[data-wii-filter="apps"]').click();check(visible().length===2,'Apps filter visibly shows two cards');
d.querySelector('[data-wii-filter="emulators"]').click();check(visible().length===7,'Emulator filter visibly shows seven cards');
d.getElementById('wii-more-reset').click();model.value='wii_mini';model.dispatchEvent(new w.Event('change'));check(visible().length===10&&!visible().some(function(x){return /cavestory|helium/.test(x.id);}), 'Mini filter excludes SD-dependent games');
d.getElementById('wii-more-reset').click();input('scumm');check(visible().length===1&&visible()[0].textContent.indexOf('/apps/scummvm/boot.elf')!==-1,'Search finds the native ELF package');
input('no-such-wii-app-978');check(visible().length===0&&!d.getElementById('wii-more-empty').hidden,'Empty search shows visible empty state');
d.getElementById('wii-more-reset').click();check(visible().length===12&&model.value==='all'&&!search.value,'Clear resets search, category and model');
check(['priiloader','usbloadergx','nintendont','cleanrip-wii','gcmm-wii'].every(function(id){return !!d.getElementById(id);}), 'Existing Wii system and GameCube cards preserved');
check(d.querySelectorAll('[data-wii-card] a[download]').length===12,'Twelve visible download actions');
check(!d.querySelector('video,iframe[src*="youtube"],embed'),'No added video embeds');
check(d.querySelectorAll('link[href*="/assets/mobile.css"]').length===1&&!!d.querySelector('script[src="/languages/i18n.js?v=3"]')&&!!d.querySelector('script[src*="/assets/site-background.js"]'),'Mobile, background and language integration retained');
check(Array.from(d.querySelectorAll('[data-wii-card] img')).every(function(x){return x.complete&&x.naturalWidth>0;}),'All twelve real artwork images loaded');
if(params.get('detail')==='yes'){input('scumm');d.querySelector('#wii-scummvm details').open=true;}
check(d.documentElement.scrollWidth<=w.innerWidth+1,'No horizontal document overflow');
var target=d.getElementById(params.get('detail')==='yes'?'wii-scummvm':'wii-library');
d.documentElement.style.scrollBehavior='auto';w.scrollTo(0,w.scrollY+target.getBoundingClientRect().top-(w.innerWidth<=760?88:20));
check(cards.every(function(card){if(card.hidden)return true;var r=card.getBoundingClientRect();return r.left>=-1&&r.right<=w.innerWidth+1;}),'Visible cards fit the viewport');
var data={width:w.innerWidth,height:w.innerHeight,documentWidth:d.documentElement.scrollWidth,checks:checks,failures:failures,visibleCards:visible().length};
document.getElementById('result').textContent=JSON.stringify(data);
}catch(e){document.getElementById('result').textContent=JSON.stringify({failures:[String(e)]});}},1200);};
frame.src='/console/retro/wii.html';document.body.appendChild(frame);
</script></body></html>`;
fs.writeFileSync(path.join(work,'wii-more-render.html'),harness);
const cases=[{name:'wii-more-desktop',width:1440,height:1080},{name:'wii-more-tablet',width:1024,height:900},{name:'wii-more-mobile',width:390,height:844},{name:'wii-more-mobile-details',width:390,height:1000,detail:true}];
const results=[];
for(const item of cases){
 const screenshot=path.join(root,'docs/screenshots',item.name+'.png');
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'whatsite-wii-more-qa-'));
 const url=preview+'/.playwright-cli/wii-more-render.html?width='+item.width+'&height='+item.height+(item.detail?'&detail=yes':'');
 const args=['--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run','--no-default-browser-check','--host-resolver-rules=MAP * 0.0.0.0,EXCLUDE 127.0.0.1','--user-data-dir='+profile,'--window-size='+item.width+','+item.height,'--virtual-time-budget=8000','--screenshot='+screenshot,'--dump-dom',url];
 const run=spawnSync(edge,args,{encoding:'utf8',windowsHide:true,maxBuffer:4*1024**2,timeout:45000});
 const raw=run.stdout?.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1]?.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
 let result;try{result=JSON.parse(raw);}catch{throw Error('Local browser test did not complete: '+item.name+' '+(run.error?.message||run.stderr?.slice(-600)||raw));}
 if(!fs.existsSync(screenshot))throw Error('Screenshot missing');
 if(result.width!==item.width||result.height!==item.height)result.failures.push('Frame viewport differs from requested dimensions');
 results.push({name:item.name,screenshot:'docs/screenshots/'+item.name+'.png',...result});
 console.log(JSON.stringify(results.at(-1)));
}
fs.writeFileSync(path.join(root,'docs/wii-more-browser-qa.json'),JSON.stringify({checkedAt:new Date().toISOString(),mode:'Installed Edge headless local preview, external DNS blocked; no Wii execution',results},null,2)+'\n');
if(results.some(x=>x.failures.length))process.exitCode=1;
