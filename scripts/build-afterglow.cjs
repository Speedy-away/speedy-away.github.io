'use strict';
// Build and inventory bytes only. Never evaluate any downloaded module or payload.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),commit='acf25a831725f0d44fcb64725d4ce35acbba8f9d';
const base='hosts/runtime/ps4-afterglow-'+commit.slice(0,12);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(root,p));
function write(p,b){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),b);}
function build(){
 const tree=JSON.parse(read('tmp/afterglow-review/tree.json'));
 if(tree.commit!==commit)throw Error('Unreviewed revision');
 const original=[];
 for(const f of tree.tree.filter(f=>f.type==='blob')){
  const b=read('tmp/afterglow-review/'+f.path);
  const git=crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
  if(b.length!==f.size||git!==f.sha)throw Error('Upstream identity mismatch '+f.path);
  write(base+'/upstream/'+f.path,b);
  if(!f.path.startsWith('.'))write(base+'/web/'+f.path,b);
  original.push({path:f.path,bytes:b.length,sha256:hash(b),gitBlobSHA1:git,sourceURL:`https://raw.githubusercontent.com/well0nez/afterglow-web/${commit}/${f.path}`});
 }
 if(crypto.createHash('md5').update(read(base+'/web/hen.bin')).digest('hex')!=='6417a84a72f9c7988f0e33b3ae190542')throw Error('Patched HEN mismatch');
 let index=read(base+'/web/index.html').toString().replace('id="auto" checked','id="auto"').replace('class="btn" type="submit"','class="btn" id="start" type="submit"').replace('>start</button>','>Start</button>').replace('<span>autostart</span>','<span>Autostart</span>');
 index=index.replace('<p class="lede">','<p id="browser-firmware" role="status"></p><p class="lede">').replace('<p class="count" id="count"></p>','<button class="btn" id="cancel" type="button">Cancel</button><p><span>Autostart</span> · <span id="count" aria-live="polite"></span></p>');
 index=index.replace('<p class="byline">by well0nez/m0zz</p>','<p class="byline">by well0nez/m0zz · <a href="../../../ps4/firmware/">Firmware selection</a> · <a href="../README.md">Source &amp; licenses</a></p>');
 index=index.replace('<div id="brand"><b>afterglow</b></div>','<div id="brand"><nav aria-label="Page navigation"><a href="../../../ps4/firmware/"><span aria-hidden="true">←</span> <span>Back</span></a><a href="../../../ps4/">PS4 host</a><a href="../../../ps4/firmware/">Firmware selection</a></nav><b>afterglow</b></div>');
 index=index.replace('</head>','<link rel="stylesheet" href="landing-layout.css"></head>');
 write(base+'/web/landing-layout.css',read('assets/afterglow-landing-layout.css'));
 index=index.replace('<script src="launch.js">','<script src="entry-i18n.js"></script><script src="launch.js">');
 index=index.replace('</head>','<script defer src="site-load-receipt.js"></script></head>');
 write(base+'/web/site-load-receipt.js',read('assets/host-site-load-receipt.js'));
 write(base+'/web/index.html',index);
 const translations=Object.assign({},require('../i18n-tools/console-translations.cjs'),require('../i18n-tools/host-repository-translations.cjs'),require('../i18n-tools/afterglow-translations.cjs'));
 const keys=['Back','PS4 host','Start','Cancel','Autostart','Firmware selection','Source & licenses','PS4 browser required','Waiting for cache','Reopen to update cache','Session storage required','PS4 kernel exploit · firmware 13.52 and 14.00'];
 const subset=Object.fromEntries(keys.map(k=>[k,translations[k]||{}]));
 write(base+'/web/entry-i18n.js',`/* Landing-only translations; no scripts are added to the run document. */\n(function(){var table=${JSON.stringify(subset)},lang='en';try{lang=localStorage.getItem('scooby.lang')||'en';}catch(e){}window.afterglowTranslate=function(s){return table[s]&&table[s][lang]||s;};var walk=document.createTreeWalker(document.body,4,null,false),n;while(n=walk.nextNode()){var key=n.nodeValue.trim();if(table[key])n.nodeValue=n.nodeValue.replace(key,window.afterglowTranslate(key));}if(/^(ar|he)$/.test(lang))document.documentElement.dir='rtl';document.documentElement.lang=lang;})();\n`);
 write(base+'/web/launch.js',read('assets/afterglow-entry.js'));
 const guard=read('assets/afterglow-run-guard.js').toString();
 const jb=read(base+'/upstream/jb.html').toString().replace('import "./jb.js";',guard);
 write(base+'/web/jb.html',jb);
 write(base+'/web/serve.py',read('scripts/serve-afterglow.py'));
 const runtimeFiles=fs.readdirSync(path.join(root,base,'web')).filter(f=>f!=='cache.appcache'&&!/\.(?:py|sh|md)$|^LICENSE/.test(f));
 write(base+'/web/cache.appcache','CACHE MANIFEST\n# whatwhatboy '+commit+' integration-v2\n'+runtimeFiles.map(f=>f+' #'+hash(read(base+'/web/'+f))).join('\n')+'\n\nNETWORK:\n*\n');
 const notice=`# Afterglow PS4 13.52 / 14.00\n\nUpstream: https://github.com/well0nez/afterglow-web/tree/${commit}\n\nPinned ${commit}. Hardware execution has not been tested. Do not use on PS5 or other firmware. Open web/index.html in the PS4 browser. Start selects the bundled patched ps4-hen pre-release-main-182 or bundled GoldHEN (numeric version not established). These files belong to this runtime; no generic TCP/HTTP loader ABI is asserted.\n\nChanges (2026-11-03, integration v2): full-page landing layout and top back/navigation bar; opt-in autostart default; exact PS4 browser firmware gate before module import; five-second countdown; cancellation clears pending cache starts; one-use session entry ticket consumed before import; reload/back/restore refused; cache updates require reopening. Original jb.js failure/watchdog/referrer guards and all exploit/native bytes unchanged. No ads, analytics, shared site scripts or translated dictionaries enter the run document.\n\nServe web/ using its serve.sh (requires Python3 and a POSIX shell), or a server with .js text/javascript, .appcache text/cache-manifest and Cache-Control: no-cache, must-revalidate on code/payload/manifest. Open http://HOST-LAN-IP:8000/index.html from PS4; 127.0.0.1 on a PC is not reachable by the console. Offline persistence requires console testing. Changing runtime bytes requires rebuilding the manifest. No service worker may rewrite this runtime.\n\nSource and licensing: upstream/ contains every pinned file, web/ all readable modified deployable source; integration source and exact original files are included in separate downloadable source ZIP. afterglow.js and patchsets: AGPL-3.0-or-later, see LICENSE. raw13g scaffolding: MIT, see LICENSE-raw13g. Preserve both licenses and credits. core.js/mem.js/int64.js descend from jordyidk/slopkit via raw13g and aminegold0/silverps4hen; upstream explicitly declares no separate license for those primitive files. This is recorded, not represented as blanket AGPL/MIT coverage. TECHNICAL.md describes lineage and patch generation; upstream does not supply fully reproducible corresponding source for all bundled native payloads.\n\nGoldHEN is credited to SiSTRo. The pinned README states author permission for this bundled copy; independent permission correspondence and numeric GoldHEN release identity were not supplied. Do not substitute the separately advertised Ko-fi beta or an arbitrary newer binary. Patched hen.bin MD5: 6417a84a72f9c7988f0e33b3ae190542.\n\nIf handles are NOT defused, do not close the browser: cold start the console. Ordinary WebKit failure asks to reopen the browser. A hard kernel crash may give no message. Preserve unsaved work before attempting a run. See original README and TECHNICAL.\n`;
 write(base+'/README.md',notice);
 const files=[...original.map(f=>({path:'upstream/'+f.path,bytes:f.bytes,sha256:f.sha256})),...fs.readdirSync(path.join(root,base,'web')).map(f=>{const b=read(base+'/web/'+f);return {path:'web/'+f,bytes:b.length,sha256:hash(b)};}),{path:'README.md',bytes:Buffer.byteLength(notice),sha256:hash(Buffer.from(notice))}];
 const record={schemaVersion:1,commit,base,entry:'/'+base+'/web/index.html',firmwares:['13.52','14.00'],payloadsExecuted:false,original,files,limitations:['Physical console and offline cache not tested','GoldHEN numeric release unknown','Primitive files have no separate declared license; see upstream TECHNICAL.md','GoldHEN permission is upstream author statement, not independent correspondence']};
 write(base+'/build.json',JSON.stringify(record,null,2)+'\n');
 // ZIP utility writes bytes only; its prefix is retained and documented by the directory structure.
 const {zip}=require('./package-console-payload-sender.cjs');
 const jobs=[];
 for(const role of ['Builds','Source Code']){
  const selected=files.filter(f=>role==='Builds'?!f.path.startsWith('upstream/'):f.path.startsWith('upstream/')&&!/\.bin$/.test(f.path)||!f.path.startsWith('upstream/')&&!/\.bin$|\.png$/.test(f.path));
  const map=new Map(selected.map(f=>[f.path,read(base+'/'+f.path)]));map.set('build.json',read(base+'/build.json'));
  const bytes=zip(map,{prefix:'afterglow/'}),sha256=hash(bytes),name='afterglow-'+(role==='Builds'?'runtime':'source')+'-'+commit.slice(0,12)+'-'+sha256.slice(0,12)+'.zip';
  const local='downloads/hosts/afterglow/'+name;write(local,bytes);
  jobs.push({id:'afterglow-'+role.replace(' ','-').toLowerCase()+'-'+sha256.slice(0,12),title:'Afterglow PS4 '+role,project:'Afterglow',platform:'PS4',category:['Hosts'],archiveRole:[role],version:commit+'-integration-v2',url:'https://github.com/well0nez/afterglow-web/tree/'+commit,local:'/'+local,importPath:local,filename:name,bytes:bytes.length,sha256});
 }
 for(const f of original.filter(f=>/\.bin$/.test(f.path)))jobs.push({id:'afterglow-'+f.path.replace('.','-')+'-'+f.sha256.slice(0,12),title:'Afterglow '+f.path,project:'Afterglow',platform:'PS4',category:['Hosts'],archiveRole:['Builds'],version:commit,url:f.sourceURL,local:'/'+base+'/web/'+f.path,importPath:base+'/web/'+f.path,filename:f.path,bytes:f.bytes,sha256:f.sha256});
 write('docs/afterglow-build.json',JSON.stringify({...record,jobs},null,2)+'\n');
 return {base,files:files.length,jobs:jobs.length};
}
if(require.main===module)console.log(build());module.exports={build,base,commit};
