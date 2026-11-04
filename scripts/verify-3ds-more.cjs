const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const errors=[],checks=[];const assert=(test,message)=>{if(!test)errors.push(message);};
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function run(){
  const apps=read('docs/3ds-more-app-research.json').apps,themes=read('docs/themezer-3ds-catalog.json').themes,data=read('docs/3ds-more-downloads.json');
  const inventory=read('docs/3ds-more-private-inventory.json');
  const extra=fs.existsSync(path.join(root,'docs/3ds-mods-online.json'))?read('docs/3ds-mods-online.json').entries:[];
  assert(apps.length>=12,'Need at least12 additional resources');assert(themes.length>=8,'Need at least8themes');
  assert(apps.filter(a=>a.group==='games').length>=2,'Need native homebrew and ports');
  for(const entry of [...apps,...extra])for(const asset of entry.assets){const file=data.entries.find(e=>e.id===entry.id)?.files.find(f=>f.sourceUrl===asset.url&&f.version===entry.version&&f.name===asset.name.replace(/[^a-zA-Z0-9_.-]/g,'_'));assert(file,'Selected release asset missing: '+entry.id+'/'+asset.name);if(file&&asset.size)assert(file.bytes===asset.size,'Published asset size differs: '+asset.name);}
  let publicFiles=0,backupFiles=0,bytes=0;
  for(const entry of [...apps,...themes,...extra]){
    const row=data.entries.find(e=>e.id===entry.id);assert(row?.files.length,'Missing ready downloads: '+entry.id);
    const item=inventory.items.find(i=>i.id==='3ds-more-'+entry.id);assert(item?.files?.length,'Missing archive item: '+entry.id);
    for(const f of row?.files||[]){
      const local=path.resolve(root,'.'+f.local);assert(local.startsWith(root+path.sep),'Public file escapes root');
      assert(fs.existsSync(local),'Missing public file: '+f.local);
      if(fs.existsSync(local)){assert(fs.statSync(local).size===f.bytes,'Public size mismatch: '+f.local);assert(sha(local)===f.sha256,'Public SHA mismatch: '+f.local);publicFiles++;bytes+=f.bytes;}
      const archived=item?.files?.find(b=>b.sha256===f.sha256&&b.name===f.name);
      assert(archived,'No matching archived SHA: '+f.local);
      if(archived){assert(fs.existsSync(archived.backupPath),'Missing F: artifact: '+archived.backupPath);if(fs.existsSync(archived.backupPath)){assert(sha(archived.backupPath)===f.sha256,'F: SHA mismatch');backupFiles++;}}
    }
  }
  for(const theme of themes){assert(theme.platform==='3DS / 2DS','Wrong theme platform');assert(/^https:\/\/themezer\.net\/3ds\/themes\//.test(theme.sourceUrl),'Wrong theme source route');for(const field of ['id','title','author','sourceUrl','image','version','requirements'])assert(Boolean(theme[field]),'Missing theme field '+field);const f=data.entries.find(e=>e.id===theme.id)?.files[0];assert(f?.contents.some(n=>/(^|[\\/])body_LZ\.bin$/.test(n)),'Theme lacks body_LZ.bin');if(theme.hasBgm)assert(f?.contents.some(n=>/(^|[\\/])bgm\.bcstm$/.test(n)),'Declared BGM file missing');assert(theme.localDownload===f?.local,'Catalogue localDownload not current: '+theme.id);}
  let localLinks=0;const pages=['console/retro/3ds.html','console/retro/3ds-themes.html',...(extra.length?['console/retro/3ds-mods.html','console/retro/3ds-online.html']:[])];
  for(const file of pages){const html=fs.readFileSync(path.join(root,file),'utf8');
    assert(!/<(?:video|iframe)\b/i.test(html),'Video added');assert(html.includes('/languages/i18n.js?v=3'),'i18n loader missing');
    for(const integration of ['/assets/site-background.css','/assets/site-background.js','/assets/mobile.css','/assets/3ds-more.js'])assert(html.includes(integration),'Integration missing '+integration);
    assert(!html.includes('&amp;amp;'),'Double-encoded page title');
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert(ids.length===new Set(ids).size,'Duplicate ids '+file);
    for(const [,attribute,raw]of html.matchAll(/\b(href|src)="([^"]+)"/g)){
      const url=new URL(raw.replaceAll('&amp;','&'),'https://whatwhatboy.com/'+file);if(url.hostname!=='whatwhatboy.com')continue;
      let local=path.join(root,decodeURIComponent(url.pathname));if(url.pathname.endsWith('/'))local=path.join(local,'index.html');
      assert(fs.existsSync(local),'Missing local '+attribute+' '+raw+' in '+file);localLinks++;
      if(url.hash&&fs.existsSync(local)&&/\.html$/.test(local)){const linked=fs.readFileSync(local,'utf8');assert(linked.includes('id="'+decodeURIComponent(url.hash.slice(1))+'"'),'Missing anchor '+raw+' in '+file);}
    }
    try{for(const [,json]of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs))JSON.parse(json);}catch{errors.push('Invalid JSON-LD '+file);}
  }
  const main=fs.readFileSync(path.join(root,pages[0]),'utf8');
  for(const id of ['start','apps','luma','godmode9','universal-updater','checkpoint','ftpd-3ds','twilight-3ds','install','sources'])assert(main.includes('id="'+id+'"'),'Existing anchor missing '+id);
  for(const job of read('docs/expansion-nintendo-retro-jobs.json').jobs.filter(j=>j.pages.includes('console/retro/3ds.html')))assert(main.includes(job.url.replaceAll('&','&amp;')),'Pinned core download changed '+job.id);
  for(const image of [...read('docs/3ds-more-theme-image-sources.json').images,...read('docs/3ds-more-app-image-sources.json').images,...(extra.length?read('docs/3ds-mods-online-images.json').images:[])]){const file=path.join(root,image.localPath);assert(fs.existsSync(file)&&sha(file)===image.sha256,'Preview mismatch '+image.id);}
  if(extra.length){
    const nimbus=data.entries.find(e=>e.id==='nimbus')?.files.find(f=>f.name==='combined.2.2.0.zip');
    const contents=nimbus?.contents.map(n=>n.replaceAll('\\','/'))||[];
    for(const name of ['3ds/nimbus.3dsx','cias/nimbus.cia','3ds/nimbus/update/juxt-prod.pem','3ds/nimbus/update/nimbus.3gx','3ds/nimbus/update/0004013000002902.ips','3ds/nimbus/update/0004013000003802.ips'])assert(contents.includes(name),'Nimbus dependency missing '+name);
    const online=fs.readFileSync(path.join(root,'console/retro/3ds-online.html'),'utf8');
    for(const source of ['https://pretendo.network/','https://pretendo.network/docs/install/3ds','Keep your existing NNID','PNID','11.15','combined.2.2.0.zip'])assert(online.includes(source),'Online setup missing '+source);
    const mods=fs.readFileSync(path.join(root,'console/retro/3ds-mods.html'),'utf8');
    for(const pin of ['0004000000125500','0004000000125600','00040000000D6E00','v100','v101','v110','v1.2','0004000000033500','0004000000033600'])assert(mods.includes(pin),'Mod compatibility pin missing '+pin);
    checks.push('Complete Nimbus dependencies, official Pretendo links, NNID/PNID distinction and exact game-mod region/revision pins checked');
    if(fs.existsSync(path.join(root,'docs/3ds-pretendo-game-support.json'))){const support=read('docs/3ds-pretendo-game-support.json');assert(support.games.length>=20,'Pretendo game table too small');assert(online.includes('data-pretendo-games')&&online.includes('/assets/3ds-pretendo-support.js'),'Game support controls missing');for(const game of support.games)assert(online.includes(game.game.replaceAll('&','&amp;')),'Support game missing '+game.game);for(const game of support.games.filter(g=>/Pokémon (X|Omega)/.test(g.game)))assert(game.access==='tester','Pokemon PSS incorrectly labelled public');checks.push('Dated game-support table includes per-row evidence and distinguishes public, tester, development and unconfirmed access');}
  }
  checks.push('Every public file matches F: archive SHA-256 and byte count','Actual Themezer 3DS bundles and their declared BGM inspected','Original six core anchors and pinned download URLs preserved','Local links, anchors, JSON-LD, mobile/background/i18n integrations checked','No video or payload execution');
  const result={checkedAt:new Date().toISOString(),pages,additionalApps:apps.length,themes:themes.length,modsAndOnline:extra.length,publicFiles,backupFiles,bytes,localLinks,checks,errors,limits:['Static and byte-level validation; physical3DShardware execution untested.']};
  fs.mkdirSync(path.join(root,'docs/qa'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/3ds-more-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(errors.length)process.exitCode=1;return result;
}
if(require.main===module)run();module.exports={run};
