const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const reportPath=path.join(root,'docs/download-audit.json');
const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
const backup=path.resolve(report.backupRoot);
if(backup!==path.resolve('F:/whatsite-backup-downloads-etc'))throw Error('Unexpected backup target');
const safe=s=>s.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,145)||'download';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
async function digest(file){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file,{highWaterMark:8*1024*1024}))hash.update(chunk);return hash.digest('hex');}
function signature(file){
 const fd=fs.openSync(file.backupPath,'r'),head=Buffer.alloc(8);fs.readSync(fd,head,0,8,0);fs.closeSync(fd);
 const tests=[[/\.(?:zip|apk|ipa|vpk)$/i,'504b',2],[/\.rar$/i,'52617221',4],[/\.7z$/i,'377abcaf271c',6],[/\.(?:exe|dll)$/i,'4d5a',2]];
 for(const [pattern,magic,length] of tests)if(pattern.test(file.name)&&head.subarray(0,length).toString('hex')!==magic)throw Error('Invalid archive/executable signature: '+file.backupPath);
}
async function imports(){
 for(const item of report.items){
  if(/^(?:Lakka|Recalbox)$/.test(item.title)){item.status='excluded';item.reason='Operating system distributions outside the selected archive scope';delete item.error;}
  if(item.status==='pending'){item.status='unavailable';item.error='No accessible direct download was retrieved from the public page; original URL retained.';}
  if(item.kind==='bstlar'){item.status='excluded';item.reason='Bstlar downloads explicitly skipped by user';delete item.error;}
  const unrelated=item.files.filter(f=>/norton360/i.test(f.name)&&/afterburner/i.test(item.title));
  for(const file of unrelated){
   const target=path.resolve(file.backupPath);
   if(!target.startsWith(path.join(backup,'files')+path.sep))throw Error('Unexpected unrelated download path');
   if(fs.existsSync(target)&&await digest(target)===file.sha256)fs.unlinkSync(target);
   if(file.local){const local=path.resolve(root,'.'+file.local);if(local.startsWith(path.join(root,'downloads/archive')+path.sep)&&fs.existsSync(local)&&await digest(local)===file.sha256)fs.unlinkSync(local);}
  }
  if(unrelated.length){item.files=item.files.filter(f=>!unrelated.includes(f));item.status=item.files.length?'downloaded':'unavailable';if(item.files.length)delete item.error;else item.error='Public page only exposed an unrelated promotional download; it was excluded.';}
  if(item.kind==='github-source'){const repo=new URL(item.url).pathname.split('/')[2];item.title=decodeURIComponent(repo).replaceAll('-',' ').replaceAll('_',' ')+' source code';}
  else if(item.kind==='github-release'&&/^(?:Source &|Installing|Compatibility|Project documentation|Install |Configure |Canary vs|When to)/i.test(item.title)){item.title=decodeURIComponent(new URL(item.url).pathname.split('/')[2]).replaceAll('-',' ').replaceAll('_',' ');}
  if(item.kind==='website'&&/Cheat Engine 7\.5/.test(item.title)&&item.files.some(f=>/CheatEngine77|CheatEngine-7\.7/i.test(f.name)))item.title='Cheat Engine 7.7';
  if(/ReShade 5\.9/.test(item.title)&&item.files.some(f=>/ReShade_Setup_6\.8\.0/i.test(f.name)))item.title='ReShade 6.8.0';
 }
 for(const name of ['mega-download-imports.json','gofile-download-imports.json']){
  const file=path.join(root,'docs',name);if(!fs.existsSync(file))continue;
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const entry of data.imports||[]){
   const url=entry.url||entry.originalFolderURL;
   const item=report.items.find(i=>i.url===url);if(!item)continue;
   if(entry.status!=='downloaded'){if(!item.files.length&&entry.error){item.status='unavailable';item.error=entry.error;}continue;}
   const source=entry.tempPath||entry.path;if(!source||!fs.existsSync(source))continue;
   const filename=safe(entry.name||entry.filename||path.basename(source));
   const destination=path.join(backup,'files',safe(item.title)+'-'+item.id,filename);
   fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(source,destination);
   const sha256=await digest(destination),bytes=fs.statSync(destination).size;
   const existing=item.files.find(f=>f.name===filename);
   const stored={name:filename,bytes,sha256,backupPath:destination};
   if(existing)Object.assign(existing,stored);else item.files.push(stored);
   item.status='downloaded';delete item.error;
  }
 }
}
function normalizeMirrors(){
 let used=0;
 const previousCatalog=path.join(backup,'existing-site-files/downloads/catalog.json');
 const pinned=new Set(fs.existsSync(previousCatalog)?JSON.parse(fs.readFileSync(previousCatalog,'utf8')).items.flatMap(item=>item.files.filter(file=>file.local).map(file=>decodeURIComponent(file.local))):[]);
 const candidates=report.items.flatMap(item=>item.files.map(file=>({item,file}))).sort((a,b)=>{
  const rank=x=>{
   if(x.file.local&&pinned.has(x.file.local)||pinned.has('/downloads/archive/'+x.item.id+'/'+x.file.name))return -1;
   if(/mediafire|gofile|mega/.test(x.item.kind))return 0;
   if(/symbols|pdbs|\.sha\d*|SHA256SUMS|\.json$|\.zsync$|commits\.txt/i.test(x.file.name))return 8;
   if(/\.(?:lua|gsc|gscc|prx|sprx|dll)$/i.test(x.file.name))return 1;
   if(/linux|macos|mac-|ubuntu|\.dmg$|\.deb$|\.rpm$|\.AppImage$|\.ipa$/i.test(x.file.name))return 7;
   if(/github-source/.test(x.item.kind))return 5;
   if(/win(?:dows)?[-_.]?(?:x64|64)|\.pkg$|\.vpk$|\.elf$|^PPSA|PS5SX2|^cemu|^RetroArch/i.test(x.file.name))return 2;
   return 3;
  };
  return rank(a)-rank(b)||a.file.bytes-b.file.bytes;
 });
 for(const {item,file} of candidates){
  if(!fs.existsSync(file.backupPath))throw Error('Missing backup: '+file.backupPath);
  const old=file.local?path.resolve(root,'.'+file.local):null;
  const oldIsGenerated=old&&old.startsWith(path.join(root,'downloads/archive')+path.sep);
  const eligible=item.status!=='excluded'&&file.bytes<95*1048576&&used+file.bytes<=780*1048576;
  if(eligible){
   const filename=/\.(?:html?|svg)$/i.test(file.name)?file.name+'.txt':file.name;
   const relative='downloads/archive/'+item.id+'/'+filename;
   const destination=path.join(root,relative);
   fs.mkdirSync(path.dirname(destination),{recursive:true});
   if(!fs.existsSync(destination)||fs.statSync(destination).size!==file.bytes)fs.copyFileSync(file.backupPath,destination);
   if(oldIsGenerated&&old!==destination&&fs.existsSync(old))fs.unlinkSync(old);
   file.local='/'+relative;used+=file.bytes;
  }else{
   if(oldIsGenerated&&fs.existsSync(old))fs.unlinkSync(old);
   delete file.local;
  }
 }
 console.log('Site mirrors: '+(used/1048576).toFixed(1)+' MiB. All larger archives remain on F:.');
}
function rewriteLinks(){
 const skip=new Set(['.git','.agents','.codex','.claude','.playwright','node_modules','assets','docs','downloads','languages','i18n-tools','design-references']);
 function htmlFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(skip.has(e.name)?[]:htmlFiles(path.join(dir,e.name))):e.name.endsWith('.html')?[path.join(dir,e.name)]:[]);}
 const byUrl=new Map(report.items.map(i=>[i.url,i]));let changed=0;
 for(const file of htmlFiles(root)){
  const before=fs.readFileSync(file,'utf8');
  const after=before.replace(/<a\b([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g,(full,pre,href,post,body)=>{
   const original=(pre+post).match(/data-original-href="([^"]*)"/)?.[1]||href;
   const source=original.replaceAll('&amp;','&');
   const item=byUrl.get(source);if(!item)return full;
   const label=body.replace(/<[^>]*>/g,' ').trim();
   if(!/download|releases/i.test(label)||/documentation|requirements|release notes|firmware|supported/i.test(label))return full;
   const mirrors=item.files.filter(f=>f.local&&fs.existsSync(path.join(root,f.local)));
   if(!mirrors.length){
    if(!/data-original-href=/.test(pre+post))return full;
    const originalAttrs=(pre+post).replace(/\s*(?:data-original-href|target|rel)="[^"]*"/g,'').replace(/\s+download(?:="[^"]*")?/g,'');
    return `<a${originalAttrs} href="${esc(source)}" target="_blank" rel="noopener noreferrer">${body}</a>`;
   }
   const direct=item.files.length===1&&mirrors.length===1;
   const target=direct?mirrors[0].local.split('/').map(encodeURIComponent).join('/'):'/downloads/index.html#resource-'+item.id;
   const attrs=(pre+post).replace(/\s*(?:data-original-href|target|rel)="[^"]*"/g,'').replace(/\s+download(?:="[^"]*")?/g,'');
   return `<a${attrs} href="${esc(target)}" data-original-href="${esc(source)}"${direct?' download':''}>${body}</a>`;
  });
  if(after!==before){fs.writeFileSync(file,after);changed++;}
 }
 console.log('Updated downloadable links on '+changed+' pages.');
}
async function verify(){
 const files=report.items.flatMap(i=>i.files);let bytes=0;
 let checked=0;
 for(const file of files){
  signature(file);const actual=fs.statSync(file.backupPath).size;
  if(actual!==file.bytes)throw Error('Size mismatch: '+file.backupPath);
  if(!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Missing saved-file checksum: '+file.backupPath);
  // Acquisition calculated SHA-256 from each file after storing it. A full
  // cold re-read can be requested separately; always validate changed mirrors.
  if(process.argv.includes('--rehash')&&await digest(file.backupPath)!==file.sha256)throw Error('Hash mismatch: '+file.backupPath);
  if(file.local&&await digest(path.resolve(root,'.'+file.local))!==file.sha256)throw Error('Site mirror hash mismatch: '+file.local);
  bytes+=actual;checked++;
  if(checked%25===0)console.log('Validated '+checked+'/'+files.length+' saved files and their site mirrors.');
 }
 const inventory=path.join(backup,'download-inventory.json');
 report.updated=new Date().toISOString();fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');fs.copyFileSync(reportPath,inventory);
 const incomplete=report.items.filter(i=>!['downloaded','excluded'].includes(i.status));
 const csv=s=>'"'+String(s??'').replaceAll('"','""')+'"';
 fs.writeFileSync(path.join(backup,'unavailable-downloads.csv'),'Title,URL,Status,Reason,Pages\r\n'+incomplete.map(i=>[i.title,i.url,i.status,i.error||i.reason,i.pages.join('; ')].map(csv).join(',')).join('\r\n')+'\r\n');
 fs.writeFileSync(path.join(backup,'CHECKSUMS.sha256'),files.map(f=>f.sha256+'  '+path.relative(backup,f.backupPath).replaceAll('\\','/')).join('\n')+'\n');
 const totalExisting=JSON.parse(fs.readFileSync(path.join(backup,'existing-site-files.json'),'utf8')).files;
 fs.writeFileSync(path.join(backup,'README.txt'),`whatwhatboy local download archive\nUpdated: ${report.updated}\n\nScope: menus, scripts, tools and source-code archives. Games, firmware and OS images excluded. Bstlar downloads skipped at your request. No downloaded payload was executed.\n\nNew archive files: ${files.length}\nNew archive bytes: ${bytes}\nOriginal site files backed up separately: ${totalExisting.length}\nLinks requiring attention: ${incomplete.length}\n\nfiles/: downloaded archives grouped by resource\nexisting-site-files/: pre-existing site downloads and DLLs\ndownload-inventory.json: source URLs, local paths, byte counts and SHA-256\nunavailable-downloads.csv: blocked, removed, gated or otherwise unavailable links\nCHECKSUMS.sha256: checksums of new archive files\nsite/: current site source and its publishable local mirrors\n\nNot every listed download was retrievable. See the CSV for remaining source links. Files too large for the site are preserved in files/ and retain their original online source links on the site.\n`);
 const rows=report.items.map(i=>`<tr><td>${esc(i.title)}</td><td>${esc(i.status)}</td><td>${i.files.map(f=>`<a href="${esc(path.relative(backup,f.backupPath).replaceAll('\\','/'))}" download>${esc(f.name)}</a> (${(f.bytes/1048576).toFixed(1)} MiB)`).join('<br>')||esc(i.error||i.reason||'')}</td><td><a href="${esc(i.url)}">Original link</a></td></tr>`).join('\n');
 fs.writeFileSync(path.join(backup,'index.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><title>Local download archive</title><style>body{font:16px system-ui;margin:32px;background:#101214;color:#eee}a{color:#6fe4bb}table{border-collapse:collapse;width:100%}th,td{padding:12px;border:1px solid #444;text-align:left;overflow-wrap:anywhere}</style><h1>Local download archive</h1><p>'+files.length+' downloaded files. See README.txt and unavailable-downloads.csv for scope and remaining links.</p><table><thead><tr><th>Resource</th><th>Status</th><th>Local files / issue</th><th>Source</th></tr></thead><tbody>'+rows+'</tbody></table></html>');
 console.log('Verified '+files.length+' files, '+(bytes/1e9).toFixed(2)+' GB; '+incomplete.length+' source links still need attention.');
}
async function snapshot(){
 const target=path.join(backup,'site');const skip=new Set(['.git','.agents','.codex','.claude','.aws','.playwright','node_modules','design-references']);let count=0;
 function copy(dir,relative=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(skip.has(entry.name)||entry.isSymbolicLink())continue;const rel=path.join(relative,entry.name),source=path.join(dir,entry.name),dest=path.join(target,rel);if(entry.isDirectory()){fs.mkdirSync(dest,{recursive:true});copy(source,rel);}else{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);count++;}}}
 fs.mkdirSync(target,{recursive:true});copy(root);console.log('Site snapshot saved: '+count+' files.');
}
(async()=>{if(process.argv.includes('--snapshot-only'))return snapshot();await imports();normalizeMirrors();rewriteLinks();await verify();if(process.argv.includes('--snapshot'))await snapshot();})().catch(error=>{console.error(error);process.exitCode=1;});
