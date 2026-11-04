'use strict';
// Prepare immutable authored HTML and explicit archive jobs only. No F: writes,
// console requests, package installation or downloaded-code execution.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {destinationForFile}=require('./download-archive-layout.cjs');
const root=path.resolve(__dirname,'..'),VERSION='2026.11.03.1';
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const SOURCES={
  ps4:{version:'2.08',commit:'266d9b8fa7af1cd106688999f95960841c3e894d',httpSHA256:'dd295327ed2cdfb87576682597e4138dbd1fc48eee4ac31115b6290a725be10c',installerSHA256:'eb086dcf47ae32f2b44f61f79771f8bc03cb15cf6b2dca26f3efe3c2c6307ba3'},
  ps5:{version:'2.18',commit:'f3ac2abab304a807f20a8b97480dbd169e5b6be6',httpSHA256:'3df2af33fb9bb04d8900f26196cfa699416b97ee78689c68479131af0b7507e0',installerSHA256:'de03a55f3aa3d0198d794960c5257b203bf261782048a6b96458780fd1fd7338'}
};
function nativeDictionaries(){
  const api=require('../assets/host-package-installer.js'),adapter=require('../assets/host-native-workspace-i18n.js'),result={};
  for(const code of Object.keys(adapter.languages).filter(code=>code!=='en')){
    const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'languages',code+'.js'),'utf8'),context);
    const registration=context.window.__scoobyI18nQueue.find(entry=>entry[0]===code),dictionary=registration&&registration[1];if(!dictionary)throw Error('Missing package installer language: '+code);
    result[code]={};for(const key of api.keys){if(!dictionary[key])throw Error('Missing package installer translation '+code+': '+key);result[code][key]=dictionary[key];}
  }
  return result;
}
function render(platform,{javascript=fs.readFileSync(path.join(root,'assets/host-package-installer.js'),'utf8'),css=fs.readFileSync(path.join(root,'assets/host-package-installer.css'),'utf8'),adapter=fs.readFileSync(path.join(root,'assets/host-native-workspace-i18n.js'),'utf8'),dictionaries}={}){
  if(!['ps4','ps5'].includes(platform))throw Error('Choose PS4 or PS5.');
  const translations=JSON.stringify(dictionaries||nativeDictionaries()).replace(/</g,'\\u003c'),script='window.WhatsiteWorkspaceDictionaries='+translations+';\n'+adapter+'\n'+javascript;
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; connect-src \'self\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>'+platform.toUpperCase()+' native package installer · whatwhatboy</title><style>'+css.replace(/<\/style/gi,'<\\/style')+'</style></head><body><main id="package-installer" data-platform="'+platform+'"></main><noscript>Enable JavaScript and open the installed helper through the matching ezRemote Client.</noscript><script>'+script.replace(/<\/script/gi,'<\\/script')+'</script></body></html>\n';
}
function prepare({outputRoot=root,write=true}={}){
  const api=require('../assets/host-package-installer.js'),artifacts=[],jobs=[],retainedArtifacts=[],retainedArchiveJobs=[];
  function record(platform,relative,bytes,retained){
    const sha256=hash(bytes),name='whatsite-package-installer-'+platform+'.html',release=VERSION+'-'+sha256.slice(0,16);
    const job={id:'whatsite-'+platform+'-package-installer-'+sha256.slice(0,16),title:'whatwhatboy '+platform.toUpperCase()+' native package installer'+(retained?' · retained build':''),platform:platform.toUpperCase(),category:'Tools',project:'whatsite Native Package Installer',version:release,release,filename:name,url:'https://whatwhatboy.com/'+relative,importPath:relative,kind:'generated',archiveRole:['Helpers'],mirror:false,expectedBytes:bytes.length,expectedSha256:sha256,pages:retained?[]:['hosts/'+platform+'/files/index.html','hosts/'+platform+'/payload-manager/index.html','console/'+platform+'/downloads.html']};
    const s=api.settings[platform],artifact={platform,filename:name,local:'/'+relative,downloadURL:'/'+relative,absoluteDownloadURL:job.url,bytes:bytes.length,sha256,version:release,installPath:s.installPath,port:Number(s.port),nativeURL:'http://{consoleIP}:'+s.port+s.installPath,query:'?path={encodedSavedAbsolutePkgPath}&bytes={expectedBytes}',expectedArchivePath:destinationForFile('F:/whatsite-backup-downloads-etc',job,{name,version:release,archiveRole:['Helpers']}),archiveStatus:'prepared-not-archived',source:SOURCES[platform]};
    (retained?retainedArtifacts:artifacts).push(artifact);(retained?retainedArchiveJobs:jobs).push(job);
  }
  for(const platform of ['ps4','ps5']){
    const bytes=Buffer.from(render(platform)),sha256=hash(bytes),relative='downloads/helpers/host-package-installer/'+platform+'/'+sha256.slice(0,16)+'/whatsite-package-installer-'+platform+'.html',file=path.join(outputRoot,relative);
    if(write){fs.mkdirSync(path.dirname(file),{recursive:true});if(fs.existsSync(file)){if(!fs.readFileSync(file).equals(bytes))throw Error('Refusing to replace different immutable helper bytes.');}else fs.writeFileSync(file,bytes,{flag:'wx'});}
    record(platform,relative,bytes,false);
    const folder=path.join(outputRoot,'downloads/helpers/host-package-installer',platform);if(!fs.existsSync(folder))continue;
    for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
      if(!entry.isDirectory()||!/^[a-f0-9]{16}$/.test(entry.name)||entry.name===sha256.slice(0,16))continue;
      const previous='downloads/helpers/host-package-installer/'+platform+'/'+entry.name+'/whatsite-package-installer-'+platform+'.html',previousFile=path.join(outputRoot,previous);if(!fs.existsSync(previousFile))continue;
      const content=fs.readFileSync(previousFile);if(!hash(content).startsWith(entry.name))throw Error('A retained immutable helper changed.');record(platform,previous,content,true);
    }
  }
  const report={schemaVersion:1,generatedAt:new Date().toISOString(),version:VERSION,status:'Prepared and mock tested locally; requires archive verification and explicit native helper installation. Hardware untested.',artifacts,jobs,retainedArtifacts,retainedArchiveJobs,sourceHashes:['assets/host-package-installer.js','assets/host-package-installer.css','assets/host-native-workspace-i18n.js'].map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))})),
    nativeContracts:{list:{method:'POST',path:'/__local__/list',json:{path:'{savedFileParent}',onlyFolders:false},result:'result array; require exact regular-file entry with integral byte size and no matching .tmp entry.'},install:{method:'POST',path:'/__local__/install',json:{items:['{singleVerifiedAbsolutePkgPath}']},result:'result.success must be exactly true; success is reported as native service success, never proved installed.'},ps4:'Native InstallLocalPkg may uninstall an existing application on BGFT registration collision before retrying. The user-facing warning and explicit checkbox precede each request. The native handler waits on BGFT transfer progress.',ps5:'Native local install calls the existing Direct Package Installer and returns after acceptance when remove_after_install=false. Compatible DPI must already be running; the helper does not load it or probe its TCP service.'},
    safeguards:['No requests on opening, query preselection or view rendering. Public/wrong-origin preview is read-only.','Writes use only the exact matching default client origin: PS4 8080 or PS5 9090; no Origin spoofing or cross-origin proxy.','Only absolute bounded /data/.../*.pkg or /mnt/usb[0-9]/.../*.pkg paths; refuse other roots, ext mounts, URL/query/fragment, encoded tricks, traversal, archives and payloads.','List metadata verifies an exact saved entry, expected size when supplied and absence of a matching .tmp; re-read immediately before install. This is not full-file SHA-256/signature/title/compatibility verification.','One pending operation per helper; a durable request guard is saved and re-read before dispatch. Existing guards block further installs across reloads.','A native success acknowledgement also retains the request guard; check the console result, then explicitly clear it. Clearing sends nothing and cancels nothing.','Lost/invalid/negative responses after dispatch are uncertain; retain the guard and never automatically retry.','Selected-file metadata is internally copied; mutating or cloning a returned verification object cannot authorize a different path.','No delete/uninstall API, raw payload launch, install-from-URL route, package upload or silent install-after-download is implemented.','Native app behavior can replace installed titles. Metadata checks are not atomic file-content locks; use one helper window and keep other native installers/writers idle.'],
    languages:{status:'Self-contained inline language adapter and exact authored-key subset. All 20 non-English dictionary keys are required before generation; filenames, path/size displays and input values are excluded from DOM translation.',codes:Object.keys(nativeDictionaries()),keys:api.keys.length},
    validation:{tests:'scripts/tests/host-package-installer.test.cjs',method:'Mock native transport/storage and data-only immutable artifact checks; no actual console API request, package installation or downloaded payload execution.'},
    limitations:['Matching native ezRemote Client must be installed, running and serving this helper at its exact path.','PS5 requires its native Direct Package Installer prerequisites.','No firmware compatibility, available-space or successful-installation fact is inferred from a file extension, listing or HTTP200.','Native service has no atomic installer transaction exposed to this helper; localStorage guard reduces duplicate dispatch but does not control another native app or simultaneous browser process.','Native completion OS notifications belong to ezRemote Server itself; no generic notification API is invented. See docs/host-package-notification-review-20261103.json.']};
  if(write)fs.writeFileSync(path.join(outputRoot,'docs/host-package-installer-build.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(require.main===module){const r=prepare();console.log(JSON.stringify({artifacts:r.artifacts.map(a=>({platform:a.platform,local:a.local,bytes:a.bytes,sha256:a.sha256})),retained:r.retainedArtifacts.length,jobs:r.jobs.length}));}
module.exports={VERSION,SOURCES,nativeDictionaries,render,prepare};
