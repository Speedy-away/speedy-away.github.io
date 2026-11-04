// Official ready-release metadata and documentation only; never executes builds.
const fs=require('node:fs');
const repos=['dbeef/spelunky-ds','ArthurCose/Minicraft-DS-Edition','mdmrk/2048-nds','tallHouse64/CerealBoxSnow','Epicpkmn11/dsidl','NitrousTracker/nitroustracker','RetroGamer02/raptor-consoles','headshot2017/3dmaze','headshot2017/3dpinball-nds'];
const clean=s=>s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').replaceAll('&amp;','&').trim();
async function main(){
 const entries=[];
 for(let i=0;i<repos.length;i+=3)entries.push(...await Promise.all(repos.slice(i,i+3).map(async repo=>{
  const response=await fetch(`https://github.com/${repo}/releases/latest`,{signal:AbortSignal.timeout(30000)});let html=await response.text(),tag=decodeURIComponent(response.url.split('/tag/')[1]||'');
  const r={repo,source:response.url,status:response.status,tag,checkedAt:new Date().toISOString()};
  if(response.ok&&!tag){tag=html.match(/href="[^"]*\/releases\/tag\/([^"]+)"/)?.[1]||'';if(tag){r.tag=decodeURIComponent(tag);r.source=`https://github.com/${repo}/releases/tag/${tag}`;html=await(await fetch(r.source)).text();r.preRelease=true;}}
  if(!response.ok||!tag)return r;
  const assets=await(await fetch(r.source.replace('/tag/','/expanded_assets/'))).text();r.assets=[...assets.matchAll(/href="([^"]*\/releases\/download\/[^"]+)"/g)].map(m=>'https://github.com'+m[1].replaceAll('&amp;','&'));
  r.notes=clean(html.match(/<div[^>]*class="[^"]*markdown-body[^>]*>([\s\S]*?)<\/div>/)?.[1]||'');
  const canonical=response.url.split('/releases/')[0].replace('https://github.com/','');
  for(const ref of [tag,'HEAD'])for(const name of ['README.md','readme.md','README.MD']){
   if(r.readme)break;const readme=await fetch(`https://raw.githubusercontent.com/${canonical}/${ref}/${name}`);if(readme.ok){r.readmeSource=readme.url;r.readme=await readme.text();}
  }
  console.log(canonical,tag,r.assets.length);return r;
 })));
 fs.writeFileSync('docs/ds-dsi-more-batch2-research.json',JSON.stringify({checkedAt:new Date().toISOString(),entries},null,2)+'\n');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
