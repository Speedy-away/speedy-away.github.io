'use strict';
// Presentation and navigation only. Native scripts and downloaded files are never edited.
const fs=require('node:fs'),path=require('node:path');
const popup=require('./host-self-host-popup.cjs');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const MODERN_PS4=['10.00','11.00','11.02','11.50','11.52','12.00','12.02','12.50','12.52','13.00','13.02','13.04','13.50','13.52'];
const PS5_REMAINING=['3.10','3.21','5.00','5.02','5.10','5.50'];
const PS4_ENTRY='/ps4/14.00/';

function publicPS4Actions(rows){
 const current=rows.find(action=>action.id==='local-gamerhack-g2all'&&action.category==='loaders'&&action.firmwares.includes('14.00'));
 if(!current)return rows;
 const downloads=rows.filter(action=>action.category!=='loaders').map(action=>{
  if(action.id!=='ps4-goldhen-user-supplied'||action.nativeRoute?.kind!=='afterglow')return action;
  const {browserHost,runtimeId,launchURL,launchLabel,nativeRoute,...download}=action;
  return {...download,requirements:[
   action.requirements[0],
   'This retained BIN is a download. Generic BIN sender compatibility is not established.'
  ]};
 });
 return [{
  ...current,
  label:'PS4 WebKit Exploit - 14.00',
  firmwareLabel:'14.00',
  firmwares:['14.00'],
  entryURL:PS4_ENTRY,
  nativeRoute:{...current.nativeRoute,entry:{...current.nativeRoute.entry,firmwares:['14.00']}},
  requirements:['Open on PS4 firmware 14.00. The launcher checks the browser cache and shows a live log.']
 },...downloads];
}

function ps4FirmwareTile(){
 return '<a class="host-firmware-family" data-firmwares="14.00" href="'+PS4_ENTRY+'"><strong>14.00</strong><span>Open WebKit loader</span></a>';
}

function projectPS4(html,name){
 if(!/^hosts\/ps4\//.test(name))return html;
 if(name==='hosts/ps4/firmware/index.html'){
  html=html.replace(/(<div class="host-firmware-families">)[\s\S]*?(<\/div>)/,(_,open,close)=>open+ps4FirmwareTile()+close);
 }
 html=html.replace(/<details class="host-other-directory">[\s\S]*?<\/details>/g,'');
 html=html.replace(/<a href="\/hosts\/ps4\/afterglow\/">13\.52 \/ 14\.00 · Afterglow<\/a>/g,'<a href="'+PS4_ENTRY+'">PS4 WebKit 14.00</a>');
 return html.replace(/(<script\b[^>]*\bid=["']host-actions-data["'][^>]*>)([\s\S]*?)(<\/script>)/i,(_,open,json,close)=>{
  const catalogue=JSON.parse(json);
  if(catalogue.platform!=='ps4'||!Array.isArray(catalogue.actions))return open+json+close;
  catalogue.actions=publicPS4Actions(catalogue.actions);
  return open+JSON.stringify(catalogue).replaceAll('<','\\u003c')+close;
 });
}

function showNativeLog(html,name){
 if(!/^hosts\/runtime\/gamerhack-g2all-[a-f0-9]{12}-[a-f0-9]{12}\/web\/g2all\/index\.html$/.test(name))return html;
 return html.replace(/<\/head>/i,'<link rel="stylesheet" href="/assets/host-native-log.css?v=1"></head>')
  .replace(/(<h1\s+id=msgs[^>]*>[\s\S]*?<\/h1>)/i,'$1<p id="wwb-native-log-label">Live loader log</p>');
}
function ps5RemainingRoute(rows){
 const source=rows.find(g=>g.id==='karo-ps5-umtx');
 if(!source)return null;
 if(source.platform!=='ps5'||source.ticket!=='existing-karo-guard'||source.originalEntry?.path!=='ps5/UMTX/index.html'||source.originalEntry.scope!=='ps5/UMTX/'||PS5_REMAINING.some(f=>!source.firmwares.includes(f)||!source.originalEntry.firmwares.includes(f)))throw Error('The preserved PS5 UMTX source no longer confirms the remaining firmware subset.');
 return {...source,id:'karo-ps5-umtx-remaining',label:'PS5 WebKit Exploit - 3.10 / 3.21 / 5.00–5.50',firmwares:PS5_REMAINING.slice(),entry:'/hosts/ps5/exploit/karo-ps5-umtx-remaining/',preferred:true,sourceRanges:[],originalEntry:{...source.originalEntry,firmwares:PS5_REMAINING.slice(),ranges:[]}};
}
function groups(root){
 const localFile=path.join(root,'docs/host-local-launchers.json');
 let rows=fs.existsSync(localFile)?JSON.parse(fs.readFileSync(localFile)).groups:[],remaining=ps5RemainingRoute(rows);
 rows=rows.filter(g=>['ps4-afterglow','karo-g2all','karo-g2allpro'].includes(g.id)).map(g=>g.id==='karo-g2allpro'?{...g,id:'karo-g2allpro-modern',label:'PS4 WebKit Exploit - 10.00–13.52',firmwares:MODERN_PS4.slice(),entry:'/hosts/ps4/exploit/karo-g2allpro-modern/',originalEntry:{...g.originalEntry,firmwares:MODERN_PS4.slice(),ranges:[]}}:g.id==='ps4-afterglow'?{...g,label:'PS4 WebKit Exploit - 13.52–14.00'}:{...g,label:g.platform.toUpperCase()+' WebKit Exploit - '+g.firmwares[0]+'–'+g.firmwares[g.firmwares.length-1]});
 if(remaining)rows.push(remaining);
 const rawFile=path.join(root,'docs/host-runtime-builds.json');
 if(fs.existsSync(rawFile)){const r=(JSON.parse(fs.readFileSync(rawFile)).runtimes||[]).find(r=>r.id==='ps5-umtx');if(r)rows.push({id:r.id,label:'PS5 WebKit Exploit - '+r.firmwares[0]+'–'+r.firmwares[r.firmwares.length-1],platform:'ps5',firmwares:r.firmwares.slice(),entry:r.entry,runtimeEntry:r.runEntry,preferred:true,source:r.source});}
 const gamerFile=path.join(root,'docs/host-gamerhack-local-build.json');
 if(fs.existsSync(gamerFile))rows.push(...JSON.parse(fs.readFileSync(gamerFile)).groups);
 const gamerOffline=path.join(root,'docs/host-gamerhack-g2all-build.json');
 if(fs.existsSync(gamerOffline))rows.push(...JSON.parse(fs.readFileSync(gamerOffline)).groups);
 const ps5File=path.join(root,'docs/ps5-webkit-build.json');
 if(fs.existsSync(ps5File)){const b=JSON.parse(fs.readFileSync(ps5File));rows.push({id:b.id,label:'PS5 WebKit Exploit - 7.00–13.60',platform:'ps5',firmwares:b.firmwares,entry:b.entry,runtimeEntry:b.runEntry,preferred:true,source:b.source,siteNative:true});}
 // A family label is presentation; compatibility remains the exact source array.
 return rows.filter(g=>g.firmwares?.length&&/^\/hosts\//.test(g.entry)&&fs.existsSync(path.join(root,g.entry.replace(/^\//,'').replace(/\/$/,'/index.html')))).sort((a,b)=>Number(a.firmwares[0])-Number(b.firmwares[0]));
}
function actions(root,platform,previous){
 const local=groups(root).filter(g=>g.platform===platform).map(g=>{
  if(g.id==='ps5-umtx'){
   const builtin=previous.find(a=>a.id==='built-in-ps5-umtx');if(!builtin)throw Error('Missing verified PS5 UMTX browser action.');
   return {...builtin,label:g.label,firmwareLabel:g.label.replace(/^PS5 WebKit Exploit - /,''),firmwares:g.firmwares.slice(),launchURL:g.runtimeEntry};
  }
  let route,target;
  if(g.id==='ps4-afterglow'){target=g.runtimeEntry;route={kind:'afterglow',target};}
  else if(g.siteNative){target=g.runtimeEntry;route={kind:'ps5-native',target};}
  else{const entry=g.originalEntry;if(!entry)throw Error('Missing local native entry: '+g.id);target=g.runtime+entry.path;route={kind:'karo',runtime:g.runtime,entry:{platform:g.platform,path:entry.path,scope:entry.scope,firmwares:g.firmwares.slice(),ranges:[],...(entry.cacheRequired?{cacheRequired:true}:{}),...(entry.blockedReason?{blockedReason:entry.blockedReason}:{})},...(entry.path==='ps5/UMTX/index.html'?{autorun:'umtx2'}:{})};}
  return {id:'local-'+g.id,platform,category:'loaders',label:g.label,firmwareLabel:g.label.replace(/^PS[45] WebKit Exploit - /,''),firmwares:g.firmwares.slice(),format:'Local browser loader',launchURL:target,launchLabel:'Load',runtimeId:g.id,localLauncher:true,browserHost:true,nativeRoute:route,source:g.source.repository+'/tree/'+g.source.commit,requirements:['Open on the matching console. Load starts the local runtime and its console progress.']};
 });
 return [...local,...previous.filter(a=>a.category!=='loaders').map(a=>a.id==='ps4-goldhen-user-supplied'?{...a,nativeRoute:{kind:'afterglow',target:a.launchURL}}:a)];
}
function directory(root,platform){
 const rows=groups(root).filter(g=>g.platform===platform),name=platform.toUpperCase();
 const tiles=platform==='ps4'?ps4FirmwareTile():rows.map(g=>'<a class="host-firmware-family" data-firmwares="'+g.firmwares.join(',')+'" href="'+esc(g.entry)+'"><strong>'+esc(g.label.replace(/^PS[45] WebKit Exploit - /,''))+'</strong><span>'+((g.payloadChoice||[]).map(p=>esc(p.label)).join(' / ')||'Load exploit')+'</span></a>').join('');
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+name+' WebKit Exploits | WWB HOST</title><link rel="stylesheet" href="/assets/host-compact.css"><script defer src="/assets/host-firmware-families.js?v=1"></script></head><body class="host-compact"><nav class="host-taskbar"><a href="/hosts/'+platform+'/">← '+name+' host</a><a href="/hosts/">Choose console</a><a href="/hosts/'+platform+'/?view=payloads">Payloads</a></nav><main class="host-compact-main"><header><h1>'+name+' WebKit Exploits</h1><p id="host-family-detected" role="status">Choose your firmware.</p></header><div class="host-firmware-families">'+tiles+'</div></main></body></html>';
}
function build(root){
 const localFile=path.join(root,'docs/host-local-launchers.json');
 if(fs.existsSync(localFile)){
  const remaining=ps5RemainingRoute(JSON.parse(fs.readFileSync(localFile)).groups);
  if(remaining){
   if(!fs.existsSync(path.join(root,remaining.runtimeEntry.slice(1))))throw Error('The preserved local PS5 UMTX entry is missing.');
   const file=path.join(root,remaining.entry.slice(1),'index.html');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,require('./host-local-launchers.cjs').render(remaining));
  }
 }
 if(fs.existsSync(localFile)){const source=JSON.parse(fs.readFileSync(localFile)).groups.find(g=>g.id==='karo-g2allpro');if(source){const modern={...source,id:'karo-g2allpro-modern',label:'PS4 WebKit Exploit - 10.00–13.52',firmwares:MODERN_PS4.slice(),entry:'/hosts/ps4/exploit/karo-g2allpro-modern/',originalEntry:{...source.originalEntry,firmwares:MODERN_PS4.slice(),ranges:[]}};const file=path.join(root,modern.entry.slice(1),'index.html');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,require('./host-local-launchers.cjs').render(modern));fs.writeFileSync(path.join(root,'docs/host-modern-firmware-evidence.json'),JSON.stringify({group:modern.id,firmwares:MODERN_PS4,source:source.source,sourceOriginalHTMLSHA256:'6b233652aa780431db151d06b5fc52ef1900345b6909ea7827a3fe6c4643f784',evidence:'Explicit offset records intersected with the original HTML dispatcher:10.00–11.02 exploit10.js;11.50–12.02 1150_1202.js;12.50–13.00 1250_13.js;13.02–13.52 1302_1352.js. Nearest-lower fallback-only versions excluded. Original native bytes unchanged.'},null,2)+'\n');}}
 for(const p of ['ps4','ps5']){const file=path.join(root,'hosts',p,'firmware/index.html');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,directory(root,p));}
}
function apply(html,name,{base='',root}={}){
 const runtimeAfter=/^hosts\/runtime\/ps4-afterglow-[a-f0-9]{12}\/web\/index\.html$/.test(name);
 const runtimePS5=/^hosts\/runtime\/ps5-webkit-[a-f0-9]{12}\/index\.html$/.test(name);
 const nativeLanding=runtimeAfter||runtimePS5;
 if(/^hosts\/runtime\//.test(name)&&!nativeLanding)return html;
 if(!nativeLanding&&!popup.eligible(name,html))return html;
 const options={base};
 if(runtimeAfter){
  const title='PS4 WebKit Exploit - 13.52–14.00';
  html=html.replace(/<title>[^<]*<\/title>/,'<title>'+title+' | WWB HOST</title>').replace(/<b>afterglow<\/b>/i,'<b>'+title+'</b>').replace(/<img class="meme"[^>]*>/,'').replace('>Start</button>','>Load exploit</button>');
  html=html.replace(/<p class="byline">[\s\S]*?<\/p>/,'');
  options.technicalNotes=['Original project: Afterglow by well0nez/m0zz. GoldHEN by SiSTRo. The included ps4-hen is patched pre-release-main-182; the bundled GoldHEN numeric version is not independently established.','Afterglow and patchsets: AGPL-3.0-or-later. raw13g scaffolding: MIT. Primitive lineage and all original notices remain in the linked technical documentation. The upstream README states GoldHEN was included with the author’s permission.','Exact firmware support: 13.52 and 14.00. A grouped label does not imply intermediate versions.'];
  const dir=base+'/'+name.replace(/web\/index\.html$/,'');
  options.projectLinks=[{label:'Original source and attribution',url:'https://github.com/well0nez/afterglow-web/tree/acf25a831725f0d44fcb64725d4ce35acbba8f9d'},{label:'AGPL license',url:'https://speedy-away.github.io'+dir+'web/LICENSE'},{label:'MIT notice',url:'https://speedy-away.github.io'+dir+'web/LICENSE-raw13g'},{label:'Technical lineage',url:'https://speedy-away.github.io'+dir+'web/TECHNICAL.md'}];
 }
 if(runtimePS5){html=html.replace('<nav>','<nav class="host-taskbar">').replace(/<div class="details">([\s\S]*?)<\/div>/,'<details class="details"><summary>Requirements &amp; source</summary>$1</details>');}
 if(nativeLanding)html=html.replace('<body>','<body class="host-compact host-runtime-landing">').replace('</head>','<link rel="stylesheet" href="'+base+'/assets/host-compact.css?v=1"><link rel="stylesheet" href="'+base+'/assets/host-blue-theme.css?v=1"></head>');
 // Never add site/popup code to execution documents, only authored landing controls.
 return popup.apply(nativeLanding?'hosts/launcher/index.html':name,projectPS4(html,name),options);
}
module.exports={MODERN_PS4,PS5_REMAINING,ps5RemainingRoute,groups,actions,directory,build,apply,publicPS4Actions,showNativeLog};
