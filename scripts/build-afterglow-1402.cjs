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
  if(!f.path.startsWith('.'))write(base+'/web/'+f.path,bytes);
  original.push({path:f.path,bytes:bytes.length,sha256:hash(bytes),gitBlobSHA1:blob,sourceURL:'https://raw.githubusercontent.com/'+tree.repo+'/'+commit+'/'+f.path});
 }
 for(const file of ['README.md','jb.js','ps4_offsets.js','afterglow.js'])if(!read(base+'/upstream/'+file).toString().includes('14.02'))throw Error('Missing 14.02 evidence: '+file);
 if(!original.some(f=>f.path==='patchset-1402.bin'))throw Error('Missing 14.02 patchset');
 const upstreamWeb=original.filter(file=>!file.path.startsWith('.'));
 for(const file of upstreamWeb)if(!read(base+'/web/'+file.path).equals(read(base+'/upstream/'+file.path)))throw Error('Published upstream file changed: '+file.path);
 const expectedGoldHEN='c5480587d99efc2e3cc132352d9b7cf052dd3068280f1686e7fbb37d57e9ba8b';
 if(hash(read(base+'/web/goldhen.bin'))!==expectedGoldHEN)throw Error('Unexpected GoldHEN payload');
 const actualHenMD5=crypto.createHash('md5').update(read(base+'/web/hen.bin')).digest('hex');
 if(actualHenMD5!=='e7df7fb94e58a1b4a4a5e7dda4f190e1')throw Error('Upstream ps4-hen identity mismatch');

 // Keep the separate WWB loader tools available, but do not inject them into Afterglow's
 // allocation-sensitive landing/run documents or its upstream Application Cache manifest.
 const loaderBundle=require('./build-1402-loader-page.cjs').build(root,base,write);
 const offline=fs.readdirSync(path.join(root,base,'web')).filter(p=>p!=='offline-files.json').map(p=>{const b=read(base+'/web/'+p);return {path:p,bytes:b.length,sha256:hash(b)};});
 write(base+'/web/offline-files.json',JSON.stringify(offline,null,2)+'\n');
 const files=fs.readdirSync(path.join(root,base,'web')).map(p=>{const b=read(base+'/web/'+p);return {path:p,bytes:b.length,sha256:hash(b)};});
 const group={id:'ps4-afterglow-1402',label:'PS4 WebKit Exploit - 14.02',platform:'ps4',firmwares:['14.02'],entry:'/hosts/ps4/afterglow-1402/',runtimeEntry:'/'+base+'/web/index.html',chooserOnly:true,source:{repository:'https://github.com/'+tree.repo,commit}};
 const record={schemaVersion:2,commit,base,group,original,files,loaderBundle,goldhen:{version:'2.4b18.14',sha256:expectedGoldHEN},ps4Hen:{version:'upstream bundled pre-release-main-182',md5:actualHenMD5,readmeClaimedPatchedMD5:'6417a84a72f9c7988f0e33b3ae190542',provenanceStatus:'The pinned GitHub bytes do not match the patched MD5 printed in the upstream README; the exact discrepancy is recorded without executing or modifying the payload.'},payloadsExecuted:false,hardwareTested:false,changes:['Pinned the complete Afterglow tree at the latest upstream commit.','Published index.html, jb.html, launch.js, cache.appcache, exploit modules, firmware offsets, HEN payloads and patchsets byte-for-byte from upstream.','Updated bundled GoldHEN to 2.4b18.14.','Preserved the previous 944d5aeed06f runtime and every older download.','Kept separate WWB BIN/ELF loader tools outside Afterglow\'s run document and AppCache manifest.'],limitations:['Afterglow documents an unrecoverable kernel-allocation race that can still freeze or power off a console during an attempt.','The bundled hen.bin is byte-identical to the prior host and its MD5 does not match the patched MD5 printed in the upstream README.','Physical-console execution was not performed during this update.']};
 const {zip}=require(path.join(root,'scripts/package-console-payload-sender.cjs'));
 const archive=zip(new Map([...files.map(f=>['web/'+f.path,read(base+'/web/'+f.path)]),['build.json',Buffer.from(JSON.stringify(record,null,2))]]),{prefix:'afterglow-1402/'});
 const sha256=hash(archive),filename='afterglow-1402-'+commit.slice(0,12)+'-'+sha256.slice(0,12)+'.zip',local='downloads/hosts/afterglow/'+filename;
 write(local,archive);
 record.archive={filename,local,bytes:archive.length,sha256,sourceURL:group.source.repository+'/tree/'+commit,version:commit+'-upstream-exact-wwb-tools-v2'};
 write('docs/afterglow-1402-build.json',JSON.stringify(record,null,2)+'\n');
 const config=JSON.stringify({entry:group.runtimeEntry});
 write('hosts/ps4/afterglow-1402/index.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PS4 14.02 · WebKit Exploit | WWB HOST</title><meta name="description" content="Pinned upstream Afterglow browser loader for PS4 firmware 14.02 with GoldHEN 2.4b18.14 and the upstream-bundled ps4-hen choice."><script defer src="/assets/afterglow-public-launcher.js?v=2"></script></head><body><nav><a href="/hosts/ps4/">← PS4 host</a></nav><main><h1>PS4 14.02 · WebKit Exploit</h1><p id="afterglow-public-status" role="status">Opening the pinned upstream Afterglow page…</p><a id="afterglow-public-continue" href="'+group.runtimeEntry+'">Open Afterglow</a><script id="afterglow-public-data" type="application/json">'+config+'</script></main></body></html>\n');
 return record;
}
if(require.main===module)console.log(JSON.stringify(build(path.resolve(process.argv[2]))));
module.exports={build,base,commit};
