const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const preview=process.env.WII_PREVIEW_BASE || 'http://127.0.0.1:8765';
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function main(){
 const apps=read('docs/wii-more-catalog.json').apps, inventory=read('docs/wii-more-private-inventory.json'),packages=read('docs/wii-more-package-verification.json').apps;
 const html=fs.readFileSync(path.join(root,'console/retro/wii.html'),'utf8'),base=fs.readFileSync(path.join(root,'docs/wii-more-base-content.html'),'utf8');
 const report={checkedAt:new Date().toISOString(),apps:apps.length,files:[],localLinks:[],externalLinks:[],preservedURLs:0,payloadsExecuted:false,hardwareTested:false,failures:[]};
 assert.equal(apps.length,12);
 for(const app of apps){
  const item=inventory.items.find(x=>x.id==='wii-more-'+app.id),f=app.package;
  assert(item,'Private archive record missing');
  const archived=item.files.find(x=>x.sha256===f.sha256&&x.version===f.version&&x.bytes===f.bytes);
  assert(archived,'Archive version/hash mismatch');
  const publicBytes=fs.readFileSync(path.join(root,f.local)),backup=fs.readFileSync(archived.backupPath);
  assert.equal(publicBytes.length,f.bytes);assert.equal(backup.length,f.bytes);assert.equal(hash(publicBytes),f.sha256);assert.equal(hash(backup),f.sha256);
  const inspected=packages.find(x=>x.slug===app.id&&x.sha256===f.sha256);
  assert(inspected?.crcPassed);assert(inspected.nativeFiles.length);assert.equal('/'+inspected.bootPath,app.bootPath);assert.equal(inspected.metaVersion,app.version);
  assert.equal(hash(fs.readFileSync(path.join(root,app.image.path))),app.image.sha256);
  assert(html.includes(f.local)&&html.includes(f.sha256));
  if(['cavestory','helium'].includes(app.id)){assert(!app.supportedPlatforms.includes('wii_mini'));assert(app.compatibilityNote);}
  const row={id:app.id,version:app.version,bytes:f.bytes,sha256:f.sha256,archiveMatches:true,publicMatches:true,format:app.format,bootPath:app.bootPath};
  if(process.argv.includes('--http')){
   const response=await fetch(preview+f.local,{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);
   const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,f.bytes);assert.equal(hash(bytes),f.sha256);row.httpMatches=true;
  }
  report.files.push(row);
 }
 const attrs=text=>[...text.matchAll(/(?:href|src)="([^"]+)"/g)].map(x=>x[1].replaceAll('&amp;','&'));
 const urls=new Set(attrs(html));
 for(const url of new Set(attrs(base))){assert(urls.has(url),'Preserved original URL missing: '+url);report.preservedURLs++;}
 for(const url of urls){
  if(!url.startsWith('/')||url.startsWith('//'))continue;
  const pathname=new URL(url,'https://whatwhatboy.com').pathname;
  let local=path.join(root,decodeURIComponent(pathname));
  if(fs.existsSync(local)&&fs.statSync(local).isDirectory())local=path.join(local,'index.html');
  assert(fs.existsSync(local),'Local link missing: '+url);report.localLinks.push(url);
 }
 assert.equal((html.match(/\/assets\/mobile\.css\?/g)||[]).length,1);assert(html.includes('/languages/i18n.js?v=3'));assert(html.includes('/assets/site-background.js?v=2'));
 assert(!/<video\b|youtube(?:-nocookie)?\.com\/embed/i.test(html));
 if(process.argv.includes('--links')){
  const sources=[...new Set(apps.flatMap(x=>[x.project,x.documentation,x.sources.distribution,x.sources.manifest,x.package.sourceUrl]).filter(Boolean).concat(['https://wii.hacks.guide/get-started.html','https://wii.hacks.guide/hbc.html','https://wii.hacks.guide/vwii-homebrew-channel']))];
  for(let i=0;i<sources.length;i+=6)await Promise.all(sources.slice(i,i+6).map(async url=>{
   try{const response=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'whatsite-link-check/1.0'}});await response.body?.cancel();report.externalLinks.push({url,status:response.status,resolvedUrl:response.url,accessible:response.ok});}
   catch(e){report.externalLinks.push({url,accessible:false,error:e.message});}
  }));
 }
 fs.writeFileSync(path.join(root,'docs/wii-more-verification.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({apps:apps.length,archiveFilesMatched:report.files.length,httpFilesMatched:report.files.filter(x=>x.httpMatches).length,preservedURLs:report.preservedURLs,localLinks:report.localLinks.length,externalLinks:report.externalLinks.length,inaccessible:report.externalLinks.filter(x=>!x.accessible)},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
