const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {resources}=JSON.parse(fs.readFileSync('docs/ps4-bo3-resources.json','utf8'));
const root=path.resolve(__dirname,'../downloads/ps4/BO3');
async function run(){
 const files=[];
 for(const resource of resources)for(const file of resource.downloads){
  if(!file.url.startsWith('https://cdn.discordapp.com/'))continue;
  const target=path.join(root,resource.group,file.filename);
  const entry={resource:resource.id,group:resource.group,filename:file.filename,source:file.url};
  try{
   fs.mkdirSync(path.dirname(target),{recursive:true});
   if(!fs.existsSync(target)){
    const response=await fetch(file.url,{signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw Error('HTTP '+response.status);
    if((response.headers.get('content-type')||'').includes('text/html'))throw Error('Received HTML instead of file');
    const bytes=Buffer.from(await response.arrayBuffer());
    if(!bytes.length)throw Error('Empty file');
    fs.writeFileSync(target,bytes);
   }
   const bytes=fs.readFileSync(target);
   Object.assign(entry,{status:'downloaded',local:'/downloads/ps4/BO3/'+resource.group+'/'+file.filename,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
   console.log(resource.name+': saved '+bytes.length+' bytes');
  }catch(error){entry.status='unavailable';entry.error=error.message;console.log(resource.name+': '+error.message);}
  files.push(entry);
 }
 fs.mkdirSync(root,{recursive:true});
 fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({files},null,2)+'\n');
 if(files.some(f=>f.status!=='downloaded'))process.exitCode=1;
}
run().catch(error=>{console.error(error);process.exitCode=1;});
