// Bounded HTTP verification. Never executes or installs a P3T.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
async function main() {
 const catalogue=require('../docs/themezer-ps3-catalog.json'), results=[];
 // Pairs are sequential to bound network and memory usage.
 for (const theme of catalogue.themes) {
  const local=await fetch('http://127.0.0.1:8765'+theme.localDownload,{signal:AbortSignal.timeout(15000)});
  const bytes=Buffer.from(await local.arrayBuffer()), sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const consoleLink=await fetch(theme.consoleUrl,{method:'HEAD',signal:AbortSignal.timeout(30000)});
  results.push({id:theme.id,local:{status:local.status,bytes:bytes.length,sha256,pass:local.ok&&bytes.length===theme.bytes&&sha256===theme.sha256},consoleLink:{url:theme.consoleUrl,status:consoleLink.status,contentType:consoleLink.headers.get('content-type'),contentLength:Number(consoleLink.headers.get('content-length')),pass:consoleLink.ok&&consoleLink.headers.get('content-type')==='application/x-ps3-theme'&&Number(consoleLink.headers.get('content-length'))===theme.bytes}});
  console.log(theme.id+': local '+local.status+' / console short URL '+consoleLink.status);
 }
 const report={checkedAt:new Date().toISOString(),results,errors:results.filter(r=>!r.local.pass||!r.consoleLink.pass).map(r=>r.id),limits:['HTTP status, size, content type and local hashes verified; no physical PS3 browser download tested']};
 fs.writeFileSync(path.join(root,'docs/qa/ps3-themes/http-links.json'),JSON.stringify(report,null,2)+'\n');
 if(report.errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
