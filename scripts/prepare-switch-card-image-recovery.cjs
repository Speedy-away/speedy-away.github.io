// Recover original published project artwork only; never fetch or execute builds.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const sharp=require(require.resolve('sharp',{paths:['C:/Users/whatw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules']}));
const projects={themezer:'https://github.com/ThemezerNX/Themezer-NX',hdr:'https://github.com/HDR-Development/HDR-Releases',arcropolis:'https://github.com/Raytwo/ARCropolis',skyline:'https://github.com/skyline-dev/skyline',smashline:'https://github.com/HDR-Development/smashline','nro-hook':'https://github.com/ultimate-research/nro-hook-plugin','hdr-launcher':'https://github.com/techyCoder81/hdr-launcher-react','playable-bosses':'https://github.com/NemesisSSBU/Playable_Bosses','smoo-plus':'https://github.com/SMOO-Plus/SMOO-Plus',civswitch:'https://github.com/Gezine/CivSwitch','ns2-savekit':'https://github.com/dougchansan/ns2-savekit',ouncecake:'https://github.com/misshexa66/OunceCake',ns2jb:'https://gitlab.com/pepsipu/ns2jb',nextendo:'https://github.com/alyeri/nextendo-mk8d-country-flags'};
(async()=>{
 const existingFile=path.join(root,'docs/switch-card-image-recovery.json');
 const previous=fs.existsSync(existingFile)?JSON.parse(fs.readFileSync(existingFile,'utf8')):{};
 const report={...previous,checkedAt:new Date().toISOString(),scope:'Original project-published identity images, source screenshots and official Nintendo game artwork. These identify projects or associated games, not build compatibility.',images:previous.images||{},unavailable:[]};
 for(const [id,url] of Object.entries(projects))try{
  const saved=report.images[id];if(saved&&fs.existsSync(path.join(root,'.'+saved.image))&&crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'.'+saved.image))).digest('hex')===saved.sha256)continue;
  const response=await fetch(url);if(!response.ok)throw Error('Project HTTP '+response.status);
  const html=await response.text();
  const image=html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/)?.[1]?.replaceAll('&amp;','&');
  if(!image)throw Error('No published Open Graph image');
  const fetched=await fetch(image);if(!fetched.ok)throw Error('Image HTTP '+fetched.status);
  const bytes=Buffer.from(await fetched.arrayBuffer());if(bytes.length>6000000)throw Error('Image exceeds limit');
  const meta=await sharp(bytes).metadata();if(!['png','jpeg','webp'].includes(meta.format)||meta.width<100||meta.height<100)throw Error('Unsupported or small image');
  const local='/assets/images/switch-card-recovery/'+id+'.'+(meta.format==='jpeg'?'jpg':meta.format);const file=path.join(root,'.'+local);fs.mkdirSync(path.dirname(file),{recursive:true});
  if(fs.existsSync(file)&&!fs.readFileSync(file).equals(bytes))throw Error('Refusing to overwrite different image');fs.writeFileSync(file,bytes);
  report.images[id]={image:local,sourcePageUrl:url,imageSourceUrl:image,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),width:meta.width,height:meta.height,kind:'original published project identity image'};
  console.log(id,meta.width+'x'+meta.height);
 }catch(error){report.unavailable.push({id,sourcePageUrl:url,error:error.message});console.log(id,error.message);}
 fs.writeFileSync(path.join(root,'docs/switch-card-image-recovery.json'),JSON.stringify(report,null,2)+'\n');
})();
