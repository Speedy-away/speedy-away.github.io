// Read and hash files only; never run downloaded console code.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {verifyFile,verifyCatalogueBaseline}=require('./verify-console-continuation.cjs');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
function verify(){
  const jobSources=['docs/qa/console-site-expansion-patch-jobs.json','docs/qa/console-site-expansion-cheat-jobs.json','docs/virusmike-ps4-next-jobs.json','docs/ps5-native-extra-cheats-jobs.json'];
  const jobs=jobSources.flatMap(file=>read(file).jobs);
  const inventory=read('docs/download-audit.json').items;
  const manifest=read('downloads/ps4-ps5/manifest.json').files;
  const catalogue=read('docs/console-download-catalog.json').items;
  const notices=new Set(read('docs/ps5-native-extra-cheats-jobs.json').jobs.filter(j=>/license|readme|shn-index/.test(j.id)).map(j=>j.id));
  const files=jobs.map(job=>{
    const issues=[];
    const item=inventory.find(i=>i.id==='ps4-ps5-'+job.id);
    const archived=item?.files?.find(f=>f.sha256===job.expectedSha256&&f.name===job.filename);
    const mirrored=manifest.find(f=>f.downloadId===job.id&&f.sha256===job.expectedSha256&&f.name===job.filename);
    if(item?.status!=='downloaded'||item.url!==job.url||item.release!==job.version)issues.push('Inventory source/release/status mismatch');
    if(!archived||archived.sourceUrl!==job.url||archived.version!==job.version)issues.push('Archive source/version mismatch');
    const archive=verifyFile(archived?.backupPath,job.expectedBytes,job.expectedSha256,'F:/whatsite-backup-downloads-etc');
    const mirror=verifyFile(mirrored?.local ? path.join(root,mirrored.local.slice(1)) : null,job.expectedBytes,job.expectedSha256,root);
    if(!archive.passed||!mirror.passed)issues.push('Required archive/mirror failed byte verification');
    if(mirrored?.status!=='downloaded'||mirrored.source!==job.url||mirrored.version!==job.version||!mirrored.archived)issues.push('Public manifest metadata mismatch');
    const listed=catalogue.filter(e=>e.id===job.id);
    if(!notices.has(job.id)&&(listed.length!==1||listed[0].filename!==job.filename||listed[0].sha256!==job.expectedSha256||listed[0].bytes!==job.expectedBytes||listed[0].url!==mirrored?.local))issues.push('Catalogue missing the exact ready file');
    return {id:job.id,source:job.url,version:job.version,archive,mirror,passed:!issues.length,issues};
  });
  const preserved=verifyCatalogueBaseline(read('docs/qa/console-site-expansion-baseline.json').items,catalogue);
  const helperJobs=read('docs/console-companion-download-jobs.json').jobs;
  const helperArchives=helperJobs.map(job=>{
    const file=inventory.find(i=>i.id==='ps4-ps5-'+job.id)?.files?.find(f=>f.sha256===job.expectedSha256&&(job.expectedBytes===undefined||f.bytes===job.expectedBytes));
    // The original .2 jobs pinned SHA-256 only; their inventory retains size.
    const archive=verifyFile(file?.backupPath,job.expectedBytes??file?.bytes,job.expectedSha256,'F:/whatsite-backup-downloads-etc');
    return {id:job.id,version:job.version,backupPath:file?.backupPath,archive,passed:archive.passed};
  });
  const helpers=['ps4','ps5'].map(platform=>{
    const job=helperJobs.filter(j=>j.platform.toLowerCase()===platform).at(-1);
    const archive=helperArchives.find(h=>h.id===job.id);
    const publicFile=verifyFile(path.join(root,job.importPath),job.expectedBytes,job.expectedSha256,root);
    const text=fs.readFileSync(path.join(root,job.importPath),'utf8');
    const missing=catalogue.filter(e=>e.platforms.includes(platform)&&!text.includes(JSON.stringify(e.id))).map(e=>e.id);
    return {...archive,path:job.importPath,bytes:job.expectedBytes,sha256:job.expectedSha256,publicFile,missing,passed:archive.passed&&publicFile.passed&&!missing.length};
  });
  const report={checkedAt:new Date().toISOString(),method:'Actual SHA-256 and size reads of site mirrors and F: archives; exact source/version inventory checks; preserve baseline IDs, filenames, hashes and platforms; check every older helper archive and current embedded catalogue. No payload execution.',passed:files.every(f=>f.passed)&&preserved.every(f=>f.passed)&&helperArchives.every(f=>f.passed)&&helpers.every(f=>f.passed),summary:{newArtifacts:files.length,readyCatalogueFiles:files.length-notices.size,notices:notices.size,preservedCatalogue:preserved.length,currentCatalogue:catalogue.length,ps4:catalogue.filter(e=>e.platforms.includes('ps4')).length,ps5:catalogue.filter(e=>e.platforms.includes('ps5')).length,helperArchives:helperArchives.length},jobSources,files,preserved,helperArchives,helpers};
  fs.writeFileSync(path.join(root,'docs/qa/console-site-expansion-verification.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}
if(require.main===module){const report=verify();console.log(JSON.stringify({passed:report.passed,...report.summary,failures:[...report.files,...report.preserved,...report.helperArchives,...report.helpers].filter(f=>!f.passed).map(f=>({id:f.id,issues:f.issues,missing:f.missing}))},null,2));if(!report.passed)process.exitCode=1;}
module.exports={verify};
