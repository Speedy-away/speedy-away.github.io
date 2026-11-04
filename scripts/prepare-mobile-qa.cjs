// Generate a local-only responsive audit. Open the printed URL in a browser.
// Only renders pages: does not click downloads, submit forms, or run payloads.
const fs = require('node:fs');
const path = require('node:path');
const {pages} = require('./apply-mobile-layout.cjs');
const root = path.resolve(__dirname, '..');
const targets = pages().filter(file => !/http-equiv=["']refresh["']/i.test(fs.readFileSync(file,'utf8')) && !file.endsWith('sponsor-frame.html')).map(file => '/' + path.relative(root,file).replaceAll('\\','/'));
const out = path.join(root,'.playwright-cli','mobile-audit.html');
fs.mkdirSync(path.dirname(out), {recursive:true});
fs.writeFileSync(out, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mobile layout audit</title><style>body{margin:24px;background:#101013;color:#f4f4f5;font:16px/1.5 system-ui}button{padding:12px 20px;font:inherit}pre{white-space:pre-wrap;overflow-wrap:anywhere}iframe{position:absolute;top:2000px;left:0;border:0;visibility:hidden}</style></head><body><h1>Mobile layout audit</h1><p>Renders ${targets.length} pages at the requested phone and tablet widths. Does not click downloads or submit forms.</p><button id="start">Start audit</button><p id="status">Ready</p><pre id="results"></pre><script>
const allTargets=${JSON.stringify(targets)};
const only=new URLSearchParams(location.search).get('only')?.split(',');
const targets=only?allTargets.filter(url=>only.includes(url)):allTargets;
const requestedWidths=new URLSearchParams(location.search).get('widths')?.split(',').map(Number);
const widths=requestedWidths?.filter(width=>[320,390,600,768,810,820,834,1024,1180,1194,1366,1440].includes(width))||[320,390,768];
const results=[];
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function measure(url,width){
 const frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.width=width;frame.height=844;frame.src=url;document.body.append(frame);
 try{
  let ready=false;
  for(let i=0;i<100;i++){
   await sleep(80);
   const d=frame.contentDocument;
   if(d&&d.location.pathname!==location.pathname&&d.body&&d.querySelector('link[href*="/assets/mobile.css"]')?.sheet){ready=true;break;}
  }
  if(!ready)return {url,width,error:'Page styles did not load'};
  await sleep(350);
  let d=frame.contentDocument,w=frame.contentWindow,missingStyles=[];
  // Navigation aliases and asynchronously installed shared styles may settle
  // after the first mobile stylesheet. Always inspect the current document.
  for(let i=0;i<25;i++){
   d=frame.contentDocument;w=frame.contentWindow;
   if(!d?.body||!d.location){await sleep(80);continue;}
   missingStyles=[...d.querySelectorAll('link[rel="stylesheet"][href]')].filter(link=>new URL(link.getAttribute('href'),d.location.href).origin===d.location.origin&&!link.disabled&&!link.sheet).map(link=>link.getAttribute('href'));
   if(!missingStyles.length&&d.querySelector('link[href*="/assets/mobile.css"]')?.sheet)break;
   await sleep(80);
  }
  if(!d?.body||!d.location)return {url,width,error:'Page navigation did not settle'};
  if(missingStyles.length)return {url,width,error:'Local stylesheets failed to load',missingStyles};
  const viewport=d.documentElement.clientWidth;
  const viewportLeft=d.documentElement.clientLeft,viewportRight=viewportLeft+viewport;
  const overflow=[];
  for(const el of d.body.querySelectorAll('*')){
   if(el.closest('.sidebar,.sidebar-backdrop,script,style,pre,.i18n-modal-overlay'))continue;
   // Provider-injected empty click layers are not rendered site content.
   if(el.matches('a[id^="lk"]')&&!el.textContent.trim()&&!el.children.length)continue;
   const css=w.getComputedStyle(el),r=el.getBoundingClientRect();
   if(!r.width||!r.height||css.visibility==='hidden'||css.display==='none'||css.position==='fixed')continue;
   if(r.right<=viewportRight+2&&r.left>=viewportLeft-2)continue;
   let contained=false;
   for(let p=el.parentElement;p&&p!==d.body;p=p.parentElement){
    const pc=w.getComputedStyle(p);
    if(['auto','scroll','hidden','clip'].includes(pc.overflowX)&&p.getBoundingClientRect().right<=viewportRight+2){contained=true;break;}
   }
   if(!contained)overflow.push({tag:el.tagName,class:el.className,id:el.id,left:Math.round(r.left),right:Math.round(r.right)});
  }
  const controls=[...d.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select,textarea')].filter(el=>el.getBoundingClientRect().width>0&&Number.parseFloat(w.getComputedStyle(el).fontSize)<16).map(el=>el.id||el.name||el.tagName);
  return {url,width,viewport,viewportLeft,documentWidth:d.documentElement.scrollWidth,overflow:overflow.slice(0,8),smallInputs:controls.slice(0,8),smallInputCount:controls.length};
 }catch(e){return {url,width,error:String(e)}}finally{frame.remove()}
}
document.getElementById('start').onclick=async function(){
 this.disabled=true;try{localStorage.setItem('scooby.lang','en')}catch{}
 const jobs=widths.flatMap(width=>targets.map(url=>({url,width})));let next=0,done=0;
 async function worker(){while(next<jobs.length){const job=jobs[next++];results.push(await measure(job.url,job.width));done++;document.getElementById('status').textContent=done+' / '+jobs.length+' checked';}}
 await Promise.all(Array.from({length:6},worker));
 const failures=results.filter(r=>r.error||r.overflow?.length||r.smallInputs?.length||r.documentWidth>r.viewport+2);
 document.getElementById('status').textContent='Complete: '+results.length+' checks; '+failures.length+' issues';
 document.getElementById('results').textContent=JSON.stringify({pages:targets.length,checks:results.length,failures},null,2);
};
</script></body></html>`);
console.log(`${targets.length} pages queued. Open http://127.0.0.1:8767/.playwright-cli/mobile-audit.html`);
