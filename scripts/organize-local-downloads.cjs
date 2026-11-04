const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {layoutFor,safeName}=require('./download-archive-layout.cjs');
const root=path.resolve(__dirname,'..');
const reportPath=path.join(root,'docs/download-audit.json');
const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
const backup=path.resolve(report.backupRoot);
if(backup!==path.resolve('F:/whatsite-backup-downloads-etc'))throw Error('Unexpected backup root');
const apply=process.argv.includes('--apply');
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
function within(file){const absolute=path.resolve(file),relative=path.relative(backup,absolute);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Path outside backup: '+absolute);return absolute;}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
const existingPath=path.join(backup,'existing-site-files.json');
const existing=fs.existsSync(existingPath)?readJson(existingPath):{files:[]};
// Recover recorded locations after an interrupted organization without moving
// or deleting a second copy of an already completed file.
const historyRoot=path.join(backup,'archive-history');
const recovered=new Map();
if(fs.existsSync(historyRoot))for(const entry of fs.readdirSync(historyRoot,{withFileTypes:true})){
 if(!entry.isDirectory())continue;const journal=path.join(historyRoot,entry.name,'moves.json');
 if(!fs.existsSync(journal))continue;for(const move of readJson(journal).moves||[]){within(move.from);within(move.to);if(!fs.existsSync(move.from)&&fs.existsSync(move.to))recovered.set(path.resolve(move.from).toLowerCase(),move.to);}
}
for(const item of report.items)for(const file of item.files){if(recovered.has(path.resolve(file.backupPath).toLowerCase()))file.backupPath=recovered.get(path.resolve(file.backupPath).toLowerCase());}
for(const file of existing.files){if(recovered.has(path.resolve(file.backupPath).toLowerCase()))file.backupPath=recovered.get(path.resolve(file.backupPath).toLowerCase());}
const resources=readJson(path.join(root,'docs/ps4-bo3-resources.json')).resources;
for(const [manifest,game,page] of [
 ['downloads/ps4/GTA5/manifest.json','GTA5','console/mods/ps4/gta5/index.html'],
 ['downloads/ps4/BO3/manifest.json','BO3','console/mods/ps4/call-of-duty/black-ops-3/index.html']
]){
 for(const file of readJson(path.join(root,manifest)).files){
  if(file.status!=='downloaded')continue;
  let item=report.items.find(i=>i.url===file.source);
  if(item?.files.some(f=>f.sha256===file.sha256&&f.name===file.filename))continue;
  const original=existing.files.find(f=>f.sitePath===file.local.slice(1));if(!original||!fs.existsSync(original.backupPath))throw Error('Missing initial backup: '+file.filename);
  const meta=game==='BO3'?resources.find(r=>r.id===file.resource):null;
  if(!item){item={id:'local-'+crypto.createHash('sha256').update(file.source).digest('hex').slice(0,12),url:file.source,kind:'local-console-file',title:file.name||meta?.name||file.filename,pages:[page],labels:['Download'],status:'downloaded',files:[],gameVersion:game==='GTA5'?file.group:undefined,mode:meta?.group};report.items.push(item);}
  item.files.push({name:file.filename,bytes:file.bytes,sha256:file.sha256,local:file.local,backupPath:original.backupPath});
 }
}
for(const legacy of existing.files.filter(f=>/scooby\/.+\.dll$|scooby\/WINMM\.dll$/i.test(f.sitePath))){
 const url='https://whatwhatboy.com/'+legacy.sitePath;if(report.items.some(i=>i.url===url))continue;
 const name=path.basename(legacy.sitePath),bytes=fs.readFileSync(legacy.backupPath);
 report.items.push({id:'local-'+crypto.createHash('sha256').update(url).digest('hex').slice(0,12),url,kind:'existing-site-file',title:legacy.sitePath.includes('/FSL/')?'FSL existing site file':'Scooby existing site file',pages:[legacy.sitePath],labels:['Existing site file'],status:'downloaded',files:[{name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),backupPath:legacy.backupPath,local:'/'+legacy.sitePath}]});
}
// Supply explicit mode data for the BO3 archives; filenames alone can be ambiguous.
for(const item of report.items){const bo3=resources.find(r=>r.downloads.some(f=>f.url===item.url));if(bo3){item.mode=bo3.group;}}
const filesRoot=path.join(backup,'files');
const oldTop=fs.readdirSync(filesRoot,{withFileTypes:true}).filter(e=>e.isDirectory()&&/-[a-f0-9]{12}$/i.test(e.name)).map(e=>path.join(filesRoot,e.name));
const moves=new Map(),taken=new Set();
for(const item of report.items)for(const file of item.files){
 const from=within(file.backupPath);if(!fs.existsSync(from))throw Error('Missing saved file: '+from);
 if(!file.archivedAt)file.archivedAt=fs.statSync(from).mtime.toISOString();
 let to=moves.get(from.toLowerCase())?.to;
 if(!to){
  const folder=within(path.join(filesRoot,...layoutFor(item,file)));
  let filename=safeName(file.name),candidate=within(path.join(folder,filename)),copy=2;
  while((fs.existsSync(candidate)&&candidate.toLowerCase()!==from.toLowerCase())||taken.has(candidate.toLowerCase())){
   const ext=path.extname(filename),stem=filename.slice(0,filename.length-ext.length);candidate=within(path.join(folder,stem+' (copy '+copy+++')'+ext));
  }
  to=candidate;moves.set(from.toLowerCase(),{from,to,bytes:file.bytes});taken.add(to.toLowerCase());
 }
 if(to.toLowerCase()!==from.toLowerCase()){file.previousBackupPaths=[...new Set([...(file.previousBackupPaths||[]),from])];}
 file.backupPath=to;
 const record=existing.files.find(e=>path.resolve(e.backupPath).toLowerCase()===from.toLowerCase());if(record)record.backupPath=to;
}
const actual=[...moves.values()].filter(m=>m.from.toLowerCase()!==m.to.toLowerCase());
const plan={backupRoot:backup,moves:actual,platforms:{}};
for(const item of report.items)for(const file of item.files){const platform=layoutFor(item,file)[0];plan.platforms[platform]=(plan.platforms[platform]||0)+1;}
fs.writeFileSync(path.join(root,'docs/download-organization-plan.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({filesToMove:actual.length,platforms:plan.platforms},null,2));
if(!apply){console.log('Preview only. Run with --apply to organize, preserving every file.');process.exit(0);}
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const history=within(path.join(backup,'archive-history',stamp));fs.mkdirSync(history,{recursive:true});
for(const name of ['download-inventory.json','existing-site-files.json','index.html','README.txt','CHECKSUMS.sha256','unavailable-downloads.csv']){const file=path.join(backup,name);if(fs.existsSync(file))fs.copyFileSync(file,path.join(history,name));}
fs.copyFileSync(reportPath,path.join(history,'workspace-inventory.json'));
const journal=path.join(history,'moves.json');fs.writeFileSync(journal,JSON.stringify({status:'in-progress',moves:actual},null,2)+'\n');
let count=0;
for(const move of actual){
 const from=within(move.from),to=within(move.to);
 if(!fs.statSync(from).isFile())throw Error('Expected individual file: '+from);
 if(fs.existsSync(to))throw Error('Refusing to replace an existing file: '+to);
 fs.mkdirSync(path.dirname(to),{recursive:true});fs.renameSync(from,to);count++;
 if(count%50===0)console.log('Organized '+count+'/'+actual.length+' files.');
}
// Preserve empty old resource folders in history rather than deleting them.
for(const folder of oldTop){within(folder);if(fs.existsSync(folder)&&fs.readdirSync(folder).length===0){const dest=within(path.join(history,'previous-folder-names',path.basename(folder)));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.renameSync(folder,dest);}}
for(const item of report.items)for(const file of item.files){if(!fs.existsSync(file.backupPath)||fs.statSync(file.backupPath).size!==file.bytes)throw Error('Organized file validation failed: '+file.backupPath);}
report.updated=new Date().toISOString();report.layout='Platform / Category / Project / Builds, Source Code, Helpers or Metadata / Version';
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(backup,'download-inventory.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(existingPath,JSON.stringify(existing,null,2)+'\n');
fs.writeFileSync(journal,JSON.stringify({status:'complete',moves:actual},null,2)+'\n');
const unique=[...new Map(report.items.flatMap(i=>i.files).map(f=>[f.backupPath,f])).values()];
fs.writeFileSync(path.join(backup,'CHECKSUMS.sha256'),unique.map(f=>f.sha256+'  '+path.relative(backup,f.backupPath).replaceAll('\\','/')).join('\n')+'\n');
const pending=report.items.filter(i=>!['downloaded','excluded','reference'].includes(i.status));
const csv=s=>'"'+String(s??'').replaceAll('"','""')+'"';
fs.writeFileSync(path.join(backup,'unavailable-downloads.csv'),'Title,URL,Status,Reason\r\n'+pending.map(i=>[i.title,i.url,i.status,i.error||i.reason].map(csv).join(',')).join('\r\n')+'\r\n');
const groups=new Map();for(const item of report.items)for(const file of item.files){const category=layoutFor(item,file)[0];if(!groups.has(category))groups.set(category,[]);groups.get(category).push({item,file});}
const sections=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([platform,entries])=>`<section id="${esc(platform.replaceAll(' ','-'))}"><h2>${esc(platform)} · ${entries.length} files</h2><table><thead><tr><th>Resource</th><th>Local file</th><th>Folder</th></tr></thead><tbody>${entries.sort((a,b)=>a.file.backupPath.localeCompare(b.file.backupPath)).map(({item,file})=>{const rel=path.relative(backup,file.backupPath).replaceAll('\\','/');return `<tr><td>${esc(item.title)}</td><td><a href="${esc(rel.split('/').map(encodeURIComponent).join('/'))}" download>${esc(file.name)}</a><br>${(file.bytes/1048576).toFixed(1)} MiB</td><td>${esc(path.dirname(rel))}</td></tr>`;}).join('')}</tbody></table></section>`).join('');
fs.writeFileSync(path.join(backup,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><title>Organized local downloads</title><style>body{font:16px system-ui;margin:32px;background:#101214;color:#eee}a{color:#6fe4bb}nav{display:flex;gap:20px;flex-wrap:wrap}table{border-collapse:collapse;width:100%;margin-bottom:36px}th,td{padding:12px;border:1px solid #444;text-align:left;overflow-wrap:anywhere}td:last-child{font-size:13px;color:#aaa}</style><h1>Organized local downloads</h1><p>${unique.length} files · ${(unique.reduce((s,f)=>s+f.bytes,0)/1e9).toFixed(2)} GB. All existing downloads and versions preserved.</p><nav>${[...groups.keys()].sort().map(p=>`<a href="#${esc(p.replaceAll(' ','-'))}">${esc(p)}</a>`).join('')}</nav><p>Updates: ask for “check and download the latest local console updates”. See README.txt and unavailable-downloads.csv for details.</p>${sections}</html>`);
fs.writeFileSync(path.join(backup,'README.txt'),`Organized local download archive\nUpdated: ${report.updated}\n\n${unique.length} saved files. All existing files and versions retained; nothing deleted.\n\nfiles/: platform, game/tool, then Builds, Source Code, Helpers or Metadata and version\narchive-history/: earlier inventories, move journal and previous empty folder names\nsite/: saved website copy\ndownload-inventory.json / CHECKSUMS.sha256: current file locations and checksums\nunavailable-downloads.csv: original links that still need manual retrieval\n\nWhen adding new downloadable site content, save the relevant artifact locally. Do not clone GitHub repositories unless source code is specifically requested. Bstlar remains skipped.\n\nAsk: check and download the latest local console updates\nCheck: node scripts/update-local-downloads.cjs --check\nDownload new releases: node scripts/update-local-downloads.cjs --download\nOrganize and refresh this index: node scripts/organize-local-downloads.cjs --apply\n\nNo downloaded payload was executed. Updates are on demand, not scheduled. Firmware/game images are not part of this archive workflow.\n`);
console.log('Organized '+count+' files; '+unique.length+' saved files retained. No files deleted.');
