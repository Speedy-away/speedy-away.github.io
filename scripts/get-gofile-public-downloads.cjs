// Use the site's documented anonymous-session API; no account login or challenge bypass.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const folders=JSON.parse(fs.readFileSync(path.join(root,'docs/download-audit.json'),'utf8')).items.filter(i=>i.kind==='gofile');
async function api(url,options={}){const response=await fetch(url,{signal:AbortSignal.timeout(45000),...options});if(!response.ok)throw Error('HTTP '+response.status);return response.json();}
(async()=>{
 const guest=await api('https://api.gofile.io/accounts',{method:'POST'});
 const token=guest.data?.token;if(guest.status!=='ok'||!token)throw Error('Anonymous session unavailable: '+guest.status);
 const imports=[];
 for(const folder of folders){
  try{
   const id=new URL(folder.url).pathname.split('/').pop();
   const listing=await api('https://api.gofile.io/contents/'+id+'?page=1&pageSize=100&sortField=name&sortDirection=1',{headers:{Authorization:'Bearer '+token}});
   if(listing.status!=='ok')throw Error('Public contents API: '+listing.status);
   const entries=Object.values(listing.data?.children||{});
   if(!entries.length)throw Error('No publicly downloadable file entries returned');
   for(const entry of entries){
    if(entry.type!=='file'||!entry.link)continue;
    const name=path.basename(entry.name).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_');
    const target=path.join(process.env.TEMP,'whatsite-gofile-downloads',id,name);
    const response=await fetch(entry.link,{headers:{Cookie:'accountToken='+token},signal:AbortSignal.timeout(600000)});
    if(!response.ok)throw Error('File download HTTP '+response.status);
    if(/text\/html|application\/json/.test(response.headers.get('content-type')||''))throw Error('Download returned a web/error page');
    fs.mkdirSync(path.dirname(target),{recursive:true});
    const {Readable}=require('node:stream'),{pipeline}=require('node:stream/promises');
    await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(target+'.partial'));fs.renameSync(target+'.partial',target);
    imports.push({url:folder.url,name,status:'downloaded',tempPath:target,bytes:fs.statSync(target).size});
    console.log('Saved '+name);
   }
  }catch(error){imports.push({url:folder.url,status:'unavailable',error:error.message});console.log('GoFile '+new URL(folder.url).pathname+': '+error.message);}
  fs.writeFileSync(path.join(root,'docs/gofile-download-imports.json'),JSON.stringify({imports},null,2)+'\n');
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
