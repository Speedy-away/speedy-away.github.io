// Prepare verified public-source assets for the ordinary archival helper.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=(f,fallback)=>fs.existsSync(path.join(root,f))?JSON.parse(fs.readFileSync(path.join(root,f),'utf8').replace(/^\uFEFF/,'')):fallback;
const write=(f,value)=>fs.writeFileSync(path.join(root,f),JSON.stringify(value,null,2)+'\n');
const report=read('docs/discord-ps3-gta-source-research.json'),specs=read('docs/discord-ps4-ps5-raw/platforms/ps3-reviewed-posts.json').posts;
const jobs=read('docs/ps3-download-imports.json'),notes=read('docs/discord-ps3-guide-notes.json',{}),prepared=[];
for(const file of report.downloads.filter(f=>f.status==='staged')){
 const resource='discord-'+file.id,spec=specs.find(s=>s.id===resource);if(!spec)throw Error('Unreviewed source '+file.id);
 const absolute=path.resolve(root,file.stagedRelative),relative=path.relative(root,absolute);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Staging outside checkout');
 const bytes=fs.readFileSync(absolute),sha=crypto.createHash('sha256').update(bytes).digest('hex');if(bytes.length!==file.bytes||sha!==file.sha256)throw Error('Staging changed: '+file.id);
 const id=resource+'-source-'+sha.slice(0,12),game=spec.gameId==='gta-iv'?'Grand Theft Auto IV':'Grand Theft Auto V';
 const job={id,resource,title:spec.title,platform:'PS3',category:['Games',game,'Mod Loaders'],project:spec.title,version:spec.version||'Unversioned',archiveRole:['Builds'],url:file.sourceUrl,filename:file.filename,importPath:file.stagedRelative,expectedBytes:file.bytes,expectedSha256:file.sha256,maxBytes:300000000,pages:['console/ps3/mods/'+spec.gameId+'/index.html']};
 const existing=jobs.jobs.find(x=>x.id===id);if(existing)Object.assign(existing,job);else jobs.jobs.push(job);prepared.push(job);
 const entry=notes[resource]||{};entry.category='loader';entry.downloads=entry.downloads||[];if(!entry.downloads.some(x=>x.url===file.sourceUrl))entry.downloads.push({url:file.sourceUrl,label:'Original '+file.filename+' · '+(file.memberPath||'source release')});
 entry.note='Original source folder/release layout: '+(file.memberPath||file.filename)+'. Preserve its matching game and console requirements.';
 if(file.id==='ps3-gta5-loader-boxuga-v2'){entry.compatibility='Release V2 explicitly labels update.rpf for PS3 CFW/HEN. Scripts.zip also contains separate Xbox scripts/textures; those are not PS3 files. Exact title ID and game update are not specified.';entry.guideBlocks=[{type:'text',title:'Choose the PS3 asset',text:'The V2 release labels update.rpf for PS3 CFW/HEN. Keep a backup of your original game file and verify your game update before replacement. The archive Scripts.zip is for loading the scripts through another compatible loader; keep the PS3 .csc/.ctd components separate from Xbox .xsc/.xtd components.'},{type:'text',title:'Source controls',text:'The included script readme gives L1 + Left for PS3. Its loader stack size is 2024. The release does not establish OFW support.'}];}
 else entry.guideBlocks=[{type:'text',title:'Original source file layout',text:'Preserved source path: '+file.memberPath+'. Match the game update, title ID and console environment before replacing files. Keep the original game files.'},{type:'text',title:'Build selection',text:file.id.includes('semjases')?'The source supplies a separately labelled EBOOT DEX BLES directory. Preserve that DEX/BLES requirement; a full title ID and game update are not specified.':'The captured source folder identifies this original build. Console type, exact title update and installation controls require the author’s instructions.'}];
 notes[resource]=entry;
}
for(const [id,{evidence,...publicNotes}] of Object.entries(report.guideNotes||{})){
 const resource='discord-'+id;if(notes[resource])Object.assign(notes[resource],publicNotes);
}
write('docs/ps3-download-imports.json',jobs);write('docs/discord-ps3-guide-notes.json',notes);write('docs/discord-ps4-ps5-raw/platforms/gta-source-archive-jobs.json',{jobs:prepared});
console.log('Prepared '+prepared.length+' hash-verified original source assets.');
