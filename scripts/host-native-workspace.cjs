// Prepare immutable authored helpers and archive import jobs. No archive writes or console I/O.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {destinationForFile}=require('./download-archive-layout.cjs');
const root=path.resolve(__dirname,'..');
const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
const VERSION='2026.11.02.1';
const SOURCES={
  ps4:{tag:'2.08',commit:'266d9b8fa7af1cd106688999f95960841c3e894d',httpSourceSHA256:'dd295327ed2cdfb87576682597e4138dbd1fc48eee4ac31115b6290a725be10c'},
  ps5:{tag:'2.18',commit:'f3ac2abab304a807f20a8b97480dbd169e5b6be6',httpSourceSHA256:'3df2af33fb9bb04d8900f26196cfa699416b97ee78689c68479131af0b7507e0'}
};
function sourceEvidence(platform){const repo='cy33hc/'+platform+'-ezremote-client',pin=SOURCES[platform];return {...pin,repository:'https://github.com/'+repo,server:'https://github.com/'+repo+'/blob/'+pin.commit+'/source/server/http_server.cpp',filesystem:'https://github.com/'+repo+'/blob/'+pin.commit+'/source/fs.cpp'};}
function nativeKeys(javascript=fs.readFileSync(path.join(root,'assets/host-native-workspace.js'),'utf8')){
  const keys=[...require('../assets/host-native-workspace-i18n.js').keys];
  for(const match of javascript.matchAll(/error\('[^']+',\s*'((?:\\.|[^'])*)'/g))keys.push(vm.runInNewContext("'"+match[1]+"'"));
  return [...new Set(keys)];
}
function nativeDictionaries(javascript){
  const keys=nativeKeys(javascript),dictionaries={};
  for(const code of Object.keys(require('../assets/host-native-workspace-i18n.js').languages).filter(code=>code!=='en')){
    const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'languages',code+'.js'),'utf8'),sandbox);
    const entry=sandbox.window.__scoobyI18nQueue.find(item=>item[0]===code),dictionary=entry&&entry[1];
    if(!dictionary)throw Error('Native dictionary did not register: '+code);
    dictionaries[code]={};for(const key of keys){if(!dictionary[key])throw Error('Missing native translation '+code+': '+key);dictionaries[code][key]=dictionary[key];}
  }
  return dictionaries;
}
function render(platform,{javascript=fs.readFileSync(path.join(root,'assets/host-native-workspace.js'),'utf8'),css=fs.readFileSync(path.join(root,'assets/host-native-workspace.css'),'utf8'),i18nJavascript=fs.readFileSync(path.join(root,'assets/host-native-workspace-i18n.js'),'utf8'),dictionaries}={}){
  if(!['ps4','ps5'].includes(platform))throw Error('Choose PS4 or PS5');
  const embedded=JSON.stringify(dictionaries||nativeDictionaries(javascript)).replace(/</g,'\\u003c');
  const script='window.WhatsiteWorkspaceDictionaries='+embedded+';\n'+i18nJavascript+'\n'+javascript;
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; connect-src \'self\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>'+platform.toUpperCase()+' files &amp; payloads · whatsite</title><style>'+css.replace(/<\/style/gi,'<\\/style')+'</style></head><body><main id="native-workspace" data-platform="'+platform+'"></main><noscript>Enable JavaScript, copy this HTML file to the documented console path and open it through the running native ezRemote Client.</noscript><script>'+script.replace(/<\/script/gi,'<\\/script')+'</script></body></html>\n';
}
function prepare({outputRoot=root,write=true}={}){
  const api=require('../assets/host-native-workspace.js'),artifacts=[],jobs=[],retainedArtifacts=[],retainedArchiveJobs=[];
  for(const platform of ['ps4','ps5']){
    const content=Buffer.from(render(platform)),hash=sha256(content),filename='whatsite-workspace-'+platform+'.html',relative='downloads/helpers/host-native-workspace/'+platform+'/'+hash.slice(0,16)+'/'+filename,destination=path.join(outputRoot,relative),settings=api.settings[platform];
    if(write){fs.mkdirSync(path.dirname(destination),{recursive:true});if(fs.existsSync(destination)){if(!fs.readFileSync(destination).equals(content))throw Error('Refusing to replace different immutable helper bytes: '+destination);}else fs.writeFileSync(destination,content,{flag:'wx'});}
    const item={id:'whatsite-'+platform+'-native-workspace-'+hash.slice(0,16),title:'whatsite '+platform.toUpperCase()+' native file and payload workspace',platform:platform.toUpperCase(),category:'Tools',project:'whatsite Native Workspace',version:VERSION+'-'+hash.slice(0,16),filename,url:'https://whatwhatboy.com/'+relative,importPath:relative,kind:'generated',archiveRole:['Helpers'],mirror:false,pages:['hosts/'+platform+'/files/index.html','hosts/'+platform+'/payload-manager/index.html'],expectedBytes:content.length,expectedSha256:hash};
    item.release=item.version;
    const backup=destinationForFile('F:/whatsite-backup-downloads-etc',item,{name:filename,version:item.version,archiveRole:item.archiveRole});
    artifacts.push({platform,filename,local:'/'+relative,immutablePath:'/'+relative,downloadURL:'/'+relative,absoluteDownloadURL:'https://whatwhatboy.com/'+relative,bytes:content.length,sha256:hash,installPath:settings.installPath,nativeURLPath:settings.installPath,port:Number(settings.port),nativeURL:'http://{consoleIP}:'+settings.port+settings.installPath,views:['files','payloads','autoload'],viewQuery:'?view={view}',expectedArchivePath:backup,archiveStatus:'prepared-not-archived',source:sourceEvidence(platform)});jobs.push(item);
  }
  // Retain every generated predecessor. Only artifacts[] is the active profile;
  // historical helpers receive separate archive jobs, never silent replacement.
  for(const platform of ['ps4','ps5']){
    const base=path.join(outputRoot,'downloads/helpers/host-native-workspace',platform);
    if(!fs.existsSync(base))continue;
    for(const entry of fs.readdirSync(base,{withFileTypes:true})){
      if(!entry.isDirectory()||!/^[a-f0-9]{16}$/.test(entry.name))continue;
      const filename='whatsite-workspace-'+platform+'.html',relative='downloads/helpers/host-native-workspace/'+platform+'/'+entry.name+'/'+filename;
      if(artifacts.some(a=>a.local==='/'+relative))continue;
      const file=path.join(outputRoot,relative);if(!fs.existsSync(file))continue;
      const content=fs.readFileSync(file),hash=sha256(content);if(!hash.startsWith(entry.name))throw Error('Retained immutable helper no longer matches its folder hash: '+relative);
      const version=VERSION+'-'+entry.name,item={id:'whatsite-'+platform+'-native-workspace-'+entry.name,title:'whatsite '+platform.toUpperCase()+' native workspace · retained build',platform:platform.toUpperCase(),category:'Tools',project:'whatsite Native Workspace',version,release:version,filename,url:'https://whatwhatboy.com/'+relative,importPath:relative,kind:'generated',archiveRole:['Helpers'],mirror:false,pages:[],expectedBytes:content.length,expectedSha256:hash};
      retainedArtifacts.push({platform,filename,local:'/'+relative,bytes:content.length,sha256:hash,status:'Retained superseded generated helper; no active public profile link.',expectedArchivePath:destinationForFile('F:/whatsite-backup-downloads-etc',item,{name:filename})});retainedArchiveJobs.push(item);
    }
  }
  const report={schemaVersion:1,generatedAt:new Date().toISOString(),version:VERSION,status:'Prepared and tested locally; requires archive/import verification and explicit helper installation before activation. Hardware untested.',artifacts,jobs,retainedArtifacts,retainedArchiveJobs,archiveJobInstruction:'Import jobs plus retainedArchiveJobs. Use only artifacts for current public helper links. Existing versions must be retained.',
    endpoints:[{method:'POST',path:'/__local__/list',json:{path:'/data/payloads',onlyFolders:false},result:'Array of name/type/size/date/rights records.'},{method:'GET',path:'/__local__/downloadFile?path={encodedAbsolutePath}',result:'Raw bytes; client verifies size and bounded response.'},{method:'POST',path:'/__local__/getContent',json:{item:'{absoluteFile}'},result:'result is a string; read only after size check.'},{method:'POST',path:'/__local__/edit',json:{item:'{uniqueConfigStagingFile}',content:'{fullPreservedText}'},result:'result.success, followed by raw byte hash verification.'},{method:'POST',path:'/__local__/upload',multipartOrdered:['destination','_chunkSize','_chunkNumber=0','_totalSize','_currentChunkSize','file'],result:'Single complete BIN/ELF or backup upload; no automatic resume/retry; verify raw saved bytes.'},{method:'POST',path:'/__local__/createFolder',json:{newPath:'{managedAbsolutePath}'},result:'Native acknowledgement followed by parent-list postcondition.'},{method:'POST',path:'/__local__/rename',json:{item:'{source}',newItemPath:'{destination}'},result:'Never overwrite a payload destination; config staging replacement follows verified backup, hash precondition and final readback.'}],
    queueFiles:{ps4:'/data/GoldHEN/payloads.ini',ps5:'/data/pldmgr/autoload.txt',ps4Note:'GoldHEN uses [AutoRun] in payloads.ini, not AutoRun.ini. Raw text editor preserves untouched lines, sections and existing line endings. No invented queue/delay syntax.',goldhenEvidence:'https://github.com/MoHadiShibli/Control4Free/blob/6a0e6925e5a9c34104512346774afbb0788c7bb3/docs/installation.md'},
    ps5Manager:{version:'0.6.3',commit:'3f881e8e569eba3054d1784a1962439b2eee92c2',server:'https://github.com/itsPLK/ps5-payload-manager/blob/3f881e8e569eba3054d1784a1962439b2eee92c2/src/http_server.c',nativeOrigin:'http://{consoleIP}:8084',links:['/#/autoload','/#/storage','/#/settings'],constraint:'Manager embeds its web assets in the ELF, with no arbitrary local HTML route. Native management APIs require its own origin. The ezRemote workspace does not spoof Origin/Referer or call the manager API. Raw on-disk autoload edits do not prove that any active native sequence has changed.'},
    safeguards:['No API requests on page open or tab change; explicit user action required.','Public/incorrect-origin preview stays read-only; writes require a successful native directory read.','Only /data and explicitly supplied verified mount roots may be read. The authored UI stays under /data because ezRemote does not supply authoritative mount verification.','Writes limited to /data/payloads, /data/whatwhatboy, PS5 /data/pldmgr/payloads/local, and exact platform configuration plus unique backup/staging siblings.','No delete, remove, install, payload execution, TCP probe or cross-origin API requests.','BIN/ELF uploads limited to 8 MiB; binary reads 32 MiB; text editor 64 KiB; directory responses 1 MiB/5000 entries.','Every save verifies current hash, uploads and hash-verifies unique original-byte backup, rechecks original, writes/reads a unique stage, rechecks original again, then renames and verifies final bytes. Existing backups and partial stages are retained.','Native file API provides no atomic compare-and-swap. Other native writers must be idle; rechecks reduce but cannot eliminate races.','Rename/createFolder/upload native success can be misleading; client verifies actual postconditions and never retries automatically.','Pinned ezRemote singleFilename copy branch skips regular files; backup never uses /copy.'],
    i18n:{languages:Object.keys(require('../assets/host-native-workspace-i18n.js').languages),dictionaryKeys:nativeKeys(),runtime:'assets/host-native-workspace-i18n.js',runtimeSHA256:sha256(fs.readFileSync(path.join(root,'assets/host-native-workspace-i18n.js'))),mode:'Exact static/template subset embedded inline for all twenty translated languages plus English. Local picker, translated prompts, read-only data paths/names/hashes and raw editor protection. No remote language requests or expanded permissions.'},
    validation:{unitTest:'scripts/tests/host-native-workspace.test.cjs',unitCommand:'node --test scripts/tests/host-native-workspace.test.cjs',browserWorkflow:'Root agent owns CUA browser visual/native-origin fixture checks. This generator does not launch browser automation.',compatibility:'ES5 syntax; authored Promise fallback; UTF-8 and SHA-256 fallbacks for HTTP console origins; no Array.includes, lookbehind or Number.isSafeInteger requirement.'},
    limitations:['Installed native app and compatible homebrew environment required. Firmware support is not inferred from the workspace.','No hardware success claim; all tests use mock APIs/filesystems.','Public host cannot directly manage private console services; install and navigate to the helper’s native origin.','Autoload editor is a raw native-file editor. It does not automatically enable autoload, reorder guessed entries, run a queue or claim live settings applied.','Empty originals are backed up with zero-byte multipart uploads. Empty replacement stages also use multipart to avoid the native FS::Save empty-file handle leak.','Original files/versions and all receiver6701 helpers are unchanged.']};
  if(write)fs.writeFileSync(path.join(outputRoot,'docs/host-native-workspace-build.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}
if(require.main===module){const report=prepare();process.stdout.write(JSON.stringify({artifacts:report.artifacts.map(x=>({platform:x.platform,local:x.local,bytes:x.bytes,sha256:x.sha256})),jobs:report.jobs.length})+'\n');}
module.exports={VERSION,SOURCES,sourceEvidence,nativeKeys,nativeDictionaries,render,prepare};
