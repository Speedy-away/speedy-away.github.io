'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),COMMIT='ff181af62e0c57d7b74b3ea40b7a166b21424864';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function build(source,root=ROOT){
  const write=(name,data)=>{const dest=path.join(root,name);fs.mkdirSync(path.dirname(dest),{recursive:true});if(/\.(?:bin|elf|zip)$/.test(dest)&&fs.existsSync(dest)&&!fs.readFileSync(dest).equals(Buffer.from(data)))throw Error('Refusing to replace immutable bytes '+dest);fs.writeFileSync(dest,data);};
  const meta=JSON.parse(fs.readFileSync(path.join(source,'webkitty.json')));if(meta.commit!==COMMIT)throw Error('Unexpected WebKitty revision');
  const files={};
  for(const [key,name]of [['bin','elfldr.bin'],['elf','elfldr.elf']]){
    const relative='includes/payloads/Bins/'+name,record=meta.files.find(f=>f.path===relative),bytes=fs.readFileSync(path.join(source,'webkitty',relative));
    const blob=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');if(!record||record.sha!==blob||record.size!==bytes.length)throw Error('Upstream identity mismatch');
    const url='/downloads/host-payloads/webkitty/'+COMMIT.slice(0,12)+'/'+name;write(url.slice(1),bytes);
    files[key]={url,name,bytes:bytes.length,sha256:sha(bytes),sourceURL:'https://raw.githubusercontent.com/ArabPixel/WebKitty/'+COMMIT+'/'+relative};
  }
  write('downloads/host-payloads/webkitty/'+COMMIT.slice(0,12)+'/LICENSE',fs.readFileSync(path.join(source,'webkitty/LICENSE')));
  const actions=[{id:'ps4-bin-elf-loaders',platform:'ps4',label:'BIN / ELF loaders',category:'tools',categories:['tools','payloads'],firmwares:[],format:'Loader controls',launchURL:'/hosts/ps4/loaders/',launchLabel:'Open loaders',requirements:['Start the matching console loader first. Select a compatible BIN or ELF and confirm its firmware/game requirements.']}];
  for(const [key,file]of Object.entries(files))actions.push({id:'ps4-webkitty-elfldr-'+key,platform:'ps4',label:'WebKitty ELF loader · '+key.toUpperCase(),category:'tools',categories:['tools','payloads'],firmwares:['14.02'],format:key.toUpperCase(),downloadURL:file.url,bytes:file.bytes,sha256:file.sha256,source:file.sourceURL,sourceURL:file.sourceURL,sourceCommit:COMMIT,version:COMMIT,launchURL:'/hosts/ps4/loaders/',launchLabel:'Open loaders',...(key==='bin'?{run:{type:'goldhen-http',port:9090}}:{}),requirements:['PS4 14.02 entry; the pinned WebKitty catalogue lists ELF Loader for 4.71–latest. Native bytes are unchanged; console execution remains untested.','Enable the HEN BIN loader on HTTP 9090 before sending the flat BIN. ELF traffic then uses its separate service on 9021.','Do not send an ELF to an older KARO raw BIN listener on 9021.'],license:'Distributed unchanged from the pinned WebKitty snapshot; preserve WebKitty and John Törnblom attribution.'});
  write('docs/host-webkitty-loader-actions.json',JSON.stringify({platform:'ps4',sourceCommit:COMMIT,actions},null,2)+'\n');
  const groups=JSON.parse(fs.readFileSync(path.join(root,'docs/host-local-launchers.json'))).groups.filter(g=>/^karo-binloader-(505|672|702|755)$/.test(g.id));
  if(groups.length!==4)throw Error('Missing preserved native BIN loader');
  const legacy=groups.map(g=>{if(!fs.existsSync(path.join(root,g.entry,'index.html'))||!fs.existsSync(path.join(root,g.runtimeEntry)))throw Error('Missing original loader entry '+g.id);return '<a href="'+g.entry+'">PS4 '+g.firmwares.join(' / ')+'</a>';}).join('');
  const template=fs.readFileSync(path.join(root,'scripts/templates/ps4-loaders.html'),'utf8').replace('@@FILES@@',JSON.stringify(files)).replace('@@LEGACY@@',legacy).replace('@@ELFBIN@@',files.bin.url).replace('@@ELF@@',files.elf.url);
  // The compact sender is self-contained; it retains the full sender's pairing,
  // origin checks and fixed transports without bundling the entire payload library.
  const bundle=new Map();
  for(const name of ['scripts/console-payload-bridge.cjs','scripts/ps4-loader-upload.cjs','assets/host-console-client.js','assets/host-dashboard.js','assets/ps4-loader-client.js','assets/ps4-loaders.js','assets/ps4-loaders.css','docs/host-webkitty-loader-actions.json',...Object.values(files).map(f=>f.url.slice(1))])bundle.set(name,fs.readFileSync(path.join(root,name)));
  const bundledPage=template.replace('@@SENDER@@','#sender-setup');
  bundle.set('hosts/ps4/loaders/index.html',Buffer.from(bundledPage));
  for(const name of ['hosts/index.html','hosts/ps4/index.html'])bundle.set(name,Buffer.from('<!doctype html><html><head><title>PS4 loader sender</title></head><body><a href="/hosts/ps4/loaders/">Open PS4 BIN / ELF loaders</a></body></html>'));
  bundle.set('Start Sender.cmd',Buffer.from('@echo off\r\ncd /d "%~dp0"\r\nnode scripts\\console-payload-bridge.cjs\r\npause\r\n'));
  bundle.set('README.txt',Buffer.from('PS4 loader sender\nRequires Node.js 20+. Extract this ZIP into a new folder.\nWindows: Start Sender.cmd. macOS/Linux: node scripts/console-payload-bridge.cjs\nOpen http://127.0.0.1:8766/hosts/ps4/loaders/ and enter the printed token.\nStart the compatible console loader separately. Select the console LAN address, firmware, loader and compatible file, then Send.\nNo payload is run on this computer. Custom files are held in memory, SHA-256 checked and sent once; they are not saved.\nBIN 9090 and ELF 9021 are separate protocols. Raw BIN TCP9020 is pinned to PS4 9.00. Never use ELF mode for KARO BIN9021.\nTransfer acceptance is not execution verification. No automatic retries. Ctrl+C stops the server.\nWebKitty files: https://github.com/ArabPixel/WebKitty/tree/'+COMMIT+'\n'));
  bundle.set('WEBKITTY-LICENSE',fs.readFileSync(path.join(source,'webkitty/LICENSE')));
  const records=[...bundle].map(([name,b])=>({name,bytes:b.length,sha256:sha(b)}));
  bundle.set('bundle-manifest.json',Buffer.from(JSON.stringify({sourceCommit:COMMIT,files:records},null,2)));
  const bytes=require('./package-console-payload-sender.cjs').zip(bundle,{prefix:'ps4-loader-sender/'}),digest=sha(bytes),url='/downloads/helpers/ps4-loader-sender/ps4-loader-sender-'+digest.slice(0,12)+'.zip';write(url.slice(1),bytes);
  const sender={url,name:path.basename(url),bytes:bytes.length,sha256:digest,sourceURL:'https://speedy-away.github.io'+url,version:'1.0.0+'+digest.slice(0,12)};
  write('hosts/ps4/loaders/index.html',template.replace('@@SENDER@@',url));
  const report={schemaVersion:1,sourceCommit:COMMIT,files,sender,legacy:groups.map(g=>({id:g.id,entry:g.entry,runtimeEntry:g.runtimeEntry,firmwares:g.firmwares})),payloadsExecuted:false,hardwareTested:false};
  write('docs/ps4-loader-support.json',JSON.stringify(report,null,2)+'\n');
  return report;
}
if(require.main===module)console.log(JSON.stringify(build(path.resolve(process.argv[2]))));
module.exports={build};
