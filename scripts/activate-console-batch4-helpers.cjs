// Activate only already archived helper bytes; preserve the previous immutable build.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const reportPath='docs/host-menu-companion-build.json';
const old=read(reportPath),jobs=read('docs/qa/console-expansion-batch4-helper-jobs.json').jobs,audit=read('docs/download-audit.json').items;
if(old.version===jobs[0].version){console.log('Batch 4 companions already activated.');process.exit(0);}
const snapshot='docs/qa/host-menu-companion-build-v9-retained.json';
if(!fs.existsSync(path.join(root,snapshot)))fs.writeFileSync(path.join(root,snapshot),JSON.stringify(old,null,2)+'\n',{flag:'wx'});
const records=jobs.map(job=>{
  const platform=job.platform.toLowerCase(),prior=old.records.find(item=>item.platform===platform);
  const bytes=fs.readFileSync(path.join(root,job.importPath));
  const archived=audit.flatMap(item=>item.files||[]).find(file=>file.sha256===job.expectedSha256&&file.backupPath);
  if(digest(bytes)!==job.expectedSha256||!archived||digest(fs.readFileSync(archived.backupPath))!==job.expectedSha256||digest(fs.readFileSync(path.join(root,prior.immutablePath)))!==prior.sha256)throw Error('Live, backup or previous helper verification failed');
  const immutable=`downloads/helpers/console-download-receivers/${platform}/${job.version}-${job.expectedSha256.slice(0,12)}/${job.filename}`;
  fs.mkdirSync(path.dirname(path.join(root,immutable)),{recursive:true});
  if(fs.existsSync(path.join(root,immutable))){if(digest(fs.readFileSync(path.join(root,immutable)))!==job.expectedSha256)throw Error('Immutable version conflict');}
  else fs.writeFileSync(path.join(root,immutable),bytes,{flag:'wx'});
  const embedded=JSON.parse(bytes.toString().match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  return {platform,version:job.version,path:job.importPath,immutablePath:immutable,bytes:bytes.length,sha256:job.expectedSha256,previousSha256:prior.sha256,previousPublicSnapshot:prior.immutablePath,previousItems:prior.items,items:embedded.items.length,backupPath:archived.backupPath};
});
fs.writeFileSync(path.join(root,reportPath),JSON.stringify({preparedAt:new Date().toISOString(),version:jobs[0].version,jobsPath:'docs/qa/console-expansion-batch4-helper-jobs.json',previousJobsPath:old.jobsPath,activated:true,records,verifiedAt:new Date().toISOString()},null,2)+'\n');
console.log('Activated version 10; previous immutable builds and activation report retained.');
