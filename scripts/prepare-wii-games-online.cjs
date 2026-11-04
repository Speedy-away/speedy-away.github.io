// Scoped official-source intake for Wii game mods and online tools. Never executes downloads.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Readable,Transform}=require('node:stream');const {pipeline}=require('node:stream/promises');
const root=path.resolve(__dirname,'..');
const option=(name,fallback)=>process.argv.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3)||fallback;
const stage=path.resolve(root,option('stage','docs/tmp/wii-games-online'));
const jobsFile=path.resolve(root,option('jobs','docs/wii-games-online-jobs.json'));
if(!stage.startsWith(root+path.sep)||!jobsFile.startsWith(root+path.sep))throw Error('Intake paths must remain inside the workspace');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(45000),headers:{'User-Agent':'whatsite-Wii-source-review/1.0'}});if(!r.ok)throw Error('HTTP '+r.status+' '+url);return Buffer.from(await r.arrayBuffer());}
async function main(){
 fs.mkdirSync(stage,{recursive:true});
 if(process.argv.includes('--research')){
  const pages=[['ctgp','https://www.chadsoft.co.uk/download/'],['newer','https://newerteam.com/wii/download.html'],['newer-specials','https://newerteam.com/wii/specials.html'],['newer-install','https://newerteam.com/wii/help/installation.html'],['riivolution','https://riivolution.github.io/wiki/Riivolution/'],['retrowfc','https://rwfc.net/'],['wiilink','https://wiilink.ca/guide/']];
  for(const [id,url]of pages){try{const bytes=await get(url);fs.writeFileSync(path.join(stage,id+'.html'),bytes);const html=bytes.toString();console.log(JSON.stringify({id,url,links:[...html.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map(x=>x[1]).filter(x=>/mega|\.zip|\.png|\.webp|\.jpg|github|download|guide|install|patcher/i.test(x)).slice(0,70)}));}catch(e){console.log(id+' '+e.message);}}
  const all=JSON.parse((await get('https://hbb1.oscwii.org/api/v3/contents')).toString());const selected=all.filter(x=>/wiimm|wiilink|riivolution|wfc/i.test(x.slug+' '+x.name));
  fs.writeFileSync(path.join(stage,'osc.json'),JSON.stringify(selected,null,2));console.log(JSON.stringify(selected.map(x=>({slug:x.slug,name:x.name,version:x.version,bytes:x.file_size.zip_compressed,url:x.url,platforms:x.supported_platforms,paths:x.subdirectories}))));
  for(const repo of ['Retro-Rewind-Team/rr-launcher','WiiLink24/WiiLink24-Patcher']){try{const r=JSON.parse((await get('https://api.github.com/repos/'+repo+'/releases/latest')).toString());fs.writeFileSync(path.join(stage,repo.split('/')[1]+'-release.json'),JSON.stringify(r,null,2));console.log(JSON.stringify({repo,tag:r.tag_name,assets:r.assets.map(x=>({name:x.name,url:x.browser_download_url,bytes:x.size}))}));}catch(e){console.log(repo+' '+e.message);}}
 }
 if(process.argv.includes('--download')){
  const only=process.argv.find(x=>x.startsWith('--only='))?.slice(7).split(',');
  const jobs=JSON.parse(fs.readFileSync(jobsFile)).jobs.filter(x=>!only||only.includes(x.id));
  const results=[];
  for(const job of jobs){
   const file=path.join(stage,job.filename);let partial=file+'.partial',expectedBytes=job.expectedBytes,start=0;
   try{
    if(!fs.existsSync(file)){
     let stream;
     if(process.argv.includes('--resume')){
      const candidates=fs.readdirSync(stage).filter(x=>x.startsWith(job.filename+'.partial')).map(x=>path.join(stage,x)).sort((a,b)=>fs.statSync(b).size-fs.statSync(a).size);
      if(candidates.length&&fs.statSync(candidates[0]).size){const previous=candidates[0];start=fs.statSync(previous).size;partial=file+'.partial-'+Date.now();fs.copyFileSync(previous,partial,fs.constants.COPYFILE_EXCL);console.log(job.id+' resuming '+start+' bytes; original partial retained');}
      else if(candidates.length)partial=file+'.partial-'+Date.now();
     }
     if(new URL(job.url).hostname==='mega.nz'){
      const {File}=require(path.join(process.env.TEMP,'whatsite-mega-tool/node_modules/megajs'));
      let remote=File.fromURL(job.url);await remote.loadAttributes();
      if(job.megaFilename){remote=remote.children?.find(x=>!x.directory&&x.name===job.megaFilename);if(!remote)throw Error('Requested ready package missing from official folder');}
      expectedBytes=remote.size;
      if(expectedBytes>2*1024**3)throw Error('Official package exceeds two GiB intake bound');
      console.log(job.id+' official package '+remote.name+' '+expectedBytes+' bytes');
      stream=remote.download({start,maxConnections:Number(option('mega-connections','4')),initialChunkSize:4*1024**2,chunkSizeIncrement:4*1024**2,maxChunkSize:16*1024**2,forceHttps:true,handleRetries:(tries,e,cb)=>tries<3?setTimeout(()=>cb(),1000*2**tries):cb(e)});
     }else if(job.kind==='mod'&&expectedBytes>128*1024**2){
      stream=Readable.from((async function*(){
       const rangeMiB=Number(option('range-mib','16'));if(!Number.isFinite(rangeMiB)||rangeMiB<1||rangeMiB>16)throw Error('Range size must be 1–16 MiB');const chunk=rangeMiB*1024**2;
       for(let offset=start;offset<expectedBytes;offset+=chunk*4){
        const ranges=Array.from({length:4},(_,i)=>({begin:offset+i*chunk,end:Math.min(expectedBytes-1,offset+(i+1)*chunk-1)})).filter(x=>x.begin<expectedBytes);
        const buffers=await Promise.all(ranges.map(async range=>{let last;for(let attempt=0;attempt<3;attempt++){try{const response=await fetch(job.url,{headers:{Range:'bytes='+range.begin+'-'+range.end},signal:AbortSignal.timeout(120000)});if(response.status!==206)throw Error('Range HTTP '+response.status);const buffer=Buffer.from(await response.arrayBuffer());if(buffer.length!==range.end-range.begin+1)throw Error('Range length mismatch');return buffer;}catch(e){last=e;if(attempt<2)await new Promise(r=>setTimeout(r,1000*2**attempt));}}throw last;}));
        for(const buffer of buffers)yield buffer;
       }
      })());
     }else{const r=await fetch(job.url,{signal:AbortSignal.timeout(1800000),headers:start?{Range:'bytes='+start+'-'}:{}});if(!r.ok||start&&r.status!==206)throw Error('HTTP '+r.status+' (range required for resume)');expectedBytes=(Number(r.headers.get('content-length'))+start)||expectedBytes;stream=Readable.fromWeb(r.body);}
     let bytes=start,reported=start;const limit=setTimeout(()=>stream.destroy(Error('Transfer timed out; partial preserved')),1800000);
     try{await pipeline(stream,new Transform({transform(chunk,enc,cb){bytes+=chunk.length;if(bytes>2*1024**3)return cb(Error('Size bound exceeded'));if(bytes-reported>64*1024**2){console.log(job.id+' '+Math.round(bytes/1024**2)+' MiB');reported=bytes;}cb(null,chunk);}}),fs.createWriteStream(partial,{flags:start?'a':'wx'}));}finally{clearTimeout(limit);}
     if(expectedBytes&&fs.statSync(partial).size!==expectedBytes)throw Error('Transfer size differs from source');
     fs.renameSync(partial,file);
    }
    const digest=crypto.createHash('sha256'),md5=crypto.createHash('md5');let count=0;for await(const chunk of fs.createReadStream(file)){count+=chunk.length;digest.update(chunk);md5.update(chunk);}const sha256=digest.digest('hex');if(job.expectedMd5&&md5.digest('hex')!==job.expectedMd5)throw Error('Publisher MD5 differs');
    const result={id:job.id,status:'downloaded',filename:job.filename,bytes:count,sha256,sourceUrl:job.url,version:job.version,stagedFile:file};results.push(result);console.log(job.id+' verified '+count+' '+sha256);
   }catch(e){const message=e.message+(e.cause?.message?' · '+e.cause.message:'');const result={id:job.id,status:'inaccessible',sourceUrl:job.url,error:message,partialPreserved:fs.existsSync(partial)};results.push(result);console.log(job.id+' '+message);}
   fs.writeFileSync(path.join(stage,only?'downloads-'+only.join('_')+'.json':'downloads.json'),JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
  }
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
