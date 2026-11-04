'use strict';
const fs=require('node:fs');
const path=require('node:path');
const candidates=[
 ['1B6B0','Adventure Time Home Screen','TabaxiD','adventure-time-home-screen'],
 ['1B453','Sleepy Yoshi','Gatto','sleepy-yoshi'],
 ['1B328','Pixel City','Lihzahrd_Atlas','pixel-city'],
 ['1F4B6','Pokemon - RGB x Y Starters','Suzuki503','pokemon-rgb-x-y-starters'],
 ['1E965','Kasumi','morrisonion','kasumi'],
 ['1F15B','Cynthia','yourbudpanda','cynthia'],
 ['1B5D9','La peace','Mason_McCrea','la-peace'],
 ['1E944','cyberpunk 2077 arasaka','luielcherry','cyberpunk-2077-arasaka']
];
function parse(html,id){
 const data=JSON.parse(html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1]);
 const obj=data.find(x=>x && typeof x==='object' && !Array.isArray(x) && x.hexId!==undefined && data[x.hexId]===id && x.updatedAt!==undefined);
 if(!obj){console.log(data.slice(0,110));throw Error('No detail data '+id);}
 const value=(o,k)=>data[o[k]];
 const creatorRef=value(obj,'creator');
 const creatorKey=creatorRef && data[creatorRef.__ref];
 const creator=data.find(x=>x && typeof x==='object' && !Array.isArray(x) && x.uuid!==undefined && creatorKey===`Creator:${data[x.uuid]}` && x.username!==undefined);
 const preview=value(obj,'collagePreview');
 const assets=value(obj,'assets');const assetUrls={};for(const key of ['bodyLzUrl','iconUrl','previewUrl','bgmBcstmUrl'])if(assets[key]!==undefined)assetUrls[key]=value(assets,key);
 return {title:value(obj,'name'),description:value(obj,'description'),author:creator?value(creator,'username'):null,image:preview?value(preview,'sdUrl'):null,createdAt:value(obj,'createdAt'),updatedAt:value(obj,'updatedAt'),assetUrls,downloadUrl:value(obj,'downloadUrl'),bgmInfo:value(obj,'bgmInfo'),hasBgm:!!assetUrls.bgmBcstmUrl};
}
async function main(){
 const existingPath='docs/themezer-3ds-catalog.json';
 const output=fs.existsSync(existingPath)?JSON.parse(fs.readFileSync(existingPath,'utf8')).themes:[];
 fs.mkdirSync('tmp/3ds-more',{recursive:true});
 for(const [id,title,author,slug] of candidates){
  // Preserve curated additions, pinned snapshots and existing local previews.
  if(output.some(theme=>theme.id===id))continue;
  const sourceUrl=`https://themezer.net/3ds/themes/${slug}-${id}`;
  let html;const cached=`tmp/3ds-more/theme-${id}.html`;
  if(fs.existsSync(cached))html=fs.readFileSync(cached,'utf8');
  else if(id==='1B6B0'&&fs.existsSync('tmp/3ds-more/theme-page.html'))html=fs.readFileSync('tmp/3ds-more/theme-page.html','utf8');
  else {const response=await fetch(sourceUrl);if(!response.ok)throw Error(`${response.status} ${sourceUrl}`);html=await response.text();fs.writeFileSync(cached,html);}
  const detail=parse(html,id);
  const image=detail.image || html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/)?.[1]?.replace(/&amp;/g,'&');
  const entry={id,title:detail.title||title,author:detail.author||author,sourceUrl,image,downloadUrl:detail.downloadUrl||`https://api.themezer.net/3ds/themes/${id}/download?src=webapp`,version:detail.updatedAt||detail.createdAt||'Unversioned source snapshot 2026-11-02',platform:'3DS / 2DS',requirements:['A 3DS/2DS with custom firmware and a HOME Menu supporting themes.','Keep the original ZIP directly in SD:/Themes/ for Anemone3DS; Themezer-3DS uses the same folder.','No New-model-only requirement is stated by the author.'],description:detail.description,hasBgm:detail.hasBgm,bgmInfo:detail.bgmInfo,assetUrls:detail.assetUrls,verifiedAt:new Date().toISOString()};
  output.push(entry);console.log(JSON.stringify(entry));
 }
 const doc={updatedAt:new Date().toISOString(),source:'https://themezer.net/3ds/themes',platform:'3DS / 2DS',themes:output};
 fs.writeFileSync('docs/3ds-more-theme-research.json',JSON.stringify(doc,null,2)+'\n');
 fs.writeFileSync('docs/themezer-3ds-catalog.json',JSON.stringify(doc,null,2)+'\n');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={parse};
