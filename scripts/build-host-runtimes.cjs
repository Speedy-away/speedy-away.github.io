#!/usr/bin/env node
'use strict';
// Static build only: downloaded browser code and native files are never executed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = f => fs.readFileSync(path.join(root,f),'utf8');
const write = (f,b) => {fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),b);};
const fw5=['1.00','1.01','1.02','1.05','1.10','1.11','1.12','1.13','1.14','2.00','2.20','2.25','2.26','2.30','2.50','2.70','3.00','3.20','4.00','4.02','4.03','4.50','4.51'];
const specs=[
 {id:'ps4-900',console:'ps4',label:'PS4 9.00 · PSFree / Lapse',repo:'kmeps4/PSFree',commit:'368d82aa40d3017c220757ce315761adb5f06678',firmwares:['9.00'],license:'AGPL-3.0-or-later; Liberation font OFL',listener:{transport:'tcp',port:9020,format:'bin'},offline:'PS4 application cache manifest included; actual cache persistence needs console verification.',description:'Run the locally hosted PSFree / Lapse chain on PS4 9.00, then wait for the native BIN listener on port 9020. GoldHEN is not automatically loaded.'},
 {id:'ps5-umtx',console:'ps5',label:'PS5 · UMTX ELF loader',repo:'PS5Dev/PS5-UMTX-Jailbreak',commit:'2cf6778ebe89ff35255e1c228826d0d2155e9d2a',firmwares:fw5,license:'Unlicense host; AGPL-3.0-or-later PSFree; GPL-3.0 ELF loader',listener:{transport:'tcp',port:9021,format:'elf'},offline:'No offline capability is claimed; upstream application-cache declaration is disabled.',description:'Run the locally hosted PSFree / UMTX chain, then wait for the native ELF listener on port 9021. This pinned loader excludes 5.xx because upstream documents that ELF loading is broken there.'}
];
function allFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?allFiles(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function guard(spec){return `/* whatwhatboy integration, 2026-11-02. Only checks UA; never exploits. */\n(function(){var ua=navigator.userAgent;var detected=ua.match(/PlayStation ${spec.console==='ps4'?'4':'5'}[\\/ ](\\d+\\.\\d+)/i);var firmware=detected?detected[1]:null;var supported=${JSON.stringify(spec.firmwares)};window.whatsiteRuntimeAllowed=!!firmware&&supported.indexOf(firmware)!==-1;window.whatsiteRuntimeFirmware=firmware;var status=document.getElementById('runtime-status');if(status)status.textContent=window.whatsiteRuntimeAllowed?'Detected ${spec.console.toUpperCase()} '+firmware+'. Ready to start.':'Open this page in a supported ${spec.console.toUpperCase()} browser. Detected firmware: '+(firmware||'not detected')+'.';var start=document.getElementById('runtime-start');if(start)start.disabled=!window.whatsiteRuntimeAllowed;})();\n`;}
const css='body{margin:0;background:#090d10;color:#edf3f5;font:16px/1.6 system-ui,sans-serif}main{max-width:860px;margin:8vh auto;padding:28px}h1{font-size:36px;line-height:1.15}p,li{color:#acbac1}a{color:#6fe2bd}button{padding:15px 24px;background:#13bf91;border:0;border-radius:8px;color:#061b14;font-weight:700;font-size:17px;cursor:pointer}button:disabled{background:#34403d;color:#b2bdb9;cursor:default}.status{padding:14px 0;border-top:1px solid #26322f}code{color:#6fe2bd}small{color:#96a6ae}pre{white-space:pre-wrap}';
const manifests=[];
for(const spec of specs){
 const base='hosts/runtime/'+spec.id, upstream=base+'/upstream',web=base+'/web';
 // Original sources remain available beside the modified deployable build.
 for(const f of allFiles(path.join(root,upstream))){const rel=path.relative(path.join(root,upstream),f).replaceAll('\\','/');write(web+'/'+rel,fs.readFileSync(f));}
 write(base+'/guard.js',guard(spec));
 const notice=`# ${spec.label}\n\nIntegration date: 2026-11-02. Original repository: https://github.com/${spec.repo}\nPinned commit: ${spec.commit}\n\n${spec.description}\n\nLicensing: ${spec.license}. Preserve all copyright and license files. There is no warranty. Original source is in upstream/; modified deployable source is in web/. Neither the exploit nor a payload was executed during preparation. Hardware execution has not been verified.\n\nFirmwares: ${spec.firmwares.join(', ')}. Native listener: ${spec.listener.format.toUpperCase()} over TCP ${spec.listener.port}. Browser pages cannot send raw TCP by themselves: after bootstrap, use the paired desktop sender or a native console sender compatible with this listener. A successful transfer is not proof the payload executed.\n\n${spec.offline}\n\nPS4 changes: replaces automatic GoldHEN loading with the existing upstream BIN listener; retains AIO fix, normalizes appcache paths, removes missing cosmetic image references. PS5 changes: console/firmware guard and delayed script loading; restricts supported ELF firmware to the README's explicit list below 5.00; propagates ELF-load errors so a failed load cannot fall through to the readiness log. Native ELF is unchanged.\n\nAGPL source: all modified JavaScript is shipped as readable source. PS4 kernel patch and AIO corresponding source is retained. PS5 elfldr is the exact binary distributed by the pinned PS5Dev build. Build history identifies v0.17, rebuilt on 2024-10-06 with an SDK supporting 1.01: https://github.com/PS5Dev/PS5-UMTX-Jailbreak/commit/33ef329d6480bb7bed6aadc144ba222ea5d14bbf and https://github.com/PS5Dev/PS5-UMTX-Jailbreak/commit/166f6ace30769f5803bae8398e03ef859b116c06 . Native loader v0.17 source, Makefile and GPL-3.0 license are retained in corresponding-source/elfldr-v0.17 (commit 9198efdb02535e6647b00db6d9dac223874b1a87). Source SDK prerequisite: https://github.com/ps5-payload-dev/sdk . The PS5Dev host does not record the SDK commit used for its rebuild, so bit-for-bit native rebuild reproducibility is not claimed.\n`;
 write(base+'/README.md',notice+'\nDeployment: generated web modules use .js filenames with rewritten local imports so static servers send a JavaScript MIME type. Original .mjs sources remain unchanged. PS4 application caching additionally requires the server to send psfree_lapse.appcache as text/cache-manifest. The current local preview sends that manifest as application/octet-stream; offline installation there is unavailable until that MIME mapping is configured. This does not block the online JavaScript loader.\n');
 write(base+'/style.css',css);
 write(base+'/index.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${spec.label} | whatwhatboy</title><link rel="stylesheet" href="style.css"></head><body><main><a href="/hosts/${spec.console}/">← ${spec.console.toUpperCase()} host</a><h1>${spec.label}</h1><p>${spec.description}</p><p class="status" id="runtime-status">Checking this browser…</p><button id="runtime-start" disabled>Start ${spec.console.toUpperCase()} loader</button><p>Supported firmware: ${spec.firmwares.join(', ')}.</p><p>Wait for the loader's own readiness message before sending a matching <code>.${spec.listener.format}</code> to TCP <code>${spec.listener.port}</code>. Use only files built for this console, firmware and loader ABI.</p><p><small>Prepared from a pinned upstream build. Hardware execution has not been tested.</small></p><p><a href="README.md">Source, changes &amp; licenses</a> · <a href="build.json">Build inventory &amp; SHA-256</a> · <a href="https://github.com/${spec.repo}/tree/${spec.commit}" target="_blank" rel="noopener">Upstream source</a></p></main><script src="guard.js"></script><script>document.getElementById('runtime-start').onclick=function(){if(window.whatsiteRuntimeAllowed)location.href='web/index.html';};</script></body></html>\n`);
 if(spec.console==='ps4'){
  let lapse=read(upstream+'/lapse.mjs');
  const tail=lapse.indexOf('kexploit().then(() => {');if(tail<0)throw Error('Pinned PS4 integration marker changed');
  lapse=lapse.slice(0,tail)+`// whatwhatboy integration, 2026-11-02: retain AIO fix, start native BIN listener; no auto GoldHEN.\nkexploit().then(() => {\n    PayloadLoader("aio_patches.bin");\n    runBinLoader();\n}).catch(error => { log('Bootstrap failed: ' + error); });\n`;
  write(web+'/lapse.mjs',lapse);
  let alert=read(upstream+'/alert.mjs').replace("import('./psfree.mjs');","if (window.whatsiteRuntimeAllowed) import('./psfree.mjs');");write(web+'/alert.mjs',alert);
  let index=read(upstream+'/index.html').replace('<html>','<html manifest="psfree_lapse.cache">').replace(/        <script>[\s\S]*?<\/script>/,'').replace('<head>','<head><meta name="viewport" content="width=device-width,initial-scale=1"><script src="../guard.js"></script>');
  index=index.replace('PSFree: A PS4/PS5 Exploit Chain','PS4 9.00 · PSFree / Lapse · BIN loader 9020').replace('<pre id=\'console\'>','<p id="runtime-status"></p><p><a href="../README.md">Source &amp; integration changes</a></p><pre id=\'console\'>');
  write(web+'/index.html',index);
  write(web+'/about.html',read(upstream+'/about.html').replaceAll('./scripts/lapse.mjs','./lapse.mjs').replaceAll('./rop/800.mjs','./rop/900.mjs').replaceAll('./kpatch/80x.c','./kpatch/900.c'));
  let cache=read(upstream+'/cache.html').replace(/<link rel="shortcut icon"[^>]*><\/link>/,'').replace(/background-image: url\("bg.jpg"\);/,'');write(web+'/cache.html',cache);
  const entries=read(upstream+'/psfree_lapse.cache').replaceAll('\\','/').split(/\r?\n/).filter(l=>l.trim()!=='goldhen.bin');
  entries.splice(2,0,'# whatwhatboy BIN-only integration 2026-11-02','../guard.js','../README.md','send.mjs');write(web+'/psfree_lapse.cache',entries.join('\n'));
 }else{
  let exploit=read(upstream+'/exploit.js').replace('debug_log("[!] failed to load local elf: " + error);','debug_log("[!] failed to load local elf: " + error);\n            throw error;');
  write(web+'/exploit.js',exploit);
  // No downloaded script is requested on a PC or unsupported console firmware.
  const original=read(upstream+'/index.html');const scripts=[...original.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
  const inline=original.match(/    <script>\r?\n([\s\S]*?)    <\/script>/)?.[1];if(!inline)throw Error('Pinned PS5 startup block changed');
  const clean=original.replace(/<script[\s\S]*?<\/script>/g,'').replace('<head>','<head><script src="../guard.js"></script>').replace('</body>',`<script>if(window.whatsiteRuntimeAllowed){var files=${JSON.stringify(scripts)};var at=0;function next(){if(at===files.length){${inline}\nreturn;}var s=document.createElement('script');s.src=files[at++];s.onload=next;s.onerror=function(){document.getElementById('console').value+='\\nRuntime dependency failed to load.';};document.body.appendChild(s);}next();}else{document.getElementById('main-content').innerHTML='<p>Use a supported PS5 browser. <a href="../">Return to loader details</a></p>';}</script></body>`);
  write(web+'/index.html',clean);
 }
 // Serve ESM as .js so ordinary static servers provide a JavaScript MIME type.
 // Original .mjs files remain untouched in upstream/.
 for(const f of allFiles(path.join(root,web))){
  const rel=path.relative(path.join(root,web),f).replaceAll('\\','/');
  if(!/\.(?:mjs|js|html|cache|appcache)$/.test(rel))continue;
  let content=fs.readFileSync(f,'utf8').replaceAll('.mjs','.js').replaceAll('psfree_lapse.cache','psfree_lapse.appcache').replace('prefer-online:','prefer-online');
  const deployed=rel.replace(/\.mjs$/,'.js').replace(/psfree_lapse\.cache$/,'psfree_lapse.appcache');
  write(web+'/'+deployed,content);
  if(deployed!==rel)fs.unlinkSync(f);
 }
 const files=allFiles(path.join(root,base)).filter(f=>!f.endsWith(path.sep+'build.json')).map(f=>{const b=fs.readFileSync(f);return {path:path.relative(path.join(root,base),f).replaceAll('\\','/'),bytes:b.length,sha256:sha(b)};}).sort((a,b)=>a.path.localeCompare(b.path));
 const manifest={schemaVersion:1,id:spec.id,title:spec.label,console:spec.console,entry:'/hosts/runtime/'+spec.id+'/',runEntry:'/hosts/runtime/'+spec.id+'/web/index.html',firmwares:spec.firmwares,listener:spec.listener,source:{repository:'https://github.com/'+spec.repo,commit:spec.commit},license:spec.license,offline:spec.offline,verified:{staticDependencies:true,hardwareExecution:false,downloadedCodeExecuted:false},files};
 write(base+'/build.json',JSON.stringify(manifest,null,2)+'\n');manifests.push(manifest);
}
write('docs/host-runtime-builds.json',JSON.stringify({schemaVersion:1,updated:'2026-11-02',runtimes:manifests,excluded:[{repo:'soniciso1/relapse',commit:'112dbe5949e9c3de923bb0909289c58a9c082151',reason:'No repository license found. Remains an external reference; not mirrored.'}]},null,2)+'\n');
require('./ps4-browser-hosts.cjs').refreshLegacyEntries(root);
require('./ps5-browser-hosts.cjs').refresh(root);
console.log(JSON.stringify({runtimes:manifests.map(m=>({id:m.id,files:m.files.length,entry:m.entry,listener:m.listener}))},null,2));
