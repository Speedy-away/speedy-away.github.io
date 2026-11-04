const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const problems=[],check=(ok,message)=>{if(!ok)problems.push(message);};
async function main(){
  const catalogue=JSON.parse(read('docs/ps2-expansion-catalogue.json')),verified=JSON.parse(read('docs/ps2-expansion-files.json'));
  const inventory=JSON.parse(read('docs/ps2-expansion-private-inventory.json'));
  const globalInventory=JSON.parse(read('docs/download-audit.json'));
  const html=read('console/retro/ps2.html');
  const ids=[...html.matchAll(/\bid="([^"]*)"/g)].map(m=>m[1]);
  check(ids.length===new Set(ids).size,'Duplicate HTML IDs');
  check(catalogue.items.length>=10,'Fewer than ten additional resources');
  const originals=JSON.parse(read('docs/expansion-ps2.json')).tools;
  const originalJobs=JSON.parse(read('docs/expansion-ps2-jobs.json')).jobs;
  for(const old of originals){check(ids.includes(old.id),'Missing original anchor '+old.id);check(html.includes(old.version),'Missing original pin '+old.id);}
  for(const old of originalJobs)check(html.includes(old.url),'Missing original download '+old.id);
  check(html.includes('/languages/i18n.js?v=3'),'Language runtime missing');
  check(html.includes('/assets/site-background.js?v=2')&&html.includes('site-atmosphere'),'Background integration missing');
  check(/\/assets\/mobile\.css\?v=[0-9.]+/.test(html),'Mobile integration missing');
  check(read('assets/ps2-expansion.js').includes('__scoobyI18n?.t'),'Dynamic translation helper missing');
  check(!/<(?:video|iframe)\b|youtube(?:-nocookie)?\.com\/embed/i.test(html),'Video embedded');
  check(html.includes('https://whatwhatboy.com/console/retro/ps2.html'),'Canonical URL missing');
  let files=0,mirrors=0,totalBytes=0,httpFiles=0;
  for(const item of catalogue.items){
    const record=verified.items.find(r=>r.id===item.id),privateItem=inventory.items.find(r=>r.id==='ps2-expansion-'+item.id),globalItem=globalInventory.items.find(r=>r.id==='ps2-expansion-'+item.id);
    check(record&&privateItem&&globalItem,'Missing verified/scoped/global record '+item.id);if(!record)continue;
    check(ids.includes(item.id),'Missing card '+item.id);
    for(const f of record.files){
      files++;totalBytes+=f.bytes;
      check(f.sourceUrl.startsWith('https://')&&f.version&&f.sha256.length===64,'Incomplete file metadata '+f.name);
      const archived=privateItem?.files.find(a=>a.sha256===f.sha256&&a.bytes===f.bytes),merged=globalItem?.files.find(a=>a.sha256===f.sha256&&a.bytes===f.bytes);
      check(archived&&merged,'File absent from inventory '+f.name);
      if(archived){check(fs.existsSync(archived.backupPath),'Missing F file '+f.name);if(fs.existsSync(archived.backupPath)){const b=fs.readFileSync(archived.backupPath);check(b.length===f.bytes&&hash(b)===f.sha256,'F hash mismatch '+f.name);}}
      check(f.format!=='ZIP'||f.elfs.length>0||item.category==='Themes','ZIP has no ELF/theme '+f.name);
      for(const e of f.elfs)check(e.machine==='MIPS'&&e.class==='ELF32'&&e.endian==='little','Bad PS2 ELF '+e.path);
      if(f.local){mirrors++;const p=path.join(root,decodeURIComponent(f.local));check(fs.existsSync(p),'Missing mirror '+f.local);if(fs.existsSync(p)){const b=fs.readFileSync(p);check(b.length===f.bytes&&hash(b)===f.sha256,'Mirror hash mismatch '+f.local);}
        if(process.argv.includes('--http')){const response=await fetch('http://127.0.0.1:8765'+f.local),bytes=Buffer.from(await response.arrayBuffer());check(response.ok&&bytes.length===f.bytes&&hash(bytes)===f.sha256,'HTTP download mismatch '+f.name);httpFiles++;}
      }
    }
  }
  for(const m of html.matchAll(/\b(?:href|src)="([^"]*)"/g)){
    const value=m[1].replaceAll('&amp;','&');if(!value||value==='#'||/^(?:https?:|mailto:|data:|javascript:)/i.test(value))continue;
    const u=new URL(value,'https://whatwhatboy.com/console/retro/ps2.html');let p=path.join(root,decodeURIComponent(u.pathname));if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');check(fs.existsSync(p),'Missing local target '+value);if(fs.existsSync(p)&&p.endsWith('.html')&&u.hash)check(fs.readFileSync(p,'utf8').includes('id="'+decodeURIComponent(u.hash.slice(1))+'"'),'Missing target anchor '+value);
  }
  const theme=catalogue.items.filter(i=>i.category==='Themes');check(theme.every(i=>i.requires.includes('1.2')&&i.requires.includes('1.1.0')),'Theme compatibility unclear');
  check(!verified.items.find(i=>i.id==='picodrive').files.some(f=>f.local),'PicoDrive upstream-only public routing changed');
  const report={checkedAt:new Date().toISOString(),passed:!problems.length,originalResources:originals.length,additionalResources:catalogue.items.length,files,mirrors,totalBytes,httpFiles,problems,limits:['No downloaded binary executed','No physical PS2 installation or gameplay test','No commit, publication or deployment']};
  fs.writeFileSync(path.join(root,'docs/qa/ps2-expansion-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));process.exitCode=problems.length?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
