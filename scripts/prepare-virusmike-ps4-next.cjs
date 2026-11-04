// Explicit, verified source-linked artifacts only. No network calls or payload execution.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function prepare(){
  const data=JSON.parse(fs.readFileSync(path.join(root,'docs/virusmike-ps4-next-resources.json'),'utf8'));
  const jobs=[];
  for(const artifact of data.artifacts){
    const absolute=path.resolve(root,artifact.importPath),relative=path.relative(root,absolute);
    if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Staged artifact escapes checkout');
    const bytes=fs.readFileSync(absolute);
    if(bytes.length!==artifact.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==artifact.sha256)throw Error('Staged artifact differs from reviewed original: '+artifact.id);
    if(bytes.subarray(0,4).toString()!=='Rar!')throw Error('Expected original RAR');
    jobs.push({id:artifact.id,title:artifact.title,platform:'PS4',category:['Games','Call of Duty','Black Ops 3','Menu packs'],project:'VirusMike BO3 AIO Pack',version:artifact.version,url:artifact.source,sourceUrls:[artifact.sourcePage],importPath:artifact.importPath,filename:artifact.filename,expectedBytes:artifact.bytes,expectedSha256:artifact.sha256,archiveRole:['Builds'],mirror:true,pages:['console/mods/ps4/call-of-duty/black-ops-3/index.html','console/ps4/downloads.html']});
  }
  const output={reviewed:data.reviewed,sourceScope:'Exact original mod archive linked by VirusMike Google Sites; distinct from independently sourced GoldHEN cheat JSONs.',jobs,unavailable:data.unavailable};
  fs.writeFileSync(path.join(root,'docs/virusmike-ps4-next-jobs.json'),JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({readyJobs:jobs.length,unavailableCandidates:data.unavailable.length}));return output;
}
module.exports={prepare};
if(require.main===module)prepare();
