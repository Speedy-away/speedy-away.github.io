// Final read-only artifact checks. Only the QA report is written.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function main(){
 const audit=read('docs/download-audit.json'),catalogue=read('docs/console-download-catalog.json');
 const allFiles=audit.items.flatMap(item=>(item.files||[]).map(file=>({itemId:item.id,...file})));
 const checks=[],failures=[],cache=new Map();
 function verifyFile(file,bytes,sha){
  try{let actual=cache.get(file);if(!actual){const data=fs.readFileSync(file);actual={bytes:data.length,sha256:hash(data)};cache.set(file,actual);}return actual.bytes===bytes&&actual.sha256===sha;}catch{return false;}
 }
 function record(id,passed,details={}){checks.push({id,passed,...details});if(!passed)failures.push(id);}
 for(const item of catalogue.items){
  const saved=allFiles.filter(file=>file.sha256===item.sha256&&file.bytes===item.bytes&&file.backupPath);
  record('catalogue:'+item.id,saved.some(file=>verifyFile(file.backupPath,item.bytes,item.sha256)),{sha256:item.sha256,bytes:item.bytes});
  if(item.url.startsWith('/'))record('mirror:'+item.id,verifyFile(path.join(root,item.url.slice(1)),item.bytes,item.sha256));
 }
 const jobSets=['docs/qa/console-site-expansion-patch-jobs.json','docs/qa/console-site-expansion-cheat-jobs.json','docs/virusmike-ps4-next-jobs.json','docs/ps5-native-extra-cheats-jobs.json'];
 const jobs=jobSets.flatMap(file=>read(file).jobs);
 for(const job of jobs){
  const item=audit.items.find(item=>item.id==='ps4-ps5-'+job.id);
  const file=item?.files?.find(file=>file.sha256===job.expectedSha256&&file.backupPath);
  record('pending-job:'+job.id,!!file&&file.version===job.version&&file.sourceUrl===job.url&&verifyFile(file.backupPath,job.expectedBytes,job.expectedSha256));
 }
 const helperJobs=read('docs/console-companion-download-jobs.json').jobs;
 const helpers=['ps4','ps5'].map(platform=>{
  const local='console/'+platform+'/whatsite-'+platform+'.html',bytes=fs.readFileSync(path.join(root,local)),sha256=hash(bytes);
  const job=helperJobs.findLast(job=>job.platform===platform.toUpperCase()&&job.expectedSha256===sha256&&job.expectedBytes===bytes.length);
  const saved=allFiles.find(file=>file.sha256===sha256&&file.backupPath);
  const embedded=JSON.parse(bytes.toString().match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const expected=catalogue.items.filter(item=>item.platforms.includes(platform));
  const missing=expected.filter(item=>!embedded.items.some(file=>file.id===item.id&&file.sha256===item.sha256));
  const passed=!!job&&!!saved&&verifyFile(saved.backupPath,bytes.length,sha256)&&!missing.length;
  record('helper:'+platform,passed,{missing:missing.map(item=>item.id)});
  return {platform,id:job?.id,version:job?.version,path:local,bytes:bytes.length,sha256,backupPath:saved?.backupPath,embeddedItems:embedded.items.length,passed};
 });
 const baseline=read('docs/qa/patch-linked-cheats-baseline.json');
 const preserved=require('./verify-console-continuation.cjs').verifyCatalogueBaseline(baseline.catalogue,catalogue.items);
 for(const item of preserved)record('baseline:'+item.id,item.passed);
 const native=read('docs/original-xbox-catalogue.json');
 for(const item of native.resources){
  const saved=allFiles.find(file=>file.itemId==='original-xbox-'+item.id&&file.sha256===item.file.sha256)||allFiles.find(file=>file.sha256===item.file.sha256&&file.backupPath);
  record('native-xbox:'+item.id,!!saved&&verifyFile(saved.backupPath,item.file.bytes,item.file.sha256)&&verifyFile(path.join(root,item.file.local.slice(1)),item.file.bytes,item.file.sha256));
 }
 const http=[];
 if(process.argv.includes('--http')){
  const targets=[...native.resources.map(item=>item.file),...catalogue.items.filter(item=>['virusmike-bo3-aio-v2','fps-cusa00009-1792785960'].includes(item.id)).map(item=>({local:item.url,bytes:item.bytes,sha256:item.sha256,name:item.filename}))];
  for(const file of targets){const response=await fetch('http://127.0.0.1:8765'+file.local,{signal:AbortSignal.timeout(15000)});const bytes=Buffer.from(await response.arrayBuffer());const passed=response.ok&&bytes.length===file.bytes&&hash(bytes)===file.sha256;http.push({file:file.local,status:response.status,bytes:bytes.length,passed});record('http:'+file.local,passed);}
 }
 const unavailable=read('docs/virusmike-ps4-next-resources.json').unavailable.map(item=>({id:item.id,status:item.status,reason:item.reason}));
 const report={checkedAt:new Date().toISOString(),passed:!failures.length,summary:{catalogueItems:catalogue.items.length,ps4:catalogue.items.filter(item=>item.platforms.includes('ps4')).length,ps5:catalogue.items.filter(item=>item.platforms.includes('ps5')).length,previouslyPendingJobs:jobs.length,baselineItemsPreserved:preserved.filter(item=>item.passed).length,nativeXboxReleases:native.resources.length,httpDownloadsChecked:http.length,checkedPhysicalFiles:cache.size,checks:checks.length,failures:failures.length},helpers,unavailable,checks,http,failures,execution:'No downloaded binary, script, cheat definition or payload executed; no physical console testing.'};
 fs.writeFileSync(path.join(root,'docs/qa/console-expansion-final-verification.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,...report.summary,helpers:helpers.map(helper=>({platform:helper.platform,version:helper.version,passed:helper.passed})),failures},null,2));
 if(failures.length)process.exitCode=1;
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
