// Verify actual archive/mirror bytes and preserved identities; never run downloaded files.
const fs=require('node:fs'),path=require('node:path');
const {verifyFile,verifyCatalogueBaseline}=require('./verify-console-continuation.cjs');
const root=path.resolve(__dirname,'..'),backup=path.resolve('F:/whatsite-backup-downloads-etc');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
function verify(){
  const batch=Number(process.argv.find(arg=>arg.startsWith('--batch='))?.slice(8)||3);
  if(![3,4].includes(batch))throw Error('Expected batch 3 or 4');
  const expectedFiles=batch===4?27:39,expectedXMLs=batch===4?16:29;
  const prefix='docs/qa/console-expansion-batch'+batch;
  const baseline=read(prefix+'-baseline.json');
  const jobs=read(prefix+'-jobs.json').jobs;
  const helperJobs=read(prefix+'-helper-jobs.json').jobs;
  const catalogue=read('docs/console-download-catalog.json').items,audit=read('docs/download-audit.json').items;
  const files=jobs.map(job=>{
    const issues=[],owner=audit.find(item=>item.id==='ps4-ps5-'+job.id);
    const archived=owner?.files.find(file=>file.sha256===job.expectedSha256&&file.name===job.filename);
    const archive=verifyFile(archived?.backupPath,job.expectedBytes,job.expectedSha256,backup);
    const matches=catalogue.filter(item=>item.id===job.id),item=matches[0];
    if(!archive.passed)issues.push('Archive bytes differ or missing');
    if(owner?.status!=='downloaded'||owner.url!==job.url||owner.release!==job.version)issues.push('Inventory identity/source/release differs');
    if(!archived||archived.bytes!==job.expectedBytes||archived.version!==job.version||archived.sourceUrl!==job.url)issues.push('Archived metadata differs');
    if(matches.length!==1||item.filename!==job.filename||item.bytes!==job.expectedBytes||item.sha256!==job.expectedSha256)issues.push('Catalogue identity/size/hash differs');
    const mirror=job.mirror===false?null:verifyFile(archived?.local?path.join(root,archived.local.slice(1)):null,job.expectedBytes,job.expectedSha256,root);
    if(mirror&&!mirror.passed)issues.push('Mirror bytes differ');
    if(job.mirror===false&&item?.url!==job.url)issues.push('Publisher-only app URL changed');
    if(job.mirror!==false&&item?.url!==archived?.local)issues.push('Mirror URL differs from inventory');
    return {id:job.id,source:job.url,version:job.version,archive,mirror,passed:!issues.length,issues};
  });
  const preserved=verifyCatalogueBaseline(baseline.items,catalogue);
  const priorHelpers=baseline.companions.map(prior=>({id:prior.id,...verifyFile(prior.backupPath,prior.bytes,prior.sha256,backup)}));
  const helpers=helperJobs.map(job=>{
    const owner=audit.find(item=>item.id==='ps4-ps5-'+job.id),file=owner?.files.find(file=>file.sha256===job.expectedSha256);
    const archive=verifyFile(file?.backupPath,job.expectedBytes,job.expectedSha256,backup);
    const publicFile=verifyFile(path.join(root,job.importPath),job.expectedBytes,job.expectedSha256,root);
    const platform=job.platform.toLowerCase(),html=fs.readFileSync(path.join(root,job.importPath),'utf8');
    const embedded=JSON.parse(html.match(/<script id="receiver-catalog" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    const expected=catalogue.filter(item=>item.platforms.includes(platform));
    const missing=expected.filter(item=>!embedded.items.some(value=>value.id===item.id&&value.sha256===item.sha256&&value.url===item.url));
    return {id:job.id,version:job.version,backupPath:file?.backupPath,archive,publicFile,embeddedItems:embedded.items.length,missing:missing.map(item=>item.id),passed:archive.passed&&publicFile.passed&&!missing.length&&embedded.items.length===expected.length};
  });
  const patches=read('docs/ps4-ps5-game-patches.json'),config=read('docs/console-expansion-batch'+batch+'.json');
  const games=config.patchFiles.map(file=>patches.games.find(game=>game.sourceFile===file));
  const contentIssues=[];
  if(jobs.length!==expectedFiles||new Set(jobs.map(job=>job.id)).size!==expectedFiles)contentIssues.push('Unexpected number of unique file jobs');
  if(games.some(game=>!game)||games.reduce((total,game)=>total+(game?.files.length||0),0)!==expectedXMLs)contentIssues.push('Unexpected selected patch families/XML files');
  if(batch===4){
    for(const job of jobs)if(baseline.items.some(item=>item.id===job.id||item.sha256===job.expectedSha256))contentIssues.push('Already available file: '+job.id);
    for(const game of games.filter(Boolean))if(baseline.patches.some(prior=>prior.sourcePath===game.sourcePath))contentIssues.push('Already available patch family: '+game.id);
    for(const pick of config.cheats)if(baseline.cheats.some(prior=>prior.game===pick.game))contentIssues.push('Already available cheat game: '+pick.game);
  }
  for(const platform of ['ps4','ps5']){
    const html=fs.readFileSync(path.join(root,`console/${platform}/game-patches.html`),'utf8');
    for(const game of games.filter(Boolean)){
      if(!html.includes('id="'+game.id+'"'))contentIssues.push('Missing patch card '+game.id+' '+platform);
      for(const option of game.options)if(option.Note&&!html.includes(option.Note.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')))contentIssues.push('Lost source note '+game.id);
    }
  }
  const apps=batch===4?read('docs/console-batch4-apps.json').resources.filter(app=>app.category==='apps'):read('docs/ps4-store-apps.json').resources.filter(item=>['ps4-store-orbisshelf-0-2-0','ps4-store-pplay-3-8'].includes(item.id));
  if(batch===3){
    const pplay=apps.find(app=>app.id==='ps4-store-pplay-3-8');
    if(!pplay?.preparation.includes('mpv/subfont.ttf')||apps.some(app=>JSON.stringify(app.platforms)!=='["ps4"]'))contentIssues.push('Lost app dependencies or platform scope');
  }else{
    if(apps.length!==2||apps.some(app=>JSON.stringify(app.platforms)!=='["ps5"]'))contentIssues.push('Lost native app/platform scope');
    const page=fs.readFileSync(path.join(root,'console/ps5/apps.html'),'utf8');
    for(const app of read('docs/console-batch4-apps.json').resources)if(!page.includes('id="'+app.id+'"'))contentIssues.push('Missing native app/installer card');
    if(!page.includes('Sunshine')||!page.includes('ShadowMountPlus 1.7 Beta 5')||!page.includes('newest upstream'))contentIssues.push('Missing app-specific dependencies or installer semantics');
  }
  const passed=!contentIssues.length&&files.every(file=>file.passed)&&preserved.every(file=>file.passed)&&priorHelpers.every(file=>file.passed)&&helpers.every(file=>file.passed);
  const summary={passed,newFiles:files.length,preservedCatalogue:preserved.filter(file=>file.passed).length,currentCatalogue:catalogue.length,patchFamilies:games.length,patchXMLs:expectedXMLs,cheatFiles:config.cheats.length,apps:apps.length,helpers:helpers.length,contentIssues};
  const result={checkedAt:new Date().toISOString(),method:'Read and hash actual files; verify source/version/size, preserved catalogue identities and old helper archives, new complete companion feeds and visible dependency/source notes. No payload execution.',...summary,files,preserved,priorHelpers,helpers};
  fs.writeFileSync(path.join(root,prefix+'-verification.json'),JSON.stringify(result,null,2)+'\n');
  return summary;
}
if(require.main===module){const result=verify();console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;}
module.exports={verify};
