'use strict';
// Assemble and hash a pinned upstream tree. Never import console modules or run payloads.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const commit='587c00a564c4765b78ab413e400a392efdd9a780';
const base='hosts/runtime/ps4-afterglow-'+commit.slice(0,12);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function build(source,root=path.resolve(__dirname,'..')){
 const read=f=>fs.readFileSync(path.join(root,f));
 const write=(f,b)=>{const dest=path.join(root,f);fs.mkdirSync(path.dirname(dest),{recursive:true});if((f.includes('/upstream/')||/\.(?:bin|elf)$/.test(f))&&fs.existsSync(dest)&&!fs.readFileSync(dest).equals(Buffer.from(b)))throw Error('Immutable build already differs: '+f);fs.writeFileSync(dest,b);};
 const tree=JSON.parse(fs.readFileSync(path.join(source,'afterglow.json')));
 if(tree.commit!==commit||tree.repo!=='well0nez/afterglow-web')throw Error('Unexpected upstream revision');
 const original=[];
 for(const f of tree.files){
  if(f.path.includes('..')||path.isAbsolute(f.path))throw Error('Invalid path');
  const bytes=fs.readFileSync(path.join(source,'afterglow',f.path));
  const blob=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  if(blob!==f.sha||bytes.length!==f.size)throw Error('Upstream identity mismatch: '+f.path);
  write(base+'/upstream/'+f.path,bytes);
  if(!f.path.startsWith('.')&&!['index.html','jb.html','launch.js','cache.appcache'].includes(f.path))write(base+'/web/'+f.path,bytes);
  original.push({path:f.path,bytes:bytes.length,sha256:hash(bytes),gitBlobSHA1:blob,sourceURL:'https://raw.githubusercontent.com/'+tree.repo+'/'+commit+'/'+f.path});
 }
 for(const file of ['README.md','jb.js','ps4_offsets.js','afterglow.js'])if(!read(base+'/upstream/'+file).toString().includes('14.02'))throw Error('Missing 14.02 evidence: '+file);
 if(!original.some(f=>f.path==='patchset-1402.bin'))throw Error('Missing 14.02 patchset');
 const expectedGoldHEN='c5480587d99efc2e3cc132352d9b7cf052dd3068280f1686e7fbb37d57e9ba8b';
 if(hash(read(base+'/web/goldhen.bin'))!==expectedGoldHEN)throw Error('Unexpected GoldHEN payload');
 const actualHenMD5=crypto.createHash('md5').update(read(base+'/web/hen.bin')).digest('hex');
 if(actualHenMD5!=='e7df7fb94e58a1b4a4a5e7dda4f190e1')throw Error('Upstream ps4-hen identity mismatch');

 // Keep the newer pinned exploit modules and payloads, but restore the authored WWB
 // 14.02 landing, settings and one-use guard. The native exploit modules remain exact.
 let entry=read('assets/afterglow-1402-entry.js').toString().replace("['13.52', '14.00']","['14.02']").replaceAll('whatsite.afterglow.','whatsite.afterglow.1402.');
 let guard=read('assets/afterglow-run-guard.js').toString().replace("['13.52','14.00']","['14.02']").replaceAll('whatsite.afterglow.','whatsite.afterglow.1402.');
 entry=entry.replace("function busy() { return appCache && (appCache.status === 2 || appCache.status === 3); }","function busy() { return window.AfterglowCache && window.AfterglowCache.isBusy(); }")
  .replace("timer = setInterval(function () { left--;", "timer = setInterval(function () { if (busy()) return; left--;")
  .replace("  note();\n", "  if (window.AfterglowCache) window.AfterglowCache.subscribe(note);\n  note();\n");
 write(base+'/web/launch.js',entry);
 guard=guard.replace("    import('./jb.js')",read('assets/afterglow-1402-run-options.js')+"\n    import('./jb.js')");
 write(base+'/web/jb.html',read(base+'/upstream/jb.html').toString().replace(' manifest="cache.appcache"','').replace('import "./jb.js";',guard).replace('<b>afterglow</b>','<b>WebKit Exploit</b>').replace(/by well0nez\/m0zz[^<]*/gi,'WWB HOST').replace('</head>','<link rel="stylesheet" href="/assets/hen-console.css"></head>').replace('</style>','#bare-status{display:none}.barebone #out,.barebone #state,.barebone #ramBox{display:none!important}.barebone #bare-status{display:block;text-align:center;margin:35px 15px;color:#b9d5ff;font:16px Arial}.barebone .notice{display:none}</style>').replace('<div id="spin">','<p id="bare-status" role="status">Running WebKit Exploit…</p><div id="spin">'));
 const ads=require(path.join(root,'scripts/host-ads.cjs'));
 const banner='<aside class="native-banner" aria-label="Advertisement"><span>Advertisement</span><script async="async" data-cfasync="false" src="'+ads.NATIVE+'"></script><div id="'+ads.CONTAINER+'"></div></aside>';
 write(base+'/web/index.html',read('assets/afterglow-1402.html').toString().replace(' manifest="cache.appcache"','').replace('@@NATIVE_BANNER@@',banner));
 for(const [src,dest]of [['afterglow-1402-settings.js','settings.js'],['afterglow-1402.css','afterglow-1402.css'],['afterglow-cache.js','cache.js'],['afterglow-cache-frame.js','cache-frame.js'],['afterglow-offline-sw.js','offline-sw.js']]){
  let bytes=read('assets/'+src);if(dest==='cache.js'||dest==='offline-sw.js')bytes=Buffer.from(bytes.toString().replaceAll('944d5aeed06f',commit.slice(0,12)));write(base+'/web/'+dest,bytes);
 }
 write(base+'/web/cache-frame.html','<!doctype html><html manifest="cache.appcache"><head><meta charset="utf-8"><title>Afterglow offline cache</title></head><body><script src="cache-frame.js"></script></body></html>');
 for(const [src,dest]of [['assets/host-xmb-waves.svg','host-xmb-waves.svg'],['assets/images/logo.png','logo.png'],['assets/images/host-selector/pepe-banner.png','pepe-banner.png']])write(base+'/web/'+dest,read(src));

 // Keep the separate WWB loader tools available outside the allocation-sensitive run document.
 const loaderBundle=require('./build-1402-loader-page.cjs').build(root,base,write);
 const web=fs.readdirSync(path.join(root,base,'web')).filter(f=>!['cache.appcache','offline-files.json'].includes(f)&&!/^serve\.|^make-manifest/.test(f));
 const revision=hash(Buffer.concat(web.sort().map(f=>read(base+'/web/'+f))));
 write(base+'/web/cache.appcache','CACHE MANIFEST\n# WWB Afterglow 14.02 '+commit+' '+revision+'\nCACHE:\n'+web.join('\n')+'\noffline-files.json\njb.html?log=1&afterglow=run&mode=goldhen\njb.html?log=1&afterglow=run&payload=hen.bin\nNETWORK:\n*\n');
 const offline=web.concat('cache.appcache').map(p=>{const b=read(base+'/web/'+p);return {path:p,bytes:b.length,sha256:hash(b)};});
 write(base+'/web/offline-files.json',JSON.stringify(offline,null,2)+'\n');
 const files=fs.readdirSync(path.join(root,base,'web')).map(p=>{const b=read(base+'/web/'+p);return {path:p,bytes:b.length,sha256:hash(b)};});
 const group={id:'ps4-afterglow-1402',label:'PS4 WebKit Exploit - 14.02',platform:'ps4',firmwares:['14.02'],entry:'/hosts/ps4/afterglow-1402/',runtimeEntry:'/'+base+'/web/index.html',chooserOnly:true,source:{repository:'https://github.com/'+tree.repo,commit}};
 const record={schemaVersion:3,commit,base,group,original,files,loaderBundle,goldhen:{version:'2.4b18.14',sha256:expectedGoldHEN},ps4Hen:{version:'upstream bundled pre-release-main-182',md5:actualHenMD5,readmeClaimedPatchedMD5:'6417a84a72f9c7988f0e33b3ae190542',provenanceStatus:'The pinned GitHub bytes do not match the patched MD5 printed in the upstream README; the exact discrepancy is recorded without executing or modifying the payload.'},payloadsExecuted:false,hardwareTested:false,changes:['Restored the authored WWB 14.02 landing, settings, cache controls and guarded run presentation.','Clarified the WWB chooser, guarded run screen and optional offline-cache behavior in the guide and catalogue.','Made the disabled automatic-cache status neutral so it does not guess whether a saved copy exists.','Added dialog semantics, a keyboard focus loop and non-duplicative HEN choice labels.','Kept the current pinned Afterglow exploit modules, firmware offsets, HEN payloads and patchsets byte-identical to upstream.','Kept GoldHEN 2.4b18.14 and the upstream-bundled ps4-hen choice.','Preserved the stock upstream tree, previous 944d5aeed06f runtime and every older download.','Kept separate WWB BIN/ELF loader tools available from the restored landing.'],limitations:['Afterglow documents an unrecoverable kernel-allocation race that can still freeze or power off a console during an attempt.','The bundled hen.bin is byte-identical to the prior host and its MD5 does not match the patched MD5 printed in the upstream README.','Physical-console execution was not performed during this layout restoration.']};
 const {zip}=require(path.join(root,'scripts/package-console-payload-sender.cjs'));
 const archive=zip(new Map([...files.map(f=>['web/'+f.path,read(base+'/web/'+f.path)]),['build.json',Buffer.from(JSON.stringify(record,null,2))]]),{prefix:'afterglow-1402/'});
 const sha256=hash(archive),filename='afterglow-1402-'+commit.slice(0,12)+'-'+sha256.slice(0,12)+'.zip',local='downloads/hosts/afterglow/'+filename;
 write(local,archive);
 record.archive={filename,local,bytes:archive.length,sha256,sourceURL:group.source.repository+'/tree/'+commit,version:commit+'-wwb-layout-v3.1'};
 write('docs/afterglow-1402-build.json',JSON.stringify(record,null,2)+'\n');
 const config=JSON.stringify({entry:group.runtimeEntry});
 write('hosts/ps4/afterglow-1402/index.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PS4 14.02 · WebKit Exploit | WWB HOST</title><meta name="description" content="WWB browser loader for PS4 firmware 14.02 with GoldHEN 2.4b18.14, ps4-hen and the restored custom layout."><script defer src="/assets/afterglow-public-launcher.js?v=2"></script></head><body><nav><a href="/hosts/ps4/">← PS4 host</a></nav><main><h1>PS4 14.02 · WebKit Exploit</h1><p id="afterglow-public-status" role="status">Opening the WWB 14.02 HEN chooser…</p><a id="afterglow-public-continue" href="'+group.runtimeEntry+'">Choose HEN</a><script id="afterglow-public-data" type="application/json">'+config+'</script></main></body></html>\n');
 return record;
}
if(require.main===module)console.log(JSON.stringify(build(path.resolve(process.argv[2]))));
module.exports={build,base,commit};
