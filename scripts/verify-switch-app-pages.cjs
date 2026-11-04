// Inspect files, archive copies, served bytes and generated pages; never run NROs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspectNro}=require('./verify-switch-themes.cjs');
const {inspectZip}=require('./archive-switch-homebrew.cjs');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const c=JSON.parse(fs.readFileSync(path.join(root,'docs/switch-app-pages.json'))),inventory=JSON.parse(fs.readFileSync(path.join(root,'docs/switch-app-pages-private-inventory.json')));
 const specs=require('./switch-app-page-content.cjs');
 if(c.apps.length!==specs.length)throw Error('Incomplete app selection');
 const report={checkedAt:new Date().toISOString(),passed:true,pages:[],files:0,images:0,localLinks:0,limits:['No application was executed.','No physical-console installation or performance test.','Pins are preserved releases, not a claim of current firmware compatibility.']};
 const library=fs.readFileSync(path.join(root,'console/nintendo-switch/apps.html'),'utf8');
 for(const app of c.apps){
  const html=fs.readFileSync(path.join(root,app.page),'utf8');
  if(!library.includes('href="'+app.page+'"'))throw Error('Missing library link: '+app.title);
  if(!html.includes('/languages/i18n.js?v=3')||!html.includes('/assets/site-background.js')||/<video\b|youtube(?:-nocookie)?\.com\/embed|youtu\.be\//.test(html)||/F:[\\/]|X-Amz-/.test(html))throw Error('Integration issue: '+app.title);
  if(app.warning&&!html.includes('Legacy compatibility'))throw Error('Missing compatibility warning');
  for(const match of html.matchAll(/(?:href|src)="(\/[^"?#]*)(?:[?#][^"]*)?"/g)){const local=decodeURIComponent(match[1]).replaceAll('&amp;','&');if(!fs.existsSync(path.join(root,local)))throw Error('Missing link '+local);report.localLinks++;}
  const image=fs.readFileSync(path.join(root,app.image.local));if(image.length!==app.image.bytes||sha(image)!==app.image.sha256||!(image.subarray(0,8).toString('hex')==='89504e470d0a1a0a'||image[0]===255&&image[1]===216))throw Error('Invalid icon');report.images++;
  const row={app:app.title,page:app.page,version:app.version,files:[],setupSteps:require('./switch-app-page-content.cjs').find(s=>s.id===app.id).steps.length};
  for(const file of app.files){
   const b=fs.readFileSync(path.join(root,file.local));if(b.length!==file.bytes||sha(b)!==file.sha256)throw Error('Local hash mismatch');
   const saved=inventory.items.find(i=>i.id==='switch-app-pages-'+specs.find(s=>s.id===app.id).slug)?.files.find(f=>f.sha256===file.sha256);
   if(!saved)throw Error('No archived record '+file.name);const backup=fs.readFileSync(saved.backupPath);if(backup.length!==file.bytes||sha(backup)!==file.sha256)throw Error('Backup hash mismatch');
   if(file.bundle){const members=inspectZip(b,256*1024*1024);for(const n of members.filter(m=>!m.directory&&/\.nro$/i.test(m.path)))inspectNro(n.data);if(!members.some(m=>/\.nro$/i.test(m.path)))throw Error('Bundle missing NRO');}
   else inspectNro(b);
   const res=await fetch('http://127.0.0.1:8765'+file.local),served=Buffer.from(await res.arrayBuffer());if(res.status!==200||served.length!==file.bytes||sha(served)!==file.sha256)throw Error('HTTP bytes differ '+file.name);
   if(!html.includes(file.local.replaceAll('&','&amp;')))throw Error('Download absent from page');
   row.files.push({name:file.name,sha256:file.sha256,bytes:file.bytes,localPassed:true,backupPassed:true,httpPassed:true});report.files++;
  }
  report.pages.push(row);
 }
 fs.mkdirSync(path.join(root,'docs/qa'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/switch-app-pages-verification.json'),JSON.stringify(report,null,2)+'\n');
 console.log({passed:true,pages:report.pages.length,files:report.files,icons:report.images,localLinks:report.localLinks});
}
main().catch(e=>{console.error(e);process.exitCode=1;});
