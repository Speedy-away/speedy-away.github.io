'use strict';
// Import data and ready-to-use bytes only; never evaluate upstream JavaScript.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function importPayloads(source,root,backup){
 const manifest=JSON.parse(fs.readFileSync(path.join(source,'webkitty.json'))),commit=manifest.commit;
 if(commit!=='ff181af62e0c57d7b74b3ea40b7a166b21424864')throw Error('Review new revisions before importing');
 function original(name){const b=fs.readFileSync(path.join(source,'webkitty',name)),r=manifest.files.find(f=>f.path===name);if(!r||r.size!==b.length||crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')!==r.sha)throw Error('Upstream identity mismatch: '+name);return b;}
 const list=original('includes/js/payloadsList.js').toString();
 if(!/var commonMax = 14\.02;/.test(original('includes/js/initial.js').toString()))throw Error('Unreviewed compatibility ceiling');
 const rows=[];
 for(const m of list.matchAll(/\{([^{}]+)\}/g)){
  const text=m[1],get=k=>new RegExp('\\b'+k+':\\s*"([^"\\n]*)"').exec(text)?.[1];
  const rule=get('specificFW');if(!rule)continue;
  const supported=rule.replace(/latest/g,'14.02').split(',').some(r=>{const [lo,hi]=r.trim().split(/\s*-\s*/).map(Number);return hi===undefined?lo===14.02:lo<=14.02&&hi>=14.02;});
  if(!supported||get('id')==='ElfLoader')continue;
  const src=/\bsrc:\s*(payloadsPath|linuxPath|homebrewPath)\s*\+\s*"([^"]+)"/.exec(text);
  if(src)rows.push({id:get('id'),name:get('name'),author:get('author'),description:get('description'),rule,category:get('category'),path:'includes/payloads/'+({payloadsPath:'Bins',linuxPath:'Linux',homebrewPath:'Homebrew'}[src[1]])+'/'+src[2]});
 }
 for(const n of [60,70,80,85])rows.push({id:'FanThreshold'+n,name:'Fan Threshold '+n+'°C',rule:'4.73 - latest',category:'tools',author:'Scene Collective',description:'Sets the fan temperature threshold to '+n+'°C.',path:'includes/payloads/Bins/fan-thresholds/ps4-fan-threshold'+n+'.bin'});
 const vue=rows.find(r=>r.id==='PSVue');vue.name='PlayStation Vue · base installer';rows.push({...vue,id:'PSVueUpdate124',name:'PlayStation Vue · 1.24 update',path:vue.path.replace('base','124')});
 function preserve(dest,b){if(fs.existsSync(dest)){if(sha(fs.readFileSync(dest))!==sha(b))throw Error('Different existing bytes: '+dest);return;}fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b,{flag:'wx'});}
 const {destinationForFile}=require(path.join(root,'scripts/download-archive-layout.cjs'));
 const actions=[],inventory=[];
 for(const r of rows){
  const b=original(r.path),name=path.basename(r.path),format=path.extname(name).slice(1).toUpperCase();
  const url='/downloads/host-payloads/webkitty/'+commit.slice(0,12)+'/'+r.path.slice('includes/payloads/'.length),sourceURL='https://raw.githubusercontent.com/ArabPixel/WebKitty/'+commit+'/'+r.path;
  const archive=destinationForFile(backup,{url:'https://github.com/ArabPixel/WebKitty',platform:'PS4',category:'Payloads'},{name,releaseTag:commit,archiveRole:['Builds']});
  preserve(archive,b);preserve(path.join(root,url),b);
  const id='ps4-webkitty-1402-'+r.id.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const requirements=['PS4 14.02 with the HEN HTTP BIN loader enabled on 9090. Upstream rule: '+r.rule+'.','This is a separate pinned WebKitty build; older firmware entries retain their original downloads.'];
  if(format==='ELF')requirements.push('The ELF service on 9021 starts automatically when needed, before this ELF is sent once.');
  if(r.category==='linux')requirements.push('Prepare the kernel, initramfs and Linux storage required by the upstream Linux loader before loading.');
  if(r.category==='homebrew')requirements.push('This installer downloads application data on the console and requires Internet access.');
  if(/^PSVue/.test(r.id))requirements.push(r.id==='PSVue'?'Install the base first, wait for completion, then load the separate 1.24 update. This does not install download0 or a save file.':'Load only after the PlayStation Vue base installer has completed. This does not install download0 or a save file.');
  let confirmBeforeLoad;
  if(r.id==='RestoreDB')confirmBeforeLoad='Restore databases and licenses from your matching backup? This may overwrite current console data.';
  if(r.id==='App2USB')confirmBeforeLoad='Run App2USB with your existing configuration? It can move installed applications and change their links. Keep the intended USB drive attached.';
  if(r.id==='PermanentUART')confirmBeforeLoad='Enable permanent UART? This changes a persistent console setting.';
  if(r.id==='ExitIDU')confirmBeforeLoad='Exit IDU mode and restart the console?';
  actions.push({id,platform:'ps4',label:r.name+' · WebKitty 14.02',category:'payloads',categories:['payloads',r.category==='advanced'?'tools':r.category],firmwares:['14.02'],format,downloadURL:url,bytes:b.length,sha256:sha(b),source:sourceURL,sourceURL,sourceCommit:commit,version:commit,upstreamId:r.id,upstreamFirmwareRule:r.rule,author:r.author,description:(r.description||'').replace(/<[^>]*>/g,' '),run:{type:format==='ELF'?'elf-http':'goldhen-http',port:format==='ELF'?9021:9090},requirements,...(confirmBeforeLoad?{confirmBeforeLoad}:{}),license:'Unchanged WebKitty-distributed payload. Preserve upstream author attribution and WebKitty AGPL-3.0 LICENSE.'});
  inventory.push({id,name,version:commit,sourceURL,url,bytes:b.length,sha256:sha(b),archivePath:archive,upstreamFirmwareRule:r.rule});
 }
 const doc={platform:'ps4',sourceCommit:commit,actions};
 fs.writeFileSync(path.join(root,'docs/host-webkitty-payload-actions.json'),JSON.stringify(doc,null,2)+'\n');
 const report={sourceCommit:commit,sourceCatalogueSHA256:sha(Buffer.from(list)),payloadsExecuted:false,hardwareVerified:false,files:inventory};
 fs.writeFileSync(path.join(root,'docs/webkitty-payload-inventory.json'),JSON.stringify(report,null,2)+'\n');
 preserve(path.join(backup,'inventories','webkitty-1402-'+commit+'.json'),Buffer.from(JSON.stringify(report,null,2)+'\n'));
 return {actions:actions.length,bytes:inventory.reduce((n,f)=>n+f.bytes,0),archiveVerified:inventory.every(f=>sha(fs.readFileSync(f.archivePath))===f.sha256)};
}
module.exports={importPayloads};
if(require.main===module)console.log(importPayloads(...process.argv.slice(2)));
