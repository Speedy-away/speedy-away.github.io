// Explicit PS3 source imports. Download and inspect data only; never launch a build.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');
const {spawn, spawnSync} = require('node:child_process');
const {Transform} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const {destinationForFile, safeName} = require('./download-archive-layout.cjs');
const {consoleBinaryHeader}=require('./ps3-console-binary-header.cjs');
const root = path.resolve(__dirname, '..');
const backup = path.resolve('F:/whatsite-backup-downloads-etc');
const reportPath = path.join(root, 'docs/ps3-expansion-download-inventory.json');
const jobsPath = path.join(root, 'docs/ps3-expansion-download-jobs.json');
const sevenZip = 'C:/Program Files/7-Zip/7z.exe';
function hashFile(file) {
  const digest=crypto.createHash('sha256'),buffer=Buffer.alloc(4*1024**2),fd=fs.openSync(file,'r');
  try {let length;while((length=fs.readSync(fd,buffer,0,buffer.length,null)))digest.update(buffer.subarray(0,length));} finally {fs.closeSync(fd);}
  return digest.digest('hex');
}
const decode = s => s.replaceAll('&amp;', '&').replaceAll('&quot;', '"');
const within = (base, target) => {
  const absolute = path.resolve(target), rel = path.relative(path.resolve(base), absolute);
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw Error('Path escapes expected root');
  let ancestor = absolute;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  if (fs.existsSync(base)) {
    const realRel = path.relative(fs.realpathSync(base), fs.realpathSync(ancestor));
    if (realRel === '..' || realRel.startsWith('..' + path.sep) || path.isAbsolute(realRel)) throw Error('Path resolves outside expected root');
  }
  return absolute;
};
const readReport = () => fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : {items: []};
function persist(item) {
  const latest = readReport(), old = latest.items.find(x => x.id === item.id);
  const records = new Map([...(old?.files || []), ...item.files].map(x => [x.backupPath + '|' + x.sha256, x]));
  const next = {...old, ...item, files: [...records.values()]};
  next.sourceUrls=[...new Set([...(old?.sourceUrls||[]),old?.url,...(item.sourceUrls||[]),item.url].filter(Boolean))];
  next.attempts=[...new Map([...(old?.attempts||[]),...(item.attempts||[])].map(a=>[JSON.stringify(a),a])).values()];
  next.partialTransfers=[...new Map([...(old?.partialTransfers||[]),...(item.partialTransfers||[])].map(a=>[a.path+'|'+a.bytes,a])).values()];
  if(item.status==='downloaded'){delete next.error;delete next.reason;next.archiveStatus='archived';next.sourceStatus='downloaded-and-verified';}
  const items = latest.items.filter(x => x.id !== next.id).concat(next);
  const json=JSON.stringify({...latest, reviewed: '2026-11-02', backupRoot: backup, items}, null, 2) + '\n';
  const replaceMetadata=file=>{const temporary=file+'.ps3-'+crypto.randomBytes(6).toString('hex')+'.tmp';fs.writeFileSync(temporary,json,{flag:'wx'});fs.renameSync(temporary,file);};
  replaceMetadata(reportPath);
  const archiveReport = within(backup, path.join(backup, 'ps3-expansion-download-inventory.json'));
  replaceMetadata(archiveReport);
}
function finalizePreserving(pending, target, digest, bytes, base=backup) {
  within(base,pending);within(base,target);
  if(!fs.statSync(pending).isFile())throw Error('Completed transfer is not a regular file');
  const ext=path.extname(target),stem=target.slice(0,target.length-ext.length);
  for(let copy=1;;copy++){
    const candidate=within(base,copy===1?target:stem+' (copy '+copy+')'+ext);
    if(fs.existsSync(candidate)){
      if(fs.statSync(candidate).isFile()&&fs.statSync(candidate).size===bytes&&hashFile(candidate)===digest)return candidate;
      continue;
    }
    try{fs.linkSync(pending,candidate);return candidate;}
    catch(error){
      if(error.code==='EEXIST')continue;
      if(!['EPERM','ENOTSUP','EOPNOTSUPP','EXDEV','EINVAL','ENOSYS','EISDIR'].includes(error.code))throw error;
      within(base,candidate);if(fs.existsSync(candidate)&&fs.statSync(candidate).isDirectory())continue;
      try{fs.copyFileSync(pending,candidate,fs.constants.COPYFILE_EXCL);return candidate;}
      catch(copyError){if(['EEXIST','EISDIR'].includes(copyError.code))continue;throw copyError;}
    }
  }
}
function mirror(item, file, member) {
  if (file.bytes >= 95 * 1024 ** 2) return;
  const rel = ['downloads', 'ps3', item.id, file.sha256.slice(0, 12), ...(member ? member.split(/[\\/]+/).slice(0, -1).map(safeName) : []), safeName(file.name)].join('/');
  const target = within(root, path.join(root, rel));
  fs.mkdirSync(path.dirname(target), {recursive: true});
  try{fs.copyFileSync(file.backupPath,target,fs.constants.COPYFILE_EXCL);}
  catch(error){if(error.code!=='EEXIST')throw error;within(root,target);if(hashFile(target)!==file.sha256)throw Error('Different local mirror already exists');}
  file.local = '/' + rel.split('/').map(encodeURIComponent).join('/');
}
function signature(bytes, filename) {
  const h = bytes.subarray(0, 8).toString('hex');
  if (/\.zip$/i.test(filename) && !/^(?:504b0304|504b0506|504b0708)/.test(h)) throw Error('Invalid ZIP signature');
  if (/\.rar$/i.test(filename) && !/^(?:526172211a0700|526172211a070100)/.test(h)) throw Error('Invalid RAR signature');
  if (/\.7z$/i.test(filename) && !h.startsWith('377abcaf271c')) throw Error('Invalid 7z signature');
  if (/\.pkg$/i.test(filename) && !h.startsWith('7f504b47')) throw Error('Invalid PS3 PKG signature');
}
function pkgHeader(file){
  const actualBytes=fs.statSync(file).size,head=Buffer.alloc(0xc0),fd=fs.openSync(file,'r');let read;
  try{read=fs.readSync(fd,head,0,head.length,0);}finally{fs.closeSync(fd);}
  if(read<head.length)throw Error('PS3 PKG header is truncated');
  const magic=head.subarray(0,4).toString('hex'),type=head.readUInt16BE(6),declaredBytes=head.readBigUInt64BE(0x18),dataOffset=head.readBigUInt64BE(0x20),dataBytes=head.readBigUInt64BE(0x28);
  const metadataOffset=head.readUInt32BE(8),metadataBytes=head.readUInt32BE(0x10);
  const valid=magic==='7f504b47'&&type===1&&declaredBytes===BigInt(actualBytes)&&dataOffset+dataBytes<=declaredBytes&&BigInt(metadataOffset+metadataBytes)<=declaredBytes;
  const result={status:valid?'valid-static-PS3-header':'invalid',magic,type,revision:head.readUInt16BE(4),actualBytes,declaredBytes:declaredBytes.toString(),dataOffset:dataOffset.toString(),dataBytes:dataBytes.toString(),metadataOffset,metadataBytes,contentId:head.subarray(0x30,0x60).toString('ascii').replace(/\0.*$/s,''),contentIdIsInstallerIdentity:true,reference:'https://github.com/ps3dev/ps3sdk/blob/master/tools/pkg/pkg.c',limitation:'Structural header check only; no installation, execution, signature authenticity or game compatibility test.'};
  if(!valid){const error=Error('PS3 PKG type/size/bounds validation failed');error.pkgHeader=result;throw error;}
  return result;
}
async function streamIntoArchive(readable,target,{name,maxBytes,expectedBytes,id,phase,onProgress,beforeFinalize,base=backup}){
  within(base,target);fs.mkdirSync(path.dirname(target),{recursive:true});
  const pending=within(base,target+'.transfer-'+crypto.randomBytes(8).toString('hex')+'.partial');
  let bytes=0,head=Buffer.alloc(0),lastBytes=0,lastAt=Date.now(),sha256;const digest=crypto.createHash('sha256');
  const meter=new Transform({transform(chunk,encoding,callback){
    bytes+=chunk.length;
    if(bytes>maxBytes||expectedBytes&&bytes>expectedBytes)return callback(Error('Transfer exceeded its declared or selected byte bound'));
    digest.update(chunk);if(head.length<8)head=Buffer.concat([head,chunk.subarray(0,8-head.length)]);
    if(bytes-lastBytes>=64*1024**2||Date.now()-lastAt>=15000){const progress={id,phase,bytes,expectedBytes:expectedBytes||null,percent:expectedBytes?Math.round(bytes/expectedBytes*1000)/10:null};console.log(JSON.stringify(progress));onProgress?.({...progress,path:pending});lastBytes=bytes;lastAt=Date.now();}
    callback(null,chunk);
  }});
  try{
    await pipeline(readable,meter,fs.createWriteStream(pending,{flags:'wx'}));
    if(!bytes||expectedBytes&&bytes!==expectedBytes)throw Error('Completed transfer length does not match declared bytes');
    signature(head,name);sha256=digest.digest('hex');
    const header=/\.pkg$/i.test(name)?pkgHeader(pending):undefined;
    const binaryHeader=consoleBinaryHeader(pending,name);
    if(beforeFinalize)await beforeFinalize();
    const finalPath=finalizePreserving(pending,target,sha256,bytes,base);
    // Keep the completed transfer path too. Hard links use the same data on NTFS;
    // unsupported filesystems receive an exclusive copy. No partial is removed.
    return {bytes,sha256,backupPath:finalPath,retainedTransferPath:pending,...(header?{pkgHeader:header}:{}),...(binaryHeader?{consoleBinaryHeader:binaryHeader}:{})};
  }catch(error){
    let actualBytes=0;try{actualBytes=fs.statSync(pending).size;}catch{}
    error.partialTransfer={path:pending,bytes:actualBytes,receivedBytes:bytes,expectedBytes:expectedBytes||null,phase,at:new Date().toISOString(),error:error.message,...(sha256?{sha256,transferBytesVerified:true}:{})};
    throw error;
  }
}
function classifyMember(name, job) {
  if (/(?:^|[\\/])(?:__MACOSX|\._[^\\/]*|\.DS_Store)(?:[\\/]|$)/i.test(name)) return ['Metadata'];
  if (/(?:^|[\\/])LibertyV(?:-r\d+)?[\\/]/i.test(name)) return ['Helpers','Windows'];
  if (/\.(?:exe|dll|msi)$/i.test(name)) return ['Helpers', 'Windows'];
  if (/\.exe\.config$/i.test(name)) return ['Helpers', 'Windows'];
  if (/\.sprx\s+Load In [^\\/]+$/i.test(name)) return ['Builds'];
  if (/\.(?:c|cc|cpp|h|hpp|cs|sln|vcxproj|pdb|lib|a)$/i.test(name)) return ['Source Code'];
  if (/\.key$/i.test(name) || /[\\/]WeAreGhosts[\\/].*\.txt$/i.test(name)) return ['Builds'];
  if (/\.(?:zip|rar|7z)$/i.test(name)) return job.archiveRole || ['Builds'];
  if (/\.(?:txt|md|pdf|png|jpe?g|url|html)$/i.test(name)) return ['Metadata'];
  if (/\.(?:sprx|prx|pkg|rpf|sco|img|sc3|gsc|gscc|csc|bin|self|elf|ff|ctd|edat|ini|cfg|config|xml|dat|json|dds|wtd|wdr|wft|xtd|xpl|ide|ipl|col|ifp)$/i.test(name)) return ['Builds'];
  return null;
}
async function inspectArchive(job, original, item, depth=0, state={selectedBytes:0}) {
  if (!/\.(?:zip|rar|7z)$/i.test(original.name) || !fs.existsSync(sevenZip)) return;
  const list = spawnSync(sevenZip, ['l', '-slt', '-ba','-sccUTF-8', original.backupPath], {encoding: 'utf8',timeout:job.extractionLimits?.timeoutMs||600000,maxBuffer: 8 * 1024 ** 2, windowsHide: true,stdio:['ignore','pipe','pipe']});
  if (list.status !== 0) {item.inspection = {status: 'unavailable', error: list.stderr.trim() || 'Archive listing failed'}; return;}
  const members = list.stdout.trim().split(/\r?\n\r?\n/).map(block => Object.fromEntries(block.split(/\r?\n/).map(l => {const p=l.indexOf(' = '); return p < 0 ? [] : [l.slice(0,p),l.slice(p+3)];}).filter(x=>x.length))).filter(x=>x.Path && x.Folder !== '+');
  const limits={maxMembers:5000,maxExpandedBytes:1024**3,maxMemberBytes:512*1024**2,maxTotalExtractedBytes:1024**3,maxDepth:2,timeoutMs:600000,...job.extractionLimits};
  for(const [key,value]of Object.entries(limits))if(!Number.isSafeInteger(value)||value<1||value>16*1024**3)throw Error('Invalid extraction bound '+key);
  const valid = members.every(m => !/^(?:[\\/]|[A-Za-z]:)/.test(m.Path) && !m.Path.split(/[\\/]+/).some(p=>p === '..' || p.includes(':')) && !m['Symbolic Link'] && !m['Hard Link'] && m.Encrypted !== '+'&&Number.isSafeInteger(Number(m.Size||0))&&Number(m.Size||0)>=0);
  const bytes = members.reduce((s,m)=>s+Number(m.Size || 0),0);
  item.inspection = {status: valid ? 'listed' : 'rejected', memberCount: members.length, expandedBytes: bytes,limits,members: members.map(m=>({path:m.Path,bytes:Number(m.Size || 0),role:classifyMember(m.Path,job)}))};
  if (!valid || members.length > limits.maxMembers || bytes > limits.maxExpandedBytes){item.inspection.extractionStatus='not-extracted-invalid-or-job-bound';return;}
  if(depth===0&&job.verifyArchive){
    console.log(JSON.stringify({id:job.id,phase:'archive-integrity-start',bytes:original.bytes}));
    const test=spawnSync(sevenZip,['t','-bd','-bb0','-sccUTF-8',original.backupPath],{encoding:'utf8',timeout:limits.timeoutMs,maxBuffer:1024**2,windowsHide:true,stdio:['ignore','pipe','pipe']});
    item.inspection.integrity={tool:'7-Zip test (data integrity/CRC, no execution)',status:test.status===0?'passed':'failed',exitCode:test.status,checkedAt:new Date().toISOString(),summary:(test.stdout+'\n'+test.stderr).trim().slice(-2000)};
    console.log(JSON.stringify({id:job.id,phase:'archive-integrity-complete',status:item.inspection.integrity.status}));
    if(test.status!==0){item.inspection.extractionStatus='not-extracted-integrity-failed';return;}
  }
  let extracted = 0;const inspection=item.inspection,nested=[];
  for (const member of members) {
    const role = classifyMember(member.Path,job), size = Number(member.Size || 0);
    if (!role || role[0] === 'Source Code' || !size) continue;
    const previous=item.files.find(f=>f.extractedFromSha256===original.sha256&&f.memberPath===member.Path&&f.bytes===size&&fs.existsSync(f.backupPath)&&fs.statSync(f.backupPath).isFile()&&fs.statSync(f.backupPath).size===size);
    if(previous&&hashFile(previous.backupPath)===previous.sha256){
      if(/\.pkg$/i.test(previous.name))previous.pkgHeader=pkgHeader(previous.backupPath);
      try{const header=consoleBinaryHeader(previous.backupPath,previous.name);if(header)previous.consoleBinaryHeader=header;}
      catch(error){previous.readiness='invalid-console-header';previous.consoleBinaryHeader=error.consoleBinaryHeader;previous.archiveRole=['Metadata'];(inspection.invalidConsoleMembers||=[]).push({path:member.Path,bytes:size,error:error.message,readiness:previous.readiness});}
      extracted++;if(/\.(?:zip|rar|7z)$/i.test(previous.name))nested.push(previous);continue;
    }
    if(size>limits.maxMemberBytes||state.selectedBytes+size>limits.maxTotalExtractedBytes){(inspection.skippedMembers||=[]).push({path:member.Path,bytes:size,reason:'per-job extraction byte bound'});continue;}
    state.selectedBytes+=size;
    const name = safeName(member.Path.split(/[\\/]+/).pop());
    const info = {name,releaseTag: job.version, archiveRole: role, memberPath: member.Path, extractedFromSha256: original.sha256, resolvedUrl: job.url, archivedAt: new Date().toISOString()};
    const location = destinationForFile(backup,{...job,platform:'PS3',url:job.url},info);
    const subdir = member.Path.split(/[\\/]+/).slice(0,-1).map(safeName);
    const child=spawn(sevenZip,['e','-so','-spd','-sccUTF-8',original.backupPath,member.Path],{stdio:['ignore','pipe','pipe'],windowsHide:true});
    let stderr='';child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-65536);});
    const completion=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error('7-Zip extraction failed: '+(stderr.trim()||code))));});
    completion.catch(()=>{});
    const timer=setTimeout(()=>child.kill(),limits.timeoutMs);
    try{
      const transfer=await streamIntoArchive(child.stdout,path.join(path.dirname(location),'Extracted',...subdir,name),{name,maxBytes:limits.maxMemberBytes,expectedBytes:size,id:job.id,phase:'extract:'+member.Path,beforeFinalize:()=>completion});
      await completion;Object.assign(info,transfer);
    }catch(error){
      child.kill();await completion.catch(()=>{});if(error.partialTransfer)(item.partialTransfers||=[]).push(error.partialTransfer);
      if(error.consoleBinaryHeader&&error.partialTransfer?.bytes===size&&error.partialTransfer.sha256){
        Object.assign(info,{bytes:size,sha256:error.partialTransfer.sha256,archiveRole:['Metadata'],readiness:'invalid-console-header',consoleBinaryHeader:error.consoleBinaryHeader,retainedTransferPath:error.partialTransfer.path});
        const invalidLocation=destinationForFile(backup,{...job,platform:'PS3',url:job.url},info);
        info.backupPath=finalizePreserving(info.retainedTransferPath,path.join(path.dirname(invalidLocation),'Extracted',...subdir,name),info.sha256,size);
        item.files.push(info);(inspection.invalidConsoleMembers||=[]).push({path:member.Path,bytes:size,error:error.message,readiness:info.readiness});extracted++;
      }else (inspection.errors||=[]).push({path:member.Path,error:error.message,...(error.pkgHeader?{pkgHeader:error.pkgHeader}:{})});
      continue;
    }
    finally{clearTimeout(timer);}
    if (role[0] === 'Builds' || role[0] === 'Metadata') mirror(item,info,member.Path);
    item.files.push(info); extracted++;
    if(/\.(?:zip|rar|7z)$/i.test(info.name))nested.push(info);
  }
  inspection.extractedFiles = extracted;
  if(depth<limits.maxDepth)for(const archive of nested){await inspectArchive(job,archive,item,depth+1,state);item.archiveInspections ||= [];item.archiveInspections.push({archiveSha256:archive.sha256,archiveMember:archive.memberPath,...item.inspection});item.inspection=inspection;}
  if(inspection.invalidConsoleMembers?.length){
    const menuFiles=item.files.filter(f=>/\.(?:sprx|prx)(?:\s+Load In .*)?$/i.test(f.name));
    if(!menuFiles.some(f=>f.consoleBinaryHeader?.status==='valid-static-PS3-PPU-header')){item.readiness='incomplete';item.readinessReason='No valid console SPRX/PRX header remains among the inspected menu components.';}
  }
}
async function request(url,options={}) {
  let current = new URL(url);
  for (let i=0;i<8;i++) {
    const host = current.hostname;
    if (current.protocol !== 'https:' || current.username || current.password || current.port || !(host === 'github.com' || host.endsWith('.githubusercontent.com') || host === 'mediafire.com' || host.endsWith('.mediafire.com') || host === 'api.pcloud.com' || host === 'eapi.pcloud.com' || host.endsWith('.pcloud.com'))) throw Error('Unexpected source/redirect host');
    const r = await fetch(current.href,{redirect:'manual',signal:AbortSignal.timeout(options.timeoutMs||180000),headers:{'User-Agent':'whatsite-ps3-archive/1.0'}});
    if ([301,302,303,307,308].includes(r.status)) {await r.body?.cancel();current=new URL(r.headers.get('location'),current);continue;}
    if (!r.ok) {await r.body?.cancel();throw Error('HTTP '+r.status);}
    return r;
  }
  throw Error('Too many redirects');
}
// Use the native Node HTTPS readable stream for large attachments. This avoids
// routing multi-hundred-MiB bodies through fetch/Undici's Web Streams adapter.
async function requestAssetStream(url,options={}){
  let current=new URL(url);const signal=AbortSignal.timeout(options.timeoutMs||180000);
  const publicDropbox=url=>url.hostname==='www.dropbox.com'&&/^\/scl\/fi\/[A-Za-z0-9]+\/[^/]+$/.test(url.pathname)&&url.searchParams.get('dl')==='1';
  const dropboxShare=Boolean(options.dropboxShare&&publicDropbox(current));
  if(options.dropboxShare&&!dropboxShare)throw Error('Require an explicit public Dropbox /scl/fi attachment with dl=1');
  for(let redirect=0;redirect<8;redirect++){
    const host=current.hostname;
    const allowedDropbox=dropboxShare&&(publicDropbox(current)||host.endsWith('.dropboxusercontent.com'));
    const allowedHost=dropboxShare?allowedDropbox:host==='github.com'||host.endsWith('.githubusercontent.com')||host==='mediafire.com'||host.endsWith('.mediafire.com')||host==='api.pcloud.com'||host==='eapi.pcloud.com'||host.endsWith('.pcloud.com');
    if(current.protocol!=='https:'||current.username||current.password||current.port||current.hash||!allowedHost)throw Error('Unexpected asset source/redirect host');
    const response=await new Promise((resolve,reject)=>{const req=https.get(current,{signal,headers:{'User-Agent':'whatsite-ps3-archive/1.0'}},resolve);req.once('error',reject);});
    if([301,302,303,307,308].includes(response.statusCode)){const location=response.headers.location;response.resume();if(!location)throw Error('Asset redirect has no destination');current=new URL(location,current);continue;}
    if(response.statusCode!==200){response.resume();throw Error('HTTP '+response.statusCode);}
    return {body:response,url:current.href,headers:{get:name=>{const value=response.headers[name.toLowerCase()];return value===undefined?null:Array.isArray(value)?value.join(', '):String(value);}}};
  }
  throw Error('Too many asset redirects');
}
async function acquire(job) {
  if (!/^[a-z0-9-]+$/.test(job.id) || job.platform !== 'PS3' || !Array.isArray(job.category) || !job.version || !job.filename) throw Error('Invalid explicit PS3 job');
  const item={...job,title:job.title,url:job.url,kind:/mediafire\.com/.test(job.url)?'mediafire':'direct',files:[],checkedAt:new Date().toISOString()};
  const previous=readReport().items.find(i=>i.id===job.id);
  if(previous?.error)item.attempts=[{at:previous.checkedAt,url:previous.url,status:previous.status,archiveStatus:previous.archiveStatus,error:previous.error}];
  delete item.error;item.archiveStatus='downloading';
  try {
    if (/bstlar/i.test(new URL(job.url).hostname)) throw Error('Bstlar skipped by user request');
    let source=job.url.replace(/^http:/,'https:');
    let dropboxShare=false;
    if(new URL(source).hostname==='www.dropbox.com'){const share=new URL(source);if(!/^\/scl\/fi\/[A-Za-z0-9]+\/[^/]+$/.test(share.pathname))throw Error('Dropbox URL is not an explicit public file share');share.searchParams.set('dl','1');source=share.href;dropboxShare=true;}
    if (/^(?:e|u)\.pcloud\.link$/.test(new URL(source).hostname)) {
      const link=new URL(source),api=link.hostname.startsWith('e.')?'eapi.pcloud.com':'api.pcloud.com',code=link.searchParams.get('code');
      if(!/^[a-zA-Z0-9]+$/.test(code||''))throw Error('Invalid public pCloud link');
      const data=await(await request('https://'+api+'/getpublinkdownload?code='+code)).json();
      if(data.result!==0||!Array.isArray(data.hosts)||!data.path)throw Error('Public pCloud download unavailable: '+(data.error||data.result));
      source='https://'+data.hosts[0]+data.path;
    } else if (/mediafire\.com/.test(new URL(source).hostname)) {
      const page=await request(source),html=await page.text();
      const tag=[...html.matchAll(/<a\b[^>]*>/gi)].map(m=>m[0]).find(t=>/id=["']downloadButton["']/.test(t));
      source=decode(tag?.match(/href=["']([^"']+)/)?.[1]||'');
      if (!source || !new URL(source).hostname.endsWith('.mediafire.com')) throw Error('No public download attachment; source may be removed or blocked');
    }
    const r=await requestAssetStream(source,{timeoutMs:job.timeoutMs,dropboxShare}),max=job.maxBytes || 512 * 1024 ** 2;
    if (/html|json/.test(r.headers.get('content-type')||'')) {r.body.destroy();throw Error('Source returned a page instead of a file');}
    const length=r.headers.get('content-length'),declared=length===null?null:Number(length);
    if(!Number.isSafeInteger(max)||max<1||max>16*1024**3||declared!==null&&(!Number.isSafeInteger(declared)||declared<1)||job.expectedBytes!==undefined&&(!Number.isSafeInteger(job.expectedBytes)||job.expectedBytes<1||job.expectedBytes>max)){r.body.destroy();throw Error('Invalid selected/advertised download size');}
    item.advertisedBytes=declared;item.sourceStatus='reachable-at-check';
    if (declared > max) {r.body.destroy();throw Error('Attachment exceeds selected import size bound');}
    if(job.expectedBytes&&declared!==null&&job.expectedBytes!==declared){r.body.destroy();throw Error('Advertised attachment size changed from the explicit selection');}
    const file={name:job.filename,releaseTag:job.version,archiveRole:job.archiveRole||['Builds'],resolvedUrl:r.url,sourceUrl:job.url,archivedAt:new Date().toISOString(),advertisedBytes:declared};
    console.log(JSON.stringify({id:job.id,phase:'download-start',advertisedBytes:declared,maxBytes:max}));
    const transfer=await streamIntoArchive(r.body,destinationForFile(backup,job,file),{name:job.filename,maxBytes:max,expectedBytes:job.expectedBytes||declared,id:job.id,phase:'download',onProgress:progress=>{item.transfer=progress;item.status='downloading';persist(item);}});
    Object.assign(file,transfer);mirror(item,file);item.files.push(file);item.status='downloaded';item.archiveStatus='archived';item.sourceStatus='downloaded-and-verified';item.transfer={status:'complete',bytes:file.bytes,sha256:file.sha256,retainedTransferPath:file.retainedTransferPath};
    persist(item);await inspectArchive(job,file,item);
  } catch(error) {item.status=item.files.length?'partial':'unavailable';item.error=error.message;if(error.partialTransfer)(item.partialTransfers||=[]).push(error.partialTransfer);item.archiveStatus=item.files.length?'archived-inspection-incomplete':'not-downloaded';}
  persist(item);console.log(JSON.stringify({id:item.id,status:item.status,files:item.files.length,bytes:item.files[0]?.bytes,error:item.error}));
}
async function recoverTransfer(job){
  const item=readReport().items.find(i=>i.id===job.id);
  if(!item||!job.expectedBytes)throw Error('Recovery requires an existing transfer and explicit expectedBytes');
  const target=destinationForFile(backup,job,{name:job.filename,releaseTag:job.version,archiveRole:job.archiveRole||['Builds']});
  const partial=[...(item.partialTransfers||[])].reverse().find(p=>p.bytes===job.expectedBytes&&fs.existsSync(p.path));
  if(!partial)throw Error('No preserved complete transfer matches the selected byte count');
  within(backup,partial.path);
  if(path.dirname(partial.path)!==path.dirname(target)||!path.basename(partial.path).startsWith(job.filename+'.transfer-'))throw Error('Preserved transfer is outside this selected job');
  const stat=fs.statSync(partial.path);if(!stat.isFile()||stat.size!==job.expectedBytes||stat.size>job.maxBytes)throw Error('Preserved transfer size changed');
  const head=Buffer.alloc(8),fd=fs.openSync(partial.path,'r');try{fs.readSync(fd,head,0,8,0);}finally{fs.closeSync(fd);}signature(head,job.filename);
  const sha256=hashFile(partial.path);if(partial.sha256&&sha256!==partial.sha256)throw Error('Preserved transfer hash changed');
  partial.sha256=sha256;partial.transferBytesVerified=true;
  const backupPath=finalizePreserving(partial.path,target,sha256,stat.size);
  const file={name:job.filename,bytes:stat.size,sha256,releaseTag:job.version,archiveRole:job.archiveRole||['Builds'],sourceUrl:job.url,advertisedBytes:job.expectedBytes,backupPath,retainedTransferPath:partial.path,archivedAt:new Date().toISOString(),recoveredCompleteTransfer:true};
  if(/\.pkg$/i.test(file.name))file.pkgHeader=pkgHeader(backupPath);const recoveredHeader=consoleBinaryHeader(backupPath,file.name);if(recoveredHeader)file.consoleBinaryHeader=recoveredHeader;
  if(item.error)(item.attempts||=[]).push({at:item.checkedAt,url:item.url,status:item.status,archiveStatus:item.archiveStatus,error:item.error});
  Object.assign(item,{...job,files:[...item.files,file],status:'downloaded',archiveStatus:'archived',sourceStatus:'downloaded-and-verified',checkedAt:new Date().toISOString(),transfer:{status:'complete',bytes:file.bytes,sha256,retainedTransferPath:partial.path,recoveredCompleteTransfer:true}});delete item.error;
  mirror(item,file);persist(item);console.log(JSON.stringify({id:job.id,phase:'recovered-complete-transfer',bytes:file.bytes,sha256,backupPath}));
  await inspectArchive(job,file,item);persist(item);console.log(JSON.stringify({id:job.id,status:item.status,files:item.files.length,inspection:item.inspection?.status}));
}
async function main() {
  const args=process.argv.slice(2),download=args.includes('--download'),inspect=args.includes('--inspect-only');
  const only=args.find(a=>a.startsWith('--only='))?.slice(7)?.split(',');
  const jobs=JSON.parse(fs.readFileSync(jobsPath,'utf8')).jobs.filter(j=>!only||only.includes(j.id));
  if(only)jobs.sort((a,b)=>only.indexOf(a.id)-only.indexOf(b.id));
  if(args.includes('--recover-transfer')){for(const job of jobs)await recoverTransfer(job);return;}
  if(inspect){for(const job of jobs){const item=readReport().items.find(i=>i.id===job.id),original=item?.files.find(f=>!f.extractedFromSha256);if(!original)throw Error('No preserved original for '+job.id);item.inspection={};await inspectArchive(job,original,item);persist(item);console.log(JSON.stringify({id:item.id,files:item.files.length,inspection:item.inspection.status}));}return;}
  if (!download) {console.log(JSON.stringify(jobs.map(({id,title,url,version,archiveRole})=>({id,title,url,version,archiveRole})),null,2));return;}
  if (!fs.existsSync(backup)) throw Error('Archive root unavailable');
  for (const job of jobs) {const existing=readReport().items.find(i=>i.id===job.id);if(!args.includes('--retry')&&existing?.status==='downloaded'&&existing.files.every(f=>fs.existsSync(f.backupPath))){console.log(JSON.stringify({id:job.id,status:'already-archived'}));continue;}await acquire(job);}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={classifyMember,inspectArchive,persist,streamIntoArchive,finalizePreserving,pkgHeader};
