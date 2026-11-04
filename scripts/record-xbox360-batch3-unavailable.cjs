const fs=require('node:fs'),path=require('node:path');
const {createArchive}=require('./console-expansion-archive.cjs');
const root=path.resolve(__dirname,'..');
async function main(){
  const games=require('../docs/xbox360-more-batch3-games.json'),skins=require('../docs/xbox360-more-batch3-skins.json');
  const items=games.excluded.slice(0,2).map((x,index)=>({id:'xbox360-more-'+(index?'sally-exe':'sonic-exe'),title:index?'Sally.exe · Xbox 360 Demo1':'Sonic.exe · Xbox 360 Final Update',url:x.source,platform:'Xbox 360',category:['Games',index?'Sally.exe':'Sonic.exe'],pages:['console/xbox360/library.html'],status:'incomplete',files:[],attempts:[{checkedAt:new Date().toISOString(),sourceUrl:x.source,status:'incomplete-download',reason:x.status,uploadId:x.uploadId,expectedDownloadBytes:x.publisherExpectedBytes}]}));
  for(const x of skins.pending||[])items.push({id:'xbox360-more-'+x.id,title:'Silent Hill · Aurora skin collection',url:x.source,platform:'Xbox 360',category:['Themes','Silent Hill'],pages:['console/xbox360/library.html'],status:'incomplete',files:[],attempts:[{checkedAt:new Date().toISOString(),sourceUrl:x.downloadUrl,status:x.status,reason:x.reason,expectedDownloadBytes:x.expectedDownloadBytes,completedRangeBytes:x.completedRangeBytes,partialFiles:x.partialFiles}]});
  await createArchive().appendInventory({scope:'xbox360-more',items});
  const file=path.join(root,'docs/xbox360-more-batch3.json'),batch=JSON.parse(fs.readFileSync(file,'utf8'));
  batch.unavailable=items.map(x=>({id:x.id,title:x.title,source:x.url,status:x.status,attempts:x.attempts}));
  batch.notes=['All 29 earlier entries and 34 earlier files are preserved with exact names, versions, sources, byte counts and hashes.','Triangle ZIP is a local convenience bundle of the 50 unchanged publisher runtime files at pinned commit03cb4bc8e0e1; all originals are separately archived, with Git blob hashes checked.','The temporary DashLaunch GUI fork requires an already-loaded launch.xex; BadUpdate/ABadAvatar support is distinct from persistent installation and Peer Pressure.','Silent Hill Xbox360Alpha1 requires personal USA BIN data and the documented BadUpdate/XeUnshackle route. No commercial game data supplied.','Sonic.exe, Sally.exe and the Silent Hill skin collection did not complete downloading. Partial files remain preserved; do not execute, publish or hash-claim them as ready builds. Use a new staging filename for future retries.','No payloads/builds executed, no physical-console testing, no commit or deployment.'];
  fs.writeFileSync(file,JSON.stringify(batch,null,2)+'\n');console.log('Recorded '+items.length+' incomplete sources without fake ready-file metadata.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
