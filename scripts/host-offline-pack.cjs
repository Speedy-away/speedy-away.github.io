'use strict';
// Build bounded same-origin offline sets from the final deployment. Read bytes only.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ORIGIN='https://speedy-away.github.io',sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function optionalCache(name){return /^(?:(?:es|pt|fr|de|ru|tr|pl|it|zh|ja|ko|th|vi|id|hi|sr|nl|ka|ar|he)\/)?(?:hosts\/runtime\/ps4-afterglow-944d5aeed06f\/|hosts\/ps4\/afterglow-1402\/|ps4\/14\.02\/)/.test(name);}
function scopes(root){return require('./host-compact-pages.cjs').groups(root).filter(group=>group.id!=='ps4-afterglow-1402').map(group=>({platform:group.platform,entry:group.entry,runtime:group.runtime&&group.originalEntry?group.runtime+group.originalEntry.scope:group.runtimeEntry?.match(/^(\/hosts\/runtime\/[^/]+\/)/)?.[1]})).filter(group=>group.runtime);}
const publicLaunchers=['ps4/14.00/index.html','ps5/7.61/index.html','ps5/relapse/index.html'];
function platformFor(name,groups){if(optionalCache(name))return null;name=name.replace(/^(?:es|pt|fr|de|ru|tr|pl|it|zh|ja|ko|th|vi|id|hi|sr|nl|ka|ar|he)\//,'');if(publicLaunchers.includes(name))return name.slice(0,3);const direct=name.match(/^(?:hosts\/|offline\/)(ps[45])\//);if(direct)return direct[1];return groups.find(group=>name.startsWith(group.runtime.slice(1)))?.platform||null;}
function associate(html,platform){if(!platform||!/<html\b/i.test(html))return html;return html.replace(/<html\b[^>]*>/i,tag=>tag.replace(/\smanifest\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i,'').replace(/>$/,' manifest="/offline/'+platform+'.manifest">'));}
function decorate(html,name,groups){
 const platform=platformFor(name,groups),authored=/^hosts\/(?!runtime\/).+\.html$/.test(name)&&!/<meta\b[^>]*http-equiv=["']refresh/i.test(html);
 if(authored&&platform){if(!html.includes('class="host-offline-link"'))html=html.replace(/(<nav\b[^>]*class="[^"]*\bhost-taskbar\b[^"]*"[^>]*>)([\s\S]*?)(<\/nav>)/i,'$1$2<a class="host-offline-link" href="/offline/'+platform+'/">Offline cache</a>$3');if(!html.includes('/assets/host-offline.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/host-offline.css?v=20261104offline2"></head>');}
 if(name==='hosts/ps4/exploit/gamerhack-g2all/index.html'&&!html.includes('data-offline-required'))html=html.replace('<label class="confirmation">','<p class="host-offline-note" data-offline-required>First <a href="/offline/ps4/">save the PS4 offline cache</a>. Wait for Cache ready, then close and reopen the PS4 host before Load.</p><label class="confirmation">');
 // Masters explicitly share the complete platform cache; cache downloads execute nothing.
 if(platform)html=associate(html,platform);
 return html;
}
function installer(platform){const label=platform.toUpperCase();return '<!doctype html><html lang="en" manifest="/offline/'+platform+'.manifest"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, follow"><title>'+label+' Offline Cache | WWB HOST</title><meta name="description" content="Save the '+label+' host, supported exploit files, game patch XMLs and local trainer data for offline use."><link rel="stylesheet" href="/assets/host-offline.css?v=20261104offline2"><script defer src="/languages/i18n.js?v=20261104languages2"></script><script defer src="/assets/host-offline.js?v=20261104languages2"></script></head><body class="host-offline-page" data-host-offline-platform="'+platform+'"><main><nav><a href="/hosts/'+platform+'/">← '+label+' host</a><a href="/">WWB HOST</a></nav><p class="host-offline-eyebrow">'+label+' · OFFLINE</p><h1>Save your host.<br>Use it offline.</h1><p>Save host pages and supported files for offline use.</p><section class="host-offline-panel"><div class="host-offline-panel-title"><h2>Your offline copy</h2><span id="host-offline-network">This device</span></div><p id="host-offline-summary">Checking saved files…</p><p id="host-offline-status" role="status" aria-live="polite">Checking offline support…</p><progress id="host-offline-progress" hidden value="0" max="100" aria-label="Offline download progress"></progress><div class="host-offline-actions"><button type="button" id="host-offline-save">Save for offline</button><button type="button" id="host-offline-verify" disabled>Check saved files</button><a class="host-offline-open" href="/hosts/'+platform+'/">Open '+label+' host →</a></div><p class="host-offline-note">Retry to reuse verified files.</p></section><h2>Ready when you are</h2><ol><li>Open this page online on your '+label+'.</li><li>Wait for Cache ready before closing this page.</li><li>Close and reopen the host after saving. <a href="/hosts/'+platform+'/">'+label+' host</a>.</li></ol>'+(platform==='ps5'?'<p class="host-offline-note"><strong>PS5 Relapse:</strong> <span>Keep the console connected to your local network.</span></p>':'<p class="host-offline-note"><strong>PS4 WebKit 7.00–14.02:</strong> <span>Wait for Cache ready before closing this page.</span></p>')+'<p>External links and large downloads need internet access.</p><p>Saving files does not run an exploit or install a payload.</p><p>Clearing browser data can remove your offline copy.</p></main></body></html>\n';}
function prepare(output){const names=[];for(const platform of ['ps4','ps5']){const dir=path.join(output,'offline',platform);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),installer(platform));names.push('offline/'+platform+'/index.html');}return names;}
function build(output,root,groups=scopes(root)){
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.relative(output,path.join(dir,entry.name)).replaceAll('\\','/')]);
 if(!fs.existsSync(path.join(output,'offline/ps4/index.html')))prepare(output);
 const names=walk(output),available=new Set(names),reports=[];
 const publicRoutes=new Set([...require('./host-public-routes.cjs').routes().map(route=>route.target),...publicLaunchers]);
 for(const platform of ['ps4','ps5']){
  const selected=new Set(),knownURLs=new Map(),routes=groups.filter(group=>group.platform===platform),activeEntries=new Set(routes.map(group=>group.entry.slice(1)+'index.html'));
  function add(name,url='/'+name.split('/').map(encodeURIComponent).join('/')){if(!available.has(name)||/\/(?:upstream|source|corresponding-source)\//.test(name)||/\.(?:zip|7z|rar|pkg|md)$/i.test(name))return;selected.add(name);knownURLs.set(url,name);}
  for(const name of names){
   if(['index.html','hosts/updates/index.html','host-project-map.js','host-runtime-map.js','style.css'].includes(name)||/^assets\/host-[^/]+\.(?:js|css)$/.test(name)||/^assets\/host-catalogues\/[^/]+\.js$/.test(name)||/^languages\/[^/]+\.(?:js|json)$/.test(name)||name==='offline/'+platform+'/index.html')add(name);
   if(new RegExp('^(?:'+require('./host-locales.cjs').codes.join('|')+')/(?:index\\.html|(?:hosts|offline)/'+platform+'/)').test(name))add(name);
   if(name.startsWith('hosts/'+platform+'/')&&!name.includes('/exploit/')&&!name.includes('/afterglow/'))add(name);
   if(name.startsWith(platform+'/')&&publicRoutes.has(name))add(name);
   if(activeEntries.has(name))add(name);
   if(platform==='ps4'&&/^downloads\/hosts\/ps4\/plugin-templates\/20261104\/(?!originals\/).+\.ini$/.test(name))add(name);
   if(platform==='ps4'&&name.startsWith('hosts/tools/ps4-trainer/')&&!name.includes('/source/'))add(name);
   if(routes.some(group=>name.startsWith(group.runtime.slice(1)))&&!/\/payloads\//.test(name))add(name);
   if(routes.some(group=>name.startsWith(group.runtime.slice(1)))&&/\/payloads\/(?:elfldr[^/]*\.elf|kexp_[^/]+\.bin)$/.test(name))add(name);
  }
  // Follow local browsing dependencies and exact patch files. Optional cover art is excluded.
  for(const name of selected){if(!/\.(?:html|css|js|manifest|appcache|cache)$/.test(name))continue;let text=fs.readFileSync(path.join(output,name),'utf8');const refs=[];
   if(name.endsWith('.html')){const encoded=text.match(/"original"\s*:\s*("(?:\\.|[^"\\])*")/);if(encoded)text+='\n'+JSON.parse(encoded[1]);for(const match of text.matchAll(/\b(?:src|href|poster)=["']([^"']+)["']/gi))refs.push(match[1]);for(const match of text.matchAll(/"url":"([^"\n]+\.xml)"/g))refs.push(match[1]);}
   if(/\.(?:manifest|appcache|cache)$/.test(name)){let section='CACHE';for(let line of text.split(/\r?\n/)){line=line.trim();if(!line||line.startsWith('#')||line==='CACHE MANIFEST')continue;if(/^[A-Z]+:$/.test(line)){section=line.slice(0,-1);continue;}if(section==='CACHE')refs.push(line.split(/\s+/)[0]);}}
   if(name.endsWith('.css'))for(const match of text.matchAll(/url\(\s*["']?([^\s)'";]+)["']?\s*\)/gi))refs.push(match[1]);
   for(const value of refs){let url;try{url=new URL(value.replaceAll('&amp;','&'),ORIGIN+'/'+name);}catch{continue;}if(url.origin!==ORIGIN||url.hash||url.username||url.password)continue;let file=decodeURIComponent(url.pathname.slice(1));if(available.has(file+'index.html'))file+='index.html';if(available.has(file+'/index.html'))file+='/index.html';const native=platformFor(file,groups)===platform&&file.startsWith('hosts/runtime/');if(!/^(?:assets\/|languages\/|downloads\/.+\.xml$|style\.css$)/.test(file)&&!native)continue;if(native&&/\/payloads\//.test(file)&&!/\/payloads\/(?:elfldr[^/]*\.elf|kexp_[^/]+\.bin)$/.test(file))continue;add(file,url.pathname+url.search);}
  }
  // Shared original runtime artwork/styles can live one level above a native scope.
  for(const group of routes){const base=group.runtime.match(/^(\/hosts\/runtime\/[^/]+\/web\/)/)?.[1];if(base)for(const leaf of ['style.css','img.jpg','btc.jpg','eth.jpg'])add(base.slice(1)+leaf);}
  for(const [url,name]of [...knownURLs])if(url.endsWith('/index.html'))knownURLs.set(url.slice(0,-10),name);
  // The shared updates page has one byte identity in both packs.
  for(const name of selected)if(name.endsWith('.html')&&name.startsWith('hosts/')&&name!=='hosts/updates/index.html'&&!optionalCache(name)){const file=path.join(output,name);fs.writeFileSync(file,associate(fs.readFileSync(file,'utf8'),platform));}
  const files=[...knownURLs].map(([url,name])=>{const bytes=fs.readFileSync(path.join(output,name));return {url,bytes:bytes.length,sha256:sha(bytes)};}).sort((a,b)=>a.url.localeCompare(b.url));
  const bytes=files.reduce((sum,file)=>sum+file.bytes,0);assert.ok(files.length<=4096,'Offline pack resource limit');assert.ok(bytes<=80*1024*1024,'Offline pack size limit');
  const version=sha(JSON.stringify(files)).slice(0,24),pack={schemaVersion:1,platform,version,bytes,files};fs.writeFileSync(path.join(output,'offline',platform+'.json'),JSON.stringify(pack,null,2)+'\n');
  const aliases=[...new Set(files.flatMap(file=>{const url=new URL(file.url,ORIGIN);if(url.pathname.endsWith('/index.html'))return [url.pathname.slice(0,-10)];return [];}))];
  const fallbacks=files.filter(file=>/\/(?:index\.html)?$/.test(file.url)&&!file.url.startsWith('/hosts/runtime/')).map(file=>file.url+'? '+file.url);
  fs.writeFileSync(path.join(output,'offline',platform+'.manifest'),'CACHE MANIFEST\n# WWB HOST '+platform+' '+version+'\nCACHE:\n'+[...files.map(file=>file.url),...aliases].join('\n')+'\nFALLBACK:\n'+fallbacks.join('\n')+'\nNETWORK:\n*\n');reports.push({platform,version,files:files.length,bytes,patchXMLs:files.filter(file=>file.url.endsWith('.xml')).length,trainerDefinitions:files.filter(file=>/\/ps4-trainer\/data\//.test(file.url)).length});
 }
 return reports;
}
module.exports={optionalCache,scopes,platformFor,associate,decorate,installer,prepare,build};
