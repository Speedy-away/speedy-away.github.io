'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const cataloguePath='docs/themezer-3ds-catalog.json';
async function main(){
 const catalogue=JSON.parse(fs.readFileSync(cataloguePath,'utf8'));
 fs.mkdirSync('assets/images/3ds-more/themes',{recursive:true});
 const images=[];
 for(const theme of catalogue.themes){
  const remote=theme.sourceImage||theme.image;
  if(!remote.startsWith('https://img.themezer.net/'))throw Error(`Unexpected preview source ${theme.id}`);
  const destination=`assets/images/3ds-more/themes/${theme.id}.webp`;
  let bytes;if(fs.existsSync(destination))bytes=fs.readFileSync(destination);else {
   const response=await fetch(remote);if(!response.ok)throw Error(`${response.status} ${remote}`);
   bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error(`Not a WebP image ${theme.id}`);
   fs.writeFileSync(destination,bytes);
  }
  theme.sourceImage=remote;theme.image='/'+destination;
  images.push({id:theme.id,title:theme.title,author:theme.author,sourcePage:theme.sourceUrl,sourceImage:remote,localPath:destination,description:'Author-provided 3DS HOME Menu collage preview served by Themezer. Used to identify the linked community theme; ownership remains with its author and underlying artwork rights holders.',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),retrievedAt:new Date().toISOString()});
  console.log(`${theme.id} ${bytes.length} bytes`);
 }
 fs.writeFileSync(cataloguePath,JSON.stringify(catalogue,null,2)+'\n');
 fs.writeFileSync('docs/3ds-more-theme-image-sources.json',JSON.stringify({updatedAt:new Date().toISOString(),images},null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
