// Read-only preservation, native-format, site/F: hash and local HTTP checks.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const catalog=read('docs/ds-dsi-more-catalog.json'),data=read('docs/ds-dsi-more-downloads.json'),baseline=read('docs/ds-dsi-more-preserved-sections.json'),sidecar=read('docs/ds-dsi-more-private-inventory.json');
 const html=fs.readFileSync(path.join(root,'console/retro/ds.html'),'utf8');
 const report={checkedAt:new Date().toISOString(),page:'console/retro/ds.html',nativeResources:0,skins:0,files:0,archivePathsChecked:0,artwork:0,preservedLinks:0,localLinks:0,httpFiles:0,bytes:0,headerCrcExceptions:[],hardwareTested:false,downloadedExecutablesRun:false,checks:[]};
 assert.equal(data.attempts.length,0,'Unresolved acquisition attempts');
 const files=data.entries.flatMap(e=>e.files),archived=sidecar.items.flatMap(e=>e.files||[]);
 for(const app of catalog.entries){assert(html.includes(`id="${app.id}"`),'Missing card '+app.id);if(app.group==='skins')report.skins++;else report.nativeResources++;}
 for(const file of files){
  const bytes=fs.readFileSync(path.join(root,file.local));assert.equal(bytes.length,file.bytes);assert.equal(hash(bytes),file.sha256);assert(file.archived);
  assert(!/\.(?:cia|exe|3dsx)$/i.test(file.name),'Unexpected standalone non-native file');
  const matches=archived.filter(f=>f.local===file.local&&f.sha256===file.sha256);assert(matches.length,'No matching F: record '+file.local);
  for(const f of matches){const backup=fs.readFileSync(f.backupPath);assert.equal(backup.length,file.bytes);assert.equal(hash(backup),file.sha256);report.archivePathsChecked++;}
  for(const n of file.native){assert(n.regions.every(r=>r.offset>=0x200&&r.offset+r.bytes<=n.bytes));if(!n.headerCrcValid)report.headerCrcExceptions.push({file:file.name,native:n.name});}
  report.files++;report.bytes+=file.bytes;
 }
 assert.equal(report.files,catalog.entries.reduce((sum,e)=>sum+e.files.length,0));assert(report.skins>=3);assert(report.nativeResources>=12);
 for(const app of catalog.entries)for(const expected of app.files)assert(files.some(f=>f.name===expected.name&&f.sourceUrl===expected.url&&f.archived),'Missing configured variant '+expected.name);
 for(const app of catalog.entries)for(const expected of app.files.filter(f=>f.kind==='data')){
  const actual=files.find(f=>f.name===expected.name&&f.sourceUrl===expected.url);
  const contents=actual.contents.map(p=>p.replaceAll('\\','/'));
  for(const required of expected.requiredContents)assert(contents.includes(required),'Missing required ready data '+required);
 }
 for(const art of data.artwork){assert.equal(hash(fs.readFileSync(path.join(root,art.local))),art.sha256);assert(art.credit&&art.sourceUrl);assert(html.includes(art.local));report.artwork++;}assert.equal(report.artwork,catalog.entries.length);
 const expandedBaselinePath=path.join(root,'docs/qa/ds-dsi-more-batch2-baseline.json');
 if(fs.existsSync(expandedBaselinePath)){
  const old=JSON.parse(fs.readFileSync(expandedBaselinePath));
  for(const id of old.catalogueIds)assert(catalog.entries.some(e=>e.id===id),'Lost earlier catalogue ID '+id);
  for(const f of old.files)assert(files.some(n=>n.local===f.local&&n.sha256===f.sha256&&n.sourceUrl===f.sourceUrl&&n.bytes===f.bytes),'Lost earlier ready file '+f.local);
  for(const href of old.links)assert(html.includes(`href="${href}"`),'Lost earlier page link '+href);
  report.earlierBatchFilesPreserved=old.files.length;
 }
 const batch3BaselinePath=path.join(root,'docs/qa/ds-dsi-more-batch3-baseline.json');
 if(fs.existsSync(batch3BaselinePath)){
  const old=JSON.parse(fs.readFileSync(batch3BaselinePath));
  for(const e of old.catalogue)assert.deepEqual(catalog.entries.find(n=>n.id===e.id),e,'Changed earlier catalogue row '+e.id);
  for(const f of old.files)assert(files.some(n=>n.local===f.local&&n.sha256===f.sha256&&n.sourceUrl===f.sourceUrl&&n.bytes===f.bytes),'Lost earlier batch file '+f.local);
  for(const a of old.artwork)assert.deepEqual(data.artwork.find(n=>n.id===a.id),a,'Changed earlier artwork '+a.id);
  report.previousFilesPreserved=old.files.length;report.previousCatalogueRowsPreserved=old.catalogue.length;
 }
 const preserved=new Set(baseline.sections.flatMap(s=>[...s.html.matchAll(/href="([^"]+)"/g)].map(m=>m[1])));
 for(const href of preserved){assert(html.includes(`href="${href}"`),'Lost original link '+href);report.preservedLinks++;}
 for(const name of ['mobile.css','mobile-downloads.css','site-background.css','site-background.js','languages/i18n.js?v=3'])assert.equal(html.split(name).length-1,1,'Expected integration singleton '+name);
 assert(!/<video\b|<iframe\b/i.test(html),'Unexpected video/iframe');assert(!/F:[\\/]|C:[\\/]Users/i.test(html),'Machine path exposed');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'Duplicate HTML id');
 for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  const href=m[1].replaceAll('&amp;','&');if(/^(?:https?:|mailto:|data:|javascript:)/.test(href))continue;
  const url=new URL(href,'http://127.0.0.1:8765/console/retro/ds.html');
  if(url.pathname==='/console/retro/ds.html'&&url.hash)assert(ids.includes(decodeURIComponent(url.hash.slice(1))),'Missing anchor '+href);
  let local=path.join(root,decodeURIComponent(url.pathname));if(fs.existsSync(local)&&fs.statSync(local).isDirectory())local=path.join(local,'index.html');assert(fs.existsSync(local),'Missing local file '+href);report.localLinks++;
 }
 report.checks.push(`${report.files} site files and matching scoped F: copies have identical sizes and SHA-256`,`${report.artwork} credited project artworks present`,'All original section links preserved','No standalone CIA/EXE/3DSX among added downloads; original ready bundles preserved','Native ARM7/ARM9 regions bounded; container integrity checked during preparation','Shared mobile/background/i18n integration retained; no duplicate IDs or videos');
 if(process.argv.includes('--http')){
  const base=process.argv.find(a=>a.startsWith('--base='))?.slice(7)||'http://127.0.0.1:8765';
  assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(base),'Preview must be local');report.preview=base;
  const response=await fetch(base+'/console/retro/ds.html');assert(response.ok);assert((await response.text()).includes('data-ds-library'));
  for(const file of files){const r=await fetch(base+encodeURI(file.local));assert(r.ok,'HTTP failed '+file.local);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(hash(bytes),file.sha256);report.httpFiles++;}
  report.checks.push(`Local preview and ${report.httpFiles} actual download responses returned expected bytes`);
 }
 report.passed=true;fs.mkdirSync(path.join(root,'docs/qa'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/ds-dsi-more-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
