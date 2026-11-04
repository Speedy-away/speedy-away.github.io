const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspect}=require('./xbox-one-series-packages.cjs');
const root=path.resolve(__dirname,'..');
const data=require('../docs/xbox-one-series-catalogue.json');
const html=fs.readFileSync(path.join(root,'console/xbox-one-series.html'),'utf8');
const files=[...new Map([...data.apps.flatMap(a=>a.files),...data.frameworks].map(f=>[f.local,f])).values()];
const errors=[],checks=[];
const check=(condition,text)=>{checks.push({passed:!!condition,text});if(!condition)errors.push(text)};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const compare=(a,b)=>{const av=a.split('.').map(Number),bv=b.split('.').map(Number);for(let i=0;i<4;i++){if((av[i]||0)!==(bv[i]||0))return (av[i]||0)-(bv[i]||0)}return 0};
const frameworks=data.frameworks.flatMap(f=>f.packages.filter(p=>p.framework&&p.identity.ProcessorArchitecture==='x64'));
check(data.apps.length>=6,'At least six native Xbox apps');
for(const file of files){
  const bytes=fs.readFileSync(path.join(root,file.local));
  check(bytes.length===file.bytes&&hash(bytes)===file.sha256,'Local bytes and SHA-256: '+file.name+' ('+file.appId+')');
  const packages=inspect(bytes,file.name);
  check(packages.some(p=>p.identity.ProcessorArchitecture==='x64'),'Contains x64 UWP package: '+file.name);
  for(const pkg of packages.filter(p=>p.executable)){
    check(pkg.identity.ProcessorArchitecture==='x64'&&pkg.targets.some(t=>['Windows.Universal','Windows.Xbox'].includes(t.Name)),'Xbox UWP architecture/device family: '+pkg.identity.Name);
    for(const dep of pkg.dependencies)check(frameworks.some(p=>p.identity.Name===dep.Name&&p.identity.Publisher===dep.Publisher&&compare(p.identity.Version,dep.MinVersion)>=0),'Matching x64 framework/publisher/version: '+pkg.identity.Name+' → '+dep.Name+' ≥ '+dep.MinVersion);
  }
}
const artwork=require('../docs/xbox-one-series-artwork.json');
for(const art of artwork)check(hash(fs.readFileSync(path.join(root,art.image)))===art.sha256,'Unmodified publisher artwork: '+art.appId);
const baselineFile=path.join(root,'docs/qa/xbox-one-series-expansion-baseline.json');
if(fs.existsSync(baselineFile)){
  const baseline=JSON.parse(fs.readFileSync(baselineFile,'utf8'));
  for(const id of baseline.apps)check(data.apps.some(a=>a.id===id),'Existing app preserved: '+id);
  for(const old of baseline.files)check(files.some(f=>f.local===old.local&&f.sha256===old.sha256&&f.bytes===old.bytes&&f.version===old.version&&f.sourceUrl===old.sourceUrl),'Existing pinned file preserved: '+old.name+' ('+old.local+')');
}
const continuationBaseline=path.join(root,'docs/qa/xbox-one-series-third-baseline.json');
if(fs.existsSync(continuationBaseline)){
  const before=JSON.parse(fs.readFileSync(continuationBaseline,'utf8'));
  for(const old of before.files)check(files.some(f=>f.local===old.local&&f.sha256===old.sha256&&f.bytes===old.bytes&&f.version===old.version&&f.sourceUrl===old.sourceUrl),'Previous39-file catalogue tuple preserved: '+old.local);
}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
check(ids.length===new Set(ids).size,'No duplicate HTML IDs');
let localLinks=0;
for(const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){
  const url=new URL(m[1].replaceAll('&amp;','&'),'https://whatwhatboy.com/console/xbox-one-series.html');
  if(url.origin!=='https://whatwhatboy.com')continue;
  if(url.pathname==='/console/xbox-one-series.html'&&url.hash){check(ids.includes(decodeURIComponent(url.hash.slice(1))),'Page anchor: '+url.hash);continue}
  let file=path.join(root,decodeURIComponent(url.pathname));
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  check(fs.existsSync(file),'Local link/asset: '+url.pathname);localLinks++;
}
check(!/F:[\\/]|tmp[\\/]xbox-one-series/.test(html+JSON.stringify(data)),'No private archive or staging paths in public page/catalogue');
check(!/<video\b|youtube(?:-nocookie)?\.com\/embed|youtu\.be/i.test(html),'No added videos');
check(/languages\/i18n\.js\?v=3/.test(html)&&/assets\/mobile\.css\?/.test(html)&&/assets\/site-background\.js\?v=2/.test(html),'Language, mobile and shared background integration');
const inventory=JSON.parse(fs.readFileSync(path.join(root,'docs/xbox-one-series-private-inventory.json'),'utf8'));
const archived=inventory.items.flatMap(i=>i.files||[]);
for(const file of files){const records=archived.filter(f=>f.sha256===file.sha256&&f.sourceUrl===file.sourceUrl&&f.name===file.name);check(records.length>0,'Scoped archive provenance: '+file.name);for(const record of records)check(hash(fs.readFileSync(record.backupPath))===file.sha256,'F: archive SHA-256: '+file.name)}
const report={reviewed:'2026-11-02',passed:errors.length===0,apps:data.apps.length,files:files.length,bytes:files.reduce((s,f)=>s+f.bytes,0),artwork:artwork.length,localLinks,checks:checks.length,errors,hardwareTested:false,downloadedBuildsExecuted:false};
fs.mkdirSync(path.join(root,'docs/qa'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/xbox-one-series-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
