// Bounded public pCloud attachment transfer. Preserve every partial; execute no payloads.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {destinationForFile}=require('./download-archive-layout.cjs');
const {persist}=require('./archive-ps3-expansion.cjs');
const root=path.resolve(__dirname,'..'),backup=path.resolve('F:/whatsite-backup-downloads-etc');
async function main(){
 const id=process.argv.find(arg=>arg.startsWith('--id='))?.slice(5);
 const job=JSON.parse(fs.readFileSync(path.join(root,'docs/ps3-expansion-download-jobs.json'))).jobs.find(item=>item.id===id);
 if(!job||job.platform!=='PS3'||!Number.isSafeInteger(job.expectedBytes)||job.expectedBytes<1||job.expectedBytes>job.maxBytes||job.maxBytes>1024**3)throw Error('Require an approved bounded PS3 job');
 const link=new URL(job.url);if(link.hostname!=='e.pcloud.link'||!link.searchParams.get('code'))throw Error('Require an explicit public EU pCloud link');
 const target=destinationForFile(backup,job,{name:job.filename,releaseTag:job.version,archiveRole:job.archiveRole}),directory=path.dirname(target);
 const relative=path.relative(backup,target);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Target escapes archive');
 fs.mkdirSync(directory,{recursive:true});const realRelative=path.relative(fs.realpathSync(backup),fs.realpathSync(directory));if(realRelative.startsWith('..')||path.isAbsolute(realRelative))throw Error('Target resolves outside archive');
 const latest=JSON.parse(fs.readFileSync(path.join(root,'docs/ps3-expansion-download-inventory.json'))),old=latest.items.find(item=>item.id===id);
 if(old?.status==='downloaded')throw Error('Already archived; do not create another transfer');
 const item={...old,...job,files:old?.files||[],partialTransfers:[...(old?.partialTransfers||[])],status:'downloading',archiveStatus:'downloading',checkedAt:new Date().toISOString()};
 for(const name of fs.readdirSync(directory).filter(name=>name.startsWith(job.filename+'.transfer-')&&name.endsWith('.partial'))){const filename=path.join(directory,name),stat=fs.statSync(filename);if(stat.isFile()&&!item.partialTransfers.some(entry=>entry.path===filename))item.partialTransfers.push({path:filename,bytes:stat.size,expectedBytes:job.expectedBytes,phase:'preserved-previous-transfer',at:stat.mtime.toISOString()});}
 const info=await(await fetch('https://eapi.pcloud.com/getpublinkdownload?code='+encodeURIComponent(link.searchParams.get('code')),{signal:AbortSignal.timeout(20000)})).json();
 if(info.result!==0||!info.path?.startsWith('/')||!Array.isArray(info.hosts)||!info.hosts.length||!info.hosts.every(host=>/^[a-z0-9.-]+\.pcloud\.com$/i.test(host)))throw Error('Public attachment host unavailable');
 const pending=target+'.transfer-range-'+crypto.randomBytes(8).toString('hex')+'.partial',fd=fs.openSync(pending,'wx+'),chunkBytes=4*1024**2,count=Math.ceil(job.expectedBytes/chunkBytes),completed=new Set();
 let next=0,bytes=0,aborted=false;const controllers=new Set(),rangeEtags={};
 const progress=()=>{item.transfer={path:pending,phase:'public-http-ranges',bytes,expectedBytes:job.expectedBytes,completedRanges:completed.size,totalRanges:count};persist(item);console.log(JSON.stringify({id,phase:'public-http-ranges',bytes,expectedBytes:job.expectedBytes,completedRanges:completed.size,totalRanges:count}));};
 progress();
 try{
  async function worker(index){while(!aborted){const part=next++;if(part>=count)return;const start=part*chunkBytes,end=Math.min(job.expectedBytes-1,start+chunkBytes-1);let data;
   for(let attempt=0;attempt<3;attempt++){
    const controller=new AbortController();controllers.add(controller);const timeout=setTimeout(()=>controller.abort(),45000);
    try{const host=info.hosts[(index+attempt)%info.hosts.length],headers={Range:'bytes='+start+'-'+end};
     const response=await fetch('https://'+host+info.path,{headers,signal:controller.signal});
     if(response.status!==206||response.headers.get('content-range')!==`bytes ${start}-${end}/${job.expectedBytes}`){await response.body?.cancel();throw Error('Attachment range or total size changed');}
     // This service emits different ETags for different ranges. They are recorded
     // per response; exact ranges, complete byte coverage and final archive CRC
     // establish transfer integrity instead of treating a chunk tag as a file tag.
     const current=response.headers.get('etag');if(current)rangeEtags[part]=current;
     data=Buffer.from(await response.arrayBuffer());if(data.length!==end-start+1)throw Error('Range body was truncated');break;
    }catch(error){if(attempt===2||aborted)throw error;}finally{clearTimeout(timeout);controllers.delete(controller);}
   }
   if(aborted)return;let written=0;while(written<data.length)written+=fs.writeSync(fd,data,written,data.length-written,start+written);
   completed.add(part);bytes+=data.length;if(completed.size%16===0||completed.size===count)progress();
  }}
  try{await Promise.all([0,1,2,3].map(worker));}catch(error){aborted=true;for(const controller of controllers)controller.abort();throw error;}
  if(completed.size!==count||bytes!==job.expectedBytes||fs.fstatSync(fd).size!==job.expectedBytes)throw Error('Not every attachment range was completed');
  const first=Buffer.alloc(8);fs.readSync(fd,first,0,8,0);if(!/^526172211a070(?:0|100)/.test(first.toString('hex')))throw Error('Expected a RAR archive signature');
  fs.fsyncSync(fd);fs.closeSync(fd);
  const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(pending))hash.update(chunk);const sha256=hash.digest('hex');
  item.partialTransfers.push({path:pending,bytes,expectedBytes:job.expectedBytes,phase:'verified-public-http-ranges',at:new Date().toISOString(),sha256,transferBytesVerified:true,rangeEtags,completedRanges:count});item.status='partial';item.archiveStatus='complete-transfer-awaiting-inspection';delete item.error;persist(item);
  console.log(JSON.stringify({id,phase:'complete-transfer-ready-for-recovery',bytes,sha256}));
 }catch(error){aborted=true;for(const controller of controllers)controller.abort();try{fs.closeSync(fd);}catch{}item.partialTransfers.push({path:pending,bytes:fs.statSync(pending).size,receivedBytes:bytes,expectedBytes:job.expectedBytes,phase:'incomplete-public-http-ranges',completedRanges:[...completed].sort((a,b)=>a-b),at:new Date().toISOString(),error:error.message});item.status='unavailable';item.error=error.message;persist(item);throw error;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
