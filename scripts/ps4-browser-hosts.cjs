'use strict';
// Presentation and navigation only; never imports or runs a console exploit.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const originals={'gamerhack-g2all':'https://gamerhack.github.io/g2all/','raw13g-1302-1352':'https://raw13g.github.io/'};
function isTrustedOriginal(a){return a.platform==='ps4'&&Object.prototype.hasOwnProperty.call(originals,a.id)&&originals[a.id]===a.launchURL;}
function prepare(actions,platform){if(platform!=='ps4')return actions;return actions.filter(a=>!['built-in-ps4-900','built-in-ps4-psfree-700-960'].includes(a.id)).map(a=>{
 if(isTrustedOriginal(a))return {...a,browserHost:true,launchLabel:'Load',label:a.id==='gamerhack-g2all'?'GamerHack · GoldHEN':'RAW GAME · GoldHEN',format:'PS4 browser host'};
 if(a.id==='built-in-ps4-afterglow')return {...a,browserHost:true,launchLabel:'Load',label:'Afterglow · GoldHEN / ps4-hen'};
 if(a.id==='ps4-goldhen-user-supplied')return {...a,browserHost:true,runtimeId:'ps4-afterglow',firmwares:['13.52','14.00'],launchURL:require('../docs/afterglow-build.json').entry,launchLabel:'Load'};
 return a;
});}
function refreshLegacyEntries(root){
 const manifestPath=path.join(root,'docs/host-runtime-builds.json'),doc=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 for(const id of ['ps4-900','ps4-psfree-700-960']){
  const runtime=doc.runtimes.find(r=>r.id===id);if(!runtime)continue;
  const dir=path.join(root,'hosts/runtime',id),title=id==='ps4-900'?'PS4 9.00':'PS4 7.00–9.60';
  const group=require('./host-compact-pages.cjs').actions(root,'ps4',[]).find(a=>a.runtimeId==='karo-g2all');
  if(!group)throw Error('Missing reviewed local PS4 runtime');
  const action={...group,id:'local-legacy-'+id,firmwares:id==='ps4-900'?['9.00']:group.firmwares};
  const html=fs.readFileSync(path.join(__dirname,'ps4-legacy-load-template.html'),'utf8').replace('__ACTION__',JSON.stringify(action).replaceAll('<','\\u003c'));
  fs.writeFileSync(path.join(dir,'index.html'),html);const bytes=Buffer.from(html),file=runtime.files.find(f=>f.path==='index.html');Object.assign(file,{bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  const localPath=path.join(dir,'build.json'),local=JSON.parse(fs.readFileSync(localPath,'utf8'));local.files=runtime.files;local.entryFlow={type:'same-origin-native-host',url:group.launchURL,advancedEntry:'web/index.html'};fs.writeFileSync(localPath,JSON.stringify(local,null,2)+'\n');runtime.entryFlow=local.entryFlow;
 }
 fs.writeFileSync(manifestPath,JSON.stringify(doc,null,2)+'\n');
}
module.exports={originals,isTrustedOriginal,prepare,refreshLegacyEntries};
