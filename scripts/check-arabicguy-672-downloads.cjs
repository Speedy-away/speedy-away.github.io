'use strict';
// Fetch original bytes solely for checksum verification. Never execute or replace them.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir='docs/host-reviews/ps4/6.72/arabicguy',read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const build=read(dir+'/prepared.json'),actions=read('docs/host-arabicguy-672-actions.json').actions,audit=read('docs/download-audit.json').items,files=[];
 for(const pin of [build.pins.html,build.pins.kernel,build.pins.loader,...Object.values(build.pins.builds)]){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
   const response=await fetch(pin.url,{signal:controller.signal});assert.equal(response.status,200,pin.path);assert.equal(response.url,pin.url,'No substituted URL');assert.equal(response.headers.get('access-control-allow-origin'),'*','Upstream controller dependency must permit CORS');
   const parts=[];let length=0;for await(const chunk of response.body){length+=chunk.length;if(length>pin.bytes){controller.abort();throw Error('Original response exceeds its exact size');}parts.push(chunk);}
   const bytes=Buffer.concat(parts);assert.equal(bytes.length,pin.bytes);assert.equal(sha(bytes),pin.sha256);
   const action=actions.find(a=>a.sourceURL===pin.url);
   if(action){assert.equal(action.downloadURL,pin.url);const saved=audit.flatMap(i=>i.files||[]).find(f=>f.backupPath&&f.sha256===pin.sha256);assert.ok(saved);assert.equal(sha(fs.readFileSync(saved.backupPath)),pin.sha256);const blob=crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');assert.equal(blob,action.sourceGitBlobSHA1);}
   files.push({path:pin.path,url:pin.url,status:response.status,bytes:bytes.length,sha256:sha(bytes),cors:response.headers.get('access-control-allow-origin'),contentType:response.headers.get('content-type'),downloadName:action?path.basename(new URL(action.downloadURL).pathname):null,gameVersion:action?.gameVersion||null,archiveMatches:!!action});
  }finally{clearTimeout(timer);}
 }
 const report={checkedAt:new Date().toISOString(),status:'passed',method:'Bounded HTTPS GET, exact URL/size/SHA-256 comparison and original BIN Git-blob/archive matching. No custom Origin, native source evaluation, payload execution or console contact.',files,consoleExecutionVerified:false};
 fs.writeFileSync(path.join(root,dir,'download-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,dependencies:files.filter(f=>!f.gameVersion).length,builds:files.filter(f=>f.gameVersion).map(f=>({gameVersion:f.gameVersion,bytes:f.bytes,sha256:f.sha256}))}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
