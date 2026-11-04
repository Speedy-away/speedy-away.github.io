const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Readable}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const root=path.resolve(__dirname,'..');
const backup=path.resolve(process.argv.find(a=>a.startsWith('--backup='))?.slice(9)||'F:/whatsite-backup-downloads-etc');
const skip=new Set(['.git','.agents','.codex','.claude','.playwright','node_modules','assets','docs','downloads','languages','i18n-tools','design-references']);
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&nbsp;',' ');
const plain=s=>decode(s.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const safe=s=>s.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,145)||'download';
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(skip.has(e.name)?[]:files(path.join(dir,e.name))):e.name.endsWith('.html')?[path.join(dir,e.name)]:[]);}
function classify(url){
 const u=new URL(url),h=u.hostname.toLowerCase();
 if(h==='bstlar.com')return 'bstlar';
 if(h.endsWith('mediafire.com')&&u.pathname.startsWith('/file/'))return 'mediafire';
 if(h==='gofile.io'&&u.pathname.startsWith('/d/'))return 'gofile';
 if(h==='mega.nz')return 'mega';
 if(['work.ink','workink.net','direct-link.net','linkvertise.com'].some(d=>h===d||h.endsWith('.'+d)))return 'gateway';
 if(h==='github.com'&&/^[^/]*\/.+/.test(u.pathname.slice(1))){if(/\/releases\/download\//.test(u.pathname))return 'direct';if(/\/releases(?:\/tag\/[^/]+)?\/?$/.test(u.pathname))return 'github-release';if(/^\/[^/]+\/[^/]+\/?$/.test(u.pathname))return 'github-source';}
 if(/\.(?:zip|rar|7z|exe|msi|dll|prx|sprx|elf|lua|gsc|gscc|csc|ctd|apk|tar\.gz|AppImage|dmg)(?:$)/i.test(u.pathname)&&!h.includes('consolemods.org'))return 'direct';
 return '';
}
function catalog(){
 const byUrl=new Map();
 for(const file of files(root)){
  const html=fs.readFileSync(file,'utf8'),relative=path.relative(root,file).replaceAll('\\','/');
  if(/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html)||/http-equiv="refresh"/i.test(html))continue;
  const body=html.slice(html.indexOf('id="main-content"')>=0?html.indexOf('id="main-content"'):html.indexOf('<body'));
  for(const m of body.matchAll(/<a\b[^>]*href="([^" ]+)"[^>]*>([\s\S]*?)<\/a>/gi)){
   const url=decode(m[0].match(/data-original-href="([^"]+)"/)?.[1]||m[1]);if(!/^https?:/.test(url))continue;
   const label=plain(m[2]),kind=classify(url)||(/download|official site/i.test(label)?'website':'');if(!kind)continue;
   const previous=body.slice(0,m.index),h=[...previous.matchAll(/<h[1234][^>]*>([\s\S]*?)<\/h[1234]>/gi)].pop();
   const title=h?plain(h[1]):plain(m[2]);
   let item=byUrl.get(url);if(!item){item={id:hash(url).slice(0,12),url,kind,title,pages:[],labels:[],status:'pending',files:[]};byUrl.set(url,item);}
   if(!item.pages.includes(relative))item.pages.push(relative);if(!item.labels.includes(label))item.labels.push(label);
  }
 }
 for(const item of byUrl.values()){
  const text=item.title+' '+item.url;
  if(item.kind==='bstlar'){item.status='excluded';item.reason='Bstlar downloads explicitly skipped by user';}
  else if(item.pages.every(p=>p.startsWith('games-downloads/'))||/HFW_4\.93|PS3UPDAT|17559|System Update|Firmware|Xbox backwards compatibility|Rebug|Evilnat|Ferrox/i.test(text)){item.status='excluded';item.reason='Game, firmware or console system files excluded by user';}
 }
 return [...byUrl.values()];
}
const reportPath=path.join(root,'docs/download-audit.json');
function writeReport(items){fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify({updated:new Date().toISOString(),backupRoot:backup,scope:'Menus, scripts, tools and source codes; excludes games and firmware',items},null,2)+'\n');}
async function request(url,options={}){const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(45000),headers:{'User-Agent':'whatsite-local-archive/1.0','Accept':'*/*',...options.headers},...options});if(!response.ok)throw Error('HTTP '+response.status+' at '+new URL(url).hostname);return response;}
async function saveFile(item,url,name,headers={}){
 const dir=path.join(backup,'files',safe(item.title)+'-'+item.id);
 fs.mkdirSync(dir,{recursive:true});
 let filename=safe(name||decodeURIComponent(new URL(url).pathname.split('/').pop()||'download'));
 let target=path.join(dir,filename);
 const previous=item.files.find(f=>f.resolvedUrl===url);
 if(previous&&fs.existsSync(previous.backupPath))return previous;
 const initialTemp=target+'.partial';
 const offset=name&&fs.existsSync(initialTemp)?fs.statSync(initialTemp).size:0;
 const response=await request(url,{signal:AbortSignal.timeout(600000),headers:{...headers,...(offset?{Range:'bytes='+offset+'-'}:{})}});
 const type=response.headers.get('content-type')||'';
 if(/text\/html|application\/json/.test(type)){await response.body?.cancel();throw Error('Received a web/error page instead of a file');}
 const disposition=response.headers.get('content-disposition');
 const suggested=disposition?.match(/filename\*?=(?:UTF-8''|["'])?([^"';\r\n]+)/i)?.[1];
 if(!name&&suggested){filename=safe(decodeURIComponent(suggested));target=path.join(dir,filename);}
 const temp=target+'.partial';
 await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(temp,{flags:offset&&response.status===206?'a':'w'}));
 try{verifySignature(temp,filename);}catch(error){fs.unlinkSync(temp);throw error;}
 fs.renameSync(temp,target);
 const digest=crypto.createHash('sha256');let bytes=0;for await(const chunk of fs.createReadStream(target)){bytes+=chunk.length;digest.update(chunk);}if(!bytes)throw Error('Empty file');
 const result={name:filename,bytes,sha256:digest.digest('hex'),resolvedUrl:url,backupPath:target};
 // Keep site copies below GitHub's per-file Git limit, while the full archive stays on F:.
 if(bytes<95*1024*1024&&mirrorBytes+bytes<780*1024*1024){const rel='downloads/archive/'+item.id+'/'+filename;fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});fs.copyFileSync(target,path.join(root,rel));result.local='/'+rel;mirrorBytes+=bytes;}
 console.log('  saved '+filename+' ('+(bytes/1048576).toFixed(1)+' MiB)');
 item.files.push(result);return result;
}
function verifySignature(file,name){
 const fd=fs.openSync(file,'r'),head=Buffer.alloc(8);fs.readSync(fd,head,0,8,0);fs.closeSync(fd);
 if(/\.(?:zip|apk|ipa|vpk)$/i.test(name)&&head.subarray(0,2).toString()!=='PK')throw Error('Invalid ZIP signature');
 if(/\.rar$/i.test(name)&&head.subarray(0,4).toString()!=='Rar!')throw Error('Invalid RAR signature');
 if(/\.7z$/i.test(name)&&head.subarray(0,6).toString('hex')!=='377abcaf271c')throw Error('Invalid 7z signature');
 if(/\.(?:exe|dll)$/i.test(name)&&head.subarray(0,2).toString()!=='MZ')throw Error('Invalid executable file signature');
}
function treeBytes(dir){if(!fs.existsSync(dir))return 0;return fs.readdirSync(dir,{withFileTypes:true}).reduce((s,e)=>s+(e.isDirectory()?treeBytes(path.join(dir,e.name)):fs.statSync(path.join(dir,e.name)).size),0);}
let mirrorBytes=treeBytes(path.join(root,'downloads/archive'));
function mappedSource(url){
 const alternatives=path.join(root,'docs/gateway-download-alternatives.json');
 if(fs.existsSync(alternatives)){const source=JSON.parse(fs.readFileSync(alternatives,'utf8')).sources.find(s=>s.page===url);if(source)return source;}
 const official=path.join(root,'docs/official-download-sources.json');
 if(fs.existsSync(official)){const source=JSON.parse(fs.readFileSync(official,'utf8')).sources.find(s=>s.page===url);if(source)return source;}
 const emulators=path.join(root,'docs/emulator-download-sources.json');
 if(fs.existsSync(emulators)){const data=JSON.parse(fs.readFileSync(emulators,'utf8'));const resolved=data.mappings[url];if(resolved)return {title:data.projects.find(p=>p.officialPage===url)?.name,downloads:[{url:resolved}]};}
}
async function github(item){
 const u=new URL(item.url),[owner,repo]=u.pathname.split('/').slice(1,3),base='https://api.github.com/repos/'+owner+'/'+repo;
 if(item.kind==='github-source'){
  let branch;
  try{const info=await(await request(base)).json();branch=info.default_branch;}
  catch(error){const html=await(await request('https://github.com/'+owner+'/'+repo)).text();branch=html.match(/"defaultBranch":"([^"]+)"/)?.[1];if(!branch)throw error;}
  return saveFile(item,'https://codeload.github.com/'+owner+'/'+repo+'/zip/refs/heads/'+branch,repo+'-source.zip');
 }
 const tag=u.pathname.match(/\/releases\/tag\/(.+)/)?.[1];
 let data;
 try{data=await(await request(base+(tag?'/releases/tags/'+tag:'/releases/latest'))).json();}
 catch(error){
  const page=await request('https://github.com/'+owner+'/'+repo+(tag?'/releases/tag/'+tag:'/releases/latest'));
  const resolvedTag=new URL(page.url).pathname.match(/\/releases\/tag\/(.+)/)?.[1];if(!resolvedTag)throw error;
  const html=await(await request('https://github.com/'+owner+'/'+repo+'/releases/expanded_assets/'+resolvedTag)).text();
  const urls=[...html.matchAll(/href="([^\"]*\/releases\/download\/[^\"]+)"/g)].map(m=>new URL(decode(m[1]),'https://github.com').href);
  if(!urls.length)throw error;
  data={tag_name:decodeURIComponent(resolvedTag),assets:[...new Set(urls)].map(url=>({browser_download_url:url,name:decodeURIComponent(new URL(url).pathname.split('/').pop())}))};
 }
 item.release=data.tag_name;
 if(!data.assets?.length)throw Error('Release contains no downloadable assets');
 const failures=[];
 for(const asset of data.assets)try{await saveFile(item,asset.browser_download_url,asset.name);}catch(error){failures.push(asset.name+': '+error.message);}
 if(failures.length)throw Error(failures.join('; '));
}
async function acquire(item){
 if(item.status==='excluded'||item.status==='reference')return;
 const source=mappedSource(item.url);
 const needsMsi=source?.resolver==='msi-token'&&!item.files.some(f=>/^MSIAfterburnerSetup\.zip$/i.test(f.name));
 if(item.status==='downloaded'&&item.files.every(f=>fs.existsSync(f.backupPath))&&!needsMsi)return;
 try{
  if(source){
   if(source.title)item.title=source.title;
   if(source.resolver==='msi-token'){
    const stamp=new Date().toISOString().replace(/[-:T]/g,'').slice(0,10);
    const data=await(await request(source.tokenEndpoint+'?date='+stamp)).json();
    const token=data.data?.[0]||data[0];if(typeof token!=='string')throw Error('Publisher download token unavailable');
    await saveFile(item,source.downloadBase+token,'MSIAfterburnerSetup.zip',{Referer:'https://www.msi.com/Landing/afterburner/'});
   }
   else if(source.alternativeReleasePage){await github({...item,url:source.alternativeReleasePage,kind:'github-release'});}
   else for(const file of source.downloads){const kind=classify(file.url);if(kind==='github-release'||kind==='github-source')await github({...item,url:file.url,kind});else await saveFile(item,file.url,file.filename,{Referer:source.page||item.url});}
  }
  else if(item.kind==='direct')await saveFile(item,item.url);
  else if(item.kind==='github-release'||item.kind==='github-source')await github(item);
  else if(item.kind==='mediafire'){
   const html=await(await request(item.url)).text(),tag=[...html.matchAll(/<a\b[^>]*>/gi)].map(m=>m[0]).find(t=>/id="downloadButton"/.test(t));
   const url=decode(tag?.match(/href="([^"]*)"/)?.[1]||'');if(!url||!new URL(url).hostname.endsWith('.mediafire.com'))throw Error('Public direct download unavailable');
   await saveFile(item,url,decodeURIComponent(new URL(item.url).pathname.split('/')[3]||''));
  }else if(item.kind==='website'){
   const response=await request(item.url),type=response.headers.get('content-type')||'';
   if(!/html|json/.test(type)){await response.body?.cancel();await saveFile(item,item.url);}
   else{
    const html=await response.text();
    const terms=item.title.replace(/\([^)]*\)/g,'').toLowerCase().match(/[a-z0-9]{4,}/g)||[];
    const urls=[...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map(m=>{try{return new URL(decode(m[1]),response.url).href;}catch{return '';}}).filter(u=>{try{const name=decodeURIComponent(new URL(u).pathname.split('/').pop()||'').toLowerCase();return ['direct','github-release'].includes(classify(u))&&!/norton|sponsored|advertisement/i.test(name)&&(classify(u)==='github-release'||terms.some(t=>name.includes(t))||/directx/i.test(item.title)&&name==='dxwebsetup.exe');}catch{return false;}}))].slice(0,12);
    if(!urls.length)throw Error('Public page has no direct downloadable file link');
    for(const url of urls){if(classify(url)==='github-release')await github({...item,url,kind:'github-release'});else await saveFile(item,url,undefined,{Referer:item.url});}
   }
  }else throw Error('Gateway needs resolution: '+item.kind);
  item.status='downloaded';delete item.error;
 }catch(error){item.status=item.files.length?'partial':'unavailable';item.error=error.message;}
 console.log(item.status+': '+item.title+' ['+item.kind+']'+(item.error?' — '+item.error:''));
}
function existing(items){
 const local=[];
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){if(e.name!=='archive')walk(p);}else if(!e.name.endsWith('.html'))local.push(p);}}
 if(fs.existsSync(path.join(root,'downloads')))walk(path.join(root,'downloads'));
 for(const rel of ['scooby/WINMM.dll','scooby/FSL/WINMM.dll'])if(fs.existsSync(path.join(root,rel)))local.push(path.join(root,rel));
 const results=[];
 for(const file of local){const relative=path.relative(root,file),dest=path.join(backup,'existing-site-files',relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);results.push({sitePath:relative.replaceAll('\\','/'),backupPath:dest,bytes:fs.statSync(file).size});}
 fs.writeFileSync(path.join(backup,'existing-site-files.json'),JSON.stringify({files:results},null,2)+'\n');
 console.log('Backed up '+results.length+' existing site files.');
}
async function main(){
 let items=catalog();
 if(process.argv.includes('--catalog')){writeReport(items);console.log(JSON.stringify(items.reduce((a,i)=>(a[i.status+':'+i.kind]=(a[i.status+':'+i.kind]||0)+1,a),{}),null,2));return;}
 if(fs.existsSync(reportPath)){const old=JSON.parse(fs.readFileSync(reportPath,'utf8')).items;for(const item of items){const prev=old.find(o=>o.url===item.url);if(prev){Object.assign(item,{files:prev.files||[],status:item.status==='excluded'?'excluded':prev.status,release:prev.release});if(prev.error&&item.status!=='excluded')item.error=prev.error;}}for(const item of old)if(!items.some(i=>i.url===item.url))items.push({...item,listed:false,status:item.kind==='bstlar'?'excluded':item.status,reason:item.kind==='bstlar'?'Bstlar downloads explicitly skipped by user':item.reason});}
 fs.mkdirSync(backup,{recursive:true});existing(items);writeReport(items);
 const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
 const queue=items.filter(i=>!['excluded','reference'].includes(i.status)&&(!only||(only==='apollo'&&/github\.com\/(?:bucanero\/apollo-(?:ps3|ps4|vita)|TheOfficialFloW\/VitaShell)/i.test(i.url))||(only==='resolved'&&mappedSource(i.url)&&(i.status!=='downloaded'||mappedSource(i.url).resolver==='msi-token'&&!i.files.some(f=>/^MSIAfterburnerSetup\.zip$/i.test(f.name))))||(only==='pending'&&i.status==='pending')));
 let next=0;async function worker(){while(next<queue.length){const item=queue[next++];await acquire(item);writeReport(items);fs.copyFileSync(reportPath,path.join(backup,'download-inventory.json'));}}
 await Promise.all([worker(),worker(),worker()]);
 console.log(JSON.stringify(items.reduce((a,i)=>(a[i.status]=(a[i.status]||0)+1,a),{}),null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
