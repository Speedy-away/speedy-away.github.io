#!/usr/bin/env node
'use strict';
// Reuse pinned, already archived ready JSON files. No downloaded code is run.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const PS4_IDS=[
  'goldhen-cusa03290-01-03','goldhen-cusa03291-01-03','goldhen-cusa03991-01-00','goldhen-cusa03991-01-35',
  'goldhen-cusa12555-01-00','goldhen-cusa12555-01-01','goldhen-cusa12555-01-30','goldhen-cusa27043-01-10',
  'goldhen-cusa02962-01-37','goldhen-cusa05574-04-06','goldhen-cusa07410-01-35','goldhen-cusa34386-06-02',
  'goldhen-cusa10211-01-54','goldhen-cusa09171-01-05','goldhen-cusa14168-01-05','goldhen-cusa33388-01-04',
  'goldhen-cusa28863-01-22','goldhen-cusa13801-01-06','goldhen-cusa02092-01-12','goldhen-cusa13338-01-25',
  'goldhen-cusa05904-01-15','goldhen-cusa11454-01-12','goldhen-cusa00341-01-33','goldhen-cusa07875-01-08',
  'goldhen-cusa00207-01-09','goldhen-cusa00208-01-09','goldhen-cusa00900-01-09','goldhen-cusa16579-01-61',
  'goldhen-cusa15778-01-06','goldhen-cusa03309-01-03','goldhen-cusa24705-01-18','goldhen-cusa28561-01-18',
  'goldhen-cusa01067-01-00','goldhen-cusa02882-01-00'
];
const ART_GAMES=['the-last-of-us-part-ii-remastered','dragons-dogma-2','silent-hill-2','astro-bot','black-myth-wukong','ghostrunner-2'];
const ART_FILE='docs/host-extra-game-art.json';
function preserve(file,bytes){if(fs.existsSync(file)){if(sha(fs.readFileSync(file))!==sha(bytes))throw Error('Existing different artwork: '+file);return;}fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});}
async function artwork(){
  const manifest=fs.existsSync(path.join(ROOT,ART_FILE))?read(ART_FILE):{schemaVersion:1,images:[],inaccessible:[]};
  for(const game of ART_GAMES){
    if(manifest.images.some(x=>x.game===game&&fs.existsSync(path.join(ROOT,x.local))))continue;
    const sourcePage='https://www.playstation.com/en-us/games/'+game+'/';
    try{
      const page=await fetch(sourcePage,{signal:AbortSignal.timeout(25000)});if(!page.ok)throw Error('Page HTTP '+page.status);const text=await page.text();
      const tag=[...text.matchAll(/<meta\b[^>]*>/gi)].map(m=>m[0]).find(t=>/property=["']og:image["']/i.test(t));
      const raw=tag?.match(/content=["']([^"']+)/i)?.[1];if(!raw)throw Error('No official og:image');const imageURL=new URL(raw.replaceAll('&amp;','&'),sourcePage).href;
      if(!/^https:\/\/(?:gmedia\.playstation\.com|image\.api\.playstation\.com|www\.playstation\.com)\//.test(imageURL))throw Error('Unexpected artwork domain');
      const image=await fetch(imageURL,{signal:AbortSignal.timeout(25000),headers:{Accept:'image/jpeg,image/png,image/webp'}});if(!image.ok)throw Error('Image HTTP '+image.status);
      const bytes=Buffer.from(await image.arrayBuffer()),type=(image.headers.get('content-type')||'').split(';')[0];
      const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type];if(!ext||bytes.length<1000||bytes.length>8*1024*1024)throw Error('Unsupported image type/size '+type);
      const local='/assets/images/host-trainers/'+game+'-'+sha(bytes).slice(0,12)+'.'+ext;preserve(path.join(ROOT,local),bytes);
      manifest.images.push({game,sourcePage,imageURL,local,bytes:bytes.length,sha256:sha(bytes),type,role:'Official game artwork, not a screenshot of the cheat menu',capturedAt:new Date().toISOString()});
      console.log('Artwork '+game+' '+bytes.length+' bytes');
    }catch(error){manifest.inaccessible.push({game,sourcePage,checkedAt:new Date().toISOString(),reason:error.message});console.log('Artwork unavailable '+game+': '+error.message);}
  }
  fs.writeFileSync(path.join(ROOT,ART_FILE),JSON.stringify(manifest,null,2)+'\n');
}
function build(){
  const catalog=read('docs/console-download-catalog.json').items,inventory=read('docs/download-audit.json').items;
  const native=read('docs/ps5-native-extra-cheats.json'),art=fs.existsSync(path.join(ROOT,ART_FILE))?read(ART_FILE):{images:[]};
  const selected=[...PS4_IDS.map(id=>({id,platform:'ps4'})),...native.resources.map(r=>({id:r.id,platform:'ps5',resource:r}))];
  const actions=[],verification=[];
  for(const selectedRow of selected){
    const item=catalog.find(row=>row.id===selectedRow.id);if(!item||!item.platforms.includes(selectedRow.platform)||!item.filename.endsWith('.json'))throw Error('Missing ready catalogue item '+selectedRow.id);
    const bytes=fs.readFileSync(path.join(ROOT,item.url));if(bytes.length!==item.bytes||sha(bytes)!==item.sha256)throw Error('Public byte/hash mismatch '+item.id);
    const json=JSON.parse(bytes);if(!Array.isArray(json.mods)||!json.mods.length||typeof json.version!=='string')throw Error('Invalid cheat JSON '+item.id);
    const titleId=item.filename.split('_')[0],gameVersion=item.filename.replace(/^[^_]+_/,'').replace(/\.json$/i,'');
    const declaredId=typeof json.id==='string'?json.id.trim():'';
    if(json.version!==gameVersion||declaredId&&declaredId!==titleId)throw Error('Title/version mismatch '+item.id);
    if(selectedRow.platform==='ps4'?!/^CUSA\d{5}$/.test(titleId):!/^PPSA\d{5}$/.test(titleId))throw Error('Platform/title prefix mismatch '+item.id);
    const original=selectedRow.resource,game=original?.game||item.name.split(' · GoldHEN ')[0],commit=(original?.sourceCommit||item.source.match(/\b[a-f0-9]{40}\b/)?.[0]);
    if(!commit)throw Error('Missing pinned source commit '+item.id);
    const matches=inventory.flatMap(record=>(record.files||[]).filter(f=>f.sha256===item.sha256&&f.name===item.filename).map(file=>({record,file})));
    const backup=matches.find(({file})=>file.backupPath&&fs.existsSync(file.backupPath));if(!backup)throw Error('Missing archive '+item.id);
    const saved=fs.readFileSync(backup.file.backupPath);if(saved.length!==bytes.length||sha(saved)!==item.sha256)throw Error('Backup mismatch '+item.id);
    const ps4=selectedRow.platform==='ps4',provider=ps4?'GoldHEN':'etaHEN',repository=ps4?'https://github.com/GoldHEN/GoldHEN_Cheat_Repository':native.repository;
    const sourceURL=original?.sourceURL||item.source.replace('https://github.com/','https://raw.githubusercontent.com/').replace('/blob/','/');
    const source=ps4?item.source.replace('https://raw.githubusercontent.com/','https://github.com/').replace('/'+commit+'/','/blob/'+commit+'/'):original.source;
    let image=item.image;if(!ps4){const artwork=art.images.find(i=>i.game===original.gameSlug);if(!artwork)throw Error('Native game artwork missing '+original.gameSlug);image=artwork.local;}
    if(!image||!fs.existsSync(path.join(ROOT,image)))throw Error('Missing game artwork '+item.id);
    const folder=ps4?'/user/data/GoldHEN/cheats/json/':'/data/etaHEN/cheats/json/';
    const cheats=json.mods.map(m=>m.name).filter(Boolean),credits=Array.isArray(json.credits)?json.credits:json.credits?[String(json.credits)]:[];
    const action={id:item.id,label:game+' cheats',menuFamily:provider+' cheats',menuVersion:null,menuVersionLabel:'Not separately versioned by source',definitionRevision:commit.slice(0,12),platform:selectedRow.platform,category:'mods',resourceType:'cheat-definitions',game,gameVersion,titleIds:[titleId],gamePlatform:ps4?'native-ps4':'native-ps5',firmwares:[],firmwarePolicy:'requirements-only',firmwareEvidence:'The definition identifies a game build, not a numeric console-firmware support range. Match the native cheat manager to your firmware.',format:'JSON',downloadURL:item.url,downloadFilename:item.filename,bytes:item.bytes,sha256:item.sha256,consoleFileId:item.id,run:null,launchURL:null,source,sourceURL,sourceCommit:commit,sourceKind:'primary-cheat-repository',instructionsURL:repository+'#usage',guideURL:item.page,installPath:folder+item.filename,image,imageRole:'Game artwork; not a screenshot of this cheat menu.',cheatCount:cheats.length,cheats,credits,license:'GPL-3.0 (repository licence; original contributor credits retained)',licenseURL:repository+'/blob/'+commit+'/LICENSE',requirements:[
      (ps4?'PS4':'Native PS5')+' '+game+', title ID '+titleId+', exact game update '+gameVersion+'. Do not use this file for another title ID or update.',
      'Requires a homebrew-enabled '+(ps4?'PS4 running a compatible GoldHEN Cheat Menu. Native PS5 and PS4-on-PS5 support are not established for this exact PS4 definition.':'PS5 running a compatible etaHEN cheat manager. This PPSA definition is for the native PS5 edition, not the PS4 edition.'),
      'Copy the unchanged ready JSON file as '+item.filename+' to '+folder+' using FTP or the console file manager. Preserve any existing file before replacing it.',
      'Open the matching game, then '+(ps4?'long-press Share or use the double-PS trigger configured in GoldHEN to open Cheat Menu.':'open etaHEN Toolbox (Debug Settings) → Cheats (WIP).')+' Select and enable individual cheats there.',
      'Only one cheat format per title ID and game version is supported by the documented manager. This JSON is cheat data, not a standalone BIN/ELF payload or a full mod menu; downloading or saving it does not enable cheats.',
      'Cheat conditions and contributor credits remain in the original JSON. Menu/trainer release version is not separately declared by the source; definition revision '+commit.slice(0,12)+' is recorded separately from the game update.',
      ...(original?.sourceIdBlank?['The original JSON id field is blank. Exact title identity follows the pinned filename and independently reviewed game metadata; original bytes were preserved without a silent repair.']:[]),
      'Static file and archive verification only; no console payload or cheat was executed.'
    ],tags:[selectedRow.platform.toUpperCase(),game,titleId,gameVersion,provider,'JSON','trainer','cheats','ready-to-use','download only'],sourceProvenance:{kind:'Existing pinned, already archived ready file; no new payload download',inventoryId:backup.record.id,inventorySource:backup.file.sourceUrl||backup.file.resolvedUrl,catalogue:'docs/console-download-catalog.json'}};
    actions.push(action);verification.push({id:item.id,platform:selectedRow.platform,game,titleId,gameVersion,menuVersion:null,definitionRevision:commit.slice(0,12),bytes:bytes.length,sha256:item.sha256,publicFile:item.url,inventoryId:backup.record.id,backupPath:backup.file.backupPath,publicAndBackupMatch:true,cheatCount:cheats.length,image});
  }
  const output={schemaVersion:1,reviewed:new Date().toISOString(),sourceScope:'Host-facing additions reuse immutable ready JSON definitions already in the PS4/PS5 download catalogue and F: archive. No new archive/source variants are substituted.',notes:['JSON actions are Download/Save/setup only, never fabricated ELF/BIN Run actions.','PS4 CUSA files and native PS5 PPSA files stay separate; no backward-compatibility inference.','Game update and repository-definition revision are distinct; these files do not publish a separate menu release number.','Game artwork is illustrative and explicitly not a cheat-menu preview.'],sources:['https://github.com/GoldHEN/GoldHEN_Cheat_Repository#usage','https://github.com/etaHEN/PS5_Cheats#usage'],actions};
  fs.writeFileSync(path.join(ROOT,'docs/host-extra-game-actions.json'),JSON.stringify(output,null,2)+'\n');
  fs.writeFileSync(path.join(ROOT,'docs/host-extra-game-actions-verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),files:verification.length,ps4:verification.filter(x=>x.platform==='ps4').length,ps5:verification.filter(x=>x.platform==='ps5').length,publicAndBackupMatches:verification.length,hardwareTested:false,downloadedPayloadsExecuted:false,records:verification},null,2)+'\n');
  console.log(JSON.stringify({actions:actions.length,ps4:actions.filter(x=>x.platform==='ps4').length,ps5:actions.filter(x=>x.platform==='ps5').length,games:new Set(actions.map(x=>x.game)).size,publicAndArchiveVerified:verification.length},null,2));
}
async function main(){const args=process.argv.slice(2);if(args.some(a=>!['--art','--build'].includes(a)))throw Error('Use --art and/or --build');if(args.includes('--art'))await artwork();if(args.includes('--build')||!args.length)build();}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={build,artwork,PS4_IDS};
