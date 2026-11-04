const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {hashFile}=require('./console-expansion-archive.cjs');
const root=path.resolve(__dirname,'..'),preview=process.env.WII_PREVIEW_BASE||'http://127.0.0.1:8765';
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
async function main(){
 const entries=read('docs/wii-games-online-catalog.json').entries,inventory=read('docs/wii-games-online-private-inventory.json');
 const packages=read('docs/wii-games-online-package-verification.json').records;
 if(process.argv.includes('--require-ready'))assert(entries.every(x=>x.status==='ready'&&x.file),'A requested package is not fully archived yet');
 const report={checkedAt:new Date().toISOString(),entries:entries.length,verifiedFiles:[],localLinks:0,brokenLocalLinks:[],externalLinks:[],payloadsExecuted:false,physicalHardwareTested:false};
 for(const entry of entries.filter(x=>x.file)){
  const f=entry.file,item=inventory.items.find(x=>x.id==='wii-games-online-'+entry.id);assert(item);
  const archived=item.files.find(x=>x.sha256===f.sha256&&x.version===f.version&&x.name===f.name);assert(archived);
  const actual=await hashFile(archived.backupPath);assert(actual.bytes===f.bytes&&actual.sha256===f.sha256,'Archived file mismatch: '+entry.id);
  const checked=packages.find(x=>x.id===entry.id);assert(checked&&checked.sha256===f.sha256&&checked.bytes===f.bytes);
  if(entry.kind==='windows-helper')assert(checked.format==='PE x64 · Windows helper');else assert(checked.crcPassed);
  let httpMatched=false;
  if(f.local){const actual=await hashFile(path.join(root,f.local));assert(actual.bytes===f.bytes&&actual.sha256===f.sha256);if(process.argv.includes('--http')){const r=await fetch(preview+f.local,{signal:AbortSignal.timeout(45000)});assert(r.ok);const crypto=require('node:crypto'),hash=crypto.createHash('sha256');let bytes=0;for await(const chunk of r.body){bytes+=chunk.length;hash.update(chunk);}assert(bytes===f.bytes&&hash.digest('hex')===f.sha256);httpMatched=true;}}
  report.verifiedFiles.push({id:entry.id,bytes:f.bytes,sha256:f.sha256,version:f.version,archiveVerified:true,httpMatched});console.log('Verified '+entry.id);
 }
 for(const image of read('docs/wii-games-online-art.json').images){const actual=await hashFile(path.join(root,image.path));assert(actual.sha256===image.sha256&&actual.bytes===image.bytes);const item=inventory.items.find(x=>x.files?.some(f=>f.sha256===image.sha256));assert(item);const file=item.files.find(f=>f.sha256===image.sha256);assert((await hashFile(file.backupPath)).sha256===image.sha256);}
 const pages=['console/retro/wii.html',...['game-mods','mario-kart-wii','new-super-mario-bros-wii','online'].map(x=>'console/retro/wii/'+x+'.html')];const external=new Set();
 for(const page of pages){const html=fs.readFileSync(path.join(root,page),'utf8');assert(html.includes('/languages/i18n.js?v=3')&&html.includes('/assets/site-background.js?v=2'));assert.equal((html.match(/\/assets\/mobile\.css\?/g)||[]).length,1);assert(!/<video\b|youtube(?:-nocookie)?\.com\/embed/.test(html));
  for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){const url=match[1].replaceAll('&amp;','&');if(url.startsWith('/')&&!url.startsWith('//')){const pathname=decodeURIComponent(new URL(url,'https://whatwhatboy.com').pathname);let file=path.join(root,pathname);if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');report.localLinks++;if(!fs.existsSync(file))report.brokenLocalLinks.push({page,url});}else if(url.startsWith('https:'))external.add(url);}
 }
 assert(!report.brokenLocalLinks.length,'A local page/asset link is missing');
 const online=fs.readFileSync(path.join(root,'console/retro/wii/online.html'),'utf8');for(const url of ['https://wiimmfi.de/patcher/dnspatch','https://wiimmfi.de/patcher/disc'])assert(online.includes('href="'+url+'"'));assert(!online.includes('dnspatchhttps'));
 const old=read('docs/wii-more-catalog.json').apps;const hub=fs.readFileSync(path.join(root,'console/retro/wii.html'),'utf8');for(const app of old)assert(hub.includes(app.package.local));
 if(process.argv.includes('--links')){const sources=[...new Set(entries.flatMap(x=>[x.source,...(x.extraSources||[]).map(a=>a[0])]).concat(['https://wiimmfi.de/patcher/dnspatch','https://wiimmfi.de/patcher/disc']))];for(let i=0;i<sources.length;i+=6)await Promise.all(sources.slice(i,i+6).map(async url=>{try{const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(20000)});await r.body?.cancel();report.externalLinks.push({url,status:r.status,accessible:r.ok});}catch(e){report.externalLinks.push({url,accessible:false,error:e.message});}}));}
 fs.writeFileSync(path.join(root,'docs/wii-games-online-verification.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({entries:entries.length,verifiedFiles:report.verifiedFiles.length,localLinks:report.localLinks,brokenLocalLinks:report.brokenLocalLinks.length,httpMatches:report.verifiedFiles.filter(x=>x.httpMatched).length,externalChecked:report.externalLinks.length,inaccessibleSources:report.externalLinks.filter(x=>!x.accessible)},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
