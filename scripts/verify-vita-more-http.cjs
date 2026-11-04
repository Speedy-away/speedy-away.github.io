const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');const data=require('../docs/vita-more-files.json');
async function main(){
 const report={checkedAt:new Date().toISOString(),local:[],sources:[]};
 for(const item of data.items)for(const file of item.files){
  const response=await fetch('http://127.0.0.1:8767'+file.local,{method:'HEAD',signal:AbortSignal.timeout(10000)});
  const bytes=Number(response.headers.get('content-length'));report.local.push({id:item.id,name:file.name,status:response.status,bytes,passed:response.ok&&bytes===file.bytes});
 }
 const sample=data.items.find(x=>x.id==='shellbat').files[0];const bytes=Buffer.from(await(await fetch('http://127.0.0.1:8767'+sample.local)).arrayBuffer());
 report.sample={name:sample.name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};report.sample.passed=report.sample.sha256===sample.sha256;
 const urls=[...new Set(require('../docs/vita-more-catalogue.json').items.flatMap(x=>x.sources.map(s=>s.split('#')[0])))];
 for(let i=0;i<urls.length;i+=4){const results=await Promise.allSettled(urls.slice(i,i+4).map(async url=>{const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(20000)});return {url,status:r.status,ok:r.ok};}));for(let j=0;j<results.length;j++){const r=results[j];report.sources.push(r.status==='fulfilled'?r.value:{url:urls[i+j],ok:false,error:r.reason.message});}}
 report.passed=report.local.every(x=>x.passed)&&report.sample.passed;fs.writeFileSync(path.join(root,'docs/qa/vita-more-http.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,localDownloads:report.local.length,sourcePages:report.sources.length,unavailable:report.sources.filter(x=>!x.ok),sample:report.sample},null,2));if(!report.passed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
