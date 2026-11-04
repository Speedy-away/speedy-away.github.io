const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ids = ['appstore','hbmenu','jksv','Checkpoint','ftpd','ftpsrv','NX-shell','NXMP','Moonlight-Switch','switchident-GUI','Switch_90DNS_Tester','OpenSupaplex','2048','SuDokuL'];
const repos = {
  appstore:'fortheusers/hb-appstore', hbmenu:'switchbrew/nx-hbmenu', jksv:'J-D-K/JKSV', Checkpoint:'BernardoGiordano/Checkpoint',
  ftpd:'mtheall/ftpd', ftpsrv:'ITotalJustice/ftpsrv', 'NX-shell':'joel16/NX-Shell', NXMP:'proconsule/nxmp',
  'Moonlight-Switch':'XITRIX/Moonlight-Switch','switchident-GUI':'joel16/SwitchIdent','Switch_90DNS_Tester':'meganukebmp/Switch_90DNS_tester',
  OpenSupaplex:'sergiou87/open-supaplex','2048':'TooTallNate/switch-2048',SuDokuL:'Mode8fx/SuDokuL'
};
async function get(url) { const r=await fetch(url,{headers:{'User-Agent':'whatsite-switch-source-verification','Accept':'application/vnd.github+json'}}); if(!r.ok) return {status:r.status,url};return r.json(); }
(async()=>{
 const packages=JSON.parse(fs.readFileSync(path.join(root,'docs/switch-store-repo-snapshot.json'),'utf8')).packages;
 const apps=[];
 for(const id of ids) {
  const s=packages.find(x=>x.name===id),repo=repos[id];
  const release=await get(`https://api.github.com/repos/${repo}/releases/latest`);
  const readme=await get(`https://api.github.com/repos/${repo}/readme`);
  apps.push({id,title:s.title,version:s.version,storeUpdated:s.updated,storeMD5:s.md5,binary:s.binary,license:s.license,
   storeUrl:`https://hb-app.store/switch/${id}`,packageUrl:`https://switch.cdn.fortheusers.org/zips/${id}.zip`,iconUrl:`https://switch.cdn.fortheusers.org/packages/${id}/icon.png`,storeProjectUrl:s.url,
   project:`https://github.com/${repo}`,officialRelease:release.status?release:{url:release.html_url,tag:release.tag_name,publishedAt:release.published_at,prerelease:release.prerelease,assets:release.assets.map(x=>({name:x.name,url:x.browser_download_url,size:x.size,contentType:x.content_type}))},
   officialReadme:readme.status?readme:{url:readme.html_url,available:Boolean(readme.content)}
  });
  console.log(`${id}: store ${s.version}; official ${release.tag_name||release.status}; ${release.assets?.length||0} assets`);
 }
 fs.writeFileSync(path.join(root,'docs/switch-homebrew-source-evidence.json'),JSON.stringify({verifiedAt:new Date().toISOString(),exactRequestedSource:'https://hb-app.store/',catalogueSource:'https://switch.cdn.fortheusers.org/repo.json',method:'Read-only official store metadata and linked project release/README API. No builds were executed.',apps},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
