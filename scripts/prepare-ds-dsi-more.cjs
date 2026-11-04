// Downloads official ready assets, inspects them as data, and (only with
// --archive) appends this scope through the shared concurrency-safe intake.
// Never launches a downloaded program.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const scope='ds-dsi-more';
const seven='C:/Program Files/7-Zip/7z.exe';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function crc16(bytes){let crc=0xffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=crc&1?(crc>>>1)^0xa001:crc>>>1;}return crc;}
function inspectNds(bytes,name){
 if(bytes.length<0x200)throw Error('Truncated native header: '+name);
 const regions=[['ARM9',0x20,0x2c],['ARM7',0x30,0x3c]].map(([label,off,len])=>({label,offset:bytes.readUInt32LE(off),bytes:bytes.readUInt32LE(len)}));
 for(const r of regions)if(r.offset<0x200||r.bytes===0||r.offset+r.bytes>bytes.length)throw Error('Native code region outside file: '+name+' '+r.label);
 return {name,bytes:bytes.length,sha256:sha(bytes),format:'Nintendo DS executable',title:bytes.subarray(0,12).toString('ascii').replace(/\0/g,'').trim(),unitCode:bytes[0x12],headerCrcValid:crc16(bytes.subarray(0,0x15e))===bytes.readUInt16LE(0x15e),regions,bannerOffset:bytes.readUInt32LE(0x68)};
}
function crc32(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let k=0;k<8;k++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;}return (crc^0xffffffff)>>>0;}
function pngChunk(type,data){const t=Buffer.from(type),n=Buffer.alloc(4),c=Buffer.alloc(4);n.writeUInt32BE(data.length);c.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([n,t,data,c]);}
function bannerPng(bytes){
 const offset=bytes.readUInt32LE(0x68);if(offset<0x200||offset+0x240>bytes.length)return null;
 const rows=Buffer.alloc(32*(1+32*4));
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  const p=((y>>3)*4+(x>>3))*32+(y&7)*4+((x&7)>>1);
  const i=(bytes[offset+0x20+p]>>((x&1)*4))&15;
  const col=bytes.readUInt16LE(offset+0x220+i*2),d=y*129+1+x*4;
  rows[d]=Math.round((col&31)*255/31);rows[d+1]=Math.round(((col>>5)&31)*255/31);rows[d+2]=Math.round(((col>>10)&31)*255/31);rows[d+3]=i?255:0;
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(32,0);header.writeUInt32BE(32,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),pngChunk('IHDR',header),pngChunk('IDAT',zlib.deflateSync(rows)),pngChunk('IEND',Buffer.alloc(0))]);
}
function exclusive(file,bytes){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 if(fs.existsSync(file)){if(sha(fs.readFileSync(file))!==sha(bytes))throw Error('Refusing to replace different existing bytes: '+file);return;}
 fs.writeFileSync(file,bytes,{flag:'wx'});
}
async function get(url){
 if(process.argv.includes('--ranges')&&/\.7z$/i.test(new URL(url).pathname))return require('./ds-range-download.cjs').rangedDownload(url);
 if(process.argv.includes('--curl')){
  // Optional transport for environments where Node's fetch stalls. Each
  // response has a fresh staging destination; no prior bytes are replaced.
  const base=path.join(root,'tmp',scope,'transport');fs.mkdirSync(base,{recursive:true});
  const folder=fs.mkdtempSync(path.join(base,'curl-')),file=path.join(folder,'response.bin');
  try{execFileSync('curl.exe',['--location','--fail','--silent','--show-error','--connect-timeout','15','--max-time','60','--max-filesize',String(150*1024*1024),'--output',file,url],{maxBuffer:1024*1024,timeout:65000});}
  catch(error){throw Error('curl transfer failed; staging retained at '+folder+': '+String(error.stderr||error.message).trim());}
  const bytes=fs.readFileSync(file);if(bytes.length>150*1024*1024)throw Error('Asset exceeds bound');
  return {bytes,resolvedUrl:url};
 }
 const response=await fetch(url,{signal:AbortSignal.timeout(90000)});if(!response.ok)throw Error('HTTP '+response.status+' '+url);
 const length=Number(response.headers.get('content-length'));if(length>150*1024*1024)throw Error('Asset exceeds bound');
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>150*1024*1024)throw Error('Asset exceeds bound');
 if(/text\/html/.test(response.headers.get('content-type')||''))throw Error('HTML is not a ready asset: '+url);
 return {bytes,resolvedUrl:response.url};
}
function unpack(file,bytes){
 const isZip=bytes.subarray(0,4).equals(Buffer.from('504b0304','hex')),is7z=bytes.subarray(0,6).equals(Buffer.from('377abcaf271c','hex'));
 if(!isZip&&!is7z)throw Error('Bad archive signature '+file);
 const listing=execFileSync(seven,['l','-slt','-ba',file],{encoding:'utf8',maxBuffer:6*1024*1024});
 const names=[...listing.matchAll(/^Path = (.+)$/gm)].map(m=>m[1].trim());
 if(names.length>1500||names.some(n=>n.replaceAll('\\','/').split('/').includes('..')||/^(?:[A-Za-z]:|[\\/])/.test(n)))throw Error('Unsafe archive paths');
 const sizes=[...listing.matchAll(/^Size = (\d+)$/gm)].map(m=>Number(m[1]));if(sizes.reduce((a,b)=>a+b,0)>200*1024*1024)throw Error('Archive expansion exceeds bound');
 if(/^Symbolic Link =|^Hard Link =/m.test(listing))throw Error('Archive link entries not allowed');
 execFileSync(seven,['t','-bd',file],{maxBuffer:1024*1024});
 const dest=path.join(root,'tmp',scope,'inspect',sha(bytes));
 if(!fs.existsSync(dest)){fs.mkdirSync(dest,{recursive:true});execFileSync(seven,['x','-bd','-y','-o'+dest,file],{maxBuffer:1024*1024});}
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('Unexpected symlink');return e.isDirectory()?walk(p):[p];});
 const paths=walk(dest);
 return {names,paths,dest,container:isZip?'ZIP':'7z'};
}
async function main(){
 if(!process.argv.includes('--download'))throw Error('Use --download; add --archive only with normal F: write permission.');
 const catalog=JSON.parse(fs.readFileSync(path.join(root,'docs/ds-dsi-more-catalog.json')));
 const archive=process.argv.includes('--archive')?require('./console-expansion-archive.cjs').createArchive():null;
 const outputPath=path.join(root,'docs/ds-dsi-more-downloads.json');
 const previous=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):{entries:[],attempts:[],artwork:[]};
 const output={...previous,scope,checkedAt:new Date().toISOString(),attemptHistory:[...(previous.attemptHistory||[]),...(previous.attempts||[])],attempts:[]};
 for(const app of catalog.entries){
  const existing=output.entries.find(e=>e.id===app.id);
  if(process.argv.includes('--only-new')&&existing&&app.files.every(expected=>existing.files.some(f=>f.name===expected.name&&f.sourceUrl===expected.url&&f.archived))&&output.artwork.some(a=>a.id===app.id))continue;
  const entry={id:app.id,files:[...(existing?.files||[])]};let icon=null,iconSource=null;
  for(const file of app.files){
   try{
    const cached=path.join(root,'tmp',scope,'fetched',sha(Buffer.from(file.url)),file.name);
    let result;if(fs.existsSync(cached))result={bytes:fs.readFileSync(cached),resolvedUrl:file.url};else{result=await get(file.url);exclusive(cached,result.bytes);}
    const {bytes}=result,local=`/downloads/${scope}/${app.id}/${app.version.replace(/[^A-Za-z0-9._-]/g,'_')}/${file.name}`;
    let contents=[],native=[];
    if(/\.(?:zip|7z)$/i.test(file.name)){
     const unpacked=unpack(cached,bytes);contents=unpacked.names;
     const executablePaths=unpacked.paths.filter(p=>/\.(?:nds|dsi)$/i.test(p)&&!path.basename(p).startsWith('._')&&!p.includes('__MACOSX'));
     if(app.id==='hbmenu')executablePaths.sort((a,b)=>Number(path.basename(b).toUpperCase()==='BOOT.NDS')-Number(path.basename(a).toUpperCase()==='BOOT.NDS'));
     for(const p of executablePaths){const b=fs.readFileSync(p);native.push(inspectNds(b,path.relative(unpacked.dest,p).replaceAll('\\','/')));if(!icon){icon=bannerPng(b);iconSource=file.url;}}
     if(file.kind==='data'){
      if(!Array.isArray(file.requiredContents)||!file.requiredContents.length||!app.files.some(f=>f.kind!=='data'))throw Error('Data bundle must accompany an executable and declare required files');
      const normalized=contents.map(n=>n.replaceAll('\\','/'));
      for(const required of file.requiredContents)if(!normalized.includes(required))throw Error('Required app data missing: '+required);
     }else if(app.group!=='skins'&&!native.length)throw Error('No native NDS/DSi executable in ready archive');
     if(app.group==='skins'&&!contents.some(n=>/theme\.ini$/i.test(n)))throw Error('Theme has no theme.ini');
    }else{native.push(inspectNds(bytes,file.name));if(!icon){icon=bannerPng(bytes);iconSource=file.url;}}
    exclusive(path.join(root,local),bytes);
    const verified={...file,sourceUrl:file.url,resolvedUrl:result.resolvedUrl,local,version:app.version,bytes:bytes.length,sha256:sha(bytes),contents,native};
    if(archive){const saved=await archive.archiveFile({scope,item:{id:scope+'-'+app.id,title:app.title,url:app.project,platform:'Nintendo DS',category:app.group==='skins'?['Themes','TWiLight Menu++']:app.group==='games'?['Games',app.title]:['Homebrew',app.group==='emulators'?'Emulators':'Tools'],pages:['console/retro/ds.html']},file:{name:file.name,sourceUrl:file.url,version:app.version,archiveRole:['Builds'],local,format:file.format,expectedBytes:bytes.length,expectedSha256:verified.sha256,compatibility:app.models.join('; ')},sourceFile:cached});verified.archived=true;verified.archiveReused=saved.reused;}
    const priorIndex=entry.files.findIndex(f=>f.local===verified.local&&f.sha256===verified.sha256);if(priorIndex>=0)entry.files[priorIndex]={...entry.files[priorIndex],...verified};else entry.files.push(verified);console.log(app.id,file.name,bytes.length,archive?'archived':'staged');
   }catch(error){output.attempts.push({id:app.id,url:file.url,status:'unavailable',error:error.message,checkedAt:new Date().toISOString()});console.error(app.id,error.message);}
  }
  const artLocal=`/assets/images/${scope}/${app.id==='hbmenu'?'hbmenu-boot':app.id}.png`;
  const newArt=[];
  try{
   const oldArt=output.artwork.find(a=>a.id===app.id);
   if(oldArt&&(!app.artworkUrl||oldArt.sourceUrl===app.artworkUrl)&&fs.existsSync(path.join(root,oldArt.local))&&sha(fs.readFileSync(path.join(root,oldArt.local)))===oldArt.sha256){ /* Reuse the previously verified original artwork. */ }
   else if(app.artworkUrl){const a=await get(app.artworkUrl);if(!a.bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))throw Error('Artwork is not PNG');exclusive(path.join(root,artLocal),a.bytes);newArt.push({id:app.id,local:artLocal,sourceUrl:app.artworkUrl,credit:app.artworkCredit,sha256:sha(a.bytes),type:app.artworkType||'logo'});}
   else if(icon){exclusive(path.join(root,artLocal),icon);newArt.push({id:app.id,local:artLocal,sourceUrl:iconSource,credit:`${app.title} authors · original packaged Nintendo DS banner icon`,sha256:sha(icon),type:'banner-icon'});}
  }catch(error){output.attempts.push({id:app.id,status:'artwork unavailable',url:app.artworkUrl,error:error.message});}
  for(const art of newArt){const i=output.artwork.findIndex(a=>a.id===art.id);if(i>=0)output.artwork[i]=art;else output.artwork.push(art);}
  const entryIndex=output.entries.findIndex(e=>e.id===entry.id);if(entryIndex>=0)output.entries[entryIndex]=entry;else output.entries.push(entry);
  fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n');
 }
 if(output.entries.some(e=>!e.files.length)||output.attempts.length)process.exitCode=1;
}
module.exports={inspectNds,bannerPng,crc16};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
