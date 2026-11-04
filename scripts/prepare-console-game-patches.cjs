// Prepare selected ready XMLs from the official patch release. Nothing is run.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const release='1792785960',revision='65914503123d4e643aa5aa0e8c720de8e99ef7e8';
const archiveUrl=`https://github.com/illusionyy/PS-Game-Patch/releases/download/${release}/patch1.zip`;
const archiveFile=`downloads/ps4-ps5/fps-patch-archive-${release}/patch1.zip`;
const expectedArchiveSha='bd35217d12986ed16a8cde6e6a0e6bd34e80a40292bfbdffa81055146f684ab7';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const engineRelease='38108724867';
const tools=[
  {id:'fps-ps4-patch-system-'+engineRelease,title:'PS4 PS Patch System loader',platforms:['ps4'],category:'payloads',project:'PS Patch System',version:engineRelease,filename:'patch-bundle-loader-orbis.elf',source:`https://github.com/illusionyy/ps-patch-system/releases/download/${engineRelease}/patch-bundle-loader-orbis.elf`,expectedBytes:2063384,expectedSha256:'2467743d9cbda07a09647324201c530c6bffaa3b3a456dee0990821aa2eb82ad',compatibility:'PS4 ELF engine. Project-confirmed firmware range 9.00–12.52; requires a compatible elfldr listening on 9021. The ELF is not a BIN payload.',preparation:'Start the compatible PS4 elfldr and explicitly send the Orbis ELF to port 9021. Then open the patch manager on console port 23900; use /data/user/patches/xml_orbis for CUSA XML files.'},
  {id:'fps-ps5-patch-system-'+engineRelease,title:'PS5 PS Patch System loader',platforms:['ps5'],category:'payloads',project:'PS Patch System',version:engineRelease,filename:'patch-bundle-loader-prospero.elf',source:`https://github.com/illusionyy/ps-patch-system/releases/download/${engineRelease}/patch-bundle-loader-prospero.elf`,expectedBytes:1794904,expectedSha256:'10d8636e1b0f07f3f046aadb5c050a24ed9b0fae3585ec29a1ecabec07035589',compatibility:'PS5 ELF engine. Project-confirmed firmware range 3.00–12.70; requires a compatible elfldr on 9021. This does not establish support for 13.xx.',preparation:'Load the Prospero ELF through your compatible PS5 ELF loader, then open the patch manager on port 23900. CUSA XMLs use /data/user/patches/xml_orbis; native PPSA XMLs use /data/user/patches/xml_prospero.'},
  {id:'fps-ps4-cheats-manager-1-2-2',title:'PS4 Cheats Manager 1.2.2',platforms:['ps4'],category:'apps',project:'PS4 Cheats Manager',version:'v1.2.2',filename:'IV0000-CHTM00777_00-PS4CHEATSMANAGER.pkg',source:'https://github.com/bucanero/PS4CheatsManager/releases/download/v1.2.2/IV0000-CHTM00777_00-PS4CHEATSMANAGER.pkg',expectedBytes:19202048,compatibility:'PS4 console PKG for managing cheats, patches and plugins. Install in your existing compatible homebrew environment; patch application additionally needs the matching GoldHEN plugin engine.',preparation:'Install the PKG with your supported PS4 package installer. Open PS4 Cheats Manager to enable only the patch matching your exact title ID and game update, then fully restart the game.'},
  {id:'fps-goldhen-plugins-1-188',title:'GoldHEN Plugins 1.188 original ZIP',platforms:['ps4'],category:'payloads',project:'GoldHEN Plugins',version:'1.188',filename:'GoldPlugins-1.188-caacf011.zip',source:'https://github.com/GoldHEN/GoldHEN_Plugins_Repository/releases/download/1.188/GoldPlugins-1.188-caacf011.zip',expectedBytes:101208,compatibility:'PS4 GoldHEN 2.3 or newer on a firmware supported by that GoldHEN release. Original plugin release archive; extract it before selecting a PRX.',preparation:'The selected game_patch.prx is also provided directly. Preserve existing plugins.ini entries; configure the game-patch plugin for your title ID instead of loading every plugin.'}
];
const selected=new Set(['Bloodborne-Orbis.xml','RedDeadRedemption2-Orbis.xml','BatmanArkhamKnight-Orbis.xml','Driveclub-Orbis.xml','GravityDaze2-Orbis.xml','TheOrder1886-Orbis.xml','TheLastGuardian-Orbis.xml','Uncharted4AThiefsEnd-Orbis.xml','UnchartedTheLostLegacy-Orbis.xml','TheLastOfUs1-Orbis.xml','TheLastOfUs2-Orbis.xml','ShadowoftheColossus-Orbis.xml','DarkSoulsIII-Orbis.xml','SekiroShadowsDieTwice-Orbis.xml','TheWitcher3-Orbis.xml','GodOfWar-Orbis.xml','DyingLight.xml','DyingLight2StayHuman.xml','DeadIsland2-Orbis.xml','AssassinsCreedUnity-Orbis.xml','AssassinsCreedSyndicate.xml','FarCry6-Orbis.xml','FarCryPrimal.xml','CrashTeamRacingUS-Orbis.xml','CrashBandicootNSaneTrilogy-Orbis.xml','MadMax-Orbis.xml','Fallout4-Orbis.xml','JustCause3-Orbis.xml','JustCause4-Orbis.xml','ResidentEvil4Remake-Orbis.xml','RedDeadRedemption-Orbis.xml','Control-Orbis.xml','GrandTheftAutoV-Orbis.xml','DevilMayCry5-Orbis.xml','RatchetandClankRemakeOrbis.xml','Cyberpunk2077.xml','TheEvilWithin-Orbis.xml','Dishonored-Orbis.xml','DemonSouls.xml','MGS_SnakeEater.xml','RedDeadRedemption.xml']);
for(const file of ['HorizonZeroDawn-Orbis.xml','HorizonForbiddenWest-Orbis.xml','EldenRing-Orbis.xml','GhostOfTsushimaDC-Orbis.xml','DaysGone-Orbis.xml','MarvelsSpider-Man-Orbis.xml','MarvelsSpider-ManMilesMorales-Orbis.xml','FinalFantasyVIIRemake-Orbis.xml','FinalFantasyXV-orbis.xml','AlienIsolation-Orbis.xml','SleepingDogs-Orbis.xml','Persona5Royal-Orbis.xml','Stray-Orbis.xml','ArmoredCoreVI-Orbis.xml','DetroitBecomeHuman.xml'])selected.add(file);
for(const file of ['AssassinsCreedIVBlackFlag.xml','AssassinsCreedRougeRemastered-Orbis.xml','KenaBridgeofSpirits-Orbis.xml','Skyrim-Orbis.xml','RiseoftheTombRaider-Orbis.xml','DeusExMankindDivided-Orbis.xml','DragonAgeInquisition-Orbis.xml','Wreckfest-Orbis.xml','LiesOfP-Orbis.xml','SonicFrontiers-Orbis.xml'])selected.add(file);
const summaries={
  'AssassinsCreedIVBlackFlag.xml':'60 FPS option for game update 01.04.',
  'AssassinsCreedRougeRemastered-Orbis.xml':'60 FPS option for game update 01.01.',
  'KenaBridgeofSpirits-Orbis.xml':'60 FPS options; separate resolution scales for update 02.03.',
  'Skyrim-Orbis.xml':'60 FPS unlock and a separate 720p option for base PS4.',
  'RiseoftheTombRaider-Orbis.xml':'60 FPS unlock and resolution option; some areas remain CPU-limited.',
  'DeusExMankindDivided-Orbis.xml':'60/120 FPS options; 120 FPS requires VideoOut 120Hz.',
  'DragonAgeInquisition-Orbis.xml':'60 FPS option plus separate 83%, 67% and 50% resolution scales.',
  'Wreckfest-Orbis.xml':'FPS options for three exact updates; source specifies adaptive sync.',
  'LiesOfP-Orbis.xml':'Pattern-scan 60/30 FPS and static resolution options.',
  'SonicFrontiers-Orbis.xml':'60 FPS pattern-scan option; check the matching engine and game.'
};
for(const file of require('../docs/console-expansion-batch2.json').patchFiles)selected.add(file);
for(const file of require('../docs/console-expansion-batch3.json').patchFiles)selected.add(file);
for(const file of require('../docs/console-expansion-batch4.json').patchFiles)selected.add(file);
// These four upstream release entries omit the generated-from comment.
// Their title IDs and source paths were checked against this exact commit.
const uncommented={CUSA02010:'DyingLight.xml',CUSA12555:'DyingLight2StayHuman.xml',CUSA03309:'FarCryPrimal.xml',CUSA16579:'Cyberpunk2077.xml'};
function unzip(bytes) {
  let end=bytes.length-22;for(;end>=Math.max(0,bytes.length-65557);end--)if(bytes.readUInt32LE(end)===0x06054b50)break;
  if(end<0)throw Error('ZIP central directory not found');
  const count=bytes.readUInt16LE(end+10),offset=bytes.readUInt32LE(end+16);let cursor=offset;const entries=[];
  for(let i=0;i<count;i++) {
    if(bytes.readUInt32LE(cursor)!==0x02014b50)throw Error('Invalid ZIP central record');
    const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),compressed=bytes.readUInt32LE(cursor+20),size=bytes.readUInt32LE(cursor+24),nameLength=bytes.readUInt16LE(cursor+28),extra=bytes.readUInt16LE(cursor+30),comment=bytes.readUInt16LE(cursor+32),local=bytes.readUInt32LE(cursor+42);
    const name=bytes.subarray(cursor+46,cursor+46+nameLength).toString('utf8');cursor+=46+nameLength+extra+comment;
    if(name.endsWith('/'))continue;
    if(flags&1||size>8*1024*1024||!/^[-\w./]+$/.test(name)||name.split('/').includes('..'))throw Error('Unsupported ZIP entry');
    if(bytes.readUInt32LE(local)!==0x04034b50)throw Error('Invalid ZIP local record');
    const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28),data=bytes.subarray(start,start+compressed);
    const extracted=method===8?zlib.inflateRawSync(data,{maxOutputLength:8*1024*1024}):method===0?data:null;
    if(!extracted||extracted.length!==size)throw Error('Invalid ZIP entry size');
    entries.push({name,bytes:extracted});
  }
  return entries;
}
function decode(value){return String(value||'').replaceAll('&quot;','"').replaceAll('&apos;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&').replaceAll('\\n',' ');}
function metadata(xml){return [...xml.matchAll(/<Metadata\b([^>]+)>/g)].map(m=>Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map(a=>[a[1],decode(a[2])])));}
const relevant=meta=>/fps|frame.?rate|frame.?pacing|resolution|motion.?blur|chromatic|vsync|v-sync|render|\b(?:720p|1080p|1440p|2160p|4k)\b/i.test(meta.Name||'');
function preserve(file,bytes){const full=path.join(root,file);fs.mkdirSync(path.dirname(full),{recursive:true});if(fs.existsSync(full)){if(hash(fs.readFileSync(full))!==hash(bytes))throw Error('Refusing to replace a different file: '+file);}else fs.writeFileSync(full,bytes,{flag:'wx'});}
function appendRecords(previous,additions,key='id'){
  const seen=new Set(previous.map(record=>record[key]));
  for(const record of additions){if(!record[key]||seen.has(record[key]))throw Error('Refusing a duplicate or missing '+key+': '+record[key]);seen.add(record[key]);}
  return previous.concat(additions);
}
const slug=value=>String(value).toLowerCase().replace(/\([^)]*\)/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function artwork(game){
  const record=path.join(root,'docs/ps4-ps5-game-patch-images.json');
  if(fs.existsSync(record)){const known=JSON.parse(fs.readFileSync(record,'utf8')).images?.[slug(game.title)];if(known?.image&&fs.existsSync(path.join(root,known.image.slice(1))))return known.image;}
  const id=slug(game.title),words=game.title.replace(/\([^)]*\)/g,'').trim().split(/\s+/);const lines=[];let line='';
  for(const word of words){if((line+' '+word).trim().length>24&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}if(line)lines.push(line);
  const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
  const red=/Red Dead|Bloodborne|Dead Island|Evil Within/i.test(game.title),accent=red?'#de8166':'#6be6ad';
  const file=`assets/images/game-patches/${id}.svg`;fs.mkdirSync(path.join(root,'assets/images/game-patches'),{recursive:true});
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#0b1916"/><path d="M0 430H960M0 270H960M160 0V540M800 0V540" stroke="#20382e" stroke-width="1"/><circle cx="797" cy="133" r="65" fill="none" stroke="${accent}" stroke-width="3"/><path d="M767 133h60m-30-30v60" stroke="${accent}" stroke-width="2"/><text x="72" y="98" font-family="Arial,sans-serif" font-size="18" letter-spacing="4" fill="${accent}">FPS / GRAPHICS PATCH DATA</text>${lines.map((l,i)=>`<text x="72" y="${200+i*62}" font-family="Arial,sans-serif" font-size="51" font-weight="700" fill="#f0f4f1">${esc(l)}</text>`).join('')}<path d="M72 436h92l22-35 23 70 22-35h74" fill="none" stroke="${accent}" stroke-width="4"/><text x="72" y="502" font-family="Arial,sans-serif" font-size="16" letter-spacing="2" fill="#9cafa4">WHATWHATBOY · ${game.arch==='prospero'?'PS5 NATIVE':'PS4 GAME'} · ORIGINAL TITLE ART</text></svg>\n`;
  fs.writeFileSync(path.join(root,file),svg);return '/'+file;
}
async function main(){
  const append=process.argv.includes('--append');
  const dataFile=path.join(root,'docs/ps4-ps5-game-patches.json'),jobsFile=path.join(root,'docs/ps4-ps5-game-patch-jobs.json');
  const previous=append?JSON.parse(fs.readFileSync(dataFile,'utf8')):null;
  const previousJobs=append?JSON.parse(fs.readFileSync(jobsFile,'utf8')):null;
  if(previous&&(previous.release!==release||previous.revision!==revision||previous.archive.sha256!==expectedArchiveSha))throw Error('Append requires the same pinned release and archive.');
  const retainedPaths=new Set(previous?.games.map(game=>game.sourcePath)||[]);
  if(!fs.existsSync(path.join(root,archiveFile))) {
    if(!process.argv.includes('--download'))throw Error('Pass --download to fetch the pinned official patch archive.');
    const response=await fetch(archiveUrl);if(!response.ok)throw Error('Archive HTTP '+response.status);
    const bytes=Buffer.from(await response.arrayBuffer());if(hash(bytes)!==expectedArchiveSha)throw Error('Publisher archive hash mismatch.');preserve(archiveFile,bytes);
  }
  const archive=fs.readFileSync(path.join(root,archiveFile));if(hash(archive)!==expectedArchiveSha)throw Error('Pinned patch archive changed.');
  const entries=unzip(archive);const groups=new Map();
  for(const entry of entries){
    if(!/^patches\/xml(?:_prospero)?\/(?:CUSA|PPSA)\d+\.xml$/.test(entry.name))continue;
    const xml=entry.bytes.toString('utf8');const titleId=path.posix.basename(entry.name,'.xml');
    const sourceFile=xml.match(/File generated from: [^\n]+\/patches\/(xml(?:_prospero)?)\/([^\s]+\.xml)/)|| (uncommented[titleId] ? ['', 'xml',uncommented[titleId]] : null);
    if(!sourceFile||!selected.has(sourceFile[2]))continue;
    const all=metadata(xml),options=all.filter(relevant);if(!options.length)continue;
    const sourcePath=`patches/${sourceFile[1]}/${sourceFile[2]}`;
    if(retainedPaths.has(sourcePath))continue;
    if(!groups.has(sourcePath))groups.set(sourcePath,{sourcePath,sourceFile:sourceFile[2],title:all[0]?.Title||sourceFile[2],arch:sourceFile[1]==='xml_prospero'?'prospero':'orbis',titleIds:[],options:[],files:[]});
    const game=groups.get(sourcePath);
    game.titleIds.push(titleId);for(const option of options)if(!game.options.some(o=>JSON.stringify(o)===JSON.stringify(option)))game.options.push(option);
    const local=`downloads/ps4-ps5/fps-patches-${release}/${sourceFile[1]}/${titleId}.xml`;
    if(![...xml.matchAll(/<ID>([^<]+)<\/ID>/g)].some(m=>m[1]===titleId))throw Error('Release filename is absent from its title-ID whitelist: '+entry.name);
    preserve(local,entry.bytes);game.files.push({titleId,filename:titleId+'.xml',archiveEntry:entry.name,local:'/'+local,bytes:entry.bytes.length,sha256:hash(entry.bytes)});
  }
  const games=[...groups.values()].sort((a,b)=>{const priority={'Bloodborne':-2,'Red Dead Redemption 2':-1};return (priority[a.title]??0)-(priority[b.title]??0)||a.title.localeCompare(b.title)});
  const jobs=previous?[]:[{id:'fps-patch-archive-'+release,title:'Official PS4/PS5 patch XML archive',platform:'PS4 and PS5',category:['Game Patches'],project:'PS Game Patch',version:release,filename:'patch1.zip',url:archiveUrl,importPath:archiveFile,expectedBytes:archive.length,expectedSha256:expectedArchiveSha,archiveRole:['Builds'],pages:['console/ps4/game-patches.html','console/ps5/game-patches.html']}];
  const resources=[];
  for(const game of games){
    game.id=slug(game.title);game.image=artwork(game);game.platforms=game.arch==='prospero'||/The Last Guardian/.test(game.title)?['ps5']:['ps4','ps5'];
    if(summaries[game.sourceFile]){
      game.summary=summaries[game.sourceFile];
      game.discovery={page:'https://sites.google.com/view/im-virusmike-exe/ps4-all-you-need/60-fps-patches',relationship:'Expansion from the credited author’s primary patch catalogue; this game is not individually listed on the supplied source page.'};
    }
    for(const file of game.files){
      const id=`fps-${file.titleId.toLowerCase()}-${release}`,updates=[...new Set(game.options.map(o=>o.AppVer))];
      const compatibility=`${game.arch==='prospero'?'Native PS5 title':'PS4 title; PS5 use is backward compatibility only'}. ${file.titleId}. Patch metadata game updates: ${updates.join(', ')}${updates.includes('mask')?' (mask = upstream pattern scan, not a guarantee for every update)':''}. Patch target/unlock is not a measured frame-rate result.`;
      const preparation=game.arch==='prospero'?`PS5 PS Patch System: save as ${file.filename} in /data/user/patches/xml_prospero/. Start the firmware-compatible Prospero engine, open port 23900 and enable only the matching option before launching the game.`:game.platforms.length===1&&game.platforms[0]==='ps5'?`The source targets PS5 backward compatibility. PS Patch System: save ${file.filename} in /data/user/patches/xml_orbis/. Start the firmware-compatible Prospero engine, open port 23900 and select the exact game-update option.`:`PS4 GoldHEN: save ${file.filename} in /user/data/GoldHEN/patches/xml/ and configure game_patch.prx. PS Patch System (PS4 or PS5 backward compatibility): use /data/user/patches/xml_orbis/${file.filename}. Select only an option matching your title ID and game update; restart the game.`;
      file.downloadId=id;file.downloadLocal=`/downloads/ps4-ps5/${id}/${file.filename}`;
      const source=`https://github.com/illusionyy/PS-Game-Patch/blob/${revision}/${game.sourcePath}`;
      resources.push({id,title:`${game.title} · ${file.titleId} patch XML`,platforms:game.platforms,category:'patches',version:release,compatibility,image:game.image,page:`/console/${game.platforms[0]}/game-patches.html#${game.id}`,pages:Object.fromEntries(game.platforms.map(p=>[p,`/console/${p}/game-patches.html#${game.id}`])),source,filename:file.filename,format:'XML patch data',game:game.id,keywords:[game.title,file.titleId,...updates,...game.options.map(o=>o.Name),'FPS','graphics','patch XML'],local:file.downloadLocal,bytes:file.bytes,sha256:file.sha256,preparation});
      jobs.push({id,title:`${game.title} · ${file.titleId} patch XML`,platform:game.arch==='prospero'?'PS5':'PS4 and PS5',category:['Games',game.title,'Game Patches'],project:'PS Game Patch',version:release,filename:file.filename,url:archiveUrl,sourceUrls:[source],importPath:file.local.slice(1),archiveEntry:file.archiveEntry,expectedBytes:file.bytes,expectedSha256:file.sha256,archiveRole:['Builds'],pages:game.platforms.map(p=>`console/${p}/game-patches.html`)});
    }
  }
  if(!previous)for(const tool of tools){
    const local=`downloads/ps4-ps5/${tool.id}/${tool.filename}`;
    if(!fs.existsSync(path.join(root,local))&&process.argv.includes('--download')){const response=await fetch(tool.source);if(!response.ok)throw Error('Asset HTTP '+response.status+': '+tool.filename);const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==tool.expectedBytes||tool.expectedSha256&&hash(bytes)!==tool.expectedSha256)throw Error('Publisher asset metadata mismatch: '+tool.filename);preserve(local,bytes);}
    if(!fs.existsSync(path.join(root,local)))throw Error('Pass --download to prepare the official patch-engine assets.');
    const bytes=fs.readFileSync(path.join(root,local));tool.bytes=bytes.length;tool.sha256=hash(bytes);tool.local='/'+local;
    tool.page=`/console/${tool.platforms[0]}/game-patches.html#setup`;tool.image=tool.id.includes('patch-system')?artwork({title:'PS Patch System '+tool.platforms[0].toUpperCase(),arch:tool.platforms[0]==='ps4'?'orbis':'prospero'}):'/assets/images/console-software/goldhen.png';
    resources.push({...tool});jobs.push({id:tool.id,title:tool.title,platform:tool.platforms[0].toUpperCase(),category:'Tools',project:tool.project,version:tool.version,filename:tool.filename,url:tool.source,importPath:local,expectedBytes:tool.bytes,expectedSha256:tool.sha256,archiveRole:['Builds'],pages:[tool.page.slice(1).split('#')[0]]});
  }
  if(!previous){
  const pluginArchive=tools.find(t=>t.id==='fps-goldhen-plugins-1-188');
  const plugin=unzip(fs.readFileSync(path.join(root,pluginArchive.local.slice(1)))).find(x=>x.name==='plugins/game_patch.prx');
  if(!plugin||hash(plugin.bytes)!=='9ee2c7c4499b2935a3b4e5cf9fb574c19ce6a3cb2360ffabc45981d97104677b')throw Error('Game-patch plugin differs from publisher SHA-256.');
  const pluginId='fps-goldhen-game-patch-1-188',pluginLocal=`downloads/ps4-ps5/${pluginId}/game_patch.prx`;preserve(pluginLocal,plugin.bytes);
  resources.push({id:pluginId,title:'GoldHEN game_patch.prx 1.188',platforms:['ps4'],category:'payloads',version:'1.188',filename:'game_patch.prx',source:pluginArchive.source,local:'/'+pluginLocal,bytes:plugin.bytes.length,sha256:hash(plugin.bytes),page:'/console/ps4/game-patches.html#goldhen',image:'/assets/images/console-software/goldhen.png',compatibility:'PS4 GoldHEN 2.3 or newer, on a firmware supported by that release. Native PRX plugin; not an ELF payload and not a PS5 plugin.',preparation:'Place game_patch.prx in /data/GoldHEN/plugins/, merge its line into the matching CUSA title section of /data/GoldHEN/plugins.ini, enable plugin loading in GoldHEN and select the exact XML option in PS4 Cheats Manager. Preserve existing plugin configuration.'});
  jobs.push({id:pluginId,title:'GoldHEN game_patch.prx 1.188',platform:'PS4',category:'Tools',project:'GoldHEN Plugins',version:'1.188',filename:'game_patch.prx',url:pluginArchive.source,importPath:pluginLocal,archiveEntry:'plugins/game_patch.prx',expectedBytes:plugin.bytes.length,expectedSha256:hash(plugin.bytes),archiveRole:['Builds'],pages:['console/ps4/game-patches.html']});
  }
  const data={reviewed:'2026-11-02',repository:'https://github.com/illusionyy/PS-Game-Patch',revision,release,archive:{url:archiveUrl,local:'/'+archiveFile,bytes:archive.length,sha256:expectedArchiveSha},engine:{repository:'https://github.com/illusionyy/ps-patch-system',release:engineRelease,confirmedFirmware:{ps4:'9.00–12.52',ps5:'3.00–12.70'},port:23900},tools,games,resources};
  const output=previous?{...previous,games:appendRecords(previous.games,games),resources:appendRecords(previous.resources,resources)}:data;
  const jobOutput=previousJobs?{...previousJobs,jobs:appendRecords(previousJobs.jobs,jobs)}:{reviewed:'2026-11-02',notes:['Exact relevant release assets and byte-identical ready XMLs extracted from the official pinned release. No commercial game executable is included; nothing is executed.'],jobs};
  fs.writeFileSync(dataFile,JSON.stringify(output,null,2)+'\n');
  fs.writeFileSync(jobsFile,JSON.stringify(jobOutput,null,2)+'\n');
  console.log(JSON.stringify({appended:append,games:games.length,readyXmlFiles:games.reduce((n,g)=>n+g.files.length,0),archiveJobs:jobs.length,resources:resources.length,totalGames:output.games.length,totalJobs:jobOutput.jobs.length,engineRelease},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={unzip,metadata,relevant,appendRecords};
