const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const catalogue=JSON.parse(fs.readFileSync(path.join(root,'docs/switch-homebrew-catalog.json'),'utf8'));
(async()=>{
 const output=path.join(root,'assets/images/switch-homebrew');fs.mkdirSync(output,{recursive:true});
 const images=[];
 for(const app of catalogue.apps){
  const r=await fetch(app.iconUrl);if(!r.ok){images.push({id:app.id,source:app.iconUrl,status:r.status});continue;}
  const data=Buffer.from(await r.arrayBuffer());
  if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error(`Not a PNG: ${app.iconUrl}`);
  const file=path.join(output,app.id+'.png');
  if(fs.existsSync(file)&&!fs.readFileSync(file).equals(data))throw new Error(`Refusing to replace different icon: ${file}`);
  fs.writeFileSync(file,data);
  images.push({id:app.id,source:app.iconUrl,context:app.storeUrl,localPath:'/assets/images/switch-homebrew/'+app.id+'.png',size:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),purpose:'Project icon from the selected Homebrew App Store listing; project attribution appears beside the icon.',status:'verified-png'});
  console.log(`${app.id}: ${data.length} bytes PNG`);
 }
 fs.writeFileSync(path.join(root,'docs/switch-homebrew-image-sources.json'),JSON.stringify({fetchedAt:new Date().toISOString(),images},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
