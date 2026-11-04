'use strict';
// Static source acquisition only. Never import or evaluate downloaded code.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/host-review-20261103');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(45000),headers:{'User-Agent':'whatsite-static-review'}});if(!r.ok)return {url,status:r.status};const b=Buffer.from(await r.arrayBuffer());return {url,status:r.status,bytes:b.length,sha256:sha(b),data:b};}
async function main(){
 fs.mkdirSync(out,{recursive:true});const report={checkedAt:new Date().toISOString(),method:'GitHub API metadata and raw static source; no runtime or payload execution.',repositories:[]};
 for(const repo of ['GamerHack/GamerHack.github.io','raw13g/raw13g.github.io']){
  const row={repo};for(const endpoint of ['commits/main','branches','releases','tags']){const r=await get('https://api.github.com/repos/'+repo+'/'+endpoint);if(r.status!==200)throw Error(repo+' '+endpoint+' '+r.status);const j=JSON.parse(r.data);row[endpoint==='commits/main'?'commit':endpoint]=endpoint==='commits/main'?j.sha:j.map(x=>({name:x.name,tag:x.tag_name,sha:x.commit?.sha}));}
  const files=repo.startsWith('GamerHack')?['README.md','505/index.html','505/arabic-guy100.bin','505/WildeModz-1.33.bin','505/WildeModz-1.46.bin','672/index.html']:['LICENSE','index.html','jb.html','jb.js','ps4_offsets.js'];row.files=[];
  for(const file of files){const r=await get('https://raw.githubusercontent.com/'+repo+'/'+row.commit+'/'+file);if(r.status!==200)throw Error(file+' '+r.status);const target=path.join(out,repo.split('/')[0],file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,r.data);delete r.data;row.files.push({path:file,...r});}report.repositories.push(row);
 }
 report.originalSourceChecks=[];for(const repo of ['thebelx/OOMfie','thebelx/OnePS','thebelx/RAW-GAME-STOLE-OOMFIE','hippie68/ps4-ftp']){const r=await get('https://api.github.com/repos/'+repo);report.originalSourceChecks.push({repo,status:r.status});}
 fs.writeFileSync(path.join(root,'docs/qa/host-source-refresh-20261103.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
