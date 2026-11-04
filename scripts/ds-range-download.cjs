// Bounded HTTP range transport for the original public skin URL. Every chunk
// must have the requested Content-Range, byte count, total size and stable ETag.
// Partial responses remain in staging; this never executes downloaded content.
const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process');
const root=path.resolve(__dirname,'..','tmp','ds-dsi-more','transport');
const limit=150*1024*1024,chunkSize=256*1024;
async function rangedDownload(url){
 fs.mkdirSync(root,{recursive:true});const folder=fs.mkdtempSync(path.join(root,'range-'));
 async function chunk(start,end,expected){
  let last;
  for(let attempt=0;attempt<2;attempt++){
   const stem=path.join(folder,`${start}-${end}-${attempt}`),file=stem+'.bin',headers=stem+'.headers';
   try{
    const status=await new Promise((resolve,reject)=>execFile('curl.exe',['--http1.1','--location','--fail','--silent','--show-error','--connect-timeout','15','--max-time','35','--max-filesize',String(chunkSize*2),'--header','Accept-Encoding: identity','--range',`${start}-${end}`,'--dump-header',headers,'--output',file,'--write-out','%{http_code}',url],{timeout:40000,maxBuffer:1024*1024},(error,stdout,stderr)=>error?reject(Error(String(stderr||error.message).trim())):resolve(stdout.trim())));
    const head=fs.readFileSync(headers,'utf8'),ranges=[...head.matchAll(/^content-range:\s*bytes (\d+)-(\d+)\/(\d+)/gim)],match=ranges.at(-1),etag=[...head.matchAll(/^etag:\s*(.+)$/gim)].at(-1)?.[1].trim();
    if(status!=='206'||!match||Number(match[1])!==start)throw Error('Server did not honor requested byte range');
    const total=Number(match[3]),actualEnd=Math.min(end,total-1),bytes=fs.readFileSync(file);
    if(total<=0||total>limit||Number(match[2])!==actualEnd||bytes.length!==actualEnd-start+1)throw Error('Range size/bounds mismatch');
    if(!etag||expected&&(expected.total!==total||expected.etag!==etag))throw Error('Remote archive identity changed between chunks');
    return {bytes,total,etag};
   }catch(error){last=error;}
  }
  throw Error(`Range ${start}-${end} failed (staging preserved ${folder}): ${last.message}`);
 }
 const first=await chunk(0,chunkSize-1),parts=[first.bytes],jobs=[];
 for(let start=chunkSize;start<first.total;start+=chunkSize)jobs.push({start,end:Math.min(start+chunkSize-1,first.total-1)});
 for(let i=0;i<jobs.length;i+=4){
  const results=await Promise.allSettled(jobs.slice(i,i+4).map(j=>chunk(j.start,j.end,first)));
  for(const result of results){if(result.status==='rejected')throw result.reason;parts.push(result.value.bytes);}
 }
 const bytes=Buffer.concat(parts);if(bytes.length!==first.total)throw Error('Assembled archive size mismatch');
 return {bytes,resolvedUrl:url};
}
module.exports={rangedDownload};
