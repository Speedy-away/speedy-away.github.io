// Make this batch durable against concurrent inventory writers. Read/hash builds;
// retain only metadata events and merge through the shared archive protocol.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createArchive}=require('./console-expansion-archive.cjs');
const {destinationForFile}=require('./download-archive-layout.cjs');
const root=path.resolve(__dirname,'..'),backup='F:/whatsite-backup-downloads-etc';
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
async function main(){
  const jobs=read('docs/qa/console-batch5-download-jobs.json').jobs,manifest=read('downloads/ps4-ps5/manifest.json').files;
  const items=[];
  for(const job of jobs){
    const entry=manifest.find(f=>f.downloadId===job.id&&f.sha256===job.expectedSha256&&f.status==='downloaded');
    if(!entry?.local)throw Error('Expected public mirror missing: '+job.id);
    const item={id:'ps4-ps5-'+job.id,title:job.title,platform:job.platform,category:job.category,project:job.project,url:job.url,sourceUrls:[job.url,...job.sourceUrls||[]],kind:'pinned-game-cheat',release:job.version,status:'downloaded',pages:job.pages};
    item.archiveRole=job.archiveRole;
    const target=destinationForFile(backup,item,{name:job.filename,releaseTag:job.version});
    for(const file of [target,path.join(root,entry.local.slice(1))]){
      const bytes=fs.readFileSync(file);if(bytes.length!==job.expectedBytes||crypto.createHash('sha256').update(bytes).digest('hex')!==job.expectedSha256)throw Error('Retained bytes mismatch: '+file);
    }
    item.files=[{name:job.filename,version:job.version,sourceUrl:job.url,resolvedUrl:job.url,bytes:job.expectedBytes,sha256:job.expectedSha256,backupPath:target,local:entry.local,archiveRole:['Builds'],archiveAvailability:'present'}];
    items.push(item);
  }
  const archive=createArchive();
  const intake=await archive.appendInventory({scope:'ps4-ps5',items});
  const merged=await archive.mergeInventory({inventory:intake.inventory});
  fs.writeFileSync(path.join(root,'docs/qa/console-batch5-inventory-merge.json'),JSON.stringify({checkedAt:new Date().toISOString(),filesHashed:items.length,intake,merged},null,2)+'\n');
  console.log(JSON.stringify({filesHashed:items.length,merged}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
