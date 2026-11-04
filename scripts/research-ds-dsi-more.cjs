// Read official release metadata without the rate-limited GitHub REST API.
// This does not download or execute builds, and never writes outside this checkout.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const repos=['DS-Homebrew/NesDS','Lana-chan/GameYob','FluBBaOfWard/NitroGrafx','FluBBaOfWard/S8DS','wavemotion-dave/A7800DS','wavemotion-dave/StellaDS','Epicpkmn11/WordleDS','smealum/portalDS','Fewnity/Counter-Strike-Nintendo-DS','seaners42/Punch-A-Rooney','DS-Homebrew/dsdoom','DS-Homebrew/FastVideoDSPlayer','tasken/dsi-wifi-manager'];
const clean=s=>s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').replaceAll('&amp;','&').trim();
async function main(){
 const entries=[];
 for(let n=0;n<repos.length;n+=3)entries.push(...await Promise.all(repos.slice(n,n+3).map(async repo=>{
  const url=`https://github.com/${repo}/releases/latest`;
  const response=await fetch(url);const html=await response.text();
  const tag=decodeURIComponent(response.url.split('/tag/')[1]||'');
  const result={repo,source:response.url,status:response.status,tag,checkedAt:new Date().toISOString()};
  if(!response.ok||!tag)return result;
  const assetResponse=await fetch(`https://github.com/${repo}/releases/expanded_assets/${encodeURIComponent(tag)}`);
  const assets=await assetResponse.text();
  result.assets=[...assets.matchAll(/href="([^"]*\/releases\/download\/[^"]+)"/g)].map(m=>'https://github.com'+m[1].replaceAll('&amp;','&'));
  result.notes=clean(html.match(/<div[^>]*class="[^"]*markdown-body[^>]*>([\s\S]*?)<\/div>/)?.[1]||'');
  for(const name of ['README.md','readme.md','README.MD']){
   const readme=await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/${name}`);
   if(readme.ok){result.readmeSource=readme.url;result.readme=await readme.text();break;}
  }
  console.log(repo,tag,result.assets.length);
  return result;
 })));
 fs.writeFileSync(path.join(root,'docs/ds-dsi-more-release-snapshot.json'),JSON.stringify({checkedAt:new Date().toISOString(),apiStatus:'GitHub REST API returned HTTP403 rate limit; used official releases/latest and expanded_assets HTML',entries},null,2)+'\n');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
