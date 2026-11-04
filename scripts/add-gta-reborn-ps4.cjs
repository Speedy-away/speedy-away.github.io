// Import the user-supplied PS4 server client without executing downloaded code.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),scope='gta-reborn-ps4';
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const versions={'1.56':{bytes:255677,sha256:'b1aaba333941b6a251d892c63fc0c716870035b0be5bac09f803f7f301d92934'},'1.57':{bytes:255629,sha256:'d762dac0be6e2f893a531813e57b60a00cdbe5182c27ef4a581964bf57e84070'}};
const archiveHash='83bcf17b3f76bf6be8fbac9dc31728d72581b96abec033939cbf4f2cfaf1792e';
function preserve(local,b){const target=path.join(root,'.'+local);if(fs.existsSync(target)){if(sha(fs.readFileSync(target))!==sha(b))throw Error('Different existing file: '+local);}else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,b,{flag:'wx'});}}
function prepare(){
 const info=read('docs/qa/gta-reborn-http.json'),original=fs.readFileSync(path.join(root,info.stagedRelative));
 if(sha(original)!==archiveHash||original.length!==143582)throw Error('Original ZIP changed');
 execFileSync('C:/Program Files/7-Zip/7z.exe',['t',path.join(root,info.stagedRelative)],{stdio:'pipe'});
 const local='/downloads/ps4/GTA5/reborn/'+archiveHash.slice(0,12)+'/GTA_RBN.zip';preserve(local,original);
 const files=[{name:'GTA_RBN.zip',local,downloadId:'gta5-reborn-package',bytes:original.length,sha256:archiveHash,version:'Original package - GTA V 1.56 and 1.57 clients'}],modules=[];
 for(const [version,expected] of Object.entries(versions)){
  const memberPath=version+'/GTARBN.sprx',b=execFileSync('C:/Program Files/7-Zip/7z.exe',['e','-so','-spd',path.join(root,info.stagedRelative),memberPath]);
  const elf=b.indexOf(Buffer.from([127,69,76,70]));
  if(sha(b)!==expected.sha256||b.length!==expected.bytes||b.readUInt32LE(0)!==0x1d3d154f||elf!==352||b.readUInt16LE(elf+18)!==62||!b.includes(Buffer.from('/data/Reborn.txt'))||!b.includes(Buffer.from('Error are you in '+version+'?')))throw Error('Unexpected client module: '+version);
  const local='/downloads/ps4/GTA5/reborn/'+version+'/GTARBN.sprx';preserve(local,b);
  files.push({name:'GTARBN.sprx',local,downloadId:'gta5-reborn-'+version.replace('.','-')+'-sprx',...expected,version:'GTA V '+version+' - Reborn client release unspecified',gameVersion:version,memberPath,derivedFrom:archiveHash});
  modules.push({gameVersion:version,memberPath,...expected,header:'PS4 SELF with embedded x86-64 ELF',elfOffset:elf,registrationPath:'/data/Reborn.txt',embeddedTitleId:'CUSA00419 in web-API request text; not a regional compatibility matrix'});
 }
 const pictures=[['C:/Users/whatw/AppData/Local/Temp/codex-clipboard-a59bb405-4c37-4460-ad3b-45657e4326b7.png','/assets/images/ps4-gta5/reborn-registration-user.png'],['C:/Users/whatw/AppData/Local/Temp/codex-clipboard-ce75dba3-8f0f-45b3-b167-f3541d1c4d52.png','/assets/images/ps4-gta5/reborn-crew-user.png']];
 for(const [input,output] of pictures)preserve(output,fs.readFileSync(input));
 fs.writeFileSync(path.join(root,'docs/qa/gta-reborn-inspection.json'),JSON.stringify({source:info.sourceUrl,archive:{sha256:archiveHash,bytes:original.length,files:2,personalRegistrationFileIncluded:false},modules,pictures:pictures.map(([input,local])=>({input,local,sha256:sha(fs.readFileSync(input))})),noPayloadExecution:true},null,2)+'\n');
 return {info,files};
}
async function archive(){const p=prepare(),intake=require('./console-expansion-archive.cjs').createArchive(),item={id:scope+'-client',title:'GTA Reborn PS4 client',project:'GTA Reborn',url:p.info.sourceUrl,platform:'PS4',category:['Games','GTA5','Reborn'],pages:['console/mods/ps4/gta5/index.html'],publication:'include'},records=[];
 for(const f of p.files){const result=await intake.archiveFile({scope,item,file:{...f,source:p.info.sourceUrl,sourceUrl:p.info.sourceUrl,resolvedUrl:p.info.sourceUrl,archiveRole:['Builds'],expectedBytes:f.bytes,expectedSha256:f.sha256,compatibility:'ZIP contains distinct GTA V 1.56 and 1.57 clients. Supplied announcement limits live-server access to 1.57. Personal /data/Reborn.txt is required and not included.'},sourceFile:path.join(root,'.'+f.local)});records.push(result.file);}
 fs.writeFileSync(path.join(root,'docs/qa/gta-reborn-archive.json'),JSON.stringify({scope,files:records,noPayloadExecution:true},null,2)+'\n');
 await intake.mergeInventory({inventory:intake.inventoryPath(scope),verifyFiles:false});return {files:records.length};
}
function resource(version,p){const suffix=version.replace('.','-'),id='gta5-reborn-'+suffix;return {
 id,gameIds:['gta5'],category:'client',publication:'include',catalogueSection:'v'+version.replace('.',''),name:'GTA Reborn',version:'PS4 client · GTA V '+version,menuVersion:null,gameVersions:[version],platforms:['ps4'],titleIds:[],guideLabel:'Registration & setup guide',
 description:version==='1.57'?'Private-server client required for Ozark’s Reborn setup. Discord registration and your personal Reborn.txt are required.':'Preserved 1.56 client from the supplied package. The supplied live-server announcement is for 1.57 only.',
 compatibilityText:version==='1.57'?'The supplied announcement names GTA V 1.57 for live-server access.':'Package contains a 1.56 module; current live-server access for 1.56 is not established.',
 source:{forumTitle:'User-supplied GTA Reborn files and setup screenshots',postTitle:'GTA Reborn PS4 1.56 / 1.57',postUrl:p.info.sourceUrl,capturedAt:'2026-11-02',captureFile:'docs/qa/gta-reborn-inspection.json',originalDownloadUrls:[p.info.sourceUrl]},
 downloads:[{id:id+'-sprx',label:'GTARBN.sprx · GTA V '+version,filename:'GTARBN.sprx',url:'https://whatwhatboy.com'+p.files.find(x=>x.gameVersion===version).local,distribution:'include'},
 {id:id+'-package',label:'Original ZIP · choose '+version+' folder',filename:'GTA_RBN.zip',url:p.info.sourceUrl,pluginMembers:[version+'/GTARBN.sprx'],distribution:'include'}],
 images:[{original:'/assets/images/gta52.png',caption:'Grand Theft Auto V artwork; not a GTA Reborn menu screenshot.'},{original:'/assets/images/ps4-gta5/reborn-registration-user.png',role:'guide',caption:'Original registration instructions supplied by the user; the announcement says live access is for 1.57 only.'},{original:'/assets/images/ps4-gta5/reborn-crew-user.png',role:'guide',caption:'Original crew-command and troubleshooting instructions supplied by the user.'}],videos:[],controls:[],
 tags:['PS4','Server client','GTA Reborn','SPRX','Discord registration','Reborn.txt'],keywords:['GTA RBN','GTARBN.sprx','GTA Reborn','Ozark dependency','private server','Reborn.txt',version],
 guideBlocks:[
 {type:'paragraph',title:'Game update and server availability',text:'The ZIP contains separate 1.56/GTARBN.sprx and 1.57/GTARBN.sprx files. Choose the exact folder for your installed GTA V update. The supplied server announcement explicitly says “FOR 1.57 ONLY”; preserving the 1.56 client is not confirmation of current 1.56 server access. No PS5 or firmware compatibility is established.'},
 {type:'steps',title:'Register and install',items:[
 {title:'Register yourself in GTA Reborn Discord',text:'Use the server’s bot command /link username:YOUR_GAMERTAG. Replace YOUR_GAMERTAG with your PSN name exactly as it appears on your console, including letter case. The supplied instructions allow one registration per Discord account; each player registers from their own account.'},
 {title:'Save your personal registration file',text:'The bot replies privately with Reborn.txt. Copy that exact file to /data/Reborn.txt on your PS4. It is not included in this download and must come from your own registration. The supplied instructions say there is no in-game registration.'},
 {title:'Install the matching client',text:'With GTA V closed, copy the '+version+' client to /data/GoldHEN/plugins/GTARBN.sprx. The original ZIP contains both updates under different folders; the standalone download on this card is already the '+version+' file. Keep the other build separate rather than overwriting it by shared filename.'},
 {title:'Merge plugins.ini',text:'Choose your installed title ID in the region selector. Merge the generated section into /data/GoldHEN/plugins.ini and retain unrelated entries. Regional configurations are templates: embedded CUSA00419 request text does not establish a complete EU/USA compatibility matrix.'},
 {title:'Launch the server client',text:'Start GTA Online with the correct Reborn plugin loaded and follow the server’s instructions. The supplied setup says a missing or incomplete /data/Reborn.txt prevents patches from being applied. Confirm that the client works before adding Ozark.'}]},
 {type:'code',title:'Registration command from the supplied instructions',text:'/link username:YOUR_GAMERTAG'},
 {type:'code',title:'Required PS4 paths',text:'/data/Reborn.txt\n/data/GoldHEN/plugins/GTARBN.sprx\n/data/GoldHEN/plugins.ini'},
 {type:'paragraph',title:'Ozark setup',text:'This Ozark setup requires the matching GTA Reborn client. Ozark '+version+' combined downloads include this exact '+version+' Reborn module and an INI with both plugin paths. Your personal Reborn.txt is still required; it is never generated or included by the website.'},
 {type:'list',title:'Other commands in the supplied guide',items:['/playersonline [minutes] lists recently active players; the supplied default is 15 minutes. Example: /playersonline minutes:60.','/viewcrews lists available crews. /createcrew creates a crew with name and tag, plus optional motto, colour, owner, public/private setting and icon.','/linkcrew crew:TAG assigns a crew; the supplied instructions also accept its name or crew_id.']},
 {type:'list',title:'Troubleshooting from the supplied guide',items:['Cannot join: check registration with /link and the presence of /data/Reborn.txt.','Patches were not applied: the supplied guide says Reborn.txt is absent or incomplete; retrieve your own file from the bot’s private reply.','Misspelled PSN name: contact the GTA Reborn server team to correct registration; do not register a friend from your account.']}
 ]
};}
function merge(file,edit){const target=path.join(root,file),before=fs.readFileSync(target,'utf8'),data=JSON.parse(before);edit(data);if(fs.readFileSync(target,'utf8')!==before)throw Error('Concurrent change: '+file);fs.writeFileSync(target,JSON.stringify(data,null,2)+'\n');}
function integrate(){const p=prepare(),saved=read('docs/qa/gta-reborn-archive.json');for(const f of p.files){const b=saved.files.find(x=>x.sha256===f.sha256);if(!b||sha(fs.readFileSync(b.backupPath))!==f.sha256)throw Error('Required F: copy missing');}
 merge('docs/ps4-ps5-game-resources.json',data=>{for(const version of Object.keys(versions)){const entry=resource(version,p),old=data.resources.find(x=>x.id===entry.id);if(old){for(const d of entry.downloads)if(!old.downloads.some(x=>x.id===d.id))old.downloads.push(d);}else data.resources.push(entry);
  const ozark=data.resources.find(x=>x.id==='gta5-ozark-'+version.replace('.','-'));ozark.requiredResources=[{id:entry.id,label:'GTA Reborn '+version+' required',href:'#guide-'+entry.id,moduleDownloadId:entry.id+'-sprx',gameVersion:version}];
  ozark.description='Requires the matching GTA Reborn client and your personal /data/Reborn.txt for this server setup.';ozark.tags=[...new Set([...(ozark.tags||[]),'Requires GTA Reborn'])];
  const block={type:'paragraph',title:'GTA Reborn is required',text:'This Ozark setup requires GTA Reborn. Use the matching '+version+' GTARBN.sprx alongside Ozark.sprx and complete Discord registration to obtain your own /data/Reborn.txt. The combined Ozark download includes both modules and both INI paths, but cannot include your personal registration file. The supplied live-server announcement is for 1.57 only; 1.56 server access is not established.'};if(!ozark.guideBlocks.some(x=>x.title===block.title))ozark.guideBlocks.unshift(block);
 }});
 merge('downloads/ps4-ps5/manifest.json',data=>{for(const f of p.files){const ids=f.name==='GTA_RBN.zip'?['gta5-reborn-package','gta5-reborn-1-56-package','gta5-reborn-1-57-package']:[f.downloadId];for(const downloadId of ids){const old=data.files.find(x=>x.downloadId===downloadId);if(old){if(old.sha256!==f.sha256)throw Error('Preserve different previous download');continue;}data.files.push({...f,downloadId,status:'downloaded',source:p.info.sourceUrl,sourceUrl:p.info.sourceUrl,platform:'PS4',archived:true,archiveRole:['Builds']});}}});
 merge('docs/seo/search-editorial-overrides.json',data=>{const key='console/mods/ps4/gta5/index.html';data[key]||={};data[key].keywords=[...new Set([...(data[key].keywords||[]),'GTA Reborn','GTARBN.sprx','Reborn.txt','Ozark Reborn setup'])];});return {resources:['gta5-reborn-1-56','gta5-reborn-1-57'],files:3};
}
if(require.main===module)(async()=>{const flag=process.argv[2];console.log(JSON.stringify(flag==='--prepare'?prepare().files:flag==='--archive'?await archive():flag==='--integrate'?integrate():(()=>{throw Error('Use --prepare, --archive or --integrate');})(),null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={prepare,archive,integrate,resource};
