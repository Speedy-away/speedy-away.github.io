'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const originals={'ps5-umtx2':'https://umtx2.pages.dev/','ps5-relapse':'https://soniciso1.github.io/relapse/relapse.html'};
function isTrustedOriginal(a){return a.platform==='ps5'&&Object.prototype.hasOwnProperty.call(originals,a.id)&&originals[a.id]===a.launchURL;}
function prepare(actions,platform){if(platform!=='ps5')return actions;const r=require('../docs/host-runtime-builds.json').runtimes.find(r=>r.id==='ps5-umtx');return actions.map(a=>{
 if(isTrustedOriginal(a))return {...a,browserHost:true,launchLabel:'Load',format:'Original PS5 browser host'};
 if(a.id==='built-in-ps5-umtx')return {...a,browserHost:true,launchLabel:'Load',launchURL:r.runEntry,requirements:['Load on a supported PS5 browser. Progress appears in the console log.']};
 if(a.id==='ps5-elfldr')return {...a,category:'payloads',categories:(a.categories||[]).filter(c=>c!=='loaders')};return a;
});}
function refresh(root){
 const file=path.join(root,'docs/host-runtime-builds.json'),doc=JSON.parse(fs.readFileSync(file,'utf8')),r=doc.runtimes.find(r=>r.id==='ps5-umtx'),dir=path.join(root,'hosts/runtime/ps5-umtx');
 const guard='/* Authored firmware gate; does not run downloaded code. */\n(function(){var ua=navigator.userAgent,m=/PlayStation\\s*5[ /]+(\\d+)\\.(\\d+)/i.exec(ua),fw=m?Number(m[1])+"."+(m[2]+"0").slice(0,2):null,supported='+JSON.stringify(r.firmwares)+';var marker="PlayStation; PlayStation 5/",at=ua.indexOf(marker),nativeFW=at<0?"":ua.substring(at+marker.length,at+marker.length+4);window.whatsiteRuntimeFirmware=fw;window.whatsiteRuntimeAllowed=!!fw&&supported.indexOf(fw)!==-1&&nativeFW===fw;var status=document.getElementById("runtime-status");if(status)status.textContent=window.whatsiteRuntimeAllowed?"PS5 "+fw+" · Ready":"A supported PS5 browser is required.";var button=document.getElementById("runtime-start");if(button)button.disabled=!window.whatsiteRuntimeAllowed;})();\n';
 fs.writeFileSync(path.join(dir,'guard.js'),guard.split("\\\\").join("\\"));
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PS5 · Load</title><link rel="stylesheet" href="style.css"></head><body><main><a href="/hosts/ps5/">← PS5 host</a><h1>PS5</h1><p class="status" id="runtime-status">Checking console…</p><button type="button" id="runtime-start" disabled>Load</button><details><summary>Details</summary><p><a href="README.md">Source &amp; licenses</a> · <a href="build.json">Build inventory</a></p></details></main><script src="guard.js"></script><script src="load-request.js"></script><script>document.getElementById("runtime-start").onclick=function(event){if(!event.isTrusted||this.disabled)return;if(window.whatsiteRuntimeAllowed&&window.WWBPS5Load.arm(window.whatsiteRuntimeFirmware)){this.disabled=true;this.setAttribute("aria-busy","true");document.getElementById("runtime-status").textContent="Loading PS5 loader…";location.href="web/index.html";}};</script></body></html>\n';
 fs.writeFileSync(path.join(dir,'index.html'),html);
 const webPath=path.join(dir,'web/index.html');let web=fs.readFileSync(webPath,'utf8');
 if(!web.includes('../load-request.js')){
  web=web.replace('<head><script src="../guard.js"></script>','<head><script src="../guard.js"></script><script src="../load-request.js"></script>').replace('PS5 UMTX Jailbreak (1.xx-5.xx)','PS5 loader').replace('>Jailbreak</a>','>Load</a>');
  web=web.replace('<script>if(window.whatsiteRuntimeAllowed){var files=',"<script>if(window.whatsiteRuntimeAllowed){if(window.WWBPS5Load&&window.WWBPS5Load.requested){document.getElementById('pre-jb-view').classList.remove('selected');document.getElementById('console-view').classList.add('selected');document.getElementById('console').value='Loading PS5 loader…\\n';}var files=");
  web=web.replace('        window.onload = function() {',"        if(window.WWBPS5Load&&window.WWBPS5Load.requested){runJailbreak(false);}else window.onload = function() {");fs.writeFileSync(webPath,web);
 }
 web=fs.readFileSync(webPath,'utf8').replace("if(window.WWBPS5Load&&window.WWBPS5Load.requested){runJailbreak(false);}else window.onload = function() {","if(window.WWBPS5Load&&window.WWBPS5Load.requested){var firmwareDeadline=Date.now()+30000;function waitForFirmware(){if(typeof OFFSET_wk_vtable_first_element!=='undefined'){runJailbreak(false);return;}if(Date.now()>=firmwareDeadline){document.getElementById('console').value+='\\nFirmware data failed to load. Return to the PS5 host and try Load again.';return;}setTimeout(waitForFirmware,50);}waitForFirmware();}else window.onload = function() {");fs.writeFileSync(webPath,web);
 const names=['guard.js','index.html','web/index.html','load-request.js'];
 for(const n of names){const b=fs.readFileSync(path.join(dir,n)),record={path:n,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')},old=r.files.find(f=>f.path===n);if(old)Object.assign(old,record);else r.files.push(record);}
 r.files.sort((a,b)=>a.path.localeCompare(b.path));r.entryFlow={type:'console-browser-load',runEntry:r.runEntry,request:'One-use same-tab session request; exact detected firmware required.',progress:'Original PS5 console log; original native retry behavior retained.'};
 fs.writeFileSync(path.join(dir,'build.json'),JSON.stringify(r,null,2)+'\n');fs.writeFileSync(file,JSON.stringify(doc,null,2)+'\n');
}
module.exports={prepare,refresh,isTrustedOriginal,originals};
