'use strict';
// Review metadata only. Reads staged original release bytes; never executes them,
// contacts a console, mirrors a binary publicly or writes the F: inventory.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),stage='tmp/host-repository-review/original-tool-followup';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const write=(f,d)=>fs.writeFileSync(path.join(root,f),JSON.stringify(d,null,2)+'\n');
const ORBIS='83c935231d664ee9d523edf32a1c1aecaac1a92a',GOLD='f2cd6f8ec51b6291ef961dc6aa721c96556dbeb4';
const goldReleaseFirmwares=['5.05','6.71','6.72','9.00','9.60','10.00','10.01','10.50','10.70','10.71','11.00'];
const specs=[
  ['505','5.05',626472,'657aad360767ce7f9cef3c374f8ea448870df8d3cf6534a582930bbec0b400ce'],
  ['672','6.72',626504,'c19e3f0d549b241aa31febd5a5223d0bf0156bdc4e419e1083f795ea90d5ce30'],
  ['702','7.02',626664,'9f8a34ff2ab3918f3a01e3126817c3c0afd4671c3f0613e05cef540cf7d79a3c'],
  ['755','7.55',626664,'421131368229e986385a5a5cf4a65d1be8a5835d7ba018720b8764e00153871c'],
  ['900','9.00',626392,'466d816ad26393deb6476c90acda77cb80a6e2c7a15ed70cf588c9447b0a7835']
];
function checked(name,bytes,expected){
  const filename=stage+'/'+name,b=fs.readFileSync(path.join(root,filename));
  if(b.length!==bytes||sha(b)!==expected)throw Error('Pinned release bytes differ: '+name);
  return {name,bytes,sha256:expected,importPath:filename,headerHex:b.subarray(0,16).toString('hex')};
}
function prepare(){
  const repoOrbis=json(stage+'/source-0.json'),repoGold=json(stage+'/source-3.json');
  const releaseOrbis=json(stage+'/source-2.json'),releaseGold=json(stage+'/source-5.json');
  if(json(stage+'/orbis-tag.json').object.sha!==ORBIS||json(stage+'/goldhen-tag.json').object.sha!==GOLD)throw Error('Original release tag moved.');
  if(releaseOrbis.tag_name!=='1.0.1190'||releaseGold.tag_name!=='2.4b18')throw Error('Original release changed.');
  const audit=json('docs/download-audit.json').items,catalogue=json('docs/console-download-catalog.json').items;
  const actions=[],jobs=[],files=[];
  function addFile(file,job){
    files.push({...file,sourceURL:job.url,release:job.version,
      existingArchive:audit.filter(i=>(i.files||[]).some(f=>f.sha256===file.sha256)).map(i=>i.id),
      existingCatalogue:catalogue.filter(i=>i.sha256===file.sha256).map(i=>i.id)});
    jobs.push({...job,platform:'PS4',kind:'direct',filename:file.name,importPath:file.importPath,mirror:false,
      archiveRole:['Builds'],expectedBytes:file.bytes,expectedSha256:file.sha256,maxBytes:3*1024*1024,pages:['hosts/ps4/index.html']});
  }
  for(const [suffix,firmware,bytes,digest]of specs){
    const file=checked('Orbis-Toolbox-'+suffix+'.bin',bytes,digest),asset=releaseOrbis.assets.find(a=>a.name===file.name);
    if(!asset||asset.size!==bytes)throw Error('Original Orbis asset missing or resized: '+suffix);
    if(!file.headerHex.startsWith('e9ab050000'))throw Error('Unexpected Orbis flat BIN header.');
    const id='ps4-original-orbis-toolbox-1-0-1190-'+suffix,canLoad=['505','672','900'].includes(suffix);
    actions.push({id,platform:'ps4',category:'tools',categories:['tools','payloads'],label:'Orbis Toolbox · '+firmware,
      version:'1.0.1190 Alpha',format:'BIN',firmwares:[firmware],bytes,sha256:digest,downloadURL:asset.browser_download_url,
      run:canLoad?{type:'goldhen-http',port:9090,statusPath:'/status',readyStatus:'ready',input:'user-file'}:null,
      source:releaseOrbis.html_url,sourceURL:asset.browser_download_url,sourceCommit:ORBIS,
      instructionsURL:'/docs/host-original-tool-loading.md',
      license:'Original compiled pre-release by OSM-Made. No open-source or redistribution licence is asserted; Download uses the original release asset, and Load reads a user-selected exact file without persistence.',
      publicMirror:false,image:'/assets/images/host-selector/whatwhatboy-ps4.jpg',imageAlt:'PS4 console for Orbis Toolbox',
      imageRole:'Console artwork',imageDescription:'Existing PS4 console artwork; not an Orbis Toolbox interface screenshot.',
      requirements:[
        'PS4 firmware '+firmware+' only. Download the matching Orbis Toolbox 1.0.1190 BIN; other firmware builds are separate files.',
        'Start a compatible HEN before loading Orbis Toolbox. The original author reports Mira and GoldHEN support; use retail executables, not Hybrid Flasher or Updater POC.',
        canLoad?'Load requires an already running compatible GoldHEN HTTP BinLoader on port 9090 and the paired desktop sender. Select the exact original BIN downloaded above.':
          'This 7.02 or 7.55 build remains download-only here. Its original HEN requirement does not establish a compatible GoldHEN HTTP loader; use the original native loading instructions.',
        'This is an alpha pre-release. The original GoldHEN release reports possible rest-mode problems with Orbis Toolbox.',
        'A successful transfer does not prove Orbis Toolbox executed. Check the console before loading another payload.'
      ],
      tags:['PS4',firmware,'Orbis Toolbox','Orbis-Toolbox','1.0.1190','Alpha Build 1190','BIN','homebrew UI','HEN','retail executables'],
      sourceEvidence:{release:'https://github.com/OSM-Made/Orbis-Toolbox/releases/tag/1.0.1190',readme:'https://github.com/OSM-Made/Orbis-Toolbox/blob/'+ORBIS+'/README.md',readmeSHA256:'b09a2bafa5be8cc28d610d331f08a647310808683f2611a8ef50f698e8d45e5f',assetId:asset.id,assetUpdatedAt:asset.updated_at,review:'/docs/qa/host-original-tool-source-review.json'},
      loaderEvidence:{source:'Original release requires HEN then the exact firmware BIN; original README names Mira and GoldHEN. GoldHEN HTTP9090 is the existing reviewed flat-BIN transport after its readiness check.',hardwareExecution:false,sourceConfirmedGoldHENFirmware:canLoad}});
    addFile(file,{id:'host-original-orbis-toolbox-1-0-1190-'+suffix,title:'Orbis Toolbox 1.0.1190 · PS4 '+firmware,project:'Orbis Toolbox',category:['Tools'],url:asset.browser_download_url,version:'1.0.1190 Alpha - firmware '+firmware,sourceCommit:ORBIS,firmwareScope:[firmware]});
  }
  const archive=checked('GoldHEN_v2.4b18.7z',258065,'d0c84c79f65df5afc79a00c578f33ab1aa70aeb9c205f1e789895dc7d4fca38d');
  const archiveAsset=releaseGold.assets.find(a=>a.name===archive.name);if(!archiveAsset||archiveAsset.size!==archive.bytes)throw Error('Official GoldHEN archive changed.');
  addFile(archive,{id:'host-original-goldhen-2-4b18-archive',title:'GoldHEN 2.4b18 · original release archive',project:'GoldHEN',category:['Payloads','GoldHEN'],url:archiveAsset.browser_download_url,version:'2.4b18 - original 7z',sourceCommit:GOLD});
  const gold=checked('goldhen.bin',260160,'eb9fee5e9e3618c0a144a6fc6b8fc1ec7e89cf06483ad64ae7c1085efc9525a3');
  if(!fs.readFileSync(path.join(root,gold.importPath)).equals(fs.readFileSync(path.join(root,stage+'/official-goldhen.bin'))))throw Error('Extracted GoldHEN does not match official pinned raw file.');
  const goldURL='https://raw.githubusercontent.com/GoldHEN/GoldHEN/'+GOLD+'/goldhen.bin';
  actions.push({id:'ps4-original-goldhen-2-4b18-900',platform:'ps4',category:'payloads',label:'GoldHEN 2.4b18 · 9.00',version:'2.4b18',format:'BIN',firmwares:['9.00'],bytes:gold.bytes,sha256:gold.sha256,downloadURL:goldURL,
    run:{type:'bin-tcp',port:9020,input:'user-file'},source:releaseGold.html_url,sourceURL:goldURL,sourceCommit:GOLD,publicMirror:false,
    image:'/assets/images/console-software/goldhen.png',imageAlt:'GoldHEN project logo',imageRole:'Project preview',instructionsURL:'/docs/host-original-tool-loading.md',
    releaseArchiveURL:archiveAsset.browser_download_url,
    license:'Official compiled GoldHEN release by SiSTRo. No open-source or redistribution licence is asserted; Download uses the pinned original publisher file, and Load reads a user-selected exact file without persistence.',
    requirements:[
      'This Load action is for PS4 firmware 9.00 only. Start the built-in PSFree / Lapse loader on the console and wait for its BIN listener on TCP 9020.',
      'Connect the paired desktop sender, choose Load and select the exact original GoldHEN 2.4b18 goldhen.bin downloaded above. The sender verifies its size and SHA-256 before transfer.',
      'The official 2.4b18 release supports previous WebKit entry points and PPPwn. PPPwn requires the release-specific custom stage2; this action uses the separate waiting PS4 9.00 BIN listener.',
      'This is official 2.4b18, not a host-modified 2.4b18.12 build. No PS4 13.xx, 14.00 or PS5 support is established by this entry.',
      'TCP delivery confirms a transfer only. Check the console for successful GoldHEN execution before sending another payload.'
    ],
    tags:['PS4','9.00','GoldHEN','2.4b18','BIN','TCP 9020','PSFree','Lapse','official release','user-selected file'],
    sourceEvidence:{release:releaseGold.html_url,readme:'https://github.com/GoldHEN/GoldHEN/blob/'+GOLD+'/README.md',readmeSHA256:'29c71a5526e43d7395145b10ac8a414063b58321a65784c0be2b4975c719ffd3',review:'/docs/qa/host-original-tool-source-review.json'},
    originalReleaseFirmwares:goldReleaseFirmwares,
    extraction:{archive:archive.name,archiveURL:archiveAsset.browser_download_url,archiveSHA256:archive.sha256,member:'goldhen.bin',crc32:'F431EE2B',transformation:'7-Zip member decompression only; exact bytes also match the official commit-pinned raw BIN.'},
    loaderEvidence:{source:'Official release lists9.00 and previous WebKit support; the existing pinned PSFree/Lapse runBinLoader receives raw flat BIN bytes on9020. The ready file has a flat x64 jump entry rather than an ELF header. Protocol integration is structurally reviewed and mock-tested, not physically executed.',hardwareExecution:false}});
  addFile(gold,{id:'host-original-goldhen-2-4b18-ready',title:'GoldHEN 2.4b18 · original ready BIN',project:'GoldHEN',category:['Payloads','GoldHEN'],url:goldURL,version:'2.4b18 - official unified BIN - '+GOLD.slice(0,12),sourceCommit:GOLD,transformation:'Exact member decompression from the original release archive; byte-identical to the original pinned raw BIN.',sourceArchiveSHA256:archive.sha256});
  const capture=json(stage+'/capture.json');
  const evidence={schemaVersion:1,checkedAt:new Date().toISOString(),method:'Original release/API metadata, exact release-asset download hashing, bounded 7-Zip listing and one-member decompression; no binary execution or console connection.',
    sourceRequests:capture.results,tagPins:{orbis:{url:'https://api.github.com/repos/OSM-Made/Orbis-Toolbox/git/ref/tags/1.0.1190',commit:ORBIS},goldhen:{url:'https://api.github.com/repos/GoldHEN/GoldHEN/git/ref/tags/2.4b18',commit:GOLD}},
    repositories:[{repo:'OSM-Made/Orbis-Toolbox',defaultBranch:repoOrbis.default_branch,branches:json(stage+'/source-1.json').map(b=>({name:b.name,commit:b.commit.sha})),archived:repoOrbis.archived,apiLicense:repoOrbis.license,tag:'1.0.1190',commit:ORBIS,prerelease:releaseOrbis.prerelease,published:releaseOrbis.published_at},
      {repo:'GoldHEN/GoldHEN',defaultBranch:repoGold.default_branch,branches:json(stage+'/source-4.json').map(b=>({name:b.name,commit:b.commit.sha})),archived:repoGold.archived,apiLicense:repoGold.license,tag:'2.4b18',commit:GOLD,prerelease:releaseGold.prerelease,published:releaseGold.published_at}],
    sourceContracts:{orbis:{firmwareBuilds:specs.map(s=>({filename:'Orbis-Toolbox-'+s[0]+'.bin',firmware:s[1]})),henFirst:true,retailExecutablesOnly:true,incompatible:['Hybrid Flasher','Updater POC'],originalReadmeNames:['Mira','GoldHEN'],selectedFileLoadFirmwares:['5.05','6.72','9.00'],downloadOnlyFirmwares:['7.02','7.55'],reason:'Original Orbis support does not establish GoldHEN HTTP availability on7.02/7.55. No such Load route is enabled.'},
      goldhen:{originalReleaseFirmwares:goldReleaseFirmwares,actionFirmware:['9.00'],previousWebKitSupportedByRelease:true,pppwnRequiresCustomStage2:true,releaseVersion:'2.4b18',excludedHostVersion:'2.4b18.12',binMatchesOriginalArchiveAndPinnedRaw:true,archiveSHA256:archive.sha256,readySHA256:gold.sha256,sourceKnownIssue:'The official GoldHEN release reports possible rest-mode crashes or malfunction with Orbis Toolbox, Apollo and Itemzflow.'}},
    archiveMembers:[{name:'goldhen.bin',bytes:260160,crc32:'F431EE2B'},{name:'README.md',bytes:4763},{name:'CHANGELOG.md',bytes:3569},{name:'CHEATMENU.md',bytes:1599},{name:'THANKS.md',bytes:1393},{name:'pppnw_stage2/stage2_v1.03.7z',bytes:2163}],
    files,actions:actions.map(({id,firmwares,run,downloadURL,sha256,bytes})=>({id,firmwares,run,downloadURL,sha256,bytes})),
    licensing:'No original repository licence grant was established. No source code/runtime or ready binary is publicly mirrored; public Download retains the original author URL. User-selected bytes are transient for the requested transfer and are not persisted or redistributed by this metadata batch.',
    limitations:['No downloaded file was executed. No console was contacted.','Official release support and flat-BIN structure establish source scope, not physical success on the user console.','Original Orbis pre-release is archived and must retain its HEN/retail/rest-mode requirements.','GoldHEN release firmware support is recorded separately from the deliberately restricted9.00Load action.']};
  write('docs/host-original-tool-actions.json',{schemaVersion:1,updated:'2026-11-02',scope:'Exact original releases discovered through requested GamerHack review. Original-only Downloads and explicitly opted-in user-selected BIN loading. No public payload mirror.',actions});
  write('docs/host-original-tool-jobs.json',{schemaVersion:1,reviewedAt:evidence.checkedAt,scope:'Seven selected ready/release files; original-only public links. F: intake is performed separately by the existing targeted importer.',jobs});
  write('docs/qa/host-original-tool-source-review.json',evidence);
  return {actions:actions.length,jobs:jobs.length,bytes:jobs.reduce((n,j)=>n+j.expectedBytes,0),loadable:actions.filter(a=>a.run).map(a=>a.id),downloadsOnly:actions.filter(a=>!a.run).map(a=>a.id),newHashes:files.filter(f=>!f.existingArchive.length&&!f.existingCatalogue.length).length};
}
module.exports={prepare};
if(require.main===module)console.log(JSON.stringify(prepare(),null,2));
