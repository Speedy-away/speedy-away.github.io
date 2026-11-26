'use strict';
// Authored presentation only. Never evaluate native modules or payloads.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base='hosts/runtime/ps4-phantomhen-146c21d20c45',old='hosts/runtime/ps4-afterglow-587c00a564c4/web';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function build(root=path.resolve(__dirname,'..')){
 const read=f=>fs.readFileSync(path.join(root,f)),write=(f,b)=>{fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),b);};
 const hub='hosts/ps4/index.html';let hubHTML=read(hub).toString();hubHTML=hubHTML.replace('<a href="/hosts/ps4/?view=goldhen" aria-label="Goldhen PS4">Goldhen PS4</a>','<a href="/hosts/ps4/?view=goldhen" aria-label="GoldHEN / HEN">GoldHEN / HEN</a><a href="/ps4/phantomhen/" aria-label="PhantomHEN for PS4 14.02">PhantomHEN · 14.02</a>');write(hub,hubHTML);
 const inv=JSON.parse(read('docs/phantomhen-source-inventory.json'));
 const source=inv.records.find(r=>r.repo==='PhantomHEN');
 for(const f of source.files){const b=read(f.local);if(hash(b)!==f.sha256)throw Error('Pinned PhantomHEN identity changed: '+f.path);if(!['index.html','launch.html'].includes(f.path))write(base+'/web/'+f.path,b);}
 let html=read('assets/afterglow-1402.html').toString().replace(' manifest="cache.appcache"','').replace('@@NATIVE_BANNER@@','');
 html=html.replace(/<label class="opt">[\s\S]*?<\/fieldset>/,'<label class="opt"><input type="radio" name="payload" value="phantomhen" checked><span><strong>PhantomHEN</strong><small>HEN 184 · PS4 14.02</small></span><span class="choice-mark" aria-hidden="true">PH</span></label></fieldset>');
 html=html.replace('<title>PS4 14.02 · WebKit Exploit | WWB HOST</title>','<title>PhantomHEN · PS4 14.02 | WWB HOST</title>').replace('Choose GoldHEN or ps4-hen and start on your console.','Launch PhantomHEN HEN 184 on your PS4 14.02 console.').replace('<h1>WebKit Exploit</h1>','<h1>PhantomHEN</h1>').replace(/<section id="offline-cache"[\s\S]*?<footer>/,'<p class="cache-help">PS4 firmware 14.02 · pinned HEN 184 build. <a href="/ps4/14.02/">Choose another HEN</a></p><footer>')
 .replace('<script src="cache.js"></script>','').replace('<script src="settings.js"></script>','').replace(/<button id="settings-open"[\s\S]*?<\/button>/,'').replace(/<aside id="settings-panel"[\s\S]*?<\/aside>/,'').replace(/<label class="auto">[\s\S]*?<\/label>/,'').replace('Includes the 14.02 exploit, HENs and BIN / ELF loader tools.','').replace('href="loaders.html"','href="/'+old+'/loaders.html"').replace('href="#offline-cache"','href="/ps4/14.02/"').replace('>Offline cache<','>All HEN options<').replace('<footer><span>WWB HOST · PS4 14.02</span>','<footer><span>WWB HOST · PS4 14.02</span><a href="https://github.com/idntusemodz/PhantomHEN/tree/'+source.commit+'">Source · idntusemodz</a>');
 html=html.replace(/<footer>[\s\S]*?<\/footer>/,'<footer><span>WWB HOST · PS4 14.02</span><a href="https://github.com/idntusemodz/PhantomHEN/tree/'+source.commit+'">Source · idntusemodz</a></footer>');
 write(base+'/web/index.html',html);
 for(const f of ['afterglow-1402.css','logo.png','pepe-banner.png','host-xmb-waves.svg'])write(base+'/web/'+f,read(old+'/'+f));
 write(base+'/web/launch.js',"(function(){var form=document.getElementById('pick'),button=document.getElementById('start'),match=navigator.userAgent.match(/PlayStation 4[\\/ ](\\d+\\.\\d{2})(?:\\D|$)/i);button.disabled=!match||match[1]!=='14.02';document.getElementById('browser-firmware').textContent=button.disabled?'PS4 14.02 browser required':'PS4 14.02 · Ready';form.onsubmit=function(e){e.preventDefault();if(button.disabled)return;sessionStorage.setItem('wwb.phantom.arm',String(Date.now()));button.disabled=true;location.href='launch.html?v=hen184-1402-v3&log=1&afterglow=run&mode=kpstep&g=drain:16&g=drainsz:0x4000';};document.getElementById('cancel').onclick=function(){location.href='/ps4/14.02/';};})();");
 let run=read(base+'/upstream/launch.html').toString();
 run=run.replace(/<div id="brand">[\s\S]*?<\/div>/,'<div id="brand"><b>WWB HOST · PhantomHEN · 14.02</b></div>').replace(/<p class="byline">[\s\S]*?<\/p>/,'').replace('</head>','<link rel="stylesheet" href="/assets/hen-console.css"></head>');
 const original="await import('./jb-g.js?v=hen184-1402-v3');";
 if(!run.includes(original))throw Error('Upstream launcher import changed');
 run=run.replace(original,"const stamp=Number(sessionStorage.getItem('wwb.phantom.arm'));sessionStorage.removeItem('wwb.phantom.arm');const ua=navigator.userAgent.match(/PlayStation 4[\\/ ](\\d+\\.\\d{2})(?:\\D|$)/i);if(ua&&ua[1]==='14.02'&&stamp>0&&Date.now()-stamp>=0&&Date.now()-stamp<30000&&performance.navigation.type===0&&location.search==='?v=hen184-1402-v3&log=1&afterglow=run&mode=kpstep&g=drain:16&g=drainsz:0x4000'){"+original+"}else{location.replace('index.html');}");
 write(base+'/web/hen-console.css',read('assets/hen-console.css'));run=run.replace('/assets/hen-console.css','hen-console.css');write(base+'/web/launch.html',run);
 const publicPage='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PhantomHEN · PS4 14.02 | WWB HOST</title><meta name="description" content="PhantomHEN HEN 184 for PS4 firmware 14.02. WWB HOST console launcher."><link rel="canonical" href="https://speedy-away.github.io/ps4/phantomhen/"><link rel="stylesheet" href="/assets/host-home.css"><script defer src="/assets/afterglow-public-launcher.js?v=2"></script></head><body><nav class="topbar"><a href="/ps4/">PS4 host</a><a href="/ps4/14.02/">14.02 HEN options</a></nav><main><header class="intro"><h1>PhantomHEN</h1><p>PS4 14.02 · HEN 184</p></header><p id="afterglow-public-status" role="status">Opening PhantomHEN…</p><a id="afterglow-public-continue" href="/'+base+'/web/index.html">Open PhantomHEN console</a><script id="afterglow-public-data" type="application/json">'+JSON.stringify({entry:'/'+base+'/web/index.html'})+'</script></main></body></html>';
 write('hosts/ps4/phantomhen/index.html',publicPage);write('ps4/phantomhen/index.html',publicPage);
 // Patch only authored landing/controller and run-page presentation in the existing build.
 let landing=read(old+'/index.html').toString();if(!landing.includes('value="phantomhen"'))landing=landing.replace('</fieldset>','<label class="opt"><input type="radio" name="payload" value="phantomhen"><span><strong>PhantomHEN</strong></span><span class="choice-mark" aria-hidden="true">PH</span></label></fieldset>');
 landing=landing.replace('<h2 id="picker-title">Payload</h2>','<h2 id="picker-title">Hens</h2>').replace('<strong>ps4-hen</strong>','<strong>HEN / SilverHEN</strong>');
 landing=landing.replace('Afterglow by well0nez / m0zz','WWB HOST · PS4 14.02');write(old+'/index.html',landing);
 let entry=read(old+'/launch.js').toString();if(!entry.includes("picked() === 'phantomhen'"))entry=entry.replace('function start() {',"function start() { if (picked() === 'phantomhen') { stop(); location.href='/ps4/phantomhen/'; return; }");entry=entry.replace("var targets = {hen:","var targets = {phantomhen: 'phantomhen', hen:");write(old+'/launch.js',entry);
 write(old+'/hen-console.css',read('assets/hen-console.css'));
 let jb=read(old+'/jb.html').toString().replace(/by well0nez\/m0zz[^<]*/gi,'WWB HOST');jb=jb.replace(/<link rel="stylesheet" href="(?:\/assets\/)?hen-console.css">/g,'');if(!jb.includes('/assets/hen-console.css'))jb=jb.replace('</head>','<link rel="stylesheet" href="/assets/hen-console.css"></head>');jb=jb.replace('/assets/hen-console.css','hen-console.css');write(old+'/jb.html',jb);
 // Refresh cache identities after authored presentation changes.
 const names=fs.readdirSync(path.join(root,old)).filter(f=>!['cache.appcache','offline-files.json'].includes(f));
 const manifest=read(old+'/cache.appcache').toString().replace('NETWORK:',(read(old+'/cache.appcache').toString().includes('\nhen-console.css\n')?'':'hen-console.css\n')+'NETWORK:').replace(/^# WWB Afterglow 14.02.*$/m,'# WWB Afterglow 14.02 '+hash(Buffer.concat(names.sort().map(f=>read(old+'/'+f)))));
 write(old+'/cache.appcache',manifest);write(old+'/offline-files.json',JSON.stringify(names.concat('cache.appcache').map(f=>{const b=read(old+'/'+f);return {path:f,bytes:b.length,sha256:hash(b)};}),null,2)+'\n');

 const record=JSON.parse(read('docs/afterglow-1402-build.json'));
 record.files=fs.readdirSync(path.join(root,old)).sort().map(f=>{const b=read(old+'/'+f);return {path:f,bytes:b.length,sha256:hash(b)};});
 if(!record.changes.includes('Added the separate pinned PhantomHEN 14.02 console option.'))record.changes.push('Added the separate pinned PhantomHEN 14.02 console option.');
 const {zip}=require('./package-console-payload-sender.cjs');
 // Avoid archive metadata recursion; keep every prior ZIP in place.
 const packageRecord={...record,archive:undefined};
 const packed=zip(new Map([...record.files.map(f=>['web/'+f.path,read(old+'/'+f.path)]),['build.json',Buffer.from(JSON.stringify(packageRecord,null,2))]]),{prefix:'afterglow-1402/'});
 const digest=hash(packed),filename='afterglow-1402-587c00a564c4-'+digest.slice(0,12)+'.zip';
 const local='downloads/hosts/afterglow/'+filename;
 if(fs.existsSync(path.join(root,local))&&!read(local).equals(packed))throw Error('Archive collision');
 write(local,packed);record.archive={filename,local,bytes:packed.length,sha256:digest,sourceURL:record.group.source.repository+'/tree/'+record.commit,version:record.commit+'-phantom-option-wwb-layout-v3.1'};
 write('docs/afterglow-1402-build.json',JSON.stringify(record,null,2)+'\n');

 return {page:'/ps4/phantomhen/',firmware:'14.02',files:source.files.length,payloadExecuted:false};
}
if(require.main===module)console.log(JSON.stringify(build()));module.exports={build};
