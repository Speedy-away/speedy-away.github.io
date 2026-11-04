// Recover exact recorded bytes from existing local originals. Never executes media/builds.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createArchive}=require('./console-expansion-archive.cjs');
const root=path.resolve(__dirname,'..');
const base=path.join(root,'docs/tmp/unlocated-recovery');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const baseline=JSON.parse(fs.readFileSync(path.join(base,'baseline.json'),'utf8'));
 const archive=createArchive();const results=[];
 for(const row of baseline.rows){
  const f=row.file,original=baseline.items.find(i=>i.id===row.id);
  const local=path.resolve(root,'.'+f.local);const relative=path.relative(root,local);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Original escapes workspace');
  const bytes=fs.readFileSync(local);
  if(bytes.length!==f.bytes||digest(bytes)!==f.sha256)throw Error('Original differs from historical record: '+row.id);
  const scope=row.id.startsWith('ps4-ps5-')?'ps4-ps5':'ps3';
  const version=f.version||'original-snapshot-'+f.archivedAt.slice(0,10);
  const result=await archive.archiveFile({scope,item:{id:row.id,title:original.title,url:original.url,platform:original.platform,category:(Array.isArray(original.category)?original.category:[original.category]).filter(x=>typeof x==='string'&&x.trim()),pages:original.pages||[],kind:original.kind||'original-media'},file:{name:f.name,sourceUrl:f.sourceUrl||f.resolvedUrl||original.url,version,expectedBytes:f.bytes,expectedSha256:f.sha256,archiveRole:['Metadata'],format:path.extname(f.name).slice(1).toUpperCase(),recoveryOriginalFileRecord:f,recoveryMethod:'Existing local original, historical byte count and SHA-256 matched'},sourceFile:local});
  results.push({id:row.id,originalFile:f,archivedFile:result.file});
  console.log('Recovered '+row.id);
 }
 fs.writeFileSync(path.join(base,'recovered.json'),JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
 console.log(JSON.stringify({recovered:results.length,bytes:results.reduce((n,x)=>n+x.archivedFile.bytes,0),networkDownloads:0}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
