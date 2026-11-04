// Read-only build/backup/HTTP verification. No console executable is run.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function digest(stream){const h=crypto.createHash('sha256');let bytes=0;for await(const b of stream){bytes+=b.length;h.update(b);}return {bytes,sha256:h.digest('hex')};}
async function main(){
 const c=JSON.parse(fs.readFileSync(path.join(root,'docs/switch-core-tools.json'))),inventory=JSON.parse(fs.readFileSync(path.join(root,'docs/switch-core-tools-private-inventory.json')));
 const report={checkedAt:new Date().toISOString(),passed:true,tools:[],localLinks:0,images:[],limitations:['No payload/application execution or physical-console installation was tested.','RetroArch SHA-256 is recorded locally; Atmosphere/Hekate hashes match official publisher release metadata.']};
 for(const tool of c.tools){
  const row={slug:tool.slug,version:tool.version,files:[]},pagePath='console/nintendo-switch/'+tool.slug+'.html',html=fs.readFileSync(path.join(root,pagePath),'utf8');
  if(!html.includes('/languages/i18n.js?v=3')||!html.includes('/assets/site-background.js')||/<video\b|youtube(?:-nocookie)?\.com\/embed|youtu\.be\//.test(html)||/F:[\\/]|cloudflarestorage|X-Amz-/.test(html))throw Error('Page integration check failed: '+tool.slug);
  for(const m of html.matchAll(/(?:href|src)="(\/[^"?#]*)(?:[?#][^"]*)?"/g)){const p=decodeURIComponent(m[1]).replaceAll('&amp;','&');if(!fs.existsSync(path.join(root,p)))throw Error('Missing local path: '+p);report.localLinks++;}
  for(const f of tool.files){
   if(!html.includes(f.local.replaceAll('&','&amp;')))throw Error('Missing visible download');
   const local=await digest(fs.createReadStream(path.join(root,f.local)));
   if(local.bytes!==f.bytes||local.sha256!==f.sha256)throw Error('Local file differs '+f.name);
   const saved=inventory.items.find(i=>i.id===tool.id)?.files.find(a=>a.sha256===f.sha256&&a.version===f.version);
   if(!saved)throw Error('No archived record '+f.name);
   const backup=await digest(fs.createReadStream(saved.backupPath));if(backup.bytes!==f.bytes||backup.sha256!==f.sha256)throw Error('Backup differs '+f.name);
   const response=await fetch('http://127.0.0.1:8765'+f.local,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('HTTP '+response.status);
   const served=await digest(response.body);if(served.bytes!==f.bytes||served.sha256!==f.sha256)throw Error('Served bytes differ '+f.name);
   row.files.push({name:f.name,version:f.version,bytes:f.bytes,sha256:f.sha256,localPassed:true,archivePassed:true,httpStatus:response.status,httpPassed:true});
  }
  report.tools.push(row);
 }
 for(const image of [...c.images,c.tools.find(t=>t.slug==='retroarch').image]){const b=fs.readFileSync(path.join(root,image.local));if(b.length!==image.bytes||hash(b)!==image.sha256)throw Error('Image differs');report.images.push({local:image.local,passed:true});}
 const hub=fs.readFileSync(path.join(root,'console/nintendo-switch.html'),'utf8');for(const t of c.tools)if(!hub.includes('/console/nintendo-switch/'+t.slug+'.html'))throw Error('Missing hub route');
 fs.mkdirSync(path.join(root,'docs/qa'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/switch-core-tools-verification.json'),JSON.stringify(report,null,2)+'\n');
 console.log({passed:report.passed,pages:report.tools.length,files:report.tools.reduce((n,t)=>n+t.files.length,0),localLinks:report.localLinks});
}
main().catch(e=>{console.error(e);process.exitCode=1;});
