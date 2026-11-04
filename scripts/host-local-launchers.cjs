'use strict';
// Author public launcher pages only. Original native runtime bytes are read as
// metadata and never changed. No download, source recovery or archive mutation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const GOLD={
 'karo-goldhen505':{fw:'5.05',payload:'goldhen.bin',cacheReopen:true},
 'karo-goldhen672':{fw:'6.72',payload:'goldhen.bin',cacheReopen:true},
 'karo-g702':{fw:'7.02',payload:'goldhen_2.3_702.bin'},
 'karo-g755':{fw:'7.55',payload:'goldhen_2.3_755.js',embedded:true},
 'karo-g900':{fw:'9.00',payload:'goldhen.bin'}
};
function routeGroups(karo,afterglow,{preferredOnly=false}={}){
 if(!karo||!/^\/(?:WWB-HOST\/)?hosts\/runtime\/karo-[a-f0-9]{12}-[a-f0-9]{12}\/web\/$/.test(karo.runtime||'')||!/^[a-f0-9]{40}$/.test(karo.commit||'')||!Array.isArray(karo.entries))throw Error('Expected an existing pinned KARO build.');
 const preferred=['karo-g2allpro','karo-ps5-umtx','karo-ps5-p2jb','karo-ps5-poopspl','karo-ps5-relapse'];
 const records=karo.entries.filter(e=>e.kind==='loader'&&!e.blockedReason).map(e=>{
  if(!/^ps[45]$/.test(e.platform)||!Array.isArray(e.firmwares)||!e.firmwares.length||e.firmwares.some(f=>!/^\d{1,2}\.\d{2}$/.test(f))||!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*\/index\.html$/i.test(e.path)||e.scope!==e.path.slice(0,-10)||!/^[a-z0-9-]+$/.test(e.id))throw Error('Unsupported native route metadata.');
  const gold=GOLD[e.id],publicEntry='/hosts/'+e.platform+'/exploit/'+e.id+'/',firmwares=e.firmwares.slice();
  if(gold&&(firmwares.length!==1||firmwares[0]!==gold.fw))throw Error('The GoldHEN route firmware pin changed.');
  return {id:e.id,label:e.platform.toUpperCase()+' WebKit Exploit - '+(gold?gold.fw:e.label.replace(/^KARO\s+(?:PS[45]\s+)?/i,'')),platform:e.platform,firmwares,entry:publicEntry,runtimeEntry:karo.runtime+e.path,runtime:karo.runtime,payloadChoice:gold?[{id:'goldhen',label:'GoldHEN',file:gold.payload,embedded:!!gold.embedded}]:null,preferred:!!gold||preferred.includes(e.id),cacheReopen:!!gold?.cacheReopen,sourceRanges:(e.ranges||[]).map(r=>r.slice()),originalEntry:e,source:{repository:'https://github.com/KAR0218/KAR0218.github.io',commit:karo.commit,path:e.path},ticket:'existing-karo-guard'};
 });
 if(afterglow){if(!/^\/hosts\/runtime\/ps4-afterglow-[a-f0-9]{12}\/web\/index\.html$/.test(afterglow.entry||'')||JSON.stringify(afterglow.firmwares)!=='["13.52","14.00"]')throw Error('Afterglow firmware pins changed.');records.push({id:'ps4-afterglow',label:'PS4 WebKit Exploit - 13.52 / 14.00',platform:'ps4',firmwares:afterglow.firmwares.slice(),entry:'/hosts/ps4/afterglow/',runtimeEntry:afterglow.entry,payloadChoice:[{id:'hen',label:'ps4-hen'},{id:'goldhen',label:'GoldHEN'}],preferred:true,source:{repository:'https://github.com/well0nez/afterglow-web',commit:afterglow.commit},ticket:'existing-afterglow-landing'});}
 return preferredOnly?records.filter(r=>r.preferred):records;
}
function render(route){
 if(route.ticket!=='existing-karo-guard')throw Error('Afterglow keeps its genuine separate landing.');
 const data=JSON.stringify({runtime:route.runtime,entry:route.originalEntry}).replaceAll('<','\\u003c'),platform=route.platform.toUpperCase(),choices=route.payloadChoice?'<label class="confirmation"><input type="radio" name="hen" value="goldhen" checked> GoldHEN</label>':'<p>Use the original loader’s payload controls after Load.</p>';
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(route.label)+' | WWB HOST</title><meta name="description" content="Local '+platform+' browser exploit entry with exact firmware checks."><link rel="stylesheet" href="/assets/host-karo-builds.css"><script defer src="/assets/host-karo-builds.js"></script><script defer src="/assets/host-local-launcher.js?v=2"></script></head><body><nav class="host-taskbar"><a href="/hosts/'+route.platform+'/">← '+platform+' host</a><a href="/hosts/karo/">Other local builds</a></nav><main><header><h1>'+esc(route.label)+'</h1><p>'+esc(route.firmwares.join(' · '))+'</p></header>'+choices+(route.cacheReopen?'<p>The original build may install its cache first and request a fresh entry.</p>':'')+'<label class="confirmation"><input type="checkbox" id="host-local-confirm"> I checked the matching console firmware and am ready to load.</label><button type="button" id="host-local-load" disabled>Load exploit</button><p id="host-local-status" role="status" aria-live="polite" aria-atomic="true"></p><details><summary>Previous attempt</summary><label class="confirmation"><input type="checkbox" id="host-local-restarted"> I checked and restarted the console.</label><button type="button" id="host-local-clear" disabled>Clear saved attempt</button></details><footer><details><summary>Source &amp; credits</summary><p>Original KARO browser build by Karo Sharifi and contributors; GoldHEN by SiSTRo. Original attributions remain in the runtime. No top-level blanket licence is declared.</p><p><a href="'+esc(route.source.repository+'/tree/'+route.source.commit+'/'+route.source.path)+'">Pinned source</a> · <a href="/docs/host-reviews/karo/README.md">Integration and original notices</a></p><p><code>'+esc(route.source.commit)+'</code></p></details></footer></main><script id="host-local-data" type="application/json">'+data+'</script></body></html>\n';
}
function build({root=path.resolve(__dirname,'..'),write=true}={}){
 for(const dependency of ['assets/host-karo-builds.js','assets/host-local-launcher.js','assets/host-karo-builds.css'])if(!fs.existsSync(path.join(root,dependency)))throw Error('Missing public launcher dependency: '+dependency);
 const karo=JSON.parse(fs.readFileSync(path.join(root,'docs/host-reviews/karo/build.json'),'utf8')),afterFile=path.join(root,'docs/afterglow-build.json'),afterglow=fs.existsSync(afterFile)?JSON.parse(fs.readFileSync(afterFile,'utf8')):null,groups=routeGroups(karo,afterglow),records=[],retained=[];
 for(const route of groups.filter(r=>r.ticket==='existing-karo-guard')){
  const target=path.join(root,route.entry.slice(1),'index.html'),original=path.join(root,route.runtimeEntry.slice(1));if(!fs.existsSync(original))throw Error('Missing preserved native entry: '+route.runtimeEntry);
  const bytes=Buffer.from(render(route)),record={id:route.id,page:route.entry+'index.html',bytes:bytes.length,sha256:sha(bytes),runtimeEntry:route.runtimeEntry,nativeEntrySHA256:sha(fs.readFileSync(original))};
  if(fs.existsSync(target)){const previous=fs.readFileSync(target);if(sha(previous)!==record.sha256){const snapshot='docs/migration/retained-local-launchers/'+route.id+'-'+sha(previous)+'.html',saved=path.join(root,snapshot);if(fs.existsSync(saved)&&!fs.readFileSync(saved).equals(previous))throw Error('Refusing different retained page bytes.');if(write&&!fs.existsSync(saved)){fs.mkdirSync(path.dirname(saved),{recursive:true});fs.writeFileSync(saved,previous,{flag:'wx'});}retained.push({page:record.page,snapshot,bytes:previous.length,sha256:sha(previous)});}}
  if(write){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}records.push(record);
 }
 const result={schemaVersion:1,groups,records,retained,nativeFilesChanged:0,downloadFilesChanged:0,consoleContact:false,payloadExecution:false};if(write)fs.writeFileSync(path.join(root,'docs/host-local-launchers.json'),JSON.stringify(result,null,2)+'\n');return result;
}
if(require.main===module){const report=build();console.log(JSON.stringify({pages:report.records.length,groups:report.groups.length,retained:report.retained.length}));}module.exports={GOLD,routeGroups,render,build};
