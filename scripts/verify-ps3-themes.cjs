/** Read-only artifact verification. Optional --write saves only the scoped QA report. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {p3tHeader}=require('./import-ps3-themes.cjs');
const root=path.resolve(__dirname,'..');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function verify() {
 const catalogue=JSON.parse(fs.readFileSync(path.join(root,'docs/themezer-ps3-catalog.json')));
 const inventory=JSON.parse(fs.readFileSync(path.join(root,'docs/ps3-themes-private-inventory.json')));
 const errors=[],files=[];
 const assert=(ok,message)=>{if(!ok)errors.push(message);};
 assert(catalogue.themes.length>=10,'At least ten themes required');
 assert(catalogue.failures.length===0,'Unresolved download failures');
 assert(new Set(catalogue.themes.map(t=>t.id)).size===catalogue.themes.length,'Duplicate IDs');
 for(const t of catalogue.themes) {
  try {
   const local=path.resolve(root,t.localDownload.slice(1));
   assert(local.startsWith(root+path.sep),'Local download outside workspace');
   const bytes=fs.readFileSync(local), structure=p3tHeader(bytes);
   assert(bytes.length===t.bytes,`${t.id}: site byte count`);
   assert(digest(bytes)===t.sha256,`${t.id}: site SHA-256`);
   assert(t.platform==='PS3'&&t.author&&t.version&&t.sourceUrl.startsWith('https://themezer.net/ps3/themes/'),`${t.id}: source metadata`);
   const record=inventory.items.find(i=>i.id===`ps3-themes-${t.id.toLowerCase()}`)?.files.find(f=>f.sha256===t.sha256);
   assert(record,`${t.id}: archived metadata missing`);
   if(record) {
    const backup=fs.readFileSync(record.backupPath);
    assert(backup.equals(bytes),`${t.id}: F/site bytes differ`);
    assert(record.sourceUrl===t.downloadUrl,`${t.id}: source download provenance differs`);
   }
   const preview=fs.readFileSync(path.join(root,t.image.slice(1)));
   assert(digest(preview)===t.imageSha256,`${t.id}: preview checksum`);
   assert(preview.subarray(0,4).toString()==='RIFF'&&preview.subarray(8,12).toString()==='WEBP',`${t.id}: preview format`);
   files.push({id:t.id,local:t.localDownload,bytes:bytes.length,sha256:t.sha256,archivedExact:!!record,containerMagic:structure.magic,elements:structure.nodeCount,embeddedFiles:structure.embeddedFiles});
  } catch(error) {errors.push(`${t.id}: ${error.message}`);}
 }
 const page=path.join(root,'console/ps3/themes.html');
 if(fs.existsSync(page)) {
  const html=fs.readFileSync(page,'utf8');
  assert(html.includes('/languages/i18n.js?v=3'),'Current i18n loader missing');
  assert(!/<(?:video|iframe)\b|youtube(?:-nocookie)?\.com\/embed|youtu\.be\//i.test(html),'Video content present');
  for(const t of catalogue.themes) assert(html.includes(t.localDownload)&&html.includes(t.image),`${t.id}: rendered download/image missing`);
  for(const match of html.matchAll(/(?:href|src)="(\/[^"?#]*)(?:[?#][^"]*)?"/g)) {
   if(match[1].startsWith('//')) continue;
   let file=path.join(root,decodeURIComponent(match[1].slice(1)));
   if(fs.existsSync(file)&&fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
   assert(fs.existsSync(file),'Missing page resource: '+match[1]);
  }
 } else errors.push('Theme page has not been generated');
 return {checkedAt:new Date().toISOString(),themes:files.length,static:catalogue.themes.filter(t=>t.type==='static').length,dynamic:catalogue.themes.filter(t=>t.type==='dynamic').length,totalBytes:files.reduce((a,f)=>a+f.bytes,0),files,errors,limits:['No physical console installation or rendering tested','No downloaded P3T or embedded RAF executed']};
}
if(require.main===module) {
 const report=verify();
 if(process.argv.includes('--write')) {fs.mkdirSync(path.join(root,'docs/qa/ps3-themes'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/ps3-themes/verification.json'),JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify(report,null,2)); if(report.errors.length) process.exitCode=1;
}
module.exports={verify};
