const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const {verifyFile,verifyCatalogueBaseline}=require('./verify-console-continuation.cjs');
async function verify({requireHelpers=false}={}){
  const jobs=read('docs/qa/console-batch5-download-jobs.json').jobs,items=read('docs/download-audit.json').items;
  const manifest=read('downloads/ps4-ps5/manifest.json').files,catalogue=read('docs/console-download-catalog.json').items;
  const baseline=read('docs/qa/console-batch5-baseline.json');
  const files=[];
  for(const job of jobs){
    const issues=[],item=items.find(i=>i.id==='ps4-ps5-'+job.id),file=item?.files?.find(f=>f.sha256===job.expectedSha256&&f.name===job.filename);
    const publicFile=manifest.find(f=>f.downloadId===job.id&&f.sha256===job.expectedSha256&&f.status==='downloaded');
    const listed=catalogue.filter(e=>e.id===job.id);
    if(item?.status!=='downloaded'||item.url!==job.url||item.release!==job.version||file?.sourceUrl!==job.url||file?.version!==job.version)issues.push('Inventory source/version/status mismatch');
    const archive=verifyFile(file?.backupPath,job.expectedBytes,job.expectedSha256,'F:/whatsite-backup-downloads-etc');
    const mirror=verifyFile(publicFile?.local?path.join(root,publicFile.local.slice(1)):null,job.expectedBytes,job.expectedSha256,root);
    if(!archive.passed||!mirror.passed)issues.push('Archive or public mirror bytes differ');
    const expectedPlatforms=[job.platform.toLowerCase()];
    if(listed.length!==1||listed[0].filename!==job.filename||listed[0].sha256!==job.expectedSha256||listed[0].url!==publicFile?.local||JSON.stringify(listed[0].platforms)!==JSON.stringify(expectedPlatforms))issues.push('Exact catalogue identity/platform mismatch');
    let http;
    try{
      const response=await fetch('http://127.0.0.1:8765'+encodeURI(publicFile.local),{signal:AbortSignal.timeout(5000)});
      const bytes=Buffer.from(await response.arrayBuffer()),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
      http={status:response.status,bytes:bytes.length,sha256,passed:response.ok&&bytes.length===job.expectedBytes&&sha256===job.expectedSha256};
    }catch(error){http={passed:false,error:error.message};}
    if(!http.passed)issues.push('HTTP response bytes differ');
    files.push({id:job.id,source:job.url,version:job.version,archive,mirror,http,passed:!issues.length,issues});
  }
  const preserved=verifyCatalogueBaseline(baseline.items,catalogue);
  const priorHelpers=baseline.companions.map(h=>{
    const archive=verifyFile(h.backupPath,h.bytes,h.sha256,'F:/whatsite-backup-downloads-etc');
    const immutable=verifyFile(path.join(root,h.immutablePath),h.bytes,h.sha256,root);
    return {id:h.id,version:h.version,archive,immutable,passed:archive.passed&&immutable.passed};
  });
  const helpers=['ps4','ps5'].map(platform=>{
    const target='console/'+platform+'/whatsite-'+platform+'.html',bytes=fs.readFileSync(path.join(root,target));
    const text=bytes.toString(),data=JSON.parse(text.match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
    const saved=items.flatMap(i=>i.files||[]).find(f=>f.sha256===sha256&&f.backupPath);
    const archive=verifyFile(saved?.backupPath,bytes.length,sha256,'F:/whatsite-backup-downloads-etc');
    const missing=jobs.filter(j=>j.platform.toLowerCase()===platform&&!data.items.some(i=>i.id===j.id&&i.sha256===j.expectedSha256&&i.filename===j.filename)).map(j=>j.id);
    return {platform,path:target,version:saved?.version||saved?.releaseTag,bytes:bytes.length,sha256,backupPath:saved?.backupPath,archive,embeddedItems:data.items.length,missing,passed:archive.passed&&!missing.length};
  });
  const readyFilesPassed=files.length===16&&files.every(f=>f.passed)&&preserved.every(f=>f.passed)&&priorHelpers.every(f=>f.passed);
  const report={checkedAt:new Date().toISOString(),method:'Read/hash actual F: and public files, HTTP GET every new download without execution, preserve baseline file identities/platforms and version10 helper archives/immutable copies; inspect current receiver JSON.',passed:readyFilesPassed&&(!requireHelpers||helpers.every(h=>h.passed)),readyFilesPassed,helpersComplete:helpers.every(h=>h.passed),summary:{newFiles:files.length,ps4:8,ps5:8,baselineCatalogue:preserved.length,preservedCatalogue:preserved.filter(f=>f.passed).length,currentCatalogue:catalogue.length,ps4Catalogue:catalogue.filter(f=>f.platforms.includes('ps4')).length,ps5Catalogue:catalogue.filter(f=>f.platforms.includes('ps5')).length},files,preserved,priorHelpers,helpers,cjHouse:read('docs/tmp/console-batch5/cjhouse-transfer.json')};
  fs.writeFileSync(path.join(root,'docs/qa/console-batch5-verification.json'),JSON.stringify(report,null,2)+'\n');return report;
}
module.exports={verify};
if(require.main===module)verify({requireHelpers:process.argv.includes('--require-helper-catalogues')}).then(r=>{console.log(JSON.stringify({passed:r.passed,helpersComplete:r.helpersComplete,...r.summary,failures:r.files.filter(f=>!f.passed).map(f=>({id:f.id,issues:f.issues})),missingHelperFiles:r.helpers.map(h=>({platform:h.platform,version:h.version,missing:h.missing}))},null,2));if(!r.passed)process.exitCode=1;}).catch(e=>{console.error(e);process.exitCode=1});
