// Optional read-only external-link check. Never installs or runs console packages.
const fs=require('node:fs'),path=require('node:path');
const catalogue=require('../docs/xbox-one-series-catalogue.json');
const sources=require('../docs/xbox-one-series-sources.json');
async function main(){
 const urls=[...new Set([...Object.values(sources.microsoft),...sources.screenshots.map(s=>s.source),...catalogue.apps.flatMap(a=>[a.project,a.release,a.guide,...(a.sources||[]).map(s=>s[0]),...a.files.map(f=>f.sourceUrl)]),...catalogue.frameworks.map(f=>f.sourceUrl)])];
 const reportFile=path.resolve(__dirname,'../docs/qa/xbox-one-series-link-verification.json');
 const retry=process.argv.includes('--retry-failed'),previous=retry&&fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')):null;
 const queue=previous?urls.filter(url=>!previous.results.some(r=>r.url===url&&r.ok)):urls;
 const records=new Map((previous?.results||[]).map(r=>[r.url,r]));
 const batch=retry?2:4;
 for(let i=0;i<queue.length;i+=batch){
  const group=await Promise.all(queue.slice(i,i+batch).map(async url=>{try{const response=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(25000)});return {url,status:response.status,ok:response.ok,contentType:response.headers.get('content-type')};}catch(error){return{url,ok:false,error:error.message,cause:error.cause?.code||null}}}));
  for(const row of group)records.set(row.url,row);
  console.log(`${Math.min(i+batch,queue.length)}/${queue.length} ${retry?'failed links retried':'links checked'}`);
 }
 const results=urls.map(url=>records.get(url)||{url,ok:false,error:'not checked'});
 const report={checkedAt:new Date().toISOString(),method:'HTTP HEAD, redirects followed; release builds already downloaded and hashed separately',...(previous?{retryOf:previous.checkedAt,retried:queue.length}:{}),total:results.length,passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results};
 fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed}));
 if(report.failed)process.exitCode=1;
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1});
