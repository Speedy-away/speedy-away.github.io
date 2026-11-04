// File-level labels come from the preserved archive path or reviewed hash mapping.
// Never turn a resource-wide HEN/DEX claim into a claim about an unlabelled file.
const multiGame=require('./ps3-multicod-metadata.cjs');
const unique=values=>[...new Set(values)];
function context(item,file){
 const reviewed=multiGame.variantForFile(item,file);
 const parts=String(file.memberPath||file.name||file.filename||'').replaceAll('\\','/').split('/');
 let types=[],regions=[];
 for(const part of [...parts].reverse()){
  if(!types.length&&!/\b(?:not|no|unsupported)\b/i.test(part))types=unique([...part.matchAll(/(?:^|[^a-z])(?:PS3)?(HEN|DEX|CEX|HFW|CFW)(?=$|[^a-z])/ig)].map(m=>m[1].toUpperCase()));
  if(!regions.length)regions=unique([...part.matchAll(/\b(?:BLES|BLUS|BCES|BCUS|NPEB|NPUB|NPJB|NPHB)(?:[-_ ]?\d{2,9})?\b/ig)].map(m=>m[0].toUpperCase()));
  if(types.length&&regions.length)break;
 }
 if(reviewed)types=unique([...reviewed.label.matchAll(/\b(HEN|DEX|CEX|HFW|CFW)\b/ig)].map(m=>m[1].toUpperCase()));
 return {types,regions,reviewed,label:[types.join(' / '),regions.join(' / ')].filter(Boolean).join(' · ')||'Read requirements',key:JSON.stringify([types,regions])};
}
function numericVersion(file){
 const text=String(file.version||file.releaseTag||file.owner?.version||file.owner?.release||'');
 return /^v?\d+(?:\.\d+){1,3}$/i.test(text)?text.replace(/^v/i,'').split('.').map(Number):null;
}
function compare(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const delta=(a[i]||0)-(b[i]||0);if(delta)return delta;}return 0;}
function select(item,files){
 const groups=new Map();
 for(const file of files){
  const c=context(item,file),name=file.name||file.filename;
  const key=JSON.stringify([c.key,name,String(file.gameUpdate||file.owner?.gameUpdate||item.gameUpdate||''),file.firmware||file.owner?.firmware||'',file.compatibility||file.owner?.compatibility||'']);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(file);
 }
 const current=[],preserved=[];
 for(const group of groups.values()){
  const versions=group.map(numericVersion),allVersioned=versions.every(Boolean);
  const latest=allVersioned?versions.reduce((a,b)=>compare(a,b)>=0?a:b):null;
  const hashes=new Set();
  for(let i=0;i<group.length;i++){
   const file=group[i],hash=file.sha256+'|'+file.bytes;
   if(latest&&compare(versions[i],latest)<0||hashes.has(hash))preserved.push(file);
   else{hashes.add(hash);current.push(file);}
  }
 }
 const seen=new Set(),distinct=[];
 for(const file of current){
  const key=JSON.stringify([context(item,file).key,file.name||file.filename,file.sha256,file.bytes,file.gameUpdate||file.owner?.gameUpdate||item.gameUpdate||'',file.firmware||file.owner?.firmware||'']);
  if(seen.has(key))preserved.push(file);else{seen.add(key);distinct.push(file);}
 }
 return {current:distinct,preserved};
}
module.exports={context,select};
