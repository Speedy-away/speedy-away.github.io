// Render reviewed, unaltered menu images without changing compatibility metadata.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function createMenuMedia({root=path.resolve(__dirname,'..')}={}){
 const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const records=new Map(),checked=new Map();
 const read=file=>fs.existsSync(path.join(root,file))?JSON.parse(fs.readFileSync(path.join(root,file),'utf8')):{};
 const baseAliases={...read('docs/ps3-base-menu-image-aliases.json').resources||{},...read('docs/ps3-base-additional-image-research.json').resources||{}};
 function validImage(url,sha){
  if(typeof url!=='string'||!/^\/assets\/images\/.+\.(?:png|jpe?g|webp|avif|gif)$/i.test(url)||/[?#\\]/.test(url))return false;
  const base=path.resolve(root,'assets/images'),file=path.resolve(root,'.'+url),relative=path.relative(base,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!fs.existsSync(file)||!fs.statSync(file).isFile())return false;
  if(sha){if(!checked.has(file))checked.set(file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));if(checked.get(file)!==sha)return false;}
  return true;
 }
 for(const [id,record] of Object.entries(read('docs/ps3-menu-preview-research.json').resources||{})){
  if(record.visuallyVerified&&validImage(record.image,record.sha256))records.set(id,{...record,path:record.image,rank:record.versionMismatch?1:3});
 }
 const xboxPC=read('docs/xbox-pc-menu-preview-research.json');
 for(const record of xboxPC.images||[]){
  if(!record.visuallyVerified||!validImage(record.path,record.sha256))continue;
  const rank=record.match==='exact-source-link'?4:1;
  for(const id of record.resourceIds||[])if(!records.has(id)||records.get(id).rank<rank)records.set(id,{...record,rank});
 }
 for(const [id,recommended] of Object.entries(xboxPC.recommendedImages||{})){
  const verified=(xboxPC.images||[]).find(record=>record.path===recommended.path&&record.visuallyVerified&&(record.resourceIds||[]).includes(id));
  if(verified&&validImage(verified.path,verified.sha256))records.set(id,{...verified,...recommended,rank:5});
 }
 function forItem(item){
  if(records.has(item.id))return records.get(item.id);
  const alias=baseAliases[item.id];
  const artworkOrMissing=!validImage(item.image)||/\/(?:covers|consoles)\/|waw-official-cover/i.test(item.image)||/cover artwork|cover.*not.*screenshot/i.test(item.imageCaption||'');
  if(alias?.visuallyVerified&&artworkOrMissing&&validImage(alias.image,alias.sha256))return {...alias,path:alias.image,rank:1};
  if(validImage(item.image))return {path:item.image,caption:item.imageCaption||'Menu preview',imageAlt:item.imageAlt,artwork:/\/(?:covers|consoles)\/|waw-official-cover/i.test(item.image)||/cover artwork|cover.*not.*screenshot/i.test(item.imageCaption||''),rank:2};
  return null;
 }
 function figure(item,fallback,fallbackTitle){
  const record=forItem(item),image=record?.path||(validImage(fallback)?fallback:null);
  if(!image)return '';
  const family=record&&(record.match==='menu-family'||record.versionMismatch||/menu-family/.test(record.kind||''));
  const artwork=!record||record.artwork;
  const label=artwork?'Game artwork':family?'Menu-family preview':'Menu preview';
  const caption=record?.displayCaption||((record?.versionMismatch||/component/i.test(record?.kind||''))?record.caption:label);
  const alt=artwork?(fallbackTitle||'Game')+' artwork':(record.imageAlt||item.name+' menu preview');
  return `<figure class="menu-preview" data-menu-preview="${artwork?'artwork':family?'family':'source'}"><a href="${esc(image)}" target="_blank" rel="noopener noreferrer" aria-label="View ${esc(alt)}"><img src="${esc(image)}" alt="${esc(alt)}" loading="lazy" decoding="async"></a>${!artwork?`<figcaption>${esc(caption)}</figcaption>`:''}</figure>`;
 }
 function details(item){const record=forItem(item);return record?.caption?`<p class="menu-preview-note">${esc(record.caption)}</p>`:'';}
 return {forItem,figure,details};
}
module.exports={createMenuMedia};
