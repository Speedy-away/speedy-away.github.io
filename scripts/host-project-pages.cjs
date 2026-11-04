'use strict';
// Build the independent project-site deployment without altering archived files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),BASE='',ORIGIN='https://speedy-away.github.io',MAIN='https://whatwhatboy.com',LIMIT=880*1024*1024;
const ASSET_VERSION='20261104consolebanner1';
const slash=p=>p.replaceAll('\\','/'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name.startsWith('.')?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function cacheResources(root,names){const resources=new Set();for(const name of names.filter(p=>/^hosts\/runtime\/.+\.(?:manifest|appcache|cache)$/i.test(p))){if(!fs.existsSync(path.join(root,name)))continue;let section='CACHE';for(let line of fs.readFileSync(path.join(root,name),'utf8').split(/\r?\n/)){line=line.trim();if(!line||line.startsWith('#')||line==='CACHE MANIFEST')continue;if(/^[A-Z]+:$/.test(line)){section=line.slice(0,-1);continue;}if(section!=='CACHE')continue;try{const url=new URL(line,'https://host.invalid/'+name);if(url.origin==='https://host.invalid')resources.add(decodeURIComponent(url.pathname.slice(1)));}catch{}}}return resources;}
// Active native inputs must remain on Pages; ZIP archives keep their existing delivery policy.
function activeRuntimeFiles(root,names){
 const scopes=require('./host-compact-pages.cjs').groups(root).map(g=>g.runtime&&g.originalEntry?g.runtime+g.originalEntry.scope:path.posix.dirname(g.runtimeEntry||'')+'/').filter(p=>p.startsWith('/hosts/runtime/')).map(p=>p.slice(1));
 return new Set(names.filter(p=>scopes.some(scope=>p.startsWith(scope))&&!/\.(?:zip|7z|rar|md|py|sh)$/i.test(p)&&!p.includes('/upstream/')));
}
// Only authored handoff metadata is adapted. Original native code and modules
// remain byte-identical; the local controller validates these URLs again.
function runtimeConfigHTML(html){
 function local(value){
  if(typeof value!=='string')return value;
  const url=new URL(value,ORIGIN+'/');
  if(![ORIGIN,MAIN].includes(url.origin))return value;
  const match=url.pathname.match(/^\/(?:(?:WWB-HOST|wwb-host)\/)?(hosts\/runtime\/.*)$/);
  return match?BASE+'/'+match[1]+url.search+url.hash:value;
 }
 return html.replace(/(<script\b[^>]*\bid=["']site-load-data["'][^>]*>)([\s\S]*?)(<\/script>)/gi,(whole,open,json,close)=>{
  const data=JSON.parse(json);data.launchURL=local(data.launchURL);
  if(data.nativeRoute){for(const key of ['runtime','target'])if(data.nativeRoute[key])data.nativeRoute[key]=local(data.nativeRoute[key]);}
  return open+JSON.stringify(data).replaceAll('<','\\u003c')+close;
 });
}
function build(output,revision='main',root=ROOT){
 assert.ok(output&&!fs.existsSync(output),'Use a fresh build directory');assert.match(revision,/^(?:main|[a-f0-9]{40})$/);const karo=JSON.parse(fs.readFileSync(path.join(root,'docs/host-reviews/karo/build.json'))),activeKaro=karo.runtime.replace(/^\//,'').replace(/web\/$/,''),all=walk(root).map(f=>slash(path.relative(root,f))).filter(p=>!/^tmp\/|^scripts\/|^i18n-tools\//.test(p));
 const selected=all.filter(p=>!/^docs\/(?:host-goldhen-current-private-inventory|host-compact-download-inventory|host-game-patch-file-import)\.json$/i.test(p)&&!/^docs\/(?:migration|qa|screenshots|host-reviews\/.*(?:retained|full-tests|.*log))/i.test(p)&&!/^AGENTS\.md$|^README\.md$|^SYNC|^sync\./i.test(p)&&(!/^hosts\/runtime\/karo-/.test(p)||p.startsWith(activeKaro))&&!/^hosts\/runtime\/.*\/upstream\//.test(p));
 const excluded=new Set(all.filter(p=>!selected.includes(p))),mapping={};let files=selected.map(name=>({name,bytes:fs.statSync(path.join(root,name)).size}));let bytes=files.reduce((n,f)=>n+f.bytes,0);
 const senderManifest=path.join(root,'downloads/helpers/console-payload-sender/manifest.json');
 if(fs.existsSync(senderManifest))for(const sender of JSON.parse(fs.readFileSync(senderManifest,'utf8')).files)if(sender.publicDownloadURL){assert.ok(require('./sender-download-url.cjs').isAllowed(sender.publicDownloadURL),'Invalid sender download source');mapping[sender.url]=sender.publicDownloadURL;}
 for(const file of files)if(mapping['/'+file.name])bytes-=file.bytes;
 const pinned=activeRuntimeFiles(root,selected),cached=cacheResources(root,selected),raw=p=>'https://raw.githubusercontent.com/Speedy-away/speedy-away.github.io/'+revision+'/'+p.split('/').map(encodeURIComponent).join('/');
 const candidates=files.filter(f=>/^downloads\//.test(f.name)&&!(/\.(?:html|json|js|css|txt|md|ini|xml)$/i.test(f.name))||/^hosts\/runtime\/.*\/(?:_decoded|_unavailable)\//.test(f.name)||/^hosts\/runtime\/.*\.(?:bin|elf|bz2|zip)$/i.test(f.name)).sort((a,b)=>b.bytes-a.bytes);
 for(const f of candidates){if(mapping['/'+f.name])continue;if(pinned.has(f.name)||cached.has(f.name)||bytes<LIMIT&& !/^downloads\/.+\.zip$/.test(f.name))continue;mapping['/'+f.name]=raw(f.name);bytes-=f.bytes;}
 assert.ok(bytes<LIMIT,'Active runtime deployment exceeds Pages budget');
 const hosted=new Set(files.filter(f=>!mapping['/'+f.name]).map(f=>f.name)),directories=new Set();for(const p of hosted){let dir=path.posix.dirname(p);while(dir!=='.'){directories.add(dir+'/');dir=path.posix.dirname(dir);}}function target(value){const original=value.replace(/^\//,''),parts=original.match(/^([^?#]*)(.*)$/),p=parts[1],suffix=parts[2];let lookup=p;try{lookup=decodeURIComponent(p);}catch{}if(p===''||p==='index.html')return BASE+'/'+suffix;if(mapping['/'+lookup])return mapping['/'+lookup]+suffix;if(hosted.has(lookup)||(/^hosts\/runtime\//.test(lookup)&&directories.has(lookup))||hosted.has(lookup.replace(/\/$/,'')+'/index.html')||['assets/','languages/','hosts/','downloads/'].includes(p))return BASE+'/'+p+suffix;return MAIN+'/'+p+suffix;}
 const manifestAliases=new Map(selected.filter(p=>/^hosts\/runtime\/.+\.cache$/i.test(p)&&/^\uFEFF?CACHE MANIFEST/.test(fs.readFileSync(path.join(root,p),'utf8'))).map(p=>[p,p.replace(/\.cache$/i,'.manifest')]));
 function manifestHTML(html,name){return html.replace(/(<html\b[^>]*?\bmanifest\s*=\s*)(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi,(whole,start,a,b,c)=>{try{const u=new URL(a||b||c,'https://host.invalid/'+name),alias=manifestAliases.get(decodeURIComponent(u.pathname.slice(1)));return alias?start+'"'+BASE+'/'+alias+u.search+u.hash+'"':whole;}catch{return whole;}});}
 const internalRoots=['hosts','assets','languages','downloads','console','docs'];
 function rewrite(text,name){
  text=text.replaceAll(ORIGIN+'/wwb-host/',ORIGIN+BASE+'/').replaceAll(ORIGIN+'/WWB-HOST/',ORIGIN+BASE+'/').replaceAll('\"/WWB-HOST/','\"'+BASE+'/').replaceAll("'/WWB-HOST/","'"+BASE+'/');
  // Repair migrated image origins and absent social preview images.
  if(name.endsWith('.html'))text=text.replace(/https:\/\/whatwhatboy\.com(\/assets\/images\/[^\s"'<>\\]*)/g,(_,p)=>{const local=p.split(/[?#]/)[0];const fallback='/assets/images/'+require('./style-host-pages.cjs').artwork(name)[0];return ORIGIN+BASE+(fs.existsSync(path.join(root,local))?p:fallback);});
  if(/^hosts\/(?!runtime\/).+\.html$/.test(name)&&fs.existsSync(path.join(root,'assets/host-pages.css')))text=require('./style-host-pages.cjs').themeHTML(text,name);
  if(name.endsWith('.html'))text=text.replace(/(host-playstation\.js|host-dashboard\.js|host-catalog-grid\.js|host-folders\.js|host-trainer\.js|host-karo-builds\.js|host-local-launcher\.js|afterglow-public-launcher\.js|host-site-load\.js|host-game-patches\.js|i18n\.js)(?:\?v=[\w.-]+)?(?=["'])/g,(_,asset)=>asset+'?v='+ASSET_VERSION);
  if(name==='assets/host-dashboard.js')text=text.replaceAll('^\\/hosts\\/runtime\\/','^\\/(?:(?:WWB-HOST|wwb-host)\\/)?hosts\\/runtime\\/');
  if((name==='index.html'||/^hosts\/(?!runtime\/).+\.html$/.test(name))&&fs.existsSync(path.join(root,'assets/host-performance.js'))){
   text=text.replace(/<link\b[^>]*href=["'][^"']*(?:font-awesome|fonts\.googleapis\.com)[^"']*["'][^>]*>/gi,'');
   text=text.replace(/<script\b[^>]*src=["'][^"']*(?:\/script\.js|\/assets\/site-background\.js)(?:\?[^"']*)?["'][^>]*><\/script>/gi,'');
   text=text.replace(/<script\b([^>]*?)type=["']module["']([^>]*?)src=["']([^"']*host-esp-flasher\.js[^"']*)["']([^>]*)><\/script>/gi,(_,a,b,src)=>'<meta data-host-desktop-module="'+src+'">');
   text=text.replace(/<img\b[^>]*>/gi,tag=>/\bwidth=["'](?:24|32)["']/.test(tag)?tag:tag.replace(/\bsrc=/i,'data-host-src='));
   text=text.replace(/<head\b[^>]*>/i,m=>m+'<script src="/assets/host-performance.js?v=2"></script>');
   text=text.replace('</head>','<link rel="stylesheet" href="/assets/host-performance.css?v=4"></head>');
  }
  if(name.endsWith('.html'))text=require('./host-compact-pages.cjs').apply(text,name,{root});
  if(/^hosts\/(?!runtime\/).+\.html$/.test(name))text=text.replace('</head>','<link rel="stylesheet" href="/assets/host-compact.css?v=1"><link rel="stylesheet" href="/assets/host-blue-theme.css?v=1"></head>');
  // Prefix authored root-relative strings, including concatenated directory roots.
  text=text.replace(/https:\/\/whatwhatboy\.com\/(hosts\/[^\s"'<>\\]*)/g,(_,p)=>{const url=target(p);return /^https?:/.test(url)?url:ORIGIN+url;});
  text=text.replace(/(["'`=\s(])\/(hosts|assets|languages|downloads|console|docs)\/([^\s"'`<>)]*)/g,(whole,lead,dir,rest)=>{const p=dir+'/'+rest;if((!rest&&name.endsWith('.js'))||/^\$\{|\+/.test(rest))return lead+BASE+'/'+p;return lead+target(p);});
  text=text.replace(/((?:href|action)\s*=\s*["'])\/(["'])/g,'$1'+ORIGIN+BASE+'/$2');
  text=text.replace(/((?:href|src|action|poster)\s*=\s*["'])\/([^"']*)(["'])/gi,(whole,start,p,end)=>BASE&&p.startsWith(BASE.slice(1)+'/')?whole:start+target(p)+end);
  if(name.endsWith('.html'))text=text.replace(/<!-- BEGIN SITE AD -->[\s\S]*?<!-- END SITE AD -->/g,'').replace(/<script\b[^>]*src=["'][^"']*site-ads\.js[^"']*["'][^>]*><\/script>/g,'');
  if(name.endsWith('.html'))text=require('./host-ads.cjs').apply(name,text,{base:BASE});
  if(name.endsWith('.html'))text=text.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/i,'<link rel="canonical" href="'+ORIGIN+BASE+'/'+name.replace(/index\.html$/,'')+'">');
  if((name==='index.html'||/^hosts\/(?!runtime\/).+\.html$/.test(name))&&fs.existsSync(path.join(root,'assets/host-playstation.css')))text=text.replace(/<link\b[^>]*href="[^"]*host-playstation\.css[^"]*"[^>]*>/gi,'').replace('</head>','<link rel="stylesheet" href="'+BASE+'/assets/host-playstation.css?v='+ASSET_VERSION+'"></head>');
  if(name==='hosts/karo/index.html'||name==='hosts/karo/versions.html')text=require('./split-karo-file-lists.cjs').split(text,name,{base:BASE,revision,emit:(p,content)=>{assert.ok(!selected.includes(p),'Generated list collides with source: '+p);const dest=path.join(output,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,content);hosted.add(p);}});
  if(/^hosts\/(?!runtime\/).+\.html$/.test(name)&&fs.existsSync(path.join(root,'assets/host-dashboard.js'))&&fs.readFileSync(path.join(root,'assets/host-dashboard.js'),'utf8').includes('WWB_HOST_ACTION_DATA'))text=require('./share-host-catalogues.cjs').share(text,{base:BASE,emit:(p,content)=>{assert.ok(!selected.includes(p),'Generated catalogue collides with source');const dest=path.join(output,p);fs.mkdirSync(path.dirname(dest),{recursive:true});if(fs.existsSync(dest))assert.equal(fs.readFileSync(dest,'utf8'),content);else fs.writeFileSync(dest,content);hosted.add(p);}});
  return text;
 }
 fs.mkdirSync(output,{recursive:true});let nativeFiles=0;
 for(const f of files){if(mapping['/'+f.name])continue;const source=path.join(root,f.name),destination=path.join(output,f.name);fs.mkdirSync(path.dirname(destination),{recursive:true});const original=fs.readFileSync(source);let data=original;
  const runtime=f.name.startsWith('hosts/runtime/'),immutable=f.name.startsWith('downloads/')||/^console\/ps[45]\/whatsite-ps[45]\.html$/.test(f.name);
  if(runtime&&/\.m?js$/i.test(f.name)){nativeFiles++;}
  else if(!immutable&&/\.(?:html|js|css|json|xml|md|txt)$/i.test(f.name)){let text=original.toString('utf8');if(!runtime)text=rewrite(text,f.name);
   if(runtime&&f.name.endsWith('.html')){text=runtimeConfigHTML(require('./host-compact-pages.cjs').apply(text,f.name,{base:BASE,root}));text=text.replace(/("original"\s*:\s*)("(?:\\.|[^"\\])*")/g,(whole,key,value)=>key+JSON.stringify(manifestHTML(JSON.parse(value),f.name)).replaceAll('<','\\u003c'));text=manifestHTML(text,f.name);const inject='<script src="'+BASE+'/host-runtime-map.js?v='+revision+'"></script><script src="'+BASE+'/assets/host-project-routing.js?v=2"></script>';text=/<head\b[^>]*>/i.test(text)?text.replace(/<head\b[^>]*>/i,h=>h+inject):inject+text;}
   data=Buffer.from(text);
  }fs.writeFileSync(destination,data);
 }
 for(const [source,alias]of manifestAliases){const bytes=fs.readFileSync(path.join(root,source)),destination=path.join(output,alias);if(fs.existsSync(destination))assert.equal(sha(fs.readFileSync(destination)),sha(bytes),'Conflicting cache alias');else fs.writeFileSync(destination,bytes);hosted.add(alias);}
 // Old native bookmarks get the exact archived build, rather than executing a
 // different current chain. The original files remain untouched in Git.
 let historicalLandings=0;for(const name of all.filter(p=>/^hosts\/runtime\/karo-[^/]+\/.+\.html$/i.test(p)&&!p.startsWith(activeKaro))){const m=name.match(/^hosts\/runtime\/karo-([a-f0-9]{12})-([a-f0-9]{12})\/(?:web\/)?(.*)$/);if(!m)continue;const rest=m[3],parts=rest.split('/'),unit=parts[0]==='ps5'?'ps5-'+parts[1]:parts[0],job=(karo.retainedArtifactJobs||[]).find(j=>j.id==='karo-ready-'+unit+'-'+m[2]);const download=job?raw(job.importPath):null;const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, follow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Retained KARO build | WWB HOST</title><link rel="stylesheet" href="'+BASE+'/assets/host-karo-builds.css"></head><body><main><h1>Retained KARO build</h1><p>This bookmark belongs to snapshot '+m[2]+'. Its original files remain preserved.</p>'+(download?'<p><a href="'+download+'" download>Download this exact '+unit+' web-host build</a></p>':'')+'<p><a href="'+BASE+'/hosts/karo/versions.html">All retained versions</a></p><p><a href="'+BASE+'/hosts/karo/">Current reviewed KARO builds</a></p><p>Opening this archive page starts no native code. Extract the complete ready ZIP and use its matching-console entry.</p></main></body></html>';const dest=path.join(output,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,html);hosted.add(name);historicalLandings++;}
 const aliases={};for(const p of hosted){aliases['/'+p]=BASE+'/'+p;if(/(?:^|\/)index\.html$/.test(p)){const directory=p.replace(/index\.html$/,'');aliases['/'+directory]=BASE+'/'+directory;}}for(const [p,u]of Object.entries(mapping))aliases[p]=u;
 fs.writeFileSync(path.join(output,'host-project-map.js'),'window.WWB_HOST_PROJECT='+JSON.stringify({base:BASE,main:MAIN,aliases}).replaceAll('<','\\u003c')+';');
 fs.writeFileSync(path.join(output,'host-runtime-map.js'),'window.WWB_HOST_PROJECT='+JSON.stringify(require('./compact-host-routing.cjs').compact(hosted,mapping,BASE,MAIN)).replaceAll('<','\\u003c')+';');
 assert.ok(fs.existsSync(path.join(root,'index.html')),'Root host home page is required');fs.writeFileSync(path.join(output,'index.html'),rewrite(fs.readFileSync(path.join(root,'index.html'),'utf8'),'index.html'));
 fs.writeFileSync(path.join(output,'404.html'),'<!doctype html><html><head><meta charset="utf-8"><title>WWB HOST file lookup</title></head><body><p id="status">Finding the preserved host file…</p><a href="'+BASE+'/hosts/">Hosts</a><script src="'+BASE+'/host-project-map.js"></script><script>var p=decodeURIComponent(location.pathname).replace(/^\\/(?:WWB-HOST|wwb-host)/,""),u=WWB_HOST_PROJECT.aliases[p];if(u&&(u.indexOf("https://raw.githubusercontent.com/Speedy-away/speedy-away.github.io/")===0||u.indexOf("https://github.com/Speedy-away/speedy-away.github.io/releases/download/")===0||u.indexOf("https://raw.githubusercontent.com/Speedy-away/WWB-HOST/")===0||u.indexOf("https://raw.githubusercontent.com/Speedy-away/wwb-host/")===0||u.indexOf("https://github.com/Speedy-away/WWB-HOST/releases/download/")===0||u.indexOf("https://github.com/Speedy-away/wwb-host/releases/download/")===0||u.indexOf("https://raw.githubusercontent.com/Speedy-away/whatsite/")===0))location.replace(u);else document.getElementById("status").textContent="This file is not in the active site. Choose its preserved download from the host directory.";</script></body></html>');
 fs.writeFileSync(path.join(output,'.nojekyll'),'');const report={revision,base:BASE,origin:ORIGIN,bytes:walk(output).reduce((n,f)=>n+fs.statSync(f).size,0),budget:LIMIT,files:hosted.size,offloadedFiles:Object.keys(mapping).length,nativeScriptsUnchanged:nativeFiles,cacheManifestAliases:manifestAliases.size,historicalLandings,activeKaro,routingBytes:{full:fs.statSync(path.join(output,'host-project-map.js')).size,runtime:fs.statSync(path.join(output,'host-runtime-map.js')).size},activeRuntimeFiles:pinned.size,sharedCatalogueFiles:[...hosted].filter(p=>p.startsWith('assets/host-catalogues/')).length,downloadMap:mapping};assert.ok(report.bytes<1e9);fs.writeFileSync(path.join(output,'pages-build.json'),JSON.stringify({...report,downloadMap:undefined},null,2));console.log(JSON.stringify({...report,downloadMap:undefined}));return report;
}
if(require.main===module)build(path.resolve(process.argv[2]),process.env.GITHUB_SHA||'main');module.exports={build,cacheResources,activeRuntimeFiles,runtimeConfigHTML,BASE,ORIGIN,MAIN,ASSET_VERSION};
