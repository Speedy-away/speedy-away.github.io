// Reuse pinned console artifacts only after checking their bytes; no payload runs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createArchive}=require('./console-expansion-archive.cjs');
const {inspectZip}=require('./archive-switch-homebrew.cjs');
const {inspectNro}=require('./verify-switch-themes.cjs');
const specs=require('./switch-app-page-content.cjs');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const apps=require('../docs/switch-homebrew-catalog.json').apps,records=require('../docs/switch-homebrew-downloads.json').apps;
 const images=[...require('../docs/switch-homebrew-image-sources.json').images,...require('../docs/switch-homebrew-expansion-image-sources.json').images.map(i=>({...i,localPath:i.file,size:i.bytes,source:i.url}))],old=require('../docs/download-audit.json');
 const archive=createArchive(),out={schemaVersion:1,checkedAt:new Date().toISOString(),platform:'Nintendo Switch',apps:[]};
 for(const spec of specs){
  const app=apps.find(a=>a.id===spec.id),r=records.find(a=>a.id===spec.id);
  const image=images.find(i=>i.id===spec.id&&i.localPath)||require('../docs/switch-app-embedded-image-sources.json').images.find(i=>i.id===spec.id);if(!app||!r||!image)throw Error('Missing pinned input: '+spec.id);
  const imageBytes=fs.readFileSync(path.join(root,image.localPath));if(imageBytes.length!==image.size||sha(imageBytes)!==image.sha256)throw Error('Image differs: '+spec.id);
  const primary=app.standaloneNro?(r.officialNro||r.nro):r.package;
  const chosen=[primary,...(spec.id==='ftpd'?[r.package]:[])];
  const entry={...app,page:'/console/nintendo-switch/'+spec.slug+'.html',image:{local:image.localPath,sourceUrl:image.source,credit:image.credit||app.title+' project icon from its Homebrew App Store listing',...(image.member?{member:image.member}:{}),bytes:image.size,sha256:image.sha256},files:[]};
  const itemId='switch-app-pages-'+spec.slug;
  for(const f of chosen){
   const originals=old.items.flatMap(i=>i.files||[]).filter(a=>a.sha256===f.sha256&&a.bytes===f.bytes&&a.backupPath);
   const original=originals.find(a=>fs.existsSync(a.backupPath));if(!original)throw Error('No preserved original '+f.name);
   const data=fs.readFileSync(original.backupPath);if(data.length!==f.bytes||sha(data)!==f.sha256)throw Error('Original archive differs');
   const local=f.local||'/downloads/nintendo-switch/app-pages/'+spec.slug+'/'+encodeURIComponent(f.version).replaceAll('%','_')+'/'+f.name;
   const target=path.join(root,local);fs.mkdirSync(path.dirname(target),{recursive:true});
   if(fs.existsSync(target)&&sha(fs.readFileSync(target))!==f.sha256)throw Error('Refusing to replace a different public file');
   if(!fs.existsSync(target))fs.writeFileSync(target,data,{flag:'wx'});
   const inspection=/\.zip$/i.test(f.name)?inspectZip(data,256*1024*1024).filter(m=>!m.directory&&/\.nro$/i.test(m.path)).map(m=>({path:m.path,sha256:m.sha256,...inspectNro(m.data)})):[inspectNro(data)];
   if(!inspection.length)throw Error('No Switch NRO in bundle');
   const saved=await archive.archiveFile({scope:'switch-app-pages',item:{id:itemId,title:app.title,url:app.project,platform:'Nintendo Switch',category:[app.category==='Emulators'?'Emulators':app.category==='Homebrew games'?'Games':'Apps',app.category],pages:[entry.page.slice(1)]},file:{name:f.name,version:f.version,sourceUrl:f.source,local,...(f.derivedFrom?{derivedFrom:f.derivedFrom}:{}),archiveRole:['Builds'],expectedBytes:f.bytes,expectedSha256:f.sha256},sourceFile:target});
   entry.files.push({...saved.publicFile,archived:true,role:f.role,...(f.derivedFrom?{derivedFrom:f.derivedFrom}:{}),bundle:/\.zip$/i.test(f.name),inspection});
  }
  out.apps.push(entry);fs.writeFileSync(path.join(root,'docs/switch-app-pages.json'),JSON.stringify(out,null,2)+'\n');console.log('Prepared',entry.title,entry.files.length,'file(s)');
 }
 fs.writeFileSync(path.join(root,'docs/switch-app-pages.json'),JSON.stringify(out,null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
