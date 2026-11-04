// Read-only public project research; this helper never runs console builds.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const ids = ['appstore','AromaUpdater','SaveMiiProcessMod','SDCafiine_WUPS','Inkay','evWii','retroarch','NooDS','Fake-08','WiiUIdent','RadiiU','Connect4','Dynamismal','SnakeBattleRoyale','SuDokuL'];
async function get(url) { const r=await fetch(url,{headers:{'User-Agent':'whatsite-wiiu-research'},signal:AbortSignal.timeout(45000)});return {url,status:r.status,text:await r.text()}; }
async function main() {
 const live = await get('https://wiiu.cdn.fortheusers.org/repo.json');
 if(live.status!==200)throw Error('Wii U catalogue HTTP '+live.status);
 const packages=JSON.parse(live.text).packages.filter(p=>ids.includes(p.name));
 const evidence=[];
 for(const p of packages){
  const project = p.name==='appstore'?'https://github.com/fortheusers/hb-appstore':p.url.replace(/\/(?:releases)?\/?$/,'');
  const match=project.match(/^https:\/\/github.com\/([^/]+\/[^/]+)/);
  let readme,release;
  if(match){
   const responses=await Promise.all([get('https://raw.githubusercontent.com/'+match[1]+'/HEAD/README.md'),get('https://api.github.com/repos/'+match[1]+'/releases/latest')]);
   readme=responses[0];
   try {const r=JSON.parse(responses[1].text);release={status:responses[1].status,url:r.html_url,tag:r.tag_name,publishedAt:r.published_at,prerelease:r.prerelease,assets:(r.assets||[]).map(a=>({name:a.name,url:a.browser_download_url,bytes:a.size,contentType:a.content_type}))};}catch {release={status:responses[1].status};}
  }
  const text=readme?.text||'';
  const topics=Object.entries({Aroma:/Aroma/i,installation:/install/i,WUHB:/wuhb/i,RPX:/\.rpx/i,WPS:/\.wps/i,BIOS:/bios/i,firmware:/firmware/i,cartridges:/cart/i,storage:/sd:|sdmc:|wiiu\//i}).filter(([,pattern])=>pattern.test(text)).map(([topic])=>topic);
  evidence.push({id:p.name,project,store:{name:p.name,title:p.title,version:p.version,updated:p.updated,binary:p.binary,category:p.category,md5:p.md5,sha256:p.sha256,filesizeKiB:p.filesize,license:p.license},readme:{url:readme?.url,status:readme?.status,...(text?{sha256:crypto.createHash('sha256').update(text).digest('hex')}:{}),topics},officialLatestRelease:release});
  console.log(p.name+': readme '+readme?.status+'; release '+release?.status+' '+release?.tag);
 }
 const ftp=await get('https://api.github.com/repos/wiiu-env/ftpiiu_plugin/releases/latest');
 const ftpData=JSON.parse(ftp.text);
 evidence.push({id:'ftpiiu-plugin',project:'https://github.com/wiiu-env/ftpiiu_plugin',readme:{url:'https://github.com/wiiu-env/ftpiiu_plugin#installation'},officialLatestRelease:{status:ftp.status,url:ftpData.html_url,tag:ftpData.tag_name,publishedAt:ftpData.published_at,assets:(ftpData.assets||[]).map(a=>({name:a.name,url:a.browser_download_url,bytes:a.size,contentType:a.content_type}))}});
 fs.writeFileSync(path.join(root,'docs/wiiu-homebrew-source-evidence.json'),JSON.stringify({verifiedAt:new Date().toISOString(),source:'https://hb-app.store/',catalogueSource:'https://wiiu.cdn.fortheusers.org/repo.json',compatibilitySources:['https://wiiu.hacks.guide/','https://wiiu.hacks.guide/aroma/getting-started','https://github.com/wiiu-env/Aroma','https://github.com/wiiu-env/ftpiiu_plugin','https://docs.libretro.com/development/retroarch/compilation/wiiu/'],apps:evidence},null,2)+'\n');
 fs.writeFileSync(path.join(root,'docs/wiiu-store-selected-snapshot.json'),JSON.stringify({verifiedAt:new Date().toISOString(),packages:packages.map(({changelog,details,...p})=>p)},null,2)+'\n');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
