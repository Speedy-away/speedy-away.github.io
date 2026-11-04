// Integrate reviewed source-post images; preserve every previous preview record.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const write=(file,data)=>fs.writeFileSync(path.join(root,file),JSON.stringify(data,null,2)+'\n');
const selected=read('docs/qa/cached-menu-image-selection.json').images.filter(x=>x.platform==='ps3');
const file='docs/ps3-menu-preview-research.json',data=read(file);
const resources=read('docs/discord-ps3-resources.json').resources;
const special=new Map([
 ['discord-ps3-bo1-mp-nightmare-engine-v2','The original multiplayer source post shows a Zombies menu image; the image does not establish multiplayer compatibility.'],
 ['discord-ps3-bo3-pepitax','The original BO3 source post shows a Black Ops 1 menu image; the image does not establish BO3 appearance or compatibility.'],
 ['discord-ps3-waw-mp-hidden-gold-v5-older','The source post is labelled v5, while its original image visibly says The Hidden Gold v4.3. This image does not confirm the archived revision.']
]);
for(const image of selected){
 const item=resources.find(x=>x.id===image.id);
 if(!item||item.source!==image.source)throw Error('Source mismatch: '+image.id);
 const bytes=fs.readFileSync(path.join(root,'.'+image.image));
 if(bytes.length!==image.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==image.sha256)throw Error('Image checksum mismatch: '+image.id);
 if(image.originalImage&&image.originalSha256){
  const original=fs.readFileSync(path.join(root,'.'+image.originalImage));
  if(crypto.createHash('sha256').update(original).digest('hex')!==image.originalSha256)throw Error('Original image checksum mismatch: '+image.id);
 }
 const prefix='docs/discord-ps4-ps5-raw/platforms/'+image.id.replace(/^discord-/,'');
 const sourceCapture=[prefix+'.json',prefix+'-op.txt',...(image.id==='discord-ps3-bo1-zm-rapture-v2'?['docs/discord-ps3-resources.json']:[])].find(f=>fs.existsSync(path.join(root,f)));
 if(!sourceCapture)throw Error('Missing source capture: '+image.id);
 const old=data.resources[image.id];
 const previous=old&&old.image!==image.image?old:old?.previousPreview;
 data.resources[image.id]={
  image:image.image,imageSourceUrl:image.imageSourceUrl,sourcePageUrl:image.source,sourceCapture,
  sourceAttachmentId:image.attachmentId,name:image.name,bytes:image.bytes,sha256:image.sha256,
  width:image.width,height:image.height,kind:'unaltered original source-post image',match:'exact-source-post-image',
  visuallyVerified:true,
  verification:'Visually reviewed contact sheet: original source-post menu/tool image; build compatibility remains source-defined.',
  caption:'Original source-post image; appearance does not establish archived-build compatibility.'+(special.has(image.id)?' '+special.get(image.id):''),
  displayCaption:special.has(image.id)?'Source-post image · see source notes':'Source-post preview',
  imageAlt:item.name+' original source-post image',
  ...Object.fromEntries(['transformation','originalImage','originalSha256','originalBytes'].filter(key=>image[key]!==undefined).map(key=>[key,image[key]])),
  ...(special.has(image.id)?{sourceImageMismatch:special.get(image.id)}:{}),
  ...(previous?{previousPreview:previous}:{})
 };
}
data.updatedAt=new Date().toISOString();
write(file,data);
const media=require('./console-menu-media.cjs').createMenuMedia({root});
const unresolved=selected.filter(x=>media.forItem({id:x.id})?.path!==x.image);
if(unresolved.length)throw Error('Unresolved selections: '+unresolved.map(x=>x.id));
const report={
 checkedAt:new Date().toISOString(),selectedSourcePostImages:selected.length,
 previousPreviewsPreserved:Object.values(data.resources).filter(x=>x.previousPreview).length,
 unresolvedSelectedImages:unresolved.length,
 unmatchedRemainingResources:resources.filter(x=>!selected.some(s=>s.id===x.id)).map(x=>({id:x.id,name:x.name,source:x.source,status:x.status,reason:x.status==='source-marks-down'?'The original Discord message was deleted; no original image, download URL or build requirements can be recovered from the post.':x.note||'No selected original image available.'})),
 sourceImageMismatches:[...special].map(([id,note])=>({id,note})),
 verification:'All selected records match captured source URL, bytes, SHA256 and shared media-renderer resolution. Original and changed image contact sheets visually reviewed. No build compatibility inferred from images.'
};
write('docs/qa/ps3-cached-menu-image-recovery.json',report);
console.log(JSON.stringify({selected:selected.length,preserved:report.previousPreviewsPreserved,unresolved:unresolved.length,remaining:report.unmatchedRemainingResources.length}));
