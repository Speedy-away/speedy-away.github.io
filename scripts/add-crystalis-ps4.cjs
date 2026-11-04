// Import the user-supplied GTA V 1.57 package. Never execute its console files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const scope='discord-crystalis-ps4',id='gta5-crystalis-1-57';
const archiveHash='d9cea1c72deabd77a38acb806cbf2d203475da5d5b0f3e96d9d4d76aa61b5e04';
const moduleHash='005f707cca7f5da9092339c630b5257d5164fce10515d8f6ecb521a6d2b86158';
const version='GTA V 1.57 - menu release unspecified';
const base='/downloads/ps4/GTA5/157/crystalis/';
function preserve(file,bytes){
 const target=path.join(root,file.replace(/^\//,''));
 if(fs.existsSync(target)){if(hash(fs.readFileSync(target))!==hash(bytes))throw Error('Different existing file: '+file);return;}
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});
}
function prepare(){
 const info=read('docs/discord-ps4-ps5-raw/crystalis-ps4-157-http-info.txt');
 const original=fs.readFileSync(path.join(root,info.stagedRelative));
 if(hash(original)!==archiveHash||original.length!==788845)throw Error('Supplied archive changed');
 const inspect=require('./audit-console-ready-files.cjs').inspectArchive(path.join(root,info.stagedRelative));
 if(inspect.entries.some(e=>e.encrypted)||inspect.fileCount!==81)throw Error('Archive layout differs');
 execFileSync('C:/Program Files/7-Zip/7z.exe',['t',path.join(root,info.stagedRelative)],{stdio:'pipe'});
 const extract=name=>execFileSync('C:/Program Files/7-Zip/7z.exe',['e','-so','-spd',path.join(root,info.stagedRelative),'Crystalis SPRX PS4 1.57/'+name],{maxBuffer:2*1024*1024});
 const plugin=extract('Crystalis.sprx'),ini=extract('plugins.ini').toString('utf8'),instructions=extract('instalacion.txt').toString('utf8');
 const elf=plugin.indexOf(Buffer.from([127,69,76,70]));
 if(hash(plugin)!==moduleHash||plugin.readUInt32LE(0)!==0x1d3d154f||elf!==352||plugin.readUInt16LE(elf+18)!==62)throw Error('Expected PS4 SELF/x86-64 module missing');
 if(!plugin.includes(Buffer.from('Welcome to Crystalis SPRX!- 1.57'))||!ini.includes('[CUSA00419]'))throw Error('Pinned game/title evidence differs');
 preserve(base+info.name,original);preserve(base+'Crystalis.sprx',plugin);
 preserve('/assets/images/ps4-gta5/crystalis-icon.png',extract('Crystalis/imgs/icon.png'));
 const files=[{name:info.name,bytes:original.length,sha256:archiveHash,local:base+info.name,downloadId:id+'-package'},
  {name:'Crystalis.sprx',bytes:plugin.length,sha256:moduleHash,local:base+'Crystalis.sprx',downloadId:id+'-sprx',memberPath:'Crystalis SPRX PS4 1.57/Crystalis.sprx',derivedFrom:archiveHash}];
 return {info,files,ini,instructions,inspect};
}
async function archive(){
 const p=prepare(),intake=require('./console-expansion-archive.cjs').createArchive();
 const item={id:scope+'-157',title:'Crystalis · GTA V PS4 1.57',project:'Crystalis',url:p.info.sourceUrl,platform:'PS4',category:['Games','GTA5','1.57'],gameVersion:'1.57',menuVersion:null,pages:['console/mods/ps4/gta5/index.html'],publication:'include'};
 const records=[];
 for(const f of p.files){const result=await intake.archiveFile({scope,item,file:{...f,version,sourceUrl:p.info.sourceUrl,source:p.info.sourceUrl,resolvedUrl:p.info.sourceUrl,archiveRole:['Builds'],expectedBytes:f.bytes,expectedSha256:f.sha256,format:path.extname(f.name).slice(1).toUpperCase(),compatibility:'PS4 GTA V game update 1.57. Included plugins.ini names CUSA00419. No firmware or PS5 compatibility established.'},sourceFile:path.join(root,f.local.slice(1))});records.push(result.file);}
 // archiveFile has streamed and verified these exact two new files. Preserve
 // prior verified intakes without rehashing every unrelated historical event.
 console.log('Verified Crystalis package and module; merging preserved inventory metadata.');
 await intake.mergeInventory({inventory:intake.inventoryPath(scope),verifyFiles:false});
 const result={archivedAt:new Date().toISOString(),scope,files:records,noDownloadedCodeExecuted:true};
 fs.writeFileSync(path.join(root,'docs/qa/crystalis-ps4-157-archive.json'),JSON.stringify(result,null,2)+'\n');return result;
}
function resource(p){return {
 id,gameIds:['gta5'],category:'menu',publication:'include',catalogueSection:'v157',name:'Crystalis',version:'GTA V 1.57',menuVersion:null,gameVersions:['1.57'],platforms:['ps4'],titleIds:['CUSA00419'],
 description:'SPRX menu with its scripts, outfits and setup notes. Choose the full package to include the data folder.',
 compatibilityText:'PS4 · GTA V 1.57 · CUSA00419 (supplied configuration). GoldHEN plugin setup.',
 source:{forumTitle:'User-supplied attachment',postTitle:'Crystalis SPRX PS4 1.57',postUrl:p.info.sourceUrl,capturedAt:'2026-11-02',captureFile:'docs/discord-ps4-ps5-raw/crystalis-ps4-157-user-source.json',originalDownloadUrls:[p.info.sourceUrl]},
 downloads:[{id:id+'-package',label:'Full package · GTA V 1.57',filename:p.info.name,url:p.info.sourceUrl,distribution:'include'},
 {id:id+'-sprx',label:'Crystalis.sprx · plugin only',filename:'Crystalis.sprx',url:'https://whatwhatboy.com'+base+'Crystalis.sprx',distribution:'include'}],
 images:[{original:'/assets/images/ps4-gta5/crystalis-icon.png',display:'/assets/images/ps4-gta5/crystalis-icon.png',caption:'Crystalis icon included in the supplied PS4 1.57 package; not a gameplay screenshot.'}],videos:[],
 controls:[{input:'L1 + Circle',action:'Open the menu; this shortcut is present in the inspected module strings. Hardware behavior has not been tested.'}],
 guideBlocks:[
 {type:'paragraph',title:'Choose the package',text:'Use the full package for the supplied data folder, scripts and outfits. Crystalis.sprx alone does not include those resources. 1.57 is the GTA V game update, not a menu release or console firmware version.'},
 {type:'steps',title:'Included installation instructions',items:[
 {title:'Check the installed game',text:'The archive and module name GTA V 1.57. The example configuration names CUSA00419; other regional title IDs and PS5 support are not established.'},
 {title:'Keep the data folder',text:'Extract the original archive on your computer. Its installation note places the Crystalis folder under /data, giving /data/Crystalis. Preserve scripts, outfits and imgs. The note says img, but the actual archive and module both use /data/Crystalis/imgs/icon.png.'},
 {title:'Place the module',text:'The supplied note places Crystalis.sprx in /data/GoldHEN/plugins/. Use a GoldHEN plugin environment compatible with your existing PS4 firmware. This SPRX is a game plugin, not a standalone BIN/ELF payload.'},
 {title:'Merge your configuration',text:'Back up your existing plugins.ini. Merge the Crystalis path into the matching CUSA00419 section instead of replacing the whole file. The supplied example also lists LSOPlugin.prx, which is not included; its necessity is not documented. Preserve your unrelated plugin entries.'}
 ]},
 {type:'code',title:'Crystalis entry from the supplied example',text:'[CUSA00419]\n/data/GoldHEN/plugins/Crystalis.sprx'},
 {type:'paragraph',title:'Source and inspection',text:'The supplied instalacion.txt credits FranCangel Modz. The archive passed its integrity test and contains 81 files. Crystalis.sprx has a PS4 SELF header and an embedded x86-64 ELF header. Files were inspected and hashed without execution; no firmware matrix or independent menu release number was supplied.'}
 ]
};}
function mergeJson(file,update){const target=path.join(root,file),before=fs.readFileSync(target,'utf8'),data=JSON.parse(before);update(data);if(fs.readFileSync(target,'utf8')!==before)throw Error('Concurrent change: '+file);fs.writeFileSync(target,JSON.stringify(data,null,2)+'\n');}
function integrate(){
 const p=prepare(),saved=read('docs/qa/crystalis-ps4-157-archive.json');
 for(const f of p.files){const row=saved.files.find(x=>x.sha256===f.sha256);if(!row||hash(fs.readFileSync(row.backupPath))!==f.sha256)throw Error('Required F: copy unverified');}
 const entry=resource(p);
 mergeJson('docs/ps4-ps5-game-resources.json',data=>{const old=data.resources.findIndex(x=>x.id===id);if(old>=0)data.resources[old]=entry;else data.resources.push(entry);});
 mergeJson('downloads/ps4-ps5/manifest.json',data=>{for(const f of p.files){const row={...f,version,source:p.info.sourceUrl,sourceUrl:p.info.sourceUrl,status:'downloaded',platform:'PS4',gameVersion:'1.57',archiveRole:['Builds'],archived:true};const old=data.files.findIndex(x=>x.downloadId===f.downloadId);if(old>=0){if(data.files[old].sha256!==f.sha256)throw Error('Preserve prior different manifest file');data.files[old]={...data.files[old],...row};}else data.files.push(row);}});
 const page='console/mods/ps4/gta5/index.html';
 require('./build-ps4-ps5-game-imports.cjs').createGameImports().buildMods({gameIds:['gta5'],gtaFiles:read('downloads/ps4/GTA5/manifest.json').files});
 const target=path.join(root,page);fs.writeFileSync(target,require('./search-page-output.cjs').finish(page,fs.readFileSync(target,'utf8')));
 require('./console-mod-catalog.cjs').build();
 return {resource:id,page,gameUpdate:'1.57',platform:'PS4',files:p.files.map(f=>({name:f.name,bytes:f.bytes,sha256:f.sha256})),noPayloadExecution:true};
}
if(require.main===module)(async()=>{const flag=process.argv[2];const result=flag==='--archive'?await archive():flag==='--integrate'?integrate():flag==='--prepare'?prepare().files:null;if(!result)throw Error('Use --prepare, --archive or --integrate');console.log(JSON.stringify(result,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={prepare,archive,integrate,resource};
