// Hash-pinned preparation only. Never runs downloaded code or writes to F:.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const write=(file,data)=>fs.writeFileSync(path.join(root,file),JSON.stringify(data,null,2)+'\n');
const report=read('docs/discord-xbox360-public-source-research.json');
const jobs=read('docs/xbox360-download-imports.json');
const notesFile='docs/discord-xbox360-guide-notes.json';
const notes=fs.existsSync(path.join(root,notesFile))?read(notesFile):{};
const mapping={
 'xbox360-gta5-boxuga-v2':{id:'discord-xbox360-gta5-boxuga-v2',title:'Boxuga v2',game:'Grand Theft Auto V',version:'V2'},
 'xbox360-rdr-demonic-v27':{id:'discord-xbox360-other-rdr-demonic-2-7',title:'Red Dead Redemption [Demonic Menu V2.7]',game:'Red Dead Redemption - Undead Nightmare',version:'2.7 (post label)'},
 'xbox360-neighborhood':{id:'discord-xbox360-programs-neighborhood',title:'Xbox 360 Neighborhood:',game:null,version:'21256.3 (full SDK filename)',helper:true}
};
const prepared=[];
for(const file of report.downloads||[]){
 const target=mapping[file.id];if(!target||file.status!=='staged')continue;
 const absolute=path.resolve(root,file.stagedRelative),relative=path.relative(root,absolute);
 if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Staging path outside workspace');
 const bytes=fs.readFileSync(absolute);
 if(bytes.length!==file.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Staged file differs from reviewed hash: '+file.id);
 const job={id:target.id,resource:target.id,title:target.title,platform:target.helper?'PC':'Xbox 360',category:target.game?['Games',target.game]:['Tools'],project:target.title,version:target.version,archiveRole:[target.helper?'Helpers':'Builds'],url:file.sourceUrl,filename:file.filename,importPath:file.stagedRelative,expectedBytes:file.bytes,expectedSha256:file.sha256,mirror:!target.helper,maxBytes:Math.max(300000000,file.bytes),pages:[]};
 const index=jobs.jobs.findIndex(x=>x.id===job.id);if(index>=0)jobs.jobs[index]={...jobs.jobs[index],...job};else jobs.jobs.push(job);
 prepared.push(job);
 if(file.id==='xbox360-gta5-boxuga-v2')notes[target.id]={version:'V2',compatibility:'Xbox 360 RGH. Source archive title ID 545408A7; no numbered game title update confirmed.',downloads:[{url:file.sourceUrl,label:'Original Boxuga V2 Xbox RGH ZIP'}],tags:['Xbox 360','RGH','GTA V','Mod loader','Boxuga','LIVE container'],guideBlocks:[{type:'paragraph',title:'Source build',text:'The pinned V2 release supplies a separate Xbox 360 RGH ZIP. Its PS3 update.rpf is a different platform build.'},{type:'paragraph',title:'Source folder layout',text:'The Xbox ZIP contains Content/0000000000000000/545408A7/000B0000/tu00000009_00000000. A zero-byte instruction file says to drag the file to the USB root. Preserve the complete source folder tree and your original game files. The filename alone does not establish a game title-update number.'}]};
 if(file.id==='xbox360-rdr-demonic-v27')notes[target.id]={gameId:'red-dead-redemption-undead-nightmare',gameIds:['red-dead-redemption-undead-nightmare'],referenceGameIds:['red-dead-redemption'],version:target.version,gameUpdate:'Latest TU (source wording; number not supplied)',region:'Region-free; media ID 5B48AF70 (source README)',compatibility:'Undead Nightmare NON-GOTY only. Source says normal Red Dead Redemption is no longer supported.',tags:['Xbox 360','RGH','Undead Nightmare','Non-GOTY','Demonic','Jedijosh','Media ID5B48AF70'],note:'The Discord post uses the broad Red Dead Redemption title. The archive README restricts this distribution to Undead Nightmare NON-GOTY and explicitly excludes the normal game.',guideBlocks:[{type:'paragraph',title:'Edition and media ID',text:'Source README: Undead Nightmare NON-GOTY, region-free, media ID 5B48AF70. Normal Red Dead Redemption is explicitly no longer supported. The requested latest title update has no number in the README.'},{type:'list',title:'Supplied variants and controls',items:['The archive preserves loose files, ROOT OF GAME FILES and separate Demonic/Jedijosh RGH premade RPFs. Keep the original archive and game files.','Use one menu at a time: the README warns Demonic and Jedijosh together cause problems.','Demonic: RB + right stick click. Jedijosh: RB + D-pad Right. D-pad navigates, A selects and B goes back.','These are source instructions and static file checks; no console installation or execution was tested.']}]};
 if(file.id==='xbox360-neighborhood')notes[target.id]={category:'desktop-helper',version:target.version,compatibility:'Windows full Xbox 360 SDK installer; not a standalone Neighborhood package or console payload.',tags:['Xbox 360','Windows helper','Neighborhood','SDK21256.3','Full SDK'],note:'The source download is the full 1.53 GB XBOX360 SDK21256.3.exe. The preserved original is saved to the local backup; the original source link remains available. It has not been run.',guideBlocks:[{type:'paragraph',title:'What the source supplies',text:'The reviewed MEGA file is XBOX360 SDK21256.3.exe, a full Windows SDK installer rather than a standalone Neighborhood helper. No console installation is started by this website. The installer was archived without execution.'}]};
}
const research=read('docs/discord-xbox360-guide-research.json');
for(const [id,note] of Object.entries(research))for(const file of note.evidence?.stagedDownloads||[]){
 const absolute=path.resolve(root,file.stagedRelative),relative=path.relative(root,absolute);
 if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Helper staging path outside workspace');
 const bytes=fs.readFileSync(absolute);
 if(bytes.length!==file.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Staged helper differs from reviewed hash: '+id);
 const job={id,resource:id,title:id.endsWith('horizon')?'Horizon':'Xbox 360 XISO Extract Tool',platform:note.evidence.proposedArchivePlatform,category:['Tools'],project:id.endsWith('horizon')?'Horizon':'Xbox 360 XISO Extract Tool',version:file.version,archiveRole:note.evidence.proposedArchiveRole,url:file.sourceUrl,filename:file.filename,importPath:file.stagedRelative,expectedBytes:file.bytes,expectedSha256:file.sha256,pages:['console/xbox360/mods/tools/index.html']};
 const index=jobs.jobs.findIndex(x=>x.id===id);if(index>=0)jobs.jobs[index]={...jobs.jobs[index],...job};else jobs.jobs.push(job);
 prepared.push(job);notes[id]={...(notes[id]||{}),downloads:[{url:file.sourceUrl,label:'Original Windows helper download'}]};
}
write('docs/xbox360-download-imports.json',jobs);write(notesFile,notes);
write('docs/discord-ps4-ps5-raw/platforms/xbox-public-import-jobs.json',{jobs:prepared});
console.log('Prepared '+prepared.length+' verified public source files.');
