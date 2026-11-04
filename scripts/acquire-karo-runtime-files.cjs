'use strict';
// Selected executable web-host files are downloaded as inert data. No Git clone,
// GitHub source archive, desktop/mobile installer or downloaded-code evaluation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {root,dir,repo,commit,folders,sha,get}=require('./review-karo-builds.cjs');
const eligible=p=>/\.(?:html|js|mjs|css|cache|manifest|appcache|bin|bz2|elf|zip|gif|png|jpe?g|svg|ico|php)$/i.test(p)||/(?:^|\/)(?:LICENSE|COPYING)(?:\.|$)/i.test(p);
function identity(data,file){if(data.length!==file.size||crypto.createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex')!==file.sha)throw Error('Pinned Git blob mismatch: '+file.path);}
async function main(){
 const review=JSON.parse(fs.readFileSync(path.join(dir,'source-review.json'))),base=path.join(root,'tmp/karo-review',commit),selected=review.tree.filter(f=>f.type==='blob'&&folders.includes(f.path.split('/')[0])&&eligible(f.path));
 const blockedFile=path.join(dir,'local-source-blocks.json'),blocked=new Set(fs.existsSync(blockedFile)?JSON.parse(fs.readFileSync(blockedFile)).files:[]),previousFile=path.join(dir,'runtime-acquisition.json'),previous=fs.existsSync(previousFile)?JSON.parse(fs.readFileSync(previousFile)).files:[];
 const groups=new Map();for(const f of selected){if(!groups.has(f.sha))groups.set(f.sha,[]);groups.get(f.sha).push(f);}
 const queue=[...groups.values()],records=[],failed=[];let cursor=0,completed=0;
 async function worker(){while(cursor<queue.length){const group=queue[cursor++],f=group[0],url='https://raw.githubusercontent.com/'+repo+'/'+commit+'/'+f.path;
  if(group.some(file=>blocked.has(file.path))){for(const file of group){const prior=previous.find(p=>p.path===file.path);if(!prior)throw Error('Quarantined source metadata is absent; stop without refetching');records.push(prior);}completed++;continue;}
  try{let bytes;for(const candidate of group){const target=path.join(base,candidate.path);if(fs.existsSync(target)){const b=fs.readFileSync(target);identity(b,candidate);bytes=b;break;}}
   if(!bytes){let result;for(let attempt=0;attempt<3;attempt++){try{result=await get(url,Math.max(f.size+1,1024));if(result.status!==200)throw Error('HTTP '+result.status);identity(result.data,f);break;}catch(e){if(attempt===2)throw e;}}bytes=result.data;}
   const digest=sha(bytes);for(const file of group){identity(bytes,file);const target=path.join(base,file.path);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target)){if(sha(fs.readFileSync(target))!==digest)throw Error('Refusing to replace different evidence '+file.path);}else fs.writeFileSync(target,bytes,{flag:'wx'});records.push({path:file.path,url:'https://raw.githubusercontent.com/'+repo+'/'+commit+'/'+file.path,bytes:bytes.length,sha256:digest,gitBlobSHA1:file.sha});}
  }catch(e){for(const file of group)failed.push({path:file.path,error:e.message});}
  completed++;if(completed%100===0)console.log('Verified '+completed+'/'+queue.length+' unique runtime files');
 }}
 await Promise.all(Array.from({length:8},worker));records.sort((a,b)=>a.path.localeCompare(b.path));
 const release=review.releases.flatMap(r=>r.assets.map(a=>({...a,version:r.tag}))).find(a=>a.name==='browser_launcher_v1.0.0.elf');if(release){const r=await get(release.url,release.bytes+1);if(r.status!==200||r.bytes!==release.bytes)throw Error('Release asset unavailable');const target=path.join(base,'release-assets',release.name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,r.data);delete r.data;records.push({path:'release-assets/'+release.name,version:release.version,...r});}
 const report={checkedAt:new Date().toISOString(),repo,commit,status:failed.length?'incomplete':blocked.size?'completed-with-local-unavailable':'downloaded',localUnavailable:[...blocked],method:'Screenshot folder runtime files and published browser-launcher release asset. Identical Git blobs fetched once, each original path preserved. Ready web scripts remain executable build dependencies; no repository source-code archive was downloaded. Recorded quarantined sources are not fetched again.',files:records,failed,skipped:review.tree.filter(f=>f.type==='blob'&&folders.includes(f.path.split('/')[0])&&!eligible(f.path)).map(f=>({path:f.path,reason:'Non-runtime source, maintenance script or repository metadata; not an offered ready build.'})),nativeCodeExecuted:false,consoleContact:false};fs.writeFileSync(path.join(dir,'runtime-acquisition.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,files:records.length,uniqueBlobs:queue.length,bytes:records.reduce((n,f)=>n+f.bytes,0),failed}));if(failed.length)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={eligible,identity};
