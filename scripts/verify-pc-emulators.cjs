const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {hashFile}=require('./console-expansion-archive.cjs');
const root=path.resolve(__dirname,'..');
const catalog=require('../docs/pc-emulator-catalog.json');
const pages=['pc/emulators.html','pc/nintendo-emulators.html','pc/playstation-emulators.html','pc/xbox-emulators.html'];
async function verify(){
 const ids=new Set();
 for(const app of catalog.apps){
  assert(!ids.has(app.id),'Duplicate app id '+app.id);ids.add(app.id);
  for(const p of app.platforms){assert(['windows','macos','linux'].includes(p.id));assert(['native','experimental','source','legacy','wine','core'].includes(p.mode));assert(p.note);}
  if(app.image)assert(fs.existsSync(path.join(root,app.image)),'Missing '+app.image);
 }
 assert.deepEqual(catalog.apps.find(a=>a.id==='eden-ns2').platforms.map(p=>[p.id,p.mode]),[['windows','source']]);
 assert.deepEqual(catalog.apps.find(a=>a.id==='project64').platforms.map(p=>p.id),['windows']);
 assert.equal(catalog.apps.find(a=>a.id==='cxbx-reloaded').platforms.find(p=>p.id==='linux').mode,'wine');
 assert.match(catalog.apps.find(a=>a.id==='ps4-shadps4').platforms.find(p=>p.id==='macos').note,/26\.0.*Intel Macs unsupported/);
 let renderedCards=0;
 for(const file of pages){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  const allIds=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(allIds.length,new Set(allIds).size,file+' duplicate HTML ids');
  assert(html.includes('/languages/i18n.js?v=3'));
  assert(html.includes('/assets/site-background.js?v=2'));
  const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||'';
  assert(!/<iframe|youtube(?:-nocookie)?\.com\/(?:watch|embed)|youtu\.be\//i.test(main),file+' video found');
  const schema=JSON.parse(html.match(/<script id="site-page-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  for(const item of schema.mainEntity.itemListElement)assert(allIds.includes(new URL(item.url).hash.slice(1)),file+' unresolved schema anchor');
  const cards=[...html.matchAll(/<article\b[^>]*data-emu-card[^>]*>[\s\S]*?<\/article>/g)].map(m=>m[0]);renderedCards+=cards.length;
  for(const card of cards){
   if(/id="(?:switch2|emu-eden-ns2)"/.test(card)){assert(card.includes('Source only'));assert(!card.includes('emu-download'));assert(!card.includes('macos.svg'));assert(!card.includes('linux.svg'));}
  }
  if(file==='pc/emulators.html')for(const anchor of ['modern','retroarch','collections','retro','handheld','switch2'])assert(allIds.includes(anchor),'Legacy anchor '+anchor);
  if(file==='pc/nintendo-emulators.html')for(const anchor of ['dolphin','wiiu','switch','retro','switch2'])assert(allIds.includes(anchor),'Nintendo anchor '+anchor);
 }
 const reportPath=path.join(root,'docs/pc-emulator-downloads.json');let files=0,bytes=0;
 if(fs.existsSync(reportPath)){
  const report=JSON.parse(fs.readFileSync(reportPath));
  const privateReport=JSON.parse(fs.readFileSync(path.join(root,'docs/pc-emulators-private-inventory.json')));
  for(const f of report.files){
   assert(f.appId!=='eden-ns2','Source-only project has binary');assert(f.version&&f.sourceUrl&&/^[a-f0-9]{64}$/.test(f.sha256));
   const archived=privateReport.items.flatMap(i=>i.files||[]).find(a=>a.sha256===f.sha256&&a.name===f.name);assert(archived,'Missing scoped archive record '+f.name);
   const actual=await hashFile(archived.backupPath);assert.equal(actual.bytes,f.bytes);assert.equal(actual.sha256,f.sha256);
   if(f.local){const mirror=await hashFile(path.join(root,f.local));assert.equal(mirror.bytes,f.bytes);assert.equal(mirror.sha256,f.sha256);}
   files++;bytes+=f.bytes;
  }
 }
 const result={verifiedAt:new Date().toISOString(),uniqueEntries:ids.size,pages:pages.length,renderedCards,archivedFiles:files,archivedBytes:bytes,result:'pass',execution:'No downloaded executable or console payload was run; file hashes, formats and page structure checked.'};
 fs.mkdirSync(path.join(root,'docs/qa'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/pc-emulators-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
if(require.main===module)verify().catch(e=>{console.error(e.stack);process.exitCode=1});
module.exports={verify};
