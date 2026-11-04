// Scoped intake. Downloads are inspected as data and are never executed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const cp = require('node:child_process');
const { createArchive } = require('./console-expansion-archive.cjs');
const root = path.resolve(__dirname, '..');
const scope = 'xbox360-more';
const cataloguePath = path.join(root, 'docs/xbox360-more-library.json');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const sevenZip = 'C:/Program Files/7-Zip/7z.exe';
function verifyXzp(buffer) {
  if(buffer.subarray(0,4).toString()!=='XUIZ'||buffer.readUInt32BE(4)!==1||buffer.readUInt32BE(8)!==buffer.length) throw Error('Invalid Xbox 360 XUIZ header/version/size');
  if(!buffer.includes(Buffer.from('Aurora_Main.xur','utf16le').swap16())) throw Error('Missing Aurora skin scene');
  return {magic:'XUIZ',version:1,declaredBytes:buffer.readUInt32BE(8),bytes:buffer.length};
}
function inspectSevenZip(staged,item) {
  if(!fs.existsSync(sevenZip))throw Error('7-Zip is required for this archive format');
  cp.execFileSync(sevenZip,['t','-bso0','-bsp0','--',staged],{maxBuffer:2*1024*1024});
  const listing=cp.execFileSync(sevenZip,['l','-slt','-ba','--',staged],{encoding:'utf8',maxBuffer:8*1024*1024});
  const entries=listing.split(/\r?\n\r?\n/).filter(x=>/^Path = /m.test(x)).map(block=>({name:block.match(/^Path = (.+)$/m)[1].trim(),bytes:Number(block.match(/^Size = (\d+)$/m)?.[1]||0),folder:/^Folder = \+$/m.test(block)}));
  if(entries.length>10000||entries.reduce((n,x)=>n+x.bytes,0)>1024*1024*1024)throw Error('Archive content exceeds inspection bounds');
  for(const entry of entries)if(/(^[\\/]|^[A-Za-z]:|(?:^|[\\/])\.\.(?:[\\/]|$))/.test(entry.name))throw Error('Unsafe archive path');
  const wanted=entries.filter(x=>item.group==='skins'?/\.xzp$/i.test(x.name):/\.xex$/i.test(x.name));
  if(!wanted.length)throw Error('Archive contains no '+(item.group==='skins'?'XZP skins':'XEX build'));
  for(const required of item.requiredEntries||[])if(!entries.some(x=>x.name.replaceAll('\\','/').endsWith(required)&&x.bytes>0))throw Error('Missing required companion '+required);
  const checked=wanted.map(entry=>{const bytes=cp.execFileSync(sevenZip,['x','-so','-bso0','-bsp0',staged,entry.name],{maxBuffer:128*1024*1024});if(bytes.length!==entry.bytes)throw Error('Archive entry size mismatch');if(item.group==='skins')verifyXzp(bytes);else if(bytes.subarray(0,4).toString()!=='XEX2')throw Error('Invalid XEX2: '+entry.name);return {name:entry.name,bytes:bytes.length,sha256:hash(bytes)};});
  return {type:item.format.split(' / ')[0]+' with '+(item.group==='skins'?'Xbox 360 XZP skins':'native XEX2'),entryCount:entries.length,crcTestPassed:true,[item.group==='skins'?'skins':'executables']:checked};
}
function zipEntries(buffer) {
  let end = -1;
  for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--) if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0) throw Error('Missing ZIP directory');
  const count=buffer.readUInt16LE(end+10), records=[];
  let at=buffer.readUInt32LE(end+16), total=0;
  if(count>10000) throw Error('ZIP file count exceeds bound');
  for(let i=0;i<count;i++) {
    if(buffer.readUInt32LE(at)!==0x02014b50) throw Error('Invalid ZIP directory record');
    const method=buffer.readUInt16LE(at+10), compressed=buffer.readUInt32LE(at+20), size=buffer.readUInt32LE(at+24);
    const n=buffer.readUInt16LE(at+28), extra=buffer.readUInt16LE(at+30), comment=buffer.readUInt16LE(at+32);
    const name=buffer.subarray(at+46,at+46+n).toString('utf8'), local=buffer.readUInt32LE(at+42);
    if(/(^[\\/]|^[A-Za-z]:|(?:^|[\\/])\.\.(?:[\\/]|$))/.test(name)) throw Error('Unsafe ZIP path: '+name);
    total+=size; if(total>1024*1024*1024) throw Error('ZIP expanded size exceeds bound');
    if(buffer.readUInt32LE(local)!==0x04034b50) throw Error('Invalid ZIP local record');
    const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);
    records.push({name,size,read(){const packed=buffer.subarray(start,start+compressed);const out=method===0?packed:method===8?zlib.inflateRawSync(packed,{maxOutputLength:Math.max(size,1)}):null;if(!out||out.length!==size)throw Error('ZIP compression/size mismatch: '+name);return out;}});
    at+=46+n+extra+comment;
  }
  return records;
}
function verify(buffer,item,staged) {
  if(item.expectedBytes&&buffer.length!==item.expectedBytes) throw Error('Upstream size mismatch');
  if(item.expectedSha256&&hash(buffer)!==item.expectedSha256) throw Error('Upstream SHA-256 mismatch');
  if(item.format==='Pinned runtime asset') {
    if(!item.expectedSha256||!item.expectedBytes||!buffer.length)throw Error('Runtime asset needs a pinned size and SHA-256');
    return {type:'Manifest-pinned runtime asset',bytes:buffer.length,header:buffer.subarray(0,8).toString('hex')};
  }
  if(item.format==='CFLJSON') {
    const layout=JSON.parse(buffer.toString('utf8'));
    if(!layout||typeof layout!=='object'||!Object.keys(layout).length)throw Error('Empty Aurora coverflow layout');
    return {type:'Aurora CFLJSON layout',bytes:buffer.length,keys:Object.keys(layout)};
  }
  if(item.format==='XZP') {
    return {type:'Xbox 360 XZP',...verifyXzp(buffer)};
  }
  if(item.format.startsWith('7Z')||item.format==='ZIP / XZP'||item.format==='RAR / XEX'&&item.id!=='aurora')return inspectSevenZip(staged,item);
  if(item.format==='XEX') {
    if(buffer.subarray(0,4).toString()!=='XEX2'||buffer.length<24||buffer.readUInt32BE(16)>=buffer.length)throw Error('Invalid XEX2 executable header');
    return {type:'Native XEX2',magic:'XEX2',bytes:buffer.length};
  }
  if(item.format==='RAR / XEX') {
    if(buffer.subarray(0,6).toString('hex')!=='526172211a07') throw Error('Invalid RAR header');
    const names=cp.execFileSync('tar.exe',['-tf',staged],{encoding:'utf8',maxBuffer:8*1024*1024}).trim().split(/\r?\n/);
    const launch=names.find(n=>/(?:^|\/)Aurora\.xex$/i.test(n));
    if(!launch) throw Error('Missing Aurora.xex');
    const executable=cp.execFileSync('tar.exe',['-xOf',staged,launch],{maxBuffer:64*1024*1024});
    if(executable.subarray(0,4).toString()!=='XEX2') throw Error('Invalid Aurora XEX2');
    return {type:'RAR with native XEX2',entryCount:names.length,launch,executableSha256:hash(executable)};
  }
  if(item.format==='ZIP update') {
    const records=zipEntries(buffer);
    if(!records.some(x=>x.size>0))throw Error('Empty update archive');
    for(const required of item.requiredEntries||[])if(!records.some(x=>x.name.replaceAll('\\','/').endsWith(required)&&x.size>0))throw Error('Missing update file '+required);
    for(const required of item.requiredPeEntries||[]){const bytes=records.find(x=>x.name.replaceAll('\\','/').endsWith(required)).read();if(bytes.subarray(0,2).toString()!=='MZ'||bytes.length<64)throw Error('Invalid update PE image');const pe=bytes.readUInt32LE(60);if(pe>bytes.length-24||bytes.subarray(pe,pe+4).toString('hex')!=='50450000')throw Error('Invalid update PE signature');}
    return {type:'ZIP application update',entryCount:records.length,files:records.filter(x=>x.size>0).map(x=>({name:x.name,bytes:x.size,sha256:hash(x.read())}))};
  }
  const records=zipEntries(buffer), xex=records.filter(x=>/\.xex$/i.test(x.name));
  if(!xex.length) throw Error('No native XEX executable in release ZIP');
  for(const record of xex) if(record.read().subarray(0,4).toString()!=='XEX2') throw Error('Invalid XEX2: '+record.name);
  for(const required of item.requiredEntries||[])if(!records.some(x=>x.name.replaceAll('\\','/').endsWith(required)&&x.size>0))throw Error('Missing required companion '+required);
  for(const expected of item.expectedFiles||[]) {
    const found=records.find(x=>x.name===expected.path); if(!found||found.size!==expected.size||hash(found.read())!==expected.sha256)throw Error('Upstream manifest file mismatch: '+expected.path);
  }
  return {type:'ZIP with native XEX2',entryCount:records.length,uncompressedBytes:records.reduce((a,x)=>a+x.size,0),executables:xex.map(x=>({name:x.name,bytes:x.size,sha256:hash(x.read())})),upstreamFileHashesVerified:(item.expectedFiles||[]).length};
}
async function get(url,max=128*1024*1024) {
  const response=await fetch(url,{headers:{'User-Agent':'whatsite-xbox360-library'},signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw Error('HTTP '+response.status+' '+url);
  if(Number(response.headers.get('content-length'))>max)throw Error('Download exceeds bound');
  const buffer=Buffer.from(await response.arrayBuffer());if(buffer.length>max)throw Error('Download exceeds bound');
  return {buffer,resolvedUrl:response.url};
}
async function main() {
  if(!process.argv.includes('--download'))throw Error('Use --download to fetch and archive the scoped ready builds.');
  const data=JSON.parse(fs.readFileSync(cataloguePath,'utf8')), archive=createArchive();
  const ids=process.argv.find(x=>x.startsWith('--ids='))?.slice(6).split(',');
  if(ids&&ids.some(id=>!data.resources.some(x=>x.id===id)))throw Error('Unknown selected resource ID');
  const stage=path.join(root,'docs/tmp/xbox360-more');fs.mkdirSync(stage,{recursive:true});
  for(const item of data.resources.filter(x=>!ids||ids.includes(x.id))) {
    try {
      const filename=item.fileName||decodeURIComponent(new URL(item.downloadUrl).pathname.split('/').pop());
      if(path.basename(filename)!==filename)throw Error('Invalid release filename');
      const staged=item.sourceFile?path.resolve(root,item.sourceFile):path.join(stage,item.id+'-'+filename);
      if(item.sourceFile&&!staged.startsWith(path.join(root,'docs/tmp')+path.sep))throw Error('Staged file must stay in docs/tmp');
      let buffer,resolvedUrl;
      if(fs.existsSync(staged)){buffer=fs.readFileSync(staged);resolvedUrl=item.downloadUrl;}
      else {if(item.sourceFile)throw Error('Missing staged author download');({buffer,resolvedUrl}=await get(item.downloadUrl,item.maxBytes||128*1024*1024));fs.writeFileSync(staged,buffer,{flag:'wx'});}
      const formatVerification=verify(buffer,item,staged);
      const result=await archive.archiveFile({scope,item:{id:scope+'-'+item.id,title:item.title,url:item.source,platform:'Xbox 360',category:[item.group==='skins'?'Themes':['games','ports'].includes(item.group)?'Games':item.group==='emulators'?'Emulators':'Tools',item.title],pages:['console/xbox360/library.html']},file:{name:filename,sourceUrl:item.downloadUrl,version:item.fileVersion||item.version,archiveRole:['Builds'],expectedBytes:buffer.length,expectedSha256:hash(buffer),format:item.format,compatibility:item.runtime,derivedFrom:item.derivedFrom,upstreamUploadId:item.upstreamUploadId},sourceFile:staged});
      item.file=result.publicFile;item.status='ready';item.formatVerification=formatVerification;delete item.attempt;
      console.log(item.id+': '+buffer.length+' bytes; '+formatVerification.type+'; archived');
      if(item.localDownloadUrl){
        if(!/^\/downloads\/xbox360\/[A-Za-z0-9._-]+\.zip$/.test(item.localDownloadUrl))throw Error('Invalid scoped download mirror path');
        const destination=path.join(root,item.localDownloadUrl);fs.mkdirSync(path.dirname(destination),{recursive:true});
        if(fs.existsSync(destination)){if(hash(fs.readFileSync(destination))!==hash(buffer))throw Error('Refusing to replace different mirrored build');}
        else fs.copyFileSync(staged,destination,fs.constants.COPYFILE_EXCL);
      }
      for(const component of item.components||[]){
        const sourceFile=path.resolve(root,component.sourceFile);
        if(!sourceFile.startsWith(path.join(root,'docs/tmp')+path.sep))throw Error('Runtime component must be staged in docs/tmp');
        const bytes=fs.readFileSync(sourceFile);component.formatVerification=verify(bytes,component,sourceFile);
        const saved=await archive.archiveFile({scope,item:{id:scope+'-'+item.id,title:item.title,url:item.source,platform:'Xbox 360',category:['Tools',item.title],pages:['console/xbox360/library.html']},file:{name:component.fileName,sourceUrl:component.downloadUrl,version:item.fileVersion||item.version,archiveRole:['Builds'],expectedBytes:bytes.length,expectedSha256:hash(bytes),format:component.format,componentPath:component.path},sourceFile});
        component.file=saved.publicFile;
      }
      if(item.components?.length)console.log(item.id+': '+item.components.length+' original runtime components archived');
      for(const companion of item.companions||[]) {
        const fileName=companion.fileName||decodeURIComponent(new URL(companion.downloadUrl).pathname.split('/').pop());
        if(path.basename(fileName)!==fileName)throw Error('Invalid companion filename');
        const sourceFile=companion.sourceFile?path.resolve(root,companion.sourceFile):path.join(stage,item.id+'-'+fileName);
        if(!sourceFile.startsWith(path.join(root,'docs/tmp')+path.sep))throw Error('Companion must be staged in docs/tmp');
        if(!fs.existsSync(sourceFile)){if(companion.sourceFile)throw Error('Missing staged companion');const {buffer}=await get(companion.downloadUrl,companion.maxBytes||128*1024*1024);fs.writeFileSync(sourceFile,buffer,{flag:'wx'});}
        const bytes=fs.readFileSync(sourceFile),formatVerification=verify(bytes,companion,sourceFile);
        const saved=await archive.archiveFile({scope,item:{id:scope+'-'+item.id,title:item.title,url:item.source,platform:'Xbox 360',category:[item.group==='skins'?'Themes':'Tools',item.title],pages:['console/xbox360/library.html']},file:{name:fileName,sourceUrl:companion.downloadUrl,version:companion.version||item.version,archiveRole:['Builds'],expectedBytes:bytes.length,expectedSha256:hash(bytes),format:companion.format},sourceFile});
        companion.file=saved.publicFile;companion.formatVerification=formatVerification;
        console.log(item.id+' companion: '+bytes.length+' bytes; '+formatVerification.type+'; archived');
      }
    } catch(error) {
      item.status='unavailable';item.attempt={checkedAt:new Date().toISOString(),url:item.downloadUrl,error:error.message};
      await archive.appendInventory({scope,items:[{id:scope+'-'+item.id,title:item.title,url:item.source,platform:'Xbox 360',category:['Tools'],pages:['console/xbox360/library.html'],status:'unavailable',attempts:[item.attempt],files:[]}]});
      console.error(item.id+': '+error.message);
    }
    if(item.imageUrl) {
      try {
        const local='/assets/images/xbox360-more/'+item.id+path.extname(new URL(item.imageUrl).pathname);
        const dest=path.join(root,local);fs.mkdirSync(path.dirname(dest),{recursive:true});
        const buffer=fs.existsSync(dest)?fs.readFileSync(dest):(await get(item.imageUrl,8*1024*1024)).buffer;
        if(item.imageSha256&&hash(buffer)!==item.imageSha256) throw Error('Screenshot hash mismatch');
        if(!fs.existsSync(dest))fs.writeFileSync(dest,buffer,{flag:'wx'});
        item.image={local,sourceUrl:item.imageUrl,credit:item.imageCredit||item.author,bytes:buffer.length,sha256:hash(buffer)};
      }catch(error){item.imageAttempt={url:item.imageUrl,error:error.message};console.error(item.id+' image: '+error.message);}
    }
    fs.writeFileSync(cataloguePath,JSON.stringify(data,null,2)+'\n');
  }
  const report={checkedAt:new Date().toISOString(),scope,ready:data.resources.filter(x=>x.status==='ready').length,unavailable:data.resources.filter(x=>x.status!=='ready').map(x=>({id:x.id,attempt:x.attempt})),files:data.resources.filter(x=>x.status==='ready').map(x=>({id:x.id,...x.file,formatVerification:x.formatVerification})),downloadedPayloadsExecuted:false,physicalHardwareTested:false};
  fs.mkdirSync(path.join(root,'docs/qa'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/xbox360-more-artifacts.json'),JSON.stringify(report,null,2)+'\n');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={zipEntries,verify,verifyXzp};
