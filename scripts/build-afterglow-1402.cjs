'use strict';
// Assemble and hash upstream bytes only. Never import console modules or run payloads.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const commit='944d5aeed06fdff7d2fc1ce044d5daa272d85800';
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
 let entry=read('assets/afterglow-1402-entry.js').toString().replace("['13.52', '14.00']","['14.02']").replaceAll('whatsite.afterglow.','whatsite.afterglow.1402.');
 let guard=read('assets/afterglow-run-guard.js').toString().replace("['13.52','14.00']","['14.02']").replaceAll('whatsite.afterglow.','whatsite.afterglow.1402.');

 entry=entry.replace("function busy() { return appCache && (appCache.status === 2 || appCache.status === 3); }","function busy() { return window.AfterglowCache && window.AfterglowCache.isBusy(); }")
 .replace("timer = setInterval(function () { left--;", "timer = setInterval(function () { if (busy()) return; left--;")
 .replace("  note();\n", "  if (window.AfterglowCache) window.AfterglowCache.subscribe(note);\n  note();\n");
 write(base+'/web/launch.js',entry);
 guard=guard.replace("    import('./jb.js')",read('assets/afterglow-1402-run-options.js')+"\n    import('./jb.js')");

 write(base+'/web/jb.html',read(base+'/upstream/jb.html').toString().replace(' manifest="cache.appcache"','').replace('import "./jb.js";',guard).replace('<b>afterglow</b>','<b>WebKit Exploit</b>').replace('</style>','#bare-status{display:none}.barebone #out,.barebone #state,.barebone #ramBox{display:none!important}.barebone #bare-status{display:block;text-align:center;margin:35px 15px;color:#b9d5ff;font:16px Arial}.barebone .notice{display:none}</style>').replace('<div id="spin">','<p id="bare-status" role="status">Running WebKit Exploit…</p><div id="spin">'));

 const ads=require(path.join(root,'scripts/host-ads.cjs'));
 const banner='<aside class="native-banner" aria-label="Advertisement"><span>Advertisement</span><script async="async" data-cfasync="false" src="'+ads.NATIVE+'"></script><div id="'+ads.CONTAINER+'"></div></aside>';
 write(base+'/web/index.html',read('assets/afterglow-1402.html').toString().replace(' manifest="cache.appcache"','').replace('@@NATIVE_BANNER@@',banner));
 for(const [src,dest]of [['afterglow-1402-settings.js','settings.js'],['afterglow-1402.css','afterglow-1402.css'],['afterglow-cache.js','cache.js'],['afterglow-cache-frame.js','cache-frame.js'],['afterglow-offline-sw.js','offline-sw.js']])write(base+'/web/'+dest,read('assets/'+src));
 write(base+'/web/cache-frame.html','<!doctype html><html manifest="cache.appcache"><head><meta charset="utf-8"><title>Afterglow offline cache</title></head><body><script src="cache-frame.js"></script></body></html>');
 for(const [src,dest]of [['assets/host-xmb-waves.svg','host-xmb-waves.svg'],['assets/images/logo.png','logo.png'],['assets/images/host-selector/pepe-banner.png','pepe-banner.png']])write(base+'/web/'+dest,read(src));
 const loaderBundle=require('./build-1402-loader-page.cjs').build(root,base,write);
 const web=fs.readdirSync(path.join(root,base,'web')).filter(f=>!['cache.appcache','offline-files.json'].includes(f)&&!/^serve\.|^make-manifest/.test(f));
 const revision=hash(Buffer.concat(web.sort().map(f=>read(base+'/web/'+f))));
 write(base+'/web/cache.appcache','CACHE MANIFEST\n# WWB Afterglow 14.02 '+commit+' '+revision+'\nCACHE:\n'+web.join('\n')+'\noffline-files.json\njb.html?log=1&afterglow=run&mode=goldhen\njb.html?log=1&afterglow=run&payload=hen.bin\nNETWORK:\n*\n');
 const offline=web.concat('cache.appcache').map(p=>{const b=read(base+'/web/'+p);return {path:p,bytes:b.length,sha256:hash(b)};});
 write(base+'/web/offline-files.json',JSON.stringify(offline,null,2)+'\n');
 const files=fs.readdirSync(path.join(root,base,'web')).map(p=>{const b=read(base+'/web/'+p);return {path:p,bytes:b.length,sha256:hash(b)};});
 const group={id:'ps4-afterglow-1402',label:'PS4 WebKit Exploit - 14.02',platform:'ps4',firmwares:['14.02'],entry:'/hosts/ps4/afterglow-1402/',runtimeEntry:'/'+base+'/web/index.html',chooserOnly:true,source:{repository:'https://github.com/'+tree.repo,commit}};
 const record={schemaVersion:1,commit,base,group,original,files,loaderBundle,payloadsExecuted:false,hardwareTested:false,changes:['Exact PS4 14.02 landing and one-use run guard; opt-in autostart.','All upstream exploit modules, firmware offsets, HEN payloads and patchsets are byte-identical.','Separate immutable runtime; existing firmware routes and downloads preserved.'],limitations:['Physical console and offline persistence not tested locally.','GoldHEN numeric version is not identified by the pinned Afterglow README.']};
 const {zip}=require(path.join(root,'scripts/package-console-payload-sender.cjs'));
 const archive=zip(new Map([...files.map(f=>['web/'+f.path,read(base+'/web/'+f.path)]),['build.json',Buffer.from(JSON.stringify(record,null,2))]]),{prefix:'afterglow-1402/'});
 const sha256=hash(archive),filename='afterglow-1402-'+commit.slice(0,12)+'-'+sha256.slice(0,12)+'.zip',local='downloads/hosts/afterglow/'+filename;
 write(local,archive);
 record.archive={filename,local,bytes:archive.length,sha256,sourceURL:group.source.repository+'/tree/'+commit,version:commit+'-wwb-1402-v1'};
 write('docs/afterglow-1402-build.json',JSON.stringify(record,null,2)+'\n');
 const config=JSON.stringify({entry:group.runtimeEntry});
 write('hosts/ps4/afterglow-1402/index.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PS4 14.02 · WebKit Exploit | WWB HOST</title><meta name="description" content="Built-in Afterglow browser loader for PS4 firmware 14.02, with GoldHEN and ps4-hen choices."><script defer src="/assets/afterglow-public-launcher.js?v=1"></script></head><body><nav><a href="/hosts/ps4/">← PS4 host</a></nav><main><h1>PS4 14.02 · WebKit Exploit</h1><p id="afterglow-public-status" role="status">Opening the built-in HEN chooser…</p><a id="afterglow-public-continue" href="'+group.runtimeEntry+'">Choose HEN</a><script id="afterglow-public-data" type="application/json">'+config+'</script></main></body></html>\n');
 return record;
}
if(require.main===module)console.log(JSON.stringify(build(path.resolve(process.argv[2]))));
module.exports={build,base,commit};
